const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const delay = ms => new Promise(r => setTimeout(r, ms));
const outputDir = path.join(__dirname, 'test_output');

(async () => {
  console.log('--- Launching Edge Browser ---');
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,800']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 750, deviceScaleFactor: 2 });

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));

  console.log('Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // Start game via start button
  console.log('Clicking #btnStartGame and waiting for countdown...');
  await page.click('#btnStartGame');
  await delay(2500);

  // 1. Capture Color Harmony on Gameplay with Harmonized Cacti & Head-Level Flying Obstacle
  console.log('--- TEST 1: Color Harmony Capture (Dino, Cacti, Pterodactyl, Ground, Mountains) ---');
  await page.evaluate(() => {
    window.dinoGame.state = window.dinoGame.STATE_PLAYING;
    // Spawn harmonized cacti and head-level pterodactyl
    window.dinoGame.obstacles = [
      {
        type: 'CACTUS_LARGE_DOUBLE',
        x: 340,
        y: window.dinoGame.groundY - 70,
        groundOffset: -70,
        width: 60,
        height: 70
      },
      {
        type: 'PTERODACTYL',
        x: 620,
        y: window.dinoGame.groundY - 74,
        groundOffset: -74,
        width: 60,
        height: 46,
        flapTimer: 0,
        flapFrame: 0,
        heightLabel: 'HEAD'
      }
    ];
    window.dinoGame.render();
  });

  await delay(100);
  await page.screenshot({ path: path.join(outputDir, 'gameplay_color_harmony.png') });
  console.log('✓ Captured test_output/gameplay_color_harmony.png');

  // 2. TEST HEAD-LEVEL PTERODACTYL — STANDING COLLISION
  console.log('\n--- TEST 2: Standing collision with head-level Pterodactyl ---');
  await page.evaluate(() => {
    window.dinoGame.state = window.dinoGame.STATE_PLAYING;
    window.dinoGame.dino.isGrounded = true;
    window.dinoGame.dino.isDucking = false;
    window.dinoGame.keys.duck = false;
    window.dinoGame.dino.y = window.dinoGame.groundY - window.dinoGame.dino.height;
    // Position pterodactyl approaching head level right in front of standing dino (dino.x = 90)
    window.dinoGame.obstacles = [
      {
        type: 'PTERODACTYL',
        x: 180, // moving left toward 90
        y: window.dinoGame.groundY - 74,
        groundOffset: -74,
        width: 60,
        height: 46,
        flapTimer: 0,
        flapFrame: 0,
        heightLabel: 'HEAD'
      }
    ];
  });

  // Advance frames until collision occurs
  let standingCollided = false;
  for (let frame = 0; frame < 30; frame++) {
    await page.evaluate(() => {
      window.dinoGame.update(0.016);
      window.dinoGame.render();
    });
    const state = await page.evaluate(() => window.dinoGame.state);
    if (state === 'GAMEOVER') {
      standingCollided = true;
      break;
    }
  }

  await page.screenshot({ path: path.join(outputDir, 'ptero_standing_collision_game_over.png') });
  console.log('Standing Collision Result: Collided = ' + standingCollided);

  // 3. TEST HEAD-LEVEL PTERODACTYL — TIMELY CROUCH DODGE
  console.log('\n--- TEST 3: Timely duck dodge with head-level Pterodactyl ---');
  await page.evaluate(() => {
    // Reset to playing state
    window.dinoGame.state = window.dinoGame.STATE_PLAYING;
    window.dinoGame.isDyingMidAir = false;
    window.dinoGame.dino.isGrounded = true;
    window.dinoGame.dino.y = window.dinoGame.groundY - window.dinoGame.dino.height;
    // Hold duck key
    window.dinoGame.handleDuckPress(true);
    // Put pterodactyl approaching head level at x = 200
    window.dinoGame.obstacles = [
      {
        type: 'PTERODACTYL',
        x: 200,
        y: window.dinoGame.groundY - 74,
        groundOffset: -74,
        width: 60,
        height: 46,
        flapTimer: 0,
        flapFrame: 0,
        heightLabel: 'HEAD'
      }
    ];
  });

  // Advance frames until pterodactyl is directly over dinosaur (around x = 90..110)
  for (let frame = 0; frame < 12; frame++) {
    await page.evaluate(() => {
      // Keep duck key pressed during update
      window.dinoGame.keys.duck = true;
      window.dinoGame.dino.isDucking = true;
      window.dinoGame.update(0.016);
      window.dinoGame.render();
    });
  }

  const pteroPosDuringDodge = await page.evaluate(() => {
    const obs = window.dinoGame.obstacles[0];
    return {
      state: window.dinoGame.state,
      dinoIsDucking: window.dinoGame.dino.isDucking,
      obsX: obs ? Math.round(obs.x) : null,
      obsY: obs ? Math.round(obs.y) : null
    };
  });
  console.log('Ptero Position During Crouch Dodge:', pteroPosDuringDodge);

  await page.screenshot({ path: path.join(outputDir, 'ptero_crouch_safe_pass.png') });
  console.log('✓ Captured test_output/ptero_crouch_safe_pass.png');

  // Advance further until pterodactyl completely passes the dinosaur and exits screen
  for (let frame = 0; frame < 45; frame++) {
    await page.evaluate(() => {
      // Keep ducking until pterodactyl has passed x < 30
      const obs = window.dinoGame.obstacles[0];
      if (obs && obs.x > 30) {
        window.dinoGame.keys.duck = true;
        window.dinoGame.dino.isDucking = true;
      } else {
        window.dinoGame.keys.duck = false;
        window.dinoGame.handleDuckPress(false);
      }
      window.dinoGame.update(0.016);
      window.dinoGame.render();
    });
  }

  const postDodgeState = await page.evaluate(() => {
    return {
      state: window.dinoGame.state,
      dinoIsDucking: window.dinoGame.dino.isDucking,
      remainingObstacles: window.dinoGame.obstacles.length
    };
  });
  console.log('Post-dodge state:', postDodgeState);

  await page.screenshot({ path: path.join(outputDir, 'ptero_post_dodge_running.png') });
  console.log('✓ Captured test_output/ptero_post_dodge_running.png');

  // 4. TEST LATE DUCKING COLLISION
  console.log('\n--- TEST 4: Late Ducking Collision Test ---');
  await page.evaluate(() => {
    window.dinoGame.state = window.dinoGame.STATE_PLAYING;
    window.dinoGame.isDyingMidAir = false;
    window.dinoGame.dino.isGrounded = true;
    window.dinoGame.dino.isDucking = false;
    window.dinoGame.keys.duck = false;
    window.dinoGame.dino.y = window.dinoGame.groundY - window.dinoGame.dino.height;
    // Put pterodactyl right at the dinosaur snout
    window.dinoGame.obstacles = [
      {
        type: 'PTERODACTYL',
        x: 125, // already overlapping with head bounds
        y: window.dinoGame.groundY - 74,
        groundOffset: -74,
        width: 60,
        height: 46,
        flapTimer: 0,
        flapFrame: 0,
        heightLabel: 'HEAD'
      }
    ];
  });
  // Duck initiated too late (overlap already occurring)
  await page.evaluate(() => {
    window.dinoGame.handleDuckPress(true);
    window.dinoGame.update(0.016);
    window.dinoGame.render();
  });
  const lateDuckState = await page.evaluate(() => window.dinoGame.state);
  console.log('Late Duck Result: State = ' + lateDuckState);
  await page.screenshot({ path: path.join(outputDir, 'ptero_late_duck_collision.png') });
  console.log('✓ Captured test_output/ptero_late_duck_collision.png');

  await browser.close();
  console.log('\n========================================================');
  console.log('  ALL PTERODACTYL HEAD-HEIGHT & COLOR HARMONY TESTS DONE!');
  console.log('========================================================');
})();
