const sharp = require('sharp');
const { rgbToHsl } = require('./js/skins.js');

async function inspectPixels() {
  console.log('--- INSPECTING GREEN DINO SPRITES PIXELS ---');
  
  // Inspect dino_idle_0
  const idle = await sharp('assets/sprites/dino_idle_0.png').raw().toBuffer({ resolveWithObject: true });
  const w = idle.info.width, h = idle.info.height;
  const data = idle.data;

  console.log(`dino_idle_0: ${w}x${h}`);

  // Let's find pixels in the eye region and claw region
  // Let's scan for pixels with sat < 0.25 (eye whites/claws/highlights)
  const lowSatPixels = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const a = data[idx + 3];
      if (a < 30) continue;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const [hue, sat, lit] = rgbToHsl(r, g, b);

      if (sat < 0.25 && lit > 0.35 && lit < 0.95) {
        lowSatPixels.push({ x, y, r, g, b, hue: Math.round(hue), sat: sat.toFixed(2), lit: lit.toFixed(2) });
      }
    }
  }

  console.log(`Found ${lowSatPixels.length} low-saturation mid/high lit pixels in dino_idle_0:`);
  console.log('Sample (first 25):', lowSatPixels.slice(0, 25));

  // Let's also check home_title_sign_green.png
  const home = await sharp('assets/sprites/home_title_sign_green.png').raw().toBuffer({ resolveWithObject: true });
  const hw = home.info.width, hh = home.info.height;
  const hdata = home.data;
  console.log(`home_title_sign_green: ${hw}x${hh}`);

  // Dino eye in home sign is around x: 230-320, y: 30-90
  const eyePixels = [];
  for (let y = 30; y < 90; y++) {
    for (let x = 230; x < 320; x++) {
      const idx = (y * hw + x) * 4;
      const a = hdata[idx + 3];
      if (a < 30) continue;
      const r = hdata[idx], g = hdata[idx+1], b = hdata[idx+2];
      const [hue, sat, lit] = rgbToHsl(r, g, b);
      if (sat < 0.25 && lit > 0.40) {
        eyePixels.push({ x, y, r, g, b, hue: Math.round(hue), sat: sat.toFixed(2), lit: lit.toFixed(2) });
      }
    }
  }
  console.log(`Found ${eyePixels.length} eye-white/reflection pixels in home sign mascot:`);
  console.log('Sample (first 25):', eyePixels.slice(0, 25));
}

inspectPixels().catch(console.error);
