const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const uploadDir = 'C:/Users/asus/.gemini/antigravity-ide/brain/baf186b1-2f4d-4f3d-9084-83c9edace571/.user_uploaded';
const files = [
  'media_1792068594503.png', // Sheet 1: Frames 01-10
  'media_1792068603374.png', // Sheet 2: Frames 11-20 (Pristine, 0 badges)
  'media_1792068612196.png', // Sheet 3: Frames 21-30
  'media_1792068628542.png', // Sheet 4: Frames 31-40
  'media_1792068639726.png'  // Sheet 5: Frames 41-50
];

const targetDir = 'test_50_frames_validation';
const rawDir = path.join(targetDir, 'raw_extracted');
const stdDir = path.join(targetDir, 'standardized');
const cleanDir = path.join(targetDir, 'cleanest_10_cycle');

[targetDir, rawDir, stdDir, cleanDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const CANVAS_W = 240;
const CANVAS_H = 210;
const TARGET_GROUND_Y = 195; // Aligns feet to consistent ground baseline

// Ground planes detected in the original sprite sheets
const ROW_GROUND_Y = [
  { row1: 201, row2: 383 }, // Sheet 1 (Frames 01-10)
  { row1: 196, row2: 389 }, // Sheet 2 (Frames 11-20)
  { row1: 196, row2: 394 }, // Sheet 3 (Frames 21-30)
  { row1: 200, row2: 396 }, // Sheet 4 (Frames 31-40)
  { row1: 203, row2: 394 }  // Sheet 5 (Frames 41-50)
];

async function processAll() {
  console.log('=== EXTRACTING & STANDARDIZING 50 FRAMES ===\n');

  const manifest = {
    generatedAt: new Date().toISOString(),
    totalFrames: 50,
    canvasDimensions: { width: CANVAS_W, height: CANVAS_H },
    groundBaselineY: TARGET_GROUND_Y,
    cleanestCycle: {
      sourceSheet: 2,
      sourceFrames: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      exportedFolder: 'cleanest_10_cycle',
      exportedFiles: ['run_01.png', 'run_02.png', 'run_03.png', 'run_04.png', 'run_05.png', 'run_06.png', 'run_07.png', 'run_08.png', 'run_09.png', 'run_10.png'],
      badgeStatus: '100% PRISTINE (Sheet 2 contained zero badges, zero removal needed)'
    },
    frames: []
  };

  for (let s = 0; s < files.length; s++) {
    const fullPath = path.join(uploadDir, files[s]);
    console.log(`Processing Sheet ${s + 1} (${files[s]})...`);

    const img = sharp(fullPath);
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;

    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 5; c++) {
        const frameNum = s * 10 + r * 5 + c + 1;
        const numStr = String(frameNum).padStart(2, '0');

        const colLeft = Math.round(c * (W / 5));
        const colRight = Math.round((c + 1) * (W / 5)) - 1;
        const rowTop = r === 0 ? 0 : 205;
        const rowBottom = r === 0 ? 204 : 408;

        const cellW = colRight - colLeft + 1;
        const cellH = rowBottom - rowTop + 1;

        // 1. EXTRACT RAW CROPPED FRAME (No modifications, exactly as drawn)
        const rawFileName = `frame_${numStr}.png`;
        const rawFilePath = path.join(rawDir, rawFileName);
        await sharp(fullPath)
          .extract({ left: colLeft, top: rowTop, width: cellW, height: cellH })
          .toFile(rawFilePath);

        // 2. DETECT BADGE & OVERLAP
        let badgeInfo = {
          hasBadge: false,
          centerX: -1,
          centerY: -1,
          radius: 0,
          overlapsDino: false,
          status: 'No badge on sheet'
        };

        if (s === 0 || s === 4) {
          let bPixels = [];
          for (let y = rowTop; y <= rowTop + 75; y++) {
            for (let x = colLeft; x <= colLeft + 85; x++) {
              const idx = (y * W + x) * 4;
              const a = data[idx+3], red = data[idx], grn = data[idx+1], blu = data[idx+2];
              if (a > 50) {
                const isDark = (red < 60 && grn < 60 && blu < 60);
                const isWhite = (red > 200 && grn > 200 && blu > 200);
                if (isDark || isWhite) bPixels.push({ x, y });
              }
            }
          }

          if (bPixels.length > 50) {
            badgeInfo.hasBadge = true;
            const minBX = Math.min(...bPixels.map(p=>p.x)), maxBX = Math.max(...bPixels.map(p=>p.x));
            const minBY = Math.min(...bPixels.map(p=>p.y)), maxBY = Math.max(...bPixels.map(p=>p.y));
            badgeInfo.centerX = (minBX + maxBX) / 2;
            badgeInfo.centerY = (minBY + maxBY) / 2;
            badgeInfo.radius = Math.max((maxBX - minBX)/2, (maxBY - minBY)/2);

            let overlapCount = 0;
            for (let y = minBY - 2; y <= maxBY + 2; y++) {
              for (let x = minBX - 2; x <= maxBX + 2; x++) {
                if (x >= colLeft && x <= colRight && y >= rowTop && y <= rowBottom) {
                  const idx = (y * W + x) * 4;
                  const a = data[idx+3], red = data[idx], grn = data[idx+1], blu = data[idx+2];
                  if (a > 50) {
                    const isGreenDino = (grn > 80 && grn > red * 1.15 && grn > blu * 1.2);
                    const isYellowCrest = (red > 160 && grn > 120 && blu < 100);
                    if (isGreenDino || isYellowCrest) overlapCount++;
                  }
                }
              }
            }

            if (overlapCount > 0) {
              badgeInfo.overlapsDino = true;
              badgeInfo.status = `OVERLAPPING (${overlapCount} dino pixels) — Badge retained to preserve artwork`;
            } else {
              badgeInfo.overlapsDino = false;
              badgeInfo.status = 'Cleanly removed (zero artwork affected)';
            }
          }
        }

        // 3. FIND DINOSAUR BOUNDS & FEET PIXELS
        let dinoMinX = colRight, dinoMaxX = colLeft, dinoMinY = rowBottom, dinoMaxY = rowTop;
        let feetPixels = [];

        for (let y = rowTop; y <= rowBottom; y++) {
          for (let x = colLeft; x <= colRight; x++) {
            const idx = (y * W + x) * 4;
            const a = data[idx+3], red = data[idx], grn = data[idx+1], blu = data[idx+2];
            if (a > 35) {
              // If safe badge pixel, ignore when computing dino bounds
              if (badgeInfo.hasBadge && !badgeInfo.overlapsDino) {
                const distToBadge = Math.hypot(x - badgeInfo.centerX, y - badgeInfo.centerY);
                if (distToBadge <= badgeInfo.radius + 1.5) continue;
              }

              if (x < dinoMinX) dinoMinX = x;
              if (x > dinoMaxX) dinoMaxX = x;
              if (y < dinoMinY) dinoMinY = y;
              if (y > dinoMaxY) dinoMaxY = y;
            }
          }
        }

        // Measure lowest feet pixels
        for (let y = dinoMaxY - 3; y <= dinoMaxY; y++) {
          for (let x = dinoMinX; x <= dinoMaxX; x++) {
            const idx = (y * W + x) * 4;
            if (data[idx+3] > 60) feetPixels.push(x);
          }
        }

        const dinoW = dinoMaxX - dinoMinX + 1;
        const dinoH = dinoMaxY - dinoMinY + 1;
        const footSpan = feetPixels.length ? [Math.min(...feetPixels) - dinoMinX, Math.max(...feetPixels) - dinoMinX] : [0, 0];

        // 4. GROUND BASELINE & AIRBORNE CALCULATION
        const groundRefY = r === 0 ? ROW_GROUND_Y[s].row1 : ROW_GROUND_Y[s].row2;
        const elevationAboveGround = Math.max(0, groundRefY - dinoMaxY);
        const isAirborne = elevationAboveGround >= 3;

        // Standardized placement:
        // Center horizontally in 240px canvas
        // Align ground baseline to TARGET_GROUND_Y (195px)
        const placeX = Math.round((CANVAS_W - dinoW) / 2);
        const placeY = TARGET_GROUND_Y - dinoH - elevationAboveGround;
        const placedFootY = placeY + dinoH;

        // 5. BUILD STANDARDIZED FRAME BUFFER (240x210 RGBA)
        const stdBuffer = Buffer.alloc(CANVAS_W * CANVAS_H * 4, 0);

        for (let dy = 0; dy < dinoH; dy++) {
          for (let dx = 0; dx < dinoW; dx++) {
            const srcX = dinoMinX + dx;
            const srcY = dinoMinY + dy;
            const srcIdx = (srcY * W + srcX) * 4;

            const a = data[srcIdx+3];
            if (a === 0) continue;

            // Safe badge removal: omit badge pixel if it doesn't overlap dino
            if (badgeInfo.hasBadge && !badgeInfo.overlapsDino) {
              const distToBadge = Math.hypot(srcX - badgeInfo.centerX, srcY - badgeInfo.centerY);
              if (distToBadge <= badgeInfo.radius + 1.2) continue;
            }

            const dstX = placeX + dx;
            const dstY = placeY + dy;

            if (dstX >= 0 && dstX < CANVAS_W && dstY >= 0 && dstY < CANVAS_H) {
              const dstIdx = (dstY * CANVAS_W + dstX) * 4;
              stdBuffer[dstIdx] = data[srcIdx];
              stdBuffer[dstIdx+1] = data[srcIdx+1];
              stdBuffer[dstIdx+2] = data[srcIdx+2];
              stdBuffer[dstIdx+3] = data[srcIdx+3];
            }
          }
        }

        const stdFileName = `frame_${numStr}.png`;
        const stdFilePath = path.join(stdDir, stdFileName);
        await sharp(stdBuffer, { raw: { width: CANVAS_W, height: CANVAS_H, channels: 4 } })
          .png()
          .toFile(stdFilePath);

        // 6. IF PART OF CLEANEST 10-CYCLE (Sheet 2, Frames 11-20), EXPORT AS MASTER
        if (s === 1) {
          const cleanIdx = frameNum - 10;
          const cleanName = `run_${String(cleanIdx).padStart(2, '0')}.png`;
          const cleanPath = path.join(cleanDir, cleanName);
          await sharp(stdBuffer, { raw: { width: CANVAS_W, height: CANVAS_H, channels: 4 } })
            .png()
            .toFile(cleanPath);
        }

        manifest.frames.push({
          frameNumber: frameNum,
          sheetNumber: s + 1,
          row: r + 1,
          col: c + 1,
          rawFileName,
          stdFileName,
          rawDimensions: { width: cellW, height: cellH },
          dinosaurBounds: { width: dinoW, height: dinoH },
          placedAt: { x: placeX, y: placeY },
          placedFootY,
          elevationAboveGround,
          isAirborne,
          footSpan,
          badgeInfo: {
            hasBadge: badgeInfo.hasBadge,
            overlapsDino: badgeInfo.overlapsDino,
            status: badgeInfo.status
          },
          cleanestCycleEquivalent: s === 1 ? `run_${String(frameNum - 10).padStart(2, '0')}.png` : null
        });
      }
    }
  }

  // Save manifest.json
  const manifestPath = path.join(targetDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written to ${manifestPath}`);
  console.log(`Total 50 frames extracted to ${rawDir}`);
  console.log(`Total 50 standardized frames created in ${stdDir}`);
  console.log(`Cleanest 10-cycle exported to ${cleanDir}`);
}

processAll().catch(err => {
  console.error('Extraction error:', err);
  process.exit(1);
});
