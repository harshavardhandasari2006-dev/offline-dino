const puppeteer = require('puppeteer-core');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000';

async function captureScreens() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // 1. Mobile Portrait Active Gameplay
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.click('#btnStartGame');
  await new Promise(r => setTimeout(r, 600)); // wait for countdown

  // Let dino run for 1 second
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(__dirname, 'phase2_screen_portrait_gameplay.png') });

  // 2. Desktop 1920x1080 Active Gameplay (Ground variation check)
  await page.setViewport({ width: 1920, height: 1080 });
  await page.evaluate(() => window.dinoGame.resize());
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(__dirname, 'phase2_screen_desktop_gameplay.png') });

  // 3. High Scores Modal (Storage Blocked check)
  await page.evaluate(() => {
    window.dinoGame.storageAvailable = false;
    window.uiManager.openHighScore();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(__dirname, 'phase2_screen_storage_notice.png') });

  await browser.close();
  console.log('Phase 2 screenshots captured successfully.');
}

captureScreens().catch(console.error);
