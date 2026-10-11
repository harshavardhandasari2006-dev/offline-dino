/**
 * OFFLINE DINO - Audio Engine (Authentic Chrome Dino Sound Reproduction)
 * High-performance, zero-latency procedural Web Audio synthesizer.
 * Reproduces the signature Chrome Dino audio cues (crisp jump blip, 3-tone hit buzz, and milestone reach).
 * 100% offline with zero external dependencies and rock-solid browser audio unlock.
 */

class SoundEffects {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;
    this.lastSoundTime = {};
    this.isUnlocked = false;

    // Load initial mute setting from localStorage
    try {
      const savedMute = localStorage.getItem('offline_dino_muted');
      this.isMuted = savedMute === 'true';
    } catch (e) {
      this.isMuted = false;
    }

    // Attach eager unlocking listeners to window for any user gesture
    this.attachUnlockListeners();
  }

  attachUnlockListeners() {
    const unlockHandler = () => {
      this.unlockAudio();
    };

    ['keydown', 'mousedown', 'touchstart', 'pointerdown'].forEach((evt) => {
      window.addEventListener(evt, unlockHandler, { passive: true });
    });
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.isMuted ? 0 : 0.35;
        this.masterGain.connect(this.ctx.destination);
        this.initNoiseBuffer();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  initNoiseBuffer() {
    if (!this.ctx || this.cachedNoiseBuffer) return;
    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.14);
      this.cachedNoiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = this.cachedNoiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
      }
    } catch (e) {}
  }

  unlockAudio() {
    this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this.isUnlocked = true;
      }).catch(() => {});
    } else {
      this.isUnlocked = true;
    }
  }

  setMuted(muted) {
    this.isMuted = !!muted;
    try {
      localStorage.setItem('offline_dino_muted', this.isMuted ? 'true' : 'false');
    } catch (e) {}

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.35, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  toggleMute() {
    return this.setMuted(!this.isMuted);
  }

  // Throttle helper to prevent sound spam / duplicate key repeats
  canPlay(name, minIntervalMs = 70) {
    if (this.isMuted) return false;
    this.unlockAudio();
    if (!this.ctx) return false;

    const now = performance.now();
    if (this.lastSoundTime[name] && (now - this.lastSoundTime[name] < minIntervalMs)) {
      return false;
    }
    this.lastSoundTime[name] = now;
    return true;
  }

  // =========================================================================
  // AUTHENTIC CHROME DINO SOUNDS
  // =========================================================================

  /**
   * Authentic Chrome Dino Jump Sound
   * High, crisp piezo square/triangle blip at ~900-980 Hz for ~0.08s.
   */
  playJump() {
    if (!this.canPlay('jump', 90)) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Chrome Dino jump is a signature high crisp chirp blip
    osc.type = 'square';
    osc.frequency.setValueAtTime(840, t);
    osc.frequency.exponentialRampToValueAtTime(980, t + 0.03);
    osc.frequency.setValueAtTime(980, t + 0.06);

    // Snappy envelope to prevent speaker pop
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.32, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    // Gentle low-pass filter to soften excessive high-frequency harshness
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4500, t);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.09);
  }

  /**
   * Authentic Chrome Dino Collision / Hit Sound
   * Descending low 3-tone square crash crunch.
   */
  playHit() {
    if (!this.canPlay('hit', 300)) return;
    const t = this.ctx.currentTime;

    // 1. Descending multi-frequency buzz
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.setValueAtTime(240, t + 0.07);
    osc.frequency.setValueAtTime(140, t + 0.14);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.26);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.38, t + 0.01);
    gain.gain.setValueAtTime(0.35, t + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    // 2. Punchy noise crunch (reusing cached noise buffer - DINO-022)
    try {
      if (!this.cachedNoiseBuffer) {
        this.initNoiseBuffer();
      }
      if (this.cachedNoiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.cachedNoiseBuffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(1200, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(200, t + 0.14);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        noise.start(t);
        noise.stop(t + 0.15);
      }
    } catch (e) {}

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  /**
   * Authentic Chrome Dino Score Milestone (100 Points)
   * Iconic two-tone beep (G5 -> C6).
   */
  playMilestone() {
    if (!this.canPlay('milestone', 500)) return;
    const t = this.ctx.currentTime;

    const playTone = (freq, startTime, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.24, startTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3500, startTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    };

    // Chrome Dino's exact milestone notes
    playTone(784, t, 0.08);          // G5
    playTone(1046.5, t + 0.09, 0.12); // C6
  }

  /**
   * Duck Swoosh: subtle aerodynamic downward breath
   */
  playDuck() {
    if (!this.canPlay('duck', 160)) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.1);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.11);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  /**
   * UI Click: cheerful clean bubble pop
   */
  playClick() {
    if (!this.canPlay('click', 50)) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(700, t);
    osc.frequency.exponentialRampToValueAtTime(1100, t + 0.04);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.06);
  }

  /**
   * Countdown Chime: 3, 2, 1, GO
   */
  playCountdown(step) {
    if (!this.canPlay('countdown_' + step, 100)) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const isGo = step === 'GO' || step === 0;
    osc.type = isGo ? 'square' : 'triangle';
    const freq = isGo ? 987.77 : 587.33; // B5 for GO, D5 for 3-2-1

    osc.frequency.setValueAtTime(freq, t);
    if (isGo) {
      osc.frequency.exponentialRampToValueAtTime(1318.5, t + 0.16); // ramp to E6
    }

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (isGo ? 0.35 : 0.16));

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, t);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + (isGo ? 0.38 : 0.18));
  }

  /**
   * New High Score fanfare
   */
  playNewHighScore() {
    if (!this.canPlay('new_high_score', 2000)) return;
    const t = this.ctx.currentTime;
    const notes = [587.33, 784, 987.77, 1174.66]; // D5, G5, B5, D6
    const dur = 0.08;

    notes.forEach((freq, idx) => {
      const startTime = t + (idx * dur);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime);

      const isLast = idx === notes.length - 1;
      const noteDur = isLast ? 0.28 : dur * 0.85;

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.25, startTime + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDur);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3800, startTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime);
      osc.stop(startTime + noteDur + 0.02);
    });
  }
}

window.soundEngine = new SoundEffects();
