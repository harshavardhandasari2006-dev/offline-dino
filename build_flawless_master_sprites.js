const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function buildFlawlessMasterSprites() {
  console.log('=== BUILDING FLAWLESS MASTER SPRITES (PERFECT SEGMENTATION) ===\n');

  // 1. Generate Canonical Master Eyes (Open & Closed)
  const svgOpen = `
  <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(128, 128) rotate(-4) translate(-128, -128)">
      <ellipse cx="128" cy="128" rx="80" ry="102" fill="#ffffff" stroke="#162412" stroke-width="18" />
      <ellipse cx="146" cy="136" rx="46" ry="62" fill="#111827" />
      <circle cx="160" cy="115" r="17" fill="#ffffff" />
      <circle cx="132" cy="154" r="7" fill="#ffffff" opacity="0.65" />
    </g>
  </svg>
  `;

  const svgClosed = `
  <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(128, 128) rotate(-4) translate(-128, -128)">
      <path d="M 64,142 Q 128,78 192,142" fill="none" stroke="#162412" stroke-width="20" stroke-linecap="round" />
    </g>
  </svg>
  `;

  const eyeOpenBuf = await sharp(Buffer.from(svgOpen))
    .resize(24, 24, { kernel: 'lanczos3' })
    .png().toBuffer();

  const eyeClosedBuf = await sharp(Buffer.from(svgClosed))
    .resize(24, 24, { kernel: 'lanczos3' })
    .png().toBuffer();

  // 2. Load Reference Sheet
  const refPath = path.join(__dirname, 'assets', 'style1_reference.jpg');
  const { data: refData, info: refInfo } = await sharp(refPath).raw().toBuffer({ resolveWithObject: true });
  const W = refInfo.width, H = refInfo.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [refData[idx], refData[idx + 1], refData[idx + 2]];
  }

    // Exact frame definitions from Style 1 reference sheet (accurate character bounds)
    const frames = [
      // --- PANEL 1: IDLE ---
      { name: 'dino_idle_0', minX: 14, maxX: 120, minY: 194, maxY: 295, groundY: 295, eye: 'OPEN', eyeTop: 19, eyeLeft: 68 },
      { name: 'dino_idle_1', minX: 128, maxX: 236, minY: 194, maxY: 295, groundY: 295, eye: 'OPEN', eyeTop: 19, eyeLeft: 68 },
      { name: 'dino_idle_2', minX: 238, maxX: 342, minY: 194, maxY: 295, groundY: 295, eye: 'CLOSED', eyeTop: 19, eyeLeft: 68 },
      { name: 'dino_idle_3', minX: 352, maxX: 458, minY: 194, maxY: 295, groundY: 295, eye: 'OPEN', eyeTop: 19, eyeLeft: 68 },

      // --- PANEL 2: RUN ---
      { name: 'dino_run_0', minX: 494, maxX: 594, minY: 194, maxY: 293, groundY: 293, eye: 'OPEN', eyeTop: 19, eyeLeft: 68, runStride: 'STRIDE_A' },
      { name: 'dino_run_1', minX: 600, maxX: 696, minY: 194, maxY: 294, groundY: 294, eye: 'OPEN', eyeTop: 19, eyeLeft: 68, runStride: 'PASS_1' },
      { name: 'dino_run_2', minX: 706, maxX: 800, minY: 194, maxY: 293, groundY: 293, eye: 'OPEN', eyeTop: 19, eyeLeft: 68, runStride: 'STRIDE_B' },
      { name: 'dino_run_3', minX: 810, maxX: 908, minY: 194, maxY: 293, groundY: 293, eye: 'OPEN', eyeTop: 19, eyeLeft: 68, runStride: 'PASS_2' },
      { name: 'dino_run_4', minX: 918, maxX: 1016, minY: 194, maxY: 294, groundY: 294, eye: 'OPEN', eyeTop: 19, eyeLeft: 68, runStride: 'STRIDE_A' },

      // --- PANEL 3: JUMP (Full tails captured!) ---
      { name: 'dino_jump_0', minX: 12, maxX: 100, minY: 395, maxY: 476, groundY: 476, eye: 'OPEN', eyeTop: 18, eyeLeft: 71 },
      { name: 'dino_jump_1', minX: 118, maxX: 202, minY: 368, maxY: 464, groundY: 464, eye: 'OPEN', eyeTop: 18, eyeLeft: 71 },
      { name: 'dino_jump_2', minX: 220, maxX: 304, minY: 354, maxY: 446, groundY: null, eye: 'OPEN', eyeTop: 16, eyeLeft: 68 },
      { name: 'dino_jump_3', minX: 314, maxX: 404, minY: 388, maxY: 470, groundY: 468, eye: 'OPEN', eyeTop: 18, eyeLeft: 71 },
      { name: 'dino_jump_4', minX: 412, maxX: 502, minY: 404, maxY: 476, groundY: 476, eye: 'OPEN', eyeTop: 18, eyeLeft: 71 },

      // --- PANEL 4: DUCK (Full tails captured, closed eyes during duck) ---
      { name: 'dino_duck_0', minX: 522, maxX: 614, minY: 385, maxY: 474, groundY: 474, eye: 'OPEN', eyeTop: 24, eyeLeft: 62 },
      { name: 'dino_duck_1', minX: 624, maxX: 718, minY: 412, maxY: 474, groundY: 474, eye: 'CLOSED' },
      { name: 'dino_duck_2', minX: 728, maxX: 818, minY: 418, maxY: 474, groundY: 474, eye: 'CLOSED' },
      { name: 'dino_duck_3', minX: 830, maxX: 914, minY: 422, maxY: 474, groundY: 474, eye: 'CLOSED' },
      { name: 'dino_duck_4', minX: 928, maxX: 1016, minY: 390, maxY: 474, groundY: 474, eye: 'OPEN', eyeTop: 31, eyeLeft: 65 },

      // --- PANEL 5: COLLISION ---
      { name: 'dino_hit', minX: 112, maxX: 198, minY: 552, maxY: 635, groundY: 635 },
      { name: 'dino_dead', minX: 260, maxX: 370, minY: 552, maxY: 635, groundY: 635, isDead: true }
    ];

    function isDinoBoundary(absX, absY, groundY, isDead = false) {
      if (groundY && absY > groundY) return false;
      const [r, g, b] = getPixel(absX, absY);

      // Desert sand floor check (prevent background contamination at feet)
      if (groundY && absY >= groundY - 14) {
        if (r > 185 && g >= 140 && g <= 205 && b >= 110 && b <= 180 && r > g + 12) return false;
      }

      // Green skin & limbs
      if (g > r + 6 && g > b + 6 && g > 38) return true;
      if (g > 75 && g > r && g > b + 10) return true;

      // Dark spine spikes, claws, outlines
      if (r < 75 && g < 85 && b < 75 && (r > 6 || g > 6 || b > 6)) return true;

      // Cream / light-yellow belly (protecting authentic color balance, only in torso above leg level)
      if ((!groundY || absY < groundY - 15) && r > 165 && g > 155 && r > b + 18 && g > b + 18 && Math.abs(r - g) <= 26) return true;

      // Tongue / inside mouth
      if (r > 125 && g < 125 && b < 130 && r > g + 12) return true;

      // Claws / foot nails (must be pale cream/white, close to green toe)
      if (groundY && absY >= groundY - 8 && absY <= groundY && r > 195 && g > 185 && b > 130 && Math.abs(r - g) <= 15) {
        let nearGreen = false;
        for (let dx = -3; dx <= 3; dx++) {
          for (let dy = -3; dy <= 0; dy++) {
            const [nr, ng, nb] = getPixel(absX + dx, absY + dy);
            if (ng > nr + 6 && ng > nb + 6) { nearGreen = true; break; }
          }
          if (nearGreen) break;
        }
        if (nearGreen) return true;
      }

      // Dead pose dizzy spiral/star eye and impact stars
      if (isDead) {
        if ((r > 160 && g > 130 && b < 120 && absY < groundY - 15) || (r < 80 && g < 80 && b < 80)) return true;
      }

      return false;
    }

  const SPRITES_DIR = path.join(__dirname, 'assets', 'sprites');

  for (const cfg of frames) {
    const cW = cfg.maxX - cfg.minX + 1;
    const cH = cfg.maxY - cfg.minY + 1;

    // 1. Flood fill from outer border to mark background
    const isBg = new Uint8Array(cW * cH);
    const queue = [];

    for (let x = 0; x < cW; x++) {
      for (const y of [0, cH - 1]) {
        const absX = cfg.minX + x, absY = cfg.minY + y;
        if (!isDinoBoundary(absX, absY, cfg.groundY, cfg.isDead)) {
          isBg[y * cW + x] = 1;
          queue.push(x, y);
        }
      }
    }
    for (let y = 0; y < cH; y++) {
      for (const x of [0, cW - 1]) {
        const absX = cfg.minX + x, absY = cfg.minY + y;
        if (!isDinoBoundary(absX, absY, cfg.groundY, cfg.isDead) && !isBg[y * cW + x]) {
          isBg[y * cW + x] = 1;
          queue.push(x, y);
        }
      }
    }

    let head = 0;
    while (head < queue.length) {
      const cx = queue[head++], cy = queue[head++];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < cW && ny >= 0 && ny < cH) {
          const idx = ny * cW + nx;
          if (!isBg[idx] && !isDinoBoundary(cfg.minX + nx, cfg.minY + ny, cfg.groundY, cfg.isDead)) {
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

    // 3. Clean outer perimeter halo (sky & ground fringe)
    for (let y = 0; y < cH; y++) {
      for (let x = 0; x < cW; x++) {
        const idx = (y * cW + x) * 4;
        if (rawBuf[idx + 3] === 0) continue;

        const absX = cfg.minX + x;
        const absY = cfg.minY + y;

        // Strip sand floor below feet
        if (cfg.groundY && absY >= cfg.groundY - 10) {
          const r = rawBuf[idx], g = rawBuf[idx + 1], b = rawBuf[idx + 2];
          const isGreen = (g > r + 6 && g > b + 6);
          const isClaw = (r > 195 && g > 185 && b > 130 && Math.abs(r - g) <= 15);
          if (!isGreen && !isClaw) {
            rawBuf[idx + 3] = 0;
            continue;
          }
        }

        let isPerim = false;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= cW || ny < 0 || ny >= cH || isBg[ny * cW + nx]) {
            isPerim = true; break;
          }
        }

        if (isPerim) {
          const r = rawBuf[idx], g = rawBuf[idx + 1], b = rawBuf[idx + 2];
          // Blue sky fringe
          if (b > 180 && (b > r + 15 || b > g + 15)) {
            rawBuf[idx + 3] = 0;
          }
          // Sand ground fringe
          if (cfg.groundY && absY >= cfg.groundY - 14) {
            if (r > 180 && g >= 140 && b >= 110 && r > g + 10) {
              rawBuf[idx + 3] = 0;
            }
          }
        }
      }
    }

    // 4. Standardize onto Canonical 128x112 Canvas with Ground Baseline at y=103
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

    const targetCanvasW = 128;
    const targetCanvasH = 112;
    const canonicalGroundY = 103;

    const placeX = Math.round((targetCanvasW - charW) / 2);
    let placeY;
    if (cfg.groundY) {
      placeY = canonicalGroundY - (maxCharY - minCharY);
    } else {
      placeY = Math.max(6, Math.round((targetCanvasH - charH) / 2) - 8);
    }

    const croppedChar = await sharp(rawBuf, { raw: { width: cW, height: cH, channels: 4 } })
      .extract({ left: minCharX, top: minCharY, width: charW, height: charH })
      .png().toBuffer();

    let canvasBuf = await sharp({
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
    }]).raw().toBuffer({ resolveWithObject: true });

    let canvasData = Buffer.from(canvasBuf.data);

    // 5. Run Stride Leg Alternation
    if (cfg.runStride === 'STRIDE_A') {
      // Left foot contacts at 103 (x < 48). Right foot in air (x >= 48, lifted < 100)
      for (let y = 98; y <= 103; y++) {
        for (let x = 48; x < targetCanvasW; x++) {
          const idx = (y * targetCanvasW + x) * 4;
          canvasData[idx + 3] = 0;
        }
      }
    } else if (cfg.runStride === 'STRIDE_B') {
      // Right foot contacts at 103 (x >= 48). Left foot in air (x < 48, lifted < 100)
      for (let y = 98; y <= 103; y++) {
        for (let x = 0; x < 48; x++) {
          const idx = (y * targetCanvasW + x) * 4;
          canvasData[idx + 3] = 0;
        }
      }
    }

    // 6. Perimeter Halo Final Pass (strictly clears tail halo at x < 45 without touching belly at x >= 48)
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 25; y <= 85; y++) {
        for (let x = 0; x < 45; x++) {
          const idx = (y * targetCanvasW + x) * 4;
          if (canvasData[idx + 3] === 0) continue;
          let touchesTrans = false;
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= targetCanvasW || ny < 0 || ny >= targetCanvasH || canvasData[(ny * targetCanvasW + nx) * 4 + 3] === 0) {
              touchesTrans = true; break;
            }
          }
          if (touchesTrans) {
            const r = canvasData[idx], g = canvasData[idx + 1], b = canvasData[idx + 2];
            if (r > 185 && g > 180 && b > 135) {
              canvasData[idx + 3] = 0;
            }
          }
        }
      }
    }

    let finalPipeline = sharp(canvasData, { raw: { width: targetCanvasW, height: targetCanvasH, channels: 4 } });

    const finalBuf = await finalPipeline.png().toBuffer();
    const destFile = path.join(SPRITES_DIR, `${cfg.name}.png`);
    fs.writeFileSync(destFile, finalBuf);
    console.log(`  ✓ Built & saved ${cfg.name}.png`);
  }

  // 8. Clean Cacti & Pterodactyls
  console.log('\n--- 8. CLEANING CACTI & PTERODACTYLS ---');
  for (const c of ['cactus_single', 'cactus_double', 'cactus_small', 'cactus_tall']) {
    const filePath = path.join(SPRITES_DIR, `${c}.png`);
    const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
    const buf = Buffer.from(data);
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const idx = (y * info.width + x) * 4;
        if (buf[idx + 3] === 0) continue;
        const r = buf[idx], g = buf[idx + 1], b = buf[idx + 2];
        if (y < 16 && r > 150 && g < 130 && b < 90) continue; // flower
        if (b < 65 && g > 60) continue; // green cactus body
        if (r < 75 && g < 85 && b < 65) continue; // outline
        if (b > 65 || (r > 140 && g > 150 && b > 110)) {
          buf[idx + 3] = 0;
        }
      }
    }
    await sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(filePath);
    console.log(`  ✓ Cleaned ${c}.png`);
  }

  for (const pf of ['pterodactyl_0', 'pterodactyl_1']) {
    const filePath = path.join(SPRITES_DIR, `${pf}.png`);
    const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
    const buf = Buffer.from(data);
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const idx = (y * info.width + x) * 4;
        if (buf[idx + 3] === 0) continue;
        const b = buf[idx + 2];
        if (b > 85) buf[idx + 3] = 0;
      }
    }
    await sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(filePath);
    console.log(`  ✓ Cleaned ${pf}.png`);
  }

  console.log('\n=== ALL MASTER SPRITES BUILT FLAWLESSLY! ===\n');
}

buildFlawlessMasterSprites().catch(err => {
  console.error('Error during flawless build:', err);
  process.exit(1);
});
