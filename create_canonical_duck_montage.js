const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function createMontage() {
  const canvasW = 128, canvasH = 112;
  const run0 = await sharp(path.join('assets', 'sprites', 'dino_run_0.png')).raw().toBuffer({ resolveWithObject: true });

  const duckConfigs = [
    { name: 'clean_duck_0.png', left: 8 },
    { name: 'clean_duck_1.png', left: 8 },
    { name: 'clean_duck_2.png', left: 8 },
    { name: 'clean_duck_3.png', left: 8 },
    { name: 'clean_duck_4.png', left: 8 }
  ];

  const frames = [];
  // Frame 0: Run 0
  frames.push(path.join('assets', 'sprites', 'dino_run_0.png'));

  // Now create the 5 canonical duck frames
  for (let i = 0; i < duckConfigs.length; i++) {
    const cfg = duckConfigs[i];
    const imgData = await sharp(cfg.name).raw().toBuffer({ resolveWithObject: true });
    const imgW = imgData.info.width, imgH = imgData.info.height;

    // find maxY of foot
    let maxY = -1;
    for (let y = 0; y < imgH; y++) {
      for (let x = 0; x < imgW; x++) {
        if (imgData.data[(y * imgW + x) * 4 + 3] > 50) {
          if (y > maxY) maxY = y;
        }
      }
    }

    const top = 103 - maxY;
    console.log(`Frame ${i}: top = ${top}, left = ${cfg.left}, width = ${imgW}, height = ${imgH}`);

    const canvasBuf = Buffer.alloc(canvasW * canvasH * 4, 0);

    for (let y = 0; y < imgH; y++) {
      const cy = top + y;
      if (cy < 0 || cy >= canvasH) continue;
      for (let x = 0; x < imgW; x++) {
        const cx = cfg.left + x;
        if (cx < 0 || cx >= canvasW) continue;
        const srcIdx = (y * imgW + x) * 4;
        const dstIdx = (cy * canvasW + cx) * 4;
        canvasBuf[dstIdx] = imgData.data[srcIdx];
        canvasBuf[dstIdx + 1] = imgData.data[srcIdx + 1];
        canvasBuf[dstIdx + 2] = imgData.data[srcIdx + 2];
        canvasBuf[dstIdx + 3] = imgData.data[srcIdx + 3];
      }
    }

    const outPath = `test_duck_canonical_${i}.png`;
    await sharp(canvasBuf, { raw: { width: canvasW, height: canvasH, channels: 4 } })
      .png()
      .toFile(outPath);
    frames.push(outPath);
  }

  // Combine into a 6-frame montage on desert-sky background with a red ground line at row 103!
  const montageW = canvasW * 6;
  const montageH = canvasH;
  const compositeList = frames.map((f, idx) => ({
    input: f,
    left: idx * canvasW,
    top: 0
  }));

  // Create sky background
  const bg = Buffer.alloc(montageW * montageH * 4);
  for (let y = 0; y < montageH; y++) {
    for (let x = 0; x < montageW; x++) {
      const idx = (y * montageW + x) * 4;
      if (y === 103) {
        // Red ground line marker
        bg[idx] = 255; bg[idx + 1] = 0; bg[idx + 2] = 0; bg[idx + 3] = 255;
      } else if (y > 103) {
        // Sand
        bg[idx] = 245; bg[idx + 1] = 160; bg[idx + 2] = 30; bg[idx + 3] = 255;
      } else {
        // Sky
        bg[idx] = 77; bg[idx + 1] = 166; bg[idx + 2] = 255; bg[idx + 3] = 255;
      }
    }
  }

  await sharp(bg, { raw: { width: montageW, height: montageH, channels: 4 } })
    .composite(compositeList)
    .png()
    .toFile('test_duck_canonical_montage.png');
  console.log('Saved test_duck_canonical_montage.png');
}

createMontage();
