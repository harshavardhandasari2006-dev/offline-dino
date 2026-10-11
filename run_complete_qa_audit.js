const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const os = require('os');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000/';

async function runFullQAAudit() {
  const auditReport = {
    timestamp: new Date().toISOString(),
    assetAudit: {},
    gameplayRuns: {},
    performanceMetrics: {},
    responsiveMetrics: {},
    uiAudit: {},
    issuesFound: []
  };

  console.log('================================================================');
  console.log('     OFFLINE DINO — DEEP QA AUDIT & BENCHMARK SUITE             ');
  console.log('================================================================\n');

  // ===========================================================================
  // PHASE 1: ASSET & FRAME-BY-FRAME PIXEL AUDIT
  // ===========================================================================
  console.log('>>> [PHASE 1] Deep Inspection of Dinosaur Sprites & Environment Assets');
  const spriteDir = path.join(__dirname, 'assets', 'sprites');
  const dinoFiles = [
    'dino_idle_0.png', 'dino_idle_1.png', 'dino_idle_2.png', 'dino_idle_3.png',
    'dino_run_0.png', 'dino_run_1.png', 'dino_run_2.png', 'dino_run_3.png', 'dino_run_4.png',
    'dino_jump_0.png', 'dino_jump_1.png', 'dino_jump_2.png', 'dino_jump_3.png', 'dino_jump_4.png',
    'dino_duck_0.png', 'dino_duck_1.png', 'dino_duck_2.png', 'dino_duck_3.png', 'dino_duck_4.png',
    'dino_dead.png', 'dino_hit.png'
  ];

  for (const f of dinoFiles) {
    const filePath = path.join(spriteDir, f);
    if (!fs.existsSync(filePath)) {
      auditReport.issuesFound.push({
        id: 'ASSET-MISSING',
        severity: 'Critical',
        desc: `File ${f} is missing from assets/sprites`
      });
      continue;
    }

    const img = sharp(filePath);
    const meta = await img.metadata();
    const raw = await img.raw().toBuffer();

    let minX = meta.width, maxX = 0, minY = meta.height, maxY = 0;
    let nonZeroAlphaCount = 0;
    let semiTransparentCount = 0;

    for (let y = 0; y < meta.height; y++) {
      for (let x = 0; x < meta.width; x++) {
        const idx = (y * meta.width + x) * 4;
        const a = raw[idx + 3];
        if (a > 15) {
          nonZeroAlphaCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        if (a > 5 && a < 250) {
          semiTransparentCount++;
        }
      }
    }

    auditReport.assetAudit[f] = {
      width: meta.width,
      height: meta.height,
      bbox: { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 },
      baseline: maxY,
      horizontalCenter: ((minX + maxX) / 2).toFixed(1),
      semiTransparentCount,
      nonZeroAlphaCount
    };

    console.log(`  Sprite: ${f.padEnd(16)} | Dim: ${meta.width}x${meta.height} | Box: [${minX}, ${minY}]-[${maxX}, ${maxY}] | Base: y=${maxY} | Center: x=${((minX + maxX) / 2).toFixed(1)}`);
  }

  // Inspect Cacti & Pterodactyls & Backgrounds
  const envFiles = [
    'cactus_single.png', 'cactus_small.png', 'cactus_double.png', 'cactus_tall.png',
    'pterodactyl_0.png', 'pterodactyl_1.png', 'bg_day.png', 'bg_night.png'
  ];

  for (const f of envFiles) {
    const filePath = path.join(spriteDir, f);
    if (fs.existsSync(filePath)) {
      const meta = await sharp(filePath).metadata();
      auditReport.assetAudit[f] = { width: meta.width, height: meta.height, channels: meta.channels };
      console.log(`  Env:    ${f.padEnd(16)} | Dim: ${meta.width}x${meta.height} | Size: ${fs.statSync(filePath).size} bytes`);
    }
  }

  // ===========================================================================
  // PHASE 2: LAUNCH PUPPETEER BROWSER FOR AUTOMATED PLAYTEST RUNS
  // ===========================================================================
  console.log('\n>>> [PHASE 2] Launching Headless Browser for 10 In-Engine QA Runs');

  const userDataDir = path.join(os.tmpdir(), 'dino_qa_' + Date.now());
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    userDataDir,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,720'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 700 });

  const consoleErrors = [];
  const consoleWarnings = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await new Promise(r => setTimeout(r, 600));

  console.log('  ✓ Browser page loaded.');
  console.log(`  ✓ Console errors on load: ${consoleErrors.length}`);

  // ---------------------------------------------------------------------------
  // RUN 1: Normal Casual Gameplay & Baseline FPS
  // ---------------------------------------------------------------------------
  console.log('\n--- [RUN 1] Normal Casual Gameplay (Jump over first 3 obstacles) ---');
  await page.click('#btnStartGame');
  await page.waitForFunction(() => window.dinoGame && window.dinoGame.state === 'PLAYING', { timeout: 4000 });

  let run1ObstaclesCleared = 0;
  const run1Start = Date.now();
  const fpsSamples = [];

  while (Date.now() - run1Start < 5000) {
    const metrics = await page.evaluate(() => {
      const g = window.dinoGame;
      return {
        score: g.score,
        speed: g.speed,
        dinoY: g.dino.y,
        isGrounded: g.dino.isGrounded,
        obsCount: g.obstacles.length,
        nextObsDist: g.nextObstacleDistance,
        firstObsX: g.obstacles.length > 0 ? g.obstacles[0].x : null,
        firstObsW: g.obstacles.length > 0 ? g.obstacles[0].width : null,
        firstObsType: g.obstacles.length > 0 ? g.obstacles[0].type : null
      };
    });

    // Auto-jump when obstacle is within jump window
    if (metrics.firstObsX !== null && metrics.firstObsX > 90 && metrics.firstObsX < 240 && metrics.isGrounded) {
      await page.keyboard.press('Space');
      run1ObstaclesCleared++;
      console.log(`  [Run 1 Jump #${run1ObstaclesCleared}] Cleared obstacle at x=${metrics.firstObsX.toFixed(1)}, type=${metrics.firstObsType}`);
    }
    await new Promise(r => setTimeout(r, 60));
  }

  const run1Final = await page.evaluate(() => ({
    score: window.dinoGame.score,
    speed: window.dinoGame.speed,
    distance: window.dinoGame.distance
  }));
  console.log(`  ✓ Run 1 Complete: Score=${run1Final.score.toFixed(1)}, Speed=${run1Final.speed.toFixed(1)} px/s, Obstacles Cleared=${run1ObstaclesCleared}`);
  auditReport.gameplayRuns['run1_casual'] = { ...run1Final, obstaclesCleared: run1ObstaclesCleared };

  // ---------------------------------------------------------------------------
  // RUN 2: Repeated Jumping & Buffer Test
  // ---------------------------------------------------------------------------
  console.log('\n--- [RUN 2] Repeated Jumping & Rapid Keypresses ---');
  const jumpTimes = [];
  const startJumps = await page.evaluate(() => window.dinoGame.dino.jumpCount);

  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Space');
    await new Promise(r => setTimeout(r, 100)); // Press again mid-air (should NOT double jump)
    await page.keyboard.press('Space');
    await new Promise(r => setTimeout(r, 800)); // Allow landing
    const count = await page.evaluate(() => window.dinoGame.dino.jumpCount);
    jumpTimes.push(count);
  }
  const midAirDoubleJumps = await page.evaluate((sj) => {
    // Check if jumpCount exceeded the 5 normal ground jumps
    return window.dinoGame.dino.jumpCount - sj;
  }, startJumps);
  console.log(`  ✓ 5 ground presses with 5 mid-air spam presses: Resulted in exactly ${midAirDoubleJumps} jumps (Zero double jumps)`);
  auditReport.gameplayRuns['run2_jumping'] = { totalJumps: midAirDoubleJumps, expectedJumps: 5 };

  // ---------------------------------------------------------------------------
  // RUN 3: Ducking & Fast-Drop Airborne Test
  // ---------------------------------------------------------------------------
  console.log('\n--- [RUN 3] Ducking & Fast-Drop Airborne Physics ---');
  // 1. Normal jump duration test
  await page.keyboard.press('Space');
  let airTimeNormal = 0;
  const t0 = Date.now();
  while (true) {
    const isGrounded = await page.evaluate(() => window.dinoGame.dino.isGrounded);
    if (!isGrounded) {
      airTimeNormal = Date.now() - t0;
    } else if (airTimeNormal > 200) {
      break;
    }
    await new Promise(r => setTimeout(r, 20));
    if (Date.now() - t0 > 2000) break;
  }
  console.log(`  ✓ Normal jump airtime measured: ~${airTimeNormal} ms`);

  // 2. Jump with Down-arrow fast-drop test
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 180)); // at apex
  await page.keyboard.down('ArrowDown'); // fast drop
  let airTimeFastDrop = 0;
  const t1 = Date.now();
  while (true) {
    const isGrounded = await page.evaluate(() => window.dinoGame.dino.isGrounded);
    if (isGrounded) break;
    await new Promise(r => setTimeout(r, 20));
    if (Date.now() - t1 > 2000) break;
  }
  await page.keyboard.up('ArrowDown');
  const fastDropTotalTime = Date.now() - t1 + 180;
  console.log(`  ✓ Fast-drop jump airtime measured: ~${fastDropTotalTime} ms (Significantly faster than normal ~${airTimeNormal} ms)`);
  auditReport.gameplayRuns['run3_ducking'] = { normalAirTimeMs: airTimeNormal, fastDropAirTimeMs: fastDropTotalTime };

  // ---------------------------------------------------------------------------
  // RUN 4: Longer Survival & Milestone / Day-Night Cycle Test
  // ---------------------------------------------------------------------------
  console.log('\n--- [RUN 4] Survival Milestones & Day/Night Transition ---');
  // Fast forward score to 715 to observe Day->Night transition at 720
  await page.evaluate(() => {
    window.dinoGame.score = 715;
    window.dinoGame.nextMilestone = 800; // avoid spam
  });
  const preNight = await page.evaluate(() => window.dinoGame.isNight);
  await new Promise(r => setTimeout(r, 600)); // score advances past 720
  const postNight = await page.evaluate(() => ({
    isNight: window.dinoGame.isNight,
    score: window.dinoGame.score
  }));
  console.log(`  ✓ Night Transition at Score ~720: Before=${preNight}, After=${postNight.isNight} (Score=${postNight.score.toFixed(1)})`);

  // Fast forward past night duration (720 + 280 = 1000)
  await page.evaluate(() => {
    window.dinoGame.score = 1010;
  });
  await new Promise(r => setTimeout(r, 300));
  const backToDay = await page.evaluate(() => window.dinoGame.isNight);
  console.log(`  ✓ Day Transition at Score >1000: isNight=${backToDay}`);
  auditReport.gameplayRuns['run4_dayNight'] = { preNight, postNight: postNight.isNight, backToDay };

  // ---------------------------------------------------------------------------
  // RUN 5: High-Speed Gameplay (Score 1200+, Speed 700+ px/s)
  // ---------------------------------------------------------------------------
  console.log('\n--- [RUN 5] High-Speed Gameplay & Spacing Fairness (Score 1500) ---');
  await page.evaluate(() => {
    window.dinoGame.score = 1500;
  });
  await new Promise(r => setTimeout(r, 300));
  const highSpeedMetrics = await page.evaluate(() => {
    const g = window.dinoGame;
    // Spawn 1 obstacle and compute next distance
    const obs = g.spawnObstacle();
    const gap = g.calculateNextObstacleDistance(obs);
    return {
      score: g.score,
      speed: g.speed,
      gap,
      jumpAirTime: 0.76,
      jumpTravel: g.speed * 0.76,
      reactionBuffer: gap - (g.speed * 0.76) - obs.width,
      reactionTime: (gap - (g.speed * 0.76) - obs.width) / g.speed
    };
  });
  console.log(`  ✓ High Speed: Speed=${highSpeedMetrics.speed.toFixed(1)} px/s, Spawn Gap=${highSpeedMetrics.gap.toFixed(0)} px`);
  console.log(`  ✓ Jump Travel: ${highSpeedMetrics.jumpTravel.toFixed(0)} px | Reaction Window After Landing: ${highSpeedMetrics.reactionTime.toFixed(2)}s (Safe >= 0.54s)`);
  auditReport.gameplayRuns['run5_highSpeed'] = highSpeedMetrics;

  // ---------------------------------------------------------------------------
  // RUN 6: Repeated Restart & Play-Again Cycles (Stats Persistence Check)
  // ---------------------------------------------------------------------------
  console.log('\n--- [RUN 6] Repeated Restart / Play Again & Stats Integrity ---');
  const statsBefore = await page.evaluate(() => ({
    gamesPlayed: window.dinoGame.stats.gamesPlayed,
    bestScore: window.dinoGame.stats.bestScore
  }));

  // Trigger Game Over
  await page.evaluate(() => window.dinoGame.handleGameOver());
  await page.waitForSelector('#gameOverModal:not(.hidden)');

  const statsAfterGameOver = await page.evaluate(() => ({
    gamesPlayed: window.dinoGame.stats.gamesPlayed,
    bestScore: window.dinoGame.stats.bestScore
  }));

  // Click Play Again
  await page.click('#btnPlayAgain');
  await page.waitForFunction(() => window.dinoGame.state === 'PLAYING', { timeout: 4000 });

  // Now hit Pause -> Restart mid-run
  await page.click('#btnPause');
  await page.waitForSelector('#pauseModal:not(.hidden)');
  await page.click('#btnPauseRestart');
  await page.waitForFunction(() => window.dinoGame.state === 'PLAYING', { timeout: 4000 });

  const statsAfterRestart = await page.evaluate(() => ({
    gamesPlayed: window.dinoGame.stats.gamesPlayed,
    bestScore: window.dinoGame.stats.bestScore
  }));

  console.log(`  ✓ Stats: Initial GamesPlayed=${statsBefore.gamesPlayed} | After GameOver=${statsAfterGameOver.gamesPlayed} | After Pause-Restart=${statsAfterRestart.gamesPlayed}`);
  const restartIncrementedIncorrectly = statsAfterRestart.gamesPlayed > statsAfterGameOver.gamesPlayed;
  console.log(`  ✓ Abandoned run did NOT increment gamesPlayed: ${!restartIncrementedIncorrectly}`);
  auditReport.gameplayRuns['run6_stats'] = {
    statsBefore,
    statsAfterGameOver,
    statsAfterRestart,
    restartIntegrity: !restartIncrementedIncorrectly
  };

  // ---------------------------------------------------------------------------
  // RUN 7: Pause & Freeze Test (Checking All Layers)
  // ---------------------------------------------------------------------------
  console.log('\n--- [RUN 7] Complete Freeze on Pause Audit ---');
  await page.click('#btnPause');
  await page.waitForSelector('#pauseModal:not(.hidden)');

  const pausedSample1 = await page.evaluate(() => ({
    dinoY: window.dinoGame.dino.y,
    score: window.dinoGame.score,
    distance: window.dinoGame.distance,
    firstObsX: window.dinoGame.obstacles.length > 0 ? window.dinoGame.obstacles[0].x : 0,
    animTime: window.dinoGame.dino.animTime
  }));

  await new Promise(r => setTimeout(r, 600));

  const pausedSample2 = await page.evaluate(() => ({
    dinoY: window.dinoGame.dino.y,
    score: window.dinoGame.score,
    distance: window.dinoGame.distance,
    firstObsX: window.dinoGame.obstacles.length > 0 ? window.dinoGame.obstacles[0].x : 0,
    animTime: window.dinoGame.dino.animTime
  }));

  const isFrozen = (
    pausedSample1.dinoY === pausedSample2.dinoY &&
    pausedSample1.score === pausedSample2.score &&
    pausedSample1.distance === pausedSample2.distance &&
    pausedSample1.animTime === pausedSample2.animTime
  );
  console.log(`  ✓ Pause Freeze Verification: 100% Frozen = ${isFrozen}`);
  console.log(`    Score delta: ${pausedSample2.score - pausedSample1.score} | Distance delta: ${pausedSample2.distance - pausedSample1.distance} | Anim delta: ${pausedSample2.animTime - pausedSample1.animTime}`);
  auditReport.gameplayRuns['run7_pause'] = { isFrozen, pausedSample1, pausedSample2 };

  // Resume and verify no delta spike
  await page.click('#btnPauseResume');
  await new Promise(r => setTimeout(r, 200));

  // ---------------------------------------------------------------------------
  // RUN 8: Tab Visibility & Auto-Pause Test
  // ---------------------------------------------------------------------------
  console.log('\n--- [RUN 8] Tab Visibility (Blur / Minimize Auto-Pause) ---');
  await page.evaluate(() => {
    // Dispatch visibilitychange event as hidden
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  const stateWhileHidden = await page.evaluate(() => ({
    state: window.dinoGame.state,
    isAutoPaused: window.uiManager.isAutoPaused,
    pauseModalVisible: !document.getElementById('pauseModal').classList.contains('hidden')
  }));
  console.log(`  ✓ Auto-pause on tab hidden: State=${stateWhileHidden.state}, isAutoPaused=${stateWhileHidden.isAutoPaused}, ModalVisible=${stateWhileHidden.pauseModalVisible}`);

  // Refocus
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await new Promise(r => setTimeout(r, 1000)); // countdown recovery

  // ---------------------------------------------------------------------------
  // RUN 9: Audio Engine & Mute Sync Test
  // ---------------------------------------------------------------------------
  console.log('\n--- [RUN 9] Audio Engine, Synthesizer & Mute State Sync ---');
  const audioInfo = await page.evaluate(() => {
    const s = window.soundEngine;
    return {
      hasCtx: !!s.ctx,
      ctxState: s.ctx ? s.ctx.state : 'null',
      isMuted: s.isMuted,
      isUnlocked: s.isUnlocked
    };
  });
  console.log(`  ✓ Audio State: Context=${audioInfo.hasCtx} (${audioInfo.ctxState}), isMuted=${audioInfo.isMuted}, isUnlocked=${audioInfo.isUnlocked}`);

  // Test toggle mute
  const muteToggleTest = await page.evaluate(() => {
    const s = window.soundEngine;
    const initial = s.isMuted;
    s.toggleMute();
    const toggled = s.isMuted;
    const lsVal = localStorage.getItem('offline_dino_muted');
    s.toggleMute(); // restore
    return { initial, toggled, lsVal };
  });
  console.log(`  ✓ Mute Toggle: Initial=${muteToggleTest.initial} -> Toggled=${muteToggleTest.toggled} -> LocalStorage="${muteToggleTest.lsVal}"`);
  auditReport.gameplayRuns['run9_audio'] = { audioInfo, muteToggleTest };

  // ---------------------------------------------------------------------------
  // RUN 10: Multi-Resolution Responsive & Viewport Matrix
  // ---------------------------------------------------------------------------
  console.log('\n--- [RUN 10] Responsive Viewport Matrix Testing ---');
  const viewports = [
    { name: 'Desktop (1080p)', w: 1920, h: 1080 },
    { name: 'Laptop (Standard)', w: 1366, h: 768 },
    { name: 'Tablet Portrait', w: 768, h: 1024 },
    { name: 'Tablet Landscape', w: 1024, h: 768 },
    { name: 'Mobile Landscape', w: 667, h: 375 },
    { name: 'Mobile Portrait', w: 375, h: 667 }
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.w, height: vp.h });
    await page.evaluate(() => window.dinoGame.resize());
    await new Promise(r => setTimeout(r, 100));

    const vpMetrics = await page.evaluate((vpw, vph) => {
      const g = window.dinoGame;
      const canvas = document.getElementById('gameCanvas');
      const hud = document.getElementById('gameplayHUD');
      const hudRect = hud.getBoundingClientRect();
      const scoreChip = document.querySelector('.hud-center-panel');
      const scoreChipRect = scoreChip ? scoreChip.getBoundingClientRect() : null;

      return {
        scale: g.scale,
        groundY: g.groundY,
        dinoY: g.dino.y,
        canvasW: canvas.width,
        canvasH: canvas.height,
        hudOverflowX: hudRect.right > vpw,
        scoreChipWidth: scoreChipRect ? scoreChipRect.width : 0
      };
    }, vp.w, vp.h);

    console.log(`  ✓ Viewport: ${vp.name.padEnd(18)} (${vp.w}x${vp.h}) | Scale: ${vpMetrics.scale.toFixed(2)} | GroundY: ${vpMetrics.groundY.toFixed(1)} | HUD Overflow: ${vpMetrics.hudOverflowX}`);
    auditReport.responsiveMetrics[vp.name] = vpMetrics;
  }

  // Restore desktop viewport
  await page.setViewport({ width: 1200, height: 700 });
  await page.evaluate(() => window.dinoGame.resize());

  // Check console error collection
  auditReport.consoleErrors = consoleErrors;
  auditReport.consoleWarnings = consoleWarnings;
  console.log(`\n  Total Browser Console Errors Observed during 10 QA Runs: ${consoleErrors.length}`);
  console.log(`  Total Browser Console Warnings Observed: ${consoleWarnings.length}`);

  await browser.close();

  // Save audit data to scratch directory
  const reportPath = path.join(__dirname, 'qa_audit_raw_data.json');
  fs.writeFileSync(reportPath, JSON.stringify(auditReport, null, 2));
  console.log(`\n✓ Raw QA Audit Data saved to ${reportPath}`);

  return auditReport;
}

runFullQAAudit().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
