const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function buildMasterRunningSpriteSheet() {
  console.log('>>> Building Master Running Sprite Sheet (Transparent PNG)...');
  
  const rawMedia = 'C:/Users/asus/.gemini/antigravity-ide/brain/725d621e-d07c-4f21-8f91-759e3e9f3734/.user_uploaded/media_1791993115860.png';
  
  // 1. Crop bounds for the 8 dinosaurs in media_1791993115860.png:
  // Dino 1: x=[12..133], y=[120..220]
  // Dino 2: x=[138..255], y=[119..218]
  // Dino 3: x=[260..379], y=[119..220]
  // Dino 4: x=[389..505], y=[118..208]
  // Dino 5: x=[517..636], y=[118..217]
  // Dino 6: x=[642..759], y=[119..220]
  // Dino 7: x=[765..885], y=[119..218]
  // Dino 8: x=[890..1011], y=[119..217]
  
  const dinosSpec = [
    { id: 0, left: 10,  top: 116, width: 126, height: 108, pupilX: 98.3, pupilY: 23.7 },
    { id: 1, left: 136, top: 116, width: 122, height: 108, pupilX: 95.0, pupilY: 24.3 },
    { id: 2, left: 258, top: 116, width: 124, height: 108, pupilX: 96.6, pupilY: 23.8 },
    { id: 3, left: 386, top: 116, width: 122, height: 108, pupilX: 94.8, pupilY: 24.1 },
    { id: 4, left: 514, top: 116, width: 124, height: 108, pupilX: 97.2, pupilY: 24.0 },
    { id: 5, left: 640, top: 116, width: 122, height: 108, pupilX: 95.1, pupilY: 24.1 },
    { id: 6, left: 763, top: 116, width: 124, height: 108, pupilX: 97.3, pupilY: 24.0 },
    { id: 7, left: 888, top: 116, width: 126, height: 108, pupilX: 99.1, pupilY: 23.7 },
  ];

  const cleanedBuffers = [];

  for (const spec of dinosSpec) {
    const rawCrop = await sharp(rawMedia)
      .extract({ left: spec.left, top: spec.top, width: spec.width, height: spec.height })
      .raw()
      .toBuffer({ resolveWithObject: true });
      
    const w = rawCrop.info.width;
    const h = rawCrop.info.height;
    const buf = Buffer.from(rawCrop.data);

    // Eye restoration coordinates
    const eyeCx = spec.pupilX - 1.2;
    const eyeCy = spec.pupilY + 0.5;
    const rx = 8.5;
    const ry = 8.2;

    // 1. Fill eye socket sclera with 100% solid, fully opaque pure white (#FFFFFF)
    for (let y = Math.floor(eyeCy - ry); y <= Math.ceil(eyeCy + ry); y++) {
      for (let x = Math.floor(eyeCx - rx); x <= Math.ceil(eyeCx + rx); x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          const dx = (x - eyeCx) / rx;
          const dy = (y - eyeCy) / ry;
          if (dx * dx + dy * dy <= 1.0) {
            const idx = (y * w + x) * 4;
            const r = buf[idx];
            const g = buf[idx + 1];
            const b = buf[idx + 2];
            
            const isPupil = (r < 40 && g < 40 && b < 40);
            const isGlint = (r > 240 && g > 240 && b > 240 && x > eyeCx && y < eyeCy);
            
            if (!isPupil && !isGlint) {
              buf[idx] = 255;
              buf[idx + 1] = 255;
              buf[idx + 2] = 255;
              buf[idx + 3] = 255;
            } else {
              buf[idx + 3] = 255;
            }
          }
        }
      }
    }

    // 2. Erase background checkerboard & outside dust to alpha = 0
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = buf[idx];
        const g = buf[idx + 1];
        const b = buf[idx + 2];
        const diff = Math.max(r, g, b) - Math.min(r, g, b);

        // Achromatic checkerboard grey:
        if (diff <= 8 && r >= 110 && r <= 235) {
          buf[idx + 3] = 0;
        }

        // Outside white dust/scratches:
        if (r > 235 && g > 235 && b > 235) {
          const dx = (x - eyeCx) / rx;
          const dy = (y - eyeCy) / ry;
          const insideEye = (dx * dx + dy * dy <= 1.0);
          const isCream = (r > 200 && g > 170 && b > 120 && r > b + 25);
          if (!insideEye && !isCream) {
            if (x < 15 || x > w - 12 || y < 14 || y > h - 7) {
              buf[idx + 3] = 0;
            }
          }
        }
      }
    }

    // 3. Clean 1-pixel border noise:
    for (let iter = 0; iter < 2; iter++) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          if (buf[idx + 3] > 0) {
            const r = buf[idx];
            const g = buf[idx + 1];
            const b = buf[idx + 2];
            const diff = Math.max(r, g, b) - Math.min(r, g, b);
            
            let adjTransparent = 0;
            const neighbors = [[x+1,y], [x-1,y], [x,y+1], [x,y-1]];
            for (const [nx, ny] of neighbors) {
              if (nx < 0 || nx >= w || ny < 0 || ny >= h || buf[(ny * w + nx) * 4 + 3] === 0) {
                adjTransparent++;
              }
            }
            if (adjTransparent >= 2 && diff <= 12 && r > 100 && r < 240) {
              buf[idx + 3] = 0;
            }
          }
        }
      }
    }

    // 4. Seam smoothing on Dino 7 (id 7):
    if (spec.id === 7) {
      const seamX = 112;
      for (let y = 15; y < 85; y++) {
        const idxL = (y * w + (seamX - 1)) * 4;
        const idxM = (y * w + seamX) * 4;
        const idxR = (y * w + (seamX + 1)) * 4;
        if (buf[idxL + 3] > 0 && buf[idxR + 3] > 0 && buf[idxM + 3] > 0) {
          buf[idxM] = Math.round((buf[idxL] + buf[idxR]) / 2);
          buf[idxM + 1] = Math.round((buf[idxL + 1] + buf[idxR + 1]) / 2);
          buf[idxM + 2] = Math.round((buf[idxL + 2] + buf[idxR + 2]) / 2);
        }
      }
    }

    cleanedBuffers.push({ id: spec.id, buffer: buf, width: w, height: h });
  }

  // -------------------------------------------------------------
  // BUILD MASTER TRANSPARENT SPRITE SHEET (1280 x 128 px)
  // 8 frames, cell width = 160 px, cell height = 128 px
  // -------------------------------------------------------------
  const CELL_W = 160;
  const CELL_H = 128;
  const SHEET_W = CELL_W * 8; // 1280
  const SHEET_H = CELL_H;     // 128

  const sheetComposites = [];
  for (let i = 0; i < 8; i++) {
    const item = cleanedBuffers[i];
    // Center dinosaur horizontally within the 160px cell:
    // item.width is ~122-126px, so offsetX is ~ (160 - width) / 2 ~= 17-19px
    const cellLeft = i * CELL_W;
    const dinoLeft = cellLeft + Math.round((CELL_W - item.width) / 2);
    // Align ground feet to y = 118 (item.height is 108, top at 128 - 108 - 6 = 14)
    const dinoTop = 12;

    const framePng = await sharp(item.buffer, { raw: { width: item.width, height: item.height, channels: 4 } })
      .png()
      .toBuffer();

    sheetComposites.push({
      input: framePng,
      left: dinoLeft,
      top: dinoTop
    });

    // Also export in-game sprite assets dino_run_0.png .. dino_run_7.png (canonical 128x112)
    // Scale slightly to fit canonical 128x112 with ground at y=103:
    // Scale factor = 112 / 128 = 0.875
    const inGameW = 128;
    const inGameH = 112;
    const scaledDinoW = Math.round(item.width * 0.88);
    const scaledDinoH = Math.round(item.height * 0.88);
    
    const scaledDino = await sharp(item.buffer, { raw: { width: item.width, height: item.height, channels: 4 } })
      .resize(scaledDinoW, scaledDinoH, { kernel: 'lanczos3' })
      .png()
      .toBuffer();

    const inGameLeft = Math.round((inGameW - scaledDinoW) / 2);
    const inGameTop = inGameH - scaledDinoH - 4;

    await sharp({
      create: {
        width: inGameW,
        height: inGameH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([{ input: scaledDino, left: inGameLeft, top: inGameTop }])
    .png()
    .toFile(`assets/sprites/dino_run_${i}.png`);

    console.log(`Saved in-game sprite assets/sprites/dino_run_${i}.png`);
  }

  // Create transparent sheet
  await sharp({
    create: {
      width: SHEET_W,
      height: SHEET_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite(sheetComposites)
  .png()
  .toFile('dino_run_sheet_transparent.png');

  // Also save in assets/sprites/
  await sharp('dino_run_sheet_transparent.png')
    .toFile('assets/sprites/dino_run_spritesheet.png');

  console.log(`Saved master sprite sheet: dino_run_sheet_transparent.png (${SHEET_W}x${SHEET_H})`);
  console.log(`Saved assets copy: assets/sprites/dino_run_spritesheet.png`);

  // -------------------------------------------------------------
  // VERIFICATION ARTIFACTS:
  // 1. On Dark Slate Background (#1e293b) to prove zero white halos
  // 2. On Classic Checkerboard Background to demonstrate genuine alpha transparency
  // -------------------------------------------------------------
  await sharp({
    create: {
      width: SHEET_W,
      height: SHEET_H,
      channels: 4,
      background: { r: 30, g: 41, b: 59, alpha: 1 }
    }
  })
  .composite([{ input: 'dino_run_sheet_transparent.png', left: 0, top: 0 }])
  .png()
  .toFile('check_final_sheet_on_dark.png');

  // Build checkerboard test canvas
  const checkCanvas = Buffer.alloc(SHEET_W * SHEET_H * 4);
  const sq = 16;
  for (let y = 0; y < SHEET_H; y++) {
    for (let x = 0; x < SHEET_W; x++) {
      const idx = (y * SHEET_W + x) * 4;
      const isDark = (Math.floor(x / sq) + Math.floor(y / sq)) % 2 === 1;
      const c = isDark ? 210 : 255;
      checkCanvas[idx] = c;
      checkCanvas[idx + 1] = c;
      checkCanvas[idx + 2] = c;
      checkCanvas[idx + 3] = 255;
    }
  }

  await sharp(checkCanvas, { raw: { width: SHEET_W, height: SHEET_H, channels: 4 } })
    .composite([{ input: 'dino_run_sheet_transparent.png', left: 0, top: 0 }])
    .png()
    .toFile('check_final_sheet_on_checkerboard.png');

  console.log('Saved check_final_sheet_on_dark.png and check_final_sheet_on_checkerboard.png');
}

buildMasterRunningSpriteSheet().catch(console.error);
