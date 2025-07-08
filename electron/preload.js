const { contextBridge, ipcRenderer } = require('electron');

// API sécurisée exposée au renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Informations de l'application
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Gestion du thème
  getTheme: () => ipcRenderer.invoke('get-theme'),
  setTheme: (isDark) => ipcRenderer.invoke('set-theme', isDark),
  onThemeChanged: (callback) => ipcRenderer.on('theme-changed', callback),
  
  // Gestion NFC
  getNFCStatus: () => ipcRenderer.invoke('get-nfc-status'),
  registerNFCTag: (employeeId, tagUid) => ipcRenderer.invoke('register-nfc-tag', { employeeId, tagUid }),
  onNFCTag: (callback) => ipcRenderer.on('process-nfc-tag', callback),
  onNFCStatus: (callback) => ipcRenderer.on('nfc-status', callback),
  onNFCError: (callback) => ipcRenderer.on('nfc-error', callback),
  
  // Gestion des sons
  getSoundSettings: () => ipcRenderer.invoke('get-sound-settings'),
  setSoundSettings: (settings) => ipcRenderer.invoke('set-sound-settings', settings),
  testSound: (type) => ipcRenderer.invoke('test-sound', type),
  
  // Popup de bienvenue
  onShowWelcomePopup: (callback) => ipcRenderer.on('show-welcome-popup', callback),
  
  // Réponse pour le traitement des tags NFC
  respondToNFCTag: (result) => ipcRenderer.invoke('respond-to-nfc-tag', result),
  
  // Utilitaires
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  
  // Nettoyage des listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Gestionnaire pour les réponses aux tags NFC
ipcRenderer.handle('process-nfc-tag', async (event, tagData) => {
  // Envoyer les données au frontend React
  return new Promise((resolve) => {
    // Créer un événement personnalisé pour React
    const customEvent = new CustomEvent('nfc-tag-detected', {
      detail: { tagData, resolve }
    });
    window.dispatchEvent(customEvent);
  });
});

// Log des erreurs pour débogage
window.addEventListener('error', (event) => {
  console.error('Erreur window:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Promesse rejetée:', event.reason);
});