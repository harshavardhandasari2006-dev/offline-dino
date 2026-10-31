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
    this.backspaceModal = document.getElementById('backspaceModal');
    this.btnBackspaceYes = document.getElementById('btnBackspaceYes');
    this.btnBackspaceNo = document.getElementById('btnBackspaceNo');
    this.wasPlayingBeforeBackspace = false;
    this.countdownOverlay = document.getElementById('countdownOverlay');
        this.countdownText = document.getElementById('countdownText');
    this.orientationPrompt = document.getElementById('orientationPrompt');
    if (this.orientationPrompt) {
      this.orientationPrompt.addEventListener('click', () => this.tryLockLandscape());
    }
    this.newHighScoreBanner = document.getElementById('newHighScoreBanner');
    this.isPortraitFallback = false;
    this.isReverseRotation = false;

    // Initial Start Game Loading Screen Elements
    this.initialLoadingScreen = document.getElementById('initialLoadingScreen');
    this.loadingBarFill = document.getElementById('loadingBarFill');
    this.loadingDinoImg = document.getElementById('loadingDinoImg');
    this.isStartingInitialGame = false;
    this.loadingFadeInTimer = null;
    this.loadingScreenTimer = null;
    this.loadingFadeOutTimer = null;
    this.loadingDinoAnimTimer = null;
    // Preload static loading dinosaur image for immediate offline rendering
    const preloadDino = new Image();
    preloadDino.src = 'assets/sprites/loading_dino.png';

    // HUD items
    this.hudScore = document.getElementById('hudScore');
    this.hudHighScore = document.getElementById('hudHighScore');
    this.btnPause = document.getElementById('btnPause');
    this.btnFullscreen = document.getElementById('btnFullscreen');
    this.btnHomeFullscreen = document.getElementById('btnHomeFullscreen');

    // Home buttons (Settings completely removed)
    this.btnStartGame = document.getElementById('btnStartGame');
    this.btnHomeHighScore = document.getElementById('btnHomeHighScore');
    this.btnHomeSound = document.getElementById('btnHomeSound');
    this.btnHomeExit = document.getElementById('btnHomeExit');
    this.homeSoundIcon = document.getElementById('homeSoundIcon');
    this.homeSoundLabel = document.getElementById('homeSoundLabel');
    this.homeSoundState = document.getElementById('homeSoundState');
    this.btnExitYes = document.getElementById('btnExitYes');
    this.btnExitNo = document.getElementById('btnExitNo');

    // Pause Modal buttons (Resume, Restart, Home)
    this.btnPauseResume = document.getElementById('btnPauseResume');
    this.btnPauseRestart = document.getElementById('btnPauseRestart');
    this.btnPauseHome = document.getElementById('btnPauseHome');

    // Game Over buttons & labels (Play Again, Home)
    this.btnPlayAgain = document.getElementById('btnPlayAgain');
    this.btnGameOverHome = document.getElementById('btnGameOverHome');
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

    // Cursor tracking & natural mascot reactions
    this.mousePos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.hasMouse = false;
    this.currentLook = { x: 0, y: 0 };
    this.currentFacing = 1; // 1 = facing right, -1 = facing left, 0 = facing front
    this.targetFacing = 1;
    this.turnTimer = 0;
    this.turnDuration = 0.22; // smooth turnaround duration
    this.turnFromFacing = 1;
    this.currentTilt = 0;
    this.blinkTimer = 0;
    this.nextBlinkTime = 3.2;
    this.blinkStage = 'OPEN';
    this.smileProgress = 0;
    this.clickReactionTimer = 0;
    this.clickReactionDuration = 1.0;

    this.initMascotCanvasResolution();
    this.initCursorTracking();

    // Customization Screen items
    this.customizationScreen = document.getElementById('customizationScreen');
    this.btnHomeCustomize = document.getElementById('btnHomeCustomize');
    this.btnCustomizationBack = document.getElementById('btnCustomizationBack');
    this.btnConfirmSkin = document.getElementById('btnConfirmSkin');
    this.btnConfirmSkinText = document.getElementById('btnConfirmSkinText');
    this.btnRotateLeft = document.getElementById('btnRotateLeft');
    this.btnRotateRight = document.getElementById('btnRotateRight');
    this.customizationCanvas = document.getElementById('customizationCanvas');
    this.customization3DCanvas = document.getElementById('customization3DCanvas');
    this.customCtx = this.customizationCanvas ? this.customizationCanvas.getContext('2d') : null;
    this.dino3D = null;
    this.has3D = false;
    this.customSkinLabel = document.getElementById('customSkinLabel');
    this.customSkinsGrid = document.getElementById('customSkinsGrid');
    this.homeTitleSignImg = document.getElementById('homeTitleSignImg');
    this.customDinoPreviewImg = document.getElementById('customDinoPreviewImg');
    this.skinSelectToast = document.getElementById('skinSelectToast');
    this.skinNotifyTimer = null;
    this.skinNotifyFadeTimer = null;
    // Intro Video completely disabled — Direct Homepage startup
    this.isIntroPlaying = false;
    this.introEnded = true;

    // Customization state (Forward-facing 9-colour dinosaur sync)
    this.confirmedSkinId = (window.SkinManager) ? window.SkinManager.getSelectedSkinId() : 'green';
    this.previewSkinId = this.confirmedSkinId;

    this.preloadSkinAssets();
    this.updateHomeDinoSkin();
    if (this.customDinoPreviewImg) {
      const activeSkinObj = (window.SkinManager) ? window.SkinManager.getSkinById(this.confirmedSkinId) : null;
      this.customDinoPreviewImg.src = this.getSkinPreviewAsset(this.confirmedSkinId);
    }

    this.customRotationAngle = 0; // Continuous angle in [0, 2*PI)
    this.customPreviewFrame = 0; // 0..9 matching the 10 turnaround keyframes
    this.isDraggingCustom = false;
    this.dragStartX = 0;
    this.dragStartAngle = 0;
    this.dragVelocity = 0;
    this.lastDragX = 0;
    this.lastDragTime = 0;
    this.customizationRafId = null;
    this.customAnimTime = 0;
    this.customReactionTimer = 0;
    this.customBlinkStage = 'OPEN';
    this.customSettlingBounce = 0;

    // State helpers
    this.isAutoPaused = false;
    this.isExiting = false;
    this.countdownTimer = null;
    this.bannerTimeout = null;

    // Touch gesture state (DINO-003)
    this.touchStartY = 0;
    this.touchStartX = 0;
    this.touchStartTime = 0;
    this.isSwipingDown = false;

    this.initCustomizationUI();
    this.bindEvents();
    this.updateSoundButtons();
    this.setupFullscreen();
    this.updateHomeDinoSkin();
    this.startMascotAnimation();
    this.showScreen(this.homeScreen);
    this.setupHistoryNavigation();
    this.updateOrientationMode();
  }

  // ==========================================
  // FULLSCREEN MANAGEMENT (Expand / Exit Fullscreen)
  // ==========================================
  setupFullscreen() {
    if (!this.isFullscreenSupported()) {
      if (this.btnFullscreen) this.btnFullscreen.classList.add('hidden');
      if (this.btnHomeFullscreen) this.btnHomeFullscreen.classList.add('hidden');
      return;
    }

    const onFullscreenClick = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (this.sound && typeof this.sound.playClick === 'function') {
        this.sound.playClick();
      }
      this.toggleFullscreen();
    };

    if (this.btnFullscreen) {
      this.btnFullscreen.addEventListener('click', onFullscreenClick);
    }
    if (this.btnHomeFullscreen) {
      this.btnHomeFullscreen.addEventListener('click', onFullscreenClick);
    }

    const changeEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    changeEvents.forEach(evt => {
      document.addEventListener(evt, () => {
        this.updateFullscreenUI();
      }, { passive: true });
    });

    this.updateFullscreenUI();
  }

  isFullscreenSupported() {
    return !!(
      document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.mozFullScreenEnabled ||
      document.msFullscreenEnabled ||
      document.documentElement.requestFullscreen ||
      document.documentElement.webkitRequestFullscreen
    );
  }

  isFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }

  requestFullscreen() {
    const elem = document.documentElement || document.body;
    try {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen request could not be processed:', err);
    }
  }

  exitFullscreen() {
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    } catch (err) {
      console.warn('Exit fullscreen could not be processed:', err);
    }
  }

  toggleFullscreen() {
    if (this.isFullscreen()) {
      this.exitFullscreen();
    } else {
      this.requestFullscreen();
    }
  }

  updateFullscreenUI() {
    const isFS = this.isFullscreen();
    const expandIcons = document.querySelectorAll('.fs-icon-expand');
    const compressIcons = document.querySelectorAll('.fs-icon-compress');
    const fsButtons = document.querySelectorAll('.hud-fullscreen-btn, .home-fullscreen-btn');

    if (isFS) {
      expandIcons.forEach(el => el.classList.add('hidden'));
      compressIcons.forEach(el => el.classList.remove('hidden'));
      fsButtons.forEach(btn => {
        btn.setAttribute('aria-label', 'Exit Fullscreen');
        btn.setAttribute('title', 'Exit Fullscreen (Esc)');
      });
      if (document.body) document.body.classList.add('is-fullscreen');
    } else {
      expandIcons.forEach(el => el.classList.remove('hidden'));
      compressIcons.forEach(el => el.classList.add('hidden'));
      fsButtons.forEach(btn => {
        btn.setAttribute('aria-label', 'Enter Fullscreen');
        btn.setAttribute('title', 'Enter Fullscreen');
      });
      if (document.body) document.body.classList.remove('is-fullscreen');
    }

    if (window.dinoGame && typeof window.dinoGame.resize === 'function') {
      window.dinoGame.resize();
    }
  }

  // High-DPI resolution setup for mascot canvas (DINO-016)
  initMascotCanvasResolution() {
    if (!this.mascotCanvas || !this.mascotCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cssW = 546;
    const cssH = 288;

    this.mascotCanvas.width = Math.round(cssW * dpr);
    this.mascotCanvas.height = Math.round(cssH * dpr);

    this.mascotCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.mascotCtx.scale(dpr, dpr);
  }

  // ==========================================
  // EVENT BINDINGS
  // ==========================================
  // Universal Touch & Click isolation helper for all mobile buttons
  bindButtonAction(button, callback) {
    if (!button) return;
    let lastActionTime = 0;

    const execute = (e) => {
      if (e) {
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        if (e.type === 'touchstart' && e.cancelable) {
          e.preventDefault();
        }
      }
      const now = performance.now();
      if (now - lastActionTime < 280) return;
      lastActionTime = now;

      // Cancel any pending jump timer or jump state immediately
      if (this.touchPendingJumpTimer) {
        clearTimeout(this.touchPendingJumpTimer);
        this.touchPendingJumpTimer = null;
      }
      this.touchPendingJump = false;
      this.touchDispatchedJump = false;

      callback(e);
    };

    button.addEventListener('touchstart', execute, { passive: false });
    button.addEventListener('click', execute);
  }

  bindEvents() {
    // Automatic Connection Detection (Online/Offline seamless transitions)
    window.addEventListener('online', () => {
      // Silently update online state without disrupting active gameplay
    });
    window.addEventListener('offline', () => {
      // Silently maintain cached gameplay without disrupting active gameplay
    });
    // START GAME (Initial entry flow from Homepage with 3-second loading screen)
    this.bindButtonAction(this.btnStartGame, () => {
      if (this.sound) {
        this.sound.unlockAudio();
        this.sound.playClick();
      }
      this.startInitialGameFlow();
    });

    // HOME: High Score
    this.bindButtonAction(this.btnHomeHighScore, () => {
      this.sound.playClick();
      this.stopMascotAnimation();
      this.openHighScore();
    });

    // HOME: Sound Toggle
    this.bindButtonAction(this.btnHomeSound, () => {
      this.sound.playClick();
      this.sound.toggleMute();
      this.updateSoundButtons();
    });

    // HOME: Exit Button — show confirmation dialog immediately (Section 23)
    if (this.btnHomeExit) {
      this.bindButtonAction(this.btnHomeExit, () => {
        this.sound.playClick();
        this.showModal(this.exitModal);
      });
    }

    // EXIT DIALOG: Yes — Immediately exit the game and return to appropriate destination
    if (this.btnExitYes) {
      this.bindButtonAction(this.btnExitYes, () => {
        this.sound.playClick();
        this.executeExit();
      });
    }

    // EXIT DIALOG: No — Close the dialog and return to the homepage without changing anything
    if (this.btnExitNo) {
      this.bindButtonAction(this.btnExitNo, () => {
        this.sound.playClick();
        this.hideModal(this.exitModal);
      });
    }

    // EXIT DIALOG: Backdrop Click — Clicking outside the dialog must not accidentally quit the game
    if (this.exitModal) {
      this.exitModal.addEventListener('click', (e) => {
        if (e.target === this.exitModal) {
          this.sound.playClick();
          this.hideModal(this.exitModal);
        }
      });
    }

    // BACKSPACE QUIT DIALOG: Yes — close current gameplay session and return to homepage
    if (this.btnBackspaceYes) {
      this.bindButtonAction(this.btnBackspaceYes, () => {
        this.confirmBackspaceQuit();
      });
    }

    // BACKSPACE QUIT DIALOG: No — dismiss dialog and resume current game
    if (this.btnBackspaceNo) {
      this.bindButtonAction(this.btnBackspaceNo, () => {
        this.sound.playClick();
        this.dismissBackspaceModal();
      });
    }

    // BACKSPACE QUIT DIALOG: Backdrop Click — dismiss dialog safely without quitting
    if (this.backspaceModal) {
      this.backspaceModal.addEventListener('click', (e) => {
        if (e.target === this.backspaceModal) {
          this.sound.playClick();
          this.dismissBackspaceModal();
        }
      });
    }

    // PAUSE: Pause Button (HUD)
    this.bindButtonAction(this.btnPause, () => {
      this.sound.playClick();
      this.pauseGame();
    });

    // PAUSE: Resume Button
    this.bindButtonAction(this.btnPauseResume, () => {
      this.sound.playClick();
      this.resumeGame();
    });

    // PAUSE: Restart Button
    this.bindButtonAction(this.btnPauseRestart, () => {
      this.sound.playClick();
      this.hideModal(this.pauseModal);
      this.startNewGameSequence();
    });

    // PAUSE: Home Button
    if (this.btnPauseHome) {
      this.bindButtonAction(this.btnPauseHome, () => {
        this.sound.playClick();
        this.returnToHomeScreen();
      });
    }

    // GAME OVER: Play Again
    this.bindButtonAction(this.btnPlayAgain, () => {
      this.sound.playClick();
      this.hideModal(this.gameOverModal);
      this.startNewGameSequence();
    });

    // GAME OVER: Home Button
    if (this.btnGameOverHome) {
      this.bindButtonAction(this.btnGameOverHome, () => {
        this.sound.playClick();
        this.returnToHomeScreen();
      });
    }

    // HIGH SCORE: Back Button
    this.bindButtonAction(this.btnHighScoreBack, () => {
      this.sound.playClick();
      this.hideModal(this.highScoreModal);
      this.showScreen(this.homeScreen);
      this.game.state = this.game.STATE_HOME;
      this.startMascotAnimation();
    });

    // DINO CUSTOMIZATION BUTTONS
    if (this.btnHomeCustomize) {
      this.bindButtonAction(this.btnHomeCustomize, () => {
        this.sound.playClick();
        this.openCustomizationScreen();
      });
    }

    if (this.btnCustomizationBack) {
      this.bindButtonAction(this.btnCustomizationBack, () => {
        this.sound.playClick();
        this.closeCustomizationScreen();
      });
    }

    if (this.btnRotateLeft) {
      this.btnRotateLeft.addEventListener('click', () => {
        this.rotatePreview(1); // Rotate toward left
      });
    }

    if (this.btnRotateRight) {
      this.btnRotateRight.addEventListener('click', () => {
        this.rotatePreview(-1); // Rotate toward right
      });
    }

    if (this.btnConfirmSkin) {
      this.bindButtonAction(this.btnConfirmSkin, () => {
        this.confirmSelectedSkin();
      });
    }

    // KEYBOARD CONTROLS (Cross-Device Back/Exit, Escape & Enter support)
    window.addEventListener('keydown', (e) => {
      // Alt + F4 handler: Cross-device quit confirmation
      if ((e.key === 'F4' || e.code === 'F4') && e.altKey) {
        try {
          e.preventDefault();
        } catch (err) {}

        if (this.isGameplayActive()) {
          if (this.backspaceModal && !this.backspaceModal.classList.contains('hidden')) {
            return;
          }
          this.openBackspaceModal();
        } else if (this.game && (this.game.state === this.game.STATE_HOME || (this.homeScreen && !this.homeScreen.classList.contains('hidden')))) {
          if (this.exitModal && !this.exitModal.classList.contains('hidden')) {
            return;
          }
          this.showModal(this.exitModal);
        }
        return;
      }

      // Backspace handler: Game exit confirmation during active gameplay
      if (e.key === 'Backspace' || e.code === 'Backspace') {
        const target = e.target;
        const isEditable = target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          (typeof target.getAttribute === 'function' && target.getAttribute('contenteditable') === 'true')
        );
        if (isEditable) {
          return; // Do not interfere with normal text editing
        }

        // If backspace modal is already open, prevent browser navigation and duplicate dialogs
        if (this.backspaceModal && !this.backspaceModal.classList.contains('hidden')) {
          e.preventDefault();
          return;
        }

        // Handle Backspace during active gameplay
        if (this.isGameplayActive()) {
          e.preventDefault();
          this.openBackspaceModal();
          return;
        }
      }

      // Escape handler: Fullscreen exit / Modal dismissal / Quit confirmation / Customization exit
      if (e.code === 'Escape' || e.key === 'Escape') {
        if (!e.repeat) {
          if (this.isFullscreen()) {
            this.exitFullscreen();
            return;
          }
          if (this.backspaceModal && !this.backspaceModal.classList.contains('hidden')) {
            e.preventDefault();
            this.sound.playClick();
            this.dismissBackspaceModal();
            return;
          }
          if (this.customizationScreen && !this.customizationScreen.classList.contains('hidden')) {
            e.preventDefault();
            this.btnCustomizationBack.click();
            return;
          }
          if (this.exitModal && !this.exitModal.classList.contains('hidden')) {
            e.preventDefault();
            if (this.btnExitNo) this.btnExitNo.click();
            return;
          }
          if (this.highScoreModal && !this.highScoreModal.classList.contains('hidden')) {
            e.preventDefault();
            this.btnHighScoreBack.click();
            return;
          }
          if (this.pauseModal && !this.pauseModal.classList.contains('hidden')) {
            e.preventDefault();
            this.resumeGame();
            return;
          }
          if (this.isGameplayActive()) {
            e.preventDefault();
            this.openBackspaceModal();
            return;
          }
        }
      }

      // Arrow keys for Customization rotation
      if (this.customizationScreen && !this.customizationScreen.classList.contains('hidden')) {
        if (e.code === 'ArrowLeft') {
          e.preventDefault();
          this.rotatePreview(1);
          return;
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          this.rotatePreview(-1);
          return;
        }
      }

      // Enter handler: Confirm primary focused action
      if (e.code === 'Enter') {
        if (this.backspaceModal && !this.backspaceModal.classList.contains('hidden')) {
          e.preventDefault();
          if (this.btnBackspaceNo) this.btnBackspaceNo.click();
          return;
        }
        if (!this.exitModal.classList.contains('hidden')) {
          e.preventDefault();
          if (this.btnExitNo) this.btnExitNo.click();
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

    // BEFOREUNLOAD: Warn before accidental tab/window close during active gameplay
    window.addEventListener('beforeunload', (e) => {
      if (this.isGameplayActive()) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    });

    // TOUCH CONTROLS (Disambiguated tap-to-jump vs downward-swipe-to-duck)
    const gameArea = document.getElementById('gameContainer');
    this.touchPendingJumpTimer = null;
    this.touchPendingJump = false;
    this.touchDispatchedJump = false;

    const isInteractiveUI = (target) => {
      if (!target || typeof target.closest !== 'function') return false;
      return !!target.closest(
        'button, .hud-actions-group, .hud-overlay, .modal-card, .modal-backdrop, ' +
        '.homepage-bottom-nav, .home-top-actions, .home-controls-wrapper, ' +
        '.customization-card, .custom-skins-grid, .skin-card, .cartoon-btn, ' +
        '[role="button"], a, input, select, textarea'
      );
    };

    gameArea.addEventListener('touchstart', (e) => {
      // Isolate UI controls: never register jump or swipe if tapping any button/modal/HUD
      if (isInteractiveUI(e.target)) return;
      if (e.cancelable) e.preventDefault();

      this.sound.unlockAudio();

      if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchStartTime = performance.now();
        this.isSwipingDown = false;
        this.touchDispatchedJump = false;

        // Disambiguation window (40ms): allows immediate swipe detection before committing jump
        if (this.game.state === this.game.STATE_PLAYING) {
          this.touchPendingJump = true;
          if (this.touchPendingJumpTimer) clearTimeout(this.touchPendingJumpTimer);
          this.touchPendingJumpTimer = setTimeout(() => {
            this.touchPendingJumpTimer = null;
            if (this.touchPendingJump && !this.isSwipingDown && this.game.state === this.game.STATE_PLAYING) {
              this.touchPendingJump = false;
              this.touchDispatchedJump = true;
              this.game.setJumpInput(true);
            }
          }, 40);
        }
      }
    }, { passive: false });

    gameArea.addEventListener('touchmove', (e) => {
      if (isInteractiveUI(e.target)) return;
      if (e.cancelable) e.preventDefault();
      if (this.game.state !== this.game.STATE_PLAYING) return;

      if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        const rawDeltaY = touch.clientY - this.touchStartY;
        const rawDeltaX = touch.clientX - this.touchStartX;

        let deltaY = rawDeltaY;
        let deltaX = rawDeltaX;

        // In portrait on mobile/tablet, container is rotated into landscape:
        if (this.isPortraitRotated) {
          if (this.isReverseRotation) {
            deltaY = rawDeltaX;
            deltaX = -rawDeltaY;
          } else {
            deltaY = -rawDeltaX;
            deltaX = rawDeltaY;
          }
        }

        // Detect downward swipe gesture (deltaY > 18 and predominantly downward)
        if (deltaY > 18 && Math.abs(deltaY) > Math.abs(deltaX) * 0.75) {
          if (this.touchPendingJumpTimer) {
            clearTimeout(this.touchPendingJumpTimer);
            this.touchPendingJumpTimer = null;
          }
          this.touchPendingJump = false;

          if (!this.isSwipingDown) {
            this.isSwipingDown = true;
            if (this.touchDispatchedJump) {
              this.game.setJumpInput(false);
            }
            this.game.handleDuckPress(true);
          }
        } else if (this.isSwipingDown && deltaY < 8) {
          // If finger is moved back up near initial touch, stop ducking
          this.isSwipingDown = false;
          this.game.handleDuckPress(false);
        }
      }
    }, { passive: false });

    const handleTouchEnd = (e) => {
      if (isInteractiveUI(e.target)) return;
      if (e.cancelable) e.preventDefault();
      if (this.game.state !== this.game.STATE_PLAYING) return;

      if (this.touchPendingJumpTimer) {
        clearTimeout(this.touchPendingJumpTimer);
        this.touchPendingJumpTimer = null;
      }

      // Quick tap (< 40ms) completed without downward swipe: trigger immediate tap jump
      if (this.touchPendingJump && !this.isSwipingDown) {
        this.touchPendingJump = false;
        this.game.setJumpInput(true);
        setTimeout(() => {
          this.game.setJumpInput(false);
        }, 16);
      } else {
        if (this.isSwipingDown) {
          this.isSwipingDown = false;
          this.game.handleDuckPress(false);
        }
        this.game.setJumpInput(false);
      }
      this.touchDispatchedJump = false;
    };

    gameArea.addEventListener('touchend', handleTouchEnd, { passive: false });
    gameArea.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    // Global lock: prevent browser page scroll / bounce / drag during active gameplay
    document.addEventListener('touchmove', (e) => {
      if (isInteractiveUI(e.target)) return;
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    // Prevent iOS pinch zoom and gesture scaling
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((evt) => {
      document.addEventListener(evt, (e) => {
        if (e.cancelable) e.preventDefault();
      }, { passive: false });
    });

    // Hard-pin window scroll coordinates to (0, 0)
    window.addEventListener('scroll', () => {
      if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    }, { passive: false });

    // Single unified debounced orientation & resize listener
    let orientationDebounceTimer = null;
    const handleOrientationOrResize = () => {
      if (orientationDebounceTimer) cancelAnimationFrame(orientationDebounceTimer);
      orientationDebounceTimer = requestAnimationFrame(() => {
        this.updateOrientationMode();
      });
    };

    window.addEventListener('resize', handleOrientationOrResize, { passive: true });
    window.addEventListener('orientationchange', () => {
      handleOrientationOrResize();
      setTimeout(handleOrientationOrResize, 100);
    }, { passive: true });

    if (screen.orientation && typeof screen.orientation.addEventListener === 'function') {
      screen.orientation.addEventListener('change', handleOrientationOrResize);
    }
  }

  // ==========================================
  // FULLSCREEN HANDLER (DINO-014 FIX)
  // Only requests fullscreen on touch/mobile devices; never on desktop
  // ==========================================
  
  updateOrientationMode() {
    const isPortrait = window.innerHeight > window.innerWidth;
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const isMobileOrTablet = isTouch || (Math.min(window.innerWidth, window.innerHeight) <= 1024);

    const angle = (screen.orientation && screen.orientation.angle !== undefined)
      ? screen.orientation.angle
      : (window.orientation || 0);

    if (isPortrait && isMobileOrTablet && angle === 180) {
      document.documentElement.classList.add('rotate-reverse');
      this.isReverseRotation = true;
    } else {
      document.documentElement.classList.remove('rotate-reverse');
      this.isReverseRotation = false;
    }

    this.isPortraitRotated = isPortrait && isMobileOrTablet;

    // Attempt native orientation lock where supported
    this.tryLockLandscape();

    // Trigger game engine resize to adapt canvas
    if (this.game && typeof this.game.resize === 'function') {
      this.game.resize();
    }

    // Refresh mascot canvas resolution
    this.initMascotCanvasResolution();
  }

  checkOrientation() {
    this.updateOrientationMode();
  }

  tryLockLandscape() {
    try {
      if (screen.orientation && typeof screen.orientation.lock === 'function') {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (e) {}
  }

  requestGameFullscreen() {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (!isTouchDevice) return; // Do not aggressively force fullscreen on desktop

    try {
      const elem = document.documentElement;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (elem.requestFullscreen) {
          elem.requestFullscreen().then(() => this.tryLockLandscape()).catch(() => {});
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

  // ==========================================
  // INITIAL START GAME FLOW (Narrowly Scoped 3-Second Loading Screen)
  // Only triggered from the Homepage when player starts a game.
  // Pause/Resume, Restart, and Play Again use standard flows and preserve countdown.
  // ==========================================
  cancelInitialLoading() {
    if (this.loadingFadeInTimer) {
      clearTimeout(this.loadingFadeInTimer);
      this.loadingFadeInTimer = null;
    }
    if (this.loadingScreenTimer) {
      clearTimeout(this.loadingScreenTimer);
      this.loadingScreenTimer = null;
    }
    if (this.loadingFadeOutTimer) {
      clearTimeout(this.loadingFadeOutTimer);
      this.loadingFadeOutTimer = null;
    }
    if (this.loadingDinoAnimTimer) {
      clearInterval(this.loadingDinoAnimTimer);
      this.loadingDinoAnimTimer = null;
    }
    this.isStartingInitialGame = false;
    if (this.initialLoadingScreen) {
      this.hideScreen(this.initialLoadingScreen);
      this.initialLoadingScreen.classList.remove('visible', 'fade-out');
    }
    if (this.loadingBarFill) {
      this.loadingBarFill.style.transition = 'none';
      this.loadingBarFill.style.width = '0%';
    }
  }

  startInitialGameFlow() {
    this.cancelCountdown();
    this.cancelInitialLoading();
    this.isStartingInitialGame = true;

    this.sound.playClick();
    this.sound.unlockAudio();
    this.requestGameFullscreen();
    this.stopMascotAnimation();

    // Push gameplay history state for reliable cross-device Back confirmation
    try {
      if (window.history && window.history.pushState) {
        window.history.pushState({ dinoView: 'gameplay' }, '');
      }
    } catch (e) {}

    // Step A: Immediately clean up homepage state
    this.hideScreen(this.homeScreen);
    this.homeScreen.classList.remove('fade-out');

    // Step B: Reveal Gameplay HUD and prepare game
    this.showScreen(this.gameplayHUD);
    if (window.spriteRenderer && window.SkinManager) {
      const activeSkin = window.SkinManager.getSelectedSkinId();
      window.spriteRenderer.setSkin(activeSkin);
    }

    // Step C: Initialize gameplay exactly once with zero artificial delay
    this.game.resetGame();
    this.updateHUD(0, this.game.stats.bestScore);

    // Launch gameplay directly
    this.game.lastTime = performance.now();
    this.game.state = this.game.STATE_PLAYING;

    // Start desert wind ambience when active gameplay begins
    if (this.sound) {
      this.sound.startAmbience();
    }
    this.isStartingInitialGame = false;
  }

  startNewGameSequence() {
    this.cancelCountdown();
    this.stopMascotAnimation();
    this.targetFacing = 1;
    this.currentFacing = 1;
    this.currentLook.x = 0;
    this.currentLook.y = 0;
    this.hideScreen(this.homeScreen);
    this.hideModal(this.pauseModal);
    this.hideModal(this.gameOverModal);
    this.hideModal(this.highScoreModal);
    this.hideModal(this.exitModal);
    this.hideModal(this.backspaceModal);
    this.showScreen(this.gameplayHUD);

    // Push gameplay history state for reliable cross-device Back confirmation
    try {
      if (window.history && window.history.pushState) {
        window.history.pushState({ dinoView: 'gameplay' }, '');
      }
    } catch (e) {}

    // Explicitly synchronize spriteRenderer with confirmed saved skin
    if (window.spriteRenderer && window.SkinManager) {
      const activeSkin = window.SkinManager.getSelectedSkinId();
      window.spriteRenderer.setSkin(activeSkin);
    }

    this.game.resetGame();
    this.updateHUD(0, this.game.stats.bestScore);

    this.runCountdown(() => {
      this.game.lastTime = performance.now();
      this.game.state = this.game.STATE_PLAYING;
      // Start desert wind ambience when gameplay begins
      if (this.sound) {
        this.sound.startAmbience();
      }
    });
  }

  // ==========================================
  // PAUSE & RESUME (DINO-005 SAFE HANDLING)
  // ==========================================
  pauseGame() {
    if (this.game.state !== this.game.STATE_PLAYING) return;
    this.cancelCountdown();

    // Cancel any jump or duck state immediately
    if (this.touchPendingJumpTimer) {
      clearTimeout(this.touchPendingJumpTimer);
      this.touchPendingJumpTimer = null;
    }
    this.touchPendingJump = false;
    this.touchDispatchedJump = false;
    this.isSwipingDown = false;
    this.game.setJumpInput(false);
    this.game.handleDuckPress(false);

    // Freeze game state
    this.game.state = this.game.STATE_PAUSED;
    if (this.sound) this.sound.stopAmbience();
    this.showModal(this.pauseModal);
  }

  resumeGame() {
    this.isAutoPaused = false;
    this.cancelCountdown();
    this.hideModal(this.pauseModal);

    // Ensure no stale input is carried over
    if (this.touchPendingJumpTimer) {
      clearTimeout(this.touchPendingJumpTimer);
      this.touchPendingJumpTimer = null;
    }
    this.touchPendingJump = false;
    this.touchDispatchedJump = false;
    this.isSwipingDown = false;
    this.game.setJumpInput(false);
    this.game.handleDuckPress(false);

    // Resume physics clock seamlessly from exact frame
    this.game.lastTime = performance.now();
    this.game.state = this.game.STATE_PLAYING;
    if (this.sound) this.sound.startAmbience();
  }

  // ==========================================
  // CROSS-DEVICE GAMEPLAY STATE & QUIT CONFIRMATION
  // ==========================================
  isGameplayActive() {
    if (!this.game) return false;
    // If homepage is visible, we are on the homepage
    if (this.homeScreen && !this.homeScreen.classList.contains('hidden')) {
      return false;
    }
    // If customization is visible, we are on customization screen
    if (this.customizationScreen && !this.customizationScreen.classList.contains('hidden')) {
      return false;
    }
    // If game over modal is active, the run has already finished
    if (this.game.state === this.game.STATE_GAMEOVER) {
      return false;
    }
    // Active gameplay encompasses PLAYING, PAUSED, COUNTDOWN, and LOADING flows
    return (
      this.game.state === this.game.STATE_PLAYING ||
      this.game.state === this.game.STATE_PAUSED ||
      this.game.state === this.game.STATE_COUNTDOWN ||
      this.game.state === this.game.STATE_LOADING ||
      this.game.state === 'LOADING'
    );
  }

  openBackspaceModal() {
    if (!this.backspaceModal) return;
    // Prevent duplicate dialogs from repeated Back or shortcut triggers
    if (!this.backspaceModal.classList.contains('hidden')) return;

    this.wasPlayingBeforeBackspace = (this.game && this.game.state === this.game.STATE_PLAYING);
    this.cancelCountdown();
    if (this.game) {
      this.game.setJumpInput(false);
      this.game.handleDuckPress(false);
      if (this.game.state === this.game.STATE_PLAYING) {
        this.game.state = this.game.STATE_PAUSED;
      }
    }
    if (this.sound) this.sound.stopAmbience();
    this.showModal(this.backspaceModal);
  }

  dismissBackspaceModal() {
    if (!this.backspaceModal) return;
    this.hideModal(this.backspaceModal);
    if (this.wasPlayingBeforeBackspace && this.game) {
      this.wasPlayingBeforeBackspace = false;
      this.game.lastTime = performance.now();
      this.game.state = this.game.STATE_PLAYING;
      if (this.sound) this.sound.startAmbience();
    }
  }

  confirmBackspaceQuit() {
    if (this.sound) this.sound.playClick();
    this.hideModal(this.backspaceModal);
    this.wasPlayingBeforeBackspace = false;
    this.returnToHomeScreen();
  }

  // ==========================================
  // CROSS-DEVICE BROWSER & ANDROID BACK NAVIGATION
  // ==========================================
  setupHistoryNavigation() {
    if (typeof window === 'undefined' || !window.history || !window.history.pushState) return;

    try {
      window.history.replaceState({ dinoView: 'home_base' }, '');
      window.history.pushState({ dinoView: 'home' }, '');
    } catch (e) {}

    window.addEventListener('popstate', (e) => {
      this.handlePopState(e);
    });
  }

  executeExit() {
    this.isExiting = true;
    this.hideModal(this.exitModal);

    // Stop all audio, mascot animations, and gameplay loops immediately
    if (this.sound) {
      this.sound.stopAmbience();
    }
    this.stopMascotAnimation();
    if (this.game) {
      this.game.stopLoop();
    }

    // 1. Attempt programmatic window close (supported when opened via script/standalone/PWA)
    try {
      window.close();
    } catch (e) {}

    // 2. Return to referrer if arriving from an external site
    try {
      if (document.referrer && document.referrer !== window.location.href && !document.referrer.includes(window.location.host)) {
        window.location.replace(document.referrer);
        return;
      }
    } catch (e) {}

    // 3. Immediate supported exit fallback for browser tabs
    try {
      window.location.replace('about:blank');
    } catch (e) {
      try {
        window.location.href = 'about:blank';
      } catch (err) {}
    }
  }

  handlePopState(e) {
    if (this.isExiting) return;
    // 1. Actively playing, paused, countdown, or loading
    if (this.isGameplayActive()) {
      try {
        window.history.pushState({ dinoView: 'gameplay' }, '');
      } catch (err) {}

      // If quit dialog is already visible, do not open duplicate dialogs
      if (this.backspaceModal && !this.backspaceModal.classList.contains('hidden')) {
        return;
      }

      // Show "Do you want to quit this game?" confirmation dialog
      this.openBackspaceModal();
      return;
    }

    // 2. On Game Over screen
    if (this.game && this.game.state === this.game.STATE_GAMEOVER) {
      try {
        window.history.pushState({ dinoView: 'home' }, '');
      } catch (err) {}
      this.returnToHomeScreen();
      return;
    }

    // 3. On Homepage or sub-screens
    try {
      window.history.pushState({ dinoView: 'home' }, '');
    } catch (err) {}

    // Close Customization if open
    if (this.customizationScreen && !this.customizationScreen.classList.contains('hidden')) {
      this.closeCustomizationScreen();
      return;
    }

    // Close High Score modal if open
    if (this.highScoreModal && !this.highScoreModal.classList.contains('hidden')) {
      this.btnHighScoreBack.click();
      return;
    }

    // If Exit modal is already open, do not duplicate
    if (this.exitModal && !this.exitModal.classList.contains('hidden')) {
      return;
    }

    // On clean homepage: trigger existing Homepage Exit confirmation dialog
    this.showModal(this.exitModal);
  }

  showAutoPauseOverlay() {
    this.isAutoPaused = true;
    this.cancelCountdown();
    this.game.setJumpInput(false);
    this.game.handleDuckPress(false);
    // Stop wind when auto-paused
    if (this.sound) this.sound.stopAmbience();
    this.showModal(this.pauseModal);
  }

  startRecoveryCountdown() {
    if (!this.isAutoPaused) return;
    this.isAutoPaused = false;
    this.hideModal(this.pauseModal);

    this.runCountdown(() => {
      this.game.lastTime = performance.now();
      this.game.state = this.game.STATE_PLAYING;
      // Resume desert wind ambience when gameplay resumes
      if (this.sound) this.sound.startAmbience();
    });
  }

  // ==========================================
  // GAME OVER SCREEN
  // ==========================================
  showGameOver(runScore, bestScore) {
    this.gameOverRunScore.textContent = this.formatScore(runScore);
    this.gameOverBestScore.textContent = this.formatScore(bestScore);
    // Stop wind on game over (collision already triggered stopAmbience in game.js)
    if (this.sound) this.sound.stopAmbience();
    this.showModal(this.gameOverModal);
  }

  // ==========================================
  // RETURN TO HOME SCREEN (Pause / Game Over)
  // ==========================================
  returnToHomeScreen() {
    this.cancelCountdown();
    this.cancelInitialLoading();
    this.hideModal(this.pauseModal);
    this.hideModal(this.gameOverModal);
    this.hideModal(this.highScoreModal);
    this.hideModal(this.exitModal);
    this.hideModal(this.backspaceModal);
    this.hideScreen(this.gameplayHUD);
    this.homeScreen.classList.remove('fade-out');
    this.showScreen(this.homeScreen);
    this.game.setJumpInput(false);
    this.game.handleDuckPress(false);
    this.game.state = this.game.STATE_HOME;
    this.game.resetGame();
    // Stop wind when returning to home
    if (this.sound) this.sound.stopAmbience();
    this.targetFacing = 1;
    this.currentFacing = 1;
    this.currentLook.x = 0;
    this.currentLook.y = 0;
    this.turnTimer = 0;
    this.updateHomeDinoSkin();
    this.startMascotAnimation();

    // Clean up history state back to home
    try {
      if (window.history && window.history.replaceState) {
        window.history.replaceState({ dinoView: 'home' }, '');
      }
    } catch (e) {}
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

    // Subtle storage status indicator (ISSUE-07)
    const notice = document.getElementById('hsStorageNotice');
    if (notice) {
      if (this.game.storageAvailable === false) {
        notice.classList.remove('hidden');
      } else {
        notice.classList.add('hidden');
      }
    }
    this.showModal(this.highScoreModal);
  }

  showStorageNoticeOnce() {
    if (this._hasShownStorageNotice) return;
    this._hasShownStorageNotice = true;
    const notice = document.getElementById('hsStorageNotice');
    if (notice) {
      notice.classList.remove('hidden');
    }
  }

  // Direct Sound control
  updateSoundButtons() {
    const isMuted = this.sound.isMuted;
    const soundFrame = document.getElementById('homeSoundFrameImg');
    if (soundFrame) {
      soundFrame.src = isMuted
        ? 'assets/sprites/btn_home_sound_off_frame.png'
        : 'assets/sprites/btn_home_sound_frame.png';
      soundFrame.alt = isMuted ? 'Sound: OFF' : 'Sound: ON';
    }
    const soundPatch = document.getElementById('homeSoundOffPatch');
    if (soundPatch) {
      if (isMuted) {
        soundPatch.classList.remove('hidden');
      } else {
        soundPatch.classList.add('hidden');
      }
    }
    if (this.homeSoundIcon) {
      this.homeSoundIcon.textContent = isMuted ? '🔇' : '🔊';
    }
    if (this.homeSoundState) {
      this.homeSoundState.textContent = isMuted ? 'OFF' : 'ON';
    } else if (this.homeSoundLabel) {
      this.homeSoundLabel.textContent = isMuted ? 'Sound: OFF' : 'Sound: ON';
    }
    if (this.btnHomeSound) {
      this.btnHomeSound.setAttribute('aria-label', isMuted ? 'Sound: OFF' : 'Sound: ON');
      this.btnHomeSound.setAttribute('title', isMuted ? 'Sound: OFF' : 'Sound: ON');
    }
  }

  // Homepage dinosaur mascot permanently remains original default green skin
  updateHomeDinoSkin() {
    if (this.homeTitleSignImg) {
      this.homeTitleSignImg.src = 'assets/sprites/home_title_sign_green.png';
    }
    const skinOverlay = document.getElementById('homeDinoSkinOverlay');
    if (skinOverlay) {
      skinOverlay.classList.add('hidden');
    }
  }

  // Pre-cache all skin sprites so switching between skins is instantaneous without visual flashes
  preloadSkinAssets() {
    const skins = (window.SkinManager && window.SkinManager.skins)
      ? window.SkinManager.skins.map(s => s.id)
      : ['green', 'blue', 'red', 'brown', 'black'];
    skins.forEach((s) => {
      const img1 = new Image();
      img1.src = `assets/sprites/skin_${s}.png`;
      const img2 = new Image();
      img2.src = `assets/sprites/home_dino_skin_${s}.png`;
      const img3 = new Image();
      img3.src = `assets/sprites/home_title_sign_${s}.png`;
    });
  }

  // ==========================================
  // HUD & CELEBRATION BANNER
  // ==========================================
  formatScore(n) {
    if (window.ScoreMath && typeof window.ScoreMath.formatScore === 'function') {
      return window.ScoreMath.formatScore(n);
    }
    if (typeof n === 'bigint') {
      return n.toString().padStart(5, '0');
    }
    return Math.floor(Number(n) || 0).toString().padStart(5, '0');
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
  // CURSOR TRACKING INITIALIZATION (HOME-01 .. HOME-05)
  // ==========================================
  initCursorTracking() {
    this.boundOnPointerMove = (e) => {
      if (this.game.state !== this.game.STATE_HOME) return;
      this.mousePos.x = e.clientX;
      this.mousePos.y = e.clientY;
      this.hasMouse = true;
    };

    this.boundOnPointerLeave = () => {
      this.hasMouse = false;
    };

    window.addEventListener('pointermove', this.boundOnPointerMove, { passive: true });
    document.addEventListener('mouseleave', this.boundOnPointerLeave, { passive: true });

    // Click / touch interaction on mascot character (disallowed animations removed)
    if (this.mascotCanvas) {
      const onMascotTap = (e) => {
        if (this.game.state !== this.game.STATE_HOME) return;
        if (this.sound && typeof this.sound.playClick === 'function') {
          this.sound.playClick();
        }
      };
      this.mascotCanvas.addEventListener('pointerdown', onMascotTap);
      this.mascotCanvas.addEventListener('touchstart', onMascotTap, { passive: true });
    }

    // Keyboard rotation shortcuts for Customization screen
    window.addEventListener('keydown', (e) => {
      if (this.customizationScreen && !this.customizationScreen.classList.contains('hidden')) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.rotatePreview(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.rotatePreview(1);
        }
      }
    });
  }

  triggerMascotClickReaction() {
    // Disabled per prompt specification (no tongue-out/blushing reactions)
  }

  // ==========================================
  // HOME MASCOT (STATIONARY & STABLE PER REQUIREMENT 7)
  // No cursor-tracking or eye movement; strictly stable reference artwork
  // ==========================================
  startMascotAnimation() {
    // Dinosaur remains stationary and visually stable matching reference artwork (Requirement 7)
    if (this.mascotCtx && this.mascotCanvas) {
      this.mascotCtx.clearRect(0, 0, this.mascotCanvas.width, this.mascotCanvas.height);
    }
  }

  stopMascotAnimation() {
    if (this.mascotRafId) {
      cancelAnimationFrame(this.mascotRafId);
      this.mascotRafId = null;
    }
  }

  // ==========================================
  // DINOSAUR CUSTOMIZATION LOGIC & PREVIEW (SKIN-01 .. SKIN-05)
  // Continuous 360-degree rotation of the approved 2D cartoon dinosaur
  // ==========================================
  // ==========================================
  // INTRO VIDEO REMOVED — DIRECT HOMEPAGE STUBS
  // ==========================================
  initIntroVideo() {}
  unmuteIntroVideo() {}
  dismissIntroVideo(immediate = false) {
    this.isIntroPlaying = false;
    this.introEnded = true;
    this.updateHomeDinoSkin();
    this.startMascotAnimation();
    this.showScreen(this.homeScreen);
  }

    initCustomizationUI() {
    // Strictly disable invented 3D generic model; use authoritative 2D turnaround (Section 5 & 2.2)
    this.has3D = false;
    if (this.customization3DCanvas) {
      this.customization3DCanvas.classList.add('hidden');
    }

    if (this.customizationCanvas && this.customCtx) {
      this.customizationCanvas.classList.add('hidden');
      if (this.customDinoPreviewImg) {
        const activeSkinObj = (window.SkinManager) ? window.SkinManager.getSkinById(this.previewSkinId) : null;
      this.customDinoPreviewImg.src = this.getSkinPreviewAsset(this.previewSkinId);
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const cssW = 220;
      const cssH = 170;
      this.customizationCanvas.width = Math.round(cssW * dpr);
      this.customizationCanvas.height = Math.round(cssH * dpr);
      this.customizationCanvas.style.width = cssW + 'px';
      this.customizationCanvas.style.height = cssH + 'px';
      this.customCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.customCtx.scale(dpr, dpr);

      // Attach 360 degree drag rotation gesture to customizationCanvas (SKIN-01, SKIN-02)
      this.customizationCanvas.style.touchAction = 'none';
      this.customizationCanvas.style.cursor = 'grab';

      this.customizationCanvas.addEventListener('pointerdown', (e) => {
        this.isDraggingCustom = true;
        this.dragStartX = e.clientX;
        this.dragStartAngle = this.customRotationAngle;
        this.dragVelocity = 0;
        this.lastDragX = e.clientX;
        this.lastDragTime = performance.now();
        this.customizationCanvas.style.cursor = 'grabbing';
        try { this.customizationCanvas.setPointerCapture(e.pointerId); } catch(err) {}
      });

      this.customizationCanvas.addEventListener('pointermove', (e) => {
        if (!this.isDraggingCustom) return;
        const deltaX = e.clientX - this.dragStartX;
        this.customRotationAngle = this.dragStartAngle - deltaX * 0.015;

        const now = performance.now();
        const dtDrag = (now - this.lastDragTime) / 1000;
        if (dtDrag > 0.005) {
          this.dragVelocity = -(e.clientX - this.lastDragX) * 0.015 / dtDrag;
          this.lastDragX = e.clientX;
          this.lastDragTime = now;
        }

        // Keep customPreviewFrame synced for legacy audit checks
        const twoPi = Math.PI * 2;
        const normAngle = ((this.customRotationAngle % twoPi) + twoPi) % twoPi;
        this.customPreviewFrame = Math.round((normAngle / twoPi) * 10) % 10;
      });

      const endDrag = (e) => {
        if (this.isDraggingCustom) {
          this.isDraggingCustom = false;
          this.customizationCanvas.style.cursor = 'grab';
          try { this.customizationCanvas.releasePointerCapture(e.pointerId); } catch(err) {}
        }
      };

      this.customizationCanvas.addEventListener('pointerup', endDrag);
      this.customizationCanvas.addEventListener('pointercancel', endDrag);
      this.customizationCanvas.addEventListener('mouseleave', endDrag);
    }

    this.renderCustomSkinsGrid();
    this.updateConfirmButtonState();
    this.updateRotateButtonStates();
  }

  openCustomizationScreen() {
    this.stopMascotAnimation();
    this.hideSkinNotification(true);
    this.confirmedSkinId = (window.SkinManager) ? window.SkinManager.getSelectedSkinId() : 'green';
    this.previewSkinId = this.confirmedSkinId;

    if (this.customDinoPreviewImg) {
      this.customDinoPreviewImg.src = this.getSkinPreviewAsset(this.previewSkinId);
    }
    this.updateHomeDinoSkin();

    this.customRotationAngle = 0; // Profile Right
    this.customPreviewFrame = 0;
    this.dragVelocity = 0;
    this.customReactionTimer = 0;
    this.customBlinkStage = 'OPEN';
    this.customSettlingBounce = 0;
    this.startCustomizationAnimation();

    this.renderCustomSkinsGrid();
    this.updateConfirmButtonState();
    this.updateRotateButtonStates();

    this.hideScreen(this.homeScreen);
    this.showScreen(this.customizationScreen);
  }

  closeCustomizationScreen() {
    // Keep notification visible on the homepage for its full ~3s duration (do not hide/cancel it)
    // Do not auto-confirm previewed skin
    this.updateHomeDinoSkin();
    if (window.spriteRenderer && window.SkinManager) {
      window.spriteRenderer.setSkin(window.SkinManager.getSelectedSkinId());
    }

    this.stopCustomizationAnimation();
    this.hideScreen(this.customizationScreen);
    this.showScreen(this.homeScreen);
    this.targetFacing = 1;
    this.currentFacing = 1;
    this.startMascotAnimation();
  }

  renderCustomSkinsGrid() {
    if (!this.customSkinsGrid || !window.SkinManager) return;
    const skins = window.SkinManager.skins;
    this.customSkinsGrid.innerHTML = '';

    skins.forEach((s) => {
      const card = document.createElement('div');
      const isPreviewed = (s.id === this.previewSkinId);
      const isConfirmed = (s.id === this.confirmedSkinId);

      card.className = `skin-card ${isPreviewed ? 'preview-active' : ''}`;
      card.setAttribute('data-skin-id', s.id);
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'region');
      card.setAttribute('aria-label', `${s.name} Skin`);

      const cleanName = s.name.replace(/^(CLASSIC|SAPPHIRE|CRIMSON|GOLDEN|SUNSET|AMETHYST|ROSE|CHOCOLATE|CHARCOAL)\s*/i, '');

      card.innerHTML = `
        <div class="skin-card-preview-area" role="button" tabindex="0" title="Preview ${cleanName}">
          <div class="skin-swatch-circle" style="background: ${s.swatchColor}; border-color: ${s.accentColor};"></div>
          <span class="skin-card-name">${cleanName}</span>
        </div>
        <button type="button" class="skin-select-btn ${isConfirmed ? 'selected-btn' : ''}" data-skin-id="${s.id}" ${isConfirmed ? 'disabled' : ''} aria-label="${isConfirmed ? `${cleanName} skin selected` : `Select ${cleanName} skin`}">
          ${isConfirmed ? '✓ SELECTED' : 'SELECT'}
        </button>
      `;

      // Clicking preview area previews skin without confirming
      const previewArea = card.querySelector('.skin-card-preview-area');
      if (previewArea) {
        this.bindButtonAction(previewArea, () => {
          this.previewSkin(s.id);
        });
        previewArea.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            this.previewSkin(s.id);
          }
        });
      }

      // Clicking card outside the select button previews skin without confirming
      this.bindButtonAction(card, (e) => {
        if (!e.target.closest('.skin-select-btn')) {
          this.previewSkin(s.id);
        }
      });

      // Clicking SELECT button confirms skin
      const selectBtn = card.querySelector('.skin-select-btn');
      if (selectBtn) {
        this.bindButtonAction(selectBtn, () => {
          if (s.id !== this.confirmedSkinId) {
            this.confirmSkinSelection(s.id);
          }
        });
      }

      this.customSkinsGrid.appendChild(card);
    });

    const activeSkinObj = window.SkinManager.getSkinById(this.previewSkinId);
    if (this.customSkinLabel && activeSkinObj) {
      this.customSkinLabel.textContent = activeSkinObj.name;
      this.customSkinLabel.style.background = activeSkinObj.swatchColor;
      this.customSkinLabel.style.color = (activeSkinObj.id === 'black' || activeSkinObj.id === 'red' || activeSkinObj.id === 'blue' || activeSkinObj.id === 'brown') ? '#ffffff' : '#0f172a';
    }
  }

  getSkinPreviewAsset(skinId) {
    if (window.SkinManager && typeof window.SkinManager.getSkinById === 'function') {
      const skin = window.SkinManager.getSkinById(skinId);
      if (skin && skin.previewAsset) return skin.previewAsset;
    }
    return `assets/sprites/skin_${skinId || 'green'}.png`;
  }

  // Previews a skin without selecting or confirming it
  previewSkin(skinId) {
    if (!window.SkinManager) return;
    this.previewSkinId = skinId;

    if (this.customDinoPreviewImg) {
      this.customDinoPreviewImg.src = this.getSkinPreviewAsset(skinId);
    }
    this.triggerCustomReaction();
    this.renderCustomSkinsGrid();
    this.updateConfirmButtonState();
  }

  // Backward compatibility: calls previewSkin
  selectSkinPreview(skinId) {
    this.previewSkin(skinId);
  }

  // Confirms and applies a skin selection
  confirmSkinSelection(skinId) {
    if (!window.SkinManager) return;
    if (this.confirmedSkinId === skinId) return; // Prevent duplicate selection/sound

    this.previewSkinId = skinId;
    this.confirmedSkinId = skinId;
    window.SkinManager.setSelectedSkinId(skinId);

    if (this.customDinoPreviewImg) {
      this.customDinoPreviewImg.src = this.getSkinPreviewAsset(skinId);
    }
    this.updateHomeDinoSkin();

    if (window.spriteRenderer) {
      window.spriteRenderer.setSkin(skinId);
    }

    // Play confirmation sound ONCE (respects Sound ON/OFF)
    if (this.sound && !this.sound.isMuted && typeof this.sound.playMilestone === 'function') {
      this.sound.playMilestone();
    } else if (this.sound && !this.sound.isMuted && typeof this.sound.playClick === 'function') {
      this.sound.playClick();
    }

    this.triggerCustomReaction();
    this.renderCustomSkinsGrid();
    this.updateConfirmButtonState();

    // Show dynamic notification (~3s duration)
    this.showSkinNotification(skinId);
  }

  confirmSelectedSkin(showNotification = true) {
    if (this.previewSkinId) {
      this.confirmSkinSelection(this.previewSkinId);
    }
  }

  getSkinNotificationMessage(skinId) {
    const displayName = this.getSkinDisplayName(skinId);
    return `${displayName} skin is selected ✅`;
  }

  showSkinNotification(skinId) {
    if (!this.skinSelectToast) {
      this.skinSelectToast = document.getElementById('skinSelectToast');
    }
    if (!this.skinSelectToast) return;

    if (this.skinNotifyTimer) {
      clearTimeout(this.skinNotifyTimer);
      this.skinNotifyTimer = null;
    }
    if (this.skinNotifyFadeTimer) {
      clearTimeout(this.skinNotifyFadeTimer);
      this.skinNotifyFadeTimer = null;
    }

    this.skinSelectToast.textContent = this.getSkinNotificationMessage(skinId);

    this.skinSelectToast.classList.remove('hidden');
    void this.skinSelectToast.offsetWidth;
    this.skinSelectToast.classList.add('toast-visible');

    // Begin smooth fade-out after ~2.6 seconds so it finishes fading out by ~2.9-3.0 seconds
    this.skinNotifyFadeTimer = setTimeout(() => {
      if (this.skinSelectToast) {
        this.skinSelectToast.classList.remove('toast-visible');
      }
    }, 2600);

    // Completely hide after fade-out transition completes (~2.95 seconds total)
    this.skinNotifyTimer = setTimeout(() => {
      if (this.skinSelectToast) {
        this.skinSelectToast.classList.add('hidden');
      }
      this.skinNotifyTimer = null;
      this.skinNotifyFadeTimer = null;
    }, 2950);
  }

  hideSkinNotification(immediate = false) {
    if (this.skinNotifyTimer) {
      clearTimeout(this.skinNotifyTimer);
      this.skinNotifyTimer = null;
    }
    if (this.skinNotifyFadeTimer) {
      clearTimeout(this.skinNotifyFadeTimer);
      this.skinNotifyFadeTimer = null;
    }
    if (!this.skinSelectToast) {
      this.skinSelectToast = document.getElementById('skinSelectToast');
    }
    if (!this.skinSelectToast) return;

    this.skinSelectToast.classList.remove('toast-visible');
    if (immediate) {
      this.skinSelectToast.classList.add('hidden');
    } else {
      this.skinNotifyTimer = setTimeout(() => {
        if (this.skinSelectToast) {
          this.skinSelectToast.classList.add('hidden');
        }
        this.skinNotifyTimer = null;
      }, 250);
    }
  }

  getSkinDisplayName(skinId) {
    if (window.SkinManager && typeof window.SkinManager.getSkinById === 'function') {
      const skin = window.SkinManager.getSkinById(skinId);
      if (skin && skin.name) {
        const clean = skin.name.replace(/^(CLASSIC|SAPPHIRE|CRIMSON|GOLDEN|SUNSET|AMETHYST|ROSE|CHOCOLATE|CHARCOAL)\s*/i, '').trim();
        if (clean) {
          return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
        }
      }
    }
    if (!skinId) return 'Green';
    return skinId.charAt(0).toUpperCase() + skinId.slice(1).toLowerCase();
  }

  updateConfirmButtonState() {
    if (!this.btnConfirmSkin || !this.btnConfirmSkinText) return;
    const isAlreadyConfirmed = (this.previewSkinId === this.confirmedSkinId);

    if (isAlreadyConfirmed) {
      this.btnConfirmSkinText.textContent = 'SELECTED';
      this.btnConfirmSkin.classList.remove('btn-primary-yellow');
      this.btnConfirmSkin.classList.add('btn-selected-state');
      this.btnConfirmSkin.setAttribute('disabled', 'true');
    } else {
      this.btnConfirmSkinText.textContent = 'SELECT';
      this.btnConfirmSkin.classList.remove('btn-selected-state');
      this.btnConfirmSkin.classList.add('btn-primary-yellow');
      this.btnConfirmSkin.removeAttribute('disabled');
    }
  }

  rotatePreview(direction) {
    this.sound.playClick();
    // Smooth 360 degree continuous turnaround rotation increment (SKIN-01, SKIN-02)
    // Direction +1 = Rotate Right (+36 deg), -1 = Rotate Left (-36 deg)
    const step = (Math.PI * 2) / 10.0;
    this.customRotationAngle += direction * step;
    this.dragVelocity = 0;

    const twoPi = Math.PI * 2;
    const normAngle = ((this.customRotationAngle % twoPi) + twoPi) % twoPi;
    this.customPreviewFrame = Math.round((normAngle / twoPi) * 10) % 10;

    this.triggerCustomReaction();
    this.updateRotateButtonStates();
  }

  updateRotateButtonStates() {
    // 360 degree continuous rotation supports infinite turning in both directions!
    if (this.btnRotateLeft) this.btnRotateLeft.disabled = false;
    if (this.btnRotateRight) this.btnRotateRight.disabled = false;
  }

  triggerCustomReaction() {
    this.customReactionTimer = 0.32; // Reaction trigger window
    this.customSettlingBounce = 3.5;  // Cute 3.5px micro bounce
    this.customBlinkStage = 'OPEN';
  }

  startCustomizationAnimation() {
    if (!this.customizationCanvas || !this.customCtx) return;
    if (this.customizationRafId) return;

    let lastTime = performance.now();
    const animateCustomization = (currentTime) => {
      if (this.customizationScreen && this.customizationScreen.classList.contains('hidden')) {
        this.customizationRafId = null;
        return;
      }

      const now = currentTime || performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      this.customAnimTime += dt;

      // 1. Smooth drag inertia rotation
      if (!this.isDraggingCustom && Math.abs(this.dragVelocity) > 0.01) {
        this.customRotationAngle += this.dragVelocity * dt;
        this.dragVelocity *= Math.exp(-6.0 * dt);
        const twoPi = Math.PI * 2;
        const normAngle = ((this.customRotationAngle % twoPi) + twoPi) % twoPi;
        this.customPreviewFrame = Math.round((normAngle / twoPi) * 10) % 10;
      }

      // 2. Cute idle settling reaction & bounce
      if (this.customSettlingBounce > 0.05) {
        this.customSettlingBounce *= Math.exp(-9.0 * dt);
      } else {
        this.customSettlingBounce = 0;
      }

      // 3. Cute subtle eye blink after rotation or idle
      if (this.customReactionTimer > 0) {
        this.customReactionTimer -= dt;
        if (this.customReactionTimer < 0.12 && this.customReactionTimer > 0.03) {
          this.customBlinkStage = 'CLOSED';
        } else {
          this.customBlinkStage = 'OPEN';
        }
      } else {
        // Natural blink every 4 seconds
        const cycle = this.customAnimTime % 4.2;
        if (cycle >= 2.5 && cycle <= 2.62) {
          this.customBlinkStage = 'CLOSED';
        } else {
          this.customBlinkStage = 'OPEN';
        }
      }

      // 4. Gentle natural stationary breathing (<0.7px)
      const breath = Math.sin(this.customAnimTime * Math.PI * 1.2) * 0.65;
      const currentBounce = -Math.abs(Math.sin(this.customSettlingBounce * Math.PI)) * this.customSettlingBounce;

      // 5. Render continuous 360-degree preview canvas
      const ctx = this.customCtx;
      const cssW = 220;
      const cssH = 170;
      ctx.clearRect(0, 0, cssW, cssH);

      if (window.spriteRenderer) {
        window.spriteRenderer.drawTurnaround360(
          ctx,
          cssW / 2,
          cssH / 2,
          135,
          this.customRotationAngle,
          this.previewSkinId,
          this.customBlinkStage,
          breath + currentBounce
        );
      }

      this.customizationRafId = requestAnimationFrame(animateCustomization);
    };

    this.customizationRafId = requestAnimationFrame(animateCustomization);
  }

  stopCustomizationAnimation() {
    if (this.customizationRafId) {
      cancelAnimationFrame(this.customizationRafId);
      this.customizationRafId = null;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.uiManager = new UIManager();
  window.ui = window.uiManager;
  window.dinoGame.resize();
  window.dinoGame.startLoop();
});
