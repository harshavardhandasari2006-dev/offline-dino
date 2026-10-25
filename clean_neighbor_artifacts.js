const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const uploadDir = 'C:/Users/asus/.gemini/antigravity-ide/brain/baf186b1-2f4d-4f3d-9084-83c9edace571/.user_uploaded';
const files = [
  'media_1792068594503.png', // Sheet 1: Frames 01-10
  'media_1792068603374.png', // Sheet 2: Frames 11-20
  'media_1792068612196.png', // Sheet 3: Frames 21-30
  'media_1792068628542.png', // Sheet 4: Frames 31-40
  'media_1792068639726.png'  // Sheet 5: Frames 41-50
];

const targetDir = 'test_50_frames_validation';
const rawDir = path.join(targetDir, 'raw_extracted');
const stdDir = path.join(targetDir, 'standardized');
const cleanDir = path.join(targetDir, 'cleanest_10_cycle');

const CANVAS_W = 240;
const CANVAS_H = 210;
const TARGET_GROUND_Y = 195;

// Ground baseline reference points in original sheets
const ROW_GROUND_Y = [
  { row1: 201, row2: 383 }, // Sheet 1
  { row1: 196, row2: 389 }, // Sheet 2
  { row1: 196, row2: 394 }, // Sheet 3
  { row1: 200, row2: 396 }, // Sheet 4
  { row1: 203, row2: 394 }  // Sheet 5
];

