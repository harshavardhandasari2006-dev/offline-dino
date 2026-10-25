const sharp = require('sharp');
const { rgbToHsl } = require('./js/skins.js');

async function checkSpikes() {
  const { data, info } = await sharp('assets/sprites/dino_run_0.png').raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;

  console.log('Spikes along back of dino_run_0 (x: 100..180, y: 30..90):');
  for (let y = 30; y < 90; y++) {
    for (let x = 100; x < 180; x++) {
      const idx = (y * w + x) * 4;
      if (data[idx + 3] < 50) continue;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const [hue, sat, lit] = rgbToHsl(r, g, b);

      // Dark spikes on back
      if (lit < 0.40 && (g > r || b > r) && sat > 0.08) {
        console.log(`x=${x}, y=${y}: RGB=(${r},${g},${b}), H=${Math.round(hue)}, S=${sat.toFixed(2)}, L=${lit.toFixed(2)}`);
      }
    }
  }
}

checkSpikes().catch(console.error);
