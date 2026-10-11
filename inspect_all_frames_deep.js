const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function inspectAllFrames() {
  const spriteDir = path.join(__dirname, 'assets', 'sprites');
  const files = [
    'dino_idle_0.png', 'dino_idle_1.png', 'dino_idle_2.png', 'dino_idle_3.png',
    'dino_run_0.png', 'dino_run_1.png', 'dino_run_2.png', 'dino_run_3.png', 'dino_run_4.png',
    'dino_jump_0.png', 'dino_jump_1.png', 'dino_jump_2.png', 'dino_jump_3.png', 'dino_jump_4.png',
    'dino_duck_0.png', 'dino_duck_1.png', 'dino_duck_2.png', 'dino_duck_3.png', 'dino_duck_4.png',
    'dino_hit.png', 'dino_dead.png'
  ];

  console.log('=== DEEP INSPECTION OF ALL DINOSAUR FRAMES ===\n');

  for (const f of files) {
    const fullPath = path.join(spriteDir, f);
    if (!fs.existsSync(fullPath)) {
      console.log(`MISSING: ${f}`);
      continue;
    }
    const { data, info } = await sharp(fullPath).raw().toBuffer({ resolveWithObject: true });
    const { width, height } = info;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let nonZeroA = 0;
    let haloPixels = 0;
    let tailMinX = width;
    let feetXs = [];
    let feetMaxY = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const a = data[idx + 3];
        if (a > 20) {
          nonZeroA++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;

          // Tail region (x < 35, y between 40 and 80)
          if (x < 35 && y >= 40 && y <= 80) {
            if (x < tailMinX) tailMinX = x;
          }

          // Feet region (y >= 90)
          if (y >= 90) {
            if (y > feetMaxY) {
              feetMaxY = y;
              feetXs = [x];
            } else if (y === feetMaxY) {
              feetXs.push(x);
            }
          }

          // Check halo/white fringe
          // If pixel is semi-transparent and light or whitish
          const r = data[idx], g = data[idx + 1], b = data[idx + 2];
          if (a < 240 && r > 180 && g > 180 && b > 180) {
            haloPixels++;
          }
        }
      }
    }

    const footSpan = feetXs.length > 0 ? `[${Math.min(...feetXs)}..${Math.max(...feetXs)}] (count=${feetXs.length})` : 'none';
    console.log(`${f.padEnd(16)}: ${width}x${height} | bbox=[${minX},${minY}..${maxX},${maxY}] | feetMaxY=${feetMaxY} ${footSpan} | tailMinX=${tailMinX} | halo=${haloPixels}`);
  }
}

inspectAllFrames();
