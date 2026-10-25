const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function extractTurnaround() {
  console.log('--- Extracting Canonical 7 Turnaround Frames ---');
  // Crop the turnaround panel from master reference
  // In assets/dino_skin_variations_reference.jpg (1024x682):
  // Turnaround panel is at left: 0, top: 515, width: 512, height: 167
  const { data, info } = await sharp('assets/dino_skin_variations_reference.jpg')
    .extract({ left: 0, top: 515, width: 512, height: 167 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const ranges = [
    { startX: 8, endX: 71, name: 'dino_turn_0' },   // 0: Profile Right
    { startX: 76, endX: 138, name: 'dino_turn_1' }, // 1: Back-Right 3/4
    { startX: 152, endX: 203, name: 'dino_turn_2' },// 2: Rear-Right
    { startX: 227, endX: 267, name: 'dino_turn_3' },// 3: Direct Back (Spine & Tail)
    { startX: 294, endX: 349, name: 'dino_turn_4' },// 4: Rear-Left
    { startX: 361, endX: 424, name: 'dino_turn_5' },// 5: Back-Left 3/4
    { startX: 430, endX: 491, name: 'dino_turn_6' } // 6: Profile Left
  ];

  const targetW = 128;
  const targetH = 112;
  const targetBaseline = 103;

  for (let i = 0; i < ranges.length; i++) {
    const { startX, endX, name } = ranges[i];
    // Find accurate bounding box
    let minX = endX, maxX = startX, minY = 135, maxY = 35;
    for (let y = 45; y <= 130; y++) {
      for (let x = startX; x <= endX; x++) {
        const idx = (y * info.width + x) * 3;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        const isBg = (r > 200 && g > 200 && b > 200 && Math.abs(r - g) < 22 && Math.abs(g - b) < 22);
        if (!isBg) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const cropBuf = Buffer.alloc(cropW * cropH * 4);

    // Exterior flood fill from boundaries
    const isSolid = new Uint8Array(cropW * cropH);
    for (let cy = 0; cy < cropH; cy++) {
      const srcY = minY + cy;
      for (let cx = 0; cx < cropW; cx++) {
        const srcX = minX + cx;
        const srcIdx = (srcY * info.width + srcX) * 3;
        const r = data[srcIdx], g = data[srcIdx + 1], b = data[srcIdx + 2];

        // Background check (checkerboard pattern: pale grey/white, neutral hue)
        const isBg = (r > 205 && g > 205 && b > 205 && Math.abs(r - g) < 22 && Math.abs(g - b) < 22);
        // Ground shadow (very pale grey-blue directly under feet at bottom 3 rows)
        const isGroundShadow = (cy >= cropH - 3 && r > 180 && g > 180 && b > 180 && Math.abs(r - g) < 20);

        if (!isBg && !isGroundShadow) {
          isSolid[cy * cropW + cx] = 1;
        }
      }
    }

    // Flood fill background from borders
    const isBgFilled = new Uint8Array(cropW * cropH);
    const queue = [];

    // Push border pixels
    for (let cx = 0; cx < cropW; cx++) {
      if (!isSolid[cx]) { isBgFilled[cx] = 1; queue.push(cx); }
      const bottomIdx = (cropH - 1) * cropW + cx;
      if (!isSolid[bottomIdx]) { isBgFilled[bottomIdx] = 1; queue.push(bottomIdx); }
    }
    for (let cy = 0; cy < cropH; cy++) {
      const leftIdx = cy * cropW;
      if (!isSolid[leftIdx]) { isBgFilled[leftIdx] = 1; queue.push(leftIdx); }
      const rightIdx = cy * cropW + (cropW - 1);
      if (!isSolid[rightIdx]) { isBgFilled[rightIdx] = 1; queue.push(rightIdx); }
    }

    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];
      const cx = curr % cropW;
      const cy = Math.floor(curr / cropW);
      const neighbors = [
        [cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]
      ];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < cropW && ny >= 0 && ny < cropH) {
          const nIdx = ny * cropW + nx;
          if (!isSolid[nIdx] && !isBgFilled[nIdx]) {
            isBgFilled[nIdx] = 1;
            queue.push(nIdx);
          }
        }
      }
    }

    // Populate cropBuf with RGBA
    for (let cy = 0; cy < cropH; cy++) {
      const srcY = minY + cy;
      for (let cx = 0; cx < cropW; cx++) {
        const srcX = minX + cx;
        const pIdx = cy * cropW + cx;
        const dstIdx = pIdx * 4;
        const srcIdx = (srcY * info.width + srcX) * 3;

        if (isBgFilled[pIdx]) {
          cropBuf[dstIdx + 3] = 0; // Transparent background
        } else {
          cropBuf[dstIdx] = data[srcIdx];
          cropBuf[dstIdx + 1] = data[srcIdx + 1];
          cropBuf[dstIdx + 2] = data[srcIdx + 2];
          cropBuf[dstIdx + 3] = 255;
        }
      }
    }

    // Now scale the isolated character so that its height matches standard dino height (~96px)
    // Scale factor
    const scale = 98.0 / cropH;
    const scaledW = Math.round(cropW * scale);
    const scaledH = Math.round(cropH * scale);

    const scaledBuf = await sharp(cropBuf, { raw: { width: cropW, height: cropH, channels: 4 } })
      .resize(scaledW, scaledH, { kernel: 'lanczos3' })
      .raw()
      .toBuffer();

    // Composite onto canonical 128x112 canvas with feet planted at baseline y = 103
    const finalCanvas = Buffer.alloc(targetW * targetH * 4);
    const placeX = Math.round((targetW - scaledW) / 2);
    const placeY = targetBaseline - scaledH;

    for (let sy = 0; sy < scaledH; sy++) {
      const dy = placeY + sy;
      if (dy < 0 || dy >= targetH) continue;
      for (let sx = 0; sx < scaledW; sx++) {
        const dx = placeX + sx;
        if (dx < 0 || dx >= targetW) continue;
        const sIdx = (sy * scaledW + sx) * 4;
        const dIdx = (dy * targetW + dx) * 4;
        const alpha = scaledBuf[sIdx + 3];
        if (alpha > 20) {
          finalCanvas[dIdx] = scaledBuf[sIdx];
          finalCanvas[dIdx + 1] = scaledBuf[sIdx + 1];
          finalCanvas[dIdx + 2] = scaledBuf[sIdx + 2];
          finalCanvas[dIdx + 3] = alpha;
        }
      }
    }

    const outPath = path.join(__dirname, 'assets', 'sprites', name + '.png');
    await sharp(finalCanvas, { raw: { width: targetW, height: targetH, channels: 4 } })
      .png()
      .toFile(outPath);
    console.log(`  ✓ Saved ${name}.png (128x112, feet anchored at y=${targetBaseline})`);
  }

  console.log('--- All 7 turnaround sprites extracted successfully! ---');
}

extractTurnaround().catch(err => {
  console.error(err);
  process.exit(1);
});
