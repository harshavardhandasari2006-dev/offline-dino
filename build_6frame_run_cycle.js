const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function build6FrameRunCycle() {
  console.log('=== BUILDING PERFECT 6-FRAME RUN CYCLE ===\n');

  // Load the 5 clean figures
  const figs = [];
  for (let i = 1; i <= 5; i++) {
    const { data, info } = await sharp(`sandless_fig_${i}.png`).raw().toBuffer({ resolveWithObject: true });
    figs.push({ data, width: info.width, height: info.height });
  }

  const targetW = 128, targetH = 112;

  // Helper to place a figure onto the 128x112 canonical canvas
  // aligned so its contact foot reaches row 103!
  function placeOnCanvas(fig, contactType, yOffsetAdj = 0) {
    const { data, width, height } = fig;
    const canvas = Buffer.alloc(targetW * targetH * 4);

    // Find character bounds and foot pixels
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let feetPixels = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (data[idx + 3] > 30) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;

          if (y >= 75) {
            const r = data[idx], g = data[idx+1], b = data[idx+2];
            const isGreen = (g > r + 6 && g > b + 6) || (g > 70 && g > r && g > b + 8);
            const isClaw = (r > 180 && g > 170 && b < 175 && g - b > 8);
            if (isGreen || isClaw) {
              feetPixels.push({ x, y, isClaw });
            }
          }
        }
      }
    }

    // Identify the contact foot based on contactType:
    // 'NEAR_FRONT': near forward foot (x in [minX .. minX + 50])
    // 'NEAR_SUPPORT': near supporting foot under hip (x in [minX + 15 .. minX + 55])
    // 'NEAR_PUSH': rear near foot (x in [minX + 35 .. maxX])
    // 'FAR_FRONT': far forward foot (x in [minX + 30 .. maxX])
    // 'FAR_SUPPORT': far supporting foot (x in [minX + 25 .. maxX])
    let candidatePixels = [];
    if (contactType === 'NEAR_FRONT') {
      candidatePixels = feetPixels.filter(p => p.x <= minX + 50);
    } else if (contactType === 'NEAR_SUPPORT') {
      candidatePixels = feetPixels.filter(p => p.x >= minX + 15 && p.x <= minX + 55);
    } else if (contactType === 'FAR_FRONT') {
      candidatePixels = feetPixels.filter(p => p.x >= minX + 30);
    } else if (contactType === 'FAR_SUPPORT') {
      candidatePixels = feetPixels.filter(p => p.x >= minX + 20 && p.x <= minX + 70);
    } else {
      candidatePixels = feetPixels;
    }

    if (candidatePixels.length === 0) candidatePixels = feetPixels;
    const footMaxY = Math.max(...candidatePixels.map(p => p.y));

    // Align footMaxY to row 103!
    const destYOffset = (103 - footMaxY) + yOffsetAdj;
    const charCenterX = (minX + maxX) / 2;
    const destXOffset = Math.round(62 - charCenterX);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const sIdx = (y * width + x) * 4;
        if (data[sIdx + 3] > 20) {
          const dx = x + destXOffset;
          const dy = y + destYOffset;
          if (dx >= 0 && dx < targetW && dy >= 0 && dy < targetH) {
            const dIdx = (dy * targetW + dx) * 4;
            canvas[dIdx] = data[sIdx];
            canvas[dIdx + 1] = data[sIdx + 1];
            canvas[dIdx + 2] = data[sIdx + 2];
            canvas[dIdx + 3] = data[sIdx + 3];
          }
        }
      }
    }

    // Ensure solid ground contact row 103
    for (let x = 25; x <= 85; x++) {
      const idx103 = (103 * targetW + x) * 4;
      const idx102 = (102 * targetW + x) * 4;
      if (canvas[idx102 + 3] > 100 && canvas[idx103 + 3] === 0) {
        canvas[idx103] = canvas[idx102];
        canvas[idx103 + 1] = canvas[idx102 + 1];
        canvas[idx103 + 2] = canvas[idx102 + 2];
        canvas[idx103 + 3] = 255;
      }
    }

    return canvas;
  }

  // Frame 0: Stride A Contact (Fig 1: Near foot planted forward at row 103)
  const frame0 = placeOnCanvas(figs[0], 'NEAR_FRONT', 0);

  // Frame 1: Stride A Down / Passing (Fig 2: Near foot fully supporting at row 103, Far leg swinging forward)
  const frame1 = placeOnCanvas(figs[1], 'NEAR_SUPPORT', 0);

  // Frame 2: Stride A Push-off / Extension (Fig 3: Near foot pushing off at row 103, Far leg reaching forward)
  const frame2 = placeOnCanvas(figs[2], 'NEAR_SUPPORT', 0);

  // Frame 3: Stride B Contact (Fig 5: Far foot planted forward at row 103, Near leg back)
  const frame3 = placeOnCanvas(figs[4], 'FAR_FRONT', 0);

  // Frame 4: Stride B Down / Passing (Fig 4: Far foot fully supporting at row 103, Near leg swinging forward)
  const frame4 = placeOnCanvas(figs[3], 'FAR_SUPPORT', 0);

  // Frame 5: Stride B Push-off / Recovery (Transition back to Frame 0):
  // Blending Fig 4's reaching near leg into Fig 1's forward contact position:
  // Using Fig 1 with 1px flight lift so near foot prepares to plant at Frame 0:
  const frame5 = placeOnCanvas(figs[0], 'NEAR_FRONT', -1);

  const frames = [frame0, frame1, frame2, frame3, frame4, frame5];

  for (let i = 0; i < frames.length; i++) {
    const fPath = path.join(__dirname, 'assets', 'sprites', `dino_run_${i}.png`);
    await sharp(frames[i], { raw: { width: targetW, height: targetH, channels: 4 } }).png().toFile(fPath);
    console.log(`Saved dino_run_${i}.png`);
  }

  // Clean any unused frame 6 or 7
  for (const f of ['dino_run_6.png', 'dino_run_7.png']) {
    const p = path.join(__dirname, 'assets', 'sprites', f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  // Generate 6-frame contact sheet on sky blue with red baseline at row 103
  const bg = { r: 77, g: 166, b: 255, alpha: 1 };
  const montageW = (targetW + 10) * 6 + 10;
  const montageH = targetH + 30;

  const compositeList = [];
  for (let i = 0; i < 6; i++) {
    compositeList.push({
      input: path.join(__dirname, 'assets', 'sprites', `dino_run_${i}.png`),
      left: i * (targetW + 10) + 10,
      top: 10
    });
  }

  const canvas = await sharp({
    create: { width: montageW, height: montageH, channels: 4, background: bg }
  }).composite(compositeList).png().toBuffer();

  const { data: cData, info: cInfo } = await sharp(canvas).raw().toBuffer({ resolveWithObject: true });
  const redY = 10 + 103;
  for (let x = 0; x < cInfo.width; x++) {
    const idx = (redY * cInfo.width + x) * 4;
    cData[idx] = 255; cData[idx+1] = 0; cData[idx+2] = 0; cData[idx+3] = 255;
  }

  await sharp(cData, { raw: { width: cInfo.width, height: cInfo.height, channels: 4 } })
    .png()
    .toFile('contact_sheet_run_cycle_6frames.png');
  console.log('Saved contact_sheet_run_cycle_6frames.png');
}

build6FrameRunCycle();
