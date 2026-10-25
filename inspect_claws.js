const sharp = require('sharp');
const { rgbToHsl } = require('./js/skins.js');

async function inspectClaws() {
  const idle = await sharp('assets/sprites/dino_idle_0.png').raw().toBuffer({ resolveWithObject: true });
  const w = idle.info.width, h = idle.info.height;
  const data = idle.data;

  console.log('--- CLAWS ON FEET OF dino_idle_0 (bottom y > 90) ---');
  for (let y = 85; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const a = data[idx + 3];
      if (a < 30) continue;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const [hue, sat, lit] = rgbToHsl(r, g, b);

      // Claws are bright/light pixels on the feet
      if (lit > 0.45 && (r > 130 || g > 130 || b > 130)) {
        console.log(`x=${x}, y=${y}: RGB=(${r},${g},${b}) Hue=${Math.round(hue)} Sat=${sat.toFixed(2)} Lit=${lit.toFixed(2)}`);
      }
    }
  }

  // Also in run_01 or run_0
  const run0 = await sharp('assets/sprites/dino_run_0.png').raw().toBuffer({ resolveWithObject: true });
  const rw = run0.info.width, rh = run0.info.height;
  const rdata = run0.data;
  console.log('--- CLAWS ON FEET OF dino_run_0 (bottom y > 95) ---');
  for (let y = 90; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const idx = (y * rw + x) * 4;
      const a = rdata[idx + 3];
      if (a < 30) continue;
      const r = rdata[idx], g = rdata[idx+1], b = rdata[idx+2];
      const [hue, sat, lit] = rgbToHsl(r, g, b);

      if (lit > 0.45 && (r > 130 || g > 130 || b > 130)) {
        console.log(`x=${x}, y=${y}: RGB=(${r},${g},${b}) Hue=${Math.round(hue)} Sat=${sat.toFixed(2)} Lit=${lit.toFixed(2)}`);
      }
    }
  }
}

inspectClaws().catch(console.error);
