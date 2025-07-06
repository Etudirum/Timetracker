import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Shield, Eye, EyeOff, Save, UserPlus } from 'lucide-react';
import { offlineStorage } from '../services/offlineStorage';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export function AdminPanel({ onClose, employees, onEmployeeUpdate, darkMode = false }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [currentView, setCurrentView] = useState('employees');
  const [settings, setSettings] = useState({});
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    position: '',
    email: '',
    startTime: '08:00',
    endTime: '17:00',
    breakDuration: 30,
    hourlyRate: 0,
    profileImage: null
  });
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingEmployeeData, setEditingEmployeeData] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const isOnline = useNetworkStatus();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const savedSettings = await offlineStorage.getSettings();
    setSettings(savedSettings);
  };

  const handleAuth = async () => {
    const savedSettings = await offlineStorage.getSettings();
    if (password === savedSettings.adminPassword) {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Mot de passe incorrect');
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmployee.name || !newEmployee.position) {
      setError('Nom et poste sont requis');
      return;
    }

    try {
      const employeeData = {
        ...newEmployee,
        createdAt: new Date().toISOString(),
        isActive: true
      };

      if (isOnline) {
        await addDoc(collection(db, 'employees'), employeeData);
      } else {
        await offlineStorage.saveEmployee(employeeData);
      }

      setNewEmployee({
        name: '',
        position: '',
        email: '',
        startTime: '08:00',
        endTime: '17:00',
        breakDuration: 30,
        hourlyRate: 0
      });
      setSuccess('Employé ajouté avec succès');
      onEmployeeUpdate();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'employé:', error);
      setError('Erreur lors de l\'ajout de l\'employé');
    }
  };

  const handleUpdateEmployee = async (employeeId, updates) => {
    try {
      if (isOnline && !employeeId.startsWith('offline_')) {
        await updateDoc(doc(db, 'employees', employeeId), updates);
      } else {
        await offlineStorage.updateEmployee(employeeId, updates);
      }

      setEditingEmployee(null);
      setEditingEmployeeData({});
      setSuccess('Employé mis à jour avec succès');
      onEmployeeUpdate();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'employé:', error);
      setError('Erreur lors de la mise à jour de l\'employé');
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet employé ?')) {
      return;
    }

    try {
      if (isOnline && !employeeId.startsWith('offline_')) {
        await deleteDoc(doc(db, 'employees', employeeId));
      } else {
        await offlineStorage.deleteEmployee(employeeId);
      }

      setSuccess('Employé supprimé avec succès');
      onEmployeeUpdate();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'employé:', error);
      setError('Erreur lors de la suppression de l\'employé');
    }
  };

  const handleImageUpload = (e, isEdit = false) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        if (isEdit) {
          setEditingEmployeeData({...editingEmployeeData, profileImage: base64});
        } else {
          setNewEmployee({...newEmployee, profileImage: base64});
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };
    try {
      await offlineStorage.saveSettings(settings);
      setSuccess('Paramètres mis à jour avec succès');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Erreur lors de la mise à jour des paramètres:', error);
      setError('Erreur lors de la mise à jour des paramètres');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="modal-overlay">
        <div className={`modal-content transition-colors duration-300 ${darkMode ? 'dark' : ''}`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Shield className="w-6 h-6 text-purple-600" />
              <h2 className={`text-xl font-semibold transition-colors duration-300 ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>Accès Admin</h2>
            </div>
            <button onClick={onClose} className={`transition-colors duration-300 ${
              darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className={`form-label transition-colors duration-300 ${
                darkMode ? 'text-gray-300' : ''
              }`}>Mot de passe administrateur</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`form-input pr-10 transition-colors duration-300 ${
                    darkMode ? 'dark' : ''
                  }`}
                  placeholder="Entrez le mot de passe"
                  onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute inset-y-0 right-0 px-3 flex items-center transition-colors duration-300 ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="error p-3 rounded-lg border">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button onClick={onClose} className="btn btn-secondary">
                Annuler
              </button>
              <button onClick={handleAuth} className="btn btn-primary">
                Accéder
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Shield className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">Panneau d'Administration</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setCurrentView('employees')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                currentView === 'employees'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Employés
            </button>
            <button
              onClick={() => setCurrentView('settings')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                currentView === 'settings'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Paramètres
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {success && (
            <div className="success p-3 rounded-lg border mb-4">
              {success}
            </div>
          )}

          {error && (
            <div className="error p-3 rounded-lg border mb-4">
              {error}
            </div>
          )}

          {currentView === 'employees' && (
            <div className="space-y-6">
              {/* Add Employee */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
                  <UserPlus className="w-5 h-5" />
                  <span>Ajouter un employé</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Nom</label>
                    <input
                      type="text"
                      value={newEmployee.name}
                      onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                      className="form-input"
                      placeholder="Nom complet"
                    />
                  </div>
                  <div>
                    <label className="form-label">Poste</label>
                    <input
                      type="text"
                      value={newEmployee.position}
                      onChange={(e) => setNewEmployee({...newEmployee, position: e.target.value})}
                      className="form-input"
                      placeholder="Poste occupé"
                    />
                  </div>
                  <div>
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      value={newEmployee.email}
                      onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                      className="form-input"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="form-label">Taux horaire (FCFA)</label>
                    <input
                      type="number"
                      value={newEmployee.hourlyRate}
                      onChange={(e) => setNewEmployee({...newEmployee, hourlyRate: parseFloat(e.target.value)})}
                      className="form-input"
                      placeholder="1500"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="form-label">Heure de début</label>
                    <input
                      type="time"
                      value={newEmployee.startTime}
                      onChange={(e) => setNewEmployee({...newEmployee, startTime: e.target.value})}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Heure de fin</label>
                    <input
                      type="time"
                      value={newEmployee.endTime}
                      onChange={(e) => setNewEmployee({...newEmployee, endTime: e.target.value})}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Durée de pause (minutes)</label>
                    <input
                      type="number"
                      value={newEmployee.breakDuration}
                      onChange={(e) => setNewEmployee({...newEmployee, breakDuration: parseInt(e.target.value)})}
                      className="form-input"
                      placeholder="30"
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button onClick={handleAddEmployee} className="btn btn-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter
                  </button>
                </div>
              </div>

              {/* Employee List */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Liste des employés</h3>
                <div className="space-y-3">
                  {employees.map(employee => (
                    <div key={employee.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      {editingEmployee === employee.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div>
                              <label className="form-label">Nom</label>
                              <input
                                type="text"
                                value={editingEmployeeData.name || employee.name}
                                onChange={(e) => setEditingEmployeeData({...editingEmployeeData, name: e.target.value})}
                                className="form-input"
                                placeholder="Nom"
                              />
                            </div>
                            <div>
                              <label className="form-label">Poste</label>
                              <input
                                type="text"
                                value={editingEmployeeData.position || employee.position}
                                onChange={(e) => setEditingEmployeeData({...editingEmployeeData, position: e.target.value})}
                                className="form-input"
                                placeholder="Poste"
                              />
                            </div>
                            <div>
                              <label className="form-label">Email</label>
                              <input
                                type="email"
                                value={editingEmployeeData.email || employee.email || ''}
                                onChange={(e) => setEditingEmployeeData({...editingEmployeeData, email: e.target.value})}
                                className="form-input"
                                placeholder="Email"
                              />
                            </div>
                            <div>
                              <label className="form-label">Taux horaire (FCFA)</label>
                              <input
                                type="number"
                                value={editingEmployeeData.hourlyRate !== undefined ? editingEmployeeData.hourlyRate : (employee.hourlyRate || 0)}
                                onChange={(e) => setEditingEmployeeData({...editingEmployeeData, hourlyRate: parseFloat(e.target.value)})}
                                className="form-input"
                                placeholder="Taux horaire"
                                step="0.01"
                              />
                            </div>
                            <div>
                              <label className="form-label">Heure de début</label>
                              <input
                                type="time"
                                value={editingEmployeeData.startTime || employee.startTime || '08:00'}
                                onChange={(e) => setEditingEmployeeData({...editingEmployeeData, startTime: e.target.value})}
                                className="form-input"
                              />
                            </div>
                            <div>
                              <label className="form-label">Heure de fin</label>
                              <input
                                type="time"
                                value={editingEmployeeData.endTime || employee.endTime || '17:00'}
                                onChange={(e) => setEditingEmployeeData({...editingEmployeeData, endTime: e.target.value})}
                                className="form-input"
                              />
                            </div>
                            <div>
                              <label className="form-label">Durée pause max (min)</label>
                              <input
                                type="number"
                                value={editingEmployeeData.breakDuration !== undefined ? editingEmployeeData.breakDuration : (employee.breakDuration || 30)}
                                onChange={(e) => setEditingEmployeeData({...editingEmployeeData, breakDuration: parseInt(e.target.value)})}
                                className="form-input"
                                placeholder="30"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => {
                                setEditingEmployee(null);
                                setEditingEmployeeData({});
                              }}
                              className="btn btn-secondary"
                            >
                              Annuler
                            </button>
                            <button
                              onClick={() => handleUpdateEmployee(employee.id, {
                                name: editingEmployeeData.name || employee.name,
                                position: editingEmployeeData.position || employee.position,
                                email: editingEmployeeData.email || employee.email,
                                startTime: editingEmployeeData.startTime || employee.startTime,
                                endTime: editingEmployeeData.endTime || employee.endTime,
                                breakDuration: editingEmployeeData.breakDuration !== undefined ? editingEmployeeData.breakDuration : employee.breakDuration,
                                hourlyRate: editingEmployeeData.hourlyRate !== undefined ? editingEmployeeData.hourlyRate : employee.hourlyRate
                              })}
                              className="btn btn-primary"
                            >
                              <Save className="w-4 h-4 mr-2" />
                              Sauvegarder
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{employee.name}</h4>
                            <p className="text-sm text-gray-500">{employee.position}</p>
                            <p className="text-sm text-gray-500">
                              {employee.startTime} - {employee.endTime}
                              {employee.hourlyRate > 0 && ` • ${employee.hourlyRate} FCFA/h`}
                              {employee.breakDuration && ` • Pause max: ${employee.breakDuration}min`}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setEditingEmployee(employee.id);
                                setEditingEmployeeData({});
                              }}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(employee.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentView === 'settings' && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Paramètres généraux</h3>
                <div className="space-y-4">
                  <div>
                    <label className="form-label">Mot de passe administrateur</label>
                    <input
                      type="password"
                      value={settings.adminPassword || ''}
                      onChange={(e) => setSettings({...settings, adminPassword: e.target.value})}
                      className="form-input"
                      placeholder="Nouveau mot de passe"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Heure de début par défaut</label>
                      <input
                        type="time"
                        value={settings.workingHours?.start || '08:00'}
                        onChange={(e) => setSettings({
                          ...settings,
                          workingHours: {
                            ...settings.workingHours,
                            start: e.target.value
                          }
                        })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Heure de fin par défaut</label>
                      <input
                        type="time"
                        value={settings.workingHours?.end || '17:00'}
                        onChange={(e) => setSettings({
                          ...settings,
                          workingHours: {
                            ...settings.workingHours,
                            end: e.target.value
                          }
                        })}
                        className="form-input"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Durée de pause par défaut (minutes)</label>
                    <input
                      type="number"
                      value={settings.breakDuration || 30}
                      onChange={(e) => setSettings({...settings, breakDuration: parseInt(e.target.value)})}
                      className="form-input"
                      placeholder="30"
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button onClick={handleUpdateSettings} className="btn btn-primary">
                    <Save className="w-4 h-4 mr-2" />
                    Sauvegarder
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}