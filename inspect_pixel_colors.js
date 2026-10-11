const sharp = require('sharp');
const path = require('path');

async function checkSamplePixels() {
  const { data, info } = await sharp(path.join(__dirname, 'assets', 'sprites', 'dino_run_1.png')).raw().toBuffer({ resolveWithObject: true });
  let count = 0;
  for (let y = 0; y < info.height && count < 20; y++) {
    for (let x = 0; x < info.width && count < 20; x++) {
      const idx = (y * info.width + x) * 4;
      const a = data[idx + 3];
      if (a > 0) {
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        if (r > 210 && g > 210 && b > 210) {
          console.log(`x=${x}, y=${y}: rgba(${r}, ${g}, ${b}, ${a})`);
          count++;
        }
      }
    }
  }
}

checkSamplePixels();
