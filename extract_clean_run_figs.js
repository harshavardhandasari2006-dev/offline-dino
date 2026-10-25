const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function extractCleanRunFigures() {
  const { data, info } = await sharp('assets/style1_reference.jpg').raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [data[idx], data[idx + 1], data[idx + 2]];
  }

  // Panel 2 Run figures in style1_reference.jpg
  // Centers: 543, 648, 752, 860, 968. Characters end at groundY = 294.
  const runBoxes = [
    { id: 1, minX: 490, maxX: 595, minY: 198, maxY: 294, groundY: 294 },
    { id: 2, minX: 596, maxX: 700, minY: 198, maxY: 294, groundY: 294 },
    { id: 3, minX: 701, maxX: 805, minY: 198, maxY: 294, groundY: 294 },
    { id: 4, minX: 806, maxX: 915, minY: 198, maxY: 294, groundY: 294 },
    { id: 5, minX: 916, maxX: 1018, minY: 198, maxY: 294, groundY: 294 }
  ];

  for (const box of runBoxes) {
    const cropW = box.maxX - box.minX + 1;
    const cropH = box.maxY - box.minY + 1;

    function isDinoPixel(absX, absY) {
      if (absX < box.minX || absX > box.maxX || absY < box.minY || absY > box.maxY) return false;
      if (absY > box.groundY) return false;
      const [r, g, b] = getPixel(absX, absY);

      // Green skin (near and far legs)
      const isGreen = (g > r + 8 && g > b + 8 && g > 42) || (g > 75 && g > r && g > b + 14);
      if (isGreen) return true;

      // Dark spines & outline
      const isSpineOrOutline = (r < 75 && g < 85 && b < 75 && (r > 8 || g > 8 || b > 8));
      if (isSpineOrOutline) return true;

      // Belly (cream yellow)
      const isBelly = (r > 170 && g > 160 && (g - b >= 25) && r > b + 25 && absY < box.groundY - 4);
      if (isBelly) return true;

      // Tongue / mouth
      const isMouth = (r > 120 && g < 115 && b < 125 && r > g + 20);
      if (isMouth) return true;

      // Eye white & pupil (strictly within head area, never sky blue)
      const isEyeArea = (absY >= box.minY + 6 && absY <= box.minY + cropH * 0.45 && absX >= box.minX + 35 && absX <= box.minX + 85);
      if (isEyeArea) {
        const isPupil = (r < 40 && g < 40 && b < 40);
        const isEyeWhite = (r > 200 && g > 200 && b > 190 && Math.abs(r - g) < 20 && r >= b - 5);
        if (isPupil || isEyeWhite) return true;
      }

      // Claws / toenails on feet: cream ivory (r > 180, g > 175, Math.abs(r-g) <= 15, r > b + 15)
      // Legs and feet are anywhere below mid-body (y >= minY + cropH * 0.5)
      if (absY >= box.minY + cropH * 0.5 && absY <= box.groundY) {
        const isClawColor = (r > 180 && g > 175 && Math.abs(r - g) <= 15 && r > b + 15);
        if (isClawColor) {
          // Verify proximity to green skin or dark outline
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const [nr, ng, nb] = getPixel(absX + dx, absY + dy);
              if ((ng > nr + 8 && ng > nb + 8) || (nr < 70 && ng < 80 && nb < 70)) {
                return true;
              }
            }
          }
        }
      }

      return false;
    }

    // Connected components
    const labels = new Int32Array(cropW * cropH).fill(-1);
    const sizes = [];
    let curLabel = 0;

    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        if (labels[idx] === -1 && isDinoPixel(box.minX + x, box.minY + y)) {
          let sz = 0;
          const q = [idx];
          labels[idx] = curLabel;
          let head = 0;
          while (head < q.length) {
            const cur = q[head++];
            sz++;
            const cx = cur % cropW, cy = Math.floor(cur / cropW);
            const nbs = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
            for (const [nx, ny] of nbs) {
              if (nx >= 0 && nx < cropW && ny >= 0 && ny < cropH) {
                const ni = ny * cropW + nx;
                if (labels[ni] === -1 && isDinoPixel(box.minX + nx, box.minY + ny)) {
                  labels[ni] = curLabel;
                  q.push(ni);
                }
              }
            }
          }
          sizes.push(sz);
          curLabel++;
        }
      }
    }

    let maxSz = 0, maxLabel = -1;
    for (let i = 0; i < sizes.length; i++) {
      if (sizes[i] > maxSz) { maxSz = sizes[i]; maxLabel = i; }
    }

    const dinoMask = new Uint8Array(cropW * cropH);
    for (let i = 0; i < cropW * cropH; i++) {
      if (labels[i] === maxLabel) dinoMask[i] = 1;
    }

    // Include outline pixels touching main body
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        if (dinoMask[idx] === 0) {
          const absX = box.minX + x, absY = box.minY + y;
          if (absY <= box.groundY) {
            const [r, g, b] = getPixel(absX, absY);
            if (r < 75 && g < 85 && b < 75) {
              let touchesDino = false;
              for (const [dx, dy] of [[1,0], [-1,0], [0,1], [0,-1]]) {
                const qx = x + dx, qy = y + dy;
                if (qx >= 0 && qx < cropW && qy >= 0 && qy < cropH && dinoMask[qy * cropW + qx] === 1) {
                  touchesDino = true; break;
                }
              }
              if (touchesDino) dinoMask[idx] = 1;
            }
          }
        }
      }
    }

    // Find bounding box
    let charMinX = cropW, charMaxX = 0, charMinY = cropH, charMaxY = 0;
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        if (dinoMask[y * cropW + x] === 1) {
          if (x < charMinX) charMinX = x;
          if (x > charMaxX) charMaxX = x;
          if (y < charMinY) charMinY = y;
          if (y > charMaxY) charMaxY = y;
        }
      }
    }

    const trimmedW = charMaxX - charMinX + 1;
    const trimmedH = charMaxY - charMinY + 1;
    const outBuf = Buffer.alloc(trimmedW * trimmedH * 4);

    for (let y = charMinY; y <= charMaxY; y++) {
      for (let x = charMinX; x <= charMaxX; x++) {
        const idx = y * cropW + x;
        const outIdx = ((y - charMinY) * trimmedW + (x - charMinX)) * 4;

        if (dinoMask[idx] === 1) {
          const [r, g, b] = getPixel(box.minX + x, box.minY + y);
          let bgN = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const qx = x + dx, qy = y + dy;
              if (qx < 0 || qx >= cropW || qy < 0 || qy >= cropH || dinoMask[qy * cropW + qx] === 0) {
                bgN++;
              }
            }
          }
          outBuf[outIdx] = r;
          outBuf[outIdx + 1] = g;
          outBuf[outIdx + 2] = b;
          outBuf[outIdx + 3] = bgN > 0 ? Math.max(160, 255 - bgN * 14) : 255;
        }
      }
    }

    const outPath = `clean_pure_run_fig_${box.id}.png`;
    await sharp(outBuf, { raw: { width: trimmedW, height: trimmedH, channels: 4 } }).png().toFile(outPath);
    console.log(`Saved ${outPath}: ${trimmedW}x${trimmedH}`);
  }
}

extractCleanRunFigures().catch(console.error);
