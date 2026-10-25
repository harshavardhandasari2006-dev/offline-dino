const sharp = require('sharp');
const { rgbToHsl } = require('./js/skins.js');

async function measureBlackSkin() {
  const img = await sharp('assets/sprites/skin_black.png').raw().toBuffer({ resolveWithObject: true });
  const w = img.info.width, h = img.info.height;
  const data = img.data;

  // Let's sample body skin pixels (not belly, not eyes, not claws)
  // In skin_black.png, the body is around y: 60..180, x: 70..180
  const skinSamples = [];
  const spikeSamples = [];

  for (let y = 50; y < 200; y++) {
    for (let x = 60; x < 200; x++) {
      const idx = (y * w + x) * 4;
      if (data[idx + 3] < 200) continue;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const [hue, sat, lit] = rgbToHsl(r, g, b);

      // Exclude belly (warm yellow: r > 180, g > 160, b < 160)
      if (r > 180 && g > 150 && b < 150) continue;
      // Exclude eye whites (lit > 0.85, sat < 0.15)
      if (lit > 0.85 && sat < 0.15) continue;
      // Exclude claws (y > 170, lit > 0.70)
      if (y > 170 && lit > 0.65) continue;

      if (y < 75 && lit < 0.25) {
        spikeSamples.push({ r, g, b, hue: Math.round(hue), sat: sat.toFixed(2), lit: lit.toFixed(2) });
      } else if (lit >= 0.12 && lit <= 0.55 && sat < 0.25) {
        skinSamples.push({ r, g, b, hue: Math.round(hue), sat: sat.toFixed(2), lit: lit.toFixed(2) });
      }
    }
  }

  console.log(`Collected ${skinSamples.length} black skin body samples.`);
  // Calculate average / min / max
  let sumH = 0, sumS = 0, sumL = 0;
  let minL = 1, maxL = 0;
  for (const s of skinSamples) {
    sumH += s.hue;
    sumS += parseFloat(s.sat);
    sumL += parseFloat(s.lit);
    if (parseFloat(s.lit) < minL) minL = parseFloat(s.lit);
    if (parseFloat(s.lit) > maxL) maxL = parseFloat(s.lit);
  }
  console.log('Average skin body:', {
    avgHue: (sumH / skinSamples.length).toFixed(1),
    avgSat: (sumS / skinSamples.length).toFixed(2),
    avgLit: (sumL / skinSamples.length).toFixed(2),
    minLit: minL.toFixed(2),
    maxLit: maxL.toFixed(2)
  });
  console.log('Skin samples (first 10):', skinSamples.slice(0, 10));
}

measureBlackSkin().catch(console.error);
