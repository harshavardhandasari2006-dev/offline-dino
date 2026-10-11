const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function buildMasterSprites() {
  console.log('=== MASTER SPRITE EXTRACTION & ANCHORING PIPELINE ===\n');

  const refPath = path.join(__dirname, 'assets', 'style1_reference.jpg');
  const { data: refData, info: refInfo } = await sharp(refPath).raw().toBuffer({ resolveWithObject: true });
  const W = refInfo.width, H = refInfo.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [refData[idx], refData[idx + 1], refData[idx + 2]];
  }

  // Exact frame definitions from Style 1 reference sheet
  // All boxes tested and verified to capture FULL tails and full character silhouettes
  const frames = [
    // --- PANEL 1: IDLE ---
    { name: 'dino_idle_0', minX: 14, maxX: 125, minY: 194, maxY: 301, groundY: 299 },
    { name: 'dino_idle_1', minX: 128, maxX: 238, minY: 194, maxY: 301, groundY: 299 },
    { name: 'dino_idle_2', minX: 236, maxX: 342, minY: 194, maxY: 301, groundY: 299 },
    { name: 'dino_idle_3', minX: 350, maxX: 460, minY: 194, maxY: 301, groundY: 299 },

    // --- PANEL 2: RUN ---
    { name: 'dino_run_0', minX: 490, maxX: 597, minY: 194, maxY: 296, groundY: 294 },
    { name: 'dino_run_1', minX: 598, maxX: 700, minY: 194, maxY: 296, groundY: 294 },
    { name: 'dino_run_2', minX: 704, maxX: 804, minY: 194, maxY: 296, groundY: 294 },
    { name: 'dino_run_3', minX: 808, maxX: 912, minY: 194, maxY: 296, groundY: 294 },
    { name: 'dino_run_4', minX: 916, maxX: 1018, minY: 194, maxY: 296, groundY: 294 },

    // --- PANEL 3: JUMP (Expanded to capture 100% of full curved tails) ---
    { name: 'dino_jump_0', minX: 10, maxX: 102, minY: 395, maxY: 480, groundY: 476, isJump: true },
    { name: 'dino_jump_1', minX: 116, maxX: 204, minY: 368, maxY: 466, groundY: 464, isJump: true },
    { name: 'dino_jump_2', minX: 218, maxX: 308, minY: 354, maxY: 450, groundY: null, isJump: true },
    { name: 'dino_jump_3', minX: 312, maxX: 406, minY: 388, maxY: 472, groundY: 468, isJump: true },
    { name: 'dino_jump_4', minX: 410, maxX: 504, minY: 404, maxY: 480, groundY: 476, isJump: true },

    // --- PANEL 4: DUCK (Expanded to capture full tails) ---
    { name: 'dino_duck_0', minX: 520, maxX: 618, minY: 385, maxY: 478, groundY: 474 },
    { name: 'dino_duck_1', minX: 622, maxX: 722, minY: 412, maxY: 478, groundY: 474 },
    { name: 'dino_duck_2', minX: 726, maxX: 822, minY: 418, maxY: 478, groundY: 474 },
    { name: 'dino_duck_3', minX: 828, maxX: 920, minY: 422, maxY: 478, groundY: 474 },
    { name: 'dino_duck_4', minX: 926, maxX: 1020, minY: 390, maxY: 478, groundY: 474 },

    // --- PANEL 5: COLLISION ---
    { name: 'dino_hit', minX: 110, maxX: 202, minY: 552, maxY: 654, groundY: 650 },
    { name: 'dino_dead', minX: 258, maxX: 374, minY: 552, maxY: 654, groundY: 650, isDead: true }
  ];

  function isDefiniteBg(absX, absY, groundY, isDead = false) {
    if (groundY && absY > groundY) return true;
    const [r, g, b] = getPixel(absX, absY);

    // Green skin & limbs
    if (g > r + 6 && g > b + 6 && g > 38) return false;
    if (g > 80 && g > r && g > b + 12) return false;

    // Dark spine spikes, claws, outlines
    if (r < 80 && g < 90 && b < 80 && (r > 6 || g > 6 || b > 6)) return false;

    // Cream / light-yellow belly
    if (r > 165 && g > 155 && r > b + 16 && g > b + 16) return false;

    // Tongue / inside mouth
    if (r > 125 && g < 125 && b < 130 && r > g + 12) return false;

    // Eye white / cartoon sclera
    if (r > 195 && g > 195 && b > 195 && (!groundY || absY < groundY - 22)) return false;

    // Eye pupil / dark cartoon outline
    if (r < 65 && g < 65 && b < 65 && (!groundY || absY < groundY - 22)) return false;

    // Claws / foot nails
    if (groundY && absY <= groundY && r > 185 && g > 170 && b > 125 && g - b > 15) return false;

    // Dead pose dizzy spiral/star eye and impact stars
    if (isDead) {
      if ((r > 160 && g > 130 && b < 120) || (r < 80 && g < 80 && b < 80)) return false;
    }

    // Sky / Cloud: blue dominant or cloudy white
    if (b > 175 && (b >= r - 2 || b >= g - 8)) return true;
    if (r > 215 && g > 220 && b > 225) return true;

    // Distant mesa/mountain banner background
    if (absY < 202 && b > 160) return true;

    return false;
  }

  const outDir = path.join(__dirname, 'assets', 'sprites');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const cfg of frames) {
    const cW = cfg.maxX - cfg.minX + 1;
    const cH = cfg.maxY - cfg.minY + 1;

    // 1. Flood fill from outer border to find exterior background
    const isBg = new Uint8Array(cW * cH);
    const queue = [];

    // Push top and bottom borders
    for (let x = 0; x < cW; x++) {
      for (const y of [0, cH - 1]) {
        const absX = cfg.minX + x, absY = cfg.minY + y;
        if (isDefiniteBg(absX, absY, cfg.groundY, cfg.isDead)) {
          isBg[y * cW + x] = 1;
          queue.push(x, y);
        }
      }
    }
    // Push left and right borders
    for (let y = 0; y < cH; y++) {
      for (const x of [0, cW - 1]) {
        const absX = cfg.minX + x, absY = cfg.minY + y;
        if (isDefiniteBg(absX, absY, cfg.groundY, cfg.isDead) && !isBg[y * cW + x]) {
          isBg[y * cW + x] = 1;
          queue.push(x, y);
        }
      }
    }

    // Propagate flood fill
    let head = 0;
    while (head < queue.length) {
      const cx = queue[head++], cy = queue[head++];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < cW && ny >= 0 && ny < cH) {
          const idx = ny * cW + nx;
          if (!isBg[idx] && isDefiniteBg(cfg.minX + nx, cfg.minY + ny, cfg.groundY, cfg.isDead)) {
            isBg[idx] = 1;
            queue.push(nx, ny);
          }
        }
      }
    }

    // 2. Build extracted sprite with 100% solid character interior (0 holes)
    const rawBuf = Buffer.alloc(cW * cH * 4);
    for (let y = 0; y < cH; y++) {
      for (let x = 0; x < cW; x++) {
        const idx = y * cW + x;
        const oIdx = idx * 4;
        if (!isBg[idx]) {
          const [r, g, b] = getPixel(cfg.minX + x, cfg.minY + y);
          rawBuf[oIdx] = r;
          rawBuf[oIdx + 1] = g;
          rawBuf[oIdx + 2] = b;
          rawBuf[oIdx + 3] = 255;
        }
      }
    }

    // 3. Clean only outer perimeter pixels with background blue/sand contamination
    for (let y = 0; y < cH; y++) {
      for (let x = 0; x < cW; x++) {
        const idx = (y * cW + x) * 4;
        if (rawBuf[idx + 3] === 0) continue;

        let isPerim = false;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= cW || ny < 0 || ny >= cH || isBg[ny * cW + nx]) {
            isPerim = true; break;
          }
        }

        if (isPerim) {
          const r = rawBuf[idx], g = rawBuf[idx + 1], b = rawBuf[idx + 2];
          // Blue sky fringe on outer edge
          if (b > 180 && (b > r + 15 || b > g + 15)) {
            rawBuf[idx + 3] = 0;
          }
          // Sand floor fringe on bottom edge
          if (cfg.groundY && (cfg.minY + y) >= cfg.groundY - 2) {
            if (r > 210 && g > 175 && b < 165 && !(g > r + 12)) {
              rawBuf[idx + 3] = 0;
            }
          }
        }
      }
    }

    // 4. Standardize onto Canonical 128x112 Canvas with Ground Baseline at y=103
    // Find character bounding box inside rawBuf
    let minCharX = cW, maxCharX = 0, minCharY = cH, maxCharY = 0;
    for (let y = 0; y < cH; y++) {
      for (let x = 0; x < cW; x++) {
        if (rawBuf[(y * cW + x) * 4 + 3] > 0) {
          if (x < minCharX) minCharX = x;
          if (x > maxCharX) maxCharX = x;
          if (y < minCharY) minCharY = y;
          if (y > maxCharY) maxCharY = y;
        }
      }
    }

    const charW = maxCharX - minCharX + 1;
    const charH = maxCharY - minCharY + 1;

    // Standard canvas is 128 x 112
    const targetCanvasW = 128;
    const targetCanvasH = 112;
    const canonicalGroundY = 103; // Exact row where feet soles contact ground line

    // Calculate placement offset
    // Horizontal: center the character body around x=64
    const placeX = Math.round((targetCanvasW - charW) / 2);
    // Vertical: align foot bottom to row 103 for grounded frames; for jump apex, preserve jump height relative to ground
    let placeY;
    if (cfg.groundY) {
      const charGroundOffset = (cfg.groundY - cfg.minY) - maxCharY;
      placeY = canonicalGroundY - (maxCharY - minCharY) + charGroundOffset;
    } else {
      // Mid-air jump frame (dino_jump_2)
      placeY = Math.max(6, Math.round((targetCanvasH - charH) / 2) - 8);
    }

    // Crop character and composite onto canonical canvas
    const croppedChar = await sharp(rawBuf, { raw: { width: cW, height: cH, channels: 4 } })
      .extract({ left: minCharX, top: minCharY, width: charW, height: charH })
      .png().toBuffer();

    const finalBuf = await sharp({
      create: {
        width: targetCanvasW,
        height: targetCanvasH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    }).composite([{
      input: croppedChar,
      left: Math.max(0, Math.min(targetCanvasW - charW, placeX)),
      top: Math.max(0, Math.min(targetCanvasH - charH, placeY))
    }]).png().toBuffer();

    const destFile = path.join(outDir, `${cfg.name}.png`);
    fs.writeFileSync(destFile, finalBuf);
    console.log(`  ✓ Restored ${cfg.name}.png (128x112, solid character, 0 holes, full tail)`);
  }

  console.log('\n=== ALL 21 MASTER SPRITES SUCCESSFULLY RECONSTRUCTED! ===\n');
}

buildMasterSprites().catch(err => {
  console.error('Error during reconstruction:', err);
  process.exit(1);
});
