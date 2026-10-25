const sharp = require('sharp');
const { rgbToHsl } = require('./js/skins.js');

async function inspectBellySpeckles() {
  const { data, info } = await sharp('diagnostic_black_skin/test_pano_dino_green.png').raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;

  console.log('Inspecting belly pixels around x: 170..230, y: 240..280:');
  for (let y = 240; y < 280; y++) {
    for (let x = 170; x < 230; x++) {
      const idx = (y * w + x) * 4;
      if (data[idx+3] < 50) continue;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const [hue, sat, lit] = rgbToHsl(r, g, b);

      // What makes it turn black? It must be matching isGreenSkin or isDarkSpikes!
      const isGreenSkin = (hue >= 60 && hue <= 175 && sat >= 0.13 && lit >= 0.12);
      const isDarkSpikes = (hue >= 70 && hue <= 185 && lit <= 0.38 && sat >= 0.08 && g >= r);

      if (isGreenSkin || isDarkSpikes) {
        console.log(`Belly turning to skin at x=${x}, y=${y}: RGB=(${r},${g},${b}), H=${Math.round(hue)}, S=${sat.toFixed(2)}, L=${lit.toFixed(2)}`);
      }
    }
  }
}

inspectBellySpeckles().catch(console.error);
