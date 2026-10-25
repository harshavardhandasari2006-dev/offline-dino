const sharp = require('sharp');
const path = require('path');
const uploadDir = 'C:\\Users\\asus\\.gemini\\antigravity-ide\\brain\\1c3e5139-b62e-4146-8621-13708d351c51\\.user_uploaded';
const refPath = path.join(uploadDir, 'media_1792219879817.jpg');

async function buildCleanPedestalsOnBg() {
  const { data: bgData } = await sharp('assets/sprites/home_bg_desktop.png').raw().toBuffer({ resolveWithObject: true });
  const { data: refData } = await sharp(refPath).raw().toBuffer({ resolveWithObject: true });
  const w = 1024, h = 576;
  const out = Buffer.from(bgData);

  // Smooth the left cloud discoloration first:
  for (let y = 100; y < 220; y++) {
    for (let x = 250; x < 350; x++) {
      const idx = (y * w + x) * 3;
      const r = out[idx], g = out[idx+1], b = out[idx+2];
      if (r < 195 && g > 220 && b > 235) {
        // Sample neighboring normal cloud at (x - 40, y)
        const nIdx = (y * w + (x - 45)) * 3;
        out[idx] = out[nIdx];
        out[idx+1] = out[nIdx+1];
        out[idx+2] = out[nIdx+2];
      }
    }
  }

  // Composite the two stone pedestals from refData:
  // Left pedestal: x in [370, 465], y in [395, 442]
  // Right pedestal: x in [550, 645], y in [395, 442]
  for (let y = 395; y <= 442; y++) {
    for (let x = 360; x <= 655; x++) {
      const inLeft = (x >= 370 && x <= 465);
      const inRight = (x >= 550 && x <= 645);
      if (!inLeft && !inRight) continue;

      const idx = (y * w + x) * 3;
      const r = refData[idx], g = refData[idx+1], b = refData[idx+2];

      const isRock = (r > 90 && g > 50 && b < 125 && r > b + 20);
      const isLeaf = (g > 70 && g > r * 1.1);
      const isBorder = (r < 80 && g < 55 && b < 45 && r > b);

      if (isRock || isLeaf || isBorder) {
        out[idx] = r;
        out[idx+1] = g;
        out[idx+2] = b;
      }
    }
  }

  await sharp(out, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toFile('assets/sprites/home_bg_desktop.png');
  console.log('Updated assets/sprites/home_bg_desktop.png with clean pedestals and smooth cloud!');
}
buildCleanPedestalsOnBg();
