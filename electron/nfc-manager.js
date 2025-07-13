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

  async handleCard(card, reader) {
    if (!this.isScanning) {
      return;
    }

    try {
      const tagData = {
        uid: card.uid,
        atr: card.atr,
        standard: card.standard,
        type: card.type,
        reader: reader.name,
        timestamp: new Date().toISOString()
      };

      // Lire les données du tag si possible
      try {
        const data = await this.readTagData(card, reader);
        tagData.data = data;
      } catch (readError) {
        console.log('Info: Impossible de lire les données du tag (normal pour certains types)');
      }

      this.emit('tag-detected', tagData);
    } catch (error) {
      console.error('Erreur traitement tag:', error);
      this.emit('error', {
        message: `Erreur traitement tag: ${error.message}`,
        code: error.code
      });
    }
  }

  async readTagData(card, reader) {
    // Tentative de lecture des données NDEF si disponibles
    try {
      const data = await reader.read(0, 16); // Lire les premiers 16 bytes
      return {
        raw: data,
        hex: data.toString('hex'),
        text: this.parseNDEF(data)
      };
    } catch (error) {
      // Retourner seulement l'UID si la lecture échoue
      return {
        uid: card.uid,
        readable: false
      };
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