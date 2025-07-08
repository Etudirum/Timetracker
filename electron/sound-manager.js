const fs = require('fs');
const path = require('path');
const Speaker = require('speaker');

class SoundManager {
  constructor() {
    this.settings = {
      enabled: true,
      volume: 0.7,
      arrivalSound: 'default',
      departureSound: 'default'
    };
    
    this.sounds = new Map();
    this.loadSounds();
  }

  loadSounds() {
    const soundsDir = path.join(__dirname, '../sounds');
    
    // Créer le dossier sons s'il n'existe pas
    if (!fs.existsSync(soundsDir)) {
      fs.mkdirSync(soundsDir, { recursive: true });
    }

    // Charger les sons par défaut
    this.loadDefaultSounds();
  }

  loadDefaultSounds() {
    // Générer des sons par défaut si pas de fichiers
    this.sounds.set('arrival', this.generateBeep(800, 300)); // Bip aigu court
    this.sounds.set('departure', this.generateBeep(400, 500)); // Bip grave moyen
    this.sounds.set('error', this.generateBeep(200, 1000)); // Bip grave long
  }

  generateBeep(frequency, duration) {
    // Générer un bip synthétique
    const sampleRate = 44100;
    const samples = Math.floor(sampleRate * duration / 1000);
    const buffer = Buffer.alloc(samples * 2); // 16-bit audio
    
    for (let i = 0; i < samples; i++) {
      const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
      const intSample = Math.round(sample * 32767);
      buffer.writeInt16LE(intSample, i * 2);
    }
    
    return buffer;
  }

  playClockSound(action) {
    if (!this.settings.enabled) {
      return;
    }

    try {
      const soundKey = action === 'clock-in' ? 'arrival' : 'departure';
      const soundBuffer = this.sounds.get(soundKey);
      
      if (soundBuffer) {
        this.playBuffer(soundBuffer);
      }
    } catch (error) {
      console.error('Erreur lecture son:', error);
    }
  }

  playErrorSound() {
    if (!this.settings.enabled) {
      return;
    }

    try {
      const soundBuffer = this.sounds.get('error');
      if (soundBuffer) {
        this.playBuffer(soundBuffer);
      }
    } catch (error) {
      console.error('Erreur lecture son erreur:', error);
    }
  }

  playBuffer(buffer) {
    try {
      const speaker = new Speaker({
        channels: 1,
        bitDepth: 16,
        sampleRate: 44100
      });

      // Appliquer le volume
      const volumeBuffer = this.applyVolume(buffer, this.settings.volume);
      
      speaker.write(volumeBuffer);
      speaker.end();
    } catch (error) {
      console.error('Erreur lecture audio:', error);
    }
  }

  applyVolume(buffer, volume) {
    const volumeBuffer = Buffer.alloc(buffer.length);
    
    for (let i = 0; i < buffer.length; i += 2) {
      const sample = buffer.readInt16LE(i);
      const volumeSample = Math.round(sample * volume);
      volumeBuffer.writeInt16LE(volumeSample, i);
    }
    
    return volumeBuffer;
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    console.log('⚙️ Paramètres son mis à jour:', this.settings);
  }

  loadCustomSound(soundPath, type) {
    try {
      if (fs.existsSync(soundPath)) {
        const soundData = fs.readFileSync(soundPath);
        this.sounds.set(type, soundData);
        console.log(`🔊 Son personnalisé chargé: ${type}`);
        return true;
      }
    } catch (error) {
      console.error('Erreur chargement son personnalisé:', error);
    }
    return false;
  }

  // Méthodes pour gérer les sons personnalisés
  getSoundList() {
    return Array.from(this.sounds.keys());
  }

  testSound(type) {
    const soundBuffer = this.sounds.get(type);
    if (soundBuffer) {
      this.playBuffer(soundBuffer);
      return true;
    }
    return false;
  }

  // Générateur de sons alternatifs
  generateAlternativeBeeps() {
    // Bip d'arrivée - mélodie montante
    const arrivalBuffer = this.generateMelody([600, 800, 1000], 150);
    this.sounds.set('arrival-melody', arrivalBuffer);
    
    // Bip de départ - mélodie descendante
    const departureBuffer = this.generateMelody([1000, 800, 600], 150);
    this.sounds.set('departure-melody', departureBuffer);
    
    // Bip double pour l'arrivée
    const arrivalDouble = this.generateDoubleBeep(800, 200, 100);
    this.sounds.set('arrival-double', arrivalDouble);
    
    // Bip triple pour le départ
    const departureTriple = this.generateTripleBeep(400, 150, 80);
    this.sounds.set('departure-triple', departureTriple);
  }

  generateMelody(frequencies, noteDuration) {
    const sampleRate = 44100;
    const totalSamples = frequencies.length * Math.floor(sampleRate * noteDuration / 1000);
    const buffer = Buffer.alloc(totalSamples * 2);
    
    let bufferIndex = 0;
    
    for (const frequency of frequencies) {
      const samples = Math.floor(sampleRate * noteDuration / 1000);
      
      for (let i = 0; i < samples; i++) {
        const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
        const intSample = Math.round(sample * 32767);
        buffer.writeInt16LE(intSample, bufferIndex * 2);
        bufferIndex++;
      }
    }
    
    return buffer;
  }

  generateDoubleBeep(frequency, duration, gap) {
    const sampleRate = 44100;
    const beepSamples = Math.floor(sampleRate * duration / 1000);
    const gapSamples = Math.floor(sampleRate * gap / 1000);
    const totalSamples = (beepSamples * 2) + gapSamples;
    const buffer = Buffer.alloc(totalSamples * 2);
    
    let bufferIndex = 0;
    
    // Premier bip
    for (let i = 0; i < beepSamples; i++) {
      const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
      const intSample = Math.round(sample * 32767);
      buffer.writeInt16LE(intSample, bufferIndex * 2);
      bufferIndex++;
    }
    
    // Silence
    for (let i = 0; i < gapSamples; i++) {
      buffer.writeInt16LE(0, bufferIndex * 2);
      bufferIndex++;
    }
    
    // Deuxième bip
    for (let i = 0; i < beepSamples; i++) {
      const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
      const intSample = Math.round(sample * 32767);
      buffer.writeInt16LE(intSample, bufferIndex * 2);
      bufferIndex++;
    }
    
    return buffer;
  }

  generateTripleBeep(frequency, duration, gap) {
    const sampleRate = 44100;
    const beepSamples = Math.floor(sampleRate * duration / 1000);
    const gapSamples = Math.floor(sampleRate * gap / 1000);
    const totalSamples = (beepSamples * 3) + (gapSamples * 2);
    const buffer = Buffer.alloc(totalSamples * 2);
    
    let bufferIndex = 0;
    
    for (let beepCount = 0; beepCount < 3; beepCount++) {
      // Bip
      for (let i = 0; i < beepSamples; i++) {
        const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
        const intSample = Math.round(sample * 32767);
        buffer.writeInt16LE(intSample, bufferIndex * 2);
        bufferIndex++;
      }
      
      // Silence entre les bips (sauf après le dernier)
      if (beepCount < 2) {
        for (let i = 0; i < gapSamples; i++) {
          buffer.writeInt16LE(0, bufferIndex * 2);
          bufferIndex++;
        }
      }
    }
    
    return buffer;
  }

  cleanup() {
    console.log('🧹 Nettoyage gestionnaire son...');
    this.sounds.clear();
  }
}

module.exports = SoundManager;