const sharp = require('sharp');
const path = require('path');

async function checkCactusPixels() {
  const { data, info } = await sharp(path.join(__dirname, 'assets', 'sprites', 'cactus_double.png')).raw().toBuffer({ resolveWithObject: true });
  console.log(`Cactus double size: ${info.width}x${info.height}`);
  for (let y = 0; y < info.height; y++) {
    for (let x of [0, info.width - 1]) {
      const idx = (y * info.width + x) * 4;
      if (data[idx + 3] > 0) {
        console.log(`Border pixel at x=${x}, y=${y}: rgba(${data[idx]}, ${data[idx+1]}, ${data[idx+2]}, ${data[idx+3]})`);
      }
    }
  }
}

checkCactusPixels();
