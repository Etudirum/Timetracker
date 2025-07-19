#!/usr/bin/env python3
import requests
import json
import time
from datetime import datetime
import unittest

# Backend URL from frontend/.env
BACKEND_URL = "https://fc9b4691-5a3f-41b1-9303-be9b01ae2301.preview.emergentagent.com/api"

class TimeTrackerAPITest(unittest.TestCase):
    """Test suite for TimeTracker24 API"""
    
    def setUp(self):
        """Setup for tests - create test data"""
        self.employee_ids = []
        self.time_entry_ids = []
        
        # Test data for employee creation
        self.test_employees = [
            {
                "name": "Jean Dupont",
                "position": "Développeur Senior",
                "email": "jean.dupont@example.com",
                "hourlyRate": 25.50
            },
            {
                "name": "Marie Lambert",
                "position": "Designer UX",
                "email": "marie.lambert@example.com",
                "hourlyRate": 22.75,
                "startTime": "09:00",
                "endTime": "18:00"
            },
            {
                "name": "Thomas Bernard",
                "position": "Chef de Projet",
                "email": "thomas.bernard@example.com",
                "hourlyRate": 30.00,
                "breakDuration": 45
            }
        ]
        
        # Admin credentials
        self.admin_password = "admin123"
        
        # Settings update data
        self.settings_update = {
            "companyName": "TimeTracker24 Test",
            "currency": "USD",
            "breakDuration": 45,
            "workingHours": {"start": "09:00", "end": "18:00"}
        }
        
        print("\n=== Starting TimeTracker24 API Tests ===")
    
    def tearDown(self):
        """Clean up after tests"""
        # Delete created employees
        for employee_id in self.employee_ids:
            try:
                requests.delete(f"{BACKEND_URL}/employees/{employee_id}")
            except:
                pass
        
        # Reset settings
        try:
            requests.put(
                f"{BACKEND_URL}/settings",
                json={
                    "companyName": "TimeTracker24",
                    "currency": "EUR",
                    "breakDuration": 30,
                    "workingHours": {"start": "08:00", "end": "17:00"}
                }
            )
        except:
            pass
        
        print("\n=== Completed TimeTracker24 API Tests ===")
    
    def test_01_health_check(self):
        """Test health check endpoint"""
        print("\n--- Testing Health Check ---")
        response = requests.get(f"{BACKEND_URL}/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        print("✅ Health check successful")
    
    def test_02_admin_authentication(self):
        """Test admin authentication"""
        print("\n--- Testing Admin Authentication ---")
        
        # Test with correct password
        response = requests.post(
            f"{BACKEND_URL}/auth/admin",
            json={"password": self.admin_password}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["authenticated"])
        print("✅ Admin authentication successful with correct password")
        
        # Test with incorrect password
        response = requests.post(
            f"{BACKEND_URL}/auth/admin",
            json={"password": "wrong_password"}
        )
        self.assertEqual(response.status_code, 401)
        print("✅ Admin authentication rejected with incorrect password")
    
    def test_03_settings_management(self):
        """Test settings management"""
        print("\n--- Testing Settings Management ---")
        
        # Get current settings
        response = requests.get(f"{BACKEND_URL}/settings")
        self.assertEqual(response.status_code, 200)
        initial_settings = response.json()
        print(f"Initial settings: {json.dumps(initial_settings, indent=2)}")
        
        # Update settings
        response = requests.put(
            f"{BACKEND_URL}/settings",
            json=self.settings_update
        )
        self.assertEqual(response.status_code, 200)
        print("✅ Settings updated successfully")
        
        # Verify updated settings
        response = requests.get(f"{BACKEND_URL}/settings")
        self.assertEqual(response.status_code, 200)
        updated_settings = response.json()
        
        self.assertEqual(updated_settings["companyName"], self.settings_update["companyName"])
        self.assertEqual(updated_settings["currency"], self.settings_update["currency"])
        self.assertEqual(updated_settings["breakDuration"], self.settings_update["breakDuration"])
        self.assertEqual(updated_settings["workingHours"], self.settings_update["workingHours"])
        print("✅ Settings verification successful")
        
        # Reset settings for other tests
        requests.put(
            f"{BACKEND_URL}/settings",
            json={
                "companyName": "TimeTracker24",
                "currency": "EUR",
                "breakDuration": 30,
                "workingHours": {"start": "08:00", "end": "17:00"}
            }
        )
    
    def test_04_employee_management(self):
        """Test employee management"""
        print("\n--- Testing Employee Management ---")
        
        # Get initial employees
        response = requests.get(f"{BACKEND_URL}/employees")
        self.assertEqual(response.status_code, 200)
        initial_employees = response.json()
        print(f"Initial employee count: {len(initial_employees)}")
        
        # Create test employees
        for employee_data in self.test_employees:
            response = requests.post(
                f"{BACKEND_URL}/employees",
                json=employee_data
            )
            self.assertEqual(response.status_code, 200)
            employee = response.json()
            self.employee_ids.append(employee["id"])
            print(f"✅ Created employee: {employee['name']} (ID: {employee['id']})")
        
        # Get all employees and verify count
        response = requests.get(f"{BACKEND_URL}/employees")
        self.assertEqual(response.status_code, 200)
        all_employees = response.json()
        self.assertGreaterEqual(len(all_employees), len(initial_employees) + len(self.test_employees))
        print(f"✅ Employee count verification successful: {len(all_employees)} employees")
        
        # Get specific employee
        employee_id = self.employee_ids[0]
        response = requests.get(f"{BACKEND_URL}/employees/{employee_id}")
        self.assertEqual(response.status_code, 200)
        employee = response.json()
        self.assertEqual(employee["id"], employee_id)
        print(f"✅ Retrieved employee: {employee['name']}")
        
        # Update employee
        update_data = {
            "position": "Senior Developer",
            "hourlyRate": 28.50
        }
        response = requests.put(
            f"{BACKEND_URL}/employees/{employee_id}",
            json=update_data
        )
        self.assertEqual(response.status_code, 200)
        updated_employee = response.json()
        self.assertEqual(updated_employee["position"], update_data["position"])
        self.assertEqual(updated_employee["hourlyRate"], update_data["hourlyRate"])
        print(f"✅ Updated employee: {updated_employee['name']} - {updated_employee['position']}")
        
        # Delete employee
        employee_id_to_delete = self.employee_ids.pop()
        response = requests.delete(f"{BACKEND_URL}/employees/{employee_id_to_delete}")
        self.assertEqual(response.status_code, 200)
        print(f"✅ Deleted employee with ID: {employee_id_to_delete}")
        
        # Verify deletion (employee should be marked as inactive)
        response = requests.get(f"{BACKEND_URL}/employees/{employee_id_to_delete}")
        self.assertEqual(response.status_code, 404)
        print("✅ Employee deletion verification successful")
    
    def test_05_time_tracking_workflow(self):
        """Test complete time tracking workflow"""
        print("\n--- Testing Time Tracking Workflow ---")
        
        if not self.employee_ids:
            # Create a test employee if none exists
            response = requests.post(
                f"{BACKEND_URL}/employees",
                json=self.test_employees[0]
            )
            self.assertEqual(response.status_code, 200)
            employee = response.json()
            self.employee_ids.append(employee["id"])
            print(f"Created test employee: {employee['name']} (ID: {employee['id']})")
        
        employee_id = self.employee_ids[0]
        
        # 1. Clock in
        print(f"Testing clock-in for employee ID: {employee_id}")
        response = requests.post(f"{BACKEND_URL}/clock-in/{employee_id}")
        self.assertEqual(response.status_code, 200)
        time_entry = response.json()
        self.assertEqual(time_entry["employeeId"], employee_id)
        self.assertEqual(time_entry["status"], "active")
        print(f"✅ Clock-in successful at {time_entry['startTime']}")
        
        # Store time entry ID
        time_entry_id = time_entry["id"]
        self.time_entry_ids.append(time_entry_id)
        
        # 2. Start break
        time.sleep(1)  # Small delay to ensure time difference
        print(f"Testing start-break for employee ID: {employee_id}")
        response = requests.post(f"{BACKEND_URL}/start-break/{employee_id}")
        self.assertEqual(response.status_code, 200)
        time_entry = response.json()
        self.assertEqual(time_entry["status"], "on_break")
        self.assertGreaterEqual(len(time_entry["breaks"]), 1)
        self.assertIsNotNone(time_entry["breaks"][-1]["startTime"])
        self.assertIsNone(time_entry["breaks"][-1]["endTime"])
        print(f"✅ Break started at {time_entry['breaks'][-1]['startTime']}")
        
        # 3. End break
        time.sleep(1)  # Small delay to ensure time difference
        print(f"Testing end-break for employee ID: {employee_id}")
        response = requests.post(f"{BACKEND_URL}/end-break/{employee_id}")
        self.assertEqual(response.status_code, 200)
        time_entry = response.json()
        self.assertEqual(time_entry["status"], "active")
        self.assertIsNotNone(time_entry["breaks"][-1]["endTime"])
        print(f"✅ Break ended at {time_entry['breaks'][-1]['endTime']}")
        
        # 4. Clock out
        time.sleep(1)  # Small delay to ensure time difference
        print(f"Testing clock-out for employee ID: {employee_id}")
        response = requests.post(f"{BACKEND_URL}/clock-out/{employee_id}")
        self.assertEqual(response.status_code, 200)
        time_entry = response.json()
        self.assertEqual(time_entry["status"], "completed")
        self.assertIsNotNone(time_entry["endTime"])
        print(f"✅ Clock-out successful at {time_entry['endTime']}")
        
        # 5. Verify time entry
        response = requests.get(f"{BACKEND_URL}/time-entries?employee_id={employee_id}")
        self.assertEqual(response.status_code, 200)
        time_entries = response.json()
        self.assertGreaterEqual(len(time_entries), 1)
        
        # Find our time entry
        found = False
        for entry in time_entries:
            if entry["id"] == time_entry_id:
                found = True
                self.assertEqual(entry["status"], "completed")
                self.assertIsNotNone(entry["endTime"])
                self.assertGreaterEqual(len(entry["breaks"]), 1)
                break
        
        self.assertTrue(found, "Time entry not found in time entries list")
        print("✅ Time entry verification successful")
    
    def test_06_prevent_multiple_active_entries(self):
        """Test prevention of multiple active time entries"""
        print("\n--- Testing Prevention of Multiple Active Entries ---")
        
        if not self.employee_ids:
            # Create a test employee if none exists
            response = requests.post(
                f"{BACKEND_URL}/employees",
                json=self.test_employees[0]
            )
            self.assertEqual(response.status_code, 200)
            employee = response.json()
            self.employee_ids.append(employee["id"])
            print(f"Created test employee: {employee['name']} (ID: {employee['id']})")
        
        employee_id = self.employee_ids[0]
        
        # First clock-in should succeed
        response = requests.post(f"{BACKEND_URL}/clock-in/{employee_id}")
        self.assertEqual(response.status_code, 200)
        time_entry = response.json()
        self.time_entry_ids.append(time_entry["id"])
        print("✅ First clock-in successful")
        
        # Second clock-in should fail
        response = requests.post(f"{BACKEND_URL}/clock-in/{employee_id}")
        self.assertEqual(response.status_code, 400)
        print("✅ Second clock-in correctly rejected")
        
        # Clean up - clock out
        requests.post(f"{BACKEND_URL}/clock-out/{employee_id}")
    
    def test_07_time_entries_filtering(self):
        """Test time entries filtering"""
        print("\n--- Testing Time Entries Filtering ---")
        
        if not self.employee_ids:
            # Create a test employee if none exists
            response = requests.post(
                f"{BACKEND_URL}/employees",
                json=self.test_employees[0]
            )
            self.assertEqual(response.status_code, 200)
            employee = response.json()
            self.employee_ids.append(employee["id"])
            print(f"Created test employee: {employee['name']} (ID: {employee['id']})")
        
        employee_id = self.employee_ids[0]
        
        # Create a time entry
        response = requests.post(f"{BACKEND_URL}/clock-in/{employee_id}")
        self.assertEqual(response.status_code, 200)
        time_entry = response.json()
        self.time_entry_ids.append(time_entry["id"])
        
        # Clock out to complete the entry
        time.sleep(1)
        response = requests.post(f"{BACKEND_URL}/clock-out/{employee_id}")
        self.assertEqual(response.status_code, 200)
        
        # Test filtering by employee ID
        response = requests.get(f"{BACKEND_URL}/time-entries?employee_id={employee_id}")
        self.assertEqual(response.status_code, 200)
        entries = response.json()
        self.assertGreaterEqual(len(entries), 1)
        for entry in entries:
            self.assertEqual(entry["employeeId"], employee_id)
        print(f"✅ Filter by employee ID successful: {len(entries)} entries found")
        
        # Test filtering by status
        response = requests.get(f"{BACKEND_URL}/time-entries?status=completed")
        self.assertEqual(response.status_code, 200)
        entries = response.json()
        self.assertGreaterEqual(len(entries), 1)
        for entry in entries:
            self.assertEqual(entry["status"], "completed")
        print(f"✅ Filter by status successful: {len(entries)} completed entries found")
        
        # Test filtering by date range
        today = datetime.utcnow().date().isoformat()
        response = requests.get(f"{BACKEND_URL}/time-entries?start_date={today}")
        self.assertEqual(response.status_code, 200)
        entries = response.json()
        self.assertGreaterEqual(len(entries), 1)
        print(f"✅ Filter by date range successful: {len(entries)} entries found")
    
    def test_08_statistics(self):
        """Test statistics endpoint"""
        print("\n--- Testing Statistics ---")
        
        # Create some time entries for statistics if needed
        if not self.employee_ids:
            # Create test employees
            for employee_data in self.test_employees:
                response = requests.post(
                    f"{BACKEND_URL}/employees",
                    json=employee_data
                )
                self.assertEqual(response.status_code, 200)
                employee = response.json()
                self.employee_ids.append(employee["id"])
            
            # Create time entries for each employee
            for employee_id in self.employee_ids:
                # Clock in
                response = requests.post(f"{BACKEND_URL}/clock-in/{employee_id}")
                self.assertEqual(response.status_code, 200)
                time_entry = response.json()
                self.time_entry_ids.append(time_entry["id"])
                
                # Clock out after a short time
                time.sleep(1)
                requests.post(f"{BACKEND_URL}/clock-out/{employee_id}")
        
        # Get statistics
        response = requests.get(f"{BACKEND_URL}/stats")
        self.assertEqual(response.status_code, 200)
        stats = response.json()
        
        # Verify statistics structure
        self.assertIn("weeklyHours", stats)
        self.assertIn("activeEmployees", stats)
        self.assertIn("totalEmployees", stats)
        self.assertIn("overtimeHours", stats)
        self.assertIn("topEmployees", stats)
        self.assertIn("dailyBreakdown", stats)
        
        print(f"✅ Statistics retrieved successfully")
        print(f"  - Weekly Hours: {stats['weeklyHours']}")
        print(f"  - Active Employees: {stats['activeEmployees']}")
        print(f"  - Total Employees: {stats['totalEmployees']}")
        print(f"  - Top Employees: {len(stats['topEmployees'])}")
        print(f"  - Daily Breakdown: {len(stats['dailyBreakdown'])} days")


if __name__ == "__main__":
    unittest.main(verbosity=2)