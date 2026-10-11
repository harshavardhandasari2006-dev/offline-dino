const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function extractRunFigures() {
  const refPath = path.join(__dirname, 'assets', 'style1_reference.jpg');
  const { data, info } = await sharp(refPath).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [data[idx], data[idx + 1], data[idx + 2]];
  }

  // 5 figures in Panel 2:
  const figures = [
    { name: 'raw_run_0', minX: 494, maxX: 594, minY: 194, maxY: 301, baselineY: 299 },
    { name: 'raw_run_1', minX: 600, maxX: 696, minY: 194, maxY: 301, baselineY: 299 },
    { name: 'raw_run_2', minX: 706, maxX: 800, minY: 194, maxY: 301, baselineY: 299 },
    { name: 'raw_run_3', minX: 810, maxX: 908, minY: 194, maxY: 301, baselineY: 299 },
    { name: 'raw_run_4', minX: 918, maxX: 1016, minY: 194, maxY: 301, baselineY: 299 }
  ];

  function extractOne(fig) {
    const padL = fig.minX - 2;
    const padR = fig.maxX + 2;
    const padT = fig.minY - 2;
    const padB = fig.maxY + 2;
    const cW = padR - padL + 1;
    const cH = padB - padT + 1;

    function isFg(x, y) {
      const absX = padL + x, absY = padT + y;
      if (absY > fig.baselineY) return false;
      const [r, g, b] = getPixel(absX, absY);

      // Green skin
      if ((g > r + 10 && g > b + 10 && g > 40) || (g > 80 && g > r && g > b + 15)) return true;
      // Dark scutes/outline
      if (r < 75 && g < 85 && b < 75 && (r > 5 || g > 5 || b > 5)) return true;
      // Cream belly / chin / throat
      if (r > 175 && g > 155 && r > b + 20 && g > b + 15) return true;
      // Tongue
      if (r > 120 && g < 120 && b < 130 && r > g + 15) return true;
      // White eye / pupil
      if (r > 200 && g > 200 && b > 195 && absY < 260) return true;
      if (r < 60 && g < 60 && b < 60 && absY < 260) return true;
      // Toenails
      if (r > 185 && g > 175 && b < 175 && g - b > 10 && absY >= fig.baselineY - 14) return true;

      return false;
    }

    const mask = new Uint8Array(cW * cH);
    for (let y = 0; y < cH; y++) {
      for (let x = 0; x < cW; x++) {
        if (isFg(x, y)) mask[y * cW + x] = 1;
      }
    }

    // Connected components
    const labels = new Int32Array(cW * cH).fill(-1);
    const sizes = [];
    let curL = 0;
    for (let y = 0; y < cH; y++) {
      for (let x = 0; x < cW; x++) {
        const idx = y * cW + x;
        if (mask[idx] === 1 && labels[idx] === -1) {
          let sz = 0;
          const q = [idx];
          labels[idx] = curL;
          let head = 0;
          while (head < q.length) {
            const cur = q[head++];
            sz++;
            const cx = cur % cW, cy = Math.floor(cur / cW);
            for (const [nx, ny] of [[cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]]) {
              if (nx >= 0 && nx < cW && ny >= 0 && ny < cH) {
                const ni = ny * cW + nx;
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

    // Character bounds
    let minDinoX = cW, maxDinoX = 0, minDinoY = cH, maxDinoY = 0;
    for (let y = 0; y < cH; y++) {
      for (let x = 0; x < cW; x++) {
        if (labels[y * cW + x] === maxL) {
          if (x < minDinoX) minDinoX = x;
          if (x > maxDinoX) maxDinoX = x;
          if (y < minDinoY) minDinoY = y;
          if (y > maxDinoY) maxDinoY = y;
        }
      }
    }

    const targetW = 128, targetH = 112;
    const outBuf = Buffer.alloc(targetW * targetH * 4);

    // Ground baseline alignment:
    // row corresponding to baselineY maps to row 103!
    const cropGroundY = fig.baselineY - padT;
    const destYOffset = 103 - cropGroundY;
    const charCenterX = (minDinoX + maxDinoX) / 2;
    const destXOffset = Math.round(62 - charCenterX);

    for (let y = 0; y < cH; y++) {
      for (let x = 0; x < cW; x++) {
        if (labels[y * cW + x] === maxL) {
          const destX = x + destXOffset;
          const destY = y + destYOffset;
          if (destX >= 0 && destX < targetW && destY >= 0 && destY < targetH) {
            const dIdx = (destY * targetW + destX) * 4;
            const [r, g, b] = getPixel(padL + x, padT + y);

            // De-matte perimeter
            let touchesBg = false;
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || nx >= cW || ny < 0 || ny >= cH || labels[ny * cW + nx] !== maxL) {
                touchesBg = true;
                break;
              }
            }

            let a = 255;
            let outR = r, outG = g, outB = b;
            if (touchesBg) {
              if (b > r + 15 && b > 120 && !(r < 65 && g < 65 && b < 65)) {
                outB = Math.min(outB, Math.round((r + g) / 2));
                a = 210;
              }
            }

            outBuf[dIdx] = outR;
            outBuf[dIdx + 1] = outG;
            outBuf[dIdx + 2] = outB;
            outBuf[dIdx + 3] = a;
          }
        }
      }
    }

    return outBuf;
  }

  const outFiles = [];
  for (const fig of figures) {
    const buf = extractOne(fig);
    const fname = fig.name + '_clean.png';
    await sharp(buf, { raw: { width: 128, height: 112, channels: 4 } }).png().toFile(fname);
    outFiles.push(fname);
    console.log('Saved ' + fname);
  }

  // Make montage
  const bg = { r: 77, g: 166, b: 255, alpha: 1 };
  const compositeList = outFiles.map((f, i) => ({
    input: f,
    left: i * 138 + 10,
    top: 10
  }));

  const montageCanvas = await sharp({
    create: { width: 128 * 5 + 60, height: 112 + 30, channels: 4, background: bg }
  }).composite(compositeList).png().toBuffer();

  const { data: mData, info: mInfo } = await sharp(montageCanvas).raw().toBuffer({ resolveWithObject: true });
  const redY = 10 + 103;
  for (let x = 0; x < mInfo.width; x++) {
    const idx = (redY * mInfo.width + x) * 4;
    mData[idx] = 255; mData[idx+1] = 0; mData[idx+2] = 0; mData[idx+3] = 255;
  }

  await sharp(mData, { raw: { width: mInfo.width, height: mInfo.height, channels: 4 } })
    .png()
    .toFile('test_run_figures_montage.png');
  console.log('Saved test_run_figures_montage.png');
}

extractRunFigures();
