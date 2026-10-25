const puppeteer = require('puppeteer-core');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TARGET_URL = 'http://localhost:3000/';

async function captureZoomProof() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,700']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 700 });
  await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });
  await page.click('#btnStartGame');
  await page.waitForFunction(() => window.dinoGame && window.dinoGame.state === 'PLAYING', { timeout: 6000 });

  await page.evaluate(() => {
    const g = window.dinoGame;
    const ui = window.uiManager;
    ui.cancelCountdown();
    g.resetDino();
    g.state = g.STATE_PLAYING;
    g.score = 150n;
    g.speed = 280;

    // Freeze motion for exact photographic capture
    const dragonMid = {
      type: 'PTERODACTYL',
      worldX: g.distance + g.dino.x + 20,
      x: g.dino.x + 20,
      prevX: g.dino.x + 20,
      y: g.groundY - 84,
      groundOffset: -84,
      width: 60,
      height: 46,
      flightSpeed: 120,
      speed: 400,
      flapTimer: 0,
      flapFrame: 0,
      heightLabel: 'MID'
    };
    g.obstacles = [dragonMid];
    g.keys.duck = true;
    g.dino.isDucking = true;
    g.render();
  });

  await page.screenshot({
    path: path.join(__dirname, 'proof_duck_clearance_mid_zoom.png'),
    clip: { x: 50, y: 350, width: 350, height: 260 }
  });

  await page.evaluate(() => {
    const g = window.dinoGame;
    g.obstacles[0].y = g.groundY - 90;
    g.obstacles[0].groundOffset = -90;
    g.obstacles[0].heightLabel = 'HIGH';
    g.render();
  });

  await page.screenshot({
    path: path.join(__dirname, 'proof_duck_clearance_high_zoom.png'),
    clip: { x: 50, y: 350, width: 350, height: 260 }
  });

  console.log('Saved proof_duck_clearance_mid_zoom.png and high zoom');
  await browser.close();
}

captureZoomProof().catch(console.error);
