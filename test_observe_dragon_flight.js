const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: edgePath, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 700 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await page.click('#btnStartGame');
  await page.waitForFunction(() => window.dinoGame && window.dinoGame.state === 'PLAYING');

  // Let's spawn a PTERODACTYL ahead of the dino and prevent game over during observation
  await page.evaluate(() => {
    const g = window.dinoGame;
    g.checkCollisions = () => false; // allow passing through for continuous visual observation
    g.obstacles = [{
      type: 'PTERODACTYL',
      x: 950,
      y: g.groundY - 72,
      groundOffset: -72,
      width: 58,
      height: 38,
      flapTimer: 0,
      flapFrame: 0,
      heightLabel: 'MID'
    }];
  });

  // Capture 10 frames spaced 160ms apart
  const frames = [];
  for (let i = 0; i < 10; i++) {
    const file = path.join(__dirname, `ptero_flight_seq_${i}.png`);
    await page.screenshot({ path: file });
    const info = await page.evaluate(() => {
      const p = window.dinoGame.obstacles[0];
      return p ? { x: p.x, flap: p.flapFrame } : null;
    });
    frames.push({ i, file: `ptero_flight_seq_${i}.png`, ...info });
    await new Promise(r => setTimeout(r, 160));
  }
  console.log(JSON.stringify(frames, null, 2));
  await browser.close();
})();
