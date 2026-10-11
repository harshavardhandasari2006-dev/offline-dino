const sharp = require('sharp');
const path = require('path');

const SPRITES_DIR = path.join(__dirname, 'assets', 'sprites');

async function cleanDinoDead() {
  const filePath = path.join(SPRITES_DIR, 'dino_dead.png');
  const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const out = Buffer.from(data);

  let cleared = 0;
  for (let y = 49; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      if (out[idx + 3] === 0) continue;
      const r = out[idx], g = out[idx+1], b = out[idx+2];
      // Sand: r > 200, g in 170..230, b in 120..200, r > b + 35
      const isSand = (r > 200 && g > 170 && b > 115 && r > b + 30);
      if (isSand || y >= 53) {
        out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
        cleared++;
      }
    }
  }

  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(filePath);
  console.log(`[DEAD SAND PURGED] Cleared ${cleared} sand pixels from dino_dead.png`);
}

cleanDinoDead();
