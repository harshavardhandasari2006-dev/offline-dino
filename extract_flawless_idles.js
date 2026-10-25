const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function extractIdlePoses() {
  const { data, info } = await sharp('assets/style1_reference.jpg').raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [data[idx], data[idx + 1], data[idx + 2]];
  }

  // Define the 4 Idle poses in Panel 1
  const idleBoxes = [
    { name: 'dino_idle_0', minX: 12, maxX: 120, minY: 198, maxY: 300, groundY: 298 },
    { name: 'dino_idle_1', minX: 125, maxX: 232, minY: 198, maxY: 300, groundY: 298 },
    { name: 'dino_idle_2', minX: 235, maxX: 342, minY: 198, maxY: 300, groundY: 298 },
    { name: 'dino_idle_3', minX: 345, maxX: 457, minY: 195, maxY: 300, groundY: 298 }
  ];

  for (let p = 0; p < idleBoxes.length; p++) {
    const box = idleBoxes[p];
    const cropW = box.maxX - box.minX + 1;
    const cropH = box.maxY - box.minY + 1;

    // Check if pixel at (absX, absY) is part of dinosaur foreground
    function isDinoPixel(absX, absY) {
      if (absX < box.minX || absX > box.maxX || absY < box.minY || absY > box.maxY) return false;
      if (absY > box.groundY) return false; // Strictly above ground contact
      const [r, g, b] = getPixel(absX, absY);

      // Green skin
      const isGreen = (g > r + 8 && g > b + 8 && g > 45) || (g > 80 && g > r && g > b + 14);
      if (isGreen) return true;

      // Dark spines & outline
      const isSpineOrOutline = (r < 75 && g < 85 && b < 75 && (r > 8 || g > 8 || b > 8));
      if (isSpineOrOutline) return true;

      // Belly (cream yellow)
      const isBelly = (r > 170 && g > 160 && (g - b >= 25) && r > b + 25 && absY < box.groundY - 5);
      if (isBelly) return true;

      // Tongue / mouth
      const isMouth = (r > 120 && g < 115 && b < 125 && r > g + 20);
      if (isMouth) return true;

      // Eye white & pupil (Warm white/ivory, strictly inside head area, never sky blue where b > r)
      const isEyeArea = (absY >= box.minY + 6 && absY <= box.minY + cropH * 0.45 && absX >= box.minX + 40 && absX <= box.minX + 85);
      if (isEyeArea) {
        const isPupil = (r < 40 && g < 40 && b < 40);
        const isEyeWhite = (r > 205 && g > 205 && b > 190 && Math.abs(r - g) < 20 && r >= b - 5);
        if (isPupil || isEyeWhite) return true;
      }

      // Claws / toenails (white / cream claws on feet at row 288 .. 298)
      if (absY >= 288 && absY <= box.groundY) {
        // Claws have r > 185, g > 180, b in 120..175, Math.abs(r - g) <= 14.
        // Peach sand always has r - g >= 20 (reddish).
        const isClawColor = (r > 185 && g > 180 && Math.abs(r - g) <= 14 && r > b + 18);
        if (isClawColor) {
          // Verify proximity to green or outline
          for (let dy = -2; dy <= 1; dy++) {
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

    // Connected components on isDinoPixel to keep main character and eliminate stray flecks
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

    // Create mask of main body
    const dinoMask = new Uint8Array(cropW * cropH);
    for (let i = 0; i < cropW * cropH; i++) {
      if (labels[i] === maxLabel) dinoMask[i] = 1;
    }

    // Also include boundary outline pixels touching dinoMask
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        if (dinoMask[idx] === 0) {
          const absX = box.minX + x, absY = box.minY + y;
          if (absY <= box.groundY) {
            const [r, g, b] = getPixel(absX, absY);
            // If it's a dark outline pixel touching dinoMask
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

    // Measure bounding box of character
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

    // Place onto canonical 128 x 112 canvas
    const targetW = 128, targetH = 112;
    const canvas = Buffer.alloc(targetW * targetH * 4);

    // Baseline row is 103: so foot sole (charMaxY) lands on row 103!
    const destYOffset = 103 - charMaxY;
    // Horizontally centered around column 64
    const charCenterX = (charMinX + charMaxX) / 2;
    const destXOffset = Math.round(64 - charCenterX);

    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        if (dinoMask[idx] === 1) {
          const dx = x + destXOffset;
          const dy = y + destYOffset;
          if (dx >= 0 && dx < targetW && dy >= 0 && dy < targetH) {
            const dIdx = (dy * targetW + dx) * 4;
            const [r, g, b] = getPixel(box.minX + x, box.minY + y);

            // Compute soft edge alpha for anti-aliasing
            let bgNeighbors = 0;
            for (let ddy = -1; ddy <= 1; ddy++) {
              for (let ddx = -1; ddx <= 1; ddx++) {
                if (ddx === 0 && ddy === 0) continue;
                const qx = x + ddx, qy = y + ddy;
                if (qx < 0 || qx >= cropW || qy < 0 || qy >= cropH || dinoMask[qy * cropW + qx] === 0) {
                  bgNeighbors++;
                }
              }
            }

            canvas[dIdx] = r;
            canvas[dIdx + 1] = g;
            canvas[dIdx + 2] = b;
            canvas[dIdx + 3] = bgNeighbors > 0 ? Math.max(160, 255 - bgNeighbors * 14) : 255;
          }
        }
      }
    }

    // Ensure solid ground contact row 103 under the feet
    for (let x = 20; x < targetW - 20; x++) {
      const idx103 = (103 * targetW + x) * 4;
      const idx102 = (102 * targetW + x) * 4;
      if (canvas[idx102 + 3] > 100 && canvas[idx103 + 3] === 0) {
        canvas[idx103] = canvas[idx102];
        canvas[idx103 + 1] = canvas[idx102 + 1];
        canvas[idx103 + 2] = canvas[idx102 + 2];
        canvas[idx103 + 3] = 255;
      }
    }

    const outPath = path.join(__dirname, 'assets', 'sprites', `${box.name}.png`);
    await sharp(canvas, { raw: { width: targetW, height: targetH, channels: 4 } }).png().toFile(outPath);
    console.log(`Saved ${box.name}.png (Character size: ${charMaxX - charMinX + 1}x${charMaxY - charMinY + 1}, foot at row 103)`);
  }
}

extractIdlePoses().catch(console.error);
