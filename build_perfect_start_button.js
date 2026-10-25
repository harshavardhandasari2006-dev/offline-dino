const sharp = require('sharp');
const path = require('path');
const uploadDir = 'C:\\Users\\asus\\.gemini\\antigravity-ide\\brain\\1c3e5139-b62e-4146-8621-13708d351c51\\.user_uploaded';
const refPath = path.join(uploadDir, 'media_1792219879817.jpg');

async function buildStartButtonAndPedestals() {
  const { data, info } = await sharp(refPath)
    .extract({ left: 360, top: 328, width: 304, height: 88 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width, h = info.height;
  const out = Buffer.alloc(w * h * 4);

  const cx1 = 44.5, cx2 = 257.5, cy = 32.8, radius = 32.4;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx3 = (y * w + x) * 3;
      const idx4 = (y * w + x) * 4;
      const r = data[idx3], g = data[idx3 + 1], b = data[idx3 + 2];

      out[idx4] = r;
      out[idx4 + 1] = g;
      out[idx4 + 2] = b;
      out[idx4 + 3] = 255;

      // 1. Upper pill area (y < 65):
      if (y < 65) {
        let dist = 0;
        if (x < cx1) dist = Math.hypot(x - cx1, y - cy);
        else if (x > cx2) dist = Math.hypot(x - cx2, y - cy);
        else dist = Math.abs(y - cy);

        if (dist >= radius + 0.6) {
          out[idx4 + 3] = 0;
        } else if (dist > radius - 0.6) {
          out[idx4 + 3] = Math.round((radius + 0.6 - dist) / 1.2 * 255);
        }
      } else {
        // 2. Lower pedestal area (y >= 65):
        // Outside pedestals:
        if (x < 24 || x > 282) {
          out[idx4 + 3] = 0;
          continue;
        }
        // Between pedestals below wooden ledge:
        if (x >= 115 && x <= 190 && y > 73) {
          out[idx4 + 3] = 0;
          continue;
        }

        // Sky or distant horizon outside/between pedestals:
        const isSky = (b > 135 && b > r + 10);
        const isHorizonBleed = (x > 105 && x < 120 && b > 120 && r > 180 && g > 150);

        if (isSky || isHorizonBleed) {
          out[idx4 + 3] = 0;
        } else {
          // Keep authentic rock pedestal, leaves, and wooden ledge
          out[idx4 + 3] = 255;
        }
      }
    }
  }

  // Soft edge anti-aliasing
  for (let y = 65; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx4 = (y * w + x) * 4;
      if (out[idx4 + 3] === 0) {
        const hasFg = (
          out[((y-1)*w + x)*4 + 3] === 255 ||
          out[((y+1)*w + x)*4 + 3] === 255 ||
          out[(y*w + x - 1)*4 + 3] === 255 ||
          out[(y*w + x + 1)*4 + 3] === 255
        );
        if (hasFg) {
          out[idx4 + 3] = 110;
        }
      }
    }
  }

  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile('assets/sprites/btn_start_game_orange.png');
  console.log('Saved perfect assets/sprites/btn_start_game_orange.png (304x88)!');
}

buildStartButtonAndPedestals();
