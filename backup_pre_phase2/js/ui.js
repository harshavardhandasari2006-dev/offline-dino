/**
 * OFFLINE DINO - UI & Screen Manager
 * Manages menus, HUD, countdown animations, modals, fullscreen, and touch gestures.
 * Updated for Phase 2:
 * - Immediate mobile touch jump on touchstart with no tap-hold discarding (DINO-003)
 * - Cancellable countdown state machine preventing background timer leaks (DINO-005)
 * - Home mascot RAF lifecycle: strictly runs ONLY while on Home screen (DINO-009)
 * - Restrict fullscreen requests to mobile/touch; never force on desktop (DINO-014)
 * - Keyboard support: Escape closes modals, Enter confirms primary actions (DINO-015)
 * - High-DPI devicePixelRatio aware mascot canvas with preserved CSS size (DINO-016)
 * - Removed duplicate legacy service worker unregistration (DINO-017)
 * - Styled Exit dialog fallback with graceful messaging (Section 23)
 */

class UIManager {
  constructor() {
    this.game = window.dinoGame;
    this.sound = window.soundEngine;

    // DOM Elements
    this.homeScreen = document.getElementById('homeScreen');
    this.gameplayHUD = document.getElementById('gameplayHUD');
    this.pauseModal = document.getElementById('pauseModal');
    this.gameOverModal = document.getElementById('gameOverModal');
    this.highScoreModal = document.getElementById('highScoreModal');
    this.exitModal = document.getElementById('exitModal');
    this.countdownOverlay = document.getElementById('countdownOverlay');
    this.countdownText = document.getElementById('countdownText');
    this.newHighScoreBanner = document.getElementById('newHighScoreBanner');

    // HUD items
    this.hudScore = document.getElementById('hudScore');
    this.hudHighScore = document.getElementById('hudHighScore');
    this.btnPause = document.getElementById('btnPause');

    // Home buttons (Settings completely removed)
    this.btnStartGame = document.getElementById('btnStartGame');
    this.btnHomeHighScore = document.getElementById('btnHomeHighScore');
    this.btnHomeSound = document.getElementById('btnHomeSound');
    this.btnHomeExit = document.getElementById('btnHomeExit');
    this.homeSoundIcon = document.getElementById('homeSoundIcon');
    this.homeSoundLabel = document.getElementById('homeSoundLabel');
    this.btnExitOk = document.getElementById('btnExitOk');

    // Pause Modal buttons (Resume, Restart)
    this.btnPauseResume = document.getElementById('btnPauseResume');
    this.btnPauseRestart = document.getElementById('btnPauseRestart');

    // Game Over buttons & labels (Play Again)
    this.btnPlayAgain = document.getElementById('btnPlayAgain');
    this.gameOverRunScore = document.getElementById('gameOverRunScore');
    this.gameOverBestScore = document.getElementById('gameOverBestScore');

    // High Score Modal items
    this.hsBestScore = document.getElementById('hsBestScore');
    this.hsLastScore = document.getElementById('hsLastScore');
    this.hsGamesPlayed = document.getElementById('hsGamesPlayed');
    this.btnHighScoreBack = document.getElementById('btnHighScoreBack');

    // Home mascot canvas (Retina scaled) (DINO-016)
    this.mascotCanvas = document.getElementById('mascotCanvas');
    this.mascotCtx = this.mascotCanvas ? this.mascotCanvas.getContext('2d') : null;
    this.mascotAnimTime = 0;
    this.mascotRafId = null; // Controlled loop handle (DINO-009)
    this.initMascotCanvasResolution();

    // State helpers
    this.isAutoPaused = false;
    this.countdownTimer = null;
    this.bannerTimeout = null;

    // Touch gesture state (DINO-003)
    this.touchStartY = 0;
    this.touchStartX = 0;
    this.touchStartTime = 0;
    this.isSwipingDown = false;

    this.bindEvents();
    this.updateSoundButtons();
    this.startMascotAnimation();
  }

