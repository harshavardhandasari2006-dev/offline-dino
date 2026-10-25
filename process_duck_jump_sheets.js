const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'test_duck_jump_animations');
const jumpDir = path.join(baseDir, 'jump_frames');
const duckDir = path.join(baseDir, 'duck_frames');

[baseDir, jumpDir, duckDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const CANVAS_W = 240;
const CANVAS_H = 210;
const GROUND_Y = 195;

// Jump specs
const jumpSpecs = {
  srcPath: path.join(baseDir, 'jump_sheet_original.png'),
  rowSplit: 220,
  rowGrounds: [206, 380], // Baseline Y for row 1 and row 2 in the sheet
  cuts: [
    [0, 212, 420, 620, 820, 1024],
    [0, 195, 405, 610, 818, 1024]
  ],
  poses: [
    { name: 'Takeoff Anticipation / Standing', state: 'GROUNDED' },
    { name: 'Crouch & Compression', state: 'GROUNDED' },
    { name: 'Upward Spring Launch', state: 'LIFTOFF' },
    { name: 'Ascent Phase', state: 'AIRBORNE' },
    { name: 'High Apex Ascent', state: 'AIRBORNE' },
    { name: 'High Apex Flight / Glide', state: 'AIRBORNE' },
    { name: 'Descent Phase', state: 'AIRBORNE' },
    { name: 'Touchdown Reach', state: 'DESCENT' },
    { name: 'Impact Compression', state: 'GROUNDED' },
    { name: 'Landing Rebound', state: 'GROUNDED' }
  ]
};

// Duck specs
const duckSpecs = {
  srcPath: path.join(baseDir, 'duck_sheet_original.png'),
  rowSplit: 240,
  rowGrounds: [207, 379], // Baseline Y for row 1 and row 2 in the sheet
  cuts: [
    [0, 205, 415, 620, 825, 1024],
    [0, 205, 415, 620, 825, 1024]
  ],
  poses: [
    { name: 'Closed-Eye Standing / Crouch Entry 1', state: 'LOWERING' },
    { name: 'Lowering Torso & Neck / Crouch Entry 2', state: 'LOWERING' },
    { name: 'Deep Crouch Entry 3', state: 'LOWERING' },
    { name: 'Low Crouch Flattening', state: 'CROUCH' },
    { name: 'Lowest Sustained Crouch Slide', state: 'SUSTAINED_SLIDE' },
    { name: 'Low Crawl Stride 1', state: 'SUSTAINED_SLIDE' },
    { name: 'Low Crawl Stride 2', state: 'SUSTAINED_SLIDE' },
    { name: 'Beginning Recovery Rise 1', state: 'RISING' },
    { name: 'Mid Recovery Rise 2', state: 'RISING' },
    { name: 'High Recovery to Standing 3', state: 'RISING' }
  ]
};

async function processSheet(specs, outDir, prefix) {
  console.log(`\n=== Processing ${prefix.toUpperCase()} Sprite Sheet ===`);
  const { data, info } = await sharp(specs.srcPath).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;

  const isDino = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    const idx = (y * w + x) * 4;
    return (data[idx] > 12 || data[idx+1] > 12 || data[idx+2] > 12);
  };

  const framesMeta = [];
  const extractedFrames = [];

  for (let r = 0; r < 2; r++) {
    const y0 = r === 0 ? 0 : specs.rowSplit;
    const y1 = r === 0 ? specs.rowSplit : h;
    const rowGround = specs.rowGrounds[r];

    for (let c = 0; c < 5; c++) {
      const frameIndex = r * 5 + c + 1;
      const padNum = frameIndex.toString().padStart(2, '0');
      const x0 = specs.cuts[r][c];
      const x1 = specs.cuts[r][c+1];

      // 1. Find exact tight bounding box of dinosaur
      let minX = w, maxX = 0, minY = h, maxY = 0, pixelCount = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (isDino(x, y)) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            pixelCount++;
          }
        }
      }

      const tightW = maxX - minX + 1;
      const tightH = maxY - minY + 1;
      const elevation = Math.max(0, rowGround - maxY);

      // 2. Perform outer flood-fill on the tight crop (+ safe padding) to remove baked black background
      const cropPad = 4;
      const cropX0 = Math.max(0, minX - cropPad);
      const cropX1 = Math.min(w - 1, maxX + cropPad);
      const cropY0 = Math.max(0, minY - cropPad);
      const cropY1 = Math.min(h - 1, maxY + cropPad);
      const cropW = cropX1 - cropX0 + 1;
      const cropH = cropY1 - cropY0 + 1;

      // Extract raw pixels for crop
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

      // BFS flood fill from 4 borders to mark background
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
        if (isBg(cropW - 1, cy) && !visited[cy * cropW + cropW - 1]) { queue.push(cropW - 1, cy); visited[cy * cropW + cropW - 1] = 1; }
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

      // 3. Place onto standardized 240x210 canvas
      // Target foot ground baseline Y = GROUND_Y (195)
      const placedFootY = GROUND_Y - elevation;
      const placedY = placedFootY - (maxY - cropY0);
      const placedX = Math.round((CANVAS_W - cropW) / 2);

      const transCanvas = Buffer.alloc(CANVAS_W * CANVAS_H * 4, 0); // Transparent 0
      const rawCanvas = Buffer.alloc(CANVAS_W * CANVAS_H * 4, 0);   // Black raw (0,0,0,255)
      // Fill rawCanvas with pure black opaque
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

            // Raw canvas (original black background)
            rawCanvas[dIdx] = cropRaw[cIdx];
            rawCanvas[dIdx+1] = cropRaw[cIdx+1];
            rawCanvas[dIdx+2] = cropRaw[cIdx+2];
            rawCanvas[dIdx+3] = 255;
          }
        }
      }

      // Save standardized transparent PNG
      const transFilename = `${prefix}_${padNum}.png`;
      const transPath = path.join(outDir, transFilename);
      await sharp(transCanvas, { raw: { width: CANVAS_W, height: CANVAS_H, channels: 4 } }).png().toFile(transPath);

      // Save standardized raw black PNG
      const rawFilename = `${prefix}_raw_${padNum}.png`;
      const rawPath = path.join(outDir, rawFilename);
      await sharp(rawCanvas, { raw: { width: CANVAS_W, height: CANVAS_H, channels: 4 } }).png().toFile(rawPath);

      console.log(`  Frame ${padNum} (R${r+1}C${c+1}): size ${tightW}x${tightH}, footY=${maxY}, elevation=${elevation}px, placedFootY=${placedFootY}, saved ${transFilename}`);

      const frameMeta = {
        frameNumber: frameIndex,
        fileName: transFilename,
        rawFileName: rawFilename,
        row: r + 1,
        col: c + 1,
        poseName: specs.poses[frameIndex - 1].name,
        state: specs.poses[frameIndex - 1].state,
        sourceBounds: { x: minX, y: minY, width: tightW, height: tightH },
        pixelCount,
        placedAt: { x: placedX, y: placedY },
        placedFootY,
        elevationAboveGround: elevation,
        isGrounded: elevation === 0
      };
      framesMeta.push(frameMeta);
      extractedFrames.push({ transCanvas, rawCanvas, frameMeta });
    }
  }

  // 4. Build Contact Sheet (5 cols x 2 rows of 240x210 = 1200x420)
  const CS_W = CANVAS_W * 5;
  const CS_H = CANVAS_H * 2;
  const contactBuf = Buffer.alloc(CS_W * CS_H * 4, 0);

  // Background: dark slate grey #141923 with ground lines
  for (let y = 0; y < CS_H; y++) {
    const rowIdx = Math.floor(y / CANVAS_H);
    const localY = y % CANVAS_H;
    for (let x = 0; x < CS_W; x++) {
      const idx = (y * CS_W + x) * 4;
      // Checkerboard subtle pattern
      const chk = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0;
      const baseCol = chk ? 22 : 16;
      contactBuf[idx] = baseCol;
      contactBuf[idx+1] = baseCol + 4;
      contactBuf[idx+2] = baseCol + 10;
      contactBuf[idx+3] = 255;

      // Draw red ground line at GROUND_Y (195) in each cell
      if (localY === GROUND_Y || localY === GROUND_Y + 1) {
        contactBuf[idx] = 255;
        contactBuf[idx+1] = 70;
        contactBuf[idx+2] = 70;
        contactBuf[idx+3] = 255;
      }
    }
  }

  // Stamp each transparent frame onto contact sheet
  for (let i = 0; i < 10; i++) {
    const r = Math.floor(i / 5);
    const c = i % 5;
    const fBuf = extractedFrames[i].transCanvas;
    const startX = c * CANVAS_W;
    const startY = r * CANVAS_H;

    for (let cy = 0; cy < CANVAS_H; cy++) {
      for (let cx = 0; cx < CANVAS_W; cx++) {
        const srcIdx = (cy * CANVAS_W + cx) * 4;
        const alpha = fBuf[srcIdx + 3] / 255;
        if (alpha > 0) {
          const destIdx = ((startY + cy) * CS_W + (startX + cx)) * 4;
          contactBuf[destIdx] = Math.round(fBuf[srcIdx] * alpha + contactBuf[destIdx] * (1 - alpha));
          contactBuf[destIdx+1] = Math.round(fBuf[srcIdx+1] * alpha + contactBuf[destIdx+1] * (1 - alpha));
          contactBuf[destIdx+2] = Math.round(fBuf[srcIdx+2] * alpha + contactBuf[destIdx+2] * (1 - alpha));
        }
      }
    }
  }

  const contactPath = path.join(outDir, `contact_sheet_${prefix}.png`);
  await sharp(contactBuf, { raw: { width: CS_W, height: CS_H, channels: 4 } }).png().toFile(contactPath);
  console.log(`Saved Contact Sheet: contact_sheet_${prefix}.png (${CS_W}x${CS_H})`);

  return { framesMeta, contactFile: `contact_sheet_${prefix}.png` };
}

