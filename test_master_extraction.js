const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function testMasterExtraction() {
  const refPath = path.join(__dirname, 'assets', 'style1_reference.jpg');
  const { data: refData, info: refInfo } = await sharp(refPath).raw().toBuffer({ resolveWithObject: true });
  const W = refInfo.width, H = refInfo.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [refData[idx], refData[idx + 1], refData[idx + 2]];
  }

  function isCharacterPixel(absX, absY, groundY, isDead = false) {
    if (groundY && absY > groundY) return false;
    const [r, g, b] = getPixel(absX, absY);

    // Desert sand floor check (below feet / ground line)
    if (groundY && absY >= groundY - 5) {
      // Sand tan/peach: R > 200, G in [160..215], B in [120..180], R - G > 25, R - B > 45
      if (r > 195 && g >= 150 && g <= 220 && b >= 115 && b <= 185 && (r - g >= 25) && (r - b >= 45)) return false;
      // Ground shadow: R in [130..190], G in [95..145], B in [65..110]
      if (r > 120 && g < 155 && b < 120 && r > g + 25 && g > b + 15 && !(g > r)) return false;
    }

    // Dead star/swirls or impact spark
    if (isDead) {
      if (r > 180 && g > 140 && b < 130) return true; // star/dazed
      if (r < 75 && g < 80 && b < 80 && absY < 595) return true; // swirl
    }
    // Hit impact sparks
    if (r > 200 && g > 160 && b < 120) return true;

    // Green skin & limbs
    if ((g > r + 8 && g > b + 8 && g > 38) || (g > 75 && g > r && g > b + 10)) return true;

    // Dark spines, scutes, eyebrows, pupils, outlines
    if (r < 75 && g < 85 && b < 75 && (r > 5 || g > 5 || b > 5)) return true;

    // Cream / light-yellow belly, throat, chin, chest
    if (r > 165 && g > 150 && r > b + 15 && g > b + 15 && Math.abs(r - g) <= 35) return true;

    // Eye white (sclera)
    if (r > 195 && g > 195 && b > 190 && (!groundY || absY < groundY - 20)) return true;

    // Mouth interior / tongue (coral pink)
    if (r > 120 && g < 120 && b < 130 && r > g + 15) return true;

    // Claws / toenails (pale cream on toes)
    if (r > 185 && g > 175 && b < 175 && g - b > 10 && (!groundY || (absY >= groundY - 14 && absY <= groundY))) return true;

    return false;
  }

  function extractFrame({ minX, maxX, minY, maxY, groundY, isDead = false }) {
    // Add 4px margin so we don't clip tail or head
    const padL = Math.max(0, minX - 6);
    const padR = Math.min(W - 1, maxX + 6);
    const padT = Math.max(0, minY - 6);
    const padB = Math.min(H - 1, maxY + 4);

    const cropW = padR - padL + 1;
    const cropH = padB - padT + 1;

    // Build mask of character pixels
    const mask = new Uint8Array(cropW * cropH);
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        if (isCharacterPixel(padL + x, padT + y, groundY, isDead)) {
          mask[y * cropW + x] = 1;
        }
      }
    }

    // Connected components: keep components that belong to the character
    const labels = new Int32Array(cropW * cropH).fill(-1);
    const sizes = [];
    let curL = 0;
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        if (mask[idx] === 1 && labels[idx] === -1) {
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

    // For dead dino or hit, include nearby stars/sparks if within 25px
    const finalMask = new Uint8Array(cropW * cropH);
    for (let i = 0; i < cropW * cropH; i++) {
      if (labels[i] === maxL) {
        finalMask[i] = 1;
      } else if ((isDead || groundY === 635) && labels[i] !== -1 && sizes[labels[i]] > 10) {
        finalMask[i] = 1; // Include stars / sparks / swirls
      }
    }

    // Measure exact bounds of segmented character
    let cMinX = cropW, cMaxX = 0, cMinY = cropH, cMaxY = 0;
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        if (finalMask[y * cropW + x] === 1) {
          if (x < cMinX) cMinX = x;
          if (x > cMaxX) cMaxX = x;
          if (y < cMinY) cMinY = y;
          if (y > cMaxY) cMaxY = y;
        }
      }
    }

    // Canonical canvas size: 128x112, ground baseline at y = 103
    const targetW = 128, targetH = 112;
    const outBuf = Buffer.alloc(targetW * targetH * 4);

    // Baseline alignment:
    // If groundY is provided, the ground line aligns to target canvas row 103!
    // That means: (groundY - padT) on crop corresponds to row 103!
    // For mid-air poses (jump 2), align relative to jump apex
    let destYOffset = 0;
    if (groundY) {
      const cropGroundY = groundY - padT;
      destYOffset = 103 - cropGroundY;
    } else {
      destYOffset = Math.round(50 - (cMinY + cMaxY) / 2);
    }

    // X alignment: center character body around x = 60
    const charCenterX = (cMinX + cMaxX) / 2;
    const destXOffset = Math.round(62 - charCenterX);

    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        if (finalMask[y * cropW + x] === 1) {
          const destX = x + destXOffset;
          const destY = y + destYOffset;
          if (destX >= 0 && destX < targetW && destY >= 0 && destY < targetH) {
            const dIdx = (destY * targetW + destX) * 4;
            const [r, g, b] = getPixel(padL + x, padT + y);

            // De-matte semi-transparent edge pixels against sky/ground:
            // Check if touches background in 8-neighborhood
            let touchesBg = false;
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || nx >= cropW || ny < 0 || ny >= cropH || finalMask[ny * cropW + nx] === 0) {
                touchesBg = true;
                break;
              }
            }

            let alpha = 255;
            let outR = r, outG = g, outB = b;
            if (touchesBg) {
              // Edge smoothing: soften border without creating white halo
              // If border pixel picked up cyan sky (b > r + 20 and b > 140):
              if (b > r + 15 && b > 130 && !(r < 65 && g < 65 && b < 65)) {
                alpha = 180;
              }
            }

            outBuf[dIdx] = outR;
            outBuf[dIdx + 1] = outG;
            outBuf[dIdx + 2] = outB;
            outBuf[dIdx + 3] = alpha;
          }
        }
      }
    }

    return outBuf;
  }

  // Test extraction of 5 test frames
  const testFrames = [
    { name: 'test_dino_idle_0', minX: 14, maxX: 120, minY: 194, maxY: 295, groundY: 295 },
    { name: 'test_dino_jump_0', minX: 12, maxX: 100, minY: 395, maxY: 476, groundY: 476 },
    { name: 'test_dino_duck_0', minX: 522, maxX: 614, minY: 385, maxY: 474, groundY: 474 },
    { name: 'test_dino_hit', minX: 112, maxX: 198, minY: 552, maxY: 635, groundY: 635 },
    { name: 'test_dino_dead', minX: 260, maxX: 370, minY: 552, maxY: 635, groundY: 635, isDead: true }
  ];

  for (const f of testFrames) {
    const buf = extractFrame(f);
    await sharp(buf, { raw: { width: 128, height: 112, channels: 4 } })
      .png()
      .toFile(f.name + '.png');
    console.log(`Saved ${f.name}.png`);
  }

  // Montage on sky blue with red baseline at y = 103
  const bg = { r: 77, g: 166, b: 255, alpha: 1 };
  const W_CANVAS = 128 * 5 + 60, H_CANVAS = 112 + 30;
  const compositeList = testFrames.map((f, i) => ({
    input: f.name + '.png',
    left: i * 138 + 10,
    top: 10
  }));

  const montageCanvas = await sharp({
    create: { width: W_CANVAS, height: H_CANVAS, channels: 4, background: bg }
  }).composite(compositeList).png().toBuffer();

  const { data: mData, info: mInfo } = await sharp(montageCanvas).raw().toBuffer({ resolveWithObject: true });
  const redY = 10 + 103;
  for (let x = 0; x < mInfo.width; x++) {
    const idx = (redY * mInfo.width + x) * 4;
    mData[idx] = 255; mData[idx+1] = 0; mData[idx+2] = 0; mData[idx+3] = 255;
  }

  await sharp(mData, { raw: { width: mInfo.width, height: mInfo.height, channels: 4 } })
    .png()
    .toFile('test_master_extraction_montage.png');
  console.log('Saved test_master_extraction_montage.png');
}

testMasterExtraction();