  // High-DPI resolution setup for mascot canvas (DINO-016)
  initMascotCanvasResolution() {
    if (!this.mascotCanvas || !this.mascotCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cssW = 220;
    const cssH = 170;

    this.mascotCanvas.width = Math.round(cssW * dpr);
    this.mascotCanvas.height = Math.round(cssH * dpr);
    this.mascotCanvas.style.width = cssW + 'px';
    this.mascotCanvas.style.height = cssH + 'px';

    this.mascotCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.mascotCtx.scale(dpr, dpr);
  }

  // ==========================================
  // EVENT BINDINGS
  // ==========================================
  bindEvents() {
    // START GAME
    this.btnStartGame.addEventListener('click', () => {
      this.sound.playClick();
      this.sound.unlockAudio();
      this.requestGameFullscreen();
      this.stopMascotAnimation(); // Stop mascot RAF during gameplay (DINO-009)
      this.startNewGameSequence();
    });

    // HOME: High Score
    this.btnHomeHighScore.addEventListener('click', () => {
      this.sound.playClick();
      this.stopMascotAnimation();
      this.openHighScore();
    });

    // HOME: Sound Toggle
    this.btnHomeSound.addEventListener('click', () => {
      this.sound.playClick();
      this.sound.toggleMute();
      this.updateSoundButtons();
    });

    // HOME: Exit Button (Section 23)
    if (this.btnHomeExit) {
      this.btnHomeExit.addEventListener('click', () => {
        this.sound.playClick();
        try {
          window.close();
        } catch (e) {}

        // Fallback dialog when browser blocks window.close()
        setTimeout(() => {
          this.showModal(this.exitModal);
        }, 120);
      });
    }

    if (this.btnExitOk) {
      this.btnExitOk.addEventListener('click', () => {
        this.sound.playClick();
        this.hideModal(this.exitModal);
      });
    }

    // PAUSE: Pause Button (HUD)
    this.btnPause.addEventListener('click', () => {
      this.sound.playClick();
      this.pauseGame();
    });

    // PAUSE: Resume Button
    this.btnPauseResume.addEventListener('click', () => {
      this.sound.playClick();
      this.resumeGame();
    });

    // PAUSE: Restart Button
    this.btnPauseRestart.addEventListener('click', () => {
      this.sound.playClick();
      this.hideModal(this.pauseModal);
      this.startNewGameSequence();
    });

    // GAME OVER: Play Again
    this.btnPlayAgain.addEventListener('click', () => {
      this.sound.playClick();
      this.hideModal(this.gameOverModal);
      this.startNewGameSequence();
    });

    // HIGH SCORE: Back Button
    this.btnHighScoreBack.addEventListener('click', () => {
      this.sound.playClick();
      this.hideModal(this.highScoreModal);
      this.showScreen(this.homeScreen);
      this.game.state = this.game.STATE_HOME;
      this.startMascotAnimation();
    });

    // KEYBOARD CONTROLS (DINO-015: Escape & Enter support)
    window.addEventListener('keydown', (e) => {
      // Escape handler: Modal dismissal / Pause
      if (e.code === 'Escape') {
        if (!e.repeat) {
          if (!this.exitModal.classList.contains('hidden')) {
            e.preventDefault();
            this.btnExitOk.click();
            return;
          }
          if (!this.highScoreModal.classList.contains('hidden')) {
            e.preventDefault();
            this.btnHighScoreBack.click();
            return;
          }
          if (!this.pauseModal.classList.contains('hidden')) {
            e.preventDefault();
            this.resumeGame();
            return;
          }
          if (this.game.state === this.game.STATE_PLAYING) {
            e.preventDefault();
            this.pauseGame();
            return;
          }
        }
      }

      // Enter handler: Confirm primary focused action
      if (e.code === 'Enter') {
        if (!this.exitModal.classList.contains('hidden')) {
          e.preventDefault();
          this.btnExitOk.click();
          return;
        }
        if (!this.highScoreModal.classList.contains('hidden')) {
          e.preventDefault();
          this.btnHighScoreBack.click();
          return;
        }
        if (!this.gameOverModal.classList.contains('hidden')) {
          e.preventDefault();
          this.btnPlayAgain.click();
          return;
        }
      }

      // Space or ArrowUp / W = Jump
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        if (this.game.state === this.game.STATE_PLAYING) {
          e.preventDefault();
          this.game.setJumpInput(true);
        } else if (this.game.state === this.game.STATE_HOME) {
          if (!e.repeat) {
            e.preventDefault();
            this.btnStartGame.click();
          }
        } else if (this.game.state === this.game.STATE_GAMEOVER) {
          if (!e.repeat) {
            e.preventDefault();
            this.btnPlayAgain.click();
          }
        }
      }

      // ArrowDown / S = Duck / Fast Drop
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        if (this.game.state === this.game.STATE_PLAYING) {
          e.preventDefault();
          this.game.handleDuckPress(true);
        }
      }

      // P = Pause / Resume toggle
      if (e.code === 'KeyP') {
        if (!e.repeat) {
          if (this.game.state === this.game.STATE_PLAYING) {
            e.preventDefault();
            this.pauseGame();
          } else if (this.game.state === this.game.STATE_PAUSED) {
            e.preventDefault();
            this.resumeGame();
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      // Space or ArrowUp / W = Jump release
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        this.game.setJumpInput(false);
      }

      // ArrowDown / S = Duck release
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        if (this.game.state === this.game.STATE_PLAYING) {
          this.game.handleDuckPress(false);
        }
      }
    });

    // TOUCH CONTROLS (DINO-003: Immediate jump on touchstart, no 380ms tap discarding)
    const gameArea = document.getElementById('gameContainer');

    gameArea.addEventListener('touchstart', (e) => {
      this.sound.unlockAudio();

      if (this.game.state === this.game.STATE_PLAYING) {
        if (e.cancelable) e.preventDefault();
      }

      if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchStartTime = performance.now();
        this.isSwipingDown = false;

        // Immediately trigger jump intent on touchstart (DINO-003)
        if (this.game.state === this.game.STATE_PLAYING) {
          this.game.setJumpInput(true);
        }
      }
    }, { passive: false });

