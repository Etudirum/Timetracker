from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="TimeTracker API", version="1.0.0")

# Create API router
api_router = APIRouter(prefix="/api")

# Models
class Employee(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    position: str
    email: Optional[str] = None
    startTime: str = "08:00"
    endTime: str = "17:00"
    breakDuration: int = 30  # minutes
    hourlyRate: float = 0.0
    isActive: bool = True
    createdAt: datetime = Field(default_factory=datetime.utcnow)

class EmployeeCreate(BaseModel):
    name: str
    position: str
    email: Optional[str] = None
    startTime: str = "08:00"
    endTime: str = "17:00"
    breakDuration: int = 30
    hourlyRate: float = 0.0

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[str] = None
    email: Optional[str] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    breakDuration: Optional[int] = None
    hourlyRate: Optional[float] = None
    isActive: Optional[bool] = None

class Break(BaseModel):
    startTime: str
    endTime: Optional[str] = None

class TimeEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employeeId: str
    startTime: str
    endTime: Optional[str] = None
    breaks: List[Break] = []
    status: str = "active"  # active, on_break, completed
    notes: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)

class TimeEntryCreate(BaseModel):
    employeeId: str
    startTime: str
    endTime: Optional[str] = None
    breaks: List[Break] = []
    status: str = "active"
    notes: Optional[str] = None

class TimeEntryUpdate(BaseModel):
    endTime: Optional[str] = None
    breaks: Optional[List[Break]] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class Settings(BaseModel):
    adminPassword: str
    workingHours: Dict[str, str] = {"start": "08:00", "end": "17:00"}
    breakDuration: int = 30
    companyName: str = "TimeTracker24"
    currency: str = "EUR"

class SettingsUpdate(BaseModel):
    adminPassword: Optional[str] = None
    workingHours: Optional[Dict[str, str]] = None
    breakDuration: Optional[int] = None
    companyName: Optional[str] = None
    currency: Optional[str] = None

class AuthRequest(BaseModel):
    password: str

class StatsResponse(BaseModel):
    weeklyHours: float
    activeEmployees: int
    totalEmployees: int
    overtimeHours: float
    topEmployees: List[Dict[str, Any]]
    dailyBreakdown: List[Dict[str, Any]]

# Utility functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except:
        return False

async def get_or_create_settings():
    settings = await db.settings.find_one({"_id": "default"})
    if not settings:
        default_settings = {
            "_id": "default",
            "adminPassword": hash_password("admin123"),
            "workingHours": {"start": "08:00", "end": "17:00"},
            "breakDuration": 30,
            "companyName": "TimeTracker24",
            "currency": "EUR"
        }
        await db.settings.insert_one(default_settings)
        return default_settings
    return settings

# API Routes

# Health check
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Auth
@api_router.post("/auth/admin")
async def authenticate_admin(auth: AuthRequest):
    settings = await get_or_create_settings()
    if verify_password(auth.password, settings["adminPassword"]):
        return {"authenticated": True, "message": "Authentication successful"}
    raise HTTPException(status_code=401, detail="Invalid password")

# Settings
@api_router.get("/settings")
async def get_settings():
    settings = await get_or_create_settings()
    # Don't return the password hash
    return {
        "workingHours": settings.get("workingHours", {"start": "08:00", "end": "17:00"}),
        "breakDuration": settings.get("breakDuration", 30),
        "companyName": settings.get("companyName", "TimeTracker24"),
        "currency": settings.get("currency", "EUR")
    }

@api_router.put("/settings")
async def update_settings(settings_update: SettingsUpdate):
    settings = await get_or_create_settings()
    update_data = settings_update.dict(exclude_unset=True)
    
    # Hash password if provided
    if "adminPassword" in update_data:
        update_data["adminPassword"] = hash_password(update_data["adminPassword"])
    
    await db.settings.update_one(
        {"_id": "default"},
        {"$set": update_data}
    )
    return {"message": "Settings updated successfully"}

# Employees
@api_router.get("/employees", response_model=List[Employee])
async def get_employees():
    employees = await db.employees.find({"isActive": True}).to_list(1000)
    return [Employee(**employee) for employee in employees]

@api_router.post("/employees", response_model=Employee)
async def create_employee(employee: EmployeeCreate):
    employee_dict = employee.dict()
    employee_obj = Employee(**employee_dict)
    
    await db.employees.insert_one(employee_obj.dict())
    return employee_obj

@api_router.get("/employees/{employee_id}", response_model=Employee)
async def get_employee(employee_id: str):
    employee = await db.employees.find_one({"id": employee_id, "isActive": True})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return Employee(**employee)

