/**
 * Build Perfect Home Dinosaur Skin Overlays
 * 
 * Generates 100% pixel-accurate, unclipped, artefact-free skin overlays
 * for all 9 canonical skins:
 * - Green (transparent placeholder or canonical green)
 * - Blue (Sapphire Blue)
 * - Red (Crimson Red)
 * - Yellow (Golden Yellow)
 * - Orange (Sunset Orange)
 * - Purple (Amethyst Purple)
 * - Pink (Rose Pink)
 * - Brown (Chocolate Brown)
 * - Black (Charcoal Black)
 *
 * Fully fixes:
 * 1. Yellow patch on viewer's left eye (eyelid highlight recolored cleanly).
 * 2. Uncut tail: full tail silhouette, underside cream curve, and rounded tip intact.
 * 3. Left arm / paw: clean boundary with no wifi sign or glow artifacts, arm fully intact.
 * 4. Paws & claws: protected ivory white claws on both paws.
 * 5. Belly & jaw: continuous cream belly and lower jaw smile.
 * 6. Black skin: smooth, obsidian charcoal shading without jagged edges or green fringes.
 */

const sharp = require('sharp');
const fs = require('fs');
const { DINO_SKINS, rgbToHsl, hslToRgb } = require('./js/skins.js');

const PANO_PATH = 'assets/sprites/homepage_seamless_panorama.jpg';
const CROP_X = 826;
const CROP_Y = 97;
const CROP_W = 371;
const CROP_H = 308;

