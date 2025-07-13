const { NFC } = require('nfc-pcsc');
const EventEmitter = require('events');

class NFCManager extends EventEmitter {
  constructor() {
    super();
    this.nfc = new NFC();
    this.isScanning = false;
    this.readers = new Map();
  }

  async initialize() {
    try {
      this.nfc.on('reader', this.handleReader.bind(this));
      this.nfc.on('error', this.handleError.bind(this));
      console.log('✅ NFC Manager initialisé');
      return true;
    } catch (error) {
      console.error('❌ Erreur initialisation NFC:', error);
      return false;
    }
  }

  handleReader(reader) {
    console.log(`📱 Lecteur NFC détecté: ${reader.reader.name}`);
    this.readers.set(reader.reader.name, reader);
    
    reader.on('card', this.handleCard.bind(this));
    reader.on('card.off', this.handleCardRemoved.bind(this));
    reader.on('error', this.handleReaderError.bind(this));
    
    this.emit('reader-connected', {
      name: reader.reader.name,
      status: 'connected'
    });
  }

  async handleCard(card) {
    console.log('🏷️  Tag NFC détecté');
    
    try {
      // Lire les données du tag
      const data = await this.readEmployeeData(card);
      
      if (data && data.type === 'timetracker24_employee') {
        console.log(`✅ Tag employé reconnu: ${data.name}`);
        
        this.emit('employee-scan', {
          tagId: data.tagId,
          employeeId: data.employeeId,
          name: data.name,
          position: data.position,
          timestamp: new Date().toISOString()
        });
      } else {
        console.log('❌ Tag non reconnu ou vide');
        this.emit('unknown-tag', {
          uid: card.uid,
          type: card.type,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('❌ Erreur lecture tag:', error);
      this.emit('read-error', { error: error.message });
    }
  }

  async readEmployeeData(card) {
    try {
      // Lire le contenu NDEF du tag
      const data = await card.readNdefMessage();
      
      if (data && data.length > 0) {
        // Parser les enregistrements NDEF
        for (const record of data) {
          if (record.type === 'T') { // Text record
            const text = record.payload.toString('utf8');
            try {
              const employeeData = JSON.parse(text);
              return employeeData;
            } catch (e) {
              console.log('Tag contient du texte mais pas du JSON valide');
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Erreur lecture NDEF:', error);
      return null;
    }
  }

  parseNDEF(data) {
    // Parser basique pour les données NDEF
    try {
      // Détecter si c'est du texte simple
      const text = data.toString('utf8').replace(/\x00/g, '');
      return text.match(/^[\x20-\x7E]*$/) ? text : null;
    } catch (error) {
      return null;
    }
  }

  async registerEmployeeTag(employeeId, tagUid) {
    console.log(`📝 Enregistrement tag ${tagUid} pour employé ${employeeId}`);
    
    // Vérifier si le tag n'est pas déjà utilisé
    if (this.employeeTags.has(tagUid)) {
      throw new Error('Ce tag est déjà associé à un autre employé');
    }

    // Ajouter l'association
    this.employeeTags.set(tagUid, employeeId);
    
    // Ici, vous pourriez sauvegarder dans une base de données
    // Pour l'instant, on garde en mémoire
    
    return {
      success: true,
      employeeId,
      tagUid,
      timestamp: new Date().toISOString()
    };
  }

  getEmployeeByTag(tagUid) {
    return this.employeeTags.get(tagUid);
  }

  startScanning() {
    console.log('🔍 Démarrage de la détection NFC...');
    this.isScanning = true;
    return true;
  }

  stopScanning() {
    console.log('⏹️ Arrêt de la détection NFC');
    this.isScanning = false;
    return true;
  }

  isAvailable() {
    return this.connectedReaders.size > 0;
  }

  isScanning() {
    return this.isScanning;
  }

  getConnectedReaders() {
    return Array.from(this.connectedReaders.keys());
  }

  cleanup() {
    console.log('🧹 Nettoyage gestionnaire NFC...');
    this.stopScanning();
    this.employeeTags.clear();
    this.connectedReaders.clear();
    
    if (this.nfc) {
      this.nfc.close();
    }
  }

  // Méthodes utilitaires
  getTagStats() {
    return {
      registeredTags: this.employeeTags.size,
      connectedReaders: this.connectedReaders.size,
      isScanning: this.isScanning
    };
  }

  exportTagDatabase() {
    const data = {
      employeeTags: Array.from(this.employeeTags.entries()),
      timestamp: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  }

  importTagDatabase(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      this.employeeTags.clear();
      
      for (const [tagUid, employeeId] of data.employeeTags) {
        this.employeeTags.set(tagUid, employeeId);
      }
      
      console.log(`📥 Importé ${this.employeeTags.size} associations tag-employé`);
      return true;
    } catch (error) {
      console.error('Erreur import base tags:', error);
      return false;
    }
  }
}

module.exports = NFCManager;