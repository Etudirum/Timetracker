import localforage from 'localforage';

class OfflineStorageService {
  constructor() {
    this.store = localforage.createInstance({
      name: 'timeTrackingApp',
      storeName: 'offlineData'
    });
  }

  async saveTimeEntry(entry) {
    const offlineEntries = await this.getOfflineEntries();
    const entryWithId = {
      ...entry,
      id: entry.id || `offline_${Date.now()}`,
      isOffline: true,
      timestamp: new Date().toISOString()
    };
    
    offlineEntries.push(entryWithId);
    await this.store.setItem('timeEntries', offlineEntries);
    return entryWithId;
  }

  async getOfflineEntries() {
    return (await this.store.getItem('timeEntries')) || [];
  }

  async updateTimeEntry(entryId, updates) {
    const offlineEntries = await this.getOfflineEntries();
    const updatedEntries = offlineEntries.map(entry => 
      entry.id === entryId ? { ...entry, ...updates } : entry
    );
    await this.store.setItem('timeEntries', updatedEntries);
    return updates;
  }

  async clearOfflineEntries() {
    await this.store.setItem('timeEntries', []);
  }

  async saveEmployee(employee) {
    const offlineEmployees = await this.getOfflineEmployees();
    const employeeWithId = {
      ...employee,
      id: employee.id || `offline_emp_${Date.now()}`,
      isOffline: true,
      timestamp: new Date().toISOString()
    };
    
    offlineEmployees.push(employeeWithId);
    await this.store.setItem('employees', offlineEmployees);
    return employeeWithId;
  }

  async getOfflineEmployees() {
    return (await this.store.getItem('employees')) || [];
  }

  async updateEmployee(employeeId, updates) {
    const offlineEmployees = await this.getOfflineEmployees();
    const updatedEmployees = offlineEmployees.map(emp => 
      emp.id === employeeId ? { ...emp, ...updates } : emp
    );
    await this.store.setItem('employees', updatedEmployees);
    return updates;
  }

  async deleteEmployee(employeeId) {
    const offlineEmployees = await this.getOfflineEmployees();
    const filteredEmployees = offlineEmployees.filter(emp => emp.id !== employeeId);
    await this.store.setItem('employees', filteredEmployees);
  }

  async clearOfflineEmployees() {
    await this.store.setItem('employees', []);
  }

  async getSettings() {
    return (await this.store.getItem('settings')) || {
      adminPassword: 'admin123',
      workingHours: {
        start: '08:00',
        end: '17:00'
      },
      breakDuration: 30
    };
  }

  async saveSettings(settings) {
    await this.store.setItem('settings', settings);
  }

  async deleteEmployee(employeeId) {
    const offlineEmployees = await this.getOfflineEmployees();
    const updatedEmployees = offlineEmployees.filter(emp => emp.id !== employeeId);
    await this.store.setItem('employees', updatedEmployees);
  }

  async deleteEmployeeAndActivities(employeeId) {
    // Supprimer l'employé
    await this.deleteEmployee(employeeId);
    
    // Supprimer toutes ses activités
    const offlineEntries = await this.getOfflineEntries();
    const updatedEntries = offlineEntries.filter(entry => entry.employeeId !== employeeId);
    await this.store.setItem('timeEntries', updatedEntries);
  }

  async getSyncQueue() {
    return (await this.store.getItem('syncQueue')) || [];
  }

  async addToSyncQueue(operation, collection, docId, data) {
    const queue = await this.getSyncQueue();
    queue.push({
      operation,
      collection,
      docId,
      data,
      timestamp: new Date().toISOString()
    });
    await this.store.setItem('syncQueue', queue);
  }

  async clearSyncQueue() {
    await this.store.setItem('syncQueue', []);
  }
}

export const offlineStorage = new OfflineStorageService();