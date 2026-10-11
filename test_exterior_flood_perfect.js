const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function testExteriorFloodPerfect() {
  const refPath = path.join(__dirname, 'assets', 'style1_reference.jpg');
  const { data: refData, info: refInfo } = await sharp(refPath).raw().toBuffer({ resolveWithObject: true });
  const W = refInfo.width, H = refInfo.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [refData[idx], refData[idx + 1], refData[idx + 2]];
  }

  function extractSpriteWithExteriorFlood({ minX, maxX, minY, maxY, groundY, isDead = false }) {
    // 6px margin around the character bounds
    const padL = Math.max(0, minX - 6);
    const padR = Math.min(W - 1, maxX + 6);
    const padT = Math.max(0, minY - 6);
    const padB = Math.min(H - 1, maxY + 6);

    const cropW = padR - padL + 1;
    const cropH = padB - padT + 1;

    // A pixel is definite dinosaur body/boundary if:
    function isDinoBoundary(x, y) {
      const absX = padL + x, absY = padT + y;
      if (groundY && absY > groundY) return false;
      const [r, g, b] = getPixel(absX, absY);

      // Green skin / limb
      if ((g > r + 8 && g > b + 8 && g > 38) || (g > 75 && g > r && g > b + 10)) return true;
      // Dark spines / outline
      if (r < 75 && g < 85 && b < 75 && (r > 5 || g > 5 || b > 5)) return true;
      // Tongue
      if (r > 120 && g < 120 && b < 130 && r > g + 15) return true;
      // Toenails (claws)
      if (groundY && absY >= groundY - 14 && absY <= groundY) {
        if (r > 185 && g > 175 && b < 175 && g - b > 10) return true;
      }
      // Dead star or impact sparks
      if (isDead && r > 180 && g > 140 && b < 130) return true;
      if (!isDead && groundY === 635 && r > 200 && g > 160 && b < 120) return true; // hit spark

      return false;
    }

    // Grid: 0 = unvisited, 1 = exterior background, 2 = dinosaur
    const grid = new Uint8Array(cropW * cropH);

    // Flood fill from all 4 borders of the crop box
    const queue = [];
    for (let x = 0; x < cropW; x++) {
      for (const y of [0, cropH - 1]) {
        if (!isDinoBoundary(x, y)) {
          grid[y * cropW + x] = 1;
          queue.push([x, y]);
        }
      }
    }
    for (let y = 0; y < cropH; y++) {
      for (const x of [0, cropW - 1]) {
        if (!isDinoBoundary(x, y) && grid[y * cropW + x] === 0) {
          grid[y * cropW + x] = 1;
          queue.push([x, y]);
        }
      }
    }

    let head = 0;
    while (head < queue.length) {
      const [cx, cy] = queue[head++];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < cropW && ny >= 0 && ny < cropH) {
          const nIdx = ny * cropW + nx;
          if (grid[nIdx] === 0) {
            const absX = padL + nx, absY = padT + ny;
            // Also stop if groundY is reached
            if (groundY && absY > groundY) {
              grid[nIdx] = 1; // It's background below ground
              queue.push([nx, ny]);
            } else if (!isDinoBoundary(nx, ny)) {
              grid[nIdx] = 1;
              queue.push([nx, ny]);
            }
          }
        }
      }
    }

    // Every pixel NOT visited by exterior flood (grid === 0) is part of the dinosaur!
    // This guarantees 100% full cream belly, white eyes, and inside features!
    // Now, measure bounds:
    let minDinoX = cropW, maxDinoX = 0, minDinoY = cropH, maxDinoY = 0;
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        if (grid[y * cropW + x] === 0) {
          if (x < minDinoX) minDinoX = x;
          if (x > maxDinoX) maxDinoX = x;
          if (y < minDinoY) minDinoY = y;
          if (y > maxDinoY) maxDinoY = y;
        }
      }
    }

    // Standardized 128x112 canonical canvas, baseline aligned at y = 103
    const targetW = 128, targetH = 112;
    const outBuf = Buffer.alloc(targetW * targetH * 4);

    let destYOffset = 0;
    if (groundY) {
      const cropGroundY = groundY - padT;
      destYOffset = 103 - cropGroundY;
    } else {
      destYOffset = Math.round(50 - (minDinoY + maxDinoY) / 2);
    }

    const charCenterX = (minDinoX + maxDinoX) / 2;
    const destXOffset = Math.round(62 - charCenterX);

    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        if (grid[y * cropW + x] === 0) {
          const destX = x + destXOffset;
          const destY = y + destYOffset;
          if (destX >= 0 && destX < targetW && destY >= 0 && destY < targetH) {
            const dIdx = (destY * targetW + destX) * 4;
            const [r, g, b] = getPixel(padL + x, padT + y);

            // Clean anti-aliased edge:
            // Check if touches background
            let touchesBg = false;
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || nx >= cropW || ny < 0 || ny >= cropH || grid[ny * cropW + nx] === 1) {
                touchesBg = true;
                break;
              }
            }

            let a = 255;
            let outR = r, outG = g, outB = b;
            if (touchesBg) {
              // De-matte blue sky halo on perimeter:
              if (b > r + 15 && b > 120 && !(r < 65 && g < 65 && b < 65)) {
                // If it's pure sky bleed on green edge, shift B towards G
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

  const testFrames = [
    { name: 'flood_idle_0', minX: 14, maxX: 120, minY: 194, maxY: 295, groundY: 295 },
    { name: 'flood_jump_0', minX: 12, maxX: 100, minY: 395, maxY: 476, groundY: 476 },
    { name: 'flood_duck_0', minX: 522, maxX: 614, minY: 385, maxY: 474, groundY: 474 },
    { name: 'flood_hit', minX: 112, maxX: 198, minY: 552, maxY: 635, groundY: 635 },
    { name: 'flood_dead', minX: 260, maxX: 370, minY: 552, maxY: 635, groundY: 635, isDead: true }
  ];

  for (const f of testFrames) {
    const buf = extractSpriteWithExteriorFlood(f);
    await sharp(buf, { raw: { width: 128, height: 112, channels: 4 } })
      .png()
      .toFile(f.name + '.png');
    console.log(`Saved ${f.name}.png`);
  }

  // Composite montage
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
    .toFile('flood_perfect_montage.png');
  console.log('Saved flood_perfect_montage.png');
}

testExteriorFloodPerfect();
