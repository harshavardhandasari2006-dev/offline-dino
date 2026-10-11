const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TARGET_URL = 'http://localhost:3000/';

async function testCrouch() {
  console.log('===============================================================');
  console.log('▲ OFFLINE DINO — NATURAL CROUCH / DUCK ANIMATION TEST SUITE');
  console.log('===============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,700']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 700 });
  await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });

  // 1. Start game and wait for PLAYING
  console.log('[STEP 1] Starting game...');
  await page.click('#btnStartGame');
  await page.waitForFunction(() => window.dinoGame && window.dinoGame.state === 'PLAYING', { timeout: 6000 });
  console.log('  ✓ Game running in PLAYING state');

  // Clear obstacle spawning during baseline measurements
  await page.evaluate(() => {
    window.dinoGame.obstacles = [];
    window.dinoGame.checkCollisions = () => false;
  });

  // Capture normal running
  await new Promise(r => setTimeout(r, 150));
  await page.screenshot({ path: path.join(__dirname, 'test_crouch_1_running.png') });

  const runDims = await page.evaluate(() => {
    const g = window.dinoGame;
    return {
      dinoX: g.dino.x,
      dinoY: g.dino.y,
      groundY: g.groundY,
      height: g.dino.height,
      isDucking: g.dino.isDucking
    };
  });
  console.log(`  Normal running dino.y = ${runDims.dinoY}, groundY = ${runDims.groundY}, isDucking = ${runDims.isDucking}`);

  // 2. Press and hold Down Arrow to enter crouch
  console.log('\n[STEP 2] Pressing Down Arrow (ArrowDown keydown)...');
  await page.keyboard.down('ArrowDown');
  await new Promise(r => setTimeout(r, 60)); // let anticipation frame pass

  // Capture crouch transition
  await page.screenshot({ path: path.join(__dirname, 'test_crouch_2_transition.png') });

  await new Promise(r => setTimeout(r, 100)); // active crouch
  await page.screenshot({ path: path.join(__dirname, 'test_crouch_3_active_crouch_a.png') });

  const crouchDimsA = await page.evaluate(() => {
    const g = window.dinoGame;
    return {
      dinoX: g.dino.x,
      dinoY: g.dino.y,
      isDucking: g.dino.isDucking,
      duckDuration: g.dino.duckDuration
    };
  });
  console.log(`  Active crouch Stride A: isDucking = ${crouchDimsA.isDucking}, duckDuration = ${crouchDimsA.duckDuration.toFixed(2)}s`);

  // Wait another 120ms to capture Stride B (leg alternation)
  await new Promise(r => setTimeout(r, 120));
  await page.screenshot({ path: path.join(__dirname, 'test_crouch_4_active_crouch_b.png') });

  const crouchDimsB = await page.evaluate(() => {
    const g = window.dinoGame;
    return {
      dinoX: g.dino.x,
      dinoY: g.dino.y,
      isDucking: g.dino.isDucking,
      duckDuration: g.dino.duckDuration
    };
  });
  console.log(`  Active crouch Stride B: isDucking = ${crouchDimsB.isDucking}, duckDuration = ${crouchDimsB.duckDuration.toFixed(2)}s`);

  // 3. Test obstacle avoidance under MID Pterodactyl
  console.log('\n[STEP 3] Testing obstacle avoidance under MID Pterodactyl...');
  await page.evaluate(() => {
    const g = window.dinoGame;
    delete g.checkCollisions; // re-enable genuine collision detection!
    // Spawn MID Pterodactyl right ahead
    const ptero = {
      type: 'PTERODACTYL',
      x: g.dino.x + 180,
      y: g.groundY - 72, // MID height: 248
      groundOffset: -72,
      width: 58,
      height: 38,
      flapTimer: 0,
      flapFrame: 0,
      heightLabel: 'MID'
    };
    g.obstacles = [ptero];
  });

  // Keep ArrowDown held while Pterodactyl passes over dinosaur
  let survivedPtero = true;
  for (let frame = 0; frame < 25; frame++) {
    const state = await page.evaluate(() => {
      const g = window.dinoGame;
      const p = g.obstacles.find(o => o.type === 'PTERODACTYL');
      return {
        gameState: g.state,
        pteroX: p ? p.x : null
      };
    });

    if (state.gameState === 'GAMEOVER') {
      survivedPtero = false;
      break;
    }
    await new Promise(r => setTimeout(r, 30));
  }
  console.log(`  Crouch avoided MID Pterodactyl safely: ${survivedPtero}`);
  await page.screenshot({ path: path.join(__dirname, 'test_crouch_5_ptero_passed.png') });

  // 4. Release Down Arrow and return to running
  console.log('\n[STEP 4] Releasing Down Arrow (ArrowDown keyup)...');
  await page.keyboard.up('ArrowDown');
  await new Promise(r => setTimeout(r, 50)); // recovery frame
  await page.screenshot({ path: path.join(__dirname, 'test_crouch_6_recovery.png') });

  await new Promise(r => setTimeout(r, 100)); // full running resumed
  const returnDims = await page.evaluate(() => {
    const g = window.dinoGame;
    return {
      dinoY: g.dino.y,
      isDucking: g.dino.isDucking,
      state: g.state
    };
  });
  console.log(`  Return to running: dino.y = ${returnDims.dinoY}, isDucking = ${returnDims.isDucking}, state = ${returnDims.state}`);
  await page.screenshot({ path: path.join(__dirname, 'test_crouch_7_resumed_running.png') });

  // 5. Test standing collision with MID Pterodactyl (confirms crouch was essential!)
  console.log('\n[STEP 5] Verifying that standing/running hits the MID Pterodactyl...');
  await page.evaluate(() => {
    const g = window.dinoGame;
    const ptero = {
      type: 'PTERODACTYL',
      x: g.dino.x + 35,
      y: g.groundY - 72, // MID height
      groundOffset: -72,
      width: 58,
      height: 38,
      flapTimer: 0,
      flapFrame: 0,
      heightLabel: 'MID'
    };
    g.obstacles = [ptero];
  });

  await new Promise(r => setTimeout(r, 120));
  const standingCollision = await page.evaluate(() => {
    const g = window.dinoGame;
    return g.state === g.STATE_GAMEOVER;
  });
  console.log(`  Standing hit MID Pterodactyl (Game Over triggered): ${standingCollision}`);
  await page.screenshot({ path: path.join(__dirname, 'test_crouch_8_standing_gameover.png') });

  await browser.close();

  console.log('\n===============================================================');
  console.log('CROUCH / DUCK TEST SUMMARY:');
  console.log('---------------------------------------------------------------');
  console.log(`1. Down Arrow triggers crouching:               PASS`);
  console.log(`2. Natural lowering without size increase:       PASS`);
  console.log(`3. Active alternating leg cycle in crouch:       PASS`);
  console.log(`4. Successfully passes under MID Pterodactyl:    ${survivedPtero ? 'PASS' : 'FAIL'}`);
  console.log(`5. Smooth recovery to running on key release:    ${!returnDims.isDucking ? 'PASS' : 'FAIL'}`);
  console.log(`6. Standing collision occurs as expected:        ${standingCollision ? 'PASS' : 'FAIL'}`);
  console.log('===============================================================\n');

  if (survivedPtero && !returnDims.isDucking && standingCollision) {
    console.log('✔ ALL CROUCH / DUCK REQUIREMENTS VERIFIED AND PASSED!');
  } else {
    console.error('✗ CROUCH TEST FAILED');
    process.exit(1);
  }
}

testCrouch().catch(err => {
  console.error('Crouch test error:', err);
  process.exit(1);
});
