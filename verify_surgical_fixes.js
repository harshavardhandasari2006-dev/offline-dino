const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TARGET_URL = 'http://localhost:3000/';

async function runVerification() {
  console.log('===============================================================');
  console.log('▲ OFFLINE DINO — SURGICAL FIXES VERIFICATION');
  console.log('===============================================================\n');

  let passed = true;

  // -----------------------------------------------------------------
  // 1. AUDIT SPRITE EDGES & TAIL SILHOUETTES
  // -----------------------------------------------------------------
  console.log('[TEST 1] AUDITING SPRITE EDGES & TAIL SILHOUETTES...');
  const SPRITES_DIR = path.join(__dirname, 'assets', 'sprites');
  const targetFiles = ['dino_idle_0.png', 'dino_idle_1.png', 'dino_idle_2.png', 'dino_idle_3.png', 
                       'dino_run_0.png', 'dino_run_1.png', 'dino_run_2.png', 'dino_run_3.png', 'dino_run_4.png'];

  let totalTailWhitePixels = 0;
  for (const f of targetFiles) {
    const { data, info } = await sharp(path.join(SPRITES_DIR, f)).raw().toBuffer({ resolveWithObject: true });
    let whiteTailCount = 0;
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
          // Any light/white/cream halo around tail
          if (r > 185 && g > 180 && b > 135) {
            whiteTailCount++;
          }
        }
      }
    }
    if (whiteTailCount > 0) {
      console.log(`  ✗ ${f}: Found ${whiteTailCount} white/halo pixels around tail`);
      totalTailWhitePixels += whiteTailCount;
    }
  }

  if (totalTailWhitePixels === 0) {
    console.log('  ✓ 100% of standing & running sprites have ZERO white border/halo pixels around tail!');
    console.log('  ✓ Clean transparent background and sharp clean silhouette preserved.');
  } else {
    console.log(`  ✗ Found ${totalTailWhitePixels} total white pixels around tails.`);
    passed = false;
  }

  // -----------------------------------------------------------------
  // 2. AUDIT RUNNING FRAMES & TWO-LEG GROUND BASELINE
  // -----------------------------------------------------------------
  console.log('\n[TEST 2] AUDITING TWO-LEG RUNNING CYCLE & BASELINE ALIGNMENT...');
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
    console.log(`  ✓ Frame ${i}: Overall MaxY=${overallMaxY}, Left Foot=${leftFootMaxY}, Right Foot=${rightFootMaxY}`);
  }

  const strideA = runBaselines[0]; // Left foot contacts ground at 103, Right in air
  const strideB = runBaselines[2]; // Right foot contacts ground at 103, Left in air

  const strideACorrect = strideA.leftFootMaxY === 103 && strideA.rightFootMaxY < 100;
  const strideBCorrect = strideB.rightFootMaxY === 103 && strideB.leftFootMaxY < 100;

  if (strideACorrect && strideBCorrect && runBaselines[1].overallMaxY === 103 && runBaselines[3].overallMaxY === 103) {
    console.log('  ✓ Stride A (Frame 0): Left foot firmly planted on ground baseline y=103, Right foot in air.');
    console.log('  ✓ Stride B (Frame 2): Right foot firmly planted on ground baseline y=103, Left foot in air.');
    console.log('  ✓ Both passing frames (Frames 1 & 3): Supporting foot firmly on ground baseline y=103.');
    console.log('  ✓ Both feet use the EXACT SAME ground baseline (y=103)!');
    console.log('  ✓ Neither foot permanently floats in the air!');
  } else {
    console.log('  ✗ Run frames baseline check failed!');
    passed = false;
  }

  // -----------------------------------------------------------------
  // 3. LAUNCH BROWSER & AUDIT GAMEPLAY RUNNING & DRAGON MOVEMENT
  // -----------------------------------------------------------------
  console.log('\n[TEST 3] TESTING GAMEPLAY RUNNING ANIMATION & DRAGON JOURNEY IN BROWSER...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,700']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 700 });
  await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });

  // Start Game
  await page.click('#btnStartGame');
  await page.waitForFunction(() => window.dinoGame && window.dinoGame.state === 'PLAYING', { timeout: 6000 });
  console.log('  ✓ Game started in PLAYING state');

  // Capture Running gameplay screenshots across stride cycles
  await new Promise(r => setTimeout(r, 120));
  await page.screenshot({ path: path.join(__dirname, 'verify_surgical_run_stride_a.png') });
  await new Promise(r => setTimeout(r, 90));
  await page.screenshot({ path: path.join(__dirname, 'verify_surgical_run_stride_b.png') });
  console.log('  ✓ Captured verify_surgical_run_stride_a.png and verify_surgical_run_stride_b.png');

  // Spawn Dragon / Pterodactyl and track full journey
  console.log('\n[TEST 4] TRACKING DRAGON/PTERODACTYL FULL JOURNEY ACROSS SCREEN...');
  const spawnData = await page.evaluate(() => {
    const g = window.dinoGame;
    g.checkCollisions = () => false; // allow pass-through to observe complete flight journey
    g.score = 150;
    const ptero = {
      type: 'PTERODACTYL',
      x: 700,
      y: g.groundY - 72,
      groundOffset: -72,
      width: 58,
      height: 38,
      flapTimer: 0,
      flapFrame: 0,
      heightLabel: 'MID'
    };
    g.obstacles = [ptero];
    return { spawnX: ptero.x, dinoX: g.dino.x, speed: g.speed };
  });

  console.log(`  ✓ Dragon spawned at X=${spawnData.spawnX}px (Dinosaur at X=${spawnData.dinoX}px)`);

  let reachedDino = false;
  let passedDino = false;
  let leftScreen = false;
  let despawned = false;
  const flapFrames = new Set();
  const journeyX = [];

  for (let frame = 0; frame < 75; frame++) {
    const pData = await page.evaluate(() => {
      const g = window.dinoGame;
      const p = g.obstacles.find(o => o.type === 'PTERODACTYL');
      if (!p) return { exists: false };
      return {
        exists: true,
        x: p.x,
        flapFrame: p.flapFrame,
        dinoX: g.dino.x
      };
    });

    if (!pData.exists) {
      despawned = true;
      break;
    }

    journeyX.push(pData.x);
    flapFrames.add(pData.flapFrame);

    if (pData.x <= pData.dinoX + 80) reachedDino = true;
    if (pData.x < pData.dinoX) passedDino = true;
    if (pData.x < 0) leftScreen = true;

    await new Promise(r => setTimeout(r, 35));
  }

  const startX = journeyX[0];
  const endX = journeyX[journeyX.length - 1];
  const totalDx = startX - endX;

  console.log(`  ✓ Total horizontal distance travelled: ${totalDx.toFixed(1)}px (from ${startX.toFixed(1)}px to ${endX.toFixed(1)}px)`);
  console.log(`  ✓ Reached Dinosaur area: ${reachedDino}`);
  console.log(`  ✓ Passed Dinosaur: ${passedDino}`);
  console.log(`  ✓ Left screen: ${leftScreen}`);
  console.log(`  ✓ Despawned & recycled: ${despawned}`);
  console.log(`  ✓ Wing flap frames observed: [${Array.from(flapFrames).sort().join(', ')}]`);

  const dragonSuccess = totalDx > 700 && reachedDino && passedDino && leftScreen && despawned && flapFrames.has(0) && flapFrames.has(1);

  if (dragonSuccess) {
    console.log('  ✓ DRAGON MOVEMENT VERIFICATION: 100% SUCCESSFUL!');
  } else {
    console.log('  ✗ DRAGON MOVEMENT VERIFICATION FAILED!');
    passed = false;
  }

  await browser.close();

  console.log('\n===============================================================');
  if (passed && dragonSuccess) {
    console.log('✔ ALL SURGICAL FIXES VERIFIED & 100% PASSING!');
  } else {
    console.log('✗ VERIFICATION FAILED!');
    process.exit(1);
  }
  console.log('===============================================================\n');
}

runVerification().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
