const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateFlawlessRunCycle() {
  console.log('=== EXTRACTING & RIGGING MASTER 6-FRAME RUN CYCLE ===\n');

  const { data, info } = await sharp('assets/style1_reference.jpg').raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [data[idx], data[idx + 1], data[idx + 2]];
  }

  // 5 Run figures in Panel 2 of style1_reference.jpg
  // Exactly groundY = 294 (all character feet end at y=293/294, sand is below)
  const runBoxes = [
    { id: 1, minX: 490, maxX: 595, minY: 198, maxY: 294, groundY: 294 },
    { id: 2, minX: 596, maxX: 700, minY: 198, maxY: 294, groundY: 294 },
    { id: 3, minX: 701, maxX: 805, minY: 198, maxY: 294, groundY: 294 },
    { id: 4, minX: 806, maxX: 915, minY: 198, maxY: 294, groundY: 294 },
    { id: 5, minX: 916, maxX: 1018, minY: 198, maxY: 294, groundY: 294 }
  ];

  const extractedFigures = [];

  for (const box of runBoxes) {
    const cropW = box.maxX - box.minX + 1;
    const cropH = box.maxY - box.minY + 1;

    function isDinoPixel(absX, absY) {
      if (absX < box.minX || absX > box.maxX || absY < box.minY || absY > box.maxY) return false;
      if (absY > box.groundY) return false;
      const [r, g, b] = getPixel(absX, absY);

      // 1. Green skin (vibrant green, lime highlights, and shaded greens)
      const isGreen = (g > r + 6 && g > b + 6 && g > 38) || (g > 75 && g > r && g > b + 12);
      // 2. Olive / khaki green shadows on legs & knee creases
      const isLegShadow = (absY >= box.minY + cropH * 0.55 && g > 95 && b < 120 && g > b + 20 && r < 195 && r > g - 35);
      // 3. Dark outlines and spines
      const isSpineOrOutline = (r < 75 && g < 85 && b < 75 && (r > 4 || g > 4 || b > 4));
      // 4. Belly (warm cream yellow on chest and torso, never down between the feet)
      const isBelly = (r > 170 && g > 155 && (g - b >= 20) && r > b + 20 && absY <= box.minY + cropH * 0.62);
      // 5. Tongue / mouth
      const isMouth = (r > 120 && g < 115 && b < 125 && r > g + 20);
      // 6. Eye white & pupil inside head
      const isEyeArea = (absY >= box.minY + 6 && absY <= box.minY + cropH * 0.45 && absX >= box.minX + 35 && absX <= box.minX + 85);
      let isEye = false;
      if (isEyeArea) {
        const isPupil = (r < 40 && g < 40 && b < 40);
        const isEyeWhite = (r > 200 && g > 200 && b > 190 && Math.abs(r - g) < 20 && r >= b - 5);
        isEye = isPupil || isEyeWhite;
      }
      // 7. Claws / toenails on feet (cream ivory, near green/outline, never peach sand)
      let isClaw = false;
      if (absY >= box.minY + cropH * 0.55 && absY <= box.groundY) {
        // Claws have Math.abs(r - g) <= 15 (cream), whereas peach sand has r - g >= 20 (reddish)
        const isClawColor = (r > 180 && g > 175 && Math.abs(r - g) <= 15 && r > b + 15);
        if (isClawColor) {
          // Check proximity to green or outline
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const [nr, ng, nb] = getPixel(absX + dx, absY + dy);
              if ((ng > nr + 6 && ng > nb + 6) || (nr < 75 && ng < 85 && nb < 75)) {
                isClaw = true; break;
              }
            }
            if (isClaw) break;
          }
        }
      }

      return isGreen || isLegShadow || isSpineOrOutline || isBelly || isMouth || isEye || isClaw;
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
            for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
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

    // Keep all components that are either the main body (maxLabel) OR are significant character parts (size >= 15)
    // touching the character body (bridges gap of 1px anti-aliasing)
    const dinoMask = new Uint8Array(cropW * cropH);
    for (let i = 0; i < cropW * cropH; i++) {
      if (labels[i] === maxLabel) dinoMask[i] = 1;
    }

    // Check smaller components: if near main body (within 2px) and size >= 10, keep them
    for (let i = 0; i < sizes.length; i++) {
      if (i !== maxLabel && sizes[i] >= 10) {
        let nearMain = false;
        for (let y = 0; y < cropH; y++) {
          for (let x = 0; x < cropW; x++) {
            if (labels[y * cropW + x] === i) {
              for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                  const qx = x + dx, qy = y + dy;
                  if (qx >= 0 && qx < cropW && qy >= 0 && qy < cropH && dinoMask[qy * cropW + qx] === 1) {
                    nearMain = true; break;
                  }
                }
                if (nearMain) break;
              }
            }
            if (nearMain) break;
          }
          if (nearMain) break;
        }
        if (nearMain) {
          for (let idx = 0; idx < cropW * cropH; idx++) {
            if (labels[idx] === i) dinoMask[idx] = 1;
          }
        }
      }
    }

    // Add outline pixels touching dinoMask
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        if (dinoMask[idx] === 0) {
          const absX = box.minX + x, absY = box.minY + y;
          if (absY <= box.groundY) {
            const [r, g, b] = getPixel(absX, absY);
            if (r < 75 && g < 85 && b < 75 && (r > 4 || g > 4 || b > 4)) {
              let touches = false;
              for (const [dx, dy] of [[1,0], [-1,0], [0,1], [0,-1]]) {
                const qx = x + dx, qy = y + dy;
                if (qx >= 0 && qx < cropW && qy >= 0 && qy < cropH && dinoMask[qy * cropW + qx] === 1) {
                  touches = true; break;
                }
              }
              if (touches) dinoMask[idx] = 1;
            }
          }
        }
      }
    }

    // Measure character bounding box
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

    extractedFigures.push({
      id: box.id,
      buf: outBuf,
      width: trimmedW,
      height: trimmedH
    });
    console.log(`Extracted figure ${box.id}: ${trimmedW}x${trimmedH}`);
  }

  // Canonical canvas dimensions: 128 x 112
  const targetW = 128, targetH = 112;

  function placeOnCanvas(fig, contactRow = 103, xOffset = 0) {
    const { buf, width, height } = fig;
    const canvas = Buffer.alloc(targetW * targetH * 4);

    // Find character center and bottom
    let minX = width, maxX = 0, minY = height, maxY = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (buf[idx + 3] > 40) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const charCenterX = (minX + maxX) / 2;
    const destXOffset = Math.round(64 - charCenterX) + xOffset;
    const destYOffset = contactRow - maxY;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const sIdx = (y * width + x) * 4;
        if (buf[sIdx + 3] > 15) {
          const dx = x + destXOffset;
          const dy = y + destYOffset;
          if (dx >= 0 && dx < targetW && dy >= 0 && dy < targetH) {
            const dIdx = (dy * targetW + dx) * 4;
            canvas[dIdx] = buf[sIdx];
            canvas[dIdx + 1] = buf[sIdx + 1];
            canvas[dIdx + 2] = buf[sIdx + 2];
            canvas[dIdx + 3] = buf[sIdx + 3];
          }
        }
      }
    }

    // If contactRow is 103 (ground contact), ensure solid row 103 under the supporting foot
    if (contactRow === 103) {
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
    }

    return canvas;
  }

  // Build the 6 frames of the natural alternating running cycle:
  //
  // Stride A (Near leg leading):
  // - Frame 0: Contact A (Fig 1: Near leg forward, foot contacts ground row 103; Far leg back)
  const frame0 = placeOnCanvas(extractedFigures[0], 103, 0);

  // - Frame 1: Down / Support A (Fig 2: Near leg supporting body on ground row 103; Far leg swinging forward under belly)
  const frame1 = placeOnCanvas(extractedFigures[1], 103, 0);

  // - Frame 2: Push-off / Extension A (Fig 3: Near leg pushes off, Far leg extending forward in air; body lifts slightly)
  const frame2 = placeOnCanvas(extractedFigures[2], 102, 0);

  // Stride B (Far leg leading):
  // - Frame 3: Contact B (Fig 4: Far leg forward, foot contacts ground row 103; Near leg trailing back)
  const frame3 = placeOnCanvas(extractedFigures[3], 103, 0);

  // - Frame 4: Down / Support B (Fig 5: Far leg supporting on ground row 103; Near leg swinging forward under hip)
  const frame4 = placeOnCanvas(extractedFigures[4], 103, 0);

  // - Frame 5: Push-off / Recovery B (Flight transition: Far leg pushes off behind; Near leg extends forward smoothly preparing to plant for Frame 0)
  // Body is in flight phase at row 101, lifting naturally to loop back to Frame 0
  const frame5 = placeOnCanvas(extractedFigures[0], 101, 1);

  const runCycle = [frame0, frame1, frame2, frame3, frame4, frame5];

  for (let i = 0; i < runCycle.length; i++) {
    const fPath = path.join(__dirname, 'assets', 'sprites', `dino_run_${i}.png`);
    await sharp(runCycle[i], { raw: { width: targetW, height: targetH, channels: 4 } }).png().toFile(fPath);
    console.log(`Saved dino_run_${i}.png`);
  }

  console.log('\n Flawless 6-frame run cycle created successfully!');
}

generateFlawlessRunCycle().catch(console.error);
