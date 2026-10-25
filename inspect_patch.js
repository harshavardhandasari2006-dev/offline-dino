const sharp = require('sharp');
const { rgbToHsl } = require('./js/skins.js');

async function inspectPatch() {
  const { data, info } = await sharp('diagnostic_black_skin/test_pano_dino_green.png').raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;

  console.log('Inspecting patch at x: 175..210, y: 245..265:');
  for (let y = 245; y <= 265; y++) {
    for (let x = 175; x <= 210; x++) {
      const idx = (y * w + x) * 4;
      if (data[idx+3] < 50) continue;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const [hue, sat, lit] = rgbToHsl(r, g, b);
      if (hue >= 58 && hue <= 90 && lit > 0.45 && sat > 0.3) {
        console.log(`x=${x}, y=${y}: RGB=(${r},${g},${b}), H=${Math.round(hue)}, S=${sat.toFixed(2)}, L=${lit.toFixed(2)}`);
      }
    }
  }
}

inspectPatch().catch(console.error);
