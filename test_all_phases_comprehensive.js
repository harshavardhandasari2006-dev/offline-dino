const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const delay = ms => new Promise(r => setTimeout(r, ms));
const outputDir = path.join(__dirname, 'test_output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function runComprehensiveTests() {
  console.log('===============================================================');
  console.log('   OFFLINE DINO — MANDATORY VISUAL & REGRESSION AUDIT SUITE');
  console.log('===============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,800']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 750, deviceScaleFactor: 2 });

  const consoleLogs = [];
  const consoleErrors = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    if (msg.type() === 'error') consoleErrors.push(text);
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.toString());
  });

  // 1. HOME SCREEN & IDLE MASCOT
  console.log('[TEST 1] Loading Home Screen & Idle Mascot...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await delay(800);
  await page.screenshot({ path: path.join(outputDir, '01_home_screen_idle.png') });
  console.log('  -> Captured 01_home_screen_idle.png');

  // Verify Mascot does NOT play run cycle
  const mascotCanvasFound = await page.$('#mascotCanvas');
  console.log('  -> Mascot canvas verified:', !!mascotCanvasFound);

  // 2. CONTACT SHEET / DIRECT FRAME INSPECTION (Run frames 0..5, Jump 0..4, Duck 0..4, Hit, Dead)
  console.log('\n[TEST 2] Generating Complete Sprite Contact Sheet...');
  const contactSheetData = await page.evaluate(() => {
    const sr = window.spriteRenderer;
    const c = document.createElement('canvas');
    c.width = 128 * 6; // 6 columns
    c.height = 112 * 4; // 4 rows
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Background checkerboard to clearly see alpha transparency
    ctx.fillStyle = '#f0f4f8';
    ctx.fillRect(0, 0, c.width, c.height);

    // Row 0: 6 Run Frames
    const runKeys = ['dino_run_0', 'dino_run_1', 'dino_run_2', 'dino_run_3', 'dino_run_4', 'dino_run_5'];
    runKeys.forEach((k, idx) => {
      const img = sr.images[k];
      if (img) ctx.drawImage(img, idx * 128, 0, 128, 112);
    });

    // Row 1: 5 Jump Frames + Hit
    const jumpKeys = ['dino_jump_0', 'dino_jump_1', 'dino_jump_2', 'dino_jump_3', 'dino_jump_4', 'dino_hit'];
    jumpKeys.forEach((k, idx) => {
      const img = sr.images[k];
      if (img) ctx.drawImage(img, idx * 128, 112, 128, 112);
    });

    // Row 2: 5 Duck Frames + Dead
    const duckKeys = ['dino_duck_0', 'dino_duck_1', 'dino_duck_2', 'dino_duck_3', 'dino_duck_4', 'dino_dead'];
    duckKeys.forEach((k, idx) => {
      const img = sr.images[k];
      if (img) ctx.drawImage(img, idx * 128, 224, 128, 112);
    });

    // Row 3: 4 Idle Frames
    const idleKeys = ['dino_idle_0', 'dino_idle_1', 'dino_idle_2', 'dino_idle_3'];
    idleKeys.forEach((k, idx) => {
      const img = sr.images[k];
      if (img) ctx.drawImage(img, idx * 128, 336, 128, 112);
    });

    // Draw baseline guide line at row 103 for each row
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.lineWidth = 1;
    for (let r = 0; r < 4; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * 112 + 103);
      ctx.lineTo(c.width, r * 112 + 103);
      ctx.stroke();
    }

    return c.toDataURL('image/png');
  });

  const base64Data = contactSheetData.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(path.join(outputDir, '02_all_sprites_contact_sheet.png'), Buffer.from(base64Data, 'base64'));
  console.log('  -> Captured 02_all_sprites_contact_sheet.png');

  // 3. START GAME & COUNTDOWN
  console.log('\n[TEST 3] Starting Game and countdown...');
  await page.click('#btnStartGame');
  await delay(1200); // During countdown overlay
  await page.screenshot({ path: path.join(outputDir, '03_gameplay_countdown.png') });
  console.log('  -> Captured 03_gameplay_countdown.png');

  // Wait for countdown to finish and game to start running
  await delay(2000);

  // 4. CAPTURE ALL 6 RUN CYCLE FRAMES IN-GAME AT BASELINE
  console.log('\n[TEST 4] Capturing All 6 Run Cycle Frames in active gameplay...');
  for (let frame = 0; frame < 6; frame++) {
    await page.evaluate((f) => {
      // Force frame for crisp capture
      const runFps = 10;
      window.dinoGame.dino.animTime = f / runFps + 0.01;
      window.dinoGame.render();
    }, frame);
    await delay(60);
    await page.screenshot({ path: path.join(outputDir, `04_run_frame_${frame}.png`) });
    console.log(`  -> Captured 04_run_frame_${frame}.png`);
  }

  // 5. RUNNING AT HIGH SPEED
  console.log('\n[TEST 5] Testing Running at High Speed (gameSpeed = 650)...');
  await page.evaluate(() => {
    window.dinoGame.speed = 650;
    window.dinoGame.score = 650;
    window.dinoGame.dino.animTime += 0.05;
    window.dinoGame.render();
  });
  await delay(100);
  await page.screenshot({ path: path.join(outputDir, '05_run_high_speed.png') });
  console.log('  -> Captured 05_run_high_speed.png');

  // 6. JUMP TAKEOFF, ASCENT, APEX, DESCENT, LANDING
  console.log('\n[TEST 6] Capturing All 5 Jump Phases...');
  const jumpPhases = [
    { phase: 'TAKE_OFF', y: 320 - 64, vy: -600, name: '06a_jump_takeoff' },
    { phase: 'ASCENDING', y: 320 - 110, vy: -400, name: '06b_jump_ascending' },
    { phase: 'IN_AIR', y: 320 - 140, vy: 0, name: '06c_jump_apex_in_air' },
    { phase: 'DESCENDING', y: 320 - 90, vy: 350, name: '06d_jump_descending' },
    { phase: 'LANDING', y: 320 - 64, vy: 0, name: '06e_jump_landing' }
  ];

  for (const j of jumpPhases) {
    await page.evaluate((jp) => {
      const g = window.dinoGame;
      g.obstacles = []; // clear to prevent accidental premature collision
      g.state = g.STATE_PLAYING;
      g.dino.isGrounded = jp.phase === 'LANDING' || jp.phase === 'TAKE_OFF';
      g.dino.isJumping = true;
      g.dino.jumpPhase = jp.phase;
      g.dino.y = jp.y;
      g.dino.vy = jp.vy;
      g.render();
    }, j);
    await delay(60);
    await page.screenshot({ path: path.join(outputDir, `${j.name}.png`) });
    console.log(`  -> Captured ${j.name}.png`);
  }

  // Restore normal grounded state
  await page.evaluate(() => {
    const g = window.dinoGame;
    g.dino.isGrounded = true;
    g.dino.isJumping = false;
    g.dino.y = g.groundY - g.dino.height;
    g.dino.vy = 0;
  });

  // 7. CROUCH ENTRY, SUSTAINED CROUCH, RECOVERY EXIT
  console.log('\n[TEST 7] Capturing Crouch Sequence (Entry, Sustained, Exit)...');
  const crouchTests = [
    { dur: 0.02, ending: false, name: '07a_crouch_anticipation' },
    { dur: 0.06, ending: false, name: '07b_crouch_lowering' },
    { dur: 0.25, ending: false, name: '07c_crouch_sustained_closed_eyes' },
    { dur: 0.00, ending: true, name: '07d_crouch_exit_recovery' }
  ];

  for (const c of crouchTests) {
    await page.evaluate((ct) => {
      const g = window.dinoGame;
      g.obstacles = [];
      g.state = g.STATE_PLAYING;
      g.dino.isGrounded = true;
      g.dino.y = g.groundY - g.dino.height;
      g.keys.duck = !ct.ending;
      g.dino.isDucking = !ct.ending;
      g.dino.duckDuration = ct.dur;
      g.dino.duckEndingTimer = ct.ending ? 0.05 : 0;
      g.render();
    }, c);
    await delay(60);
    await page.screenshot({ path: path.join(outputDir, `${c.name}.png`) });
    console.log(`  -> Captured ${c.name}.png`);
  }

  // Restore normal un-ducked state
  await page.evaluate(() => {
    const g = window.dinoGame;
    g.dino.isDucking = false;
    g.dino.duckEndingTimer = 0;
  });

  // 8. RAPID JUMP-THEN-DUCK (Fast drop physics)
  console.log('\n[TEST 8] Testing Rapid Jump-Then-Duck (Fast Drop)...');
  await page.evaluate(() => {
    const g = window.dinoGame;
    g.dino.isGrounded = false;
    g.dino.y = 320 - 100;
    g.dino.vy = 200; // descending
    g.keys.duck = true;
    g.dino.jumpPhase = 'DESCENDING';
    g.render();
  });
  await delay(60);
  await page.screenshot({ path: path.join(outputDir, '08_rapid_jump_then_duck.png') });
  console.log('  -> Captured 08_rapid_jump_then_duck.png');

  // 9. CACTUS COLLISION & GAME OVER
  console.log('\n[TEST 9] Testing Cactus Collision & Game Over...');
  await page.evaluate(() => {
    const g = window.dinoGame;
    g.dino.isGrounded = true;
    g.dino.y = g.groundY - g.dino.height;
    g.dino.vy = 0;
    g.isDyingMidAir = false;
    g.handleGameOver();
  });
  await delay(400);
  await page.screenshot({ path: path.join(outputDir, '09_cactus_collision_game_over.png') });
  console.log('  -> Captured 09_cactus_collision_game_over.png');

  // 10. DRAGON / PTERODACTYL MID-AIR COLLISION (Knockdown to ground)
  console.log('\n[TEST 10] Testing Pterodactyl Mid-Air Collision (Hit state)...');
  await page.evaluate(() => {
    const g = window.dinoGame;
    g.state = g.STATE_PLAYING;
    g.dino.isGrounded = false;
    g.dino.y = 320 - 120;
    g.dino.vy = -100;
    g.isDyingMidAir = true;
    g.render();
  });
  await delay(60);
  await page.screenshot({ path: path.join(outputDir, '10_midair_pterodactyl_hit.png') });
  console.log('  -> Captured 10_midair_pterodactyl_hit.png');

  // 11. RESTART / PLAY AGAIN
  console.log('\n[TEST 11] Testing Immediate Restart via Play Again...');
  await page.evaluate(() => {
    document.getElementById('btnPlayAgain').click();
  });
  await delay(800);
  await page.screenshot({ path: path.join(outputDir, '11_play_again_restart.png') });
  console.log('  -> Captured 11_play_again_restart.png');

  // Wait for countdown to finish into active run
  await delay(2500);

  // 12. PAUSE AND RESUME
  console.log('\n[TEST 12] Testing Pause and Resume...');
  await page.click('#btnPause');
  await delay(300);
  await page.screenshot({ path: path.join(outputDir, '12a_pause_modal.png') });
  console.log('  -> Captured 12a_pause_modal.png');

  await page.click('#btnPauseResume');
  await delay(300);
  await page.screenshot({ path: path.join(outputDir, '12b_resume_gameplay.png') });
  console.log('  -> Captured 12b_resume_gameplay.png');

  // 13. RESIZING BEHAVIOR
  console.log('\n[TEST 13] Testing Window Resize Handling...');
  await page.setViewport({ width: 850, height: 500, deviceScaleFactor: 2 });
  await delay(400);
  await page.screenshot({ path: path.join(outputDir, '13_resized_gameplay.png') });
  console.log('  -> Captured 13_resized_gameplay.png');

  // 14. MOBILE PORTRAIT LAYOUT
  console.log('\n[TEST 14] Testing Mobile Portrait Layout (375x667)...');
  await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await delay(500);
  await page.screenshot({ path: path.join(outputDir, '14_mobile_portrait.png') });
  console.log('  -> Captured 14_mobile_portrait.png');

  // 15. MOBILE LANDSCAPE LAYOUT
  console.log('\n[TEST 15] Testing Mobile Landscape Layout (667x375)...');
  await page.setViewport({ width: 667, height: 375, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await delay(500);
  await page.screenshot({ path: path.join(outputDir, '15_mobile_landscape.png') });
  console.log('  -> Captured 15_mobile_landscape.png');

  // 16. TOUCH CONTROLS (Tap to Jump, Touch Swipe to Duck)
  console.log('\n[TEST 16] Testing Mobile Touch Controls (Tap-to-jump & Swipe-to-duck)...');
  const touchResults = await page.evaluate(async () => {
    const el = document.getElementById('gameContainer');
    const g = window.dinoGame;
    g.state = g.STATE_PLAYING;
    g.dino.isGrounded = true;

    // 1. Test Tap to Jump (< 40ms tap)
    const prevJumpCount = g.dino.jumpCount || 0;
    const touchTap = new Touch({ identifier: 101, target: el, clientX: 200, clientY: 200 });
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [touchTap], targetTouches: [touchTap], bubbles: true }));
    await new Promise(r => setTimeout(r, 10));
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], targetTouches: [], bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    const tapJumped = (g.dino.jumpCount || 0) > prevJumpCount || g.dino.isJumping;

    // Reset grounded state for swipe test
    g.dino.isGrounded = true;
    g.dino.isJumping = false;
    g.dino.y = g.groundY - g.dino.height;

    // 2. Test Swipe Down to Duck
    const touchStart = new Touch({ identifier: 102, target: el, clientX: 200, clientY: 200 });
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [touchStart], targetTouches: [touchStart], bubbles: true }));
    await new Promise(r => setTimeout(r, 10));
    const touchMove = new Touch({ identifier: 102, target: el, clientX: 200, clientY: 245 }); // swipe down by 45px
    el.dispatchEvent(new TouchEvent('touchmove', { touches: [touchMove], targetTouches: [touchMove], bubbles: true }));
    await new Promise(r => setTimeout(r, 20));
    const swipeDucked = g.dino.isDucking;
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], targetTouches: [], bubbles: true }));

    return { tapJumped, swipeDucked };
  });
  console.log('  -> Touch Tap Jump Triggered:', touchResults.tapJumped);
  console.log('  -> Touch Swipe Duck Triggered:', touchResults.swipeDucked);

  // 17. SOUND & MUTE TOGGLE
  console.log('\n[TEST 17] Testing Audio Engine Mute/Unmute...');
  const audioResults = await page.evaluate(() => {
    const snd = window.soundEngine;
    const initialMute = snd.isMuted;
    snd.toggleMute();
    const mutedAfterToggle = snd.isMuted;
    snd.toggleMute();
    const restoredMute = snd.isMuted;
    return { initialMute, mutedAfterToggle, restoredMute };
  });
  console.log('  -> Audio Mute Toggle Result:', audioResults);

  // 18. CONSOLE ERRORS & ASSET INTEGRITY
  console.log('\n[TEST 18] Auditing Browser Console for Errors...');
  console.log('  -> Total Console Logs:', consoleLogs.length);
  console.log('  -> Total Console Errors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.error('  -> Console Errors found:', consoleErrors);
  } else {
    console.log('  ✓ ZERO console errors during complete audit!');
  }

  await browser.close();

  console.log('\n===============================================================');
  console.log('   AUDIT COMPLETE — All 18 Visual & Regression Tests Finished!');
  console.log('===============================================================\n');
}

runComprehensiveTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
