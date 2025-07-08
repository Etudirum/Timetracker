const { app, BrowserWindow, ipcMain, Notification, dialog } = require('electron');
const path = require('path');
const isDev = process.env.ELECTRON_IS_DEV === 'true';
const Store = require('electron-store');

// Store pour les paramètres persistants
const store = new Store();

// Modules NFC et son
const NFCManager = require('./nfc-manager');
const SoundManager = require('./sound-manager');

let mainWindow;
let nfcManager;
let soundManager;

function createWindow() {
  // Récupérer les paramètres sauvegardés
  const windowState = store.get('windowState', {
    width: 1200,
    height: 800,
    x: undefined,
    y: undefined
  });

  const darkMode = store.get('darkMode', false);

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    titleBarStyle: 'default',
    show: false // Cacher jusqu'à ce que la page soit prête
  });

  // Charger l'application
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/build/index.html'));
  }

  // Afficher la fenêtre quand elle est prête
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Appliquer le thème sauvegardé
    mainWindow.webContents.send('theme-changed', darkMode);
    
    // Initialiser les modules
    initializeModules();
  });

  // Sauvegarder l'état de la fenêtre
  mainWindow.on('close', () => {
    const bounds = mainWindow.getBounds();
    store.set('windowState', bounds);
  });

  // Gérer la fermeture
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (nfcManager) {
      nfcManager.cleanup();
    }
  });
}

function initializeModules() {
  try {
    // Initialiser le gestionnaire de son
    soundManager = new SoundManager();
    
    // Initialiser le gestionnaire NFC
    nfcManager = new NFCManager();
    nfcManager.on('tag-detected', handleNFCTag);
    nfcManager.on('error', handleNFCError);
    
    // Démarrer la détection NFC
    nfcManager.startScanning();
    
    console.log('✅ Modules initialisés avec succès');
    
    // Notifier le frontend que NFC est disponible
    mainWindow.webContents.send('nfc-status', { available: true, scanning: true });
    
  } catch (error) {
    console.error('❌ Erreur initialisation modules:', error);
    
    // Notifier le frontend de l'erreur
    mainWindow.webContents.send('nfc-status', { 
      available: false, 
      error: error.message 
    });
  }
}

async function handleNFCTag(tagData) {
  console.log('🏷️ Tag NFC détecté:', tagData.uid);
  
  try {
    // Envoyer au frontend pour traitement
    const result = await mainWindow.webContents.invoke('process-nfc-tag', {
      uid: tagData.uid,
      data: tagData.data,
      timestamp: new Date().toISOString()
    });
    
    if (result.success) {
      const { employee, action } = result;
      
      // Jouer le son approprié
      soundManager.playClockSound(action);
      
      // Afficher le popup de bienvenue
      showWelcomePopup(employee, action);
      
      // Notification système
      showSystemNotification(employee, action);
      
      console.log(`✅ Pointage ${action} pour ${employee.name}`);
    } else {
      // Tag non reconnu
      soundManager.playErrorSound();
      
      showDialog('Tag non reconnu', 
        'Ce badge NFC n\'est associé à aucun employé.\nVeuillez contacter l\'administrateur.');
    }
    
  } catch (error) {
    console.error('❌ Erreur traitement tag NFC:', error);
    soundManager.playErrorSound();
    showDialog('Erreur', 'Erreur lors du traitement du badge NFC.');
  }
}

function handleNFCError(error) {
  console.error('❌ Erreur NFC:', error);
  
  // Notifier le frontend
  mainWindow.webContents.send('nfc-error', {
    message: error.message,
    code: error.code
  });
  
  // Notification utilisateur
  showDialog('Erreur NFC', 
    `Problème avec le lecteur NFC:\n${error.message}\n\nVérifiez que le lecteur est bien connecté.`);
}

function showWelcomePopup(employee, action) {
  const isArrival = action === 'clock-in';
  const message = isArrival 
    ? `Bienvenue ${employee.gender === 'M' ? 'Monsieur' : 'Madame'} ${employee.lastName}`
    : `Au revoir ${employee.gender === 'M' ? 'Monsieur' : 'Madame'} ${employee.lastName}`;
  
  // Envoyer au frontend pour afficher le popup
  mainWindow.webContents.send('show-welcome-popup', {
    employee,
    message,
    action,
    isArrival,
    timestamp: new Date().toISOString()
  });
}

function showSystemNotification(employee, action) {
  const isArrival = action === 'clock-in';
  const title = isArrival ? 'Arrivée enregistrée' : 'Départ enregistré';
  const body = `${employee.name} - ${new Date().toLocaleTimeString('fr-FR')}`;
  
  new Notification({
    title,
    body,
    icon: path.join(__dirname, '../assets/icon.png'),
    silent: true // Le son est géré séparément
  }).show();
}

function showDialog(title, message) {
  dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title,
    message,
    buttons: ['OK']
  });
}

// Gestionnaires IPC
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-theme', () => {
  return store.get('darkMode', false);
});

ipcMain.handle('set-theme', (event, isDark) => {
  store.set('darkMode', isDark);
  // Notifier toutes les fenêtres du changement de thème
  mainWindow.webContents.send('theme-changed', isDark);
  return true;
});

ipcMain.handle('get-nfc-status', () => {
  return {
    available: nfcManager ? nfcManager.isAvailable() : false,
    scanning: nfcManager ? nfcManager.isScanning() : false,
    readers: nfcManager ? nfcManager.getConnectedReaders() : []
  };
});

ipcMain.handle('register-nfc-tag', async (event, { employeeId, tagUid }) => {
  if (!nfcManager) {
    throw new Error('Gestionnaire NFC non disponible');
  }
  
  try {
    await nfcManager.registerEmployeeTag(employeeId, tagUid);
    return { success: true };
  } catch (error) {
    console.error('Erreur enregistrement tag:', error);
    throw error;
  }
});

ipcMain.handle('get-sound-settings', () => {
  return store.get('soundSettings', {
    enabled: true,
    volume: 0.7,
    arrivalSound: 'default',
    departureSound: 'default'
  });
});

ipcMain.handle('set-sound-settings', (event, settings) => {
  store.set('soundSettings', settings);
  if (soundManager) {
    soundManager.updateSettings(settings);
  }
  return true;
});

ipcMain.handle('test-sound', (event, type) => {
  if (soundManager) {
    soundManager.playClockSound(type);
  }
});

// Gestionnaire pour le mode plein écran
ipcMain.handle('toggle-fullscreen', () => {
  const isFullScreen = mainWindow.isFullScreen();
  mainWindow.setFullScreen(!isFullScreen);
  return !isFullScreen;
});

// Application events
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (nfcManager) {
    nfcManager.cleanup();
  }
});

// Gestion des erreurs non gérées
process.on('uncaughtException', (error) => {
  console.error('Erreur non gérée:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesse rejetée non gérée:', reason);
});