async function buildAllHomeDinoSkins() {
  console.log(`Extracting dinosaur from panorama: (${CROP_X}, ${CROP_Y}, ${CROP_W}x${CROP_H})...`);
  const panoRaw = await sharp(PANO_PATH).raw().toBuffer({ resolveWithObject: true });
  const pw = panoRaw.info.width, pdata = panoRaw.data;

  // 1. Sky detection & flood-fill to get clean outer sky boundary
  const isSky = new Uint8Array(CROP_W * CROP_H);
  for (let y = 0; y < CROP_H; y++) {
    const py = CROP_Y + y;
    for (let x = 0; x < CROP_W; x++) {
      const px = CROP_X + x;
      const idx = (py * pw + px) * 3;
      const r = pdata[idx], g = pdata[idx + 1], b = pdata[idx + 2];
      const [h, s, l] = rgbToHsl(r, g, b);

      if ((b > 130 && b > r + 25 && h >= 180 && h <= 240) ||
          (b > 150 && b > g + 10 && b > r + 30)) {
        isSky[y * CROP_W + x] = 1;
      }
    }
  }

  const skyMask = new Uint8Array(CROP_W * CROP_H);
  const queue = new Int32Array(CROP_W * CROP_H);
  let qHead = 0, qTail = 0;

  // Seed top edge
  for (let x = 0; x < CROP_W; x++) {
    if (isSky[x] === 1) {
      skyMask[x] = 1;
      queue[qTail++] = x;
    }
  }
  // Seed right edge all the way down to the wood sign (y < 290)
  for (let y = 0; y < 290; y++) {
    const rIdx = y * CROP_W + (CROP_W - 1);
    if (isSky[rIdx] === 1 && !skyMask[rIdx]) {
      skyMask[rIdx] = 1;
      queue[qTail++] = rIdx;
    }
  }
  // Seed left edge (y < 210)
  for (let y = 0; y < 210; y++) {
    const lIdx = y * CROP_W;
    if (isSky[lIdx] === 1 && !skyMask[lIdx]) {
      skyMask[lIdx] = 1;
      queue[qTail++] = lIdx;
    }
  }

  while (qHead < qTail) {
    const curr = queue[qHead++];
    const neighbors = [curr - 1, curr + 1, curr - CROP_W, curr + CROP_W];
    for (const nb of neighbors) {
      if (nb >= 0 && nb < CROP_W * CROP_H && !skyMask[nb]) {
        if (isSky[nb] === 1) {
          skyMask[nb] = 1;
          queue[qTail++] = nb;
        }
      }
    }
  }

  // 2. Base RGBA dinosaur buffer with perfect silhouette isolation
  const baseDino = Buffer.alloc(CROP_W * CROP_H * 4);
  for (let y = 0; y < CROP_H; y++) {
    const py = CROP_Y + y;
    for (let x = 0; x < CROP_W; x++) {
      const px = CROP_X + x;
      const pIdx = (py * pw + px) * 3;
      const oIdx = (y * CROP_W + x) * 4;

      const r = pdata[pIdx], g = pdata[pIdx + 1], b = pdata[pIdx + 2];
      const [h, s, l] = rgbToHsl(r, g, b);

      baseDino[oIdx] = r;
      baseDino[oIdx + 1] = g;
      baseDino[oIdx + 2] = b;

      // Outer sky:
      if (skyMask[y * CROP_W + x] === 1) { baseDino[oIdx + 3] = 0; continue; }

      // Left boundary (exclude rock, leaves, yellow glow):
      if (x < 46) { baseDino[oIdx + 3] = 0; continue; }
      if (x < 60 && y >= 220 && y <= 275 && l > 0.50 && r > 160 && g > 160) {
        baseDino[oIdx + 3] = 0;
        continue;
      }

      // Right boundary (tail tip ends at x=311):
      if (x > 311) { baseDino[oIdx + 3] = 0; continue; }

      // Bottom wood sign boundary:
      // Left paw: ends at y=306
      if (x <= 115 && y > 306) { baseDino[oIdx + 3] = 0; continue; }
      // Belly: ends at y=291
      if (x > 115 && x <= 185 && y > 291) { baseDino[oIdx + 3] = 0; continue; }
      // Right paw & junction: ends at y=306
      if (x > 185 && x <= 245 && y > 306) { baseDino[oIdx + 3] = 0; continue; }
      // Tail underside contour:
      if (x > 245) {
        if (x <= 260 && y > 291) { baseDino[oIdx + 3] = 0; continue; }
        if (x > 260 && x <= 275 && y > 288) { baseDino[oIdx + 3] = 0; continue; }
        if (x > 275 && x <= 290 && y > 286) { baseDino[oIdx + 3] = 0; continue; }
        if (x > 290 && y > 284) { baseDino[oIdx + 3] = 0; continue; }
      }

      // Wood sign brown texture check
      if (y > 286 && r > 130 && r > g + 25 && g > b + 15 && b < 100) {
        if (!(l > 0.70 && b > 130)) { // not white claws
          baseDino[oIdx + 3] = 0;
          continue;
        }
      }

      baseDino[oIdx + 3] = 255;
    }
  }

  // 3. Recoloring pipeline
  function recolorHomeDino(buf, skin) {
    if (skin.id === 'green') return Buffer.from(buf);
    const out = Buffer.from(buf);

    for (let i = 0; i < out.length; i += 4) {
      if (out[i + 3] < 20) continue;

      const x = (i / 4) % CROP_W;
      const y = Math.floor((i / 4) / CROP_W);

      const r = out[i], g = out[i + 1], b = out[i + 2];
      const [hue, sat, lit] = rgbToHsl(r, g, b);

      // ==========================================
      // ANATOMICAL FEATURE PROTECTION
      // ==========================================
      // 1. Pure White Catchlight & Specular Highlights
      const isCatchlight = (lit > 0.88 && sat < 0.28) || (lit > 0.94);

      // 2. Eye Sclera (White eye region, only on head y < 145)
      const isEyeWhite = (y < 145) && (
        (sat < 0.20 && lit > 0.40) ||
        (sat < 0.28 && lit > 0.65 && (hue < 75 || hue > 175))
      );

      // 3. Black Pupil & Deep Nostril Cavity
      const isPupilOrNostril = (lit < 0.11) || (r < 28 && g < 28 && b < 28);

      // 4. Cream Belly, Neck, Lower Jaw & Tail Underside:
      const isJawOrTorso = (x <= 235 && y >= 140);
      const isTailUnderside = (x > 235 && y >= 225);
      const isBellyOrJaw = (isJawOrTorso || isTailUnderside) && (
        (hue >= 25 && hue <= 68 && sat >= 0.12 && lit >= 0.20 && (r >= g - 25) && (r > b + 15) && (g > b + 10)) ||
        (y >= 170 && x >= 90 && x <= 220 && (g - r < 35) && (r > 150) && (g > 140) && (b < 190) && (r - b > 15))
      );

      // 5. Claws & Toenails (ivory white, only on paws at y >= 280)
      const isClaw = (y >= 280) && (
        (lit >= 0.65 && sat <= 0.45 && r >= g - 5 && r > b) ||
        (lit >= 0.55 && sat <= 0.35 && b > 120 && r >= g - 5)
      );

      // 6. Mouth / Tongue / Teeth (in mouth area y in [140..190])
      const isMouth = (y >= 140 && y <= 190) && (r > 150 && g < 125 && b < 135 && (r - g > 30));
      const isTeeth = (y >= 140 && y <= 190) && (sat < 0.18 && lit > 0.70);

      // If protected, do not recolor!
      if (isCatchlight || isEyeWhite || isPupilOrNostril || isBellyOrJaw || isClaw || isMouth || isTeeth) {
        continue;
      }

      // ==========================================
      // RECOLOR EVERY SKIN PIXEL
      // ==========================================
      const isDarkSpike = (hue >= 65 && hue <= 185 && lit <= 0.40 && sat >= 0.08 && g >= r);

      let newH = skin.targetH;
      let newS = Math.min(1.0, Math.max(0.0, sat * skin.sMul));
      let newL = Math.min(1.0, Math.max(0.0, lit * skin.lMul));

      if (skin.id === 'black') {
        newH = 220; // Soft charcoal grey-black tone
        newS = Math.min(0.08, sat * 0.12);
        // Continuous smooth lightness curve with NO jumps - brightened to soft charcoal
        newL = 0.15 + Math.pow(lit, 1.08) * 0.48;
        if (isDarkSpike) {
          newL = Math.max(0.09, newL * 0.75);
        }
      } else if (skin.id === 'yellow') {
        newH = 48;
        newL = Math.min(0.92, lit * 1.12);
        newS = Math.min(0.98, sat * 1.15);
      } else if (skin.id === 'brown') {
        newH = 28;
        newS = sat * 0.68;
        newL = lit * 0.82;
      }

      const [nR, nG, nB] = hslToRgb(newH, newS, newL);
      out[i] = nR;
      out[i + 1] = nG;
      out[i + 2] = nB;
    }

    return out;
  }

  // 4. Save all 9 production overlays
  for (const skin of DINO_SKINS) {
    const recolored = recolorHomeDino(baseDino, skin);
    const prodPath = `assets/sprites/home_dino_skin_${skin.id}.png`;
    const pngBuf = await sharp(recolored, { raw: { width: CROP_W, height: CROP_H, channels: 4 } })
      .png()
      .toBuffer();
    fs.writeFileSync(prodPath, pngBuf);
    console.log(`Successfully generated ${prodPath} (${pngBuf.length} bytes)`);
  }

  console.log('All 9 home dino skins generated successfully!');
}

buildAllHomeDinoSkins().catch(console.error);