async function main() {
  const jumpResult = await processSheet(jumpSpecs, jumpDir, 'jump');
  const duckResult = await processSheet(duckSpecs, duckDir, 'duck');

  const manifest = {
    generatedAt: new Date().toISOString(),
    canvasDimensions: { width: CANVAS_W, height: CANVAS_H },
    groundBaselineY: GROUND_Y,
    backgroundReport: {
      status: "BAKED_BLACK_BACKGROUND",
      description: "Both original sprite sheets have opaque baked pitch-black RGB(0,0,0) backgrounds (alpha=255).",
      handling: "Safe outer flood-fill from canvas borders was used to isolate the dinosaur figures into genuine transparent alpha frames while strictly preserving internal black details (pupils in jump frames, closed-eye outlines in duck frames). Raw original black background frames are also preserved in parallel.",
      transparentFramesFolder: "jump_frames/jump_XX.png, duck_frames/duck_XX.png",
      rawFramesFolder: "jump_frames/jump_raw_XX.png, duck_frames/duck_raw_XX.png"
    },
    jumpAnimation: {
      totalFrames: 10,
      layout: "5 columns x 2 rows",
      contactSheet: "jump_frames/" + jumpResult.contactFile,
      frames: jumpResult.framesMeta
    },
    duckAnimation: {
      totalFrames: 10,
      layout: "5 columns x 2 rows",
      contactSheet: "duck_frames/" + duckResult.contactFile,
      frames: duckResult.framesMeta
    }
  };

  const manifestPath = path.join(baseDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('\nSaved technical manifest:', manifestPath);
}

main().catch(console.error);
