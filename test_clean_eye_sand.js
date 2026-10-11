const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function testCleanEyeAndSand() {
  const refPath = path.join(__dirname, 'assets', 'style1_reference.jpg');
  const { data: refData, info: refInfo } = await sharp(refPath).raw().toBuffer({ resolveWithObject: true });
  const W = refInfo.width, H = refInfo.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [refData[idx], refData[idx + 1], refData[idx + 2]];
  }

  // 5 figures in Panel 2:
  const figures = [
    { name: 'fig_1', minX: 494, maxX: 593, eyeBox: { minX: 535, maxX: 585, minY: 204, maxY: 242 }, contact: 'NEAR_DOWN' },
    { name: 'fig_2', minX: 600, maxX: 696, eyeBox: { minX: 642, maxX: 690, minY: 204, maxY: 242 }, contact: 'NEAR_PASS' },
    { name: 'fig_3', minX: 706, maxX: 800, eyeBox: { minX: 746, maxX: 795, minY: 204, maxY: 242 }, contact: 'NEAR_PUSH' },
    { name: 'fig_4', minX: 810, maxX: 908, eyeBox: { minX: 852, maxX: 902, minY: 204, maxY: 242 }, contact: 'FAR_PASS' },
    { name: 'fig_5', minX: 918, maxX: 1016, eyeBox: { minX: 960, maxX: 1010, minY: 204, maxY: 242 }, contact: 'FAR_DOWN' }
  ];

  for (let i = 0; i < figures.length; i++) {
    const fig = figures[i];
    const padL = fig.minX - 4, padR = fig.maxX + 4, padT = 190, padB = 302;
    const cW = padR - padL + 1, cH = padB - padT + 1;

    function isCharacter(x, y) {
      const absX = padL + x, absY = padT + y;
      if (absY > 298) return false;
      const [r, g, b] = getPixel(absX, absY);

      // Rejection of desert sand floor
      if (absY >= 286) {
        if (r > 185 && g >= 135 && g <= 220 && b >= 105 && b <= 185 && (r - g >= 18) && (r - b >= 35)) return false;
        if (r > 120 && g < 155 && b < 120 && r > g + 20 && g > b + 15 && !(g > r)) return false; // shadow
      }

      // Green skin & limbs
      if ((g > r + 6 && g > b + 6 && g > 36) || (g > 70 && g > r && g > b + 8)) return true;
      // Dark outline / spines / nostrils / eyebrows
      if (r < 75 && g < 85 && b < 75 && (r > 4 || g > 4 || b > 4)) return true;
      // Cream chin / throat / chest / belly
      if (r > 155 && g > 135 && r > b + 15 && g > b + 15 && (r - g <= 60)) return true;
      // Mouth interior / tongue / lips
      if (r > 100 && g < 125 && b < 130 && r > g + 15) return true;
      if (r > 60 && r < 150 && g < 70 && b < 70) return true;

      // Eye white: NEUTRAL WHITE ONLY (r > 210, g > 210, b > 200, |r-b| <= 14)
      if (absX >= fig.eyeBox.minX && absX <= fig.eyeBox.maxX && absY >= fig.eyeBox.minY && absY <= fig.eyeBox.maxY) {
        if (r > 210 && g > 210 && b > 200 && Math.abs(r - b) <= 14 && Math.abs(g - b) <= 14) return true;
        if (r < 75 && g < 75 && b < 75) return true; // pupil
      }

      // Claws / toenails
      if (absY >= 282 && absY <= 298 && r > 180 && g > 170 && b < 175 && g - b > 8) return true;

      return false;
    }

    const mask = new Uint8Array(cW * cH);
    for (let y = 0; y < cH; y++) {
      for (let x = 0; x < cW; x++) {
        if (isCharacter(x, y)) mask[y * cW + x] = 1;
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
    for (let s = 0; s < sizes.length; s++) {
      if (sizes[s] > maxSz) { maxSz = sizes[s]; maxL = s; }
    }

    const outBuf = Buffer.alloc(cW * cH * 4);
    for (let y = 0; y < cH; y++) {
      for (let x = 0; x < cW; x++) {
        const idx = y * cW + x;
        if (labels[idx] === maxL) {
          const absX = padL + x, absY = padT + y;
          const [r, g, b] = getPixel(absX, absY);

          // Clear any sand remnants
          if (absY >= 288) {
            if (r > 185 && g >= 135 && g <= 220 && b >= 105 && b <= 185 && (r - g >= 18) && (r - b >= 35)) continue;
          }

          let touchesBg = false;
          for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= cW || ny < 0 || ny >= cH || labels[ny * cW + nx] !== maxL) {
              touchesBg = true;
              break;
            }
          }

          let a = 255;
          let outB = b;
          if (touchesBg && b > r + 15 && b > 120 && !(r < 65 && g < 65 && b < 65)) {
            outB = Math.min(outB, Math.round((r + g) / 2));
            a = 210;
          }

          outBuf[idx * 4] = r;
          outBuf[idx * 4 + 1] = g;
          outBuf[idx * 4 + 2] = outB;
          outBuf[idx * 4 + 3] = a;
        }
      }
    }

    await sharp(outBuf, { raw: { width: cW, height: cH, channels: 4 } })
      .png()
      .toFile(`clean_fig_${i+1}.png`);
  }

  // Create montage
  const compositeList = figures.map((f, i) => ({
    input: `clean_fig_${i+1}.png`,
    left: i * 115 + 10,
    top: 10
  }));

  await sharp({
    create: { width: 115 * 5 + 10, height: 135, channels: 4, background: { r: 77, g: 166, b: 255, alpha: 1 } }
  }).composite(compositeList).png().toFile('clean_figs_montage.png');

  console.log('Saved clean_figs_montage.png');
}

testCleanEyeAndSand();