async function runCleanup() {
  console.log('=== STARTING NEIGHBOR DINOSAUR ARTIFACT CLEANUP (ALL 50 FRAMES) ===\n');

  const report = {
    generatedAt: new Date().toISOString(),
    totalFrames: 50,
    framesCleanedCount: 0,
    cleanFramesList: [],
    cleanedFramesSummary: []
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

        // 1. Segment all 8-connected components inside the cell
        const visited = new Uint8Array(cellW * cellH);
        const components = [];

        for (let cy = 0; cy < cellH; cy++) {
          for (let cx = 0; cx < cellW; cx++) {
            const idx = cy * cellW + cx;
            if (visited[idx]) continue;
            const gx = colLeft + cx, gy = rowTop + cy;
            if (data[(gy * W + gx) * 4 + 3] <= 30) continue;

            const queue = [cx, cy];
            visited[idx] = 1;
            const pixels = [];
            let head = 0;
            let minX = cx, maxX = cx, minY = cy, maxY = cy;

            while (head < queue.length) {
              const px = queue[head++], py = queue[head++];
              pixels.push({ x: px, y: py });
              if (px < minX) minX = px;
              if (px > maxX) maxX = px;
              if (py < minY) minY = py;
              if (py > maxY) maxY = py;

              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  const nx = px + dx, ny = py + dy;
                  if (nx >= 0 && nx < cellW && ny >= 0 && ny < cellH) {
                    const nidx = ny * cellW + nx;
                    if (!visited[nidx] && data[((rowTop + ny) * W + (colLeft + nx)) * 4 + 3] > 30) {
                      visited[nidx] = 1;
                      queue.push(nx, ny);
                    }
                  }
                }
              }
            }

            components.push({
              pixels,
              count: pixels.length,
              minX, maxX, minY, maxY,
              touchesLeft: minX === 0,
              touchesRight: maxX === cellW - 1
            });
          }
        }

        // Sort descending: main dinosaur is ALWAYS the primary component (12,000+ px)
        components.sort((a,b) => b.count - a.count);
        const mainDino = components[0];
        const extraComponents = components.slice(1);

        // Identify neighbor fragments vs badges
        const neighborFragments = [];
        const badgeFragments = [];

        extraComponents.forEach(ec => {
          let greenCount = 0;
          for (const p of ec.pixels) {
            const gx = colLeft + p.x, gy = rowTop + p.y;
            const gIdx = (gy * W + gx) * 4;
            const red = data[gIdx], grn = data[gIdx+1], blu = data[gIdx+2];
            if (grn > 70 && grn > red * 1.05 && grn > blu * 1.1) greenCount++;
            else if (red > 140 && grn > 100 && blu < 100) greenCount++;
          }
          const isDinoColor = (greenCount / ec.count) > 0.35;
          if (ec.touchesLeft || ec.touchesRight || isDinoColor) {
            neighborFragments.push(ec);
          } else {
            badgeFragments.push(ec);
          }
        });

        const hadNeighborParts = neighborFragments.length > 0;
        if (hadNeighborParts) {
          report.framesCleanedCount++;
          report.cleanedFramesSummary.push({
            frameNumber: frameNum,
            sheet: s + 1,
            mainDinoPixels: mainDino.count,
            removedNeighborFragments: neighborFragments.map(nf => ({
              pixels: nf.count,
              type: nf.touchesLeft ? 'Neighbor Snout (Left Edge)' : nf.touchesRight ? 'Neighbor Tail (Right Edge)' : 'Neighbor Fragment',
              bounds: `X[${nf.minX}..${nf.maxX}], Y[${nf.minY}..${nf.maxY}]`
            }))
          });
        }

        // 2. Measure bounds of the PURE main dinosaur ONLY
        let dMinX = mainDino.minX, dMaxX = mainDino.maxX;
        let dMinY = mainDino.minY, dMaxY = mainDino.maxY;
        const dinoW = dMaxX - dMinX + 1;
        const dinoH = dMaxY - dMinY + 1;

        // 3. Ground baseline alignment with genuine airborne elevation
        const groundRefY = r === 0 ? ROW_GROUND_Y[s].row1 : ROW_GROUND_Y[s].row2;
        const globalDMaxY = rowTop + dMaxY;
        const elevationAboveGround = Math.max(0, groundRefY - globalDMaxY);
        const isAirborne = elevationAboveGround >= 3;

        const placeX = Math.round((CANVAS_W - dinoW) / 2);
        const placeY = TARGET_GROUND_Y - dinoH - elevationAboveGround;

        // 4. Render standardized frame containing ONLY the main dinosaur
        const stdBuffer = Buffer.alloc(CANVAS_W * CANVAS_H * 4, 0);

        for (const p of mainDino.pixels) {
          const srcX = colLeft + p.x;
          const srcY = rowTop + p.y;
          const srcIdx = (srcY * W + srcX) * 4;

          const dstX = placeX + (p.x - dMinX);
          const dstY = placeY + (p.y - dMinY);

          if (dstX >= 0 && dstX < CANVAS_W && dstY >= 0 && dstY < CANVAS_H) {
            const dstIdx = (dstY * CANVAS_W + dstX) * 4;
            stdBuffer[dstIdx] = data[srcIdx];
            stdBuffer[dstIdx+1] = data[srcIdx+1];
            stdBuffer[dstIdx+2] = data[srcIdx+2];
            stdBuffer[dstIdx+3] = data[srcIdx+3];
          }
        }

        const stdFileName = `frame_${numStr}.png`;
        const stdFilePath = path.join(stdDir, stdFileName);
        await sharp(stdBuffer, { raw: { width: CANVAS_W, height: CANVAS_H, channels: 4 } })
          .png()
          .toFile(stdFilePath);

        // 5. If Sheet 2 (Cleanest 10-frame master cycle), export to cleanest_10_cycle/
        if (s === 1) {
          const cleanIdx = frameNum - 10;
          const cleanName = `run_${String(cleanIdx).padStart(2, '0')}.png`;
          const cleanPath = path.join(cleanDir, cleanName);
          await sharp(stdBuffer, { raw: { width: CANVAS_W, height: CANVAS_H, channels: 4 } })
            .png()
            .toFile(cleanPath);
        }

        report.cleanFramesList.push({
          frameNumber: frameNum,
          sheet: s + 1,
          cleanDinoBounds: { width: dinoW, height: dinoH },
          placedAt: { x: placeX, y: placeY },
          footBottomY: placeY + dinoH,
          elevationAboveGround,
          isAirborne,
          neighborFragmentsRemoved: neighborFragments.length,
          hadNeighborParts
        });
      }
    }
  }

  // Save report into manifest
  const reportPath = path.join(targetDir, 'cleanup_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nCleanup complete! Frames cleaned: ${report.framesCleanedCount} / 50`);
  console.log(`Report written to ${reportPath}`);

  // 6. Generate Contact Sheet (10 columns x 5 rows)
  await generateContactSheet();
}

