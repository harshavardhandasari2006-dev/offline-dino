const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.join(__dirname, 'diagnostic_black_skin');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  console.log('--- DIAGNOSING BLACK SKIN ISSUE ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // 1. Select Black skin
  await page.evaluate(() => {
    window.SkinManager.setSelectedSkinId('black');
    window.uiManager.updateHomeDinoSkin('black');
    if (window.spriteRenderer) {
      window.spriteRenderer.setSkin('black');
    }
  });
  await new Promise(r => setTimeout(r, 600));

  // Take screenshot of homepage with black skin
  await page.screenshot({ path: path.join(OUT_DIR, 'home_black_skin.png') });

  // 2. Open skin customization modal
  await page.evaluate(() => {
    window.uiManager.openCustomizationScreen();
    window.uiManager.selectSkinPreview('black');
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT_DIR, 'skins_modal_black.png') });

  // 3. Start game to inspect running dinosaur with black skin
  await page.evaluate(() => {
    window.uiManager.closeCustomizationScreen();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.click('#btnStartGame');
  // Wait for loading screen (3 seconds) + a moment in gameplay
  await new Promise(r => setTimeout(r, 4000));

  await page.screenshot({ path: path.join(OUT_DIR, 'gameplay_black_running.png') });

  // 4. Inspect recolored sprites directly from spriteRenderer
  const spriteDump = await page.evaluate(() => {
    const sr = window.spriteRenderer;
    const run0 = sr.getDinoSprite('dino_run_0', 'black');
    const idle0 = sr.getDinoSprite('dino_idle_0', 'black');
    const jump01 = sr.getDinoSprite('jump_01', 'black');
    const duck01 = sr.getDinoSprite('duck_01', 'black');

    function toDataUrl(cvs) {
      if (!cvs) return null;
      if (cvs instanceof HTMLCanvasElement) return cvs.toDataURL();
      const c = document.createElement('canvas');
      c.width = cvs.width || cvs.naturalWidth;
      c.height = cvs.height || cvs.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(cvs, 0, 0);
      return c.toDataURL();
    }

    return {
      run0: toDataUrl(run0),
      idle0: toDataUrl(idle0),
      jump01: toDataUrl(jump01),
      duck01: toDataUrl(duck01)
    };
  });

  for (const [k, dataUrl] of Object.entries(spriteDump)) {
    if (dataUrl) {
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(path.join(OUT_DIR, `sprite_${k}_black.png`), Buffer.from(base64, 'base64'));
    }
  }

  await browser.close();
  console.log('Diagnostic finished. Check files in:', OUT_DIR);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
