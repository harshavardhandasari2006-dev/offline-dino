/**
 * OFFLINE DINO - Core Game Engine
 * Manages game loop, physics, obstacle generation, collision detection, and day/night cycle.
 * Updated for Phase 2:
 * - Multi-cactus clusters strictly matching hitboxes (DINO-001)
 * - Fixed ducking baseline: zero ground penetration or floating (DINO-002)
 * - Ground-relative obstacle positioning on resize (DINO-004)
 * - Memory-only high-score tracking during gameplay, persistent at checkpoints (DINO-006)
 * - First-run high score fanfare threshold (DINO-008)
 * - Mid-air collision knockdown transition to ground (DINO-012)
 * - Removed phantom cloud simulation (DINO-013)
 * - Preserved authentic abrupt Day/Night transition (Section 30)
 */

class DinoGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Virtual game dimensions (retina scaled)
    this.baseWidth = 1000;
    this.baseHeight = 400;
    this.scale = 1;

    // Game states
    this.STATE_HOME = 'HOME';
    this.STATE_COUNTDOWN = 'COUNTDOWN';
    this.STATE_PLAYING = 'PLAYING';
    this.STATE_PAUSED = 'PAUSED';
    this.STATE_HIGHSCORE = 'HIGHSCORE';
    this.STATE_GAMEOVER = 'GAMEOVER';

    this.state = this.STATE_HOME;

    // Ground position
    this.groundY = 320;

    // Dinosaur physics & properties
    this.dino = {
      x: 90,
      y: 0,
      vy: 0,
      width: 58,
      height: 64,
      duckWidth: 78,
      duckHeight: 38,
      isGrounded: true,
      isDucking: false,
      isJumping: false,
      jumpPhase: 'IN_AIR', // TAKE_OFF, ASCENDING, IN_AIR, DESCENDING, LANDING
      takeOffTimer: 0,
      landingTimer: 0,
      duckDuration: 0,
      duckEndingTimer: 0,
      jumpVelocity: -600,
      gravity: 1750,
      fastDropMultiplier: 2.6,
      animTime: 0
    };

    // Dying mid-air transition state (DINO-012)
    this.isDyingMidAir = false;

    // World & Movement - Progressive Difficulty
    this.startSpeed = 260;
    this.maxSpeed = 780;
    this.speed = this.startSpeed;
    this.distance = 0;
    this.score = 0;
    this.milestoneStep = 100;
    this.nextMilestone = 100;
    this.hasCelebratedNewHigh = false;
    this.sessionInitialBest = 0;

    // Day/Night cinematic transition (2.0s duration)
    this.isNight = false;
    this.dayNightCycleLength = 1000;
    this.nightDuration = 280;
    this.nightProgress = 0.0; // 0.0 = full daytime, 1.0 = full nighttime
    this.nightTarget = 0.0;
    this.nightTransitionDuration = 2.0; // 2.0s cinematic transition

    // Obstacles
    this.obstacles = [];
    this.lastSpawnedObstacle = null;
    this.nextObstacleDistance = 380;

    // Statistics persistence (Graceful fallback if localStorage is blocked - ISSUE-07)
    this.storageAvailable = true;
    this.stats = {
      bestScore: 0,
      lastScore: 0,
      gamesPlayed: 0
    };
    this.loadStats();

    // Time tracking
    this.lastTime = performance.now();
    this.animFrameId = null;

    // Input state
    this.keys = {
      jump: false,
      duck: false
    };

    this.resetDino();
    this.setupWindowListeners();
  }

  // ==========================================
  // PERSISTENCE & STATS (DINO-006 & ISSUE-07 FIX)
  // In-memory during active gameplay; graceful fallback if blocked
  // ==========================================
  checkStorageAvailability() {
    try {
      const testKey = '__dino_storage_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  loadStats() {
    this.storageAvailable = this.checkStorageAvailability();
    if (this.storageAvailable) {
      try {
        this.stats.bestScore = parseInt(localStorage.getItem('offline_dino_best') || '0', 10);
        this.stats.lastScore = parseInt(localStorage.getItem('offline_dino_last') || '0', 10);
        this.stats.gamesPlayed = parseInt(localStorage.getItem('offline_dino_games_played') || '0', 10);
      } catch (e) {
        this.storageAvailable = false;
      }
    }
    if (!this.storageAvailable) {
      if (!this.stats) {
        this.stats = { bestScore: 0, lastScore: 0, gamesPlayed: 0 };
      }
    }
  }

  saveBestScore(newBest) {
    const intBest = Math.floor(newBest);
    if (intBest > this.stats.bestScore) {
      this.stats.bestScore = intBest;
      // In-memory update keeps HUD responsive without 60Hz storage spam (DINO-006)
    }
  }

  persistStats() {
    if (this.storageAvailable) {
      try {
        localStorage.setItem('offline_dino_best', this.stats.bestScore.toString());
        localStorage.setItem('offline_dino_last', this.stats.lastScore.toString());
        localStorage.setItem('offline_dino_games_played', this.stats.gamesPlayed.toString());
      } catch (e) {
        this.storageAvailable = false;
        if (window.uiManager) {
          window.uiManager.showStorageNoticeOnce();
        }
      }
    }
  }

  recordCompletedRun() {
    const finalScore = Math.floor(this.score);
    this.stats.lastScore = finalScore;
    this.stats.gamesPlayed += 1;
    if (finalScore > this.stats.bestScore) {
      this.stats.bestScore = finalScore;
    }
    this.persistStats();
  }

  // ==========================================
  // INITIALIZATION & RESIZING (DINO-002 & DINO-004 FIX)
  // ==========================================
  resetDino() {
    this.dino.y = this.groundY - this.dino.height;
    this.dino.vy = 0;
    this.dino.isGrounded = true;
    this.dino.isDucking = false;
    this.dino.isJumping = false;
    this.dino.jumpPhase = 'IN_AIR';
    this.dino.takeOffTimer = 0;
    this.dino.landingTimer = 0;
    this.dino.duckDuration = 0;
    this.dino.duckEndingTimer = 0;
    this.dino.animTime = 0;
    this.dino.jumpCount = 0;
    this.isDyingMidAir = false;
  }

  resetGame() {
    this.resetDino();
    this.speed = this.startSpeed;
    this.distance = 0;
    this.score = 0;
    this.nextMilestone = this.milestoneStep;
    this.sessionInitialBest = this.stats.bestScore; // Snapshot best at start of run (DINO-008)
    this.hasCelebratedNewHigh = false;
    this.obstacles = [];
    this.lastSpawnedObstacle = null;
    this.nextObstacleDistance = 380; // Safe initial runway
    this.isNight = false;
    this.nightProgress = 0.0;
    this.nightTarget = 0.0;
    this.keys.jump = false;
    this.keys.duck = false;
  }

  // Progressive speed curve (DIFF-01: smooth asymptotic progression avoiding sharp jumps)
  calculateSpeed(score) {
    const s = Math.max(0, score);
    // Smooth asymptotic progression from 250 px/s up to 680 px/s
    // Starts calm and gradual, accelerating smoothly without abrupt threshold bumps
    const progress = 1.0 - (1.0 / (1.0 + Math.pow(s / 680.0, 1.32)));
    return 250.0 + 430.0 * progress;
  }

  // Score-aware milestone schedule to reduce excessive chimes at high speeds (ISSUE-06)
  calculateNextMilestone(score) {
    if (score < 500) {
      return (Math.floor(score / 100) + 1) * 100;
    } else if (score < 1500) {
      return (Math.floor(score / 250) + 1) * 250;
    } else {
      return (Math.floor(score / 500) + 1) * 500;
    }
  }

  resize() {
    const container = document.getElementById('gameContainer');
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    this.canvas.width = cw * dpr;
    this.canvas.height = ch * dpr;
    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';

    const isPortrait = ch > cw;

    if (isPortrait) {
      // Responsive Portrait Framing (ISSUE-04):
      // Balance character size and runway: scale dynamically based on viewport width
      this.scale = Math.max(0.68, Math.min(0.95, cw / 480));
      const viewH = ch / this.scale;
      // Position ground comfortably at ~68% screen height so dinosaur is in lower third
      // with ample sky above for jump arcs & pterodactyls, and rich terrain below
      this.groundY = Math.round(viewH * 0.68);
    } else {
      // Landscape & Desktop: scale relative to standard 1000x400 virtual coordinates
      this.scale = Math.min(cw / this.baseWidth, ch / this.baseHeight);
      if (this.scale < 0.65) this.scale = 0.65;

      // Align ground to bottom with standard padding
      this.groundY = (ch / this.scale) - 68;
    }
    if (this.groundY < 240) this.groundY = 240;

    // Recalculate dinosaur baseline attached to ground (DINO-002)
    if (this.dino.isGrounded) {
      this.dino.y = this.groundY - this.dino.height;
    }

    // Recalculate ALL active obstacles relative to new groundY (DINO-004)
    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      const offset = (typeof obs.groundOffset === 'number') ? obs.groundOffset : -obs.height;
      obs.y = this.groundY + offset;
    }
  }

  setupWindowListeners() {
    window.addEventListener('resize', () => this.resize());

    // Auto-pause and recovery on tab change / minimize
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handleAutoPause();
      } else {
        this.handleAutoResume();
      }
    });

    window.addEventListener('blur', () => {
      this.handleAutoPause();
    });

    window.addEventListener('focus', () => {
      this.handleAutoResume();
    });

    window.addEventListener('beforeunload', () => {
      this.persistStats();
    });
  }

  handleAutoPause() {
    if (this.state === this.STATE_PLAYING || this.state === this.STATE_COUNTDOWN) {
      this.persistStats();
      this.state = this.STATE_PAUSED;
      if (window.uiManager) {
        window.uiManager.showAutoPauseOverlay();
      }
    }
  }

  handleAutoResume() {
    if (this.state === this.STATE_PAUSED && window.uiManager && window.uiManager.isAutoPaused) {
      window.uiManager.startRecoveryCountdown();
    }
  }

  // ==========================================
  // INPUT HANDLING (DINO-002 & DINO-003 SUPPORT)
  // ==========================================
  setJumpInput(isPressed) {
    this.keys.jump = isPressed;
    if (isPressed && this.state === this.STATE_PLAYING && !this.isDyingMidAir) {
      if (this.dino.isGrounded && !this.keys.duck) {
        this.triggerJump();
      }
    }
  }

  handleJumpPress() {
    this.setJumpInput(true);
  }

  handleJumpRelease() {
    this.setJumpInput(false);
  }

  triggerJump() {
    if (!this.dino.isGrounded || this.isDyingMidAir) return;

    this.dino.vy = this.dino.jumpVelocity;
    this.dino.isGrounded = false;
    this.dino.isJumping = true;
    this.dino.jumpPhase = 'TAKE_OFF';
    this.dino.takeOffTimer = 0.08;
    this.dino.jumpCount = (this.dino.jumpCount || 0) + 1;
    if (this.dino.isDucking) {
      this.dino.isDucking = false;
      this.dino.duckDuration = 0;
    }
    if (window.soundEngine) {
      window.soundEngine.playJump();
    }
  }

  // Consistent ground baseline reference: y never moves downward into terrain (DINO-002)
  handleDuckPress(isDucking) {
    if (this.state !== this.STATE_PLAYING || this.isDyingMidAir) return;

    this.keys.duck = isDucking;

    if (isDucking) {
      if (this.dino.isGrounded) {
        if (!this.dino.isDucking) {
          this.dino.isDucking = true;
          this.dino.duckDuration = 0;
          this.dino.duckEndingTimer = 0;
          if (window.soundEngine) {
            window.soundEngine.playDuck();
          }
        }
      } else {
        // Fast drop intent mid-air: cut off takeoff anticipation smoothly (ISSUE-02)
        this.dino.takeOffTimer = 0;
      }
    } else {
      if (this.dino.isDucking) {
        this.dino.isDucking = false;
        this.dino.duckDuration = 0;
        this.dino.duckEndingTimer = 0.12;
      }
    }
  }

  // ==========================================
  // SAFE OBSTACLE DISTANCE CALCULATION
  // Chrome Dino spacing philosophy:
  // Must account for player speed, jump airtime (0.76s), and human reaction time (>=0.54s).
  // Landing from a jump will NEVER immediately collide with the next obstacle.
  // Dynamic buffer accounts for fast flying dragons following cacti (ISSUE-03).
  // ==========================================
  calculateNextObstacleDistance(lastObs) {
    const obsWidth = lastObs ? lastObs.width : 40;
    const airTime = 0.69;
    const minReactionTime = 0.58; // Guarantees >= 0.56s fair reaction time (DIFF-02)
    const baseJumpDist = this.speed * airTime;
    const reactionDist = this.speed * minReactionTime;

    let minSafeGap = obsWidth + baseJumpDist + reactionDist + 60;

    if (lastObs) {
      if (lastObs.type === 'CACTUS_LARGE_TRIPLE' || lastObs.type === 'CACTUS_SMALL_TRIPLE') {
        minSafeGap += 95;
      } else if (lastObs.type === 'PTERODACTYL') {
        minSafeGap += 85;
      } else {
        // Preceding cactus with potential fast pterodactyl following (ISSUE-03):
        // Account for speed differential ((speed * 1.35 + 80) - speed) across visible runway
        const pteroFlightDiff = (this.speed * 1.35 + 80) - this.speed;
        const runwayTime = Math.min(1.8, (this.canvas.width / this.scale) / Math.max(1, this.speed));
        minSafeGap += Math.min(180, pteroFlightDiff * runwayTime * 0.35);
      }
    }

    const variableGap = Math.random() * (this.speed * 0.50 + 160);
    return minSafeGap + variableGap;
  }

  // ==========================================
  // OBSTACLE SPAWNING (DINO-001 & DINO-004 SUPPORT)
  // Stores relative groundOffset for robust resizing
  // ==========================================
  spawnObstacle() {
    const isPterodactylAllowed = this.score > 40;
    const isLargeCactusAllowed = this.score > 60;

    const rand = Math.random();
    let obstacle = null;

    const prevWasPtero = this.lastSpawnedObstacle && this.lastSpawnedObstacle.type === 'PTERODACTYL';
    const prevWasTriple = this.lastSpawnedObstacle && (this.lastSpawnedObstacle.type === 'CACTUS_LARGE_TRIPLE' || this.lastSpawnedObstacle.type === 'CACTUS_SMALL_TRIPLE');

    // Spawn Head-Level Flying Obstacle (Pterodactyl)
    if (isPterodactylAllowed && rand < 0.35 && !(prevWasPtero && this.score < 300)) {
      const groundOffset = -74; // Head-height flying obstacle (must duck to avoid!)
      const pHeightLabel = 'HEAD';

      obstacle = {
        type: 'PTERODACTYL',
        x: (this.canvas.width / this.scale) + 40,
        y: this.groundY + groundOffset,
        groundOffset: groundOffset,
        width: 60,
        height: 46,
        flapTimer: 0,
        flapFrame: 0,
        heightLabel: pHeightLabel
      };
      this.obstacles.push(obstacle);
      this.lastSpawnedObstacle = obstacle;
      return obstacle;
    }

    // Spawn Cactus
    let type = 'CACTUS_SMALL_SINGLE';
    if (isLargeCactusAllowed && rand < 0.68) {
      const variety = Math.random();
      if (variety < 0.48 || prevWasTriple) {
        type = 'CACTUS_LARGE_SINGLE';
      } else if (variety < 0.82) {
        type = 'CACTUS_LARGE_DOUBLE';
      } else {
        type = 'CACTUS_LARGE_TRIPLE';
      }
    } else {
      const variety = Math.random();
      if (variety < 0.48 || prevWasTriple) {
        type = 'CACTUS_SMALL_SINGLE';
      } else if (variety < 0.82) {
        type = 'CACTUS_SMALL_DOUBLE';
      } else {
        type = 'CACTUS_SMALL_TRIPLE';
      }
    }

    let w = 26;
    let h = 48;
    if (type === 'CACTUS_SMALL_DOUBLE') w = 48;
    else if (type === 'CACTUS_SMALL_TRIPLE') w = 68;
    else if (type === 'CACTUS_LARGE_SINGLE') { w = 32; h = 70; }
    else if (type === 'CACTUS_LARGE_DOUBLE') { w = 60; h = 70; }
    else if (type === 'CACTUS_LARGE_TRIPLE') { w = 88; h = 70; }

    obstacle = {
      type: type,
      x: (this.canvas.width / this.scale) + 40,
      y: this.groundY - h,
      groundOffset: -h,
      width: w,
      height: h
    };
    this.obstacles.push(obstacle);
    this.lastSpawnedObstacle = obstacle;
    return obstacle;
  }

  // ==========================================
  // FAIR & PRECISE COLLISION DETECTION (DINO-001 & DINO-002 FIX)
  // Collision boxes strictly bounded inside visible pixels
  // ==========================================
  checkCollisions() {
    const dino = this.dino;

    let dinoBoxes = [];
    if (dino.isDucking && dino.duckDuration >= 0.04) {
      // Ducking pose: lower, horizontal box anchored to ground baseline (DINO-002)
      // Visible top of dino_duck_3 is at y = 292
      const duckCollisionTop = dino.y + (dino.height - dino.duckHeight) + 8;
      dinoBoxes.push({
        x: dino.x + 8,
        y: duckCollisionTop,
        w: dino.duckWidth - 12,
        h: dino.duckHeight - 8
      });
    } else {
      // Standing/Running/Jumping pose: multi-box matching cartoon torso and head
      dinoBoxes.push({
        x: dino.x + 12,
        y: dino.y + 18,
        w: 32,
        h: 40
      });
      dinoBoxes.push({
        x: dino.x + 26,
        y: dino.y + 6,
        w: 28,
        h: 24
      });
    }

    const boxesOverlap = (b1, b2) => {
      return (
        b1.x < b2.x + b2.w &&
        b1.x + b1.w > b2.x &&
        b1.y < b2.y + b2.h &&
        b1.y + b1.h > b2.y
      );
    };

    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];

      let obsBox;
      if (obs.type === 'PTERODACTYL') {
        // Synchronized with visible 60x46 sprite at head height (y=246..292)
        // Hitbox covers body & wings at y in [254..288]
        obsBox = {
          x: obs.x + 6,
          y: obs.y + 8,
          w: obs.width - 12,
          h: obs.height - 12
        };
      } else {
        // Multi-cactus cluster collision: strictly covers visible cacti with 4px margin (DINO-001)
        obsBox = {
          x: obs.x + 4,
          y: obs.y + 4,
          w: obs.width - 8,
          h: obs.height - 4
        };
      }

      for (let j = 0; j < dinoBoxes.length; j++) {
        if (boxesOverlap(dinoBoxes[j], obsBox)) {
          return true;
        }
      }
    }

    return false;
  }

  // ==========================================
  // MAIN UPDATE LOOP
  // ==========================================
  update(dt) {
    // Complete freeze during Pause and standard Game Over
    if (this.state === this.STATE_PAUSED || (this.state === this.STATE_GAMEOVER && !this.isDyingMidAir)) {
      return;
    }

    // Mid-air Dying knockdown transition (DINO-012)
    if (this.isDyingMidAir) {
      this.dino.vy += 2200 * dt;
      this.dino.y += this.dino.vy * dt;
      const groundTarget = this.groundY - this.dino.height;
      if (this.dino.y >= groundTarget) {
        this.dino.y = groundTarget;
        this.dino.vy = 0;
        this.dino.isGrounded = true;
        this.isDyingMidAir = false;
        this.completeGameOver();
      }
      return;
    }

    if (this.state !== this.STATE_PLAYING) {
      if (window.spriteRenderer) {
        window.spriteRenderer.update(dt);
      }
      this.dino.animTime += dt;
      return;
    }

    if (window.spriteRenderer) {
      window.spriteRenderer.update(dt);
    }

    // Smooth progressive speed progression based on score
    this.speed = this.calculateSpeed(this.score);

    // Score & Distance progression
    const moveDist = this.speed * dt;
    this.distance += moveDist;
    this.score += dt * (this.speed * 0.024);

    // Milestone sound (score-aware schedule: 100 pts below 500, 250 pts below 1500, 500 pts above - ISSUE-06)
    if (this.score >= this.nextMilestone) {
      if (window.soundEngine) {
        window.soundEngine.playMilestone();
      }
      this.nextMilestone = this.calculateNextMilestone(this.score);
      this.persistStats();
    }

    // High Score beat check in real time (DINO-006 & DINO-008 FIX)
    if (this.score > this.stats.bestScore) {
      this.saveBestScore(this.score);
      // Celebrate ONLY if player beats an actual meaningful prior best score (>= 20 points)
      // and only ONCE per run (DINO-008)
      if (!this.hasCelebratedNewHigh && this.sessionInitialBest >= 20 && this.score > this.sessionInitialBest) {
        this.hasCelebratedNewHigh = true;
        if (window.soundEngine) {
          window.soundEngine.playNewHighScore();
        }
        if (window.uiManager) {
          window.uiManager.showNewHighScoreBanner();
        }
      }
    }

    // Day / Night cycle trigger (Preserved score thresholds)
    const cyclePos = Math.floor(this.score) % this.dayNightCycleLength;
    const shouldBeNight = (cyclePos >= 720 && cyclePos < (720 + this.nightDuration));
    this.nightTarget = shouldBeNight ? 1.0 : 0.0;

    // Smooth frame-rate-independent 2.0-second cinematic transition
    if (this.nightProgress !== this.nightTarget) {
      const step = dt / this.nightTransitionDuration;
      if (this.nightProgress < this.nightTarget) {
        this.nightProgress = Math.min(this.nightTarget, this.nightProgress + step);
      } else {
        this.nightProgress = Math.max(this.nightTarget, this.nightProgress - step);
      }
    }
    this.isNight = this.nightProgress >= 0.5;

    // Dino Physics & Jump Phase Sequence
    this.dino.animTime += dt;

    if (this.dino.isDucking) {
      this.dino.duckDuration += dt;
    }
    if (this.dino.duckEndingTimer > 0) {
      this.dino.duckEndingTimer -= dt;
    }

    if (!this.dino.isGrounded) {
      const grav = this.keys.duck ? (this.dino.gravity * this.dino.fastDropMultiplier) : this.dino.gravity;
      this.dino.vy += grav * dt;
      this.dino.y += this.dino.vy * dt;

      // Keep dinosaur fully on screen: safety ceiling clamp (Issue 5)
      if (this.dino.y < 18) {
        this.dino.y = 18;
        if (this.dino.vy < 0) this.dino.vy = 0;
      }

      // Classify 5 jump phases smoothly without freeze during fast-drop (ISSUE-02):
      if (this.keys.duck && this.dino.takeOffTimer > 0) {
        this.dino.takeOffTimer = 0;
      }

      if (this.dino.takeOffTimer > 0 && !this.keys.duck && this.dino.vy < 0) {
        this.dino.takeOffTimer -= dt;
        this.dino.jumpPhase = 'TAKE_OFF';
      } else if (this.dino.vy < -150) {
        this.dino.jumpPhase = 'ASCENDING';
      } else if (Math.abs(this.dino.vy) <= 150) {
        this.dino.jumpPhase = 'IN_AIR';
      } else {
        this.dino.jumpPhase = 'DESCENDING';
      }

      // Ground landing: anchor strictly to groundY - dino.height (DINO-002)
      const groundTarget = this.groundY - this.dino.height;
      if (this.dino.y >= groundTarget) {
        this.dino.y = groundTarget;
        this.dino.vy = 0;
        this.dino.isGrounded = true;
        this.dino.isJumping = false;
        this.dino.jumpPhase = 'LANDING';
        this.dino.landingTimer = 0.12;

        if (this.keys.duck) {
          this.dino.isDucking = true;
          this.dino.duckDuration = 0;
        } else if (this.keys.jump) {
          this.triggerJump();
        }
      }
    } else {
      if (this.dino.landingTimer > 0) {
        this.dino.landingTimer -= dt;
        if (this.dino.landingTimer <= 0) {
          this.dino.jumpPhase = 'IN_AIR';
        }
      }

      // Grounded ducking state management without changing dino.y (DINO-002)
      if (this.keys.duck && !this.dino.isDucking) {
        this.dino.isDucking = true;
        this.dino.duckDuration = 0;
        this.dino.duckEndingTimer = 0;
      } else if (!this.keys.duck && this.dino.isDucking) {
        this.dino.isDucking = false;
        this.dino.duckDuration = 0;
        this.dino.duckEndingTimer = 0.12;
      }
    }

    // Update Obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];

      if (obs.type === 'PTERODACTYL') {
        // Flying obstacle actively flies toward player (ground speed + active flight velocity)
        let pteroFlightSpeed = this.speed * 1.35 + 80;

        // In-flight minimum separation rule (ISSUE-03):
        // Prevent dragon from bunching into a preceding obstacle closer than minimum reaction distance
        let precedingObstacle = null;
        for (let j = 0; j < this.obstacles.length; j++) {
          if (j !== i) {
            const other = this.obstacles[j];
            if (other.x < obs.x && (!precedingObstacle || other.x > precedingObstacle.x)) {
              precedingObstacle = other;
            }
          }
        }

        if (precedingObstacle) {
          const gap = obs.x - (precedingObstacle.x + (precedingObstacle.width || 40));
          const minSafeBuffer = Math.max(220, this.speed * 0.55);
          if (gap < minSafeBuffer) {
            // Match ground speed so dragon never overlaps or bunches into preceding cactus
            pteroFlightSpeed = this.speed;
          }
        }

        obs.x -= pteroFlightSpeed * dt;

        // Smooth synchronized wing flapping (Wings Up <-> Wings Down)
        obs.flapTimer += dt;
        if (obs.flapTimer >= 0.14) {
          obs.flapTimer = 0;
          obs.flapFrame = obs.flapFrame === 0 ? 1 : 0;
        }
      } else {
        // Ground cacti move at ground scrolling speed
        obs.x -= moveDist;
      }

      if (obs.x + (obs.width || 60) < -70) {
        this.obstacles.splice(i, 1);
      }
    }

    // Spawn Obstacle check with safe spacing
    this.nextObstacleDistance -= moveDist;
    if (this.nextObstacleDistance <= 0) {
      const spawned = this.spawnObstacle();
      this.nextObstacleDistance = this.calculateNextObstacleDistance(spawned);
    }

    // Check Collision
    if (this.checkCollisions()) {
      this.handleGameOver();
    }
  }

  // ==========================================
  // GAME OVER & MID-AIR TRANSITION (DINO-012 FIX)
  // When airborne: natural fall to ground before settling into dead pose
  // ==========================================
  handleGameOver() {
    this.keys.jump = false;
    this.keys.duck = false;

    if (window.soundEngine) {
      window.soundEngine.playHit();
    }

    if (!this.dino.isGrounded) {
      // Mid-air collision: initiate knockdown arc toward ground
      this.isDyingMidAir = true;
      this.dino.vy = Math.max(120, this.dino.vy * 0.5); // Initial downward momentum
    } else {
      this.completeGameOver();
    }
  }

  completeGameOver() {
    this.state = this.STATE_GAMEOVER;
    this.isDyingMidAir = false;
    this.dino.isGrounded = true;
    this.dino.y = this.groundY - this.dino.height;
    this.recordCompletedRun();

    if (window.uiManager) {
      window.uiManager.showGameOver(Math.floor(this.score), this.stats.bestScore);
    }
  }

  // ==========================================
  // RENDERING (Style 1 Friendly Classic Environment)
  // ==========================================
  render() {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    // Clear entire canvas to prevent ghosting or previous frame remnants
    ctx.clearRect(0, 0, cw, ch);

    ctx.save();
    ctx.scale(this.scale, this.scale);

    const viewW = cw / this.scale;
    const viewH = ch / this.scale;

    // Compute smooth cubic ease-in/ease-out transition progress (2.0s duration)
    const t = this.nightProgress;
    const easedNight = t <= 0 ? 0 : (t >= 1 ? 1 : (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2));

    // 1. SKY & BACKGROUND PANORAMA (Smooth cinematic day-to-night crossfade)
    const scrollDist = (this.state === this.STATE_PLAYING || this.state === this.STATE_COUNTDOWN) ? this.distance : 0;
    if (window.spriteRenderer) {
      window.spriteRenderer.drawBackground(ctx, scrollDist, viewW, this.groundY, easedNight);
    }

    // 2. GROUND & DESERT TERRAIN (Smooth color gradient interpolation)
    if (window.spriteRenderer) {
      window.spriteRenderer.drawGround(ctx, scrollDist, viewW, viewH, this.groundY, easedNight);
    }

    // 3. OBSTACLES (Multi-body cactus clusters & pterosaurs) (DINO-001)
    if (window.spriteRenderer && (this.state === this.STATE_PLAYING || this.state === this.STATE_COUNTDOWN || this.state === this.STATE_PAUSED || this.state === this.STATE_GAMEOVER)) {
      for (let i = 0; i < this.obstacles.length; i++) {
        const obs = this.obstacles[i];
        if (obs.type === 'PTERODACTYL') {
          window.spriteRenderer.drawPterodactyl(ctx, obs.x, obs.y, obs.flapFrame, easedNight);
        } else {
          window.spriteRenderer.drawCactus(ctx, obs.x, obs.y, obs.width, obs.height, obs.type, easedNight);
        }
      }
    }

    // 4. GAMEPLAY DINOSAUR (Style 1 Friendly Classic Mascot)
    if (window.spriteRenderer && (this.state === this.STATE_PLAYING || this.state === this.STATE_COUNTDOWN || this.state === this.STATE_PAUSED || this.state === this.STATE_GAMEOVER)) {
      let dinoVisualState = 'IDLE';
      if (this.isDyingMidAir) {
        dinoVisualState = 'HIT'; // Stumbling impact pose falling to ground (DINO-012)
      } else if (this.state === this.STATE_GAMEOVER) {
        dinoVisualState = 'DEAD'; // Standardized 128x112 dead pose flat on belly
      } else if (!this.dino.isGrounded || this.dino.landingTimer > 0) {
        // Airborne jump poses and landing compression take precedence
        dinoVisualState = 'JUMPING';
      } else if (this.dino.isDucking || this.dino.duckEndingTimer > 0) {
        // Active ducking crawl and smooth rise recovery
        dinoVisualState = 'DUCKING';
      } else if (this.state === this.STATE_PLAYING || this.state === this.STATE_COUNTDOWN) {
        dinoVisualState = 'RUNNING';
      }

      window.spriteRenderer.drawDino(
        ctx,
        this.dino.x,
        this.dino.y,
        dinoVisualState,
        this.dino.animTime,
        this.isNight,
        this.dino.isGrounded,
        this.dino.jumpPhase,
        this.dino.duckDuration,
        this.dino.duckEndingTimer > 0,
        this.speed,
        this.dino.landingTimer,
        this.dino.vy,
        this.dino.takeOffTimer,
        this.dino.duckEndingTimer
      );
    }

    ctx.restore();
  }

  // ==========================================
  // GAME LOOP
  // ==========================================
  startLoop() {
    this.lastTime = performance.now();
    const loop = (now) => {
      let dt = (now - this.lastTime) / 1000;
      this.lastTime = now;

      if (dt > 0.05) dt = 0.05;

      this.update(dt);
      this.render();

      if (window.uiManager && (this.state === this.STATE_PLAYING || this.state === this.STATE_COUNTDOWN)) {
        window.uiManager.updateHUD(Math.floor(this.score), this.stats.bestScore);
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.animFrameId = requestAnimationFrame(loop);
  }
}

window.dinoGame = new DinoGame();
