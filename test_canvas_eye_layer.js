const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  console.log('Testing controlled eye layer rendering in browser...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,800']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  // Inject a prototype eye layer renderer to test visual quality
  await page.evaluate(() => {
    // Add drawControlledEye method to SpriteRenderer
    window.spriteRenderer.drawControlledEye = function(ctx, eyeCenterX, eyeCenterY, eyeScale = 1.0, isClosed = false) {
      ctx.save();
      ctx.translate(eyeCenterX, eyeCenterY);
      ctx.scale(eyeScale, eyeScale);
      ctx.rotate(-0.08); // Slight natural cartoon tilt

      if (isClosed) {
        // Clean cartoon closed eyelid arc (⌒)
        ctx.strokeStyle = '#142410';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 3, 6.5, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      } else {
        // 1. Clean white cartoon sclera with dark outline
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#142410';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(0, 0, 5.8, 8.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 2. Solid black cartoon pupil looking forward-right
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.ellipse(1.4, 0.4, 3.2, 4.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // 3. Crisp classic white catchlight highlight
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(2.4, -1.8, 1.25, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    // Override drawMascot to include the controlled eye layer
    const origDrawMascot = window.spriteRenderer.drawMascot.bind(window.spriteRenderer);
    window.spriteRenderer.drawMascot = function(ctx, cx, cy, size = 135, animTime = 0) {
      origDrawMascot(ctx, cx, cy, size, animTime);

      // Controlled blink cycle (every 4 seconds, blinks for 0.15s)
      const blinkCycle = animTime % 4.0;
      const isBlinking = blinkCycle > 3.82 && blinkCycle < 3.97;

      // Mascot eye position
      const eyeX = cx + size * 0.155;
      const eyeY = cy - size * 0.235 + Math.sin(animTime * Math.PI * 2 * 1.05) * 2.2;
      const eyeScale = size / 72 * 0.95;

      this.drawControlledEye(ctx, eyeX, eyeY, eyeScale, isBlinking);
    };
  });

  // Wait 300ms and take screenshot
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(__dirname, 'test_controlled_mascot_open.png') });
  console.log('Saved test_controlled_mascot_open.png');

  // Trigger blink screenshot
  await page.evaluate(() => {
    window.uiManager.mascotAnimTime = 3.90; // inside blink window
  });
  await new Promise(r => setTimeout(r, 50));
  await page.screenshot({ path: path.join(__dirname, 'test_controlled_mascot_blink.png') });
  console.log('Saved test_controlled_mascot_blink.png');

  await browser.close();
})();
