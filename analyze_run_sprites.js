const sharp = require('sharp');
const path = require('path');

async function analyzeRun() {
  for (let f = 0; f <= 4; f++) {
    const file = `dino_run_${f}.png`;
    const { data, info } = await sharp(path.join(__dirname, 'assets', 'sprites', file)).raw().toBuffer({ resolveWithObject: true });
    
    // Check lowest foot pixels (where alpha > 50)
    let lowestY = 0;
    let feetXs = [];
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const idx = (y * info.width + x) * 4;
        if (data[idx + 3] > 50) {
          if (y > lowestY) {
            lowestY = y;
            feetXs = [x];
          } else if (y === lowestY) {
            feetXs.push(x);
          }
        }
      }
    }
    
    console.log(`Frame ${f}: lowestY=${lowestY}, foot span X=[${Math.min(...feetXs)}..${Math.max(...feetXs)}], count=${feetXs.length}`);
  }
}

analyzeRun();
