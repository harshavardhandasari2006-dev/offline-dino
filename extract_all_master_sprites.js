const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function extractAllMasterSprites() {
  console.log('=== EXTRACTING FLAWLESS MASTER SPRITES ===\n');

  const refPath = path.join(__dirname, 'assets', 'style1_reference.jpg');
  const { data: refData, info: refInfo } = await sharp(refPath).raw().toBuffer({ resolveWithObject: true });
  const W = refInfo.width, H = refInfo.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [refData[idx], refData[idx + 1], refData[idx + 2]];
  }

  function isCharacterPixel(absX, absY, groundY, isDead = false, isHit = false, headEyeArea = null) {
    if (groundY && absY > groundY) return false;
    const [r, g, b] = getPixel(absX, absY);

    // Reject cyan sky background universally:
    if (b > r + 15 && b > 145) return false;
    if (b > 215 && g > 210) return false;

    // Reject cactus next to dino_hit (absX > 203)
    if (isHit && absX > 203) return false;

    // Reject ground sand / shadow ONLY near the ground baseline:
    if (groundY && absY >= groundY - 6) {
      if (r > 190 && g >= 140 && g <= 225 && b >= 90 && b <= 185 && (r - g >= 18) && (r - b >= 35) && !(g > r)) return false;
      if (r > 120 && g < 155 && b < 120 && r > g + 20 && g > b + 15 && !(g > r)) return false;
    }

    // Dead star/swirls or impact spark
    if (isDead) {
      if (r > 180 && g > 140 && b < 130) return true; // star/dazed
      if (r < 75 && g < 80 && b < 80 && absY < 595) return true; // swirl
    }
    if (isHit && r > 200 && g > 160 && b < 120) return true; // impact spark

    // Green skin & limbs
    if ((g > r + 6 && g > b + 6 && g > 36) || (g > 70 && g > r && g > b + 8)) return true;

    // Dark spines, scutes, eyebrows, pupils, nostrils, dark outlines
    if (r < 75 && g < 85 && b < 75 && (r > 4 || g > 4 || b > 4)) return true;

    // Cream / light-yellow belly, throat, chin, chest
    if (r > 155 && g > 135 && r > b + 15 && g > b + 15 && (r - g <= 60)) return true;

    // Mouth interior / tongue / lips (coral pink)
    if (r > 100 && g < 125 && b < 130 && r > g + 15) return true;
    if (r > 60 && r < 150 && g < 70 && b < 70) return true; // dark mouth cavity

    // Eye white (sclera) — STRICTLY neutral white inside headEyeArea (never cyan sky!)
    if (headEyeArea && absX >= headEyeArea.minX && absX <= headEyeArea.maxX && absY >= headEyeArea.minY && absY <= headEyeArea.maxY) {
      if (r > 195 && g > 195 && b > 185 && Math.abs(r - b) <= 14 && Math.abs(g - b) <= 14) return true;
      if (r < 75 && g < 75 && b < 75) return true; // pupil
    }

    // Claws / toenails (pale cream on toes near ground)
    if (r > 180 && g > 170 && b < 175 && g - b > 8 && (!groundY || (absY >= groundY - 14 && absY <= groundY))) return true;

    return false;
  }

  function extractSprite({ minX, maxX, minY, maxY, groundY, isDead = false, isHit = false, headEyeArea = null }) {
    const padL = Math.max(0, minX - 6);
    const padR = Math.min(W - 1, maxX + 6);
    const padT = Math.max(0, minY - 6);
    const padB = Math.min(H - 1, maxY + 6);
    const cW = padR - padL + 1;
    const cH = padB - padT + 1;

    const mask = new Uint8Array(cW * cH);
    for (let y = 0; y < cH; y++) {
      for (let x = 0; x < cW; x++) {
        const absX = padL + x, absY = padT + y;
        if (isCharacterPixel(absX, absY, groundY, isDead, isHit, headEyeArea)) {
          mask[y * cW + x] = 1;
        }
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

    const finalMask = new Uint8Array(cW * cH);
    for (let i = 0; i < cW * cH; i++) {
      if (labels[i] === maxL) {
        finalMask[i] = 1;
      } else if ((isDead || isHit) && labels[i] !== -1 && sizes[labels[i]] > 10) {
        finalMask[i] = 1; // Stars / sparks
      }
    }

    // Dino bounds
    let minDinoX = cW, maxDinoX = 0, minDinoY = cH, maxDinoY = 0;
    for (let y = 0; y < cH; y++) {
      for (let x = 0; x < cW; x++) {
        if (finalMask[y * cW + x] === 1) {
          if (x < minDinoX) minDinoX = x;
          if (x > maxDinoX) maxDinoX = x;
          if (y < minDinoY) minDinoY = y;
          if (y > maxDinoY) maxDinoY = y;
        }
      }
    }

    const targetW = 128, targetH = 112;
    const outBuf = Buffer.alloc(targetW * targetH * 4);

    let destYOffset = 0;
    if (groundY) {
      const cropGroundY = groundY - padT;
      destYOffset = 103 - cropGroundY;
    } else {
      destYOffset = Math.round(52 - (minDinoY + maxDinoY) / 2);
    }

    const charCenterX = (minDinoX + maxDinoX) / 2;
    const destXOffset = Math.round(62 - charCenterX);

    for (let y = 0; y < cH; y++) {
      for (let x = 0; x < cW; x++) {
        if (finalMask[y * cW + x] === 1) {
          const destX = x + destXOffset;
          const destY = y + destYOffset;
          if (destX >= 0 && destX < targetW && destY >= 0 && destY < targetH) {
            const dIdx = (destY * targetW + destX) * 4;
            const [r, g, b] = getPixel(padL + x, padT + y);

            let touchesBg = false;
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || nx >= cW || ny < 0 || ny >= cH || finalMask[ny * cW + nx] === 0) {
                touchesBg = true;
                break;
              }
            }

            let a = 255;
            let outR = r, outG = g, outB = b;
            if (touchesBg) {
              // De-matte blue sky halo on perimeter:
              if (b > r + 15 && b > 120 && !(r < 65 && g < 65 && b < 65)) {
                outB = Math.min(outB, Math.round((r + g) / 2));
                a = 210;
              }
              // De-matte sand shadow on feet:
              if (y > maxDinoY - 3 && r > 180 && g > 150 && b < 160 && (r - g > 25)) {
                a = 180;
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

  const outDir = path.join(__dirname, 'assets', 'sprites');

  // --- 1. EXTRACT IDLE SPRITES (Panel 1) ---
  console.log('1. Extracting Idle sprites...');
  const idleConfigs = [
    { name: 'dino_idle_0', minX: 14, maxX: 120, minY: 194, maxY: 298, groundY: 298, headEyeArea: { minX: 60, maxX: 110, minY: 200, maxY: 250 } },
    { name: 'dino_idle_1', minX: 128, maxX: 234, minY: 194, maxY: 298, groundY: 298, headEyeArea: { minX: 170, maxX: 225, minY: 200, maxY: 250 } },
    { name: 'dino_idle_2', minX: 238, maxX: 342, minY: 194, maxY: 298, groundY: 298, headEyeArea: { minX: 280, maxX: 335, minY: 200, maxY: 250 } },
    { name: 'dino_idle_3', minX: 350, maxX: 458, minY: 194, maxY: 298, groundY: 298, headEyeArea: { minX: 390, maxX: 450, minY: 200, maxY: 250 } }
  ];
  for (const cfg of idleConfigs) {
    const buf = extractSprite(cfg);
    await sharp(buf, { raw: { width: 128, height: 112, channels: 4 } }).png().toFile(path.join(outDir, cfg.name + '.png'));
    console.log(`  ✓ ${cfg.name}.png`);
  }

  // --- 2. EXTRACT JUMP SPRITES (Panel 3) ---
  console.log('2. Extracting Jump sprites...');
  const jumpConfigs = [
    { name: 'dino_jump_0', minX: 12, maxX: 104, minY: 390, maxY: 476, groundY: 476, headEyeArea: { minX: 55, maxX: 100, minY: 400, maxY: 445 } },
    { name: 'dino_jump_1', minX: 116, maxX: 204, minY: 360, maxY: 471, groundY: 471, headEyeArea: { minX: 155, maxX: 200, minY: 365, maxY: 415 } },
    { name: 'dino_jump_2', minX: 218, maxX: 306, minY: 348, maxY: 450, groundY: null, headEyeArea: { minX: 260, maxX: 304, minY: 350, maxY: 400 } },
    { name: 'dino_jump_3', minX: 312, maxX: 406, minY: 380, maxY: 473, groundY: 473, headEyeArea: { minX: 355, maxX: 404, minY: 385, maxY: 435 } },
    { name: 'dino_jump_4', minX: 410, maxX: 504, minY: 395, maxY: 476, groundY: 476, headEyeArea: { minX: 455, maxX: 502, minY: 400, maxY: 445 } }
  ];
  for (const cfg of jumpConfigs) {
    const buf = extractSprite(cfg);
    await sharp(buf, { raw: { width: 128, height: 112, channels: 4 } }).png().toFile(path.join(outDir, cfg.name + '.png'));
    console.log(`  ✓ ${cfg.name}.png`);
  }

  // --- 3. EXTRACT DUCK SPRITES (Panel 4) ---
  console.log('3. Extracting Duck sprites...');
  const duckConfigs = [
    { name: 'dino_duck_0', minX: 520, maxX: 616, minY: 380, maxY: 474, groundY: 474, headEyeArea: { minX: 565, maxX: 612, minY: 390, maxY: 440 } },
    { name: 'dino_duck_1', minX: 622, maxX: 720, minY: 405, maxY: 474, groundY: 474, headEyeArea: { minX: 665, maxX: 715, minY: 415, maxY: 460 } },
    { name: 'dino_duck_2', minX: 726, maxX: 820, minY: 410, maxY: 474, groundY: 474, headEyeArea: { minX: 765, maxX: 816, minY: 420, maxY: 465 } },
    { name: 'dino_duck_3', minX: 828, maxX: 918, minY: 415, maxY: 474, groundY: 474, headEyeArea: { minX: 865, maxX: 915, minY: 425, maxY: 470 } },
    { name: 'dino_duck_4', minX: 924, maxX: 1018, minY: 380, maxY: 474, groundY: 474, headEyeArea: { minX: 965, maxX: 1015, minY: 390, maxY: 440 } }
  ];
  for (const cfg of duckConfigs) {
    const buf = extractSprite(cfg);
    await sharp(buf, { raw: { width: 128, height: 112, channels: 4 } }).png().toFile(path.join(outDir, cfg.name + '.png'));
    console.log(`  ✓ ${cfg.name}.png`);
  }

  // --- 4. EXTRACT HIT & DEAD (Panel 5) ---
  console.log('4. Extracting Hit & Dead sprites...');
  const collConfigs = [
    { name: 'dino_hit', minX: 110, maxX: 203, minY: 545, maxY: 631, groundY: 631, isHit: true, headEyeArea: { minX: 155, maxX: 195, minY: 550, maxY: 600 } },
    { name: 'dino_dead', minX: 255, maxX: 385, minY: 545, maxY: 633, groundY: 633, isDead: true }
  ];
  for (const cfg of collConfigs) {
    const buf = extractSprite(cfg);
    await sharp(buf, { raw: { width: 128, height: 112, channels: 4 } }).png().toFile(path.join(outDir, cfg.name + '.png'));
    console.log(`  ✓ ${cfg.name}.png`);
  }

  console.log('\nAll master sprites cleanly extracted!');
}

extractAllMasterSprites();
