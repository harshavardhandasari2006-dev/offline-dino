const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function extractRefined() {
  const refImg = sharp('assets/style1_reference.jpg');
  const { data, info } = await refImg.raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [data[idx], data[idx + 1], data[idx + 2]];
  }

  function segmentFrame({ minX, maxX, minY, maxY, groundY, bellyYMin, bellyYMax, isDead = false, isDuck = false }) {
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const mask = new Uint8Array(cropW * cropH); // 0=unknown, 1=bg, 2=fg

    function isFg(x, y) {
      if (y > groundY) return false;
      const [r, g, b] = getPixel(x, y);

      // Sky/cloud exclusion
      if (b > r + 15 && b > 180) return false;
      if (r > 215 && g > 220 && b > 230) return false; // cloud
      if (r > 235 && g > 235 && b > 235 && (y < minY + 30 || x < minX + 25)) return false; // white cloud top/left

      // Green skin (vibrant, shadow, highlight, or dark outlines)
      if (g >= r && g > b + 5 && g > 40) return true;
      if (g > r + 5 && g > b) return true;
      if (g > 95 && g > r && g > b + 15) return true;
      if (r > 75 && g > 135 && b < 125 && g > r + 15) return true;

      // Spines, pupil, dark outlines, nostrils
      if (r < 75 && g < 85 && b < 75 && (r > 10 || g > 10 || b > 10)) return true;

      // Red/pink tongue, mouth interior
      if (r > 130 && g < 115 && b < 125 && r > g + 20) return true;
      if (r > 90 && r < 155 && g < 55 && b < 65) return true;

      // Cream underbelly / throat / lower jaw
      if (y >= bellyYMin && y <= bellyYMax && x >= minX + 20) {
        if (r > 165 && g > 155 && b < 205 && Math.abs(r - g) < 42 && r > b + 15) return true;
      }

      // Eye sclera
      if (r > 210 && g > 210 && b > 195 && y < bellyYMin + 40 && !isDuck) {
        // Enclosed in head
        return true;
      }

      // Claws / toes near ground
      if (y >= groundY - 8 && y <= groundY) {
        if (r > 190 && g > 185 && b > 150 && (g > b + 8 || r > b + 8)) {
          // Check proximity to green foot
          for (let dy = -3; dy <= 1; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
              const [pr, pg, pb] = getPixel(x + dx, y + dy);
              if (pg > pr + 12 && pg > pb + 12) return true;
            }
          }
        }
      }

      // Dead dino stars & spiral dizziness
      if (isDead) {
        // Yellow star
        if (r > 190 && g > 160 && b < 110) return true;
        // Black spiral lines
        if (r < 80 && g < 80 && b < 80) return true;
      }

      return false;
    }

    // Flood fill background from 4 edges
    const queue = [];
    for (let x = 0; x < cropW; x++) {
      mask[0 * cropW + x] = 1;
      queue.push([x, 0]);
      mask[(cropH - 1) * cropW + x] = 1;
      queue.push([x, cropH - 1]);
    }
    for (let y = 0; y < cropH; y++) {
      mask[y * cropW + 0] = 1;
      queue.push([0, y]);
      mask[y * cropW + (cropW - 1)] = 1;
      queue.push([cropW - 1, y]);

      const absY = minY + y;
      if (absY >= groundY) {
        for (let x = 0; x < cropW; x++) {
          const idx = y * cropW + x;
          if (!isFg(minX + x, absY)) {
            mask[idx] = 1;
            queue.push([x, y]);
          }
        }
      }
    }

    let head = 0;
    while (head < queue.length) {
      const [cx, cy] = queue[head++];
      const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= cropW || ny < 0 || ny >= cropH) continue;
        const nIdx = ny * cropW + nx;
        if (mask[nIdx] !== 0) continue;

        const absX = minX + nx;
        const absY = minY + ny;
        if (isFg(absX, absY)) continue;

        mask[nIdx] = 1;
        queue.push([nx, ny]);
      }
    }

    // Interior inversion: 0 becomes 2 (foreground)
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 0) mask[i] = 2;
    }

    // Connected component analysis on foreground
    // Keep main body, plus dead star/spiral if isDead
    const labels = new Int32Array(cropW * cropH).fill(-1);
    const compSizes = [];
    let currentLabel = 0;

    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        if (mask[idx] === 2 && labels[idx] === -1) {
          let size = 0;
          const q = [idx];
          labels[idx] = currentLabel;
          let qH = 0;
          while (qH < q.length) {
            const cur = q[qH++];
            size++;
            const qx = cur % cropW, qy = Math.floor(cur / cropW);
            const nbrs = [[qx + 1, qy], [qx - 1, qy], [qx, qy + 1], [qx, qy - 1]];
            for (const [nx, ny] of nbrs) {
              if (nx >= 0 && nx < cropW && ny >= 0 && ny < cropH) {
                const nIdx = ny * cropW + nx;
                if (mask[nIdx] === 2 && labels[nIdx] === -1) {
                  labels[nIdx] = currentLabel;
                  q.push(nIdx);
                }
              }
            }
          }
          compSizes.push(size);
          currentLabel++;
        }
      }
    }

    let maxIdx = 0, maxSize = 0;
    for (let i = 0; i < compSizes.length; i++) {
      if (compSizes[i] > maxSize) {
        maxSize = compSizes[i];
        maxIdx = i;
      }
    }

    // Filter mask: only keep main component (and dead stars)
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        const lbl = labels[idx];
        if (lbl === maxIdx) {
          mask[idx] = 2;
        } else if (isDead && lbl !== -1 && y < cropH * 0.45 && compSizes[lbl] >= 8) {
          mask[idx] = 2;
        } else {
          mask[idx] = 1;
        }
      }
    }

    // Antialiasing alpha buffer
    const outBuf = Buffer.alloc(cropW * cropH * 4);
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        const outIdx = idx * 4;
        if (mask[idx] === 2) {
          let bgCount = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const qx = x + dx, qy = y + dy;
              if (qx < 0 || qx >= cropW || qy < 0 || qy >= cropH || mask[qy * cropW + qx] === 1) {
                bgCount++;
              }
            }
          }
          const [r, g, b] = getPixel(minX + x, minY + y);
          outBuf[outIdx] = r;
          outBuf[outIdx + 1] = g;
          outBuf[outIdx + 2] = b;
          outBuf[outIdx + 3] = bgCount > 0 ? Math.max(130, 255 - bgCount * 22) : 255;
        }
      }
    }

    return { buf: outBuf, width: cropW, height: cropH };
  }

  async function saveTrimmed(res, filePath) {
    const trimmed = await sharp(res.buf, { raw: { width: res.width, height: res.height, channels: 4 } })
      .trim()
      .raw()
      .toBuffer({ resolveWithObject: true });

    await sharp(trimmed.data, { raw: { width: trimmed.info.width, height: trimmed.info.height, channels: 4 } })
      .png()
      .toFile(filePath);

    console.log(`Saved ${path.basename(filePath)} (${trimmed.info.width}x${trimmed.info.height})`);
  }

  const outDir = 'assets/sprites';

  // 1. RUN FRAMES
  const runConfigs = [
    { minX: 494, maxX: 593, minY: 200, maxY: 295, groundY: 291, bellyYMin: 220, bellyYMax: 278 },
    { minX: 601, maxX: 694, minY: 200, maxY: 296, groundY: 293, bellyYMin: 220, bellyYMax: 280 },
    { minX: 708, maxX: 798, minY: 200, maxY: 295, groundY: 292, bellyYMin: 220, bellyYMax: 278 },
    { minX: 810, maxX: 906, minY: 200, maxY: 295, groundY: 290, bellyYMin: 220, bellyYMax: 278 },
    { minX: 918, maxX: 1014, minY: 200, maxY: 296, groundY: 293, bellyYMin: 220, bellyYMax: 280 }
  ];

  for (let i = 0; i < runConfigs.length; i++) {
    const res = segmentFrame(runConfigs[i]);
    await saveTrimmed(res, path.join(outDir, `dino_run_${i}.png`));
  }

  // 2. JUMP FRAMES
  const jumpConfigs = [
    { minX: 20, maxX: 100, minY: 408, maxY: 483, groundY: 479, bellyYMin: 420, bellyYMax: 470 }, // Take off
    { minX: 124, maxX: 200, minY: 375, maxY: 462, groundY: 459, bellyYMin: 390, bellyYMax: 450 }, // Ascending
    { minX: 228, maxX: 304, minY: 360, maxY: 444, groundY: 441, bellyYMin: 370, bellyYMax: 430 }, // In air
    { minX: 320, maxX: 403, minY: 395, maxY: 468, groundY: 465, bellyYMin: 400, bellyYMax: 455 }, // Descending
    { minX: 416, maxX: 501, minY: 412, maxY: 483, groundY: 479, bellyYMin: 425, bellyYMax: 472 }  // Landing
  ];

  for (let i = 0; i < jumpConfigs.length; i++) {
    const res = segmentFrame(jumpConfigs[i]);
    await saveTrimmed(res, path.join(outDir, `dino_jump_${i}.png`));
  }

  // 3. DUCK FRAMES (CLOSED EYES)
  const duckConfigs = [
    { minX: 526, maxX: 614, minY: 390, maxY: 478, groundY: 475, bellyYMin: 410, bellyYMax: 465, isDuck: false }, // Before duck
    { minX: 630, maxX: 719, minY: 420, maxY: 478, groundY: 475, bellyYMin: 430, bellyYMax: 470, isDuck: true },  // Start duck
    { minX: 732, maxX: 818, minY: 426, maxY: 478, groundY: 475, bellyYMin: 435, bellyYMax: 470, isDuck: true },  // Ducking
    { minX: 834, maxX: 915, minY: 432, maxY: 478, groundY: 475, bellyYMin: 440, bellyYMax: 470, isDuck: true }   // Continue duck
  ];

  for (let i = 0; i < duckConfigs.length; i++) {
    const res = segmentFrame(duckConfigs[i]);
    await saveTrimmed(res, path.join(outDir, `dino_duck_${i}.png`));
  }

  // 4. IDLE FRAMES
  const idleConfigs = [
    { minX: 14, maxX: 125, minY: 194, maxY: 304, groundY: 300, bellyYMin: 220, bellyYMax: 285 },
    { minX: 126, maxX: 237, minY: 194, maxY: 304, groundY: 301, bellyYMin: 220, bellyYMax: 285 },
    { minX: 236, maxX: 339, minY: 194, maxY: 304, groundY: 300, bellyYMin: 220, bellyYMax: 285 },
    { minX: 351, maxX: 459, minY: 194, maxY: 304, groundY: 301, bellyYMin: 220, bellyYMax: 285 }
  ];

  for (let i = 0; i < idleConfigs.length; i++) {
    const res = segmentFrame(idleConfigs[i]);
    await saveTrimmed(res, path.join(outDir, `dino_idle_${i}.png`));
  }

  // 5. COLLISION & DEAD
  const hitRes = segmentFrame({ minX: 112, maxX: 196, minY: 560, maxY: 638, groundY: 634, bellyYMin: 575, bellyYMax: 625 });
  await saveTrimmed(hitRes, path.join(outDir, 'dino_hit.png'));

  const deadRes = segmentFrame({ minX: 250, maxX: 370, minY: 565, maxY: 638, groundY: 634, bellyYMin: 580, bellyYMax: 630, isDead: true, isDuck: true });
  await saveTrimmed(deadRes, path.join(outDir, 'dino_dead.png'));

  console.log('Extraction complete!');
}

extractRefined();
