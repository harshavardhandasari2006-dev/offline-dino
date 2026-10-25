/**
 * OFFLINE DINO - Audio Engine (Authentic Chrome Dino Sound Reproduction)
 * High-performance, zero-latency procedural Web Audio synthesizer.
 * Reproduces the signature Chrome Dino audio cues (crisp jump blip, 3-tone hit buzz, and milestone reach).
 * 100% offline with zero external dependencies and rock-solid browser audio unlock.
 *
 * Phase 2 additions (frame-synchronized):
 * - Natural cartoon dinosaur footstep sounds (ground-contact frames only, never mid-air)
 * - Continuous soft desert wind ambience (paused when game is paused/muted)
 * - Occasional desert rustling / sandy breeze environmental sounds
 */

class SoundEffects {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;
    this.lastSoundTime = {};
    this.isUnlocked = false;

    // Wind ambience nodes (kept alive during gameplay)
    this._windSource = null;
    this._windGain = null;
    this._windFilter = null;
    this._windRunning = false;

    // Footstep state — tracks the last run-frame index to detect transitions
    this._lastRunFrame = -1;
    this._wasAirborne = false;
    // Ground-contact frames in the 10-frame cycle (0-indexed): left foot and right foot strikes
    // Frames 0 and 5 are the two ground-contact moments (one per stride half-cycle)
    this._footContactFrames = new Set([0, 5]);

    // Dedicated high-impact footstep gain node
    this.footstepGain = null;

    // Gentle sand footstep audio buffers (left, right, land)
    this._sandBuffers = {
      left: null,
      right: null,
      land: null
    };
    this._sandAssetsLoading = false;

    // Dedicated dragon flight gain node
    this.dragonGain = null;
    this._dragonAudioActive = false;

    // Rustling: next scheduled time offset from now (seconds)
    this._nextRustleDelay = 4 + Math.random() * 8;
    this._rustleAccum = 0;

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

        // Dedicated footstep gain node for punchy, loud, grounded dinosaur footsteps
        this.footstepGain = this.ctx.createGain();
        this.footstepGain.gain.value = this.isMuted ? 0 : 0.90;
        this.footstepGain.connect(this.ctx.destination);

        // Dedicated dragon flight gain node connected to destination for clear audibility
        this.dragonGain = this.ctx.createGain();
        this.dragonGain.gain.value = this.isMuted ? 0 : 0.85;
        this.dragonGain.connect(this.ctx.destination);

        this.initNoiseBuffer();
        this._buildWindNoiseBuffer();
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

  // Pre-build a long brown-noise buffer for wind (2 seconds, looped)
  _buildWindNoiseBuffer() {
    if (!this.ctx || this._windNoiseBuffer) return;
    try {
      const dur = 2.0; // seconds — long enough to avoid audible micro-loop clicks
      const len = Math.floor(this.ctx.sampleRate * dur);
      this._windNoiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._windNoiseBuffer.getChannelData(0);
      // Brown noise: integrate white noise (classic Brownian motion approximation)
      let runVal = 0;
      for (let i = 0; i < len; i++) {
        runVal += (Math.random() * 2 - 1) * 0.08;
        runVal = Math.max(-1, Math.min(1, runVal));
        data[i] = runVal;
      }
      // Fade 30ms at each end to eliminate loop click
      const fadeSamples = Math.floor(this.ctx.sampleRate * 0.03);
      for (let i = 0; i < fadeSamples; i++) {
        const f = i / fadeSamples;
        data[i] *= f;
        data[len - 1 - i] *= f;
      }
    } catch (e) {}
  }

  // Pre-load or synthesize gentle sand footstep audio buffers
  _loadSandAudioAssets() {
    if (this._sandBuffers.left && this._sandBuffers.right && this._sandBuffers.land) return;

    // Immediately synthesize high-precision in-memory buffers so steps work with 0ms latency and 100% offline reliability
    this._buildDefaultSandBuffers();
  }

