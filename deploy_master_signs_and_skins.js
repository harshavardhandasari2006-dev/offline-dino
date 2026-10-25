const sharp = require('sharp');
const fs = require('fs');
const { DINO_SKINS, rgbToHsl, hslToRgb } = require('./js/skins.js');

async function deployMasterSignsAndSkins() {
  const masterSignPath = 'scratch_master_sign_perfect.png';
  fs.copyFileSync(masterSignPath, 'assets/sprites/home_title_sign.png');
  fs.copyFileSync(masterSignPath, 'assets/sprites/home_title_sign_green.png');
  console.log('Copied master sign to assets/sprites/home_title_sign.png & home_title_sign_green.png');

  const { data: raw, info } = await sharp(masterSignPath).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;

  for (const skin of DINO_SKINS) {
    if (skin.id === 'green') continue;

    const out = Buffer.from(raw);

    for (let y = 0; y < 175; y++) {
      for (let x = 180; x < 380; x++) {
        const idx = (y * w + x) * 4;
        const a = out[idx + 3];
        if (a < 20) continue;

        const r = out[idx];
        const g = out[idx + 1];
        const b = out[idx + 2];
        const [hue, sat, lit] = rgbToHsl(r, g, b);

        // 1. Eye sclera: very low saturation and high brightness
        if (sat < 0.18 && lit > 0.60) continue;

        // 2. Black pupil & dark nostrils: very dark
        if (lit < 0.12 || (r < 35 && g < 35 && b < 35)) continue;

        // 3. Cream belly & chin: warm yellowish cream (r >= g, r - b > 25)
        if (r > 165 && g > 145 && b < 195 && (r >= g) && (r - b > 25)) continue;

        // 4. Claws / toenails / paws: ivory
        if (r > 185 && g > 180 && b > 135 && (r - b > 20) && sat < 0.35 && lit > 0.70) continue;

        // 5. Wood sign & Wi-Fi tablet: warm orange/brown (hue < 58, r > g)
        if (hue < 58 && (r > g) && (g > b)) continue;

        // 6. Tropical leaves on the far left (x < 210) or far right (x > 365)
        if ((x < 212 && y > 100) || (x > 365 && y < 80)) continue;

        // Dinosaur green skin:
        const isGreenSkin = (hue >= 65 && hue <= 165 && sat > 0.18 && lit > 0.10);
        // Dark spikes on head / crest
        const isDarkSpikes = (hue >= 85 && hue <= 180 && lit <= 0.35 && sat > 0.10);

        if (isGreenSkin || isDarkSpikes) {
          let newH = skin.targetH;
          let newS = Math.min(1.0, Math.max(0.0, sat * skin.sMul));
          let newL = Math.min(1.0, Math.max(0.0, lit * skin.lMul));

          if (skin.id === 'black') {
            newH = 220;
            newS = Math.min(0.08, sat * 0.12);
            newL = 0.15 + Math.pow(lit, 1.08) * 0.48;
          } else if (skin.id === 'yellow') {
            newL = Math.min(0.92, lit * 1.10);
            newS = Math.min(0.98, sat * 1.15);
          } else if (skin.id === 'brown') {
            newS = sat * 0.70;
            newL = lit * 0.85;
          }

          if (isDarkSpikes) {
            newL = Math.max(0.06, newL * 0.68);
            newS = Math.min(1.0, newS * 1.05);
          }

          const [newR, newG, newB] = hslToRgb(newH, newS, newL);
          out[idx] = newR;
          out[idx + 1] = newG;
          out[idx + 2] = newB;
        }
      }
    }

    const outFile = `assets/sprites/home_title_sign_${skin.id}.png`;
    await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toFile(outFile);
    console.log(`Saved ${outFile}`);
  }

  // Also deploy start button
  fs.copyFileSync('scratch_perfect_start_btn_v4.png', 'assets/sprites/btn_start_game_orange.png');
  console.log('Deployed assets/sprites/btn_start_game_orange.png');

  console.log('All master signs, skins, and start button successfully deployed!');
}
deployMasterSignsAndSkins().catch(err => {
  console.error(err);
  process.exit(1);
});
