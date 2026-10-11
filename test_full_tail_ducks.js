const sharp = require('sharp');
const fs = require('fs');

async function extractFullTailDucks() {
  const { data: refData, info: refInfo } = await sharp('assets/style1_reference.jpg').raw().toBuffer({ resolveWithObject: true });
  const W = refInfo.width, H = refInfo.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [refData[idx], refData[idx + 1], refData[idx + 2]];
  }
  function isGreen(x, y) {
    const [r, g, b] = getPixel(x, y);
    return (g > r + 8 && g > b + 8 && g > 40) || (g > 85 && g > r && g > b + 15);
  }
  function isSpine(x, y) {
    const [r, g, b] = getPixel(x, y);
    return (r > 35 && r < 95 && g > 45 && g < 105 && b > 25 && b < 80);
  }
  function isBelly(x, y) {
    const [r, g, b] = getPixel(x, y);
    return (r > 190 && g > 185 && b > 140 && r > b + 25);
  }
  function isEyeOrMouth(x, y) {
    const [r, g, b] = getPixel(x, y);
    if (r < 45 && g < 45 && b < 45) return true;
    if (r > 200 && g > 200 && b > 200) return true;
    if (r > 140 && g < 90 && b < 90) return true;
    return false;
  }
  function isDino(x, y) {
    return isGreen(x, y) || isSpine(x, y) || isBelly(x, y) || isEyeOrMouth(x, y);
  }

  // Exact bounds of each dinosaur on reference image (y: 385..478)
  const boxes = [
    { name: 'duck_0', minX: 518, maxX: 625, groundY: 476, cx: 574 },
    { name: 'duck_1', minX: 622, maxX: 728, groundY: 476, cx: 677 },
    { name: 'duck_2', minX: 715, maxX: 830, groundY: 475, cx: 777 },
    { name: 'duck_3', minX: 818, maxX: 930, groundY: 475, cx: 879 },
    { name: 'duck_4', minX: 924, maxX: 1016, groundY: 478, cx: 975 }
  ];

  const canvasW = 128, canvasH = 112;

  // We want to place each dinosaur so that:
  // 1. refY = groundY maps to canvasY = 103!
  // 2. The horizontal foot contact point or center aligns with running dinosaur!
  // In dino_run_0, snout is at x ~ 105, tail is at x ~ 7.
  // In duck_2, width is 115px (maxX - minX = 830 - 715 = 115).
  // Placing minX at canvasX = 6 means tail starts at 6, snout is at 6 + 115 = 121 (perfect fit on 128px canvas!).

  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const buf = Buffer.alloc(canvasW * canvasH * 4, 0);

    // Let canvasX for minX be:
    // duck_0: width 107 -> left = 8
    // duck_1: width 106 -> left = 8
    // duck_2: width 115 -> left = 6
    // duck_3: width 112 -> left = 6
    // duck_4: width 92  -> left = 14
    let left = 8;
    if (i === 2 || i === 3) left = 6;
    if (i === 4) left = 14;

    for (let refY = 385; refY <= b.groundY; refY++) {
      const cy = 103 - (b.groundY - refY);
      if (cy < 0 || cy >= canvasH) continue;

      for (let refX = b.minX; refX <= b.maxX; refX++) {
        if (!isDino(refX, refY)) continue;

        // Skip any stray background artifacts or label arrows below y > groundY or near margins
        const [r, g, bCol] = getPixel(refX, refY);

        const cx = left + (refX - b.minX);
        if (cx < 0 || cx >= canvasW) continue;

        const idx = (cy * canvasW + cx) * 4;
        buf[idx] = r;
        buf[idx + 1] = g;
        buf[idx + 2] = bCol;
        buf[idx + 3] = 255;
      }
    }

    // Connected component flood fill from center to clean any stray disconnected grass tufts
    // Find center of dinosaur
    const startX = 64, startY = 103 - 20;
    const visited = new Uint8Array(canvasW * canvasH);
    const queue = [[startX, startY]];
    visited[startY * canvasW + startX] = 1;

    // First find any dino pixel near center if startX, startY is empty
    let foundSeed = false;
    for (let dy = -10; dy <= 10 && !foundSeed; dy++) {
      for (let dx = -20; dx <= 20 && !foundSeed; dx++) {
        const sx = startX + dx, sy = startY + dy;
        if (buf[(sy * canvasW + sx) * 4 + 3] > 0) {
          queue[0] = [sx, sy];
          visited[sy * canvasW + sx] = 1;
          foundSeed = true;
        }
      }
    }

    let head = 0;
    while (head < queue.length) {
      const [qx, qy] = queue[head++];
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
        const nx = qx + dx, ny = qy + dy;
        if (nx >= 0 && nx < canvasW && ny >= 0 && ny < canvasH) {
          const nidx = ny * canvasW + nx;
          if (!visited[nidx] && buf[nidx * 4 + 3] > 0) {
            visited[nidx] = 1;
            queue.push([nx, ny]);
          }
        }
      }
    }

    // Zero out any pixel not connected to main body
    for (let p = 0; p < canvasW * canvasH; p++) {
      if (!visited[p]) {
        buf[p * 4 + 3] = 0;
      }
    }

    await sharp(buf, { raw: { width: canvasW, height: canvasH, channels: 4 } })
      .png()
      .toFile(`full_tail_duck_${i}.png`);
    console.log(`Saved full_tail_duck_${i}.png`);
  }

  // Create montage
  const frames = [
    'assets/sprites/dino_run_0.png',
    'full_tail_duck_0.png',
    'full_tail_duck_1.png',
    'full_tail_duck_2.png',
    'full_tail_duck_3.png',
    'full_tail_duck_4.png'
  ];

  const montageW = canvasW * 6;
  const montageH = canvasH;
  const compositeList = frames.map((f, idx) => ({
    input: f,
    left: idx * canvasW,
    top: 0
  }));

  const bg = Buffer.alloc(montageW * montageH * 4);
  for (let y = 0; y < montageH; y++) {
    for (let x = 0; x < montageW; x++) {
      const idx = (y * montageW + x) * 4;
      if (y === 103) {
        bg[idx] = 255; bg[idx + 1] = 0; bg[idx + 2] = 0; bg[idx + 3] = 255;
      } else if (y > 103) {
        bg[idx] = 245; bg[idx + 1] = 160; bg[idx + 2] = 30; bg[idx + 3] = 255;
      } else {
        bg[idx] = 77; bg[idx + 1] = 166; bg[idx + 2] = 255; bg[idx + 3] = 255;
      }
    }
  }

  await sharp(bg, { raw: { width: montageW, height: montageH, channels: 4 } })
    .composite(compositeList)
    .png()
    .toFile('test_full_tail_montage.png');
  console.log('Saved test_full_tail_montage.png');
}

extractFullTailDucks();
