const sharp = require('sharp');
const path = require('path');

async function renderRunAscii() {
  for (let f = 0; f <= 4; f++) {
    const file = `dino_run_${f}.png`;
    const { data, info } = await sharp(path.join(__dirname, 'assets', 'sprites', file)).raw().toBuffer({ resolveWithObject: true });
    console.log(`\n=== FRAME ${f}: ${file} ===`);
    for (let y = 60; y < 105; y += 3) {
      let line = '';
      for (let x = 15; x < 115; x += 2) {
        const idx = (y * info.width + x) * 4;
        line += data[idx + 3] > 40 ? '#' : ' ';
      }
      if (line.trim()) console.log(line);
    }
  }
}

renderRunAscii();
