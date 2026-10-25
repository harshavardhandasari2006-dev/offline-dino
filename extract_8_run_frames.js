const sharp = require('sharp');
const fs = require('fs');

async function extract8RunFrames() {
  const refPath = 'assets/dino_skin_variations_reference.jpg';
  const { data: refData, info: refInfo } = await sharp(refPath).raw().toBuffer({ resolveWithObject: true });
  const W = refInfo.width, H = refInfo.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [refData[idx], refData[idx + 1], refData[idx + 2]];
  }

  // The 8 frames in assets/dino_skin_variations_reference.jpg:
  // Top is y=195, bottom is y=350
  // X centers: ~ 44, 126, 210, 294, 378, 463, 547, 630
  const frameBoxes = [
    { minX: 10, maxX: 82, minY: 228, maxY: 334 },
    { minX: 90, maxX: 167, minY: 235, maxY: 334 },
    { minX: 172, maxX: 252, minY: 228, maxY: 334 },
    { minX: 256, maxX: 337, minY: 228, maxY: 334 },
    { minX: 341, maxX: 422, minY: 226, maxY: 334 },
    { minX: 426, maxX: 504, minY: 228, maxY: 334 },
    { minX: 510, maxX: 588, minY: 235, maxY: 334 },
    { minX: 593, maxX: 665, minY: 228, maxY: 334 }
  ];

  const extractedCanvases = [];

  for (let fIdx = 0; fIdx < 8; fIdx++) {
    const box = frameBoxes[fIdx];
    const padL = Math.max(0, box.minX - 4);
    const padR = Math.min(W - 1, box.maxX + 4);
    const padT = Math.max(0, box.minY - 4);
    const padB = Math.min(H - 1, box.maxY + 4);

    const cropW = padR - padL + 1;
    const cropH = padB - padT + 1;

    // Check if pixel is boundary of dino
    function isDino(x, y) {
      const absX = padL + x, absY = padT + y;
      const [r, g, b] = getPixel(absX, absY);

      // Checkerboard is light gray/white:
      const isChecker = (Math.abs(r - g) < 14 && Math.abs(g - b) < 14 && r > 200 && g > 200 && b > 200);
      if (isChecker) return false;

      // Dark numbers box at bottom (y > 336 in reference)
      if (absY >= 335 && r < 50 && g < 60 && b < 80) return false;

      // Dino features:
      // Green skin
      if (g > r + 8 && g > b + 8 && g > 45) return true;
      if (g > 80 && g > r && g > b + 10) return true;
      // Dark outline
      if (r < 75 && g < 80 && b < 75) return true;
      // Cream belly
      if (r > 160 && g > 140 && b < 180 && r >= g) return true;
      // Coral mouth
      if (r > 130 && g < 110 && b < 120) return true;
      // Claws / toenails
      if (r > 180 && g > 170 && b > 120 && sat(r,g,b) < 0.3) return true;
      // Eye whites (inside outline)
      if (r > 210 && g > 210 && b > 210) return true;

      return false;
    }

    function sat(r, g, b) {
      const max = Math.max(r, g, b) / 255;
      const min = Math.min(r, g, b) / 255;
      return max === min ? 0 : (max - min) / max;
    }

    // Grid: 0 = unvisited, 1 = exterior background, 2 = dino
    const grid = new Uint8Array(cropW * cropH);

    // Flood fill from boundary of crop box
    const queue = [];
    for (let x = 0; x < cropW; x++) {
      for (const y of [0, cropH - 1]) {
        if (!isDino(x, y)) {
          grid[y * cropW + x] = 1;
          queue.push([x, y]);
        }
      }
    }
    for (let y = 0; y < cropH; y++) {
      for (const x of [0, cropW - 1]) {
        if (!isDino(x, y) && grid[y * cropW + x] === 0) {
          grid[y * cropW + x] = 1;
          queue.push([x, y]);
        }
      }
    }

    let head = 0;
    while (head < queue.length) {
      const [cx, cy] = queue[head++];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < cropW && ny >= 0 && ny < cropH) {
          const nIdx = ny * cropW + nx;
          if (grid[nIdx] === 0) {
            if (!isDino(nx, ny)) {
              grid[nIdx] = 1;
              queue.push([nx, ny]);
            }
          }
        }
      }
    }

    // Now build RGBA sprite for this frame
    // We want to center it on 128x112 canonical canvas
    // First find dino bounding box in the crop
    let minDx = cropW, maxDx = 0, minDy = cropH, maxDy = 0;
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        if (grid[y * cropW + x] !== 1) {
          if (x < minDx) minDx = x;
          if (x > maxDx) maxDx = x;
          if (y < minDy) minDy = y;
          if (y > maxDy) maxDy = y;
        }
      }
    }

    const dinoW = maxDx - minDx + 1;
    const dinoH = maxDy - minDy + 1;
    console.log(`Frame ${fIdx}: dinoW=${dinoW}, dinoH=${dinoH}`);

    // Place onto canonical 128x112 canvas:
    // Standing foot baseline in canonical canvas is y = 103
    // Frames 0, 5 (contact), 1, 6 (down) plant feet on baseline y = 103!
    // Frames 2, 7 (push) have foot at y = 102
    // Frames 3, 4 (mid air flight) have feet elevated at y = 97..99!
    // Let's align based on the foot ground line:
    // In reference, the ground line is at maxY = 334.
    // So relative to reference bottom y=334, let's map y=334 to canvas y=103!
    const canvasW = 128;
    const canvasH = 112;
    const canvasBuf = Buffer.alloc(canvasW * canvasH * 4, 0);

    // Compute offset so reference absY = 334 lands at canvasY = 103
    // absY = padT + y
    // canvasY = 103 - (334 - absY) = 103 - 334 + padT + y = (padT + y) - 231
    // And center horizontally around x = 64
    // Character center in x is roughly (minDx + maxDx) / 2
    // Place center at canvas x = 60
    const charCenterX = (minDx + maxDx) / 2;
    const offsetX = Math.round(62 - charCenterX);
    const offsetY = 103 - (334 - padT);

    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        if (grid[y * cropW + x] !== 1) {
          const absX = padL + x, absY = padT + y;
          const [r, g, b] = getPixel(absX, absY);

          const dstX = x + offsetX;
          const dstY = y + offsetY;

          if (dstX >= 0 && dstX < canvasW && dstY >= 0 && dstY < canvasH) {
            const dstIdx = (dstY * canvasW + dstX) * 4;
            canvasBuf[dstIdx] = r;
            canvasBuf[dstIdx + 1] = g;
            canvasBuf[dstIdx + 2] = b;
            canvasBuf[dstIdx + 3] = 255;
          }
        }
      }
    }

    const outPath = `assets/sprites/dino_run_${fIdx}.png`;
    await sharp(canvasBuf, { raw: { width: canvasW, height: canvasH, channels: 4 } })
      .png()
      .toFile(outPath);
    console.log(`Saved ${outPath}`);
    extractedCanvases.push(outPath);
  }

  // Create preview montage of all 8 frames
  const montageComposites = extractedCanvases.map((p, i) => ({
    input: p,
    left: i * 128,
    top: 0
  }));

  await sharp({
    create: {
      width: 128 * 8,
      height: 112,
      channels: 4,
      background: { r: 100, g: 150, b: 200, alpha: 1 }
    }
  })
  .composite(montageComposites)
  .toFile('preview_8_run_frames.png');

  console.log('Montage created: preview_8_run_frames.png');
}

extract8RunFrames().catch(console.error);
