const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SPRITES_DIR = path.join(__dirname, 'assets', 'sprites');

async function purgeSand() {
  const files = ['dino_run_0.png', 'dino_run_1.png', 'dino_run_2.png', 'dino_run_3.png', 'dino_run_4.png', 'dino_dead.png'];
  
  for (const f of files) {
    const filePath = path.join(SPRITES_DIR, f);
    const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;
    const out = Buffer.from(data);

    // Identify green skin pixels:
    const isGreen = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        if (data[idx + 3] === 0) continue;
        const r = data[idx], g = data[idx+1], b = data[idx+2];
        if ((g > r + 8 && g > b + 15 && g > 40) || (g > 85 && g > r && g > b + 15)) {
          isGreen[y * W + x] = 1;
        }
      }
    }

    let purged = 0;
    for (let y = 80; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        if (out[idx + 3] === 0) continue;

        const r = out[idx], g = out[idx+1], b = out[idx+2];

        // Is it sand color?
        // Sand color: r > 190, g > 170, b > 140, r > b + 25
        const isSandColor = (r > 190 && g > 165 && b > 135 && r > b + 25);
        // Dark ground shadow:
        const isGroundShadow = (y >= 96 && r < 70 && g < 70 && b < 70 && x < 30 || x > 76);
        // Or horizontal ground strip outside feet:
        const isOutsideFeet = (f.startsWith('dino_run_') && y >= 96 && (x < 22 || x > 84));

        if (isSandColor || isGroundShadow || isOutsideFeet) {
          // Check if touches green skin within 3 pixels:
          let touchesGreen = false;
          for (let dy = -3; dy <= 1; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
                if (isGreen[ny * W + nx] === 1) {
                  touchesGreen = true; break;
                }
              }
            }
            if (touchesGreen) break;
          }

          // If it's outside feet or doesn't touch green skin, PURGE IT!
          if (!touchesGreen || isOutsideFeet || y >= 104) {
            out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
            purged++;
          }
        }
      }
    }

    await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(filePath);
    console.log(`[PURGED SAND] ${f}: purged ${purged} sand pixels.`);
  }
}

purgeSand();