  // Synthesize organic, gentle sand-running footsteps with soft granular quartz particle dispersion
  _buildDefaultSandBuffers() {
    if (!this.ctx) return;
    if (this._sandBuffers.left && this._sandBuffers.right && this._sandBuffers.land) return;

    const sampleRate = this.ctx.sampleRate || 44100;

    const createStepBuffer = (type) => {
      let duration, padFreqStart, padFreqEnd, padGain, padDur;
      let sandCenterFreq, sandBandwidth, sandGain, sandAttack, sandDecay;

      if (type === 'land') {
        duration = 0.125;
        padFreqStart = 110;
        padFreqEnd = 60;
        padGain = 0.38;
        padDur = 0.090;

        sandCenterFreq = 1650;
        sandBandwidth = 1.0;
        sandGain = 0.42;
        sandAttack = 0.012;
        sandDecay = 3.6;
      } else if (type === 'right') {
        duration = 0.082;
        padFreqStart = 135;
        padFreqEnd = 78;
        padGain = 0.24;
        padDur = 0.055;

        sandCenterFreq = 2100;
        sandBandwidth = 1.1;
        sandGain = 0.30;
        sandAttack = 0.008;
        sandDecay = 4.4;
      } else {
        duration = 0.078;
        padFreqStart = 120;
        padFreqEnd = 72;
        padGain = 0.26;
        padDur = 0.052;

        sandCenterFreq = 1850;
        sandBandwidth = 1.1;
        sandGain = 0.31;
        sandAttack = 0.007;
        sandDecay = 4.6;
      }

      const numSamples = Math.floor(sampleRate * duration);
      const audioBuf = this.ctx.createBuffer(1, numSamples, sampleRate);
      const data = audioBuf.getChannelData(0);

      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      let brownState = 0;

      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const progress = i / numSamples;

        // 1. Soft Paw Compression Pad (Muffled low-frequency cushion, no click)
        let pad = 0;
        if (t < padDur) {
          const curPadFreq = padFreqStart + (padFreqEnd - padFreqStart) * (t / padDur);
          const padPhase = 2 * Math.PI * curPadFreq * t;
          const attackTime = 0.004;
          const padAttackEnv = t < attackTime ? Math.sin((t / attackTime) * (Math.PI / 2)) : 1.0;
          const padDecayEnv = Math.exp(-(t / padDur) * 3.5);
          pad = Math.sin(padPhase) * padAttackEnv * padDecayEnv * padGain;
        }

        // 2. Granular Sand Scuff (Fine dry desert sand particles shifting)
        let sandEnv = 0;
        const attackSamples = Math.floor(sampleRate * sandAttack);
        if (i < attackSamples) {
          sandEnv = Math.sin((i / attackSamples) * (Math.PI / 2));
        } else {
          const decayProgress = (i - attackSamples) / (numSamples - attackSamples);
          sandEnv = Math.exp(-decayProgress * sandDecay);
        }

        const curCenter = sandCenterFreq * (1.0 - 0.22 * progress);
        const w0 = 2 * Math.PI * curCenter / sampleRate;
        const alpha = Math.sin(w0) / (2 * sandBandwidth);

        const b0 = alpha;
        const b1 = 0;
        const b2 = -alpha;
        const a0 = 1 + alpha;
        const a1 = -2 * Math.cos(w0);
        const a2 = 1 - alpha;

        const nb0 = b0 / a0, nb1 = b1 / a0, nb2 = b2 / a0;
        const na1 = a1 / a0, na2 = a2 / a0;

        const white = (Math.random() * 2 - 1);
        brownState = brownState * 0.72 + white * 0.28;

        const x0 = brownState;
        const filteredNoise = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
        x2 = x1; x1 = x0;
        y2 = y1; y1 = filteredNoise;

        const sandScuff = filteredNoise * sandEnv * sandGain;
        const microRustle = (Math.random() * 2 - 1) * 0.05 * sandEnv;

        data[i] = pad + sandScuff + microRustle;
      }

      // Smooth 3ms fade-out at end to prevent any edge clicks
      const fadeOutSamples = Math.floor(sampleRate * 0.003);
      for (let i = 0; i < fadeOutSamples; i++) {
        const idx = numSamples - 1 - i;
        data[idx] *= (i / fadeOutSamples);
      }

      // Peak normalization
      let maxPeak = 0;
      for (let i = 0; i < numSamples; i++) {
        const abs = Math.abs(data[i]);
        if (abs > maxPeak) maxPeak = abs;
      }
      if (maxPeak > 0.001) {
        const targetPeak = type === 'land' ? 0.60 : 0.48;
        const factor = targetPeak / maxPeak;
        for (let i = 0; i < numSamples; i++) {
          data[i] *= factor;
        }
      }

      return audioBuf;
    };

