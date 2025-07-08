import React, { useEffect, useState } from 'react';
import { X as CloseIcon, User, Clock, CheckCircle } from 'lucide-react';

export function WelcomePopup({ data, onClose, darkMode }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Animation d'entrée
    setTimeout(() => setIsVisible(true), 100);
    
    // Auto-fermeture après 4 secondes
    const timer = setTimeout(() => {
      handleClose();
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const { employee, message, action, isArrival, timestamp } = data;

  return (
    <div className={`nfc-popup-overlay ${isVisible ? 'visible' : ''} ${isClosing ? 'closing' : ''}`}>
      <div className={`nfc-popup-container ${darkMode ? 'dark' : ''}`}>
        <button 
          onClick={handleClose}
          className={`nfc-popup-close ${darkMode ? 'dark' : ''}`}
        >
          <CloseIcon className="w-4 h-4" />
        </button>

        <div className={`nfc-popup-content ${isArrival ? 'arrival' : 'departure'}`}>
          {/* Photo de profil */}
          <div className="nfc-popup-avatar">
            {employee.profileImage ? (
              <img 
                src={employee.profileImage} 
                alt={employee.name}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <div className="w-full h-full bg-purple-100 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-purple-600" />
              </div>
            )}
          </div>

          {/* Informations employé */}
          <div className="nfc-popup-info">
            <h2 className={`nfc-popup-message ${darkMode ? 'dark' : ''}`}>
              {message}
            </h2>
            <p className={`nfc-popup-position ${darkMode ? 'dark' : ''}`}>
              {employee.position}
            </p>
            <div className={`nfc-popup-time ${darkMode ? 'dark' : ''}`}>
              <Clock className="w-4 h-4" />
              <span>{new Date(timestamp).toLocaleTimeString('fr-FR')}</span>
            </div>
          </div>

          {/* Indicateur d'action */}
          <div className={`nfc-popup-action ${isArrival ? 'arrival' : 'departure'}`}>
            <div className="nfc-popup-action-icon">
              <CheckCircle className="w-6 h-6" />
            </div>
            <span className="nfc-popup-action-text">
              {isArrival ? 'ARRIVÉE' : 'DÉPART'}
            </span>
          </div>
        </div>

        {/* Barre de progression */}
        <div className="nfc-popup-progress">
          <div className="nfc-popup-progress-bar"></div>
        </div>
      </div>
    </div>
  );
}