const sharp = require('sharp');

(async () => {
  const frames = [
    'dino_run_0', 'dino_run_1', 'dino_run_2', 'dino_run_3', 'dino_run_4',
    'dino_jump_0', 'dino_jump_1', 'dino_jump_2', 'dino_jump_3', 'dino_jump_4',
    'dino_idle_0', 'dino_idle_1', 'dino_idle_2', 'dino_idle_3'
  ];

  console.log('--- FRAME EYE ANALYSIS ---');
  for (const name of frames) {
    const filePath = `assets/sprites/${name}.png`;
    const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
    
    // Find white sclera / pupil centroid in head region (x: 50..95, y: 10..45)
    let sumX = 0, sumY = 0, count = 0;
    let minX = 999, maxX = 0, minY = 999, maxY = 0;

    for (let y = 10; y < 45; y++) {
      for (let x = 50; x < Math.min(info.width, 95); x++) {
        const idx = (y * info.width + x) * 4;
        const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
        if (a > 100) {
          // White sclera
          if (r > 210 && g > 210 && b > 210) {
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

    if (count > 0) {
      const centerX = (sumX / count).toFixed(1);
      const centerY = (sumY / count).toFixed(1);
      console.log(`${name.padEnd(12)}: imgSize=${info.width}x${info.height}, eyeCenter=(${centerX}, ${centerY}), bounds=[${minX}..${maxX}, ${minY}..${maxY}], count=${count}`);
    } else {
      console.log(`${name.padEnd(12)}: NO SCLERA DETECTED (likely closed eye or ducking)`);
    }
  }
})();