    try {
      if (!this._sandBuffers.left) this._sandBuffers.left = createStepBuffer('left');
      if (!this._sandBuffers.right) this._sandBuffers.right = createStepBuffer('right');
      if (!this._sandBuffers.land) this._sandBuffers.land = createStepBuffer('land');
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
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.35, this.ctx.currentTime);
      this.masterGain.gain.value = this.isMuted ? 0 : 0.35;
    }

    if (this.footstepGain && this.ctx) {
      this.footstepGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.footstepGain.gain.setValueAtTime(this.isMuted ? 0 : 0.90, this.ctx.currentTime);
      this.footstepGain.gain.value = this.isMuted ? 0 : 0.90;
    }

    if (this.dragonGain && this.ctx) {
      this.dragonGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.dragonGain.gain.setValueAtTime(this.isMuted ? 0 : 0.85, this.ctx.currentTime);
      this.dragonGain.gain.value = this.isMuted ? 0 : 0.85;
    }

    // Pause/resume wind ambience with mute toggle
    if (this.isMuted) {
      this._fadeOutWind(false);
    } else if (this._windRunning) {
      if (!this._windSource) {
        this._launchWindLoop();
      } else {
        this._fadeInWind();
      }
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

  // =========================================================================
  // FOOTSTEP SOUNDS — Frame-synchronized with the 10-frame run cycle
  // Ground-contact frames: 0 and 5 (two strides per cycle, one per foot)
  // Synthesized as a layered thud: low body-mass impact + dry sandy crunch
  // =========================================================================

  /**
   * Play a single dinosaur footstep (or landing impact).
   * High-impact cartoon feel: solid body-mass stomp thud + crisp foot-slap pop + dry desert sand crunch.
   * Mastered loud and clear across all speaker types (laptops, phones, desktop monitors).
   * Frame-synchronized to visual run frames (frameIdx 0 = Left foot, frameIdx 5 = Right foot).
   *
   * @param {number} gameSpeed - current game speed (px/s)
   * @param {boolean} isRightFoot - whether this step is the right foot strike
   * @param {boolean} isLanding - whether this is a heavier touchdown impact after jumping
   */
  _playFootstep(gameSpeed, isRightFoot = false, isLanding = false) {
    if (this.isMuted) return;
    if (!this.ctx) this.unlockAudio();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const t = this.ctx.currentTime;
    const outNode = this.footstepGain || this.masterGain;

    // Scale volume mildly with speed: slightly more energetic at higher speeds
    const speedFactor = Math.min(1.20, 0.90 + Math.max(0, gameSpeed - 250) / 1000);

    // Natural alternating pitch differentiation between left and right foot for authentic galloping cadence
    let baseFreq, dropFreq, filterFreq, popStart, popEnd, crunchFreq;
    let thudGainVal, popGainVal, crunchGainVal;
    let thudDur, popDur, crunchDur;

    if (isLanding) {
      // Heavier landing touchdown impact
      baseFreq = 260;
      dropFreq = 65;
      filterFreq = 650;
      popStart = 780;
      popEnd = 140;
      crunchFreq = 1500;
      thudGainVal = 0.85 * speedFactor;
      popGainVal = 0.55 * speedFactor;
      crunchGainVal = 0.45 * speedFactor;
      thudDur = 0.14;
      popDur = 0.035;
      crunchDur = 0.09;
    } else {
      // Stride footsteps (Left vs Right)
      baseFreq = isRightFoot ? 245 : 215;
      dropFreq = isRightFoot ? 88 : 75;
      filterFreq = isRightFoot ? 620 : 540;
      popStart = isRightFoot ? 720 : 620;
      popEnd = isRightFoot ? 180 : 150;
      crunchFreq = isRightFoot ? 1550 : 1350;
      thudGainVal = 0.70 * speedFactor;
      popGainVal = 0.45 * speedFactor;
      crunchGainVal = 0.35 * speedFactor;
      thudDur = 0.095;
      popDur = 0.025;
      crunchDur = 0.075;
    }

    // --- Layer 1: Body Mass Stomp Thud (Triangle wave with rich harmonics) ---
    try {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(dropFreq, t + 0.065);

      // Instant percussive attack at t=0 for solid, grounded stomp presence
      oscGain.gain.setValueAtTime(thudGainVal, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + thudDur);

      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(filterFreq, t);
      lpf.Q.setValueAtTime(1.4, t); // resonant low-pass boosts punchy chest-thump frequencies

      osc.connect(lpf);
      lpf.connect(oscGain);
      oscGain.connect(outNode);
      osc.start(t);
      osc.stop(t + thudDur + 0.02);
    } catch (e) {}

    // --- Layer 2: Tactile Foot-Slap / Impact Transient (Snappy cartoon contact definition) ---
    try {
      const clickOsc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      clickOsc.type = 'sine';
      clickOsc.frequency.setValueAtTime(popStart, t);
      clickOsc.frequency.exponentialRampToValueAtTime(popEnd, t + 0.022);

      // Instant attack pop gives clear temporal sync to running frames
      clickGain.gain.setValueAtTime(popGainVal, t);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t + popDur);

      clickOsc.connect(clickGain);
      clickGain.connect(outNode);
      clickOsc.start(t);
      clickOsc.stop(t + popDur + 0.01);
    } catch (e) {}

    // --- Layer 3: Dry Desert Ground Contact Crunch (Crisp sand texture) ---
    try {
      if (!this.cachedNoiseBuffer) this.initNoiseBuffer();
      if (this.cachedNoiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.cachedNoiseBuffer;

        const bpf = this.ctx.createBiquadFilter();
        bpf.type = 'bandpass';
        bpf.frequency.setValueAtTime(crunchFreq, t);
        bpf.Q.setValueAtTime(1.2, t);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(crunchGainVal, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + crunchDur);

        noise.connect(bpf);
        bpf.connect(noiseGain);
        noiseGain.connect(outNode);
        noise.start(t);
        noise.stop(t + crunchDur + 0.01);
      }
    } catch (e) {}
  }

  /**
   * Called every game frame while PLAYING.
   * Computes the current animation frame index and fires footsteps on
   * ground-contact frame transitions only.
   *
   * @param {number} animTime  - dino.animTime (accumulated seconds)
   * @param {number} gameSpeed - current game speed (px/s)
   * @param {boolean} isGrounded - whether dino is on the ground
   * @param {boolean} isDucking - whether dino is ducking
   * @param {number} dt        - delta time for rustling accumulator
   */
  updateFootsteps(animTime, gameSpeed, isGrounded, isDucking, dt) {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    // Mid-air tracking: zero footsteps while airborne
    if (!isGrounded) {
      this._wasAirborne = true;
      this._lastRunFrame = -1;
      this._tickRustling(dt, gameSpeed);
      return;
    }

    // Dino just landed from a jump!
    if (this._wasAirborne) {
      this._wasAirborne = false;
      if (!this.isMuted && !isDucking) {
        this._playFootstep(gameSpeed, false, true); // Play solid touchdown impact
      }
    }

    // No running footsteps while ducking, muted, or without audio context
    if (isDucking || this.isMuted || !this.ctx) {
      this._lastRunFrame = -1;
      this._tickRustling(dt, gameSpeed);
      return;
    }

    // Mirror the exact run-frame calculation from sprites.js drawDino():
    const runFps = Math.min(24.0, 14.0 + Math.max(0, gameSpeed - 250) * 0.024);
    const frameIdx = Math.floor(animTime * runFps) % 10;

    // Fire footstep only on frame transition INTO a ground-contact frame (0 = Left foot, 5 = Right foot)
    if (frameIdx !== this._lastRunFrame) {
      if (this._footContactFrames.has(frameIdx)) {
        const isRightFoot = (frameIdx === 5);
        this._playFootstep(gameSpeed, isRightFoot, false);
      }
      this._lastRunFrame = frameIdx;
    }

    this._tickRustling(dt, gameSpeed);
  }

  /**
   * Reset footstep state (call on game start/restart).
   */
  resetFootsteps() {
    this._lastRunFrame = -1;
    this._wasAirborne = false;
    this._rustleAccum = 0;
    this._nextRustleDelay = 4 + Math.random() * 8;
  }

  // =========================================================================
  // WIND AMBIENCE — Continuous soft desert wind during active gameplay
  // Looped brown noise through a resonant low-pass filter + subtle LFO tremolo
  // =========================================================================

  /**
   * Start desert wind ambience. Safe to call multiple times — idempotent.
   */
  startAmbience() {
    this.unlockAudio();
    if (!this.ctx || this._windRunning) return;
    if (!this._windNoiseBuffer) this._buildWindNoiseBuffer();
    if (!this._windNoiseBuffer) return;

    this._windRunning = true;
    this._launchWindLoop();
  }

  _launchWindLoop() {
    if (!this.ctx) return;

    // Terminate any previous sources to prevent duplicate loops
    if (this._windSource) {
      try { this._windSource.stop(); } catch (e) {}
      this._windSource = null;
    }
    if (this._windLfo) {
      try { this._windLfo.stop(); } catch (e) {}
      this._windLfo = null;
    }

    try {
      // Source: looping brown noise
      const source = this.ctx.createBufferSource();
      source.buffer = this._windNoiseBuffer;
      source.loop = true;

      // Main low-pass shaping: keeps wind soft and airy (desert breeze, not storm)
      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(480, this.ctx.currentTime);
      lpf.Q.setValueAtTime(0.6, this.ctx.currentTime);

      // Secondary high-pass to remove sub-bass rumble
      const hpf = this.ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.setValueAtTime(60, this.ctx.currentTime);

      // Wind gain node (separate from masterGain so we can fade independently)
      const windGain = this.ctx.createGain();
      const targetVol = this.isMuted ? 0.0001 : 0.038;
      windGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      if (!this.isMuted) {
        windGain.gain.linearRampToValueAtTime(targetVol, this.ctx.currentTime + 1.2);
      }

      // Slow LFO for natural gusting variation (0.08 Hz — one swell every ~12s)
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.08, this.ctx.currentTime);
      lfoGain.gain.setValueAtTime(0.012, this.ctx.currentTime); // ±34% gain modulation depth

      lfo.connect(lfoGain);
      lfoGain.connect(windGain.gain);

      source.connect(lpf);
      lpf.connect(hpf);
      hpf.connect(windGain);
      windGain.connect(this.masterGain);

      lfo.start();
      source.start();

      this._windSource = source;
      this._windGain = windGain;
      this._windFilter = lpf;
      this._windLfo = lfo;
    } catch (e) {
      this._windRunning = false;
    }
  }

  /**
   * Stop wind ambience gracefully (fade out then disconnect).
   */
  stopAmbience() {
    this._windRunning = false;
    this._fadeOutWind(true);
    this._lastRunFrame = -1;
    this.stopDragonAudio();
  }

  _fadeOutWind(disconnect = false) {
    if (!this._windGain || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      this._windGain.gain.cancelScheduledValues(t);
      this._windGain.gain.setValueAtTime(this._windGain.gain.value, t);
      this._windGain.gain.linearRampToValueAtTime(0.0001, t + 0.8);

      if (disconnect) {
        const src = this._windSource;
        const lfo = this._windLfo;
        setTimeout(() => {
          try { src && src.stop(); } catch (e) {}
          try { lfo && lfo.stop(); } catch (e) {}
        }, 900);
        this._windSource = null;
        this._windGain = null;
        this._windLfo = null;
      }
    } catch (e) {}
  }

  _fadeInWind() {
    if (!this._windGain || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      this._windGain.gain.cancelScheduledValues(t);
      this._windGain.gain.setValueAtTime(this._windGain.gain.value, t);
      this._windGain.gain.linearRampToValueAtTime(0.038, t + 0.8);
    } catch (e) {}
  }

  // =========================================================================
  // DESERT RUSTLING — Occasional dry-leaf / sandy-breeze environmental sounds
  // Fires randomly every 4–12 seconds during active gameplay
  // =========================================================================

  _tickRustling(dt, gameSpeed) {
    if (!this.ctx || this.isMuted) return;
    this._rustleAccum += dt;
    if (this._rustleAccum >= this._nextRustleDelay) {
      this._rustleAccum = 0;
      this._nextRustleDelay = 4 + Math.random() * 8; // 4–12 seconds between rustles
      this._playDesertRustle(gameSpeed);
    }
  }

  /**
   * Short desert environmental sound: dry leaves / sandy breeze skitter.
   * Two alternating variants for variety.
   */
  _playDesertRustle(gameSpeed) {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Choose randomly between leaf-rustle and sand-skitter variant
    const variant = Math.random() < 0.5 ? 'rustle' : 'skitter';

    try {
      if (!this.cachedNoiseBuffer) this.initNoiseBuffer();
      if (!this.cachedNoiseBuffer) return;

      if (variant === 'rustle') {
        // Leaf rustle: band-passed noise, 800–3000 Hz, very short, 2 quick bursts
        const dur = 0.12 + Math.random() * 0.08;

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.cachedNoiseBuffer;

        const bpf = this.ctx.createBiquadFilter();
        bpf.type = 'bandpass';
        bpf.frequency.setValueAtTime(1800, t);
        bpf.Q.setValueAtTime(1.2, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.055, t + 0.015);
        gain.gain.setValueAtTime(0.055, t + dur * 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        noise.connect(bpf);
        bpf.connect(gain);
        gain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + dur + 0.02);

        // Second smaller burst slightly offset
        const noise2 = this.ctx.createBufferSource();
        noise2.buffer = this.cachedNoiseBuffer;
        const bpf2 = this.ctx.createBiquadFilter();
        bpf2.type = 'bandpass';
        bpf2.frequency.setValueAtTime(2200, t + dur * 0.6);
        bpf2.Q.setValueAtTime(1.5, t + dur * 0.6);
        const gain2 = this.ctx.createGain();
        gain2.gain.setValueAtTime(0.001, t + dur * 0.6);
        gain2.gain.linearRampToValueAtTime(0.03, t + dur * 0.7);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.06);
        noise2.connect(bpf2);
        bpf2.connect(gain2);
        gain2.connect(this.masterGain);
        noise2.start(t + dur * 0.6);
        noise2.stop(t + dur + 0.08);

      } else {
        // Sand skitter: very high-passed short hiss sweeping upward
        const dur = 0.18 + Math.random() * 0.1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.cachedNoiseBuffer;

        const hpf = this.ctx.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.frequency.setValueAtTime(3500, t);
        hpf.frequency.linearRampToValueAtTime(5500, t + dur);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.04, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        noise.connect(hpf);
        hpf.connect(gain);
        gain.connect(this.masterGain);
        noise.start(t);
        noise.stop(t + dur + 0.02);
      }
    } catch (e) {}
  }

  // =========================================================================
  // DRAGON WING-FLAPPING SOUNDS — Frame-synchronized with pterodactyl flight
  // Soft, natural cartoon-style wing beats: gentle air movement & airy whoosh.
  // Synchronized directly with obs.flapFrame (0 = wings up, 1 = wings down).
  // Dynamically panned and volume-scaled by screen position.
  // Stops cleanly when dragon leaves screen, game paused, or game over.
  // =========================================================================

  /**
   * Play a single dragon wing flap sound.
   * Soft, light, friendly cartoon wing beat (airy whoosh + gentle body displacement).
   *
   * @param {number} flapFrame - 0 (wings up) or 1 (wings down)
   * @param {number} screenX - obstacle x position
   * @param {number} viewW - current viewport width
   */
  _playWingFlap(flapFrame, screenX, viewW) {
    if (this.isMuted) return;
    if (!this.ctx) this.unlockAudio();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const t = this.ctx.currentTime;
    const isDownstroke = (flapFrame === 1);
    const outNode = this.dragonGain || this.masterGain;

    // 1. Proximity volume attenuation:
    // Dragon enters at right edge (screenX ~ viewW). Dino is at x = 90.
    // Starts clearly audible at entrance (~60%), swells smoothly to full volume as it closes in (screenX ~ 150..300),
    // and fades out gently as it flies off to the left (screenX < 40).
    let proximityFactor = 1.0;
    if (screenX > 90) {
      const distFromDino = screenX - 90;
      const maxDist = Math.max(120, viewW - 90);
      const normDist = Math.min(1.0, Math.max(0.0, distFromDino / maxDist));
      // Approaching from right: 0.60 at right edge, up to 1.0 near dinosaur
      proximityFactor = 0.60 + 0.40 * (1.0 - normDist);
    } else {
      // Exiting past dinosaur to the left: 1.0 at 90 down to 0.20 at -35
      const exitProgress = Math.min(1.0, Math.max(0.0, (90 - screenX) / 125));
      proximityFactor = Math.max(0.20, 1.0 - 0.80 * exitProgress);
    }

    // 2. Spatial stereo panning (if supported)
    let targetDest = outNode;
    if (this.ctx.createStereoPanner) {
      try {
        const panner = this.ctx.createStereoPanner();
        // Pan: +0.45 (right) when entering -> 0.0 (center) -> -0.45 (left) when exiting
        const halfW = (viewW || 1000) * 0.5;
        const panVal = Math.max(-0.55, Math.min(0.55, (screenX - halfW) / halfW * 0.55));
        panner.pan.setValueAtTime(panVal, t);
        panner.connect(outNode);
        targetDest = panner;
      } catch (e) {
        targetDest = outNode;
      }
    }

    // 3. Cadence tuning:
    // Downstroke (pushing down air): slightly fuller body and lower whoosh
    // Upstroke (raising wings back): lighter, softer whoosh
    const whooshStartFreq = isDownstroke ? 640 : 520;
    const whooshEndFreq = isDownstroke ? 240 : 290;
    const whooshGainVal = (isDownstroke ? 0.62 : 0.46) * proximityFactor;
    const whooshDur = isDownstroke ? 0.092 : 0.076;

    const bodyStartFreq = isDownstroke ? 135 : 115;
    const bodyEndFreq = isDownstroke ? 62 : 72;
    const bodyGainVal = (isDownstroke ? 0.40 : 0.28) * proximityFactor;
    const bodyDur = isDownstroke ? 0.068 : 0.054;

    // --- Layer 1: Airy Whoosh (gentle air displacement) ---
    try {
      if (!this.cachedNoiseBuffer) this.initNoiseBuffer();
      if (this.cachedNoiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.cachedNoiseBuffer;

        const bpf = this.ctx.createBiquadFilter();
        bpf.type = 'bandpass';
        bpf.frequency.setValueAtTime(whooshStartFreq, t);
        bpf.frequency.exponentialRampToValueAtTime(whooshEndFreq, t + whooshDur);
        bpf.Q.setValueAtTime(1.3, t);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.001, t);
        // Soft 12ms attack: smooth air movement, no clicks or harshness
        noiseGain.gain.linearRampToValueAtTime(whooshGainVal, t + 0.012);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + whooshDur);

        noise.connect(bpf);
        bpf.connect(noiseGain);
        noiseGain.connect(targetDest);

        noise.start(t);
        noise.stop(t + whooshDur + 0.01);
      }
    } catch (e) {}

    // --- Layer 2: Aerodynamic Body Displacement (light, gentle wing beat push) ---
    try {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(bodyStartFreq, t);
      osc.frequency.exponentialRampToValueAtTime(bodyEndFreq, t + bodyDur);

      oscGain.gain.setValueAtTime(0.001, t);
      oscGain.gain.linearRampToValueAtTime(bodyGainVal, t + 0.010);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + bodyDur);

      // Warm low-pass filter ensures soft cartoon feel without scary low rumbles
      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(260, t);
      lpf.Q.setValueAtTime(0.8, t);

      osc.connect(lpf);
      lpf.connect(oscGain);
      oscGain.connect(targetDest);

      osc.start(t);
      osc.stop(t + bodyDur + 0.01);
    } catch (e) {}
  }

  /**
   * Called every game frame while PLAYING.
   * Detects dragons entering, flying across, and leaving the screen,
   * firing wing flaps strictly on flap frame transitions.
   *
   * @param {Array} obstacles - array of active game obstacles
   * @param {number} viewW    - virtual canvas width
   * @param {number} dt       - delta time
   */
  updateDragonAudio(obstacles, viewW, dt) {
    if (!this.ctx || this.isMuted) return;

    if (!Array.isArray(obstacles) || obstacles.length === 0) {
      this._dragonAudioActive = false;
      return;
    }

    let hasDragonOnScreen = false;

    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      if (obs.type !== 'PTERODACTYL') continue;

      const obsWidth = obs.width || 60;
      // Active flight zone: begins as dragon crosses into view from the right (viewW)
      // and continues until it has flown completely off the left screen edge (obs.x + obsWidth > 0).
      const isInFlightZone = (obs.x <= viewW) && (obs.x + obsWidth > 0);

      if (isInFlightZone) {
        hasDragonOnScreen = true;
        if (typeof obs._lastFlapFrame === 'undefined') {
          obs._lastFlapFrame = -1;
        }

        // Fire sound on every wing flap frame transition (downstroke and upstroke)
        if (obs.flapFrame !== obs._lastFlapFrame) {
          obs._lastFlapFrame = obs.flapFrame;
          this._playWingFlap(obs.flapFrame, obs.x, viewW);
        }
      } else {
        // Off-screen: reset last frame so it cleanly triggers upon entry
        obs._lastFlapFrame = -1;
      }
    }

    this._dragonAudioActive = hasDragonOnScreen;
  }

  /**
   * Stop all dragon audio immediately.
   * Called on pause, game over, return to home, and mute.
   */
  stopDragonAudio() {
    this._dragonAudioActive = false;
    if (this.dragonGain && this.ctx) {
      try {
        const t = this.ctx.currentTime;
        this.dragonGain.gain.cancelScheduledValues(t);
        this.dragonGain.gain.setValueAtTime(0, t);
        // Restore unmuted baseline gain smoothly
        setTimeout(() => {
          if (this.dragonGain && this.ctx && !this.isMuted) {
            this.dragonGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
          }
        }, 60);
      } catch (e) {}
    }
  }
}

window.soundEngine = new SoundEffects();

