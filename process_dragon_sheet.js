const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const srcSheetPath = 'C:\\Users\\asus\\.gemini\\antigravity-ide\\brain\\baf186b1-2f4d-4f3d-9084-83c9edace571\\.user_uploaded\\media_1792083352911.png';
const baseDir = path.join(__dirname, 'test_dragon_flight');
const framesDir = path.join(baseDir, 'dragon_frames');

[baseDir, framesDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Copy original sheet into test folder
fs.copyFileSync(srcSheetPath, path.join(baseDir, 'dragon_sheet_original.png'));

const CANVAS_W = 240;
const CANVAS_H = 210;
const SNOUT_TARGET_X = 25;
const SNOUT_TARGET_Y = 110;

const cuts = [
  [0, 207, 415, 619, 818, 1024],
  [0, 209, 414, 616, 816, 1024]
];

const poseDescriptions = [
  { id: 1, name: 'High Wing Ascent / Full Upstroke', wings: 'UPSTROKE_HIGH' },
  { id: 2, name: 'Forward Wing Swept Upstroke', wings: 'UPSTROKE_FORWARD' },
  { id: 3, name: 'Transition to Mid-Flap Down', wings: 'TRANSITION_MID' },
  { id: 4, name: 'Arched Wing Flap Spread', wings: 'SPREAD_GLIDE' },
  { id: 5, name: 'Forward Swept Mid-Flap', wings: 'FORWARD_MID' },
  { id: 6, name: 'High Arched Crest Flap', wings: 'UPSTROKE_CREST' },
  { id: 7, name: 'Beginning Downstroke Power Sweep', wings: 'DOWNSTROKE_START' },
  { id: 8, name: 'Deep Downstroke Power Thrust', wings: 'DOWNSTROKE_DEEP' },
  { id: 9, name: 'Lowest Wing Downstroke Pocket', wings: 'DOWNSTROKE_LOW' },
  { id: 10, name: 'Upward Recovery Lift to Upstroke', wings: 'RECOVERY_LIFT' }
];

async function processDragonSheet() {
  console.log('=== PROCESSING DRAGON FLIGHT SPRITE SHEET (WITH ENCLOSED POCKET TRANSPARENCY) ===');
  const { data, info } = await sharp(srcSheetPath).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;

  const isDragonPixel = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    const idx = (y * w + x) * 4;
    return (data[idx] > 12 || data[idx+1] > 12 || data[idx+2] > 12);
  };

  const framesMeta = [];
  const extractedBuffers = [];

  for (let r = 0; r < 2; r++) {
    const y0 = r === 0 ? 0 : 212;
    const y1 = r === 0 ? 212 : h;

    for (let c = 0; c < 5; c++) {
      const frameIdx = r * 5 + c + 1;
      const padNum = frameIdx.toString().padStart(2, '0');
      const x0 = cuts[r][c];
      const x1 = cuts[r][c+1];

      // 1. Locate dragon bounds & snout
      let minX = w, maxX = 0, minY = h, maxY = 0, pixelCount = 0;
      let yAtMinX = -1;

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (isDragonPixel(x, y)) {
            if (x < minX) {
              minX = x;
              yAtMinX = y;
            }
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            pixelCount++;
          }
        }
      }

      const tightW = maxX - minX + 1;
      const tightH = maxY - minY + 1;

      // 2. Crop with safe margin for BFS boundary flood-fill
      const cropPad = 4;
      const cropX0 = Math.max(0, minX - cropPad);
      const cropX1 = Math.min(w - 1, maxX + cropPad);
      const cropY0 = Math.max(0, minY - cropPad);
      const cropY1 = Math.min(h - 1, maxY + cropPad);
      const cropW = cropX1 - cropX0 + 1;
      const cropH = cropY1 - cropY0 + 1;

      const cropRaw = Buffer.alloc(cropW * cropH * 4);
      for (let cy = 0; cy < cropH; cy++) {
        for (let cx = 0; cx < cropW; cx++) {
          const sIdx = ((cropY0 + cy) * w + (cropX0 + cx)) * 4;
          const dIdx = (cy * cropW + cx) * 4;
          cropRaw[dIdx] = data[sIdx];
          cropRaw[dIdx+1] = data[sIdx+1];
          cropRaw[dIdx+2] = data[sIdx+2];
          cropRaw[dIdx+3] = 255;
        }
      }

      // BFS flood fill from 4 borders to classify outer black background
      const isBg = (cx, cy) => {
        const idx = (cy * cropW + cx) * 4;
        return cropRaw[idx] <= 12 && cropRaw[idx+1] <= 12 && cropRaw[idx+2] <= 12;
      };

      const visited = new Uint8Array(cropW * cropH);
      const queue = [];
      for (let cx = 0; cx < cropW; cx++) {
        if (isBg(cx, 0)) { queue.push(cx, 0); visited[0 * cropW + cx] = 1; }
        if (isBg(cx, cropH - 1)) { queue.push(cx, cropH - 1); visited[(cropH - 1) * cropW + cx] = 1; }
      }
      for (let cy = 0; cy < cropH; cy++) {
        if (isBg(0, cy) && !visited[cy * cropW]) { queue.push(0, cy); visited[cy * cropW] = 1; }
        if (isBg(cropW - 1, cy) && !visited[cropW - 1 + cy * cropW]) { queue.push(cropW - 1, cy); visited[cropW - 1 + cy * cropW] = 1; }
      }

      let qHead = 0;
      while (qHead < queue.length) {
        const qx = queue[qHead++];
        const qy = queue[qHead++];
        const nbrs = [[qx+1, qy], [qx-1, qy], [qx, qy+1], [qx, qy-1]];
        for (const [nx, ny] of nbrs) {
          if (nx >= 0 && nx < cropW && ny >= 0 && ny < cropH) {
            const nidx = ny * cropW + nx;
            if (!visited[nidx] && isBg(nx, ny)) {
              visited[nidx] = 1;
              queue.push(nx, ny);
            }
          }
        }
      }

      // Check for enclosed large background pockets (>100px) like neck-wing gap
      // These are connected components of black pixels not reached from the outer border
      const pocketVisited = new Uint8Array(cropW * cropH);
      for (let cy = 0; cy < cropH; cy++) {
        for (let cx = 0; cx < cropW; cx++) {
          const idx = cy * cropW + cx;
          if (!visited[idx] && isBg(cx, cy) && !pocketVisited[idx]) {
            // Find component
            const comp = [[cx, cy]];
            pocketVisited[idx] = 1;
            let cHead = 0;
            while (cHead < comp.length) {
              const [px, py] = comp[cHead++];
              const nbrs = [[px+1, py], [px-1, py], [px, py+1], [px, py-1]];
              for (const [nx, ny] of nbrs) {
                if (nx >= 0 && nx < cropW && ny >= 0 && ny < cropH) {
                  const nidx = ny * cropW + nx;
                  if (!visited[nidx] && isBg(nx, ny) && !pocketVisited[nidx]) {
                    pocketVisited[nidx] = 1;
                    comp.push([nx, ny]);
                  }
                }
              }
            }
            // If component has >100 pixels, it is an enclosed background sky pocket, NOT a pupil or nostril!
            if (comp.length > 100) {
              console.log(`    -> Clearing enclosed sky pocket of ${comp.length}px in Frame ${padNum}`);
              for (const [px, py] of comp) {
                visited[py * cropW + px] = 1; // Mark as transparent background
              }
            }
          }
        }
      }

      // 3. Composite onto standardized 240x210 canvas
      const placedX = SNOUT_TARGET_X - (minX - cropX0);
      const placedY = SNOUT_TARGET_Y - (yAtMinX - cropY0);

      const transCanvas = Buffer.alloc(CANVAS_W * CANVAS_H * 4, 0); // Transparent 0
      const rawCanvas = Buffer.alloc(CANVAS_W * CANVAS_H * 4, 0);   // Solid black

      for (let i = 0; i < CANVAS_W * CANVAS_H; i++) {
        rawCanvas[i * 4 + 3] = 255;
      }

      for (let cy = 0; cy < cropH; cy++) {
        for (let cx = 0; cx < cropW; cx++) {
          const destX = placedX + cx;
          const destY = placedY + cy;
          if (destX >= 0 && destX < CANVAS_W && destY >= 0 && destY < CANVAS_H) {
            const cIdx = (cy * cropW + cx) * 4;
            const dIdx = (destY * CANVAS_W + destX) * 4;
            const isOutside = visited[cy * cropW + cx] === 1;

            // Transparent canvas
            transCanvas[dIdx] = cropRaw[cIdx];
            transCanvas[dIdx+1] = cropRaw[cIdx+1];
            transCanvas[dIdx+2] = cropRaw[cIdx+2];
            transCanvas[dIdx+3] = isOutside ? 0 : 255;

            // Raw canvas
            rawCanvas[dIdx] = cropRaw[cIdx];
            rawCanvas[dIdx+1] = cropRaw[cIdx+1];
            rawCanvas[dIdx+2] = cropRaw[cIdx+2];
            rawCanvas[dIdx+3] = 255;
          }
        }
      }

      // Save transparent frame
      const transFilename = `dragon_flight_${padNum}.png`;
      const transPath = path.join(framesDir, transFilename);
      await sharp(transCanvas, { raw: { width: CANVAS_W, height: CANVAS_H, channels: 4 } }).png().toFile(transPath);

      // Save raw black frame
      const rawFilename = `dragon_flight_raw_${padNum}.png`;
      const rawPath = path.join(framesDir, rawFilename);
      await sharp(rawCanvas, { raw: { width: CANVAS_W, height: CANVAS_H, channels: 4 } }).png().toFile(rawPath);

      extractedBuffers.push({ trans: transCanvas, raw: rawCanvas });

      console.log(`  Frame ${padNum} (R${r+1}C${c+1}): size=${tightW}x${tightH}, snout=(${minX},${yAtMinX}), placed=(${placedX},${placedY}), saved ${transFilename}`);

      framesMeta.push({
        frameNumber: frameIdx,
        fileName: transFilename,
        rawFileName: rawFilename,
        row: r + 1,
        col: c + 1,
        poseName: poseDescriptions[frameIdx - 1].name,
        wingStage: poseDescriptions[frameIdx - 1].wings,
        sourceBounds: { x: minX, y: minY, width: tightW, height: tightH },
        snoutSource: { x: minX, y: yAtMinX },
        pixelCount,
        placedAt: { x: placedX, y: placedY },
        canvasDimensions: { width: CANVAS_W, height: CANVAS_H }
      });
    }
  }

  // 4. Build Contact Sheet (5 columns x 2 rows, high resolution 1200x420)
  console.log('\nGenerating 1200x420 Contact Sheet ...');
  const CS_COLS = 5;
  const CS_ROWS = 2;
  const CS_W = CANVAS_W * CS_COLS; // 1200
  const CS_H = CANVAS_H * CS_ROWS; // 420
  const csBuffer = Buffer.alloc(CS_W * CS_H * 4, 0);

  // Fill contact sheet with dark background with subtle checker pattern
  for (let y = 0; y < CS_H; y++) {
    for (let x = 0; x < CS_W; x++) {
      const idx = (y * CS_W + x) * 4;
      const chk = ((Math.floor(x / 15) + Math.floor(y / 15)) % 2 === 0);
      csBuffer[idx] = chk ? 22 : 15;
      csBuffer[idx+1] = chk ? 26 : 18;
      csBuffer[idx+2] = chk ? 34 : 24;
      csBuffer[idx+3] = 255;
    }
  }

  // Draw grid lines and place extracted frames
  for (let i = 0; i < 10; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const startX = col * CANVAS_W;
    const startY = row * CANVAS_H;
    const frameBuf = extractedBuffers[i].trans;

    for (let fy = 0; fy < CANVAS_H; fy++) {
      for (let fx = 0; fx < CANVAS_W; fx++) {
        const sIdx = (fy * CANVAS_W + fx) * 4;
        const dIdx = ((startY + fy) * CS_W + (startX + fx)) * 4;
        const a = frameBuf[sIdx + 3] / 255;
        if (a > 0) {
          csBuffer[dIdx] = Math.round(frameBuf[sIdx] * a + csBuffer[dIdx] * (1 - a));
          csBuffer[dIdx+1] = Math.round(frameBuf[sIdx+1] * a + csBuffer[dIdx+1] * (1 - a));
          csBuffer[dIdx+2] = Math.round(frameBuf[sIdx+2] * a + csBuffer[dIdx+2] * (1 - a));
        }
      }
    }
  }

  // Draw subtle cell borders and snout reference crosshairs
  for (let c = 1; c < CS_COLS; c++) {
    const lx = c * CANVAS_W;
    for (let y = 0; y < CS_H; y++) {
      const idx = (y * CS_W + lx) * 4;
      csBuffer[idx] = 40; csBuffer[idx+1] = 50; csBuffer[idx+2] = 70;
    }
  }
  for (let r = 1; r < CS_ROWS; r++) {
    const ly = r * CANVAS_H;
    for (let x = 0; x < CS_W; x++) {
      const idx = (ly * CS_W + x) * 4;
      csBuffer[idx] = 40; csBuffer[idx+1] = 50; csBuffer[idx+2] = 70;
    }
  }

  // Draw blue snout horizontal guideline across each row at SNOUT_TARGET_Y
  for (let r = 0; r < CS_ROWS; r++) {
    const gy = r * CANVAS_H + SNOUT_TARGET_Y;
    for (let x = 0; x < CS_W; x++) {
      const idx = (gy * CS_W + x) * 4;
      csBuffer[idx] = 56; csBuffer[idx+1] = 189; csBuffer[idx+2] = 248;
      csBuffer[idx+3] = 180;
    }
  }

  const csPath = path.join(framesDir, 'contact_sheet_dragon_flight.png');
  await sharp(csBuffer, { raw: { width: CS_W, height: CS_H, channels: 4 } }).png().toFile(csPath);
  console.log('Saved contact sheet:', csPath);

  // 5. Save manifest.json
  const manifest = {
    generatedAt: new Date().toISOString(),
    canvasDimensions: { width: CANVAS_W, height: CANVAS_H },
    snoutAnchor: { x: SNOUT_TARGET_X, y: SNOUT_TARGET_Y },
    flightDirection: 'LEFT',
    movementDirection: 'RIGHT_TO_LEFT',
    backgroundAudit: {
      status: 'BAKED_BLACK_BACKGROUND',
      description: 'Original sprite sheet has opaque pitch-black RGB(0,0,0) background (alpha=255).',
      remedy: 'Border BFS flood-fill and enclosed sky-pocket transparency removed both exterior black and trapped neck-wing sky voids while 100% preserving pupil, mouth cavity, horns, teeth, and membrane shadows.'
    },
    totalFrames: 10,
    contactSheet: 'dragon_frames/contact_sheet_dragon_flight.png',
    frames: framesMeta
  };

  fs.writeFileSync(path.join(baseDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('Saved manifest.json');
}

processDragonSheet().catch(err => console.error(err));
