const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function deploy16Frames() {
  console.log('--- DEPLOYING 16-FRAME RUNNING ANIMATION ASSETS ---');
  const targetDir = path.join(__dirname, 'assets', 'sprites');

  // 1. Copy run_01.png .. run_16.png
  for (let i = 1; i <= 16; i++) {
    const fn = `run_${i.toString().padStart(2, '0')}.png`;
    const src = path.join('candidate_16_standard', fn);
    const dest = path.join(targetDir, fn);
    fs.copyFileSync(src, dest);

    // Also mirror to dino_run_(i-1).png for seamless backwards compatibility
    const legacyName = `dino_run_${i - 1}.png`;
    fs.copyFileSync(src, path.join(targetDir, legacyName));
  }
  console.log('Copied run_01..16.png and dino_run_0..15.png into assets/sprites/');

  // 2. Build cleaned running sprite sheet (8 cols x 2 rows = 16 frames on uniform 136x116 grid)
  const cellW = 136, cellH = 116;
  const cols = 8, rows = 2;
  const sheetW = cols * cellW;
  const sheetH = rows * cellH;
  const composites = [];

  for (let i = 1; i <= 16; i++) {
    const fn = `candidate_16_standard/run_${i.toString().padStart(2, '0')}.png`;
    const col = (i - 1) % cols;
    const row = Math.floor((i - 1) / cols);
    const left = col * cellW;
    const top = row * cellH;
    composites.push({ input: fn, left, top });
  }

  const cleanSheetPath = path.join(targetDir, 'dino_running_sheet_16_clean.png');
  await sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite(composites)
  .png()
  .toFile(cleanSheetPath);
  console.log(`Created cleaned running sprite sheet: ${cleanSheetPath} (${sheetW}x${sheetH})`);

  // 3. Update js/sprite_data.js with new embedded Base64 strings
  require('./update_sprite_data.js');
}

deploy16Frames();
