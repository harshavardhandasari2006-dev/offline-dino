const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function testWingRotation() {
  const raw0 = await sharp('assets/sprites/pterodactyl_0.png').raw().toBuffer({ resolveWithObject: true });
  const W = raw0.info.width, H = raw0.info.height;
  const data = raw0.data;

  // Pivot point for wing rotation: shoulder joint at (x0 = 46, y0 = 38)
  const x0 = 46, y0 = 38;
  // Angle: rotate downwards clockwise by 55 degrees
  const angle = 55 * Math.PI / 180;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const out = Buffer.alloc(W * H * 4);

  // Copy head, beak, belly, tail, feet:
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      if (data[idx + 3] === 0) continue;
      
      const isBodyOrHead = (x <= 34) || (y >= 44 && x <= 74);
      if (isBodyOrHead) {
        out[idx] = data[idx];
        out[idx + 1] = data[idx + 1];
        out[idx + 2] = data[idx + 2];
        out[idx + 3] = data[idx + 3];
      }
    }
  }

  // Draw rotated wing:
  for (let y = 15; y < H; y++) {
    for (let x = 30; x < W; x++) {
      const idx = (y * W + x) * 4;
      if (out[idx + 3] > 100) continue; // preserve existing body

      // Map (x, y) back to (srcX, srcY):
      // dx = x - x0, dy = y - y0
      // [srcX - x0] = [ cos(-A)  -sin(-A) ] [ dx ] = [  cosA   sinA ] [ dx ]
      // [srcY - y0] = [ sin(-A)   cos(-A) ] [ dy ] = [ -sinA   cosA ] [ dy ]
      const dx = x - x0;
      const dy = y - y0;
      const srcX = Math.round(x0 + cosA * dx + sinA * dy);
      const srcY = Math.round(y0 - sinA * dx + cosA * dy);

      if (srcX >= 35 && srcX < W && srcY >= 5 && srcY < 48) {
        const srcIdx = (srcY * W + srcX) * 4;
        if (data[srcIdx + 3] > 40) {
          out[idx] = data[srcIdx];
          out[idx + 1] = data[srcIdx + 1];
          out[idx + 2] = data[srcIdx + 2];
          out[idx + 3] = data[srcIdx + 3];
        }
      }
    }
  }

  // Fill interpolation pinholes
  for (let y = 1; y < H - 1; y++) {
    for (let x = 35; x < W - 1; x++) {
      const idx = (y * W + x) * 4;
      if (out[idx + 3] === 0) {
        let count = 0, sumR = 0, sumG = 0, sumB = 0;
        for (const [nx, ny] of [[x-1, y], [x+1, y], [x, y-1], [x, y+1]]) {
          const nidx = (ny * W + nx) * 4;
          if (out[nidx + 3] > 0) {
            count++;
            sumR += out[nidx];
            sumG += out[nidx + 1];
            sumB += out[nidx + 2];
          }
        }
        if (count >= 3) {
          out[idx] = Math.round(sumR / count);
          out[idx + 1] = Math.round(sumG / count);
          out[idx + 2] = Math.round(sumB / count);
          out[idx + 3] = 255;
        }
      }
    }
  }

  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile('test_ptero_rot_down2.png');

  await sharp({
    create: {
      width: W * 2 + 20,
      height: H + 20,
      channels: 4,
      background: { r: 25, g: 35, b: 65, alpha: 1 }
    }
  }).composite([
    { input: 'test_ptero_up.png', left: 5, top: 10 },
    { input: 'test_ptero_rot_down2.png', left: W + 15, top: 10 }
  ]).png().toFile('test_ptero_rot_compare2.png');

  console.log('Saved test_ptero_rot_compare2.png');
}

testWingRotation();
