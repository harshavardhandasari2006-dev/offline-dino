const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function main() {
  const refImg = sharp('assets/style1_reference.jpg');
  const { data, info } = await refImg.raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [data[idx], data[idx + 1], data[idx + 2]];
  }

  // Helper to extract a single sprite given its bounding box and ground baseline
  function extractSprite({ minX, maxX, minY, maxY, baselineY, isCactus = false, isPtero = false, isDead = false }) {
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const mask = new Uint8Array(cropW * cropH); // 0=unknown, 1=bg, 2=fg

    // Helper: is definite foreground (dino or obstacle)
    function isFg(r, g, b, y) {
      if (isCactus) {
        // Green cactus body or red/orange flower
        if (g > r + 15 && g > b + 15 && g > 60) return true;
        // Outline or dark ribs
        if (r < 60 && g < 90 && b < 60 && g >= r && g >= b) return true;
        // Orange/red flower on top
        if (r > 160 && r > b + 50 && (g > 50 || g < 120) && y < minY + 30) return true;
        // Yellow flower tip
        if (r > 200 && g > 160 && b < 100 && y < minY + 30) return true;
        return false;
      }

      if (isPtero) {
        // Brown/tan body, wings, orange beak/wingtips
        if (r > 110 && g > 60 && b < 100 && r > b + 25) return true;
        if (r < 70 && g < 50 && b < 50) return true; // dark eye/feet
        if (r > 170 && g > 130 && b > 80 && r > b + 30) return true; // wing membrane
        return false;
      }

      // Green dino skin
      if (g > r + 12 && g > b + 12 && g > 55) return true;
      if (g > 100 && g > r && g > b + 20) return true;
      // Highlight green on head/back
      if (r > 100 && g > 160 && b < 120 && g > r + 20) return true;
      // Dark spine / eye pupil / dark outline / nostril
      if (r < 75 && g < 85 && b < 75) return true;
      // Red mouth / pink tongue
      if (r > 130 && g < 110 && b < 120 && r > g + 25) return true;
      // Cream belly / lower jaw (R & G high, B lower)
      if (r > 180 && g > 170 && b < 195 && Math.abs(r - g) < 35 && r > b + 20) return true;
      // White eye sclera / toe claws
      if (r > 210 && g > 210 && b > 200 && y < baselineY + 2) {
        // Only if not sky (sky has B > R + 15) and not distant mesa
        if (b < r + 10 && b < g + 10) return true;
      }
      // Dead dino stars & dizzy eyes
      if (isDead) {
        // Yellow star
        if (r > 200 && g > 170 && b < 100) return true;
        // Black spiral lines
        if (r < 80 && g < 80 && b < 80) return true;
      }

      return false;
    }

    // Seed background queue from borders
    const queue = [];
    for (let x = 0; x < cropW; x++) {
      queue.push([x, 0]);
      mask[0 * cropW + x] = 1;
      queue.push([x, cropH - 1]);
      mask[(cropH - 1) * cropW + x] = 1;
    }
    for (let y = 0; y < cropH; y++) {
      queue.push([0, y]);
      mask[y * cropW + 0] = 1;
      queue.push([cropW - 1, y]);
      mask[y * cropW + (cropW - 1)] = 1;
    }

    // Also seed from bottom rows below baseline if they are ground
    for (let y = cropH - 1; y >= 0; y--) {
      const absY = minY + y;
      if (absY > baselineY + 1) {
        for (let x = 0; x < cropW; x++) {
          const idx = y * cropW + x;
          if (mask[idx] === 0) {
            const [r, g, b] = getPixel(minX + x, absY);
            if (!isFg(r, g, b, absY)) {
              mask[idx] = 1;
              queue.push([x, y]);
            }
          }
        }
      }
    }

    // BFS Flood fill
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
        const [r, g, b] = getPixel(absX, absY);

        if (isFg(r, g, b, absY)) {
          // Stop at foreground boundary
          continue;
        }

        mask[nIdx] = 1;
        queue.push([nx, ny]);
      }
    }

    // Clean up small stray pixels / background noise
    // Any unmasked pixel is foreground (mask = 2)
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        if (mask[idx] === 0) {
          mask[idx] = 2;
        }
      }
    }

    // Ground line cleanup: below baselineY, remove any non-green/non-claw pixels
    for (let y = 0; y < cropH; y++) {
      const absY = minY + y;
      if (absY > baselineY) {
        for (let x = 0; x < cropW; x++) {
          const idx = y * cropW + x;
          if (mask[idx] === 2) {
            const [r, g, b] = getPixel(minX + x, absY);
            // If it's ground peach or ground shadow or white label
            const isGreen = (g > r + 15 && g > b + 15);
            const isClaw = (r > 210 && g > 200 && b > 160 && absY <= baselineY + 3);
            if (!isGreen && !isClaw) {
              mask[idx] = 1;
            }
          }
        }
      }
    }

    // Build 32-bit RGBA image
    const outBuf = Buffer.alloc(cropW * cropH * 4);
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        const outIdx = idx * 4;
        const absX = minX + x;
        const absY = minY + y;
        const [r, g, b] = getPixel(absX, absY);

        if (mask[idx] === 2) {
          outBuf[outIdx] = r;
          outBuf[outIdx + 1] = g;
          outBuf[outIdx + 2] = b;
          outBuf[outIdx + 3] = 255;
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

  // Definitions of all sprites to extract from reference image
  // Baselines: Panel 1&2 (Idle & Run) ground at y=308; Panel 3&4 (Jump & Duck) ground at y=488; Panel 5&6 (Collision & Obstacles) ground at y=642
  const runFrames = [
    { minX: 494, maxX: 593, minY: 200, maxY: 312, baselineY: 308 },
    { minX: 599, maxX: 695, minY: 200, maxY: 312, baselineY: 308 },
    { minX: 706, maxX: 798, minY: 200, maxY: 312, baselineY: 308 },
    { minX: 808, maxX: 907, minY: 200, maxY: 312, baselineY: 308 },
    { minX: 917, maxX: 1016, minY: 200, maxY: 312, baselineY: 308 }
  ];

  const jumpFrames = [
    { minX: 20, maxX: 100, minY: 400, maxY: 492, baselineY: 488 }, // Take off
    { minX: 124, maxX: 200, minY: 375, maxY: 490, baselineY: 488 }, // Ascending
    { minX: 228, maxX: 304, minY: 360, maxY: 475, baselineY: 488 }, // In air
    { minX: 320, maxX: 403, minY: 375, maxY: 490, baselineY: 488 }, // Descending
    { minX: 416, maxX: 501, minY: 400, maxY: 492, baselineY: 488 }  // Landing
  ];

  const duckFrames = [
    { minX: 526, maxX: 614, minY: 395, maxY: 492, baselineY: 488 }, // Before duck
    { minX: 630, maxX: 719, minY: 435, maxY: 492, baselineY: 488 }, // Start duck
    { minX: 732, maxX: 818, minY: 442, maxY: 492, baselineY: 488 }, // Ducking
    { minX: 834, maxX: 915, minY: 448, maxY: 492, baselineY: 488 }, // Continue duck
    { minX: 931, maxX: 1016, minY: 395, maxY: 492, baselineY: 488 } // Stand up
  ];

  const idleFrames = [
    { minX: 14, maxX: 125, minY: 190, maxY: 312, baselineY: 308 },
    { minX: 126, maxX: 237, minY: 190, maxY: 312, baselineY: 308 },
    { minX: 236, maxX: 339, minY: 190, maxY: 312, baselineY: 308 },
    { minX: 351, maxX: 459, minY: 190, maxY: 312, baselineY: 308 }
  ];

  const collisionFrames = [
    { name: 'dino_hit', minX: 112, maxX: 196, minY: 545, maxY: 646, baselineY: 642 },
    { name: 'dino_dead', minX: 250, maxX: 370, minY: 550, maxY: 646, baselineY: 642, isDead: true }
  ];

  const cactusObstacles = [
    { name: 'cactus_double', minX: 427, maxX: 468, minY: 552, maxY: 646, baselineY: 642, isCactus: true },
    { name: 'cactus_tall', minX: 474, maxX: 510, minY: 552, maxY: 646, baselineY: 642, isCactus: true },
    { name: 'cactus_large', minX: 510, maxX: 552, minY: 548, maxY: 646, baselineY: 642, isCactus: true },
    { name: 'cactus_small', minX: 569, maxX: 600, minY: 574, maxY: 646, baselineY: 642, isCactus: true }
  ];

  const pterodactyl = { name: 'pterodactyl_0', minX: 630, maxX: 712, minY: 552, maxY: 630, baselineY: 642, isPtero: true };

  // Output directory
  const outDir = 'assets/sprites_clean';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Process Run Frames
  for (let i = 0; i < runFrames.length; i++) {
    const res = extractSprite(runFrames[i]);
    await sharp(res.buf, { raw: { width: res.width, height: res.height, channels: 4 } })
      .png()
      .toFile(path.join(outDir, `dino_run_${i}.png`));
    console.log(`Saved dino_run_${i}.png (${res.width}x${res.height})`);
  }

  // Process Jump Frames
  for (let i = 0; i < jumpFrames.length; i++) {
    const res = extractSprite(jumpFrames[i]);
    await sharp(res.buf, { raw: { width: res.width, height: res.height, channels: 4 } })
      .png()
      .toFile(path.join(outDir, `dino_jump_${i}.png`));
    console.log(`Saved dino_jump_${i}.png (${res.width}x${res.height})`);
  }

  // Process Duck Frames
  for (let i = 0; i < duckFrames.length; i++) {
    const res = extractSprite(duckFrames[i]);
    await sharp(res.buf, { raw: { width: res.width, height: res.height, channels: 4 } })
      .png()
      .toFile(path.join(outDir, `dino_duck_${i}.png`));
    console.log(`Saved dino_duck_${i}.png (${res.width}x${res.height})`);
  }

  // Process Idle Frames
  for (let i = 0; i < idleFrames.length; i++) {
    const res = extractSprite(idleFrames[i]);
    await sharp(res.buf, { raw: { width: res.width, height: res.height, channels: 4 } })
      .png()
      .toFile(path.join(outDir, `dino_idle_${i}.png`));
    console.log(`Saved dino_idle_${i}.png (${res.width}x${res.height})`);
  }

  // Process Collision Frames
  for (const c of collisionFrames) {
    const res = extractSprite(c);
    await sharp(res.buf, { raw: { width: res.width, height: res.height, channels: 4 } })
      .png()
      .toFile(path.join(outDir, `${c.name}.png`));
    console.log(`Saved ${c.name}.png (${res.width}x${res.height})`);
  }

  // Process Cacti
  for (const c of cactusObstacles) {
    const res = extractSprite(c);
    await sharp(res.buf, { raw: { width: res.width, height: res.height, channels: 4 } })
      .png()
      .toFile(path.join(outDir, `${c.name}.png`));
    console.log(`Saved ${c.name}.png (${res.width}x${res.height})`);
  }

  // Process Pterodactyl
  const pRes = extractSprite(pterodactyl);
  await sharp(pRes.buf, { raw: { width: pRes.width, height: pRes.height, channels: 4 } })
    .png()
    .toFile(path.join(outDir, `${pterodactyl.name}.png`));
  console.log(`Saved ${pterodactyl.name}.png (${pRes.width}x${pRes.height})`);

  console.log('All extractions complete!');
}

main();
