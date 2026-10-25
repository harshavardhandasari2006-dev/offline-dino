const sharp = require('sharp');

async function findEyes() {
  for (let i = 0; i < 8; i++) {
    const file = `assets/sprites/dino_run_${i}.png`;
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    
    // Find black pupil (r < 25, g < 25, b < 25) in upper head region (y: 10..45, x: 60..95)
    let sumX = 0, sumY = 0, count = 0;
    for (let y = 10; y < 45; y++) {
      for (let x = 60; x < 95; x++) {
        const idx = (y * info.width + x) * 4;
        const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
        if (a > 200 && r < 30 && g < 30 && b < 30) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }
    const pupilX = count > 0 ? (sumX / count).toFixed(1) : 'none';
    const pupilY = count > 0 ? (sumY / count).toFixed(1) : 'none';
    console.log(`Frame ${i}: pupil center at (${pupilX}, ${pupilY}), count=${count}`);
  }
}

findEyes().catch(console.error);
