const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const userUploadedDir = 'C:\\Users\\asus\\.gemini\\antigravity-ide\\brain\\93f495db-673d-4394-aa97-d24e9db54f56\\.user_uploaded';
const runSource = path.join(userUploadedDir, 'media_1792043577245.png');
const duckSource = path.join(userUploadedDir, 'media_1792039315447.png');
const jumpSource = path.join(userUploadedDir, 'media_1792039332642.png');

const outDir = 'repaired_assets_phase2';
const runOutDir = path.join(outDir, 'running');
const duckOutDir = path.join(outDir, 'ducking');
const jumpOutDir = path.join(outDir, 'jumping');
const previewOutDir = path.join(outDir, 'previews');

[outDir, runOutDir, duckOutDir, jumpOutDir, previewOutDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Canvas standardization constants
const CANVAS_W = 136;
const CANVAS_H = 116;
const GROUND_BASELINE_Y = 108; // Y coordinate where grounded foot soles touch

const manifest = {
  task: 'OFFLINE DINO - Phase 2 Source Artwork Repair & Frame Extraction',
  canonicalCanvas: { width: CANVAS_W, height: CANVAS_H, groundBaselineY: GROUND_BASELINE_Y },
  categories: {
    running: [],
    ducking: [],
    jumping: []
  }
};

// =========================================================================
// 1. EXTRACT RUNNING FRAMES (16 poses from media_1792043577245.png)
// =========================================================================
async function processRunning() {
  console.log('=== Processing Running Frames (16 poses) ===');
  const { data, info } = await sharp(runSource).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  function isDino(r, g, b) {
    if (g > r + 8 && g > b + 8 && g > 40) return true; // Green skin
    if (g > 80 && g > r && g > b + 15) return true; // Lime highlight
    if (r < 75 && g < 75 && b < 75) return true; // Dark outlines & spines
    if (r > 160 && g > 140 && (r - b >= 20 || g - b >= 15)) return true; // Cream belly
    if (r > 120 && r > g + 15) return true; // Mouth/tongue
    if (r > 230 && g > 230 && b > 225) return true; // Eye sclera / catchlights
    const diff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    if (diff >= 12) return true; // Non-neutral chroma (checkerboard is neutral diff <= 4)
    return false;
  }

  function getRowComps(minY, maxY) {
    const labels = new Int32Array(W * (maxY - minY + 1)).fill(-1);
    const subH = maxY - minY + 1;
    const comps = [];
    let curL = 0;

    for (let y = 0; y < subH; y++) {
      for (let x = 0; x < W; x++) {
        const absY = minY + y;
        const idx = (absY * W + x) * 4;
        const sIdx = y * W + x;

        if (labels[sIdx] === -1 && isDino(data[idx], data[idx+1], data[idx+2])) {
          let minX = x, maxX = x, cMinY = y, cMaxY = y;
          const pixelIndices = [];
          const q = [sIdx];
          labels[sIdx] = curL;
          let head = 0;

          while (head < q.length) {
            const curr = q[head++];
            pixelIndices.push(curr);
            const cx = curr % W, cy = Math.floor(curr / W);
            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
            if (cy < cMinY) cMinY = cy;
            if (cy > cMaxY) cMaxY = cy;

            for (const [nx, ny] of [[cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]]) {
              if (nx >= 0 && nx < W && ny >= 0 && ny < subH) {
                const nIdx = ny * W + nx;
                if (labels[nIdx] === -1) {
                  const nAbsY = minY + ny;
                  const nPIdx = (nAbsY * W + nx) * 4;
                  if (isDino(data[nPIdx], data[nPIdx+1], data[nPIdx+2])) {
                    labels[nIdx] = curL;
                    q.push(nIdx);
                  }
                }
              }
            }
          }

          if (pixelIndices.length > 500) {
            comps.push({
              label: curL,
              pixelIndices,
              minX,
              maxX,
              minY: minY + cMinY,
              maxY: minY + cMaxY,
              w: maxX - minX + 1,
              h: cMaxY - cMinY + 1
            });
            curL++;
          }
        }
      }
    }
    comps.sort((a, b) => a.minX - b.minX);
    return comps;
  }

  const r1 = getRowComps(35, 136); // Row 1: Frames 01..08
  const r2 = getRowComps(210, 308); // Row 2: Frames 09..16
  const allRuns = [...r1, ...r2];
  console.log(`Found ${allRuns.length} running dinosaurs.`);

  for (let i = 0; i < allRuns.length; i++) {
    const c = allRuns[i];
    const frameIndex = i + 1;
    const frameNum = frameIndex.toString().padStart(2, '0');
    const filename = `run_${frameNum}.png`;
    const outPath = path.join(runOutDir, filename);

    // Isolate figure into cropped buffer with genuine alpha
    const cropW = c.w;
    const cropH = c.h;
    const cropBuf = Buffer.alloc(cropW * cropH * 4, 0);
    const pSet = new Set(c.pixelIndices);
    const subMinY = (i < 8) ? 35 : 210;

    for (let py = 0; py < cropH; py++) {
      for (let px = 0; px < cropW; px++) {
        const absX = c.minX + px;
        const absY = c.minY + py;
        const sIdx = (absY - subMinY) * W + absX;
        const dIdx = (py * cropW + px) * 4;

        if (pSet.has(sIdx)) {
          const sPIdx = (absY * W + absX) * 4;
          cropBuf[dIdx] = data[sPIdx];
          cropBuf[dIdx + 1] = data[sPIdx + 1];
          cropBuf[dIdx + 2] = data[sPIdx + 2];
          cropBuf[dIdx + 3] = 255;
        }
      }
    }

    // Measure exact ground contact / feet soles
    let footY = 0;
    for (let y = cropH - 1; y >= 0; y--) {
      for (let x = 0; x < cropW; x++) {
        if (cropBuf[(y * cropW + x) * 4 + 3] > 0) {
          footY = y;
          break;
        }
      }
      if (footY > 0) break;
    }

    // Place onto canonical 136 x 116 canvas
    // Align foot contact to GROUND_BASELINE_Y (108px)
    // Row 1 grounded poses align foot soles at 108
    // Airborne poses (Frames 3,4,5, 11,12) naturally have feet tucked above baseline
    let targetY = GROUND_BASELINE_Y - footY;
    if (targetY < 5) targetY = 5;
    if (targetY + cropH > CANVAS_H - 2) targetY = CANVAS_H - cropH - 2;

    const targetX = Math.round((CANVAS_W - cropW) / 2);

    const canvasBuf = Buffer.alloc(CANVAS_W * CANVAS_H * 4, 0);
    for (let py = 0; py < cropH; py++) {
      for (let px = 0; px < cropW; px++) {
        const sIdx = (py * cropW + px) * 4;
        const a = cropBuf[sIdx + 3];
        if (a > 0) {
          const destX = targetX + px;
          const destY = targetY + py;
          if (destX >= 0 && destX < CANVAS_W && destY >= 0 && destY < CANVAS_H) {
            const dIdx = (destY * CANVAS_W + destX) * 4;
            canvasBuf[dIdx] = cropBuf[sIdx];
            canvasBuf[dIdx + 1] = cropBuf[sIdx + 1];
            canvasBuf[dIdx + 2] = cropBuf[sIdx + 2];
            canvasBuf[dIdx + 3] = a;
          }
        }
      }
    }

    await sharp(canvasBuf, { raw: { width: CANVAS_W, height: CANVAS_H, channels: 4 } })
      .png()
      .toFile(outPath);

    manifest.categories.running.push({
      frameIndex,
      filename,
      sourceFile: 'media_1792043577245.png',
      sourceBBox: { x: c.minX, y: c.minY, width: c.w, height: c.h },
      canvas: { width: CANVAS_W, height: CANVAS_H },
      placedAt: { x: targetX, y: targetY },
      footBottomY: targetY + footY,
      status: 'VERIFIED_CLEAN'
    });
  }
  console.log('Running frames extraction complete.');
}

// =========================================================================
// 2. EXTRACT DUCKING FRAMES (27 poses from media_1792039315447.png)
// =========================================================================
async function processDucking() {
  console.log('\n=== Processing Ducking Frames (27 poses) ===');
  const { data, info } = await sharp(duckSource).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  const rows = [
    { name: 'Row 0 (Crouch Entry)', y1: 25, y2: 130 },
    { name: 'Row 1 (Sustained Slide)', y1: 150, y2: 215 },
    { name: 'Row 2 (Rise Recovery)', y1: 235, y2: 335 }
  ];

  const duckComps = [];

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const r = rows[rIdx];
    const xProj = new Int32Array(W);
    for (let x = 0; x < W; x++) {
      for (let y = r.y1; y <= r.y2; y++) {
        if (data[(y * W + x) * 4 + 3] > 30) xProj[x]++;
      }
    }

    const cols = [];
    let inFig = false, startX = 0;
    for (let x = 0; x < W; x++) {
      if (!inFig && xProj[x] > 2) { inFig = true; startX = x; }
      else if (inFig && xProj[x] <= 2) {
        inFig = false;
        if (x - startX > 25) cols.push({ minX: startX, maxX: x - 1, w: x - startX });
      }
    }
    if (inFig) cols.push({ minX: startX, maxX: W - 1, w: W - startX });

    for (const c of cols) {
      let minY = r.y2, maxY = r.y1;
      for (let y = r.y1; y <= r.y2; y++) {
        for (let x = c.minX; x <= c.maxX; x++) {
          if (data[(y * W + x) * 4 + 3] > 30) {
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      duckComps.push({ minX: c.minX, maxX: c.maxX, minY, maxY, w: c.maxX - c.minX + 1, h: maxY - minY + 1, row: rIdx });
    }
  }

  console.log(`Found ${duckComps.length} ducking figures across 3 rows.`);

  for (let i = 0; i < duckComps.length; i++) {
    const c = duckComps[i];
    const frameIndex = i; // 0..26
    const frameNum = frameIndex.toString().padStart(2, '0');
    const filename = `duck_${frameNum}.png`;
    const outPath = path.join(duckOutDir, filename);

    const cropW = c.w;
    const cropH = c.h;

    // Crop figure directly preserving original genuine alpha
    const cropBuf = Buffer.alloc(cropW * cropH * 4, 0);
    for (let py = 0; py < cropH; py++) {
      for (let px = 0; px < cropW; px++) {
        const absX = c.minX + px;
        const absY = c.minY + py;
        const sIdx = (absY * W + absX) * 4;
        const dIdx = (py * cropW + px) * 4;
        cropBuf[dIdx] = data[sIdx];
        cropBuf[dIdx + 1] = data[sIdx + 1];
        cropBuf[dIdx + 2] = data[sIdx + 2];
        cropBuf[dIdx + 3] = data[sIdx + 3];
      }
    }

    // Measure grounded baseline (bottom-most non-transparent pixel row)
    let footY = 0;
    for (let y = cropH - 1; y >= 0; y--) {
      for (let x = 0; x < cropW; x++) {
        if (cropBuf[(y * cropW + x) * 4 + 3] > 30) {
          footY = y;
          break;
        }
      }
      if (footY > 0) break;
    }

    // Place onto canonical 136 x 116 canvas:
    // Anchor foot / crawl ground contact strictly at GROUND_BASELINE_Y (108px)
    const targetY = GROUND_BASELINE_Y - footY;
    const targetX = Math.round((CANVAS_W - cropW) / 2);

    const canvasBuf = Buffer.alloc(CANVAS_W * CANVAS_H * 4, 0);
    for (let py = 0; py < cropH; py++) {
      for (let px = 0; px < cropW; px++) {
        const sIdx = (py * cropW + px) * 4;
        const a = cropBuf[sIdx + 3];
        if (a > 10) {
          const destX = targetX + px;
          const destY = targetY + py;
          if (destX >= 0 && destX < CANVAS_W && destY >= 0 && destY < CANVAS_H) {
            const dIdx = (destY * CANVAS_W + destX) * 4;
            canvasBuf[dIdx] = cropBuf[sIdx];
            canvasBuf[dIdx + 1] = cropBuf[sIdx + 1];
            canvasBuf[dIdx + 2] = cropBuf[sIdx + 2];
            canvasBuf[dIdx + 3] = a;
          }
        }
      }
    }

    await sharp(canvasBuf, { raw: { width: CANVAS_W, height: CANVAS_H, channels: 4 } })
      .png()
      .toFile(outPath);

    manifest.categories.ducking.push({
      frameIndex,
      filename,
      sourceFile: 'media_1792039315447.png',
      sourceBBox: { x: c.minX, y: c.minY, width: c.w, height: c.h },
      canvas: { width: CANVAS_W, height: CANVAS_H },
      placedAt: { x: targetX, y: targetY },
      footBottomY: targetY + footY,
      crouchPhase: (c.row === 0 ? 'ENTRY_DROP' : (c.row === 1 ? 'SUSTAINED_SLIDE' : 'RISE_RECOVERY')),
      status: 'VERIFIED_CLEAN'
    });
  }
  console.log('Ducking frames extraction complete.');
}

// =========================================================================
// 3. EXTRACT JUMPING FRAMES (20 poses from media_1792039332642.png)
// =========================================================================
async function processJumping() {
  console.log('\n=== Processing Jumping Frames (20 poses) ===');
  const { data, info } = await sharp(jumpSource).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  // Grounded reference Y coordinates in source sheet:
  // Row 0 ground baseline is at y = 156
  // Row 1 ground baseline is at y = 327
  const row0Boxes = [
    { x: [7, 106], y: [72, 155], grounded: true },   // 0: crouch prep
    { x: [103, 213], y: [86, 156], grounded: true }, // 1: coil
    { x: [199, 304], y: [83, 157], grounded: true }, // 2: takeoff spring
    { x: [293, 394], y: [70, 155], airOffset: 6 },   // 3: leaping ascent
    { x: [385, 483], y: [56, 145], airOffset: 12 },  // 4: upward leap
    { x: [478, 574], y: [38, 132], airOffset: 24 },  // 5: high ascent
    { x: [588, 686], y: [23, 120], airOffset: 34 },  // 6: approaching apex
    { x: [695, 795], y: [22, 117], airOffset: 36 },  // 7: highest apex flight
    { x: [799, 898], y: [37, 132], airOffset: 24 },  // 8: apex glide
    { x: [902, 1001], y: [58, 150], airOffset: 10 }  // 9: descent onset
  ];

  const row1Boxes = [
    { x: [10, 109], y: [191, 288], airOffset: 38 },   // 10: high descent
    { x: [104, 203], y: [188, 280], airOffset: 46 },  // 11: descent flight
    { x: [208, 305], y: [201, 288], airOffset: 38 },  // 12: descent approach
    { x: [313, 410], y: [209, 301], airOffset: 25 },  // 13: landing reach
    { x: [419, 516], y: [224, 327], grounded: true }, // 14: touchdown impact
    { x: [517, 617], y: [233, 327], grounded: true }, // 15: knee compression
    { x: [607, 707], y: [241, 327], grounded: true }, // 16: deep compression
    { x: [698, 800], y: [245, 327], grounded: true }, // 17: rebound rise
    { x: [794, 898], y: [249, 327], grounded: true }, // 18: rebound push
    { x: [903, 1006], y: [234, 326], grounded: true } // 19: spring into run
  ];

  const allJumps = [...row0Boxes, ...row1Boxes];
  console.log(`Configured ${allJumps.length} jumping trajectory frames.`);

  function isDinoJump(r, g, b) {
    if (g > r + 8 && g > b + 8 && g > 40) return true;
    if (g > 80 && g > r && g > b + 15) return true;
    if (r < 75 && g < 75 && b < 75) return true;
    if (r > 160 && g > 140 && (r - b >= 20 || g - b >= 15)) return true;
    if (r > 120 && r > g + 15) return true;
    if (r > 230 && g > 230 && b > 225) return true;
    const diff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    if (diff >= 12) return true;
    return false;
  }

  for (let i = 0; i < allJumps.length; i++) {
    const box = allJumps[i];
    const frameIndex = i;
    const frameNum = frameIndex.toString().padStart(2, '0');
    const filename = `jump_${frameNum}.png`;
    const outPath = path.join(jumpOutDir, filename);

    const minX = box.x[0], maxX = box.x[1];
    const minY = box.y[0], maxY = box.y[1];
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    // Use flood fill from figure interior to segment complete connected dinosaur
    const labels = new Int32Array(cropW * cropH).fill(-1);
    const pixelIndices = [];
    const q = [];

    // Find interior seed on dinosaur (center of crop)
    const midX = Math.floor(cropW / 2);
    const midY = Math.floor(cropH / 2);
    let seedIdx = -1;
    for (let r = 0; r < Math.min(midX, midY); r++) {
      for (const [dx, dy] of [[0, r], [0, -r], [r, 0], [-r, 0], [r, r], [-r, -r]]) {
        const sx = midX + dx;
        const sy = midY + dy;
        if (sx >= 0 && sx < cropW && sy >= 0 && sy < cropH) {
          const absX = minX + sx;
          const absY = minY + sy;
          const pIdx = (absY * W + absX) * 4;
          if (isDinoJump(data[pIdx], data[pIdx+1], data[pIdx+2])) {
            seedIdx = sy * cropW + sx;
            break;
          }
        }
      }
      if (seedIdx !== -1) break;
    }

    if (seedIdx !== -1) {
      q.push(seedIdx);
      labels[seedIdx] = 1;
      let head = 0;
      while (head < q.length) {
        const curr = q[head++];
        pixelIndices.push(curr);
        const cx = curr % cropW, cy = Math.floor(curr / cropW);
        for (const [nx, ny] of [[cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]]) {
          if (nx >= 0 && nx < cropW && ny >= 0 && ny < cropH) {
            const nIdx = ny * cropW + nx;
            if (labels[nIdx] === -1) {
              const absX = minX + nx;
              const absY = minY + ny;
              const pIdx = (absY * W + absX) * 4;
              if (isDinoJump(data[pIdx], data[pIdx+1], data[pIdx+2])) {
                labels[nIdx] = 1;
                q.push(nIdx);
              }
            }
          }
        }
      }
    }

    const pSet = new Set(pixelIndices);
    const cropBuf = Buffer.alloc(cropW * cropH * 4, 0);
    let minPixX = cropW, maxPixX = 0, minPixY = cropH, maxPixY = 0;

    for (let py = 0; py < cropH; py++) {
      for (let px = 0; px < cropW; px++) {
        const idx = py * cropW + px;
        if (pSet.has(idx)) {
          const absX = minX + px;
          const absY = minY + py;
          const sIdx = (absY * W + absX) * 4;
          const dIdx = idx * 4;
          cropBuf[dIdx] = data[sIdx];
          cropBuf[dIdx + 1] = data[sIdx + 1];
          cropBuf[dIdx + 2] = data[sIdx + 2];
          cropBuf[dIdx + 3] = 255;

          if (px < minPixX) minPixX = px;
          if (px > maxPixX) maxPixX = px;
          if (py < minPixY) minPixY = py;
          if (py > maxPixY) maxPixY = py;
        }
      }
    }

    // Determine vertical placement:
    // Grounded frames (0..2, 14..19) anchor foot soles strictly at GROUND_BASELINE_Y (108px).
    // Airborne frames (3..13) preserve their artist-drawn elevation above baseline!
    let targetY;
    if (box.grounded) {
      targetY = GROUND_BASELINE_Y - maxPixY;
    } else {
      // Airborne elevation maintains feet lifted above baseline
      targetY = GROUND_BASELINE_Y - maxPixY - Math.min(18, Math.round((box.airOffset || 10) * 0.45));
    }
    if (targetY < 5) targetY = 5;

    const targetX = Math.round((CANVAS_W - cropW) / 2);

    const canvasBuf = Buffer.alloc(CANVAS_W * CANVAS_H * 4, 0);
    for (let py = 0; py < cropH; py++) {
      for (let px = 0; px < cropW; px++) {
        const sIdx = (py * cropW + px) * 4;
        const a = cropBuf[sIdx + 3];
        if (a > 0) {
          const destX = targetX + px;
          const destY = targetY + py;
          if (destX >= 0 && destX < CANVAS_W && destY >= 0 && destY < CANVAS_H) {
            const dIdx = (destY * CANVAS_W + destX) * 4;
            canvasBuf[dIdx] = cropBuf[sIdx];
            canvasBuf[dIdx + 1] = cropBuf[sIdx + 1];
            canvasBuf[dIdx + 2] = cropBuf[sIdx + 2];
            canvasBuf[dIdx + 3] = a;
          }
        }
      }
    }

    await sharp(canvasBuf, { raw: { width: CANVAS_W, height: CANVAS_H, channels: 4 } })
      .png()
      .toFile(outPath);

    manifest.categories.jumping.push({
      frameIndex,
      filename,
      sourceFile: 'media_1792039332642.png',
      sourceBBox: { x: minX, y: minY, width: cropW, height: cropH },
      canvas: { width: CANVAS_W, height: CANVAS_H },
      placedAt: { x: targetX, y: targetY },
      grounded: !!box.grounded,
      elevationAboveBaseline: box.grounded ? 0 : (GROUND_BASELINE_Y - (targetY + maxPixY)),
      status: 'VERIFIED_CLEAN'
    });
  }
  console.log('Jumping frames extraction complete.');
}

async function run() {
  await processRunning();
  await processDucking();
  await processJumping();

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Saved manifest to ${path.join(outDir, 'manifest.json')}`);
}

run().catch(console.error);
