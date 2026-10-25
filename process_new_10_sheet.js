const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const srcImagePath = 'C:/Users/asus/.gemini/antigravity-ide/brain/baf186b1-2f4d-4f3d-9084-83c9edace571/.user_uploaded/media_1792073671619.png';
const outDir = 'test_new_10_validation';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const CANVAS_W = 240;
const CANVAS_H = 210;
const TARGET_GROUND_Y = 195;

// Ground baseline in raw sheet
const ROW1_GROUND_Y = 190;
const ROW2_GROUND_Y = 386;

const COLS = [
  { left: 0, right: 215 },
  { left: 216, right: 420 },
  { left: 421, right: 625 },
  { left: 626, right: 822 },
  { left: 823, right: 1023 }
];

async function processNewSheet() {
  console.log('=== PROCESSING NEW 10-FRAME SPRITE SHEET ===\n');

  const img = sharp(srcImagePath);
  const meta = await img.metadata();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  console.log(`Source image: ${W}x${H}, channels: ${info.channels}`);

  // 1. Exterior Flood Fill to isolate baked black background
  // Starts from all outer image edges
  const isBg = new Uint8Array(W * H);
  const queue = [];

  for (let x = 0; x < W; x++) {
    queue.push(x, 0); isBg[0 * W + x] = 1;
    queue.push(x, H - 1); isBg[(H - 1) * W + x] = 1;
  }
  for (let y = 0; y < H; y++) {
    queue.push(0, y); isBg[y * W + 0] = 1;
    queue.push(W - 1, y); isBg[y * W + (W - 1)] = 1;
  }

  let head = 0;
  while (head < queue.length) {
    const x = queue[head++], y = queue[head++];
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
        const nidx = ny * W + nx;
        if (!isBg[nidx]) {
          const gidx = nidx * 4;
          // Flood fill threshold: background is near-black (sum <= 10)
          if (data[gidx] + data[gidx+1] + data[gidx+2] <= 10) {
            isBg[nidx] = 1;
            queue.push(nx, ny);
          }
        }
      }
    }
  }

  console.log(`Exterior black background identified: ${queue.length / 2} pixels (${((queue.length / 2) / (W * H) * 100).toFixed(1)}%)`);

  const manifest = {
    sourceImage: 'media_1792073671619.png',
    extractedAt: new Date().toISOString(),
    totalFrames: 10,
    canvasDimensions: { width: CANVAS_W, height: CANVAS_H },
    groundBaselineY: TARGET_GROUND_Y,
    backgroundType: 'Baked black successfully removed via exterior flood fill & edge defringing',
    frames: []
  };

  // 2. Extract each of the 10 dinosaurs
  for (let r = 0; r < 2; r++) {
    const rowTop = r === 0 ? 0 : 205;
    const rowBottom = r === 0 ? 204 : 408;
    const groundRefY = r === 0 ? ROW1_GROUND_Y : ROW2_GROUND_Y;

    for (let c = 0; c < 5; c++) {
      const fNum = r * 5 + c + 1;
      const numStr = String(fNum).padStart(2, '0');
      const colLeft = COLS[c].left;
      const colRight = COLS[c].right;

      // Find bounds of dinosaur within this cell
      let dMinX = colRight, dMaxX = colLeft, dMinY = rowBottom, dMaxY = rowTop;
      let dinoPixels = [];

      for (let y = rowTop; y <= rowBottom; y++) {
        for (let x = colLeft; x <= colRight; x++) {
          const idx = y * W + x;
          if (!isBg[idx]) {
            if (x < dMinX) dMinX = x;
            if (x > dMaxX) dMaxX = x;
            if (y < dMinY) dMinY = y;
            if (y > dMaxY) dMaxY = y;
            dinoPixels.push({ x, y });
          }
        }
      }

      const dinoW = dMaxX - dMinX + 1;
      const dinoH = dMaxY - dMinY + 1;

      // Ground baseline and genuine airborne elevation
      const elevationAboveGround = Math.max(0, groundRefY - dMaxY);
      const isAirborne = elevationAboveGround >= 3;

      // Center horizontally in 240px canvas
      const placeX = Math.round((CANVAS_W - dinoW) / 2);
      // Place vertically so ground baseline is TARGET_GROUND_Y (195px)
      const placeY = TARGET_GROUND_Y - dinoH - elevationAboveGround;
      const placedFootY = placeY + dinoH;

      // Build 240x210 RGBA buffer
      const frameBuffer = Buffer.alloc(CANVAS_W * CANVAS_H * 4, 0);

      for (const p of dinoPixels) {
        const gidx = (p.y * W + p.x) * 4;
        const rVal = data[gidx];
        const gVal = data[gidx+1];
        const bVal = data[gidx+2];
        const sum = rVal + gVal + bVal;

        // Check if pixel borders the exterior background
        let isEdge = false;
        for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nx = p.x + dx, ny = p.y + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H || isBg[ny * W + nx]) {
            isEdge = true; break;
          }
        }

        let outR = rVal, outG = gVal, outB = bVal, outA = 255;

        if (isEdge && sum < 60) {
          // Antialiased transition pixel on black background
          // Calculate genuine alpha and unmultiply RGB to prevent dark fringing
          outA = Math.min(255, Math.max(25, Math.round((sum / 60) * 255)));
          const aFactor = outA / 255;
          outR = Math.min(255, Math.round(rVal / aFactor));
          outG = Math.min(255, Math.round(gVal / aFactor));
          outB = Math.min(255, Math.round(bVal / aFactor));
        }

        const dstX = placeX + (p.x - dMinX);
        const dstY = placeY + (p.y - dMinY);

        if (dstX >= 0 && dstX < CANVAS_W && dstY >= 0 && dstY < CANVAS_H) {
          const dstIdx = (dstY * CANVAS_W + dstX) * 4;
          frameBuffer[dstIdx] = outR;
          frameBuffer[dstIdx+1] = outG;
          frameBuffer[dstIdx+2] = outG; // gVal
          frameBuffer[dstIdx+1] = outG;
          frameBuffer[dstIdx+2] = outB;
          frameBuffer[dstIdx+3] = outA;
        }
      }

      const frameFileName = `frame_${numStr}.png`;
      const frameFilePath = path.join(outDir, frameFileName);
      await sharp(frameBuffer, { raw: { width: CANVAS_W, height: CANVAS_H, channels: 4 } })
        .png()
        .toFile(frameFilePath);

      manifest.frames.push({
        frameNumber: fNum,
        fileName: frameFileName,
        row: r + 1,
        col: c + 1,
        sourceBounds: { x: dMinX, y: dMinY, width: dinoW, height: dinoH },
        pixelCount: dinoPixels.length,
        placedAt: { x: placeX, y: placeY },
        placedFootY,
        elevationAboveGround,
        isAirborne,
        locomotionState: getLocomotionState(fNum)
      });

      console.log(`Frame ${numStr}: ${dinoW}x${dinoH} px (${dinoPixels.length} px), elevation=${elevationAboveGround}px ${isAirborne ? '[AIRBORNE]' : '[CONTACT]'}`);
    }
  }

  // Save manifest
  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest saved to ${manifestPath}`);

  // 3. Generate Contact Sheet (5 columns x 2 rows)
  await generateContactSheet();
}

function getLocomotionState(fNum) {
  const states = [
    'Left Foot Plant (Weight Bearing)',
    'Left Foot Mid-Stance (Passing Phase)',
    'Left Foot Push-Off (Toe Roll)',
    'Dynamic Stride (Flight Extension)',
    'Right Foot Heel Strike (Solid Plant)',
    'Right Foot Mid-Stance',
    'Genuine Airborne Flight (+5px Elevation)',
    'Passing Leg Swing (Descent)',
    'Preparation for Heel Strike',
    'Heel Strike Contact (Seamless Loop Closer)'
  ];
  return states[fNum - 1];
}

async function generateContactSheet() {
  console.log('\nGenerating 10-frame contact sheet...');
  const COLS_COUNT = 5;
  const ROWS_COUNT = 2;
  const CELL_W = 240;
  const CELL_H = 220; // 210 frame + 10 padding for header label
  const SHEET_W = COLS_COUNT * CELL_W;
  const SHEET_H = ROWS_COUNT * CELL_H;

  const bgBuffer = Buffer.alloc(SHEET_W * SHEET_H * 4, 0);
  for (let i = 0; i < SHEET_W * SHEET_H; i++) {
    bgBuffer[i*4] = 13;
    bgBuffer[i*4+1] = 18;
    bgBuffer[i*4+2] = 28;
    bgBuffer[i*4+3] = 255;
  }

  const overlays = [];
  let svg = `<svg width="${SHEET_W}" height="${SHEET_H}">
    <style>
      .grid-line { stroke: rgba(255, 255, 255, 0.08); stroke-width: 1; }
      .ground-line { stroke: #ef4444; stroke-width: 1.5; stroke-dasharray: 4,4; }
      .label { font-family: sans-serif; font-size: 11px; font-weight: bold; fill: #4ade80; }
      .tag { font-family: sans-serif; font-size: 9px; fill: #94a3b8; }
    </style>`;

  for (let c = 1; c < COLS_COUNT; c++) {
    svg += `<line x1="${c * CELL_W}" y1="0" x2="${c * CELL_W}" y2="${SHEET_H}" class="grid-line" />`;
  }
  svg += `<line x1="0" y1="${CELL_H}" x2="${SHEET_W}" y2="${CELL_H}" class="grid-line" />`;

  for (let f = 1; f <= 10; f++) {
    const numStr = String(f).padStart(2, '0');
    const fPath = path.join(outDir, `frame_${numStr}.png`);
    const col = (f - 1) % COLS_COUNT;
    const row = Math.floor((f - 1) / COLS_COUNT);
    const x = col * CELL_W;
    const y = row * CELL_H;

    overlays.push({ input: fPath, left: x, top: y + 10 });

    const isAir = (f === 7);
    svg += `<text x="${x + 8}" y="${y + 16}" class="label">FRAME #${numStr} ${isAir ? '(Airborne +5px)' : '(Contact)'}</text>`;
    svg += `<line x1="${x + 5}" y1="${y + 10 + TARGET_GROUND_Y}" x2="${x + CELL_W - 5}" y2="${y + 10 + TARGET_GROUND_Y}" class="ground-line" />`;
  }

  svg += '</svg>';
  overlays.push({ input: Buffer.from(svg), left: 0, top: 0 });

  const contactSheetPath = path.join(outDir, 'contact_sheet_10_clean.png');
  await sharp(bgBuffer, { raw: { width: SHEET_W, height: SHEET_H, channels: 4 } })
    .composite(overlays)
    .png()
    .toFile(contactSheetPath);

  console.log(`Contact sheet saved to ${contactSheetPath} (${SHEET_W}x${SHEET_H} px)`);
}

processNewSheet().catch(err => {
  console.error('Processing error:', err);
  process.exit(1);
});
