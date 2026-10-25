const sharp = require('sharp');
const fs = require('fs');

async function extractFlawless8Run() {
  const { data, info } = await sharp('crop_running_8_frames.png').raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [data[idx], data[idx + 1], data[idx + 2]];
  }

  function isDinoPixel(x, y) {
    if (y < 25 || y > 136) return false;
    const [r, g, b] = getPixel(x, y);

    // Checkerboard background
    if (r > 195 && g > 195 && b > 195 && Math.abs(r - g) < 14 && Math.abs(g - b) < 14) return false;

    // Number badge at bottom
    if (y > 132 && r < 40 && g < 50 && b < 70) return false;

    return true;
  }

  const seeds = [
    [60, 55],
    [144, 55],
    [228, 55],
    [312, 55],
    [396, 55],
    [480, 55],
    [564, 55],
    [645, 55]
  ];

  const extractedSprites = [];

  for (let fIdx = 0; fIdx < 8; fIdx++) {
    const [sx, sy] = seeds[fIdx];
    const visited = new Uint8Array(W * H);
    const queue = [[sx, sy]];
    visited[sy * W + sx] = 1;

    let minX = W, maxX = 0, minY = H, maxY = 0;

    let head = 0;
    while (head < queue.length) {
      const [cx, cy] = queue[head++];
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;

      for (const [dx, dy] of [[1,0], [-1,0], [0,1], [0,-1], [1,1], [-1,-1], [1,-1], [-1,1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
          const nIdx = ny * W + nx;
          if (visited[nIdx] === 0 && isDinoPixel(nx, ny)) {
            visited[nIdx] = 1;
            queue.push([nx, ny]);
          }
        }
      }
    }

    const dinoW = maxX - minX + 1;
    const dinoH = maxY - minY + 1;
    console.log(`Frame ${fIdx}: x=[${minX}..${maxX}] (${dinoW}x${dinoH})`);

    // Target 128x112 canonical canvas
    const canvasW = 128;
    const canvasH = 112;
    const canvasBuf = Buffer.alloc(canvasW * canvasH * 4, 0);

    // Baseline ground sole in reference is y=136.
    // In canonical canvas, ground sole is y=103.
    // So canvasY = y - (136 - 103) = y - 33.
    // For horizontal alignment, center of dino at canvas x=64:
    const charCenterX = (minX + maxX) / 2;
    const offsetX = Math.round(64 - charCenterX);
    const offsetY = -33;

    for (let y = minY - 1; y <= maxY + 1; y++) {
      for (let x = minX - 1; x <= maxX + 1; x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;

        const isInside = visited[y * W + x] === 1;
        let alpha = 0;
        let r, g, b;

        if (isInside) {
          alpha = 255;
          [r, g, b] = getPixel(x, y);

          // Check if it's on the outer edge touching background
          let isEdge = false;
          for (const [dx, dy] of [[1,0], [-1,0], [0,1], [0,-1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H || visited[ny * W + nx] === 0) {
              isEdge = true;
              break;
            }
          }

          if (isEdge) {
            // Anti-alias edge: soften dark outline so there is no white fringe or harsh edge
            alpha = 230;
          }
        } else {
          // Check if adjacent to inside (smooth 1px anti-aliased transition)
          let neighborCount = 0;
          let sumR = 0, sumG = 0, sumB = 0;
          for (const [dx, dy] of [[1,0], [-1,0], [0,1], [0,-1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < W && ny >= 0 && ny < H && visited[ny * W + nx] === 1) {
              neighborCount++;
              const [nr, ng, nb] = getPixel(nx, ny);
              sumR += nr;
              sumG += ng;
              sumB += nb;
            }
          }

          if (neighborCount > 0) {
            // 1-pixel soft feathered outline boundary matching the dark border color
            r = Math.round(sumR / neighborCount);
            g = Math.round(sumG / neighborCount);
            b = Math.round(sumB / neighborCount);
            // Tint to dark dinosaur outline border
            r = Math.min(r, 45);
            g = Math.min(g, 55);
            b = Math.min(b, 45);
            alpha = Math.round((neighborCount / 4.0) * 140);
          }
        }

        if (alpha > 0) {
          const dstX = x + offsetX;
          const dstY = y + offsetY;

          if (dstX >= 0 && dstX < canvasW && dstY >= 0 && dstY < canvasH) {
            const dstIdx = (dstY * canvasW + dstX) * 4;
            canvasBuf[dstIdx] = r;
            canvasBuf[dstIdx + 1] = g;
            canvasBuf[dstIdx + 2] = b;
            canvasBuf[dstIdx + 3] = alpha;
          }
        }
      }
    }

    const outPath = `assets/sprites/dino_run_${fIdx}.png`;
    await sharp(canvasBuf, { raw: { width: canvasW, height: canvasH, channels: 4 } })
      .png()
      .toFile(outPath);
    console.log(`Saved ${outPath}`);
    extractedSprites.push(outPath);
  }

  // Generate 8-frame composite strip
  const stripComposites = extractedSprites.map((p, i) => ({
    input: p,
    left: i * 128,
    top: 0
  }));

  await sharp({
    create: {
      width: 128 * 8,
      height: 112,
      channels: 4,
      background: { r: 100, g: 150, b: 200, alpha: 1 } // Sky blue background for inspection
    }
  })
  .composite(stripComposites)
  .toFile('flawless_8_run_strip.png');

  console.log('Created flawless_8_run_strip.png');
}

extractFlawless8Run().catch(console.error);
