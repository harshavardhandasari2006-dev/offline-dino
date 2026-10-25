const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testBlue() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  await page.evaluate(() => {
    window.SkinManager.setSelectedSkinId('blue');
    window.uiManager.updateHomeDinoSkin('blue');
  });
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({ path: 'diagnostic_black_skin/home_blue_skin.png' });
  await browser.close();
  console.log('Saved home_blue_skin.png');
}

testBlue().catch(console.error);