@api_router.put("/employees/{employee_id}", response_model=Employee)
async def update_employee(employee_id: str, employee_update: EmployeeUpdate):
    update_data = employee_update.dict(exclude_unset=True)
    
    result = await db.employees.update_one(
        {"id": employee_id, "isActive": True},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    employee = await db.employees.find_one({"id": employee_id})
    return Employee(**employee)

@api_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str):
    result = await db.employees.update_one(
        {"id": employee_id},
        {"$set": {"isActive": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    return {"message": "Employee deleted successfully"}

# Time Entries
@api_router.get("/time-entries", response_model=List[TimeEntry])
async def get_time_entries(
    employee_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 1000
):
    filters = {}
    
    if employee_id:
        filters["employeeId"] = employee_id
    
    if start_date:
        filters["startTime"] = {"$gte": start_date}
    
    if end_date:
        if "startTime" in filters:
            filters["startTime"]["$lte"] = end_date
        else:
            filters["startTime"] = {"$lte": end_date}
    
    if status:
        filters["status"] = status
    
    time_entries = await db.time_entries.find(filters).sort("startTime", -1).to_list(limit)
    return [TimeEntry(**entry) for entry in time_entries]

@api_router.post("/time-entries", response_model=TimeEntry)
async def create_time_entry(time_entry: TimeEntryCreate):
    # Check if employee exists
    employee = await db.employees.find_one({"id": time_entry.employeeId, "isActive": True})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check if employee already has an active time entry
    existing_entry = await db.time_entries.find_one({
        "employeeId": time_entry.employeeId,
        "status": {"$in": ["active", "on_break"]}
    })
    
    if existing_entry:
        raise HTTPException(
            status_code=400, 
            detail="Employee already has an active time entry"
        )
    
    time_entry_dict = time_entry.dict()
    time_entry_obj = TimeEntry(**time_entry_dict)
    
    await db.time_entries.insert_one(time_entry_obj.dict())
    return time_entry_obj

@api_router.put("/time-entries/{entry_id}", response_model=TimeEntry)
async def update_time_entry(entry_id: str, time_entry_update: TimeEntryUpdate):
    update_data = time_entry_update.dict(exclude_unset=True)
    
    result = await db.time_entries.update_one(
        {"id": entry_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Time entry not found")
    
    time_entry = await db.time_entries.find_one({"id": entry_id})
    return TimeEntry(**time_entry)

@api_router.delete("/time-entries/{entry_id}")
async def delete_time_entry(entry_id: str):
    result = await db.time_entries.delete_one({"id": entry_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Time entry not found")
    
    return {"message": "Time entry deleted successfully"}

# Clock in/out endpoints
@api_router.post("/clock-in/{employee_id}")
async def clock_in(employee_id: str):
    # Check if employee exists
    employee = await db.employees.find_one({"id": employee_id, "isActive": True})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check if employee already has an active time entry
    existing_entry = await db.time_entries.find_one({
        "employeeId": employee_id,
        "status": {"$in": ["active", "on_break"]}
    })
    
    if existing_entry:
        raise HTTPException(
            status_code=400, 
            detail="Employee already clocked in"
        )
    
    time_entry = TimeEntry(
        employeeId=employee_id,
        startTime=datetime.utcnow().isoformat(),
        status="active"
    )
    
    await db.time_entries.insert_one(time_entry.dict())
    return time_entry

@api_router.post("/clock-out/{employee_id}")
async def clock_out(employee_id: str):
    # Find active time entry
    active_entry = await db.time_entries.find_one({
        "employeeId": employee_id,
        "status": {"$in": ["active", "on_break"]}
    })
    
    if not active_entry:
        raise HTTPException(
            status_code=400, 
            detail="No active time entry found for employee"
        )
    
    # Update entry with end time
    await db.time_entries.update_one(
        {"id": active_entry["id"]},
        {"$set": {
            "endTime": datetime.utcnow().isoformat(),
            "status": "completed"
        }}
    )
    
    updated_entry = await db.time_entries.find_one({"id": active_entry["id"]})
    return TimeEntry(**updated_entry)

@api_router.post("/start-break/{employee_id}")
async def start_break(employee_id: str):
    # Find active time entry
    active_entry = await db.time_entries.find_one({
        "employeeId": employee_id,
        "status": "active"
    })
    
    if not active_entry:
        raise HTTPException(
            status_code=400, 
            detail="No active time entry found for employee"
        )
    
    # Add break
    breaks = active_entry.get("breaks", [])
    breaks.append({
        "startTime": datetime.utcnow().isoformat(),
        "endTime": None
    })
    
    await db.time_entries.update_one(
        {"id": active_entry["id"]},
        {"$set": {
            "breaks": breaks,
            "status": "on_break"
        }}
    )
    
    updated_entry = await db.time_entries.find_one({"id": active_entry["id"]})
    return TimeEntry(**updated_entry)

@api_router.post("/end-break/{employee_id}")
async def end_break(employee_id: str):
    # Find active time entry
    active_entry = await db.time_entries.find_one({
        "employeeId": employee_id,
        "status": "on_break"
    })
    
    if not active_entry:
        raise HTTPException(
            status_code=400, 
            detail="No active break found for employee"
        )
    
    # End the last break
    breaks = active_entry.get("breaks", [])
    if breaks and not breaks[-1].get("endTime"):
        breaks[-1]["endTime"] = datetime.utcnow().isoformat()
    
    await db.time_entries.update_one(
        {"id": active_entry["id"]},
        {"$set": {
            "breaks": breaks,
            "status": "active"
        }}
    )
    
    updated_entry = await db.time_entries.find_one({"id": active_entry["id"]})
    return TimeEntry(**updated_entry)

# Statistics
@api_router.get("/stats", response_model=StatsResponse)
async def get_stats():
    now = datetime.utcnow()
    week_start = now - timedelta(days=now.weekday())
    today = now.date()
    
    # Get all time entries for the week
    week_entries = await db.time_entries.find({
        "startTime": {"$gte": week_start.isoformat()}
    }).to_list(1000)
    
    # Calculate weekly hours
    weekly_hours = 0
    for entry in week_entries:
        if entry.get("endTime"):
            start = datetime.fromisoformat(entry["startTime"])
            end = datetime.fromisoformat(entry["endTime"])
            duration = (end - start).total_seconds() / 3600
            weekly_hours += duration
    
    # Get active employees (those with active time entries today)
    today_entries = await db.time_entries.find({
        "startTime": {"$gte": today.isoformat()},
        "status": {"$in": ["active", "on_break"]}
    }).to_list(1000)
    
    active_employees = len(set(entry["employeeId"] for entry in today_entries))
    
    # Get total employees
    total_employees = await db.employees.count_documents({"isActive": True})
    
    # Calculate overtime (assuming 40 hours/week standard)
    overtime_hours = max(0, weekly_hours - 40)
    
    # Get top employees by hours this week
    employee_hours = {}
    for entry in week_entries:
        if entry.get("endTime"):
            start = datetime.fromisoformat(entry["startTime"])
            end = datetime.fromisoformat(entry["endTime"])
            duration = (end - start).total_seconds() / 3600
            
            emp_id = entry["employeeId"]
            if emp_id not in employee_hours:
                employee_hours[emp_id] = 0
            employee_hours[emp_id] += duration
    
    # Get employee names
    employees = await db.employees.find({}).to_list(1000)
    employee_names = {emp["id"]: emp["name"] for emp in employees}
    
    top_employees = []
    for emp_id, hours in sorted(employee_hours.items(), key=lambda x: x[1], reverse=True)[:5]:
        top_employees.append({
            "id": emp_id,
            "name": employee_names.get(emp_id, "Unknown"),
            "hours": round(hours, 1)
        })
    
    # Daily breakdown for the week
    daily_breakdown = []
    for i in range(7):
        day = week_start + timedelta(days=i)
        day_entries = [e for e in week_entries if datetime.fromisoformat(e["startTime"]).date() == day.date()]
        
        day_hours = 0
        for entry in day_entries:
            if entry.get("endTime"):
                start = datetime.fromisoformat(entry["startTime"])
                end = datetime.fromisoformat(entry["endTime"])
                duration = (end - start).total_seconds() / 3600
                day_hours += duration
        
        daily_breakdown.append({
            "date": day.date().isoformat(),
            "hours": round(day_hours, 1),
            "employees": len(set(entry["employeeId"] for entry in day_entries))
        })
    
    return StatsResponse(
        weeklyHours=round(weekly_hours, 1),
        activeEmployees=active_employees,
        totalEmployees=total_employees,
        overtimeHours=round(overtime_hours, 1),
        topEmployees=top_employees,
        dailyBreakdown=daily_breakdown
    )

# Include the router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    logger.info("TimeTracker API starting up...")
    await get_or_create_settings()
    logger.info("TimeTracker API started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("TimeTracker API shutting down...")
    client.close()
    logger.info("TimeTracker API shutdown complete")