async function generateContactSheet() {
  console.log('\nGenerating high-resolution 50-frame contact sheet...');
  const COLS = 10;
  const ROWS = 5;
  const CELL_W = 240;
  const CELL_H = 220; // 210 frame + 10 padding for header label
  const SHEET_W = COLS * CELL_W;
  const SHEET_H = ROWS * CELL_H;

  // Composite canvas with dark background
  const compositeBuffer = Buffer.alloc(SHEET_W * SHEET_H * 4, 0);

  // Fill with dark theme background #0d121d
  for (let i = 0; i < SHEET_W * SHEET_H; i++) {
    compositeBuffer[i*4] = 13;
    compositeBuffer[i*4+1] = 18;
    compositeBuffer[i*4+2] = 29;
    compositeBuffer[i*4+3] = 255;
  }

  const overlays = [];

  for (let f = 1; f <= 50; f++) {
    const numStr = String(f).padStart(2, '0');
    const fPath = path.join(stdDir, `frame_${numStr}.png`);
    const col = (f - 1) % COLS;
    const row = Math.floor((f - 1) / COLS);
    const left = col * CELL_W;
    const top = row * CELL_H;

    overlays.push({
      input: fPath,
      left: left,
      top: top + 10
    });
  }

  // Draw grid lines and labels via sharp SVG overlay
  let svgLabels = `<svg width="${SHEET_W}" height="${SHEET_H}">`;
  svgLabels += `<style>
    .grid-line { stroke: rgba(255, 255, 255, 0.08); stroke-width: 1; }
    .ground-line { stroke: rgba(239, 68, 68, 0.5); stroke-width: 1.5; stroke-dasharray: 4,4; }
    .label { font-family: sans-serif; font-size: 11px; font-weight: bold; fill: #67e8f9; }
    .tag { font-family: sans-serif; font-size: 9px; fill: #94a3b8; }
  </style>`;

  for (let c = 1; c < COLS; c++) {
    svgLabels += `<line x1="${c * CELL_W}" y1="0" x2="${c * CELL_W}" y2="${SHEET_H}" class="grid-line" />`;
  }
  for (let r = 1; r < ROWS; r++) {
    svgLabels += `<line x1="0" y1="${r * CELL_H}" x2="${SHEET_W}" y2="${r * CELL_H}" class="grid-line" />`;
  }

  for (let f = 1; f <= 50; f++) {
    const col = (f - 1) % COLS;
    const row = Math.floor((f - 1) / COLS);
    const x = col * CELL_W;
    const y = row * CELL_H;
    const numStr = String(f).padStart(2, '0');
    const isMaster = (f >= 11 && f <= 20);

    svgLabels += `<text x="${x + 8}" y="${y + 16}" class="label" fill="${isMaster ? '#4ade80' : '#67e8f9'}">#${numStr} ${isMaster ? '(Master)' : ''}</text>`;
    svgLabels += `<line x1="${x + 5}" y1="${y + 10 + TARGET_GROUND_Y}" x2="${x + CELL_W - 5}" y2="${y + 10 + TARGET_GROUND_Y}" class="ground-line" />`;
  }

  svgLabels += `</svg>`;
  overlays.push({
    input: Buffer.from(svgLabels),
    left: 0,
    top: 0
  });

  const contactSheetPath = path.join(targetDir, 'contact_sheet_50_clean.png');
  await sharp(compositeBuffer, { raw: { width: SHEET_W, height: SHEET_H, channels: 4 } })
    .composite(overlays)
    .png()
    .toFile(contactSheetPath);

  console.log(`Contact sheet saved to ${contactSheetPath} (${SHEET_W}x${SHEET_H} px)`);
}

runCleanup().catch(err => {
  console.error('Cleanup error:', err);
  process.exit(1);
});
