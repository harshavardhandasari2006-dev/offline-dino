const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const delay = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('=== VERIFYING CHARACTER EYE CONSISTENCY IN GAMEPLAY ===');
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,700']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 700 });

  // 1. Home Screen Mascot
  console.log('1. Loading Home Screen...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await delay(800);
  
  await page.screenshot({ path: 'verify_home_screen.png' });
  console.log('  -> Captured verify_home_screen.png');

  // Crop Home Mascot Head
  const canvasBox = await page.$eval('#mascotCanvas', el => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  console.log('  Home mascot canvas box:', canvasBox);

  // Mascot head crop: center x is canvasBox.left + canvasBox.width/2
  const mascotCenterX = Math.round(canvasBox.left + canvasBox.width / 2);
  const mascotCenterY = Math.round(canvasBox.top + canvasBox.height / 2);

  await sharp('verify_home_screen.png')
    .extract({
      left: Math.max(0, mascotCenterX - 55),
      top: Math.max(0, mascotCenterY - 65),
      width: 110,
      height: 110
    })
    .resize(220, 220, { kernel: 'nearest' })
    .toFile('crop_mascot_head.png');
  console.log('  -> Saved crop_mascot_head.png');

  // 2. Start Game
  console.log('2. Starting Game...');
  await page.click('#btnStartGame');
  // Wait for countdown 3..2..1..GO
  await delay(2800);

  // Helper to get dinosaur head screen bounding box
  async function getDinoHeadBox() {
    return await page.evaluate(() => {
      const g = window.dinoGame;
      const c = g.canvas;
      const r = c.getBoundingClientRect();
      const viewW = c.width / g.scale;
      const viewH = c.height / g.scale;
      
      const pageX = r.left + (g.dino.x / viewW) * r.width;
      const pageY = r.top + (g.dino.y / viewH) * r.height;
      
      // Dinosaur rendered height is ~72 in view units
      const dinoScreenH = (72 / viewH) * r.height;
      const dinoScreenW = dinoScreenH; // approx
      
      return {
        left: Math.round(pageX + dinoScreenW * 0.35),
        top: Math.round(pageY),
        width: Math.round(dinoScreenW * 0.7),
        height: Math.round(dinoScreenH * 0.7)
      };
    });
  }

  // 3. Running state capture
  console.log('3. Capturing Running Gameplay...');
  await delay(300);
  await page.screenshot({ path: 'verify_gameplay_running.png' });
  const runBox = await getDinoHeadBox();
  console.log('  Run dino box:', runBox);

  await sharp('verify_gameplay_running.png')
    .extract({
      left: Math.max(0, Math.min(1100, runBox.left)),
      top: Math.max(0, Math.min(600, runBox.top)),
      width: Math.min(100, runBox.width),
      height: Math.min(100, runBox.height)
    })
    .resize(200, 200, { kernel: 'nearest' })
    .toFile('crop_running_head.png');
  console.log('  -> Saved crop_running_head.png');

  // 4. Jump state capture
  console.log('4. Capturing Jump...');
  await page.keyboard.press('Space');
  await delay(220);
  await page.screenshot({ path: 'verify_gameplay_jump.png' });
  const jumpBox = await getDinoHeadBox();
  console.log('  Jump dino box:', jumpBox);

  await sharp('verify_gameplay_jump.png')
    .extract({
      left: Math.max(0, Math.min(1100, jumpBox.left)),
      top: Math.max(0, Math.min(600, jumpBox.top)),
      width: Math.min(100, jumpBox.width),
      height: Math.min(100, jumpBox.height)
    })
    .resize(200, 200, { kernel: 'nearest' })
    .toFile('crop_jumping_head.png');
  console.log('  -> Saved crop_jumping_head.png');

  // Wait for landing
  await delay(800);

  // 5. Ducking capture (Closed eyes)
  console.log('5. Capturing Ducking (Holding Down Arrow)...');
  await page.keyboard.down('ArrowDown');
  await delay(300);
  await page.screenshot({ path: 'verify_gameplay_duck_closed.png' });
  const duckBox = await getDinoHeadBox();
  console.log('  Duck dino box:', duckBox);

  await sharp('verify_gameplay_duck_closed.png')
    .extract({
      left: Math.max(0, Math.min(1100, duckBox.left)),
      top: Math.max(0, Math.min(600, duckBox.top)),
      width: Math.min(100, duckBox.width),
      height: Math.min(100, duckBox.height)
    })
    .resize(200, 200, { kernel: 'nearest' })
    .toFile('crop_duck_closed_head.png');
  console.log('  -> Saved crop_duck_closed_head.png');

  // 6. Release Down Arrow -> Recover to Open Eyes
  console.log('6. Releasing Down Arrow (Recovering to master open eyes)...');
  await page.keyboard.up('ArrowDown');
  await delay(350);
  await page.screenshot({ path: 'verify_gameplay_duck_recovered.png' });
  const recoverBox = await getDinoHeadBox();
  console.log('  Recover dino box:', recoverBox);

  await sharp('verify_gameplay_duck_recovered.png')
    .extract({
      left: Math.max(0, Math.min(1100, recoverBox.left)),
      top: Math.max(0, Math.min(600, recoverBox.top)),
      width: Math.min(100, recoverBox.width),
      height: Math.min(100, recoverBox.height)
    })
    .resize(200, 200, { kernel: 'nearest' })
    .toFile('crop_duck_recovered_head.png');
  console.log('  -> Saved crop_duck_recovered_head.png');

  await browser.close();
  console.log('\n=== ALL EYE CONSISTENCY TESTS CAPTURED SUCCESSFULLY! ===');
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
