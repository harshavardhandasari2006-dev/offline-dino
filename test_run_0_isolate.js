const sharp = require('sharp');

async function testRun0() {
  const { data, info } = await sharp('assets/style1_reference.jpg').raw().toBuffer({ resolveWithObject: true });
  const W = info.width;

  function getPixel(x, y) {
    const idx = (y * W + x) * 3;
    return [data[idx], data[idx + 1], data[idx + 2]];
  }

  // Run 0 bounds in style1_reference.jpg:
  const minX = 494, maxX = 593;
  const minY = 200, maxY = 295;
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  // Ground level for Run 0 is y = 291.
  const groundY = 291;

  function isDino(x, y) {
    if (y > groundY) return false;
    const [r, g, b] = getPixel(x, y);

    // Green skin & outlines
    if (g > r + 10 && g > b + 10 && g > 50) return true;
    if (g > 95 && g > r && g > b + 15) return true;
    if (r > 80 && g > 140 && b < 120 && g > r + 15) return true;

    // Spines & pupil & mouth
    if (r < 75 && g < 85 && b < 75) return true;
    if (r > 130 && g < 115 && b < 125 && r > g + 20) return true; // tongue

    // Cream belly: ONLY inside the upper/mid body (y between 225 and 278)
    if (y >= 225 && y <= 278) {
      if (r > 175 && g > 165 && b < 200 && Math.abs(r - g) < 35 && r > b + 15) return true;
    }

    // Eye sclera
    if (r > 215 && g > 215 && b > 210 && y < 240) return true;

    // Toe claws: right at foot bottom (y: 286 to 291)
    if (y >= 286 && y <= groundY) {
      if (r > 200 && g > 195 && b > 160 && (g > b + 10 || r > b + 10)) {
        // Must be near green foot pixel
        let nearGreen = false;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const [pr, pg, pb] = getPixel(x + dx, y + dy);
            if (pg > pr + 15 && pg > pb + 15) { nearGreen = true; break; }
          }
          if (nearGreen) break;
        }
        if (nearGreen) return true;
      }
    }

    return false;
  }

  // Flood fill from borders
  const mask = new Uint8Array(cropW * cropH); // 0=unknown, 1=bg, 2=fg
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

  // Also seed any pixel at or below groundY
  for (let y = 0; y < cropH; y++) {
    const absY = minY + y;
    if (absY >= groundY) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        if (!isDino(minX + x, absY)) {
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
      if (isDino(absX, absY)) continue;

      mask[nIdx] = 1;
      queue.push([nx, ny]);
    }
  }

  // Invert mask to get foreground
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 0) mask[i] = 2;
  }

  // Soft edge antialiasing
  const outBuf = Buffer.alloc(cropW * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const idx = y * cropW + x;
      const outIdx = idx * 4;
      if (mask[idx] === 2) {
        let bgCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
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
        outBuf[outIdx + 3] = bgCount > 0 ? Math.max(130, 255 - bgCount * 20) : 255;
      }
    }
  }

  const trimmed = await sharp(outBuf, { raw: { width: cropW, height: cropH, channels: 4 } })
    .trim()
    .raw()
    .toBuffer({ resolveWithObject: true });

  await sharp(trimmed.data, { raw: { width: trimmed.info.width, height: trimmed.info.height, channels: 4 } })
    .png()
    .toFile('assets/sprites/dino_run_0.png');

  console.log('Run 0 saved:', trimmed.info.width, 'x', trimmed.info.height);
}

testRun0();
