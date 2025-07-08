import React, { useState, useEffect } from "react";
import "./App.css";
import { Clock, Users, BarChart3, Settings, Shield, CheckCircle, XCircle, Play, Pause, Coffee, Calendar, Download, FileText, Users2, Clock4, X as CloseIcon } from "lucide-react";
import { db } from "./firebase";
import { collection, addDoc, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc, getDocs } from "firebase/firestore";
import { offlineStorage } from "./services/offlineStorage";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { SyncManager } from "./components/SyncManager";
import { AdminPanel } from "./components/AdminPanel";
import { EmployeeStats } from "./components/EmployeeStats";
import { ExportManager } from "./components/ExportManager";
import { NFCManager } from "./components/NFCManager";
import { WelcomePopup } from "./components/WelcomePopup";

// Hook pour détecter si on est dans Electron
const useElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI;
};

function App() {
  const [currentView, setCurrentView] = useState('pointage');
  const [employees, setEmployees] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showEmployeeStats, setShowEmployeeStats] = useState(false);
  const [selectedStatsEmployee, setSelectedStatsEmployee] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [showStatsAuth, setShowStatsAuth] = useState(false);
  const [showEditAuth, setShowEditAuth] = useState(false);
  const [statsPassword, setStatsPassword] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [isStatsAuthenticated, setIsStatsAuthenticated] = useState(false);
  const [isEditAuthenticated, setIsEditAuthenticated] = useState(false);
  const [pendingEditEntry, setPendingEditEntry] = useState(null);
  const [stats, setStats] = useState({
    weeklyHours: 0,
    activeEmployees: 0,
    totalEmployees: 0,
    overtimeHours: 0
  });
  const [filter, setFilter] = useState({
    employee: 'all',
    period: 'week',
    startDate: '',
    endDate: ''
  });
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [welcomeData, setWelcomeData] = useState(null);
  const [nfcStatus, setNfcStatus] = useState({ available: false, scanning: false });

  const isElectron = useElectron();
  const isOnline = useNetworkStatus();

  // Initialisation du thème persistant
  useEffect(() => {
    const initializeTheme = async () => {
      if (isElectron) {
        // Mode Electron - utiliser le store d'Electron
        const savedTheme = await window.electronAPI.getTheme();
        setDarkMode(savedTheme);
        
        // Écouter les changements de thème
        window.electronAPI.onThemeChanged((event, isDark) => {
          setDarkMode(isDark);
        });
      } else {
        // Mode web - utiliser localStorage
        const savedTheme = localStorage.getItem('timetracker-theme');
        if (savedTheme) {
          setDarkMode(savedTheme === 'dark');
        } else {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          setDarkMode(prefersDark);
        }
      }
    };
    
    initializeTheme();
  }, [isElectron]);

  // Gestion des événements NFC (mode Electron)
  useEffect(() => {
    if (isElectron) {
      // Gestionnaire pour les tags NFC détectés
      const handleNFCTag = async (event) => {
        const { detail } = event;
        const { tagData, resolve } = detail;
        
        try {
          const result = await processNFCTag(tagData);
          resolve(result);
        } catch (error) {
          console.error('Erreur traitement NFC:', error);
          resolve({ success: false, error: error.message });
        }
      };

      // Gestionnaire pour les popups de bienvenue
      const handleWelcomePopup = (event, data) => {
        setWelcomeData(data);
        setShowWelcomePopup(true);
        
        // Auto-fermeture après 4 secondes
        setTimeout(() => {
          setShowWelcomePopup(false);
        }, 4000);
      };

      // Gestionnaire pour le statut NFC
      const handleNFCStatus = (event, status) => {
        setNfcStatus(status);
      };

      // Écouter les événements
      window.addEventListener('nfc-tag-detected', handleNFCTag);
      window.electronAPI.onShowWelcomePopup(handleWelcomePopup);
      window.electronAPI.onNFCStatus(handleNFCStatus);

      // Cleanup
      return () => {
        window.removeEventListener('nfc-tag-detected', handleNFCTag);
        window.electronAPI.removeAllListeners('show-welcome-popup');
        window.electronAPI.removeAllListeners('nfc-status');
      };
    }
  }, [isElectron, employees]);

  // Charger les employés et les pointages
  useEffect(() => {
    loadEmployees();
    loadTimeEntries();
  }, []);

  // Fonction pour traiter les tags NFC
  const processNFCTag = async (tagData) => {
    const { uid } = tagData;
    
    // Chercher l'employé correspondant au tag
    const employee = employees.find(emp => emp.nfcTag === uid);
    
    if (!employee) {
      return { 
        success: false, 
        error: 'Tag non reconnu', 
        tagUid: uid 
      };
    }

    // Déterminer l'action (arrivée ou départ)
    const currentEntry = timeEntries.find(entry => 
      entry.employeeId === employee.id && !entry.endTime
    );

    const action = currentEntry ? 'clock-out' : 'clock-in';

    // Effectuer le pointage
    try {
      if (action === 'clock-in') {
        await handleClockIn(employee.id);
      } else {
        await handleClockOut(employee.id);
      }

      return {
        success: true,
        employee: {
          ...employee,
          lastName: employee.name.split(' ').pop(),
          gender: employee.gender || 'M' // Par défaut masculin
        },
        action,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        employee,
        action
      };
    }
  };

  // Fonction pour basculer le mode sombre
  const toggleDarkMode = async () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    
    if (isElectron) {
      // Sauvegarder dans le store d'Electron
      await window.electronAPI.setTheme(newMode);
    } else {
      // Sauvegarder dans localStorage
      localStorage.setItem('timetracker-theme', newMode ? 'dark' : 'light');
    }
    
    // Appliquer au DOM
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const loadEmployees = async () => {
    try {
      if (isOnline) {
        const q = query(collection(db, 'employees'), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const employeeData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setEmployees(employeeData);
        });
        return unsubscribe;
      } else {
        const offlineEmployees = await offlineStorage.getOfflineEmployees();
        setEmployees(offlineEmployees);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des employés:', error);
      const offlineEmployees = await offlineStorage.getOfflineEmployees();
      setEmployees(offlineEmployees);
    }
  };

  const loadTimeEntries = async () => {
    try {
      if (isOnline) {
        const q = query(collection(db, 'timeEntries'), orderBy('startTime', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const entries = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setTimeEntries(entries);
        });
        return unsubscribe;
      } else {
        const offlineEntries = await offlineStorage.getOfflineEntries();
        setTimeEntries(offlineEntries);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des pointages:', error);
      const offlineEntries = await offlineStorage.getOfflineEntries();
      setTimeEntries(offlineEntries);
    }
  };

  const calculateStats = () => {
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    
    // Calculer les heures de la semaine
    const weeklyEntries = timeEntries.filter(entry => {
      const entryDate = new Date(entry.startTime);
      return entryDate >= weekStart && entry.endTime;
    });
    
    const weeklyHours = weeklyEntries.reduce((total, entry) => {
      const duration = (new Date(entry.endTime) - new Date(entry.startTime)) / (1000 * 60 * 60);
      return total + duration;
    }, 0);

    // Employés actifs (pointés aujourd'hui)
    const today = new Date().toDateString();
    const activeEmployees = new Set(
      timeEntries
        .filter(entry => new Date(entry.startTime).toDateString() === today && !entry.endTime)
        .map(entry => entry.employeeId)
    ).size;

    // Heures supplémentaires (plus de 40h/semaine)
    const overtimeHours = Math.max(0, weeklyHours - 40);

    setStats({
      weeklyHours: Math.round(weeklyHours * 10) / 10,
      activeEmployees,
      totalEmployees: employees.length,
      overtimeHours: Math.round(overtimeHours * 10) / 10
    });
  };

  const handleClockIn = async (employeeId) => {
    try {
      const entry = {
        employeeId,
        startTime: new Date().toISOString(),
        endTime: null,
        status: 'active',
        breaks: [],
        notes: ''
      };

      if (isOnline) {
        await addDoc(collection(db, 'timeEntries'), entry);
      } else {
        await offlineStorage.saveTimeEntry(entry);
      }
    } catch (error) {
      console.error('Erreur lors du pointage d\'arrivée:', error);
    }
  };

  const handleClockOut = async (employeeId) => {
    try {
      const activeEntry = timeEntries.find(entry => 
        entry.employeeId === employeeId && !entry.endTime
      );

      if (activeEntry) {
        const endTime = new Date().toISOString();
        
        if (isOnline && !activeEntry.id.startsWith('offline_')) {
          await updateDoc(doc(db, 'timeEntries', activeEntry.id), {
            endTime,
            status: 'completed'
          });
        } else {
          await offlineStorage.updateTimeEntry(activeEntry.id, {
            endTime,
            status: 'completed'
          });
        }
      }
    } catch (error) {
      console.error('Erreur lors du pointage de départ:', error);
    }
  };

  const handleStartBreak = async (employeeId) => {
    try {
      const activeEntry = timeEntries.find(entry => 
        entry.employeeId === employeeId && !entry.endTime
      );

      if (activeEntry) {
        const breakStart = new Date().toISOString();
        const updatedBreaks = [...(activeEntry.breaks || []), {
          startTime: breakStart,
          endTime: null
        }];

        if (isOnline && !activeEntry.id.startsWith('offline_')) {
          await updateDoc(doc(db, 'timeEntries', activeEntry.id), {
            breaks: updatedBreaks,
            status: 'on_break'
          });
        } else {
          await offlineStorage.updateTimeEntry(activeEntry.id, {
            breaks: updatedBreaks,
            status: 'on_break'
          });
        }
      }
    } catch (error) {
      console.error('Erreur lors du début de pause:', error);
    }
  };

  const handleEndBreak = async (employeeId) => {
    try {
      const activeEntry = timeEntries.find(entry => 
        entry.employeeId === employeeId && !entry.endTime
      );

      if (activeEntry && activeEntry.breaks) {
        const breakEnd = new Date().toISOString();
        const updatedBreaks = activeEntry.breaks.map((breakItem, index) => {
          if (index === activeEntry.breaks.length - 1 && !breakItem.endTime) {
            return { ...breakItem, endTime: breakEnd };
          }
          return breakItem;
        });

        if (isOnline && !activeEntry.id.startsWith('offline_')) {
          await updateDoc(doc(db, 'timeEntries', activeEntry.id), {
            breaks: updatedBreaks,
            status: 'active'
          });
        } else {
          await offlineStorage.updateTimeEntry(activeEntry.id, {
            breaks: updatedBreaks,
            status: 'active'
          });
        }
      }
    } catch (error) {
      console.error('Erreur lors de la fin de pause:', error);
    }
  };

  const getEmployeeStatus = (employeeId) => {
    const activeEntry = timeEntries.find(entry => 
      entry.employeeId === employeeId && !entry.endTime
    );
    
    if (!activeEntry) return 'absent';
    if (activeEntry.status === 'on_break') return 'on_break';
    return 'active';
  };

  const getEmployeeCurrentEntry = (employeeId) => {
    return timeEntries.find(entry => 
      entry.employeeId === employeeId && !entry.endTime
    );
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR');
  };

  // Fonction pour formater la date/heure locale sans conversion timezone
  const formatDateTimeLocal = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Calcul automatique des pauses selon le critère
  const calculateAutomaticBreaks = (startTime, endTime, maxBreakDuration) => {
    if (!endTime) return 0;
    
    const totalWorkMinutes = (new Date(endTime) - new Date(startTime)) / (1000 * 60);
    const totalWorkHours = totalWorkMinutes / 60;
    
    // 15 minutes pour chaque tranche de 3 heures
    const automaticBreakMinutes = Math.floor(totalWorkHours / 3) * 15;
    
    // Ne pas dépasser la durée de pause maximale
    return Math.min(automaticBreakMinutes, maxBreakDuration || 30);
  };

  const calculateDuration = (startTime, endTime, employee = null) => {
    if (!endTime) return { hours: 0, minutes: 0, display: '0h 0min', totalHours: 0 };
    
    const totalMinutes = (new Date(endTime) - new Date(startTime)) / (1000 * 60);
    
    // Calcul automatique des pauses si employé fourni
    let breakMinutes = 0;
    if (employee) {
      breakMinutes = calculateAutomaticBreaks(startTime, endTime, employee.breakDuration || 30);
    }
    
    // Soustraire les pauses automatiques
    const workMinutes = Math.max(0, totalMinutes - breakMinutes);
    
    const hours = Math.floor(workMinutes / 60);
    const minutes = Math.round(workMinutes % 60);
    
    return { 
      hours, 
      minutes, 
      display: `${hours}h ${minutes}min`,
      totalHours: Math.round((workMinutes / 60) * 10) / 10,
      breakMinutes
    };
  };

  const handleEditAuth = () => {
    if (editPassword === 'admin123') {
      setIsEditAuthenticated(true);
      setShowEditAuth(false);
      setEditPassword('');
      // Procéder avec la modification en attente
      if (pendingEditEntry) {
        setEditingEntry(pendingEditEntry.id);
        setEditForm({
          startTime: formatDateTimeLocal(pendingEditEntry.startTime),
          endTime: pendingEditEntry.endTime ? formatDateTimeLocal(pendingEditEntry.endTime) : '',
          notes: pendingEditEntry.notes || ''
        });
        setPendingEditEntry(null);
      }
    } else {
      setError('Mot de passe incorrect pour modifier les heures');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleEditEntry = (entry) => {
    // Demander l'authentification avant de permettre la modification
    setPendingEditEntry(entry);
    setShowEditAuth(true);
    setIsEditAuthenticated(false);
  };

  const handleSaveEdit = async () => {
    try {
      const updatedData = {
        startTime: new Date(editForm.startTime).toISOString(),
        endTime: editForm.endTime ? new Date(editForm.endTime).toISOString() : null,
        notes: editForm.notes,
        status: editForm.endTime ? 'completed' : 'active'
      };

      if (isOnline && !editingEntry.startsWith('offline_')) {
        await updateDoc(doc(db, 'timeEntries', editingEntry), updatedData);
      } else {
        await offlineStorage.updateTimeEntry(editingEntry, updatedData);
      }

      setEditingEntry(null);
      setEditForm({});
      setIsEditAuthenticated(false);
      setSuccess('Pointage modifié avec succès');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
      setError('Erreur lors de la modification du pointage');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleStatsAuth = () => {
    if (statsPassword === 'admin123') {
      setIsStatsAuthenticated(true);
      setShowStatsAuth(false);
      setStatsPassword('');
      // Ouvrir le modal des statistiques après authentification réussie
      setShowEmployeeStats(true);
    } else {
      setError('Mot de passe incorrect pour accéder aux statistiques');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleStatsClick = (employee) => {
    console.log('Statistiques clicked for:', employee);
    setSelectedStatsEmployee(employee);
    // Accès direct aux statistiques sans authentification
    setIsStatsAuthenticated(true);
    setShowEmployeeStats(true);
  };

  const formatSalary = (hours, hourlyRate) => {
    if (!hourlyRate || hourlyRate <= 0) return null;
    const salary = Math.round(hours * hourlyRate);
    return `${salary.toLocaleString()} FCFA`;
  };

  const cancelEdit = () => {
    setEditingEntry(null);
    setEditForm({});
    setIsEditAuthenticated(false);
  };

  const getFilteredTimeEntries = () => {
    let filtered = timeEntries;

    if (filter.employee !== 'all') {
      filtered = filtered.filter(entry => entry.employeeId === filter.employee);
    }

    const now = new Date();
    if (filter.period === 'today') {
      const today = now.toDateString();
      filtered = filtered.filter(entry => 
        new Date(entry.startTime).toDateString() === today
      );
    } else if (filter.period === 'week') {
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      filtered = filtered.filter(entry => 
        new Date(entry.startTime) >= weekStart
      );
    } else if (filter.period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = filtered.filter(entry => 
        new Date(entry.startTime) >= monthStart
      );
    } else if (filter.period === 'custom' && filter.startDate && filter.endDate) {
      const startDate = new Date(filter.startDate);
      const endDate = new Date(filter.endDate);
      endDate.setHours(23, 59, 59, 999); // Include the entire end date
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.startTime);
        return entryDate >= startDate && entryDate <= endDate;
      });
    }

    return filtered;
  };

  const renderPointageView = () => (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className={`text-3xl font-bold mb-2 transition-colors duration-300 ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}>Pointage des Heures</h1>
        <p className={`transition-colors duration-300 ${
          darkMode ? 'text-gray-400' : 'text-gray-600'
        }`}>Système de gestion des temps de travail</p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="stats-card stats-card-total">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">Heures cette semaine</p>
              <p className="text-2xl font-bold text-white">{stats.weeklyHours}h</p>
            </div>
            <Clock className="w-8 h-8 text-white/60" />
          </div>
        </div>
        <div className="stats-card stats-card-completed">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">En service</p>
              <p className="text-2xl font-bold text-white">{stats.activeEmployees}</p>
            </div>
            <Users className="w-8 h-8 text-white/60" />
          </div>
        </div>
        <div className="stats-card stats-card-pending">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">Employés totaux</p>
              <p className="text-2xl font-bold text-white">{stats.totalEmployees}</p>
            </div>
            <Users2 className="w-8 h-8 text-white/60" />
          </div>
        </div>
        <div className="stats-card stats-card-overdue">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">Heures supplémentaires</p>
              <p className="text-2xl font-bold text-white">{stats.overtimeHours}h</p>
            </div>
            <Clock4 className="w-8 h-8 text-white/60" />
          </div>
        </div>
      </div>

      {/* Liste des employés */}
      <div className={`rounded-2xl shadow-sm border p-6 transition-colors duration-300 ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <h2 className={`text-xl font-semibold mb-6 transition-colors duration-300 ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}>Employés</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map(employee => {
            const status = getEmployeeStatus(employee.id);
            const currentEntry = getEmployeeCurrentEntry(employee.id);
            
            return (
              <div key={employee.id} className={`employee-card transition-colors duration-300 ${
                darkMode ? 'dark' : ''
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      status === 'active' ? 'bg-green-500' : 
                      status === 'on_break' ? 'bg-yellow-500' : 
                      'bg-red-500'
                    }`}></div>
                    {/* Photo de profil */}
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-purple-100 flex items-center justify-center">
                      {employee.profileImage ? (
                        <img 
                          src={employee.profileImage} 
                          alt={employee.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-purple-600 font-semibold text-sm">
                          {employee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className={`font-medium transition-colors duration-300 ${
                        darkMode ? 'text-white' : 'text-gray-900'
                      }`}>{employee.name}</h3>
                      <p className={`text-sm transition-colors duration-300 ${
                        darkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>{employee.position}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleStatsClick(employee)}
                    className={`transition-colors duration-300 ${
                      darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <BarChart3 className="w-5 h-5" />
                  </button>
                </div>
                
                {currentEntry && (
                  <div className={`mb-3 p-2 rounded-lg transition-colors duration-300 ${
                    darkMode ? 'bg-gray-700' : 'bg-gray-50'
                  }`}>
                    <p className={`text-sm transition-colors duration-300 ${
                      darkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      Arrivée: {formatTime(currentEntry.startTime)}
                    </p>
                    {status === 'on_break' && (
                      <p className="text-sm text-yellow-600">En pause</p>
                    )}
                  </div>
                )}
                
                <div className="flex flex-wrap gap-2">
                  {status === 'absent' ? (
                    <button 
                      onClick={() => handleClockIn(employee.id)}
                      className="flex items-center space-x-1 px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                    >
                      <Play className="w-4 h-4" />
                      <span>Arrivée</span>
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleClockOut(employee.id)}
                        className="flex items-center space-x-1 px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                      >
                        <Pause className="w-4 h-4" />
                        <span>Départ</span>
                      </button>
                      {status === 'on_break' ? (
                        <button 
                          onClick={() => handleEndBreak(employee.id)}
                          className="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                        >
                          <Coffee className="w-4 h-4" />
                          <span>Fin pause</span>
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleStartBreak(employee.id)}
                          className="flex items-center space-x-1 px-3 py-1 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm"
                        >
                          <Coffee className="w-4 h-4" />
                          <span>Pause</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderRegistreView = () => (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className={`text-3xl font-bold mb-2 transition-colors duration-300 ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}>Registre des Pointages</h1>
        <p className={`transition-colors duration-300 ${
          darkMode ? 'text-gray-400' : 'text-gray-600'
        }`}>Historique et gestion des temps</p>
      </div>

      {/* Filtres */}
      <div className={`rounded-2xl shadow-sm border p-6 mb-6 transition-colors duration-300 ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className={`block text-sm font-medium mb-1 transition-colors duration-300 ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>Employé</label>
            <select 
              value={filter.employee} 
              onChange={(e) => setFilter({...filter, employee: e.target.value})}
              className={`border rounded-lg px-3 py-2 transition-colors duration-300 ${
                darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'
              }`}
            >
              <option value="all">Tous les employés</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 transition-colors duration-300 ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>Période</label>
            <select 
              value={filter.period} 
              onChange={(e) => setFilter({...filter, period: e.target.value})}
              className={`border rounded-lg px-3 py-2 transition-colors duration-300 ${
                darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'
              }`}
            >
              <option value="today">Aujourd'hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
              <option value="custom">Période personnalisée</option>
              <option value="all">Tout</option>
            </select>
          </div>
          {filter.period === 'custom' && (
            <>
              <div>
                <label className={`block text-sm font-medium mb-1 transition-colors duration-300 ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>Date de début</label>
                <input
                  type="date"
                  value={filter.startDate}
                  onChange={(e) => setFilter({...filter, startDate: e.target.value})}
                  className={`border rounded-lg px-3 py-2 transition-colors duration-300 ${
                    darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 transition-colors duration-300 ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>Date de fin</label>
                <input
                  type="date"
                  value={filter.endDate}
                  onChange={(e) => setFilter({...filter, endDate: e.target.value})}
                  className={`border rounded-lg px-3 py-2 transition-colors duration-300 ${
                    darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'
                  }`}
                />
              </div>
            </>
          )}
          <ExportManager timeEntries={getFilteredTimeEntries()} employees={employees} />
        </div>
      </div>

      {/* Tableau des pointages */}
      <div className={`rounded-2xl shadow-sm border overflow-hidden transition-colors duration-300 ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`transition-colors duration-300 ${
              darkMode ? 'bg-gray-700' : 'bg-gray-50'
            }`}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${
                  darkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>Employé</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${
                  darkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>Arrivée</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${
                  darkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>Départ</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${
                  darkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>Durée</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${
                  darkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>Pauses</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${
                  darkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>Date</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider transition-colors duration-300 ${
                  darkMode ? 'text-gray-300' : 'text-gray-500'
                }`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y transition-colors duration-300 ${
              darkMode ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'
            }`}>
              {getFilteredTimeEntries().map(entry => {
                const employee = employees.find(emp => emp.id === entry.employeeId);
                const duration = calculateDuration(entry.startTime, entry.endTime);
                const totalBreakTime = (entry.breaks || []).reduce((total, breakItem) => {
                  if (breakItem.endTime) {
                    return total + (new Date(breakItem.endTime) - new Date(breakItem.startTime)) / (1000 * 60);
                  }
                  return total;
                }, 0);

                return (
                  <tr key={entry.id} className={`transition-colors duration-300 ${
                    darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                  }`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          entry.endTime ? 'bg-gray-400' : 'bg-green-500'
                        }`}></div>
                        <span className={`text-sm font-medium transition-colors duration-300 ${
                          darkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {employee ? employee.name : 'Inconnu'}
                        </span>
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm transition-colors duration-300 ${
                      darkMode ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      {editingEntry === entry.id ? (
                        <input
                          type="datetime-local"
                          value={editForm.startTime}
                          onChange={(e) => setEditForm({...editForm, startTime: e.target.value})}
                          className={`border rounded px-2 py-1 text-xs transition-colors duration-300 ${
                            darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'
                          }`}
                        />
                      ) : (
                        formatTime(entry.startTime)
                      )}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm transition-colors duration-300 ${
                      darkMode ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      {editingEntry === entry.id ? (
                        <input
                          type="datetime-local"
                          value={editForm.endTime}
                          onChange={(e) => setEditForm({...editForm, endTime: e.target.value})}
                          className={`border rounded px-2 py-1 text-xs transition-colors duration-300 ${
                            darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'
                          }`}
                        />
                      ) : (
                        entry.endTime ? formatTime(entry.endTime) : 'En cours'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="font-medium text-purple-600">
                        {(() => {
                          const employee = employees.find(emp => emp.id === entry.employeeId);
                          const duration = calculateDuration(entry.startTime, entry.endTime, employee);
                          return (
                            <div>
                              <div>{duration.display}</div>
                              {duration.breakMinutes > 0 && (
                                <div className="text-xs text-orange-500">
                                  (Pause auto: {duration.breakMinutes}min)
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm transition-colors duration-300 ${
                      darkMode ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      {totalBreakTime > 0 ? `${Math.round(totalBreakTime)}min` : '-'}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm transition-colors duration-300 ${
                      darkMode ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      {formatDate(entry.startTime)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm transition-colors duration-300 ${
                      darkMode ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      <div className="flex space-x-2">
                        {editingEntry === entry.id ? (
                          <>
                            <button 
                              onClick={handleSaveEdit}
                              className="text-green-600 hover:text-green-800 font-medium"
                            >
                              Sauver
                            </button>
                            <button 
                              onClick={cancelEdit}
                              className={`transition-colors duration-300 ${
                                darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-800'
                              }`}
                            >
                              Annuler
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => handleEditEntry(entry)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Modifier
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <header className={`shadow-sm border-b transition-colors duration-300 ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Clock className="w-8 h-8 text-purple-600" />
              </div>
              <div>
                <h1 className={`text-2xl font-bold transition-colors duration-300 ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>TimeTracker24</h1>
                <p className={`text-sm transition-colors duration-300 ${
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {new Date().toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })} - {new Date().toLocaleTimeString('fr-FR')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Afficher le statut NFC en mode Electron */}
              {isElectron && (
                <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg text-sm ${
                  nfcStatus.available 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    nfcStatus.scanning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                  }`}></div>
                  <span>NFC {nfcStatus.available ? 'Actif' : 'Inactif'}</span>
                </div>
              )}

              {/* Supprimer l'indicateur "En ligne" pour web */}
              {!isElectron && <SyncManager />}
              
              <button 
                onClick={toggleDarkMode}
                className={`p-2 rounded-lg transition-colors duration-300 ${
                  darkMode 
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {darkMode ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                )}
              </button>
              <button 
                onClick={() => setShowAdminPanel(true)}
                className={`p-2 rounded-lg transition-colors duration-300 ${
                  darkMode 
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className={`shadow-sm border-b transition-colors duration-300 ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex space-x-8">
            <button 
              onClick={() => setCurrentView('pointage')}
              className={`nav-item ${currentView === 'pointage' ? 'nav-item-active' : 'nav-item-inactive'} ${
                darkMode ? 'dark-nav-item' : ''
              }`}
            >
              <Clock className="w-5 h-5" />
              <span>Pointage</span>
            </button>
            <button 
              onClick={() => setCurrentView('registre')}
              className={`nav-item ${currentView === 'registre' ? 'nav-item-active' : 'nav-item-inactive'} ${
                darkMode ? 'dark-nav-item' : ''
              }`}
            >
              <FileText className="w-5 h-5" />
              <span>Registre</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main>
        {success && (
          <div className="max-w-7xl mx-auto px-6 py-2">
            <div className="success p-3 rounded-lg border mb-4">
              {success}
            </div>
          </div>
        )}
        
        {error && (
          <div className="max-w-7xl mx-auto px-6 py-2">
            <div className="error p-3 rounded-lg border mb-4">
              {error}
            </div>
          </div>
        )}
        
        {currentView === 'pointage' && renderPointageView()}
        {currentView === 'registre' && renderRegistreView()}
      </main>

      {/* Admin Panel */}
      {showAdminPanel && (
        <AdminPanel 
          onClose={() => setShowAdminPanel(false)}
          employees={employees}
          onEmployeeUpdate={loadEmployees}
          darkMode={darkMode}
        />
      )}

      {/* Edit Auth Modal */}
      {showEditAuth && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Shield className="w-6 h-6 text-purple-600" />
                <h2 className="text-xl font-semibold text-gray-900">Modification des Heures</h2>
              </div>
              <button onClick={() => {
                setShowEditAuth(false);
                setEditPassword('');
                setPendingEditEntry(null);
              }} className="text-gray-500 hover:text-gray-700">
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                La modification des heures de travail nécessite une authentification administrateur.
              </p>
              <div>
                <label className="form-label">Mot de passe administrateur</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="form-input"
                  placeholder="Entrez le mot de passe"
                  onKeyPress={(e) => e.key === 'Enter' && handleEditAuth()}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button 
                  onClick={() => {
                    setShowEditAuth(false);
                    setEditPassword('');
                    setPendingEditEntry(null);
                  }} 
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button onClick={handleEditAuth} className="btn btn-primary">
                  Autoriser la modification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Auth Modal - Keep for backward compatibility but not used */}
      {showStatsAuth && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Shield className="w-6 h-6 text-purple-600" />
                <h2 className="text-xl font-semibold text-gray-900">Accès Statistiques</h2>
              </div>
              <button onClick={() => {
                setShowStatsAuth(false);
                setStatsPassword('');
              }} className="text-gray-500 hover:text-gray-700">
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Les statistiques avec salaire nécessitent une authentification.
              </p>
              <div>
                <label className="form-label">Mot de passe</label>
                <input
                  type="password"
                  value={statsPassword}
                  onChange={(e) => setStatsPassword(e.target.value)}
                  className="form-input"
                  placeholder="Entrez le mot de passe"
                  onKeyPress={(e) => e.key === 'Enter' && handleStatsAuth()}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button 
                  onClick={() => {
                    setShowStatsAuth(false);
                    setStatsPassword('');
                  }} 
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button onClick={handleStatsAuth} className="btn btn-primary">
                  Accéder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee Stats */}
      {showEmployeeStats && selectedStatsEmployee && (
        <EmployeeStats 
          employee={selectedStatsEmployee}
          timeEntries={timeEntries}
          onClose={() => {
            setShowEmployeeStats(false);
            setIsStatsAuthenticated(false);
          }}
          showSalary={selectedStatsEmployee.hourlyRate > 0}
          formatSalary={formatSalary}
        />
      )}
    </div>
  );
}

export default App;