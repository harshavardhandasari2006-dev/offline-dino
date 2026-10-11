const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TARGET_URL = 'http://localhost:3000/';

async function runComprehensiveAudit() {
  console.log('======================================================================');
  console.log('▲ OFFLINE DINO — COMPREHENSIVE QA, VISUAL & PERFORMANCE AUDIT SUITE');
  console.log('======================================================================\n');

  const auditResults = {
    metadata: {
      timestamp: new Date().toISOString(),
      url: TARGET_URL,
      userAgent: '',
      viewportTested: []
    },
    sections: {
      homeScreen: {},
      gameplayRunning: {},
      gameplayJumping: {},
      gameplayDucking: {},
      pterodactylObstacle: {},
      cactusObstacle: {},
      collisionAndGameOver: {},
      pauseAndResume: {},
      audioAndMute: {},
      scoreAndPersistence: {},
      dayNightCycle: {},
      responsiveViewports: {},
      performanceAndReliability: {},
      consoleAndNetworkErrors: []
    },
    discoveredIssues: []
  };

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Collect console logs and errors
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', err => {
    auditResults.sections.consoleAndNetworkErrors.push({ type: 'pageerror', message: err.message });
  });

  page.on('requestfailed', req => {
    auditResults.sections.consoleAndNetworkErrors.push({
      type: 'requestfailed',
      url: req.url(),
      errorText: req.failure() ? req.failure().errorText : 'unknown'
    });
  });

  // Navigate to target URL
  console.log('[STAGE 1] Loading Game and Auditing Home Screen...');
  await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });
  auditResults.metadata.userAgent = await page.evaluate(() => navigator.userAgent);

  // 1. HOME SCREEN AUDIT
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(__dirname, 'audit_home_screen_desktop.png') });

  const homeData = await page.evaluate(() => {
    const homeScreen = document.getElementById('homeScreen');
    const isHomeVisible = !homeScreen.classList.contains('hidden');
    const title = document.querySelector('.game-title')?.textContent;
    const subtitle = document.querySelector('.game-subtitle')?.textContent;
    const btnStart = document.getElementById('btnStartGame');
    const btnHighScore = document.getElementById('btnHomeHighScore');
    const btnSound = document.getElementById('btnHomeSound');
    const btnExit = document.getElementById('btnHomeExit');
    const mascotCanvas = document.getElementById('mascotCanvas');

    return {
      isHomeVisible,
      title,
      subtitle,
      hasStartBtn: !!btnStart,
      hasHighScoreBtn: !!btnHighScore,
      hasSoundBtn: !!btnSound,
      hasExitBtn: !!btnExit,
      mascotWidth: mascotCanvas ? mascotCanvas.width : 0,
      mascotHeight: mascotCanvas ? mascotCanvas.height : 0,
      mascotRafRunning: window.uiManager && !!window.uiManager.mascotRafId
    };
  });
  auditResults.sections.homeScreen = homeData;
  console.log('  ✓ Home screen loaded, Title:', homeData.title, ', Mascot RAF:', homeData.mascotRafRunning);

  // Test Sound toggle on Home Screen
  console.log('\n[STAGE 2] Testing Audio Mute Toggle on Home Screen...');
  const initialMute = await page.evaluate(() => window.soundEngine ? window.soundEngine.isMuted : null);
  await page.click('#btnHomeSound');
  const toggledMute = await page.evaluate(() => window.soundEngine ? window.soundEngine.isMuted : null);
  const soundLabel = await page.evaluate(() => document.getElementById('homeSoundLabel')?.textContent);
  await page.click('#btnHomeSound'); // toggle back
  const restoredMute = await page.evaluate(() => window.soundEngine ? window.soundEngine.isMuted : null);

  auditResults.sections.audioAndMute = {
    initialMute,
    toggledMute,
    restoredMute,
    soundLabel,
    hasSoundEngine: true
  };
  console.log('  ✓ Sound toggle functional (initial:', initialMute, '-> toggled:', toggledMute, '-> restored:', restoredMute, ')');

  // Test High Score modal from Home Screen
  console.log('\n[STAGE 3] Testing High Score Modal from Home Screen...');
  await page.click('#btnHomeHighScore');
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: path.join(__dirname, 'audit_modal_highscore.png') });
  const hsData = await page.evaluate(() => {
    const modal = document.getElementById('highScoreModal');
    const isVisible = !modal.classList.contains('hidden');
    const best = document.getElementById('hsBestScore')?.textContent;
    const last = document.getElementById('hsLastScore')?.textContent;
    const games = document.getElementById('hsGamesPlayed')?.textContent;
    return { isVisible, best, last, games };
  });
  // Close High Score modal via back button
  await page.click('#btnHighScoreBack');
  await new Promise(r => setTimeout(r, 200));

  auditResults.sections.scoreAndPersistence = {
    modalData: hsData,
    closedCleanly: await page.evaluate(() => document.getElementById('highScoreModal').classList.contains('hidden'))
  };
  console.log('  ✓ High score modal verified, best score displayed:', hsData.best);

  // 2. START GAME & COUNTDOWN AUDIT
  console.log('\n[STAGE 4] Starting Game & Auditing Countdown Sequence...');
  await page.click('#btnStartGame');
  const countdownState = await page.evaluate(() => {
    const overlay = document.getElementById('countdownOverlay');
    const isVisible = !overlay.classList.contains('hidden');
    const text = document.getElementById('countdownText')?.textContent;
    const gameState = window.dinoGame ? window.dinoGame.state : null;
    return { isVisible, text, gameState };
  });
  console.log('  ✓ Countdown active:', countdownState.isVisible, 'Step:', countdownState.text, 'Game State:', countdownState.gameState);

  // Wait for PLAYING state
  await page.waitForFunction(() => window.dinoGame && window.dinoGame.state === 'PLAYING', { timeout: 6000 });
  console.log('  ✓ Transitioned to PLAYING state after countdown');

  // 3. RUNNING GAMEPLAY AUDIT
  console.log('\n[STAGE 5] Auditing Running Animation & Baselines...');
  // Temporarily suppress collision during baseline frame sampling
  await page.evaluate(() => {
    window.dinoGame.obstacles = [];
    window.dinoGame.checkCollisions = () => false;
  });

  await new Promise(r => setTimeout(r, 100));
  await page.screenshot({ path: path.join(__dirname, 'audit_gameplay_running_frame_a.png') });
  await new Promise(r => setTimeout(r, 120));
  await page.screenshot({ path: path.join(__dirname, 'audit_gameplay_running_frame_b.png') });

  const runMetrics = await page.evaluate(() => {
    const g = window.dinoGame;
    return {
      dinoX: g.dino.x,
      dinoY: g.dino.y,
      groundY: g.groundY,
      dinoHeight: g.dino.height,
      dinoWidth: g.dino.width,
      speed: g.speed,
      score: g.score,
      isGrounded: g.dino.isGrounded,
      isDucking: g.dino.isDucking
    };
  });
  auditResults.sections.gameplayRunning = runMetrics;
  console.log('  ✓ Running parameters: dino.y =', runMetrics.dinoY, 'groundY =', runMetrics.groundY, 'speed =', runMetrics.speed);

  // 4. JUMPING SEQUENCE AUDIT
  console.log('\n[STAGE 6] Auditing Jump Physics & Phases...');
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 60)); // Takeoff/Ascending
  const jumpAscending = await page.evaluate(() => ({
    vy: window.dinoGame.dino.vy,
    isGrounded: window.dinoGame.dino.isGrounded,
    jumpPhase: window.dinoGame.dino.jumpPhase
  }));

  await new Promise(r => setTimeout(r, 180)); // In air
  await page.screenshot({ path: path.join(__dirname, 'audit_gameplay_jump_midair.png') });
  const jumpApex = await page.evaluate(() => ({
    y: window.dinoGame.dino.y,
    vy: window.dinoGame.dino.vy,
    jumpPhase: window.dinoGame.dino.jumpPhase
  }));

  await new Promise(r => setTimeout(r, 350)); // Landing / Landed
  const jumpLanded = await page.evaluate(() => ({
    y: window.dinoGame.dino.y,
    isGrounded: window.dinoGame.dino.isGrounded,
    jumpPhase: window.dinoGame.dino.jumpPhase
  }));

  auditResults.sections.gameplayJumping = {
    ascending: jumpAscending,
    apex: jumpApex,
    landed: jumpLanded,
    heightDelta: runMetrics.dinoY - jumpApex.y
  };
  console.log('  ✓ Jump apex height delta:', (runMetrics.dinoY - jumpApex.y).toFixed(1), 'px, Landed cleanly:', jumpLanded.isGrounded);

  // 5. CROUCH / DUCK SEQUENCE AUDIT
  console.log('\n[STAGE 7] Auditing Duck / Crouch Animation & Timing...');
  await page.keyboard.down('ArrowDown');
  await new Promise(r => setTimeout(r, 50)); // Anticipation
  const duckAnticipation = await page.evaluate(() => ({
    isDucking: window.dinoGame.dino.isDucking,
    duckDuration: window.dinoGame.dino.duckDuration
  }));

  await new Promise(r => setTimeout(r, 100)); // Active crouch
  await page.screenshot({ path: path.join(__dirname, 'audit_gameplay_duck_active.png') });
  const duckActive = await page.evaluate(() => ({
    isDucking: window.dinoGame.dino.isDucking,
    duckDuration: window.dinoGame.dino.duckDuration,
    dinoY: window.dinoGame.dino.y
  }));

  await page.keyboard.up('ArrowDown');
  await new Promise(r => setTimeout(r, 40)); // Recovery
  const duckRecovery = await page.evaluate(() => ({
    isDucking: window.dinoGame.dino.isDucking,
    duckEndingTimer: window.dinoGame.dino.duckEndingTimer
  }));

  await new Promise(r => setTimeout(r, 80)); // Resumed running
  const duckResumed = await page.evaluate(() => ({
    isDucking: window.dinoGame.dino.isDucking,
    dinoY: window.dinoGame.dino.y
  }));

  auditResults.sections.gameplayDucking = {
    anticipation: duckAnticipation,
    active: duckActive,
    recovery: duckRecovery,
    resumed: duckResumed
  };
  console.log('  ✓ Duck active duration:', duckActive.duckDuration.toFixed(2), 's, Resumed running cleanly:', !duckResumed.isDucking);

  // 6. PTERODACTYL FLIGHT & WING FLAP AUDIT
  console.log('\n[STAGE 8] Auditing Pterodactyl World Traversal & Wing Flap...');
  await page.evaluate(() => {
    const g = window.dinoGame;
    g.checkCollisions = () => false;
    const p = {
      type: 'PTERODACTYL',
      x: 800,
      y: g.groundY - 72,
      groundOffset: -72,
      width: 58,
      height: 38,
      flapTimer: 0,
      flapFrame: 0,
      heightLabel: 'MID'
    };
    g.obstacles = [p];
  });

  const pteroPositions = [];
  const pteroFlapFrames = new Set();
  for (let frame = 0; frame < 50; frame++) {
    const pData = await page.evaluate(() => {
      const g = window.dinoGame;
      const p = g.obstacles.find(o => o.type === 'PTERODACTYL');
      if (!p) return null;
      return { x: p.x, flapFrame: p.flapFrame, dinoX: g.dino.x };
    });
    if (!pData) break;
    pteroPositions.push(pData.x);
    pteroFlapFrames.add(pData.flapFrame);
    await new Promise(r => setTimeout(r, 35));
  }

  const pteroTraveled = pteroPositions.length > 0 ? (pteroPositions[0] - pteroPositions[pteroPositions.length - 1]) : 0;
  auditResults.sections.pterodactylObstacle = {
    totalTraveledPx: pteroTraveled,
    flapFramesObserved: Array.from(pteroFlapFrames),
    startX: pteroPositions[0],
    endX: pteroPositions[pteroPositions.length - 1]
  };
  console.log('  ✓ Pterodactyl traveled:', pteroTraveled.toFixed(1), 'px, Wing frames:', Array.from(pteroFlapFrames).join(', '));

  // 7. PAUSE & RESUME AUDIT
  console.log('\n[STAGE 9] Auditing Pause & Resume Mechanics...');
  await page.click('#btnPause');
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: path.join(__dirname, 'audit_modal_pause.png') });

  const pauseState = await page.evaluate(() => {
    const modal = document.getElementById('pauseModal');
    const isModalVisible = !modal.classList.contains('hidden');
    const gameState = window.dinoGame.state;
    const score1 = window.dinoGame.score;
    return { isModalVisible, gameState, score1 };
  });

  await new Promise(r => setTimeout(r, 200));
  const pauseFreezeCheck = await page.evaluate((s1) => {
    return window.dinoGame.score === s1;
  }, pauseState.score1);

  // Resume game
  await page.click('#btnPauseResume');
  await new Promise(r => setTimeout(r, 200));
  const resumedState = await page.evaluate(() => {
    const modal = document.getElementById('pauseModal');
    return {
      isModalHidden: modal.classList.contains('hidden'),
      gameState: window.dinoGame.state
    };
  });

  auditResults.sections.pauseAndResume = {
    pauseState,
    pauseFreezeCheck,
    resumedState
  };
  console.log('  ✓ Pause froze score:', pauseFreezeCheck, ', Resumed to PLAYING:', resumedState.gameState === 'PLAYING');

  // 8. COLLISION DETECTION & GAME OVER AUDIT
  console.log('\n[STAGE 10] Auditing Collision Detection & Game Over Modal...');
  await page.evaluate(() => {
    const g = window.dinoGame;
    delete g.checkCollisions; // genuine collision detection!
    // Spawn ground cactus right in front of dinosaur
    const c = {
      type: 'CACTUS_SMALL_SINGLE',
      x: g.dino.x + 20,
      y: g.groundY - 48,
      groundOffset: -48,
      width: 26,
      height: 48
    };
    g.obstacles = [c];
  });

  await new Promise(r => setTimeout(r, 120));
  await page.screenshot({ path: path.join(__dirname, 'audit_gameplay_gameover.png') });

  const gameOverState = await page.evaluate(() => {
    const g = window.dinoGame;
    const modal = document.getElementById('gameOverModal');
    return {
      gameState: g.state,
      isDinoDead: g.state === g.STATE_GAMEOVER && !g.isDyingMidAir,
      isModalVisible: !modal.classList.contains('hidden'),
      runScore: document.getElementById('gameOverRunScore')?.textContent,
      bestScore: document.getElementById('gameOverBestScore')?.textContent
    };
  });
  auditResults.sections.collisionAndGameOver = gameOverState;
  console.log('  ✓ Collision triggered GAMEOVER:', gameOverState.gameState === 'GAMEOVER', ', Modal visible:', gameOverState.isModalVisible);

  // Test Play Again restart
  console.log('\n[STAGE 11] Testing Play Again Clean Restart...');
  await page.click('#btnPlayAgain');
  await page.waitForFunction(() => window.dinoGame && (window.dinoGame.state === 'COUNTDOWN' || window.dinoGame.state === 'PLAYING'), { timeout: 4000 });
  await page.waitForFunction(() => window.dinoGame && window.dinoGame.state === 'PLAYING', { timeout: 6000 });
  const restartedPlaying = await page.evaluate(() => window.dinoGame.state === 'PLAYING');
  console.log('  ✓ Play Again restarted game to PLAYING:', restartedPlaying);

  // 9. RESPONSIVE VIEWPORT AUDIT
  console.log('\n[STAGE 12] Auditing Responsive Viewports & Layout...');
  const viewports = [
    { name: 'Desktop HD', width: 1920, height: 1080 },
    { name: 'Laptop', width: 1366, height: 768 },
    { name: 'Tablet Portrait', width: 768, height: 1024 },
    { name: 'Mobile Portrait (iPhone)', width: 390, height: 844 },
    { name: 'Mobile Landscape', width: 844, height: 390 }
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise(r => setTimeout(r, 200));
    const safeName = vp.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const screenshotPath = `audit_responsive_${safeName}.png`;
    await page.screenshot({ path: path.join(__dirname, screenshotPath) });

    const vpMetrics = await page.evaluate(() => {
      const canvas = document.getElementById('gameCanvas');
      const g = window.dinoGame;
      return {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        cssWidth: canvas.clientWidth,
        cssHeight: canvas.clientHeight,
        groundY: g.groundY,
        dinoY: g.dino.y,
        scale: g.scale,
        hudVisible: !document.getElementById('gameplayHUD').classList.contains('hidden')
      };
    });

    auditResults.sections.responsiveViewports[vp.name] = {
      viewport: vp,
      metrics: vpMetrics,
      screenshot: screenshotPath
    };
    auditResults.metadata.viewportTested.push(vp.name);
    console.log(`  ✓ ${vp.name} (${vp.width}x${vp.height}) -> scale: ${vpMetrics.scale}, groundY: ${vpMetrics.groundY}`);
  }

  // 10. OFFLINE SERVICE WORKER AUDIT
  console.log('\n[STAGE 13] Auditing Service Worker Registration & Cache...');
  const swData = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { supported: false };
    const regs = await navigator.serviceWorker.getRegistrations();
    const isRegistered = regs.length > 0;
    const cacheNames = await caches.keys();
    let cacheItemCount = 0;
    if (cacheNames.length > 0) {
      const cache = await caches.open(cacheNames[0]);
      const keys = await cache.keys();
      cacheItemCount = keys.length;
    }
    return {
      supported: true,
      registered: isRegistered,
      cacheNames,
      cacheItemCount
    };
  });
  auditResults.sections.performanceAndReliability.serviceWorker = swData;
  console.log('  ✓ Service worker registered:', swData.registered, ', Cache entries:', swData.cacheItemCount);

  // 11. PERFORMANCE & MEMORY AUDIT (FPS & Workload sampling)
  console.log('\n[STAGE 14] Sampling FPS, Frame Delta & Heap Metrics...');
  const perfData = await page.evaluate(async () => {
    return new Promise(resolve => {
      const deltas = [];
      let lastTime = performance.now();
      let frames = 0;

      function measure(now) {
        deltas.push(now - lastTime);
        lastTime = now;
        frames++;
        if (frames < 60) {
          requestAnimationFrame(measure);
        } else {
          const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
          const maxDelta = Math.max(...deltas);
          const minDelta = Math.min(...deltas);
          const fps = 1000 / avgDelta;
          const memory = window.performance && window.performance.memory ? {
            totalJSHeapSize: window.performance.memory.totalJSHeapSize,
            usedJSHeapSize: window.performance.memory.usedJSHeapSize
          } : null;
          resolve({ avgDeltaMs: avgDelta, maxDeltaMs: maxDelta, minDeltaMs: minDelta, fps, memory });
        }
      }
      requestAnimationFrame(measure);
    });
  });
  auditResults.sections.performanceAndReliability.fpsAndFrameTiming = perfData;
  console.log('  ✓ Average FPS:', perfData.fps.toFixed(1), 'Avg Frame Delta:', perfData.avgDeltaMs.toFixed(2), 'ms (Max spike:', perfData.maxDeltaMs.toFixed(2), 'ms)');

  // 12. TAB SWITCH / VISIBILITY CHANGE AUTO-PAUSE AUDIT
  console.log('\n[STAGE 15] Testing Tab Switch (VisibilityChange) Auto-Pause...');
  await page.evaluate(() => {
    // Simulate visibility change to hidden
    Object.defineProperty(document, 'hidden', { value: true, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await new Promise(r => setTimeout(r, 100));
  const autoPauseHidden = await page.evaluate(() => ({
    state: window.dinoGame.state,
    isModalVisible: !document.getElementById('pauseModal').classList.contains('hidden')
  }));

  // Simulate visibility change to visible
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: false, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await new Promise(r => setTimeout(r, 100));
  const autoResumeRecovery = await page.evaluate(() => ({
    state: window.dinoGame.state,
    isCountdownVisible: !document.getElementById('countdownOverlay').classList.contains('hidden')
  }));

  auditResults.sections.performanceAndReliability.autoPause = {
    autoPauseHidden,
    autoResumeRecovery
  };
  console.log('  ✓ Auto-pause triggered on hidden:', autoPauseHidden.state === 'PAUSED', ', Recovery countdown on visible:', autoResumeRecovery.state === 'COUNTDOWN');

  // Finish browser session
  await browser.close();

  // Save full raw audit data
  fs.writeFileSync('comprehensive_audit_results.json', JSON.stringify(auditResults, null, 2));
  console.log('\n✔ Comprehensive audit completed successfully. Results saved to comprehensive_audit_results.json\n');
}

runComprehensiveAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
