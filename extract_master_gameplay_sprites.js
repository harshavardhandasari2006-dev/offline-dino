const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function extractMasterGameplaySprites() {
  console.log('=== EXTRACTING MASTER GAMEPLAY SPRITES (SIDE VIEW ONLY) ===');

  const refPath = 'assets/dino_skin_variations_reference.jpg';
  const { data: refData, info: refInfo } = await sharp(refPath).raw().toBuffer({ resolveWithObject: true });
  const W = refInfo.width, H = refInfo.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [refData[idx], refData[idx + 1], refData[idx + 2]];
  }

  function extractComponent(seedX, seedY, cropTop, cropBottom, name) {
    function isDino(x, y) {
      if (y < cropTop || y > cropBottom) return false;
      const [r, g, b] = getPixel(x, y);

      // Checkerboard is light gray/white (neutral, high brightness)
      if (r > 195 && g > 195 && b > 195 && Math.abs(r - g) < 14 && Math.abs(g - b) < 14) return false;
      // Dark number box at bottom
      if (y > cropBottom - 4 && r < 40 && g < 50 && b < 70) return false;

      return true;
    }

    const visited = new Uint8Array(W * H);
    const queue = [[seedX, seedY]];
    visited[seedY * W + seedX] = 1;

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
          if (visited[nIdx] === 0 && isDino(nx, ny)) {
            visited[nIdx] = 1;
            queue.push([nx, ny]);
          }
        }
      }
    }

    console.log(`Extracted ${name}: ${queue.length} px, bounds: [${minX}..${maxX}], [${minY}..${maxY}]`);
    return { visited, minX, maxX, minY, maxY, count: queue.length };
  }

  function buildCanonicalSprite(comp, baselineRefY, targetCanvasY = 103) {
    const canvasW = 128;
    const canvasH = 112;
    const canvasBuf = Buffer.alloc(canvasW * canvasH * 4, 0);

    const charCenterX = (comp.minX + comp.maxX) / 2;
    const offsetX = Math.round(64 - charCenterX);
    const offsetY = targetCanvasY - baselineRefY;

    for (let y = comp.minY - 1; y <= comp.maxY + 1; y++) {
      for (let x = comp.minX - 1; x <= comp.maxX + 1; x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;

        const isInside = comp.visited[y * W + x] === 1;
        let alpha = 0;
        let r, g, b;

        if (isInside) {
          alpha = 255;
          [r, g, b] = getPixel(x, y);

          // Check if boundary pixel
          let isEdge = false;
          for (const [dx, dy] of [[1,0], [-1,0], [0,1], [0,-1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H || comp.visited[ny * W + nx] === 0) {
              isEdge = true;
              break;
            }
          }

          if (isEdge) {
            // Check for checkerboard halo ringing
            if (r > 130 && g > 130 && b > 130) {
              // Clamp to dark outline border
              r = 25; g = 40; b = 25;
              alpha = 200;
            } else {
              alpha = 230;
            }
          }
        } else {
          // Feathered boundary
          let neighborCount = 0;
          for (const [dx, dy] of [[1,0], [-1,0], [0,1], [0,-1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < W && ny >= 0 && ny < H && comp.visited[ny * W + nx] === 1) {
              neighborCount++;
            }
          }

          if (neighborCount > 0) {
            r = 25; g = 40; b = 25; // dark outline border
            alpha = Math.round((neighborCount / 4.0) * 130);
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

    return canvasBuf;
  }

  // 1. RUNNING ANIMATION (8 FRAMES)
  // Top: y=195, bottom: y=334 (relative to image)
  // Seeds: [x, y] in reference image
  // In reference image, panel is at top=195, so add 195 to cropY:
  // y in reference is 195 + crop_y
  const runSeeds = [
    [60, 195 + 55],
    [144, 195 + 55],
    [228, 195 + 55],
    [312, 195 + 55],
    [396, 195 + 55],
    [480, 195 + 55],
    [564, 195 + 55],
    [645, 195 + 55]
  ];

  for (let i = 0; i < 8; i++) {
    const comp = extractComponent(runSeeds[i][0], runSeeds[i][1], 195 + 25, 195 + 136, `run_${i}`);
    const buf = buildCanonicalSprite(comp, 195 + 136, 103);
    const outPath = `assets/sprites/dino_run_${i}.png`;
    await sharp(buf, { raw: { width: 128, height: 112, channels: 4 } }).png().toFile(outPath);
  }

  // 2. JUMP ANIMATION (6 FRAMES)
  // Panel top is y = 360, bottom is y = 360 + 136 = 496
  const jumpSeeds = [
    [50, 360 + 70],
    [130, 360 + 50],
    [200, 360 + 50],
    [260, 360 + 70],
    [330, 360 + 80],
    [390, 360 + 80]
  ];

  for (let i = 0; i < 6; i++) {
    const comp = extractComponent(jumpSeeds[i][0], jumpSeeds[i][1], 360 + 25, 360 + 136, `jump_${i}`);
    // Ground sole baseline for jump is y = 360 + 132
    const buf = buildCanonicalSprite(comp, 360 + 132, 103);
    const outPath = `assets/sprites/dino_jump_${i}.png`;
    await sharp(buf, { raw: { width: 128, height: 112, channels: 4 } }).png().toFile(outPath);
  }

  // 3. DUCK ANIMATION (4 FRAMES)
  // Panel top is y = 360, left is 410
  const duckSeeds = [
    [410 + 60, 360 + 70],
    [410 + 130, 360 + 80],
    [410 + 200, 360 + 80],
    [410 + 260, 360 + 80]
  ];

  for (let i = 0; i < 4; i++) {
    const comp = extractComponent(duckSeeds[i][0], duckSeeds[i][1], 360 + 25, 360 + 136, `duck_${i}`);
    const buf = buildCanonicalSprite(comp, 360 + 132, 103);
    const outPath = `assets/sprites/dino_duck_${i}.png`;
    await sharp(buf, { raw: { width: 128, height: 112, channels: 4 } }).png().toFile(outPath);
  }

  console.log('=== MASTER EXTRACTION COMPLETE ===');
}

extractMasterGameplaySprites().catch(console.error);
