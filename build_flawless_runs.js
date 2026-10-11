const sharp = require('sharp');
const fs = require('fs');

async function main() {
  const { data, info } = await sharp('assets/style1_reference.jpg').raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [data[idx], data[idx + 1], data[idx + 2]];
  }
  function isGreen(x, y) {
    const [r, g, b] = getPixel(x, y);
    return (g > r + 8 && g > b + 8 && g > 40) || (g > 85 && g > r && g > b + 15);
  }
  function isSpine(x, y) {
    const [r, g, b] = getPixel(x, y);
    return (r < 75 && g < 85 && b < 75 && (r > 10 || g > 10 || b > 10));
  }
  function isTongue(x, y) {
    const [r, g, b] = getPixel(x, y);
    return (r > 135 && g < 115 && b < 125 && r > g + 20) || (r > 90 && r < 145 && g < 55 && b < 65);
  }
  function isBelly(x, y, groundY) {
    if (groundY && y > groundY - 6) return false;
    const [r, g, b] = getPixel(x, y);
    return (r > 175 && g > 160 && (g - b >= 30) && r > b + 25);
  }
  function isEyeWhite(x, y, topY, maxH) {
    const [r, g, b] = getPixel(x, y);
    return (r > 215 && g > 215 && b > 210 && y < topY + maxH * 0.6);
  }
  function isEyePupilOrOutline(x, y, topY, maxH) {
    const [r, g, b] = getPixel(x, y);
    // Dark pupil inside the eye
    return (r < 60 && g < 60 && b < 60 && y < topY + maxH * 0.55 && y > topY + 10);
  }
  function isClaw(x, y, groundY) {
    if (groundY && y > groundY) return false;
    const [r, g, b] = getPixel(x, y);
    if (!(r > 200 && g > 185 && b > 140 && g - b > 20)) return false;
    for (let dy = -2; dy <= 1; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (isGreen(x + dx, y + dy)) return true;
      }
    }
    return false;
  }

  function segmentDino({ minX, maxX, minY, maxY, groundY }) {
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    function isFg(x, y) {
      if (x < minX || x > maxX || y < minY || y > maxY) return false;
      if (groundY && y > groundY) return false;
      if (isGreen(x, y) || isSpine(x, y) || isTongue(x, y) || isBelly(x, y, groundY) || isClaw(x, y, groundY) || isEyeWhite(x, y, minY, cropH) || isEyePupilOrOutline(x, y, minY, cropH)) return true;
      return false;
    }

    const labels = new Int32Array(cropW * cropH).fill(-1);
    const sizes = [];
    let curL = 0;
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        if (labels[idx] === -1 && isFg(minX + x, minY + y)) {
          let sz = 0;
          const q = [idx];
          labels[idx] = curL;
          let head = 0;
          while (head < q.length) {
            const cur = q[head++];
            sz++;
            const cx = cur % cropW, cy = Math.floor(cur / cropW);
            for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
              if (nx >= 0 && nx < cropW && ny >= 0 && ny < cropH) {
                const ni = ny * cropW + nx;
                if (labels[ni] === -1 && isFg(minX + nx, minY + ny)) {
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

    const fgMask = new Uint8Array(cropW * cropH);
    for (let i = 0; i < cropW * cropH; i++) {
      if (labels[i] === maxL) fgMask[i] = 1;
    }

    const outBuf = Buffer.alloc(cropW * cropH * 4);
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        const oIdx = idx * 4;
        if (fgMask[idx] === 1) {
          const absX = minX + x, absY = minY + y;
          const [r, g, b] = getPixel(absX, absY);

          let bgCount = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const qx = x + dx, qy = y + dy;
              if (qx < 0 || qx >= cropW || qy < 0 || qy >= cropH || fgMask[qy * cropW + qx] === 0) {
                bgCount++;
              }
            }
          }

          outBuf[oIdx] = r;
          outBuf[oIdx + 1] = g;
          outBuf[oIdx + 2] = b;
          outBuf[oIdx + 3] = bgCount > 0 ? Math.max(160, 255 - bgCount * 14) : 255;
        }
      }
    }
    return { buf: outBuf, width: cropW, height: cropH };
  }

  // 1. Extract Master Frame 0
  const raw0 = segmentDino({
    minX: 543 - 55,
    maxX: 543 + 54,
    minY: 199,
    maxY: 295,
    groundY: 294
  });
  await sharp(raw0.buf, { raw: { width: raw0.width, height: raw0.height, channels: 4 } })
    .png()
    .toFile('flawless_run_0.png');
  console.log('Saved flawless_run_0.png');

  // Extract master head from flawless_run_0
  const masterHeadBuf = await sharp('flawless_run_0.png')
    .extract({ left: 45, top: 4, width: 62, height: 48 })
    .toBuffer();

  const runCenters = [543, 648, 752, 860, 968];
  for (let i = 1; i < runCenters.length; i++) {
    const cx = runCenters[i];
    const raw = segmentDino({
      minX: cx - 55,
      maxX: cx + 54,
      minY: 199,
      maxY: 295,
      groundY: 294
    });

    const w = raw.width;
    const h = raw.height;
    const buf = Buffer.from(raw.buf);

    // Clear old head above neck seam (y < 44 && x >= 46) so zero old pixels remain
    for (let y = 0; y < 44; y++) {
      for (let x = 46; x < w; x++) {
        const idx = (y * w + x) * 4;
        buf[idx + 3] = 0; // transparent
      }
    }

    // Composite master head
    await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
      .composite([{
        input: masterHeadBuf,
        left: 45,
        top: 4
      }])
      .png()
      .toFile(`flawless_run_${i}.png`);

    console.log(`Saved flawless_run_${i}.png`);
  }
}

main();
