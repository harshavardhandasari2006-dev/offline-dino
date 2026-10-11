const sharp = require('sharp');

(async () => {
  const allSprites = [
    'dino_run_0', 'dino_run_1', 'dino_run_2', 'dino_run_3', 'dino_run_4',
    'dino_jump_0', 'dino_jump_1', 'dino_jump_2', 'dino_jump_3', 'dino_jump_4',
    'dino_idle_0', 'dino_idle_1', 'dino_idle_2', 'dino_idle_3',
    'dino_duck_0', 'dino_duck_1', 'dino_duck_2', 'dino_duck_3', 'dino_duck_4',
    'dino_dead', 'dino_hit'
  ];

  console.log('--- PRECISE EYE FINDER ---');
  for (const name of allSprites) {
    const { data, info } = await sharp(`assets/sprites/${name}.png`).raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;

    // Scan for eye pupil / sclera / eyelid in head region
    // In ducking or dead, head is lower
    const isDuckOrDead = name.includes('duck') || name.includes('dead');
    const yStart = isDuckOrDead ? 10 : 8;
    const yEnd = isDuckOrDead ? Math.min(h, 45) : Math.min(h, 42);

    let sumX = 0, sumY = 0, count = 0;
    let minX = 999, maxX = 0, minY = 999, maxY = 0;

    for (let y = yStart; y < yEnd; y++) {
      for (let x = 40; x < Math.min(w, 100); x++) {
        const idx = (y * w + x) * 4;
        const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
        if (a > 100) {
          // Look for either white sclera (r>180, g>180, b>180) OR dark pupil (r<45, g<45, b<45) surrounded by green
          const isWhite = (r > 190 && g > 190 && b > 190);
          const isBlack = (r < 40 && g < 40 && b < 40);
          if (isWhite || isBlack) {
            // Check if not nostril (nostril is at x > 85, y > 25)
            if (x < 85 || y < 25) {
              sumX += x;
              sumY += y;
              count++;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
      }
    }

    if (count > 0) {
      const cx = (sumX / count).toFixed(1);
      const cy = (sumY / count).toFixed(1);
      console.log(`${name.padEnd(14)}: w=${w}, h=${h}, eyeCenter=(${cx}, ${cy}), box=[${minX}..${maxX}, ${minY}..${maxY}]`);
    } else {
      console.log(`${name.padEnd(14)}: no eye found`);
    }
  }
})();
