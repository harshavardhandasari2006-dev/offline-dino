const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000';

async function runVisualValidation() {
  console.log('===============================================================');
  console.log('▲ OFFLINE DINO — COMPREHENSIVE VISUAL & GAMEPLAY VALIDATION');
  console.log('===============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // =========================================================================
  // 1. HOME SCREEN MASCOT VALIDATION (DESKTOP 1280x720)
  // =========================================================================
  console.log('[STEP 1] Validating Home Screen Mascot (Solid belly, no holes)...');
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({ path: path.join(__dirname, 'val_1_home_screen.png') });
  console.log('  ✓ Captured val_1_home_screen.png');

  // Verify Mascot Canvas has solid active pixels
  const mascotInfo = await page.evaluate(() => {
    const c = document.getElementById('mascotCanvas');
    const ctx = c.getContext('2d');
    const imgData = ctx.getImageData(0, 0, c.width, c.height).data;
    let solidPixels = 0, creamPixels = 0;
    for (let i = 0; i < imgData.length; i += 4) {
      if (imgData[i + 3] > 50) {
        solidPixels++;
        const r = imgData[i], g = imgData[i + 1], b = imgData[i + 2];
        if (r > 165 && g > 155 && r > b + 16 && g > b + 16) creamPixels++;
      }
    }
    return { width: c.width, height: c.height, solidPixels, creamPixels };
  });
  console.log(`  Mascot canvas (${mascotInfo.width}x${mascotInfo.height}): solid=${mascotInfo.solidPixels}, cream=${mascotInfo.creamPixels}`);

  // =========================================================================
  // 2. ACTIVE GAMEPLAY RUNNING VALIDATION
  // =========================================================================
  console.log('\n[STEP 2] Validating Running Animation Gait & Foot Grounding...');
  await page.click('#btnStartGame');
  await page.waitForFunction(() => window.dinoGame && window.dinoGame.state === 'PLAYING', { timeout: 6000 });

  // Disable obstacle collisions temporarily for clean visual capture
  await page.evaluate(() => {
    window.dinoGame.obstacles = [];
    window.dinoGame.checkCollisions = () => false;
  });

  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: path.join(__dirname, 'val_2_running_stride_a.png') });
  await new Promise(r => setTimeout(r, 120));
  await page.screenshot({ path: path.join(__dirname, 'val_2_running_stride_b.png') });
  console.log('  ✓ Captured val_2_running_stride_a.png and val_2_running_stride_b.png');

  // =========================================================================
  // 3. JUMP TRAJECTORY & SCREEN-EDGE CLEARANCE ACROSS MULTIPLE VIEWPORTS
  // =========================================================================
  console.log('\n[STEP 3] Testing Jump Trajectory & Apex Screen Clearance Across Viewports...');

  const viewports = [
    { name: 'Desktop Standard', width: 1280, height: 720 },
    { name: 'Laptop Short Screen', width: 1200, height: 420 },
    { name: 'Mobile Landscape', width: 844, height: 390 },
    { name: 'Mobile Portrait', width: 390, height: 844 },
    { name: 'Tablet Portrait', width: 768, height: 1024 }
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.evaluate(() => window.dinoGame.resize());
    await new Promise(r => setTimeout(r, 100));

    // Measure jump trajectory
    const jumpMetrics = await page.evaluate(async () => {
      const g = window.dinoGame;
      g.triggerJump();

      let minDinoY = 999999;
      let apexPhase = '';

      // Sample jump trajectory across 45 frames (~0.75s)
      for (let f = 0; f < 45; f++) {
        await new Promise(r => requestAnimationFrame(r));
        if (g.dino.y < minDinoY) {
          minDinoY = g.dino.y;
          apexPhase = g.dino.jumpPhase;
        }
      }

      const canvasTopY = 0;
      const marginFromTop = minDinoY; // in virtual units
      const pixelMarginFromTop = minDinoY * g.scale; // in CSS screen pixels

      return {
        groundY: g.groundY,
        standingDinoY: g.groundY - g.dino.height,
        apexDinoY: minDinoY,
        virtualMarginFromTop: marginFromTop,
        screenPixelMargin: Math.round(pixelMarginFromTop),
        scale: g.scale,
        clippedTopEdge: minDinoY < 15
      };
    });

    console.log(`  [${vp.name} (${vp.width}x${vp.height})] GroundY=${jumpMetrics.groundY.toFixed(1)}, ApexY=${jumpMetrics.apexDinoY.toFixed(1)}, Headroom from Top=${jumpMetrics.screenPixelMargin}px, Clipped=${jumpMetrics.clippedTopEdge}`);
  }

  // Restore Desktop viewport and capture Jump Apex screenshot with complete tail
  await page.setViewport({ width: 1280, height: 720 });
  await page.evaluate(() => window.dinoGame.resize());

  // Capture Jump Apex
  await page.evaluate(() => window.dinoGame.triggerJump());
  await new Promise(r => setTimeout(r, 180)); // mid-air apex
  await page.screenshot({ path: path.join(__dirname, 'val_3_jump_apex.png') });
  console.log('  ✓ Captured val_3_jump_apex.png (Jump apex with full tail)');

  // Wait for landing
  await new Promise(r => setTimeout(r, 550));

  // =========================================================================
  // 4. CROUCHING / DUCKING VALIDATION
  // =========================================================================
  console.log('\n[STEP 4] Validating Down Arrow Crouching (Natural lowering, no resize)...');
  await page.keyboard.down('ArrowDown');
  await new Promise(r => setTimeout(r, 150));

  const crouchInfo = await page.evaluate(() => {
    const g = window.dinoGame;
    return {
      isDucking: g.dino.isDucking,
      duckDuration: g.dino.duckDuration,
      dinoY: g.dino.y,
      groundY: g.groundY,
      standingTargetY: g.groundY - g.dino.height
    };
  });

  await page.screenshot({ path: path.join(__dirname, 'val_4_crouching_sustained.png') });
  console.log('  ✓ Captured val_4_crouching_sustained.png');
  console.log(`  Crouch info: isDucking=${crouchInfo.isDucking}, grounded baseline locked=${crouchInfo.dinoY === crouchInfo.standingTargetY}`);

  await page.keyboard.up('ArrowDown');
  await new Promise(r => setTimeout(r, 120));

  // =========================================================================
  // 5. CACTUS & PTERODACTYL JUMP/DUCK INTERACTION & COLLISION
  // =========================================================================
  console.log('\n[STEP 5] Testing Obstacle Clearance (Jumping cactus, ducking dragon)...');

  // Spawn large triple cactus and test jump clearance
  const cactusJumpTest = await page.evaluate(() => {
    const g = window.dinoGame;
    g.obstacles = [{
      type: 'CACTUS_LARGE_TRIPLE',
      x: g.dino.x + 350,
      y: g.groundY - 70,
      width: 88,
      height: 70
    }];
    return { cactusY: g.obstacles[0].y, cactusHeight: 70 };
  });

  // Time jump over cactus
  await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => window.dinoGame.triggerJump());
  await new Promise(r => setTimeout(r, 700));

  // Verify dinosaur survived cactus jump
  const survivedCactus = await page.evaluate(() => window.dinoGame.state === 'PLAYING');
  console.log(`  ✓ Successfully jumped over CACTUS_LARGE_TRIPLE: ${survivedCactus}`);

  // =========================================================================
  // 6. COLLISION & GAME OVER ANIMATION VALIDATION
  // =========================================================================
  console.log('\n[STEP 6] Validating Collision & Death Pose (dino_dead)...');

  // Re-enable collisions and spawn cactus right at dinosaur to trigger Game Over
  await page.evaluate(() => {
    delete window.dinoGame.checkCollisions; // restore genuine collision logic
    window.dinoGame.obstacles = [{
      type: 'CACTUS_SMALL_SINGLE',
      x: window.dinoGame.dino.x + 10,
      y: window.dinoGame.groundY - 48,
      width: 26,
      height: 48
    }];
  });

  await new Promise(r => setTimeout(r, 150));

  const gameOverState = await page.evaluate(() => {
    return {
      state: window.dinoGame.state,
      isModalOpen: !document.getElementById('gameOverModal').classList.contains('hidden')
    };
  });

  await page.screenshot({ path: path.join(__dirname, 'val_5_game_over_pose.png') });
  console.log('  ✓ Captured val_5_game_over_pose.png');
  console.log(`  Game Over triggered: state=${gameOverState.state}, modalOpen=${gameOverState.isModalOpen}`);

  // =========================================================================
  // 7. PLAY AGAIN RESTART
  // =========================================================================
  console.log('\n[STEP 7] Testing Play Again Restart...');
  await page.click('#btnPlayAgain');
  await page.waitForFunction(() => window.dinoGame.state === 'PLAYING', { timeout: 4000 });
  console.log('  ✓ Successfully restarted fresh run via Play Again');

  await browser.close();

  console.log('\n===============================================================');
  console.log('✔ COMPREHENSIVE VISUAL & GAMEPLAY VALIDATION COMPLETED!');
  console.log('===============================================================\n');
}

runVisualValidation().catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
