import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Settings, Users, Tag, Volume2 } from 'lucide-react';

export function NFCManager({ employees, onEmployeeUpdate, darkMode }) {
  const [nfcStatus, setNfcStatus] = useState({ available: false, scanning: false });
  const [showSettings, setShowSettings] = useState(false);
  const [soundSettings, setSoundSettings] = useState({
    enabled: true,
    volume: 0.7
  });
  const [tagRegistration, setTagRegistration] = useState({
    isRegistering: false,
    employeeId: '',
    waitingForTag: false
  });

  useEffect(() => {
    if (window.electronAPI) {
      // Charger le statut NFC
      loadNFCStatus();
      
      // Charger les paramètres son
      loadSoundSettings();
      
      // Écouter les changements de statut NFC
      window.electronAPI.onNFCStatus((event, status) => {
        setNfcStatus(status);
      });
      
      window.electronAPI.onNFCError((event, error) => {
        console.error('Erreur NFC:', error);
      });
    }
  }, []);

  const loadNFCStatus = async () => {
    try {
      const status = await window.electronAPI.getNFCStatus();
      setNfcStatus(status);
    } catch (error) {
      console.error('Erreur chargement statut NFC:', error);
    }
  };

  const loadSoundSettings = async () => {
    try {
      const settings = await window.electronAPI.getSoundSettings();
      setSoundSettings(settings);
    } catch (error) {
      console.error('Erreur chargement paramètres son:', error);
    }
  };

  const handleSoundSettingsChange = async (newSettings) => {
    try {
      await window.electronAPI.setSoundSettings(newSettings);
      setSoundSettings(newSettings);
    } catch (error) {
      console.error('Erreur sauvegarde paramètres son:', error);
    }
  };

  const testSound = async (type) => {
    try {
      await window.electronAPI.testSound(type);
    } catch (error) {
      console.error('Erreur test son:', error);
    }
  };

  const startTagRegistration = (employeeId) => {
    setTagRegistration({
      isRegistering: true,
      employeeId,
      waitingForTag: true
    });
  };

  const cancelTagRegistration = () => {
    setTagRegistration({
      isRegistering: false,
      employeeId: '',
      waitingForTag: false
    });
  };

  if (!window.electronAPI) {
    return null; // Pas d'affichage en mode web
  }

  return (
    <>
      {/* Panneau de paramètres NFC */}
      {showSettings && (
        <div className="modal-overlay">
          <div className={`modal-content max-w-2xl ${darkMode ? 'dark' : ''}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Paramètres NFC
              </h2>
              <button 
                onClick={() => setShowSettings(false)}
                className={`${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* Statut NFC */}
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <h3 className={`text-lg font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Statut du lecteur NFC
                </h3>
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    nfcStatus.available ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                    {nfcStatus.available ? 'Lecteur connecté' : 'Aucun lecteur détecté'}
                  </span>
                </div>
                {nfcStatus.readers && nfcStatus.readers.length > 0 && (
                  <div className="mt-2">
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Lecteurs connectés: {nfcStatus.readers.join(', ')}
                    </p>
                  </div>
                )}
              </div>

              {/* Paramètres son */}
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <h3 className={`text-lg font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Paramètres sonores
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                      Sons activés
                    </span>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={soundSettings.enabled}
                        onChange={(e) => handleSoundSettingsChange({
                          ...soundSettings,
                          enabled: e.target.checked
                        })}
                        className="mr-2"
                      />
                    </label>
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Volume: {Math.round(soundSettings.volume * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={soundSettings.volume}
                      onChange={(e) => handleSoundSettingsChange({
                        ...soundSettings,
                        volume: parseFloat(e.target.value)
                      })}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => testSound('clock-in')}
                      className="btn btn-secondary flex items-center space-x-1"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>Test Arrivée</span>
                    </button>
                    <button
                      onClick={() => testSound('clock-out')}
                      className="btn btn-secondary flex items-center space-x-1"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>Test Départ</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Enregistrement des tags */}
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <h3 className={`text-lg font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Enregistrement des badges
                </h3>
                {!tagRegistration.isRegistering ? (
                  <div className="space-y-3">
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Sélectionnez un employé puis présentez son badge NFC au lecteur.
                    </p>
                    <select
                      value={tagRegistration.employeeId}
                      onChange={(e) => setTagRegistration({
                        ...tagRegistration,
                        employeeId: e.target.value
                      })}
                      className={`form-input ${darkMode ? 'dark' : ''}`}
                    >
                      <option value="">Choisir un employé</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} - {emp.position}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => startTagRegistration(tagRegistration.employeeId)}
                      disabled={!tagRegistration.employeeId || !nfcStatus.available}
                      className="btn btn-primary flex items-center space-x-1"
                    >
                      <Tag className="w-4 h-4" />
                      <span>Enregistrer un badge</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center space-y-3">
                    <div className="animate-pulse">
                      <Tag className="w-12 h-12 mx-auto text-purple-600" />
                    </div>
                    <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Présentez le badge NFC au lecteur...
                    </p>
                    <button
                      onClick={cancelTagRegistration}
                      className="btn btn-secondary"
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}