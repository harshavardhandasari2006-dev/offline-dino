const sharp = require('sharp');
const fs = require('fs');

async function testFloodFill() {
  const { data, info } = await sharp('assets/extracted/panel_run.jpg').raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  // Let's test on Dino 1: x from 115 to 215, y from 35 to 142
  const minX = 114, maxX = 214;
  const minY = 35, maxY = 142;
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  // Build a 2D grid for the crop
  const mask = new Uint8Array(cropW * cropH); // 0 = unknown, 1 = background, 2 = dino

  function isDefiniteDino(r, g, b) {
    // Green body
    if (g > r + 15 && g > b + 15) return true;
    // Dark spine / eye pupil / dark outline
    if (r < 65 && g < 75 && b < 65) return true;
    // Red mouth
    if (r > 150 && g < 100 && b < 110) return true;
    // Belly cream (inside dino): R > 190, G > 180, B < 190, R & G close
    if (r > 190 && g > 180 && b < 190 && Math.abs(r - g) < 30 && r > b + 25) return true;
    return false;
  }

  function isDefiniteBackground(r, g, b, localY) {
    // Sky: cyan/blue (B is high and B > R + 10)
    if (b > 210 && b > r + 10) return true;
    if (b > 230 && g > 210 && r > 180) return true; // white cloud
    // Ground below feet: in panel_run, feet end around y=128
    if (localY > 93) { // localY is y - minY (128 - 35 = 93)
      // Ground peach/tan or shadow or white label
      if (r > 220 && g > 180 && b > 140) return true;
      if (r > 160 && g > 120 && b > 90 && Math.abs(r - g) > 25) return true; // ground shadow
      if (r > 230 && g > 230 && b > 230) return true; // white label
    }
    // Distant mesa behind: R > 200, G ~ 170-195, B ~ 160-190, R > G + 15
    if (r > 190 && g < 195 && b < 190 && r > g + 15 && r > b + 15 && localY < 90) {
      // But ensure it's not dino belly!
      // Mesa has low saturation and reddish, whereas dino belly has G almost equal to R and high lightness
      if (r - g > 30) return true;
    }
    return false;
  }

  // Flood fill from border
  const queue = [];
  for (let x = 0; x < cropW; x++) {
    queue.push([x, 0]);
    queue.push([x, cropH - 1]);
    mask[0 * cropW + x] = 1;
    mask[(cropH - 1) * cropW + x] = 1;
  }
  for (let y = 0; y < cropH; y++) {
    queue.push([0, y]);
    queue.push([cropW - 1, y]);
    mask[y * cropW + 0] = 1;
    mask[y * cropW + (cropW - 1)] = 1;
  }

  let head = 0;
  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    const neighbors = [
      [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= cropW || ny < 0 || ny >= cropH) continue;
      const nIdx = ny * cropW + nx;
      if (mask[nIdx] !== 0) continue;

      const imgIdx = ((minY + ny) * w + (minX + nx)) * 3;
      const r = data[imgIdx], g = data[imgIdx + 1], b = data[imgIdx + 2];

      if (isDefiniteDino(r, g, b)) {
        // Stop, don't expand into dino
        continue;
      }

      // Check if it's background
      mask[nIdx] = 1;
      queue.push([nx, ny]);
    }
  }

  // Create RGBA image
  const outBuf = Buffer.alloc(cropW * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const m = mask[y * cropW + x];
      const imgIdx = ((minY + y) * w + (minX + x)) * 3;
      const outIdx = (y * cropW + x) * 4;
      outBuf[outIdx] = data[imgIdx];
      outBuf[outIdx + 1] = data[imgIdx + 1];
      outBuf[outIdx + 2] = data[imgIdx + 2];
      outBuf[outIdx + 3] = (m === 1) ? 0 : 255;
    }
  }

  await sharp(outBuf, { raw: { width: cropW, height: cropH, channels: 4 } })
    .png()
    .toFile('assets/test_dino_run_1.png');

  console.log('Saved assets/test_dino_run_1.png');
}

testFloodFill();
