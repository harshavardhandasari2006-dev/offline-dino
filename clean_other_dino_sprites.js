const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function cleanRemainingDinoSprites() {
  const files = [
    'dino_dead.png', 'dino_hit.png',
    'dino_jump_0.png', 'dino_jump_1.png', 'dino_jump_2.png', 'dino_jump_3.png', 'dino_jump_4.png',
    'dino_duck_0.png', 'dino_duck_1.png', 'dino_duck_2.png', 'dino_duck_3.png', 'dino_duck_4.png'
  ];

  for (const f of files) {
    const fullPath = path.join(__dirname, 'assets', 'sprites', f);
    if (!fs.existsSync(fullPath)) continue;

    const { data, info } = await sharp(fullPath).raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;
    const out = Buffer.from(data);

    let cleared = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        if (out[idx + 3] === 0) continue;

        const r = out[idx], g = out[idx + 1], b = out[idx + 2];

        // Definite Peach Sand:
        // Peach sand is reddish-peach: r > 175, g in 120..180, b in 90..155, with r - g >= 18 and r - b >= 35.
        // Dinosaur belly has r > 190, g > 185, b in 130..170, Math.abs(r - g) <= 12 (cream, not reddish).
        // Claw has r > 190, g > 185, Math.abs(r - g) <= 12.
        const isBellyOrClaw = (r > 185 && g > 180 && Math.abs(r - g) <= 12);
        const isPeachSand = (r > 175 && g > 115 && g < 185 && b > 85 && b < 160 && (r - g >= 18) && (r - b >= 32) && !isBellyOrClaw);

        // Also check for row 104+ in standing/running/jumping poses
        const isPastBaseline = (y >= 104);

        if (isPeachSand || isPastBaseline) {
          out[idx] = 0;
          out[idx + 1] = 0;
          out[idx + 2] = 0;
          out[idx + 3] = 0;
          cleared++;
        }
      }
    }

    // Connected component clean: remove any isolated 1-pixel or 2-pixel islands
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        if (out[idx + 3] > 0) {
          let neighbors = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const qx = x + dx, qy = y + dy;
              if (qx >= 0 && qx < W && qy >= 0 && qy < H) {
                if (out[(qy * W + qx) * 4 + 3] > 20) neighbors++;
              }
            }
          }
          if (neighbors === 0) {
            out[idx + 3] = 0;
            cleared++;
          }
        }
      }
    }

    await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(fullPath);
    console.log(`Cleaned ${f}: removed ${cleared} artifact pixels`);
  }
}

cleanRemainingDinoSprites().catch(console.error);
