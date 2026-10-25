const sharp = require('sharp');
const { rgbToHsl } = require('./js/skins.js');

async function inspectSkinGreen() {
  const idle = await sharp('assets/sprites/dino_idle_0.png').raw().toBuffer({ resolveWithObject: true });
  const w = idle.info.width, h = idle.info.height;
  const data = idle.data;

  let minHue = 360, maxHue = 0;
  let minSat = 1, maxSat = 0;
  let minLit = 1, maxLit = 0;

  // Let's sample pixels on the dino body (e.g. head, back, legs, green regions)
  for (let y = 15; y < 80; y++) {
    for (let x = 20; x < 65; x++) {
      const idx = (y * w + x) * 4;
      if (data[idx+3] < 50) continue;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const [hue, sat, lit] = rgbToHsl(r, g, b);

      // Distinct green skin: green dominant (g > r and g > b)
      if (g > r && g > b && sat > 0.15 && lit > 0.15 && lit < 0.90) {
        if (hue < minHue) minHue = hue;
        if (hue > maxHue) maxHue = hue;
        if (sat < minSat) minSat = sat;
        if (sat > maxSat) maxSat = sat;
        if (lit < minLit) minLit = lit;
        if (lit > maxLit) maxLit = lit;
      }
    }
  }

  console.log('Green skin stats on dino_idle_0:');
  console.log(`Hue range: [${minHue.toFixed(1)}, ${maxHue.toFixed(1)}]`);
  console.log(`Sat range: [${minSat.toFixed(2)}, ${maxSat.toFixed(2)}]`);
  console.log(`Lit range: [${minLit.toFixed(2)}, ${maxLit.toFixed(2)}]`);

  // What about dark back ridges/spikes on dino?
  // They are also green/teal hues but darker (lit 0.10 - 0.35)
}

inspectSkinGreen().catch(console.error);
