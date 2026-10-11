const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function extractAllPerfectSprites() {
  const refImg = sharp('assets/style1_reference.jpg');
  const { data, info } = await refImg.raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [data[idx], data[idx + 1], data[idx + 2]];
  }

  // Segmentation function for a given bounding box
  function segmentDino({ minX, maxX, minY, maxY, groundCutoffY, isDead = false }) {
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const mask = new Uint8Array(cropW * cropH); // 0=unknown, 1=bg, 2=fg

    function isDefiniteFg(x, y) {
      if (y > groundCutoffY) return false; // Hard cutoff below feet / ground plane
      const [r, g, b] = getPixel(x, y);

      // Green skin (vibrant, shadow, highlight, or dark outlines)
      if (g > r + 10 && g > b + 10 && g > 50) return true;
      if (g > 100 && g > r && g > b + 20) return true;
      if (r > 90 && g > 150 && b < 130 && g > r + 15) return true;

      // Dark spines, eye pupils, dark outlines, nostrils
      if (r < 75 && g < 85 && b < 75 && (r > 15 || g > 15 || b > 15)) return true;

      // Red/pink tongue, mouth
      if (r > 130 && g < 115 && b < 125 && r > g + 20) return true;
      if (r > 90 && r < 150 && g < 50 && b < 60) return true; // dark mouth

      // Cream belly / lower jaw / throat (only within body y-range, above feet)
      if (y <= groundCutoffY - 2) {
        if (r > 180 && g > 170 && b < 200 && Math.abs(r - g) < 35 && r > b + 18) return true;
      }

      // White eye sclera / toe claws
      if (r > 210 && g > 210 && b > 190 && y <= groundCutoffY) {
        // Not sky (sky has b > r + 15)
        if (b < r + 10 && b < g + 10) return true;
      }

      // Dead dino stars & spiral dizziness
      if (isDead) {
        // Yellow star
        if (r > 200 && g > 170 && b < 110) return true;
        // Black spiral lines
        if (r < 80 && g < 80 && b < 80) return true;
      }

      return false;
    }

    // Identify all seeds for background:
    // All 4 borders of the crop box, plus any pixel below groundCutoffY
    const queue = [];
    for (let x = 0; x < cropW; x++) {
      // Top row
      mask[0 * cropW + x] = 1;
      queue.push([x, 0]);
      // Bottom row
      mask[(cropH - 1) * cropW + x] = 1;
      queue.push([x, cropH - 1]);
    }
    for (let y = 0; y < cropH; y++) {
      // Left col
      mask[y * cropW + 0] = 1;
      queue.push([0, y]);
      // Right col
      mask[y * cropW + (cropW - 1)] = 1;
      queue.push([cropW - 1, y]);

      // Seed all pixels at or below groundCutoffY
      const absY = minY + y;
      if (absY >= groundCutoffY) {
        for (let x = 0; x < cropW; x++) {
          const idx = y * cropW + x;
          if (mask[idx] === 0) {
            mask[idx] = 1;
            queue.push([x, y]);
          }
        }
      }
    }

    // BFS Flood fill for background
    let head = 0;
    while (head < queue.length) {
      const [cx, cy] = queue[head++];
      const neighbors = [
        [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]
      ];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= cropW || ny < 0 || ny >= cropH) continue;
        const nIdx = ny * cropW + nx;
        if (mask[nIdx] !== 0) continue;

        const absX = minX + nx;
        const absY = minY + ny;

        if (isDefiniteFg(absX, absY)) {
          // Foreground barrier
          continue;
        }

        mask[nIdx] = 1;
        queue.push([nx, ny]);
      }
    }

    // Now fill interior holes:
    // Anything not reached by background flood fill is foreground!
    // (This guarantees the cream belly, mouth, eyes, arms are 100% solid and have NO holes!)
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        if (mask[idx] === 0) {
          mask[idx] = 2; // solid foreground
        }
      }
    }

    // Soft antialiasing along boundary:
    // Create an alpha buffer with edge smoothing
    const alphaBuf = new Uint8Array(cropW * cropH);
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        if (mask[idx] === 2) {
          // Check if this foreground pixel touches background
          let bgNeighbors = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const qx = x + dx, qy = y + dy;
              if (qx < 0 || qx >= cropW || qy < 0 || qy >= cropH || mask[qy * cropW + qx] === 1) {
                bgNeighbors++;
              }
            }
          }
          if (bgNeighbors > 0) {
            alphaBuf[idx] = Math.max(140, 255 - bgNeighbors * 18);
          } else {
            alphaBuf[idx] = 255;
          }
        } else {
          alphaBuf[idx] = 0;
        }
      }
    }

    // Assemble RGBA buffer
    const outBuf = Buffer.alloc(cropW * cropH * 4);
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        const outIdx = idx * 4;
        const absX = minX + x;
        const absY = minY + y;
        const [r, g, b] = getPixel(absX, absY);
        const a = alphaBuf[idx];

        if (a > 0) {
          outBuf[outIdx] = r;
          outBuf[outIdx + 1] = g;
          outBuf[outIdx + 2] = b;
          outBuf[outIdx + 3] = a;
        } else {
          outBuf[outIdx] = 0;
          outBuf[outIdx + 1] = 0;
          outBuf[outIdx + 2] = 0;
          outBuf[outIdx + 3] = 0;
        }
      }
    }

    return { buf: outBuf, width: cropW, height: cropH };
  }

  // Helper to trim transparent borders while recording offsets
  async function trimSprite(buf, w, h) {
    const img = sharp(buf, { raw: { width: w, height: h, channels: 4 } });
    const trimmed = await img.trim().raw().toBuffer({ resolveWithObject: true });
    return {
      buf: trimmed.data,
      width: trimmed.info.width,
      height: trimmed.info.height
    };
  }

  const outDir = 'assets/sprites';

  // 1. RUN FRAMES (ground cutoff at y=294)
  const runBoxes = [
    { minX: 494, maxX: 593, minY: 200, maxY: 295, groundCutoffY: 293 },
    { minX: 601, maxX: 694, minY: 200, maxY: 296, groundCutoffY: 294 },
    { minX: 708, maxX: 798, minY: 200, maxY: 295, groundCutoffY: 293 },
    { minX: 810, maxX: 906, minY: 200, maxY: 295, groundCutoffY: 292 },
    { minX: 918, maxX: 1014, minY: 200, maxY: 296, groundCutoffY: 294 }
  ];

  for (let i = 0; i < runBoxes.length; i++) {
    const raw = segmentDino(runBoxes[i]);
    const trimmed = await trimSprite(raw.buf, raw.width, raw.height);
    await sharp(trimmed.buf, { raw: { width: trimmed.width, height: trimmed.height, channels: 4 } })
      .png()
      .toFile(path.join(outDir, `dino_run_${i}.png`));
    console.log(`Saved dino_run_${i}.png (${trimmed.width}x${trimmed.height})`);
  }

  // 2. JUMP FRAMES (ground cutoff at y=482)
  const jumpBoxes = [
    { minX: 20, maxX: 100, minY: 408, maxY: 483, groundCutoffY: 480 }, // Take off
    { minX: 124, maxX: 200, minY: 375, maxY: 462, groundCutoffY: 460 }, // Ascending
    { minX: 228, maxX: 304, minY: 360, maxY: 444, groundCutoffY: 442 }, // In air
    { minX: 320, maxX: 403, minY: 395, maxY: 468, groundCutoffY: 466 }, // Descending
    { minX: 416, maxX: 501, minY: 412, maxY: 483, groundCutoffY: 480 }  // Landing
  ];

  for (let i = 0; i < jumpBoxes.length; i++) {
    const raw = segmentDino(jumpBoxes[i]);
    const trimmed = await trimSprite(raw.buf, raw.width, raw.height);
    await sharp(trimmed.buf, { raw: { width: trimmed.width, height: trimmed.height, channels: 4 } })
      .png()
      .toFile(path.join(outDir, `dino_jump_${i}.png`));
    console.log(`Saved dino_jump_${i}.png (${trimmed.width}x${trimmed.height})`);
  }

  // 3. DUCK FRAMES (ground cutoff at y=478)
  const duckBoxes = [
    { minX: 526, maxX: 614, minY: 390, maxY: 478, groundCutoffY: 476 }, // Before duck
    { minX: 630, maxX: 719, minY: 420, maxY: 478, groundCutoffY: 476 }, // Start duck
    { minX: 732, maxX: 818, minY: 426, maxY: 478, groundCutoffY: 476 }, // Ducking (eyes closed)
    { minX: 834, maxX: 915, minY: 432, maxY: 478, groundCutoffY: 476 }  // Continue duck (eyes closed)
  ];

  for (let i = 0; i < duckBoxes.length; i++) {
    const raw = segmentDino(duckBoxes[i]);
    const trimmed = await trimSprite(raw.buf, raw.width, raw.height);
    await sharp(trimmed.buf, { raw: { width: trimmed.width, height: trimmed.height, channels: 4 } })
      .png()
      .toFile(path.join(outDir, `dino_duck_${i}.png`));
    console.log(`Saved dino_duck_${i}.png (${trimmed.width}x${trimmed.height})`);
  }

  // 4. IDLE FRAMES (ground cutoff at y=303)
  const idleBoxes = [
    { minX: 14, maxX: 125, minY: 194, maxY: 304, groundCutoffY: 302 },
    { minX: 126, maxX: 237, minY: 194, maxY: 304, groundCutoffY: 302 },
    { minX: 236, maxX: 339, minY: 194, maxY: 304, groundCutoffY: 302 },
    { minX: 351, maxX: 459, minY: 194, maxY: 304, groundCutoffY: 302 }
  ];

  for (let i = 0; i < idleBoxes.length; i++) {
    const raw = segmentDino(idleBoxes[i]);
    const trimmed = await trimSprite(raw.buf, raw.width, raw.height);
    await sharp(trimmed.buf, { raw: { width: trimmed.width, height: trimmed.height, channels: 4 } })
      .png()
      .toFile(path.join(outDir, `dino_idle_${i}.png`));
    console.log(`Saved dino_idle_${i}.png (${trimmed.width}x${trimmed.height})`);
  }

  // 5. COLLISION & DEAD FRAMES (ground cutoff at y=637)
  const hitRaw = segmentDino({ minX: 112, maxX: 196, minY: 560, maxY: 638, groundCutoffY: 636 });
  const hitTrim = await trimSprite(hitRaw.buf, hitRaw.width, hitRaw.height);
  await sharp(hitTrim.buf, { raw: { width: hitTrim.width, height: hitTrim.height, channels: 4 } })
    .png()
    .toFile(path.join(outDir, 'dino_hit.png'));
  console.log(`Saved dino_hit.png (${hitTrim.width}x${hitTrim.height})`);

  const deadRaw = segmentDino({ minX: 250, maxX: 370, minY: 565, maxY: 638, groundCutoffY: 636, isDead: true });
  const deadTrim = await trimSprite(deadRaw.buf, deadRaw.width, deadRaw.height);
  await sharp(deadTrim.buf, { raw: { width: deadTrim.width, height: deadTrim.height, channels: 4 } })
    .png()
    .toFile(path.join(outDir, 'dino_dead.png'));
  console.log(`Saved dino_dead.png (${deadTrim.width}x${deadTrim.height})`);

  // 6. CACTI
  // Copy clean cacti over
  fs.copyFileSync('assets/sprites_clean/cactus_double.png', path.join(outDir, 'cactus_double.png'));
  fs.copyFileSync('assets/sprites_clean/cactus_tall.png', path.join(outDir, 'cactus_tall.png'));
  fs.copyFileSync('assets/sprites_clean/cactus_large.png', path.join(outDir, 'cactus_single.png')); // single/flower
  fs.copyFileSync('assets/sprites_clean/cactus_small.png', path.join(outDir, 'cactus_small.png'));

  console.log('All sprites updated successfully!');
}

extractAllPerfectSprites();
