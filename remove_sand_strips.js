const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SPRITES_DIR = path.join(__dirname, 'assets', 'sprites');

async function removeSandStrips() {
  const files = ['dino_run_0.png', 'dino_run_1.png', 'dino_run_2.png', 'dino_run_3.png', 'dino_run_4.png', 'dino_dead.png'];
  for (const f of files) {
    const filePath = path.join(SPRITES_DIR, f);
    const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;
    const out = Buffer.from(data);

    let cleared = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        if (out[idx + 3] === 0) continue;

        const r = out[idx], g = out[idx + 1], b = out[idx + 2];

        // Is peach sand:
        // Peach sand is: r > 180, g in 130..175, b in 90..140, r - g >= 20, r - b >= 40
        // Claws/toenails: r > 190, g > 185, b in 120..155, r - g <= 15
        const isPeachSand = (r > 175 && g < 178 && b < 150 && (r - g >= 20) && (r - b >= 38));
        // Also: anything in row y >= 104 in run frames is strictly ground
        const isBelowBaseline = (f.startsWith('dino_run_') && y >= 104);

        if (isPeachSand || isBelowBaseline) {
          out[idx] = 0; out[idx + 1] = 0; out[idx + 2] = 0; out[idx + 3] = 0;
          cleared++;
        }
      }
    }

    await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(filePath);
    console.log(`[SAND REMOVED] ${f}: Cleared ${cleared} sand pixels.`);
  }
}

removeSandStrips();
