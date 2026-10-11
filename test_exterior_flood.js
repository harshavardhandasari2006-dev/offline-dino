const sharp = require('sharp');
const fs = require('fs');

async function testExteriorFlood() {
  const { data, info } = await sharp('ref_panel_1_idle.png').raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  // Let's test on the first dinosaur in ref_panel_1_idle:
  // Dinosaur 0 is around x: [10..120], y: [45..150]
  const minX = 10, maxX = 125;
  const minY = 35, maxY = 155;
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  // Ground line for Idle 0:
  // Feet soles/toenails end around y = 148 in ref_panel_1_idle
  const groundY = 148;

  function isCharacter(x, y) {
    if (x < minX || x > maxX || y < minY || y > maxY) return false;
    if (y > groundY) return false; // Below ground is sand/shadow

    const idx = (y * W + x) * 3;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];

    // Green body / limbs / tail
    if ((g > r + 10 && g > b + 10 && g > 45) || (g > 80 && g > r && g > b + 15)) return true;
    // Dark spines / outline
    if (r < 75 && g < 85 && b < 75 && (r > 5 || g > 5 || b > 5)) return true;
    // Cream chin / throat / belly
    if (r > 175 && g > 155 && r > b + 20 && g > b + 15) return true;
    // White eye
    if (r > 200 && g > 200 && b > 195 && y < 115) return true;
    // Black pupil
    if (r < 60 && g < 60 && b < 60 && y < 115) return true;
    // Mouth / tongue
    if (r > 120 && g < 120 && b < 130 && r > g + 15) return true;
    // Claws / toenails
    if (r > 190 && g > 180 && b < 170 && g - b > 15 && y >= 135 && y <= groundY) return true;

    return false;
  }

  // Flood fill from borders of crop to identify exterior background
  const isBg = new Uint8Array(cropW * cropH);
  const queue = [];

  for (let x = 0; x < cropW; x++) {
    for (const y of [0, cropH - 1]) {
      const absX = minX + x, absY = minY + y;
      if (!isCharacter(absX, absY)) {
        isBg[y * cropW + x] = 1;
        queue.push([x, y]);
      }
    }
  }
  for (let y = 0; y < cropH; y++) {
    for (const x of [0, cropW - 1]) {
      const absX = minX + x, absY = minY + y;
      if (!isCharacter(absX, absY) && !isBg[y * cropW + x]) {
        isBg[y * cropW + x] = 1;
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
        if (!isBg[nIdx]) {
          const absX = minX + nx, absY = minY + ny;
          if (!isCharacter(absX, absY)) {
            isBg[nIdx] = 1;
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  // Anything not marked as background is foreground!
  const outBuf = Buffer.alloc(cropW * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const idx = y * cropW + x;
      const oIdx = idx * 4;
      if (!isBg[idx]) {
        const absX = minX + x, absY = minY + y;
        const sIdx = (absY * W + absX) * 3;
        outBuf[oIdx] = data[sIdx];
        outBuf[oIdx + 1] = data[sIdx + 1];
        outBuf[oIdx + 2] = data[sIdx + 2];
        outBuf[oIdx + 3] = 255;
      }
    }
  }

  await sharp(outBuf, { raw: { width: cropW, height: cropH, channels: 4 } })
    .png()
    .toFile('test_flood_idle_0.png');
  console.log('Saved test_flood_idle_0.png');
}

testExteriorFlood();
