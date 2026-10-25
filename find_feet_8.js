const sharp = require('sharp');

async function findFeet() {
  for (let i = 0; i < 8; i++) {
    const file = `assets/sprites/dino_run_${i}.png`;
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    
    let maxFootY = -1;
    let minFootY = 999;
    for (let y = 80; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const a = data[(y * info.width + x) * 4 + 3];
        if (a > 100) {
          if (y > maxFootY) maxFootY = y;
          if (y < minFootY) minFootY = y;
        }
      }
    }
    console.log(`Frame ${i}: foot sole lowest y=${maxFootY}`);
  }
}

findFeet().catch(console.error);
