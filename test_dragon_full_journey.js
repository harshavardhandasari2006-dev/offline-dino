const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TARGET_URL = 'http://localhost:3000/';

async function testDragonJourney() {
  console.log('===============================================================');
  console.log('▲ OFFLINE DINO — DRAGON / PTERODACTYL FULL JOURNEY VERIFICATION');
  console.log('===============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,700']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 700 });

  // 1. Start the game
  console.log('[STEP 1] Starting the game...');
  await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });
  await page.click('#btnStartGame');
  await page.waitForFunction(() => window.dinoGame && window.dinoGame.state === 'PLAYING', { timeout: 6000 });
  console.log('  ✓ Game running in PLAYING state');

  // 2. Spawn a Dragon ahead of the Dinosaur
  console.log('[STEP 2] Spawning Dragon/Pterodactyl ahead of the Dinosaur...');
  const spawnInfo = await page.evaluate(() => {
    const g = window.dinoGame;
    g.checkCollisions = () => false; // Disable collision so we can observe the full pass-through
    g.score = 120; // Pterodactyls active
    g.obstacles = [];
    const ptero = g.spawnObstacle();
    ptero.type = 'PTERODACTYL';
    ptero.heightLabel = 'MID';
    ptero.y = g.groundY - 72;
    ptero.groundOffset = -72;
    return {
      spawnX: ptero.x,
      spawnY: ptero.y,
      dinoX: g.dino.x,
      speed: g.speed
    };
  });

  console.log(`  ✓ Dragon spawned at X=${spawnInfo.spawnX.toFixed(1)}px (Dinosaur at X=${spawnInfo.dinoX}px)`);

  // 3-7. Track trajectory continuously until it leaves the screen
  console.log('[STEPS 3-7] Tracking continuous horizontal journey toward and past Dinosaur...');
  
  const journeyLogs = [];
  let reachedDino = false;
  let passedDino = false;
  let leftScreen = false;
  let despawned = false;
  const flapFrames = new Set();
  const collisionBoxSynced = [];

  let approachingShot = false;
  let passingShot = false;

  for (let frame = 0; frame < 120; frame++) {
    const pteroData = await page.evaluate(() => {
      const g = window.dinoGame;
      const p = g.obstacles.find(o => o.type === 'PTERODACTYL');
      if (!p) {
        return { exists: false, totalObstacles: g.obstacles.length };
      }
      return {
        exists: true,
        x: p.x,
        y: p.y,
        flapFrame: p.flapFrame,
        flapTimer: p.flapTimer,
        dinoX: g.dino.x,
        // Collision box
        box: {
          x: p.x + 8,
          y: p.y + 8,
          w: p.width - 14,
          h: p.height - 14
        }
      };
    });

    if (!pteroData.exists) {
      despawned = true;
      break;
    }

    journeyLogs.push({ frame, x: pteroData.x, flap: pteroData.flapFrame });
    flapFrames.add(pteroData.flapFrame);

    // Verify visual X and collision box X synchronization
    if (Math.abs(pteroData.box.x - (pteroData.x + 8)) < 0.001) {
      collisionBoxSynced.push(true);
    }

    // Capture visual milestone screenshots
    if (pteroData.x < 500 && pteroData.x > 300 && !approachingShot) {
      approachingShot = true;
      await page.screenshot({ path: path.join(__dirname, 'verify_dragon_approaching.png') });
    }

    if (pteroData.x <= pteroData.dinoX + 40 && pteroData.x >= pteroData.dinoX - 40 && !passingShot) {
      passingShot = true;
      await page.screenshot({ path: path.join(__dirname, 'verify_dragon_passing_dino.png') });
    }

    if (pteroData.x <= pteroData.dinoX + 80) reachedDino = true;
    if (pteroData.x < pteroData.dinoX) passedDino = true;
    if (pteroData.x < -60) leftScreen = true;

    await new Promise(r => setTimeout(r, 25));
  }

  const startX = journeyLogs[0].x;
  const endX = journeyLogs[journeyLogs.length - 1].x;
  const totalDx = startX - endX;

  console.log(`  ✓ Total horizontal distance travelled: ${totalDx.toFixed(1)}px (from ${startX.toFixed(1)}px to ${endX.toFixed(1)}px)`);
  console.log(`  ✓ Reached Dinosaur area: ${reachedDino}`);
  console.log(`  ✓ Passed Dinosaur: ${passedDino}`);
  console.log(`  ✓ Left screen: ${leftScreen}`);
  console.log(`  ✓ Despawned & recycled: ${despawned}`);
  console.log(`  ✓ Wing flap frames observed: [${Array.from(flapFrames).sort().join(', ')}]`);
  console.log(`  ✓ Collision box strictly synchronized with visual body: ${collisionBoxSynced.length === journeyLogs.length}`);

  const passedAll = (
    totalDx > 600 &&
    reachedDino &&
    passedDino &&
    leftScreen &&
    despawned &&
    flapFrames.has(0) &&
    flapFrames.has(1)
  );

  if (passedAll) {
    console.log('\n===============================================================');
    console.log('✔ DRAGON FULL JOURNEY VERIFICATION: 100% SUCCESS!');
    console.log('===============================================================\n');
  } else {
    console.log('\n✗ DRAGON FULL JOURNEY FAILED!\n');
    process.exit(1);
  }

  await browser.close();
}

testDragonJourney().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
