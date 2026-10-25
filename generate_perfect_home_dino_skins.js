const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { DINO_SKINS, rgbToHsl, hslToRgb } = require('./js/skins.js');

const PANO_PATH = 'assets/sprites/homepage_seamless_panorama.jpg';

// Dinosaur bounding box in 1920x1080 panorama
// Left: 826, Top: 97, Width: 371, Height: 308
const CROP_X = 826;
const CROP_Y = 97;
const CROP_W = 371;
const CROP_H = 308;

async function buildHomeDinoSkins() {
  console.log('Extracting dinosaur from panorama at:', { CROP_X, CROP_Y, CROP_W, CROP_H });
  const panoRaw = await sharp(PANO_PATH).raw().toBuffer({ resolveWithObject: true });
  const pw = panoRaw.info.width, ph = panoRaw.info.height;
  const pdata = panoRaw.data;

  // Extract the cropped RGBA buffer
  const dinoRgba = Buffer.alloc(CROP_W * CROP_H * 4);

  for (let y = 0; y < CROP_H; y++) {
    const py = CROP_Y + y;
    for (let x = 0; x < CROP_W; x++) {
      const px = CROP_X + x;
      const pIdx = (py * pw + px) * 3;
      const dIdx = (y * CROP_W + x) * 4;

      const r = pdata[pIdx];
      const g = pdata[pIdx + 1];
      const b = pdata[pIdx + 2];

      dinoRgba[dIdx] = r;
      dinoRgba[dIdx + 1] = g;
      dinoRgba[dIdx + 2] = b;

      // Determine alpha:
      // Background sky is blue (b > 140, b > r + 30, b >= g - 10, y < 310)
      // Stone sign on left: x < 75, y in [90..300], r > g and r > b + 30
      // Wooden "OFFLINE DINO" sign at bottom: y > 275 (except paws/claws at x in [95..265], y < 312)
      const [hue, sat, lit] = rgbToHsl(r, g, b);

      // Blue sky background:
      const isBlueSky = (b > 135 && b > r + 30 && hue >= 180 && hue <= 235);

      // Green dinosaur body / paw or white claws:
      const isDinoPawOrClaw = (g > r * 1.05 && g > b) || (lit > 0.65 && sat < 0.35) || (hue >= 60 && hue <= 175 && sat > 0.12);
      
      // Wooden "OFFLINE DINO" sign at the bottom:
      const isWoodSign = (y > 270 && !isDinoPawOrClaw && (r >= g || hue < 55 || hue > 320)) || (y > 315);

      if (isBlueSky || isWoodSign) {
        dinoRgba[dIdx + 3] = 0; // Transparent
      } else {
        dinoRgba[dIdx + 3] = 255;
      }
    }
  }

  // Soften alpha edge around blue sky to remove hard jagged edge
  // Flood fill / morphological clean from top corners to ensure transparent sky
  const visited = new Uint8Array(CROP_W * CROP_H);
  const queue = new Int32Array(CROP_W * CROP_H);
  let qHead = 0, qTail = 0;

  // Seed top row and top corners
  for (let x = 0; x < CROP_W; x++) {
    if (dinoRgba[x * 4 + 3] === 0) {
      visited[x] = 1;
      queue[qTail++] = x;
    }
  }
  for (let y = 0; y < 200; y++) {
    const lIdx = y * CROP_W;
    const rIdx = y * CROP_W + (CROP_W - 1);
    if (dinoRgba[lIdx * 4 + 3] === 0 && !visited[lIdx]) { visited[lIdx] = 1; queue[qTail++] = lIdx; }
    if (dinoRgba[rIdx * 4 + 3] === 0 && !visited[rIdx]) { visited[rIdx] = 1; queue[qTail++] = rIdx; }
  }

  while (qHead < qTail) {
    const curr = queue[qHead++];
    const cx = curr % CROP_W;
    const cy = Math.floor(curr / CROP_W);

    const neighbors = [curr - 1, curr + 1, curr - CROP_W, curr + CROP_W];
    for (const nb of neighbors) {
      if (nb >= 0 && nb < CROP_W * CROP_H && !visited[nb]) {
        const nx = nb % CROP_W;
        const ny = Math.floor(nb / CROP_W);
        const idx4 = nb * 4;
        const r = dinoRgba[idx4], g = dinoRgba[idx4 + 1], b = dinoRgba[idx4 + 2];
        const [hue, sat, lit] = rgbToHsl(r, g, b);
        const isSky = (b > 130 && b > r + 30 && hue >= 180 && hue <= 235);
        if (dinoRgba[idx4 + 3] === 0 || isSky) {
          visited[nb] = 1;
          dinoRgba[idx4 + 3] = 0;
          queue[qTail++] = nb;
        }
      }
    }
  }

  // Save green base
  await sharp(dinoRgba, { raw: { width: CROP_W, height: CROP_H, channels: 4 } })
    .png().toFile('diagnostic_black_skin/test_pano_dino_green.png');
  console.log('Saved test_pano_dino_green.png');

  // Now recolor to all 9 skins
  function recolorDino(buf, skin) {
    if (skin.id === 'green') return Buffer.from(buf);
    const out = Buffer.from(buf);

    for (let i = 0; i < out.length; i += 4) {
      const a = out[i + 3];
      if (a < 20) continue;

      const x = (i / 4) % CROP_W;
      const y = Math.floor((i / 4) / CROP_W);

      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const [hue, sat, lit] = rgbToHsl(r, g, b);

      // 1. Specular Highlights / Catchlights
      const isCatchlight = (lit > 0.88 && sat < 0.25) || (lit > 0.94);

      // 2. Eye Sclera (White eye region, including shaded and anti-aliased edges)
      const isEyeWhite = (sat < 0.16 && lit > 0.40) ||
                         (sat < 0.22 && lit > 0.65 && (hue < 75 || hue > 175));

      // 3. Black Pupil & Deep Shadows & Dark Nostrils
      const isPupilOrNostril = (lit < 0.12) || (r < 32 && g < 32 && b < 32);

      // 4. Cream Belly, Chest, Chin & Tail Underside (strictly on lower body y >= 140)
      // Warm golden/yellow cream (r >= g - 2, r > b + 25, g > b + 15)
      // Including bright yellow belly highlights (r > 210, g > 210, b < 200)
      const isBelly = (y >= 140) && (
        (r > 165 && g > 140 && b < 195 && (r >= g - 2) && (r - b > 25) && (g - b > 15)) ||
        (r > 210 && g > 210 && b < 200 && (r + g > 440) && (r - b > 35 || g - b > 35)) ||
        (hue >= 32 && hue <= 64 && sat >= 0.20 && sat <= 0.98 && lit >= 0.45 && (r >= g - 2 || b > 140))
      );

      // 5. Claws & Toenails (Ivory white claws resting on the sign)
      const isClaw = (r >= g && hue >= 20 && hue <= 62 && sat <= 0.48 && lit >= 0.45 && (r - b >= 10));

      // 6. Mouth / Tongue / Teeth
      const isMouth = (r > 150 && g < 125 && b < 135 && (r - g > 35));
      const isTeeth = (sat < 0.15 && lit > 0.75);

      if (isCatchlight || isEyeWhite || isPupilOrNostril || isBelly || isClaw || isMouth || isTeeth) {
        continue;
      }

      // 7. Very Dark Outlines
      if (lit < 0.13) {
        if (skin.id === 'black') {
          const [outR, outG, outB] = hslToRgb(220, 0.05, Math.min(0.08, lit));
          out[i] = outR;
          out[i + 1] = outG;
          out[i + 2] = outB;
        } else {
          const [outR, outG, outB] = hslToRgb(skin.targetH, Math.min(0.4, sat * skin.sMul), lit * 0.9);
          out[i] = outR;
          out[i + 1] = outG;
          out[i + 2] = outB;
        }
        continue;
      }

      // 8. Green dinosaur skin
      const isGreenSkin = (hue >= 60 && hue <= 175 && sat >= 0.13 && lit >= 0.12);
      const isDarkSpikes = (hue >= 70 && hue <= 185 && lit <= 0.38 && sat >= 0.08 && g >= r);

      if (isGreenSkin || isDarkSpikes) {
        let newH = skin.targetH;
        let newS = Math.min(1.0, Math.max(0.0, sat * skin.sMul));
        let newL = Math.min(1.0, Math.max(0.0, lit * skin.lMul));

        if (skin.id === 'black') {
          newS = 0.02 + sat * 0.03;
          newL = 0.11 + lit * 0.44;
          newH = 220;

          if (isDarkSpikes) {
            newL = Math.max(0.07, newL * 0.72);
          }
        } else if (skin.id === 'yellow') {
          newL = Math.min(0.92, lit * 1.12);
          newS = Math.min(0.98, sat * 1.15);
        } else if (skin.id === 'brown') {
          newS = sat * 0.68;
          newL = lit * 0.82;
        }

        const [newR, newG, newB] = hslToRgb(newH, newS, newL);
        out[i] = newR;
        out[i + 1] = newG;
        out[i + 2] = newB;
      }
    }

    return out;
  }

  for (const skin of DINO_SKINS) {
    const recolored = recolorDino(dinoRgba, skin);
    const outFile = `diagnostic_black_skin/home_dino_skin_${skin.id}.png`;
    const prodFile = `assets/sprites/home_dino_skin_${skin.id}.png`;
    const pngBuf = await sharp(recolored, { raw: { width: CROP_W, height: CROP_H, channels: 4 } }).png().toBuffer();
    fs.writeFileSync(outFile, pngBuf);
    fs.writeFileSync(prodFile, pngBuf);
    console.log(`Saved ${outFile} and ${prodFile}`);
  }
}

buildHomeDinoSkins().catch(console.error);
