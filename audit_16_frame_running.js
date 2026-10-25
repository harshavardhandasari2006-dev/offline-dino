const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function testRunningAnimation() {
  console.log('=== STARTING 16-FRAME RUNNING ANIMATION AUDIT ===');
  if (!fs.existsSync('audit_evidence')) fs.mkdirSync('audit_evidence');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.toString()));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  console.log('Loaded http://localhost:3000');

  // Verify sprites are loaded
  const spriteCheck = await page.evaluate(() => {
    const loaded = [];
    const missing = [];
    for (let i = 1; i <= 16; i++) {
      const key = 'run_' + i.toString().padStart(2, '0');
      const img = window.spriteRenderer ? window.spriteRenderer.getDinoSprite(key) : null;
      if (img && (img.naturalWidth > 0 || img.width > 0)) {
        loaded.push(key + ` (${img.naturalWidth}x${img.naturalHeight})`);
      } else {
        missing.push(key);
      }
    }
    return { loadedCount: loaded.length, missing, sampleLoaded: loaded.slice(0, 4) };
  });

  console.log('Sprite check:', spriteCheck);

  // Click Play / Start Game
  await page.evaluate(() => {
    const btn = document.getElementById('btnStartGame');
    if (btn) btn.click();
    else if (window.uiManager) window.uiManager.startNewGameSequence();
  });

  // Fast forward countdown into PLAYING
  await page.evaluate(() => {
    const game = window.dinoGame;
    const ui = window.uiManager;
    if (ui && ui.countdownOverlay) {
      ui.countdownOverlay.classList.remove('active');
    }
    if (game) {
      game.state = game.STATE_PLAYING;
    }
  });

  await new Promise(r => setTimeout(r, 300));

  // Verify frame sequence progression
  const sequenceTrack = await page.evaluate(async () => {
    const framesObserved = [];
    const start = performance.now();
    while (performance.now() - start < 1200) {
      const game = window.dinoGame;
      const sr = window.spriteRenderer;
      if (game && game.dino) {
        const animTime = game.dino.animTime;
        const speed = game.speed;
        const fps = Math.min(24.0, 14.0 + Math.max(0, speed - 250) * 0.024);
        const idx = Math.floor(animTime * fps) % 16;
        const frameNum = (idx + 1).toString().padStart(2, '0');
        if (framesObserved.length === 0 || framesObserved[framesObserved.length - 1].frameNum !== frameNum) {
          framesObserved.push({ frameNum, animTime: animTime.toFixed(3), idx });
        }
      }
      await new Promise(res => requestAnimationFrame(res));
    }
    return framesObserved;
  });

  console.log('Sequence progression observed across 1.2s:');
  console.log(sequenceTrack.map(f => f.frameNum).join(' -> '));

  // Take screenshot of dinosaur running in active game
  await page.screenshot({ path: 'audit_evidence/audit_running_16_gameplay.png' });
  console.log('Captured audit_evidence/audit_running_16_gameplay.png');

  // Let's capture close-up snapshots of the running dinosaur on canvas across various frames
  const canvasSnapshots = await page.evaluate(async () => {
    const snaps = [];
    const game = window.dinoGame;
    const canvas = document.getElementById('gameCanvas');
    if (!game || !canvas) return snaps;

    // Capture at high speed and normal speed
    for (let step = 0; step < 8; step++) {
      // dino bounding box on screen
      const dino = game.dino;
      snaps.push({
        step,
        dinoX: Math.round(dino.x),
        dinoY: Math.round(dino.y),
        state: dino.state,
        animTime: dino.animTime.toFixed(3)
      });
      await new Promise(r => setTimeout(r, 60));
    }
    return snaps;
  });

  console.log('Canvas snapshots info:', canvasSnapshots);

  // Jump test
  console.log('Testing Jump transition...');
  await page.evaluate(() => {
    if (window.dinoGame) {
      window.dinoGame.triggerJump();
    }
  });
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: 'audit_evidence/audit_running_16_jump.png' });

  // Duck test
  console.log('Testing Duck transition...');
  await page.evaluate(() => {
    if (window.dinoGame) {
      window.dinoGame.handleDuckPress(true);
    }
  });
  await new Promise(r => setTimeout(r, 250));
  await page.screenshot({ path: 'audit_evidence/audit_running_16_duck.png' });

  // Release Duck back to Run
  await page.evaluate(() => {
    if (window.dinoGame) {
      window.dinoGame.handleDuckPress(false);
    }
  });
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: 'audit_evidence/audit_running_16_resume_run.png' });

  await browser.close();

  console.log('Audit completed successfully. Total errors:', errors.length);
  if (errors.length > 0) {
    console.error('Errors encountered:', errors);
  }
}

testRunningAnimation().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
