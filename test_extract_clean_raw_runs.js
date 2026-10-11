const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Cleans halo pixels around transparent boundary while protecting all character features
function cleanHalo(buf, w, h, channels = 4) {
  const out = Buffer.from(buf);

  // 1. Erase any pixel strictly below baseline y = 103
  for (let y = 104; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
    }
  }

  // 2. Erase sand particles (peach/sand color) anywhere below y >= 95
  for (let y = 95; y <= 103; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (out[idx + 3] === 0) continue;
      const r = out[idx], g = out[idx+1], b = out[idx+2];
      if (r > 170 && g < 165 && b < 140 && (r - g >= 25) && (r - b >= 45)) {
        out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
      }
    }
  }

  // 3. Multi-pass sky halo cleaner:
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const a = out[idx + 3];
        if (a === 0) continue;

        let touchesTrans = false;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h || out[(ny * w + nx) * 4 + 3] === 0) {
            touchesTrans = true; break;
          }
        }

        if (touchesTrans) {
          const r = out[idx], g = out[idx+1], b = out[idx+2];
          
          // PROTECT: Claws/toenails (y >= 94)
          if (y >= 94 && r > 185 && g > 175 && b < 165 && Math.abs(r - g) <= 25) continue;
          // PROTECT: Cream chin, throat, chest, belly:
          const isCreamChinOrBelly = (r > 180 && g > 160 && (r - b >= 25) && (g - b >= 20));
          if (isCreamChinOrBelly) continue;

          // Sky/cloud halo removal:
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          // Blue/cyan sky:
          const isSkyCyan = (b > r + 8 && b > 110) || (b > 115 && lum > 130 && r < 190);
          // White/pale cloud fringe:
          const isCloudFringe = (r > 165 && g > 175 && b > 160 && Math.abs(r - b) < 20);
          // Semi-transparent halo:
          const isTransFringe = (a < 180 && (r > 130 || g > 140 || b > 120));

          if (isSkyCyan || isCloudFringe || isTransFringe) {
            out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
          }
        }
      }
    }
  }

  return out;
}

async function extractRawRun(idx) {
  const file = `assets/extracted/run_raw_${idx}.png`;
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const pIdx = (y * W + x) * 3;
      const r = data[pIdx], g = data[pIdx + 1], b = data[pIdx + 2];
      
      const isGreen = (g > r + 8 && g > b + 8 && g > 40) || (g > 85 && g > r && g > b + 15);
      const isSpine = (r < 75 && g < 85 && b < 75 && (r > 10 || g > 10 || b > 10));
      const isMouth = (r > 135 && g < 115 && b < 125 && r > g + 20) || (r > 90 && r < 145 && g < 55 && b < 65);
      // Protected cream chin, chest, belly:
      const isBelly = (r > 175 && g > 155 && (r - b >= 25) && (g - b >= 20) && y < 100);
      const isEyeWhite = (r > 215 && g > 215 && b > 210 && y < 65);
      const isPupil = (r < 60 && g < 60 && b < 60 && y < 60 && x > 40);
      const isClaw = (r > 200 && g > 185 && b > 140 && g - b > 20 && y < 106);

      if (isGreen || isSpine || isMouth || isBelly || isEyeWhite || isPupil || isClaw) {
        mask[y * W + x] = 1;
      }
    }
  }

  // Connected components to find main body
  const labels = new Int32Array(W * H).fill(-1);
  const sizes = [];
  let curL = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const mIdx = y * W + x;
      if (mask[mIdx] === 1 && labels[mIdx] === -1) {
        let sz = 0;
        const q = [mIdx];
        labels[mIdx] = curL;
        let head = 0;
        while (head < q.length) {
          const cur = q[head++];
          sz++;
          const cx = cur % W, cy = Math.floor(cur / W);
          for (const [nx, ny] of [[cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]]) {
            if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
              const ni = ny * W + nx;
              if (mask[ni] === 1 && labels[ni] === -1) {
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

  // Find bounding box of segmented dino
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (labels[y * W + x] === maxL) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const targetW = 128, targetH = 112;
  const outBuf = Buffer.alloc(targetW * targetH * 4);

  const destYOffset = 103 - maxY;
  const bodyCenter = (minX + maxX) / 2;
  const destXOffset = Math.round(56 - bodyCenter);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (labels[y * W + x] === maxL) {
        const destX = x + destXOffset;
        const destY = y + destYOffset;
        if (destX >= 0 && destX < targetW && destY >= 0 && destY < targetH) {
          const dIdx = (destY * targetW + destX) * 4;
          const sIdx = (y * W + x) * 3;
          outBuf[dIdx] = data[sIdx];
          outBuf[dIdx + 1] = data[sIdx + 1];
          outBuf[dIdx + 2] = data[sIdx + 2];
          outBuf[dIdx + 3] = 255;
        }
      }
    }
  }

  // Clean halo
  const cleaned = cleanHalo(outBuf, targetW, targetH);
  await sharp(cleaned, { raw: { width: targetW, height: targetH, channels: 4 } }).png().toFile(`test_clean_raw_run_${idx}.png`);
  console.log(`Saved test_clean_raw_run_${idx}.png (maxY=103)`);
}

async function run() {
  for (let i = 0; i <= 4; i++) {
    await extractRawRun(i);
  }

  // Composite side by side on sky background
  await sharp({
    create: {
      width: 130 * 5,
      height: 120,
      channels: 4,
      background: { r: 77, g: 166, b: 255, alpha: 1 }
    }
  }).composite([
    { input: 'test_clean_raw_run_0.png', left: 0, top: 0 },
    { input: 'test_clean_raw_run_1.png', left: 130, top: 0 },
    { input: 'test_clean_raw_run_2.png', left: 260, top: 0 },
    { input: 'test_clean_raw_run_3.png', left: 390, top: 0 },
    { input: 'test_clean_raw_run_4.png', left: 520, top: 0 }
  ]).png().toFile('test_clean_raw_runs_montage2.png');

  console.log('Saved test_clean_raw_runs_montage2.png');
}

run();
