const sharp = require('sharp');
const path = require('path');

async function inspectColors() {
  const filePath = path.join(__dirname, 'assets', 'sprites', 'dino_idle_0.png');
  const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
  
  // Let's sample along a horizontal line cutting across the dinosaur head or belly
  // e.g. y = 30 (across head)
  console.log('Row y = 30 (Head across x from 30 to 110):');
  for (let x = 30; x <= 110; x++) {
    const idx = (30 * info.width + x) * 4;
    const a = data[idx + 3];
    if (a > 0) {
      console.log(`x=${x}: rgba(${data[idx]}, ${data[idx+1]}, ${data[idx+2]}, ${a})`);
    }
  }
}

inspectColors();
