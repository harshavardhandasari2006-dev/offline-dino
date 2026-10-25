const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function extractCleanCacti() {
  const { data, info } = await sharp('assets/style1_reference.jpg').raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [data[idx], data[idx + 1], data[idx + 2]];
  }

  // 4 Cacti definitions in style1_reference.jpg Panel 6
  const cacti = [
    { name: 'cactus_single', minX: 427, maxX: 465, minY: 561, maxY: 633 }, // Cactus 1: tall with flower
    { name: 'cactus_double', minX: 475, maxX: 507, minY: 566, maxY: 633 }, // Cactus 2: double asymmetric arms
    { name: 'cactus_tall',   minX: 510, maxX: 550, minY: 556, maxY: 634 }, // Cactus 3: tallest with flower
    { name: 'cactus_small',  minX: 569, maxX: 599, minY: 575, maxY: 633 }  // Cactus 4: small cute saguaro
  ];

  for (const c of cacti) {
    const cropW = c.maxX - c.minX + 1;
    const cropH = c.maxY - c.minY + 1;

    function isCactusFg(x, y) {
      const absX = c.minX + x, absY = c.minY + y;
      if (absX < c.minX || absX > c.maxX || absY < c.minY || absY > c.maxY) return false;
      const [r, g, b] = getPixel(absX, absY);

      // Green body: strong green saturation
      const isGreen = (g > r + 12 && g > b + 12 && g > 55) || (g > 85 && g > r && g > b + 18);
      // Dark green crease / ribs / bottom shadow
      const isDarkRib = (g > 35 && g > r + 4 && g > b + 4 && r < 60 && b < 60 && absY <= c.maxY);
      // Orange / red flower on top
      const isFlower = (r > 160 && g < 130 && b < 70 && absY <= c.minY + 16);
      // Bottom trunk base outline
      const isBaseOutline = (absY >= c.maxY - 4 && absY <= c.maxY && r < 55 && g < 75 && b < 50 && (g >= r || g >= b));

      return isGreen || isDarkRib || isFlower || isBaseOutline;
    }

    // Connected component to isolate main cactus
    const labels = new Int32Array(cropW * cropH).fill(-1);
    const sizes = [];
    let curL = 0;

    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        if (labels[idx] === -1 && isCactusFg(x, y)) {
          let sz = 0;
          const q = [idx];
          labels[idx] = curL;
          let head = 0;
          while (head < q.length) {
            const cur = q[head++];
            sz++;
            const cx = cur % cropW, cy = Math.floor(cur / cropW);
            for (const [nx, ny] of [[cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]]) {
              if (nx >= 0 && nx < cropW && ny >= 0 && ny < cropH) {
                const ni = ny * cropW + nx;
                if (labels[ni] === -1 && isCactusFg(nx, ny)) {
                  labels[ni] = curL;
                  q.push(ni);
                }
              }
            }
          }
          sizes.push(sz);
          curL++;
        }
      }
    }

    let maxSz = 0, maxL = -1;
    for (let i = 0; i < sizes.length; i++) {
      if (sizes[i] > maxSz) { maxSz = sizes[i]; maxL = i; }
    }

    const mask = new Uint8Array(cropW * cropH);
    for (let i = 0; i < cropW * cropH; i++) {
      if (labels[i] === maxL) mask[i] = 1;
    }

    // Also include clean boundary outline pixels touching mask
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        if (mask[idx] === 0) {
          const absX = c.minX + x, absY = c.minY + y;
          const [r, g, b] = getPixel(absX, absY);
          // Only include dark green outline, NEVER pure black or white background lines
          if (r < 60 && g < 80 && b < 60 && g > r && g > b) {
            let touches = false;
            for (const [dx, dy] of [[1,0], [-1,0], [0,1], [0,-1]]) {
              const qx = x + dx, qy = y + dy;
              if (qx >= 0 && qx < cropW && qy >= 0 && qy < cropH && mask[qy * cropW + qx] === 1) {
                touches = true; break;
              }
            }
            if (touches) mask[idx] = 1;
          }
        }
      }
    }

    // Measure trimmed bounding box
    let minFgX = cropW, maxFgX = 0, minFgY = cropH, maxFgY = 0;
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        if (mask[y * cropW + x] === 1) {
          if (x < minFgX) minFgX = x;
          if (x > maxFgX) maxFgX = x;
          if (y < minFgY) minFgY = y;
          if (y > maxFgY) maxFgY = y;
        }
      }
    }

    const trimmedW = maxFgX - minFgX + 1;
    const trimmedH = maxFgY - minFgY + 1;
    const outBuf = Buffer.alloc(trimmedW * trimmedH * 4);

    for (let y = minFgY; y <= maxFgY; y++) {
      for (let x = minFgX; x <= maxFgX; x++) {
        const idx = y * cropW + x;
        const outIdx = ((y - minFgY) * trimmedW + (x - minFgX)) * 4;

        if (mask[idx] === 1) {
          const [r, g, b] = getPixel(c.minX + x, c.minY + y);

          // Calculate soft boundary anti-aliasing
          let bgN = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const qx = x + dx, qy = y + dy;
              if (qx < 0 || qx >= cropW || qy < 0 || qy >= cropH || mask[qy * cropW + qx] === 0) {
                bgN++;
              }
            }
          }

          outBuf[outIdx] = r;
          outBuf[outIdx + 1] = g;
          outBuf[outIdx + 2] = b;
          outBuf[outIdx + 3] = bgN > 0 ? Math.max(160, 255 - bgN * 18) : 255;
        }
      }
    }

    const outPath = path.join(__dirname, 'assets', 'sprites', `${c.name}.png`);
    await sharp(outBuf, { raw: { width: trimmedW, height: trimmedH, channels: 4 } }).png().toFile(outPath);
    console.log(`Saved clean ${c.name}.png: ${trimmedW}x${trimmedH} (no borders, no sand)`);
  }
}

extractCleanCacti().catch(console.error);
