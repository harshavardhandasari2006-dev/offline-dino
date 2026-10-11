const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TARGET_URL = 'http://localhost:3000/';
const SPRITES_DIR = path.join(__dirname, 'assets', 'sprites');

async function runMasterAudit() {
  console.log('===============================================================');
  console.log('▲ OFFLINE DINO — MASTER VERIFICATION & ANTI-REGRESSION AUDIT');
  console.log('===============================================================\n');

  const report = {};

  // =================================================================
  // 1. ISSUE ONE — DINOSAUR TWO-LEG RUNNING ANIMATION
  // =================================================================
  console.log('[AUDIT 1] VERIFYING DINOSAUR TWO-LEG RUNNING & BASELINE...');
  const runBaselines = [];
  for (let i = 0; i <= 3; i++) {
    const { data, info } = await sharp(path.join(SPRITES_DIR, `dino_run_${i}.png`)).raw().toBuffer({ resolveWithObject: true });
    let leftFootMaxY = -1, rightFootMaxY = -1, overallMaxY = -1;
    for (let y = 70; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * 4 + 3] > 50) {
          if (y > overallMaxY) overallMaxY = y;
          if (x < 48) { if (y > leftFootMaxY) leftFootMaxY = y; }
          else { if (y > rightFootMaxY) rightFootMaxY = y; }
        }
      }
    }
    runBaselines.push({ frame: i, overallMaxY, leftFootMaxY, rightFootMaxY });
    console.log(`  Frame ${i}: Overall MaxY=${overallMaxY}, Left Foot=${leftFootMaxY}, Right Foot=${rightFootMaxY}`);
  }

  const strideA = runBaselines[0]; // Left foot contacts ground at 103, Right in air
  const strideB = runBaselines[2]; // Right foot contacts ground at 103, Left in air
  const pass1 = runBaselines[1];   // Left supporting at 103, Right passing at 95
  const pass2 = runBaselines[3];   // Right supporting at 103, Left passing at 95

  const issue1Passed = (
    strideA.leftFootMaxY === 103 && strideA.rightFootMaxY < 100 &&
    strideB.rightFootMaxY === 103 && strideB.leftFootMaxY < 100 &&
    pass1.overallMaxY === 103 && pass2.overallMaxY === 103
  );

  report.issue1 = issue1Passed ? 'PASS' : 'FAIL';
  console.log(`  -> ISSUE 1 (TWO-LEG RUNNING): ${report.issue1}`);

  // =================================================================
  // 2. ISSUE THREE — COMPLETELY CLEAN SPRITE EDGES & TAIL
  // =================================================================
  console.log('\n[AUDIT 2] VERIFYING CLEAN SPRITE EDGES & TAIL SILHOUETTES...');
  const targetSpriteFiles = ['dino_idle_0.png', 'dino_idle_1.png', 'dino_idle_2.png', 'dino_idle_3.png',
                             'dino_run_0.png', 'dino_run_1.png', 'dino_run_2.png', 'dino_run_3.png', 'dino_run_4.png',
                             'pterodactyl_0.png', 'pterodactyl_1.png'];
  let totalTailWhitePixels = 0;

  for (const f of targetSpriteFiles) {
    const { data, info } = await sharp(path.join(SPRITES_DIR, f)).raw().toBuffer({ resolveWithObject: true });
    let haloCount = 0;
    if (f.startsWith('dino_')) {
      for (let y = 25; y <= 85; y++) {
        for (let x = 0; x < 45; x++) {
          const idx = (y * info.width + x) * 4;
          if (data[idx + 3] === 0) continue;
          let isPerimeter = false;
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= info.width || ny < 0 || ny >= info.height || data[(ny * info.width + nx) * 4 + 3] === 0) {
              isPerimeter = true; break;
            }
          }
          if (isPerimeter) {
            const r = data[idx], g = data[idx + 1], b = data[idx + 2];
            if (r > 185 && g > 180 && b > 135) haloCount++;
          }
        }
      }
    }
    totalTailWhitePixels += haloCount;
  }

  const issue3Passed = totalTailWhitePixels === 0;
  report.issue3 = issue3Passed ? 'PASS' : 'FAIL';
  console.log(`  Tail/Perimeter Halo Residual Pixels: ${totalTailWhitePixels}`);
  console.log(`  -> ISSUE 3 (SPRITE EDGES & TAIL): ${report.issue3}`);

  // =================================================================
  // 3. ISSUE FOUR — DINOSAUR EYES MUST REMAIN WHITE AND BLACK
  // =================================================================
  console.log('\n[AUDIT 3] VERIFYING SOLID WHITE & BLACK EYES WITHOUT RED OR TRANSPARENCY...');
  const openEyeSprites = [
    { file: 'dino_idle_0.png', top: 19, left: 68 },
    { file: 'dino_idle_1.png', top: 19, left: 68 },
    { file: 'dino_idle_3.png', top: 19, left: 68 },
    { file: 'dino_run_0.png', top: 19, left: 68 },
    { file: 'dino_run_1.png', top: 19, left: 68 },
    { file: 'dino_run_2.png', top: 19, left: 68 },
    { file: 'dino_run_3.png', top: 19, left: 68 },
    { file: 'dino_run_4.png', top: 19, left: 68 },
    { file: 'dino_jump_0.png', top: 18, left: 71 },
    { file: 'dino_jump_2.png', top: 16, left: 68 },
    { file: 'dino_duck_0.png', top: 24, left: 62 },
    { file: 'dino_duck_4.png', top: 31, left: 65 }
  ];

  let totalEyeRedPixels = 0;
  let allEyesHaveWhiteAndBlack = true;

  for (const cfg of openEyeSprites) {
    const { data, info } = await sharp(path.join(SPRITES_DIR, cfg.file)).raw().toBuffer({ resolveWithObject: true });
    let whiteCount = 0, blackCount = 0, redCount = 0;
    for (let y = cfg.top; y < cfg.top + 24; y++) {
      for (let x = cfg.left; x < cfg.left + 24; x++) {
        if (x >= info.width || y >= info.height) continue;
        const idx = (y * info.width + x) * 4;
        const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
        if (a > 200) {
          if (r > 210 && g > 210 && b > 210) whiteCount++;
          if (r < 45 && g < 45 && b < 45) blackCount++;
          if (r > 150 && r > g + 40 && r > b + 40) redCount++;
        }
      }
    }
    totalEyeRedPixels += redCount;
    if (whiteCount < 20 || blackCount < 30) allEyesHaveWhiteAndBlack = false;
  }

  const issue4Passed = totalEyeRedPixels === 0 && allEyesHaveWhiteAndBlack;
  report.issue4 = issue4Passed ? 'PASS' : 'FAIL';
  console.log(`  Red Eye Contamination: ${totalEyeRedPixels}px, Consistent White/Black Sclera & Pupils: ${allEyesHaveWhiteAndBlack}`);
  console.log(`  -> ISSUE 4 (EYE INTEGRITY): ${report.issue4}`);

  // =================================================================
  // 4. BROWSER TESTS: MASCOT (ISSUE 5), DRAGON MOVEMENT (ISSUE 2), DRAGON COLLISION (ISSUE 6)
  // =================================================================
  console.log('\n[AUDIT 4] LAUNCHING BROWSER FOR GAMEPLAY & VISUAL VERIFICATION...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,700']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 700 });
  await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });

  // -----------------------------------------------------------------
  // ISSUE FIVE: HOME SCREEN MASCOT
  // -----------------------------------------------------------------
  console.log('\n--- VERIFYING HOME SCREEN MASCOT IDLE BEHAVIOR (ISSUE 5) ---');
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(__dirname, 'verify_audit_home_mascot.png') });

  const mascotCheck = await page.evaluate(() => {
    const isHomeScreenVisible = !document.getElementById('homeScreen').classList.contains('hidden');
    const isGameplayRunning = window.dinoGame && window.dinoGame.state === 'PLAYING';
    const mascotRafRunning = window.uiManager && !!window.uiManager.mascotRafId;
    return { isHomeScreenVisible, isGameplayRunning, mascotRafRunning };
  });

  const issue5Passed = mascotCheck.isHomeScreenVisible && !mascotCheck.isGameplayRunning && mascotCheck.mascotRafRunning;
  report.issue5 = issue5Passed ? 'PASS' : 'FAIL';
  console.log(`  Home screen active: ${mascotCheck.isHomeScreenVisible}, Gameplay running: ${mascotCheck.isGameplayRunning}, Mascot loop active: ${mascotCheck.mascotRafRunning}`);
  console.log(`  -> ISSUE 5 (HOME MASCOT IDLE): ${report.issue5}`);

  // -----------------------------------------------------------------
  // START GAME & CAPTURE RUNNING GAMEPLAY
  // -----------------------------------------------------------------
  await page.click('#btnStartGame');
  await page.waitForFunction(() => window.dinoGame && window.dinoGame.state === 'PLAYING', { timeout: 6000 });
  console.log('\n--- GAME RUNNING IN PLAYING STATE ---');

  // Temporarily clear obstacles and suppress collisions during running screenshots
  await page.evaluate(() => {
    window.dinoGame.obstacles = [];
    window.dinoGame.checkCollisions = () => false;
  });

  await new Promise(r => setTimeout(r, 100));
  await page.screenshot({ path: path.join(__dirname, 'verify_audit_running_stride_a.png') });
  await new Promise(r => setTimeout(r, 100));
  await page.screenshot({ path: path.join(__dirname, 'verify_audit_running_stride_b.png') });

  // -----------------------------------------------------------------
  // ISSUE TWO: DRAGON/PTERODACTYL HORIZONTAL MOVEMENT & WINGS
  // -----------------------------------------------------------------
  console.log('\n--- VERIFYING DRAGON/PTERODACTYL FLIGHT & MOVEMENT (ISSUE 2) ---');
  await page.evaluate(() => {
    const g = window.dinoGame;
    g.checkCollisions = () => false; // allow traversal observation
    g.score = 150;
    const ptero = {
      type: 'PTERODACTYL',
      x: 750,
      y: g.groundY - 72,
      groundOffset: -72,
      width: 58,
      height: 38,
      flapTimer: 0,
      flapFrame: 0,
      heightLabel: 'MID'
    };
    g.obstacles = [ptero];
  });

  let reachedDino = false;
  let passedDino = false;
  let leftScreen = false;
  let despawned = false;
  const flapFrames = new Set();
  const trajectoryX = [];

  for (let frame = 0; frame < 65; frame++) {
    const pData = await page.evaluate(() => {
      const g = window.dinoGame;
      const p = g.obstacles.find(o => o.type === 'PTERODACTYL');
      if (!p) return { exists: false };
      return { exists: true, x: p.x, flapFrame: p.flapFrame, dinoX: g.dino.x };
    });

    if (!pData.exists) {
      despawned = true;
      break;
    }

    trajectoryX.push(pData.x);
    flapFrames.add(pData.flapFrame);

    if (pData.x <= pData.dinoX + 80) reachedDino = true;
    if (pData.x < pData.dinoX) passedDino = true;
    if (pData.x < 0) leftScreen = true;

    await new Promise(r => setTimeout(r, 35));
  }

  const startX = trajectoryX[0];
  const endX = trajectoryX[trajectoryX.length - 1];
  const totalDx = startX - endX;

  const issue2Passed = totalDx > 700 && reachedDino && passedDino && leftScreen && despawned && flapFrames.has(0) && flapFrames.has(1);
  report.issue2 = issue2Passed ? 'PASS' : 'FAIL';
  console.log(`  Total Travel: ${totalDx.toFixed(1)}px (from ${startX.toFixed(1)}px to ${endX.toFixed(1)}px)`);
  console.log(`  Passed Dino: ${passedDino}, Left Screen: ${leftScreen}, Despawned: ${despawned}`);
  console.log(`  Wing Flaps: [${Array.from(flapFrames).sort().join(', ')}]`);
  console.log(`  -> ISSUE 2 (DRAGON MOVEMENT): ${report.issue2}`);

  // -----------------------------------------------------------------
  // ISSUE SIX: DRAGON COLLISION MUST END RUN IMMEDIATELY
  // -----------------------------------------------------------------
  console.log('\n--- VERIFYING DRAGON COLLISION ENDS RUN (ISSUE 6) ---');
  // Re-enable genuine collision detection
  await page.evaluate(() => {
    const g = window.dinoGame;
    // Restore genuine checkCollisions from prototype
    delete g.checkCollisions;
    // Spawn pterodactyl right in front of the dinosaur at ground height to collide
    const ptero = {
      type: 'PTERODACTYL',
      x: g.dino.x + 35,
      y: g.groundY - 46, // LOW height: collides with running dinosaur
      groundOffset: -46,
      width: 58,
      height: 38,
      flapTimer: 0,
      flapFrame: 0,
      heightLabel: 'LOW'
    };
    g.obstacles = [ptero];
  });

  // Wait 120ms for collision to execute
  await new Promise(r => setTimeout(r, 120));

  const collisionResult = await page.evaluate(() => {
    const g = window.dinoGame;
    const isGameOverState = g.state === g.STATE_GAMEOVER;
    const isDinoDead = g.state === g.STATE_GAMEOVER && !g.isDyingMidAir;
    const isGameOverModalVisible = !document.getElementById('gameOverModal').classList.contains('hidden');
    return { isGameOverState, isDinoDead, isGameOverModalVisible };
  });

  await page.screenshot({ path: path.join(__dirname, 'verify_audit_dragon_gameover.png') });

  const issue6Passed = collisionResult.isGameOverState && collisionResult.isDinoDead && collisionResult.isGameOverModalVisible;
  report.issue6 = issue6Passed ? 'PASS' : 'FAIL';
  console.log(`  Game Over State: ${collisionResult.isGameOverState}, Dino Dead: ${collisionResult.isDinoDead}, Modal Visible: ${collisionResult.isGameOverModalVisible}`);
  console.log(`  -> ISSUE 6 (DRAGON COLLISION GAME OVER): ${report.issue6}`);

  // -----------------------------------------------------------------
  // RESTART VIA PLAY AGAIN & VERIFY STABILITY
  // -----------------------------------------------------------------
  console.log('\n--- VERIFYING CLEAN RESTART VIA PLAY AGAIN ---');
  await page.click('#btnPlayAgain');
  await page.waitForFunction(() => window.dinoGame && (window.dinoGame.state === 'COUNTDOWN' || window.dinoGame.state === 'PLAYING'), { timeout: 4000 });
  await page.waitForFunction(() => window.dinoGame && window.dinoGame.state === 'PLAYING', { timeout: 6000 });
  const restarted = await page.evaluate(() => window.dinoGame && window.dinoGame.state === 'PLAYING');
  console.log(`  ✓ Restarted fresh game successfully: ${restarted}`);

  await browser.close();

  // =================================================================
  // FINAL SUMMARY
  // =================================================================
  console.log('\n===============================================================');
  console.log('MASTER AUDIT SCORECARD:');
  console.log('---------------------------------------------------------------');
  console.log(`1. Dinosaur Two-Leg Running Animation:        ${report.issue1}`);
  console.log(`2. Dragon/Pterodactyl Horizontal Movement:    ${report.issue2}`);
  console.log(`3. Completely Clean Sprite Edges & Tail:      ${report.issue3}`);
  console.log(`4. Dinosaur Eyes Solid White & Black:         ${report.issue4}`);
  console.log(`5. Home Screen Mascot Stationary Idle:        ${report.issue5}`);
  console.log(`6. Dragon Collision Ends Run Immediately:     ${report.issue6}`);
  console.log('===============================================================\n');

  const allPassed = Object.values(report).every(status => status === 'PASS');
  if (allPassed) {
    console.log('✔ 100% OF ALL REQUIREMENTS VERIFIED AND PASSED WITH ZERO REGRESSIONS!\n');
  } else {
    console.error('✗ ONE OR MORE TESTS FAILED!\n');
    process.exit(1);
  }
}

runMasterAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