    gameArea.addEventListener('touchmove', (e) => {
      if (this.game.state !== this.game.STATE_PLAYING) return;
      if (e.cancelable) e.preventDefault();

      if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        const deltaY = touch.clientY - this.touchStartY;
        // Detect downward swipe gesture
        if (deltaY > 35 && !this.isSwipingDown) {
          this.isSwipingDown = true;
          this.game.setJumpInput(false);
          this.game.handleDuckPress(true);
        }
      }
    }, { passive: false });

    const handleTouchEnd = (e) => {
      if (this.game.state !== this.game.STATE_PLAYING) return;
      if (e.cancelable) e.preventDefault();

      if (this.isSwipingDown) {
        this.isSwipingDown = false;
        this.game.handleDuckPress(false);
      }

      // Release jump state on touch end (supports long taps and short taps alike)
      this.game.setJumpInput(false);
    };

    gameArea.addEventListener('touchend', handleTouchEnd, { passive: false });
    gameArea.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    // Window resize observer for mascot canvas DPR
    window.addEventListener('resize', () => {
      this.initMascotCanvasResolution();
    });
  }

  // ==========================================
  // FULLSCREEN HANDLER (DINO-014 FIX)
  // Only requests fullscreen on touch/mobile devices; never on desktop
  // ==========================================
  requestGameFullscreen() {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (!isTouchDevice) return; // Do not aggressively force fullscreen on desktop

    try {
      const elem = document.documentElement;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (elem.requestFullscreen) {
          elem.requestFullscreen().catch(() => {});
        } else if (elem.webkitRequestFullscreen) {
          elem.webkitRequestFullscreen().catch(() => {});
        }
      }
    } catch (e) {}
  }

  // ==========================================
  // SCREEN & MODAL MANAGEMENT
  // ==========================================
  showScreen(el) {
    if (el) el.classList.remove('hidden');
  }

  hideScreen(el) {
    if (el) el.classList.add('hidden');
  }

  showModal(el) {
    if (el) el.classList.remove('hidden');
  }

  hideModal(el) {
    if (el) el.classList.add('hidden');
  }

  // ==========================================
  // COUNTDOWN SEQUENCES (DINO-005 FIX)
  // Safely cancellable without leaking timer callbacks when hidden/paused
  // ==========================================
  cancelCountdown() {
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.countdownOverlay) {
      this.countdownOverlay.classList.add('hidden');
    }
  }

  runCountdown(onComplete) {
    this.cancelCountdown();
    this.game.state = this.game.STATE_COUNTDOWN;
    this.countdownOverlay.classList.remove('hidden');

    const steps = ['3', '2', '1', 'GO!'];
    let stepIndex = 0;

    const showNext = () => {
      // Guard against stale callback if game state was paused or cancelled
      if (this.game.state !== this.game.STATE_COUNTDOWN) {
        this.cancelCountdown();
        return;
      }

      if (stepIndex >= steps.length) {
        this.countdownOverlay.classList.add('hidden');
        this.countdownTimer = null;
        if (onComplete && this.game.state === this.game.STATE_COUNTDOWN) {
          onComplete();
        }
        return;
      }

      const text = steps[stepIndex];
      this.countdownText.textContent = text;
      this.sound.playCountdown(text === 'GO!' ? 'GO' : parseInt(text, 10));

      this.countdownText.classList.remove('countdown-pop');
      void this.countdownText.offsetWidth; // Force reflow
      this.countdownText.classList.add('countdown-pop');

      stepIndex++;
      this.countdownTimer = setTimeout(showNext, stepIndex === steps.length ? 500 : 700);
    };

    showNext();
  }

  startNewGameSequence() {
    this.cancelCountdown();
    this.hideScreen(this.homeScreen);
    this.hideModal(this.pauseModal);
    this.hideModal(this.gameOverModal);
    this.hideModal(this.highScoreModal);
    this.hideModal(this.exitModal);
    this.showScreen(this.gameplayHUD);

    this.game.resetGame();
    this.updateHUD(0, this.game.stats.bestScore);

    this.runCountdown(() => {
      this.game.lastTime = performance.now();
      this.game.state = this.game.STATE_PLAYING;
    });
  }

  // ==========================================
  // PAUSE & RESUME (DINO-005 SAFE HANDLING)
  // ==========================================
  pauseGame() {
    if (this.game.state !== this.game.STATE_PLAYING) return;
    this.cancelCountdown();
    this.game.setJumpInput(false);
    this.game.handleDuckPress(false);
    this.game.state = this.game.STATE_PAUSED;
    this.showModal(this.pauseModal);
  }

  resumeGame() {
    this.isAutoPaused = false;
    this.cancelCountdown();
    this.hideModal(this.pauseModal);
    this.game.lastTime = performance.now();
    this.game.state = this.game.STATE_PLAYING;
  }

  showAutoPauseOverlay() {
    this.isAutoPaused = true;
    this.cancelCountdown();
    this.game.setJumpInput(false);
    this.game.handleDuckPress(false);
    this.showModal(this.pauseModal);
  }

  startRecoveryCountdown() {
    if (!this.isAutoPaused) return;
    this.isAutoPaused = false;
    this.hideModal(this.pauseModal);

    this.runCountdown(() => {
      this.game.lastTime = performance.now();
      this.game.state = this.game.STATE_PLAYING;
    });
  }

  // ==========================================
  // GAME OVER SCREEN
  // ==========================================
  showGameOver(runScore, bestScore) {
    this.gameOverRunScore.textContent = this.formatScore(runScore);
    this.gameOverBestScore.textContent = this.formatScore(bestScore);
    this.showModal(this.gameOverModal);
  }

  // ==========================================
  // HIGH SCORE SCREEN
  // ==========================================
  openHighScore() {
    this.game.state = this.game.STATE_HIGHSCORE;
    this.hideScreen(this.homeScreen);
    this.hsBestScore.textContent = this.formatScore(this.game.stats.bestScore);
    this.hsLastScore.textContent = this.formatScore(this.game.stats.lastScore);
    this.hsGamesPlayed.textContent = this.game.stats.gamesPlayed.toString();
    this.showModal(this.highScoreModal);
  }

  // Direct Sound control
  updateSoundButtons() {
    const isMuted = this.sound.isMuted;
    if (this.homeSoundIcon) {
      this.homeSoundIcon.textContent = isMuted ? '🔇' : '🔊';
    }
    if (this.homeSoundLabel) {
      this.homeSoundLabel.textContent = isMuted ? 'Sound: OFF' : 'Sound: ON';
    }
  }

  // ==========================================
  // HUD & CELEBRATION BANNER
  // ==========================================
  formatScore(n) {
    return Math.floor(n).toString().padStart(5, '0');
  }

  updateHUD(score, best) {
    this.hudScore.textContent = this.formatScore(score);
    this.hudHighScore.textContent = 'HI ' + this.formatScore(best);
  }

  showNewHighScoreBanner() {
    this.newHighScoreBanner.classList.remove('hidden');
    this.newHighScoreBanner.classList.remove('banner-pop');
    void this.newHighScoreBanner.offsetWidth;
    this.newHighScoreBanner.classList.add('banner-pop');

    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => {
      this.newHighScoreBanner.classList.add('hidden');
    }, 2800);
  }

  // ==========================================
  // HOME MASCOT RUNNING ANIMATION (DINO-009 FIX)
  // Strictly runs ONLY when on Home screen; cancelled during active gameplay
  // ==========================================
  startMascotAnimation() {
    if (!this.mascotCanvas || !this.mascotCtx) return;
    if (this.mascotRafId) return; // Prevent multiple concurrent RAF loops

    let lastMascotTime = performance.now();
    const animateMascot = (currentTime) => {
      if (this.game.state !== this.game.STATE_HOME) {
        this.mascotRafId = null;
        return;
      }

      const now = currentTime || performance.now();
      const dt = Math.min((now - lastMascotTime) / 1000, 0.1);
      lastMascotTime = now;

      this.mascotAnimTime += dt;
      const ctx = this.mascotCtx;
      const cssW = 220;
      const cssH = 170;

      ctx.clearRect(0, 0, cssW, cssH);

      if (window.spriteRenderer) {
        window.spriteRenderer.drawMascot(ctx, cssW / 2, cssH / 2, 140, this.mascotAnimTime);
      }

      this.mascotRafId = requestAnimationFrame(animateMascot);
    };

    this.mascotRafId = requestAnimationFrame(animateMascot);
  }

  stopMascotAnimation() {
    if (this.mascotRafId) {
      cancelAnimationFrame(this.mascotRafId);
      this.mascotRafId = null;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.uiManager = new UIManager();
  window.dinoGame.resize();
  window.dinoGame.startLoop();
});
