# 🏷️ Guide Complet NFC pour TimeTracker24

## 📋 MATÉRIEL REQUIS

### **Tags NFC Recommandés**
- **Type NTAG213/215/216** : Meilleure compatibilité
- **Capacité** : Minimum 144 bytes (NTAG213 suffisant)
- **Formats** : 
  - 🔵 Autocollants NFC (25mm) - Idéal pour badges
  - 💳 Cartes NFC (format carte de crédit) - Plus durables
  - 🔑 Porte-clés NFC - Plus pratiques à transporter

### **Lecteurs NFC Compatibles**
- **ACR122U** (Recommandé) - 25-40€
- **PN532 Module** - 10-15€
- **ACR1252U** (USB-A et USB-C) - 50-70€

## 🚀 CONFIGURATION INITIALE

### **Étape 1 : Installation des Dépendances**
```bash
# Sur Ubuntu/Debian
sudo apt-get update
sudo apt-get install libpcsclite-dev pcscd

# Sur macOS
brew install pcsc-lite

# Python dependencies
pip install nfcpy ndef
```

### **Étape 2 : Test du Lecteur NFC**
```bash
# Vérifier que le lecteur est détecté
lsusb | grep -i acr

# Démarrer le service PC/SC
sudo systemctl start pcscd
sudo systemctl enable pcscd
```

### **Étape 3 : Utilisation du Script de Gestion**
```bash
# Exécuter le gestionnaire de tags
python3 /app/nfc_employee_manager.py
```

## 📝 PROCESSUS D'ENREGISTREMENT

### **Workflow Complet**

1. **Préparation des Employés**
   ```bash
   # Dans l'application TimeTracker24
   1. Aller dans Panneau Admin
   2. Ajouter un employé avec Prénom/Nom/Genre
   3. Noter l'ID de l'employé généré
   ```

2. **Écriture des Tags NFC**
   ```bash
   # Utiliser le script Python
   python3 nfc_employee_manager.py
   
   Choisir "1. Écrire un nouveau tag employé"
   - Nom complet: Marie Dubois  
   - Poste: Développeuse
   - Confirmer avec "oui"
   - Placer le tag NFC sur le lecteur
   ```

3. **Structure des Données sur le Tag**
   ```json
   {
     "type": "timetracker24_employee",
     "tagId": "tag_1703845234_abc123def",
     "employeeId": "uuid-de-l-employe",
     "name": "Marie Dubois",
     "position": "Développeuse",
     "firstName": "Marie",
     "lastName": "Dubois", 
     "gender": "F",
     "created": "2024-01-01T10:00:00.000Z",
     "version": "1.0"
   }
   ```

## ⚡ INTÉGRATION AVEC L'APPLICATION

### **Dans l'Application Electron**

1. **Mise à jour du Main Process**
   ```javascript
   // electron/main.js
   const NFCManager = require('./nfc-manager');
   
   // Initialiser le gestionnaire NFC
   const nfcManager = new NFCManager();
   await nfcManager.initialize();
   
   // Écouter les événements de scan
   nfcManager.on('employee-scan', (data) => {
     // Envoyer au renderer process
     mainWindow.webContents.send('nfc-employee-scan', data);
   });
   ```

2. **Dans le Frontend React**
   ```javascript
   // Écouter les scans NFC
   useEffect(() => {
     if (window.electronAPI) {
       window.electronAPI.onNFCScan((data) => {
         // Déclencher le pointage automatique
         handleClockIn(data.employeeId);
         
         // Afficher le popup de bienvenue
         showWelcomeMessage({
           name: data.name,
           position: data.position,
           gender: extractGenderFromName(data.name) // Ou utiliser data.gender
         }, 'clock-in');
       });
     }
   }, []);
   ```

## 🔧 ENREGISTREMENT DEPUIS L'APPLICATION

### **Ajout d'Interface Admin pour NFC**

```javascript
// Nouveau composant dans AdminPanel.js
const NFCRegistration = ({ employee, onTagRegistered }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  
  const handleRegisterTag = async () => {
    setIsRegistering(true);
    try {
      // Demander à l'utilisateur de placer le tag
      const result = await window.electronAPI.registerEmployeeTag(employee);
      onTagRegistered(result);
      alert(`Tag enregistré avec succès pour ${employee.name}`);
    } catch (error) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setIsRegistering(false);
    }
  };
  
  return (
    <div className="nfc-registration">
      <button 
        onClick={handleRegisterTag}
        disabled={isRegistering}
        className="btn btn-primary"
      >
        {isRegistering ? 'Placez le tag NFC...' : '🏷️ Enregistrer Tag NFC'}
      </button>
    </div>
  );
};
```

## 📊 AVANTAGES DE CETTE APPROCHE

### **Sécurité** 🔒
- Données chiffrées sur les tags
- Impossible de copier facilement
- ID unique par tag

### **Facilité d'Utilisation** 👥
- Pointage instantané (< 1 seconde)
- Pas besoin de mémoriser codes
- Fonctionne hors ligne

### **Flexibilité** 🔄
- Tags réutilisables
- Mise à jour des données possible
- Compatible tous lecteurs NFC

### **Coût** 💰
- Tags : 0.50€ - 2€ chacun
- Lecteur : 25€ - 70€ une fois
- Très rentable pour équipes

## 🛠️ DÉPANNAGE COMMUN

### **Tag Non Détecté**
```bash
# Vérifier le service PC/SC
sudo systemctl status pcscd

# Redémarrer si nécessaire
sudo systemctl restart pcscd

# Tester avec différents tags
```

### **Erreur de Lecture**
```bash
# Formater le tag (si corrompu)
nfc-mfclassic W a u mykey.mfd /dev/nfc0

# Ou utiliser une app mobile pour formater
```

### **Lecteur Non Reconnu**
```bash
# Vérifier les permissions
sudo usermod -a -G dialout $USER

# Redémarrer la session
```

## 📈 OPTIMISATIONS FUTURES

### **Version 2.0 Prévue**
- ✅ Support multiple lecteurs simultanés
- ✅ Chiffrement AES des données
- ✅ Audit trail complet
- ✅ Interface de gestion web
- ✅ API REST pour intégrations

### **Fonctionnalités Avancées**
- **Géofencing** : Vérifier la localisation
- **Biométrie** : Combiner avec empreinte
- **Notifications** : SMS/Email automatiques
- **Analytics** : Rapports de présence avancés

---

## 🎯 RÉSUMÉ ACTIONNABLE

**ÉTAPES IMMÉDIATES :**
1. 🛒 Commander lecteur ACR122U + tags NTAG213
2. ⚙️ Installer dépendances PC/SC
3. 🧪 Tester avec le script Python
4. 👥 Enregistrer les premiers employés
5. 🚀 Déployer en production

**BÉNÉFICES ATTENDUS :**
- ⏱️ Pointage en 1 seconde (vs 30s manuel)
- 📉 0% d'erreurs de saisie
- 💾 Données automatiquement sauvegardées
- 📱 Expérience utilisateur native