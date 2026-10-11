const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, 'validation_states');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function captureAll20States() {
  console.log('===============================================================');
  console.log('▲ OFFLINE DINO — 20 MANDATORY VISUAL REGRESSION STATES');
  console.log('===============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  // 1. Home Screen Dinosaur
  console.log('[1/20] Capturing Home Screen Dinosaur...');
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT_DIR, '01_home_screen.png') });
  console.log('  ✓ 01_home_screen.png');

  // Start Game
  await page.click('#btnStartGame');
  await page.waitForFunction(() => window.dinoGame && window.dinoGame.state === 'PLAYING', { timeout: 6000 });

  // Disable obstacle spawning temporarily for pristine character captures
  await page.evaluate(() => {
    window.dinoGame.obstacles = [];
    window.dinoGame.checkCollisions = () => false;
  });

  // 2. First running frame
  console.log('[2/20] Capturing First running frame...');
  await page.evaluate(() => {
    window.dinoGame.dino.runFrame = 0;
  });
  await new Promise(r => setTimeout(r, 60));
  await page.screenshot({ path: path.join(OUT_DIR, '02_first_running_frame.png') });
  console.log('  ✓ 02_first_running_frame.png');

  // 3. Every frame of the running cycle
  console.log('[3/20] Capturing Every frame of running cycle...');
  for (let f = 0; f < 5; f++) {
    await page.evaluate((frameIdx) => {
      window.dinoGame.dino.runFrame = frameIdx;
    }, f);
    await new Promise(r => setTimeout(r, 50));
    await page.screenshot({ path: path.join(OUT_DIR, `03_running_frame_${f}.png`) });
  }
  console.log('  ✓ 03_running_frame_0..4.png');

  // 4. Jump takeoff
  console.log('[4/20] Capturing Jump Takeoff...');
  await page.evaluate(() => {
    const g = window.dinoGame;
    g.triggerJump();
    g.dino.jumpPhase = 'TAKE_OFF';
    g.render();
  });
  await page.screenshot({ path: path.join(OUT_DIR, '04_jump_takeoff.png') });
  console.log('  ✓ 04_jump_takeoff.png');

  // 5. Jump ascent
  console.log('[5/20] Capturing Jump Ascent...');
  await page.evaluate(() => {
    const g = window.dinoGame;
    g.dino.jumpPhase = 'ASCENDING';
    g.dino.y = g.groundY - 50;
    g.render();
  });
  await page.screenshot({ path: path.join(OUT_DIR, '05_jump_ascent.png') });
  console.log('  ✓ 05_jump_ascent.png');

  // 6. Jump apex
  console.log('[6/20] Capturing Jump Apex...');
  await page.evaluate(() => {
    const g = window.dinoGame;
    g.dino.jumpPhase = 'IN_AIR';
    g.dino.y = g.groundY - 100;
    g.render();
  });
  await page.screenshot({ path: path.join(OUT_DIR, '06_jump_apex.png') });
  console.log('  ✓ 06_jump_apex.png');

  // 7. Jump descent
  console.log('[7/20] Capturing Jump Descent...');
  await page.evaluate(() => {
    const g = window.dinoGame;
    g.dino.jumpPhase = 'DESCENDING';
    g.dino.y = g.groundY - 50;
    g.render();
  });
  await page.screenshot({ path: path.join(OUT_DIR, '07_jump_descent.png') });
  console.log('  ✓ 07_jump_descent.png');

  // 8. Landing
  console.log('[8/20] Capturing Landing...');
  await page.evaluate(() => {
    const g = window.dinoGame;
    g.dino.jumpPhase = 'LANDING';
    g.dino.y = g.groundY - 64;
    g.render();
  });
  await page.screenshot({ path: path.join(OUT_DIR, '08_jump_landing.png') });
  console.log('  ✓ 08_jump_landing.png');

  // 9. Crouch entry (Pressing Down Arrow)
  console.log('[9/20] Capturing Crouch Entry...');
  await page.keyboard.down('ArrowDown');
  await new Promise(r => setTimeout(r, 60));
  await page.screenshot({ path: path.join(OUT_DIR, '09_crouch_entry.png') });
  console.log('  ✓ 09_crouch_entry.png');

  // 10. Sustained crouching (Holding Down Arrow)
  console.log('[10/20] Capturing Sustained Crouching...');
  await new Promise(r => setTimeout(r, 180));
  await page.screenshot({ path: path.join(OUT_DIR, '10_crouch_sustained.png') });
  console.log('  ✓ 10_crouch_sustained.png');

  // 11. Crouch exit (Releasing Down Arrow)
  console.log('[11/20] Capturing Crouch Exit...');
  await page.keyboard.up('ArrowDown');
  await new Promise(r => setTimeout(r, 40));
  await page.screenshot({ path: path.join(OUT_DIR, '11_crouch_exit.png') });
  console.log('  ✓ 11_crouch_exit.png');

  // 12. Jump followed immediately by duck (fast drop)
  console.log('[12/20] Capturing Jump Followed by Duck...');
  await page.evaluate(() => {
    const g = window.dinoGame;
    g.triggerJump();
  });
  await new Promise(r => setTimeout(r, 150));
  await page.keyboard.down('ArrowDown');
  await new Promise(r => setTimeout(r, 80));
  await page.screenshot({ path: path.join(OUT_DIR, '12_jump_fast_drop_duck.png') });
  await page.keyboard.up('ArrowDown');
  console.log('  ✓ 12_jump_fast_drop_duck.png');

  // 13. Collision with cactus
  console.log('[13/20] Capturing Collision with Cactus...');
  await page.evaluate(() => {
    const g = window.dinoGame;
    g.dino.isJumping = false;
    g.dino.isDucking = false;
    g.dino.y = g.groundY - 64;
    g.obstacles = [{
      type: 'CACTUS_SINGLE',
      x: g.dino.x + 10,
      y: g.groundY - 50,
      width: 34,
      height: 50,
      spriteKey: 'cactus_single'
    }];
    g.handleGameOver();
  });
  await new Promise(r => setTimeout(r, 100));
  await page.screenshot({ path: path.join(OUT_DIR, '13_collision_cactus.png') });
  console.log('  ✓ 13_collision_cactus.png');

  // 14. Collision with Dragon/Pterodactyl
  console.log('[14/20] Capturing Collision with Dragon/Pterodactyl...');
  await page.evaluate(() => {
    const g = window.dinoGame;
    g.state = 'PLAYING';
    g.dino.dead = false;
    g.dino.isJumping = false;
    g.dino.isDucking = false;
    g.dino.y = g.groundY - 64;
    g.obstacles = [{
      type: 'PTERODACTYL',
      x: g.dino.x + 8,
      y: g.groundY - 55,
      width: 48,
      height: 38,
      spriteKey: 'pterodactyl_0',
      flapFrame: 0
    }];
    g.handleGameOver();
  });
  await new Promise(r => setTimeout(r, 100));
  await page.screenshot({ path: path.join(OUT_DIR, '14_collision_pterodactyl.png') });
  console.log('  ✓ 14_collision_pterodactyl.png');

  // 15. Game Over Pose
  console.log('[15/20] Capturing Game Over Pose...');
  await page.evaluate(() => {
    const g = window.dinoGame;
    g.completeGameOver();
  });
  await new Promise(r => setTimeout(r, 150));
  await page.screenshot({ path: path.join(OUT_DIR, '15_game_over_pose.png') });
  console.log('  ✓ 15_game_over_pose.png');

  // 16. Restart immediately after Game Over
  console.log('[16/20] Capturing Restart immediately after Game Over...');
  await page.click('#btnPlayAgain');
  await page.waitForFunction(() => window.dinoGame && window.dinoGame.state === 'PLAYING', { timeout: 6000 });
  await new Promise(r => setTimeout(r, 100));
  await page.screenshot({ path: path.join(OUT_DIR, '16_restart_after_game_over.png') });
  console.log('  ✓ 16_restart_after_game_over.png');

  // 17. Pause and Resume
  console.log('[17/20] Capturing Pause and Resume...');
  await page.click('#btnPause');
  await new Promise(r => setTimeout(r, 150));
  await page.screenshot({ path: path.join(OUT_DIR, '17a_paused.png') });
  await page.click('#btnPauseResume');
  await new Promise(r => setTimeout(r, 150));
  await page.screenshot({ path: path.join(OUT_DIR, '17b_resumed.png') });
  console.log('  ✓ 17a_paused.png & 17b_resumed.png');

  // 18. Gameplay after browser resize
  console.log('[18/20] Capturing Gameplay after browser resize...');
  await page.setViewport({ width: 1024, height: 600 });
  await page.evaluate(() => window.dinoGame.resize());
  await new Promise(r => setTimeout(r, 150));
  await page.screenshot({ path: path.join(OUT_DIR, '18_after_resize.png') });
  console.log('  ✓ 18_after_resize.png');

  // 19. Gameplay in portrait orientation (390x844 mobile portrait)
  console.log('[19/20] Capturing Gameplay in portrait orientation...');
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(() => window.dinoGame.resize());
  await new Promise(r => setTimeout(r, 150));
  await page.screenshot({ path: path.join(OUT_DIR, '19_portrait_390x844.png') });
  console.log('  ✓ 19_portrait_390x844.png');

  // 20. Gameplay in landscape orientation (844x390 mobile landscape)
  console.log('[20/20] Capturing Gameplay in landscape orientation...');
  await page.setViewport({ width: 844, height: 390 });
  await page.evaluate(() => window.dinoGame.resize());
  await new Promise(r => setTimeout(r, 150));
  await page.screenshot({ path: path.join(OUT_DIR, '20_landscape_844x390.png') });
  console.log('  ✓ 20_landscape_844x390.png');

  await browser.close();
  console.log('\n===============================================================');
  console.log('✔ ALL 20 MANDATORY VISUAL REGRESSION STATES CAPTURED!');
  console.log('===============================================================');
}

captureAll20States().catch(err => {
  console.error('Error in captureAll20States:', err);
  process.exit(1);
});
