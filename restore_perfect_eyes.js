const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SPRITES_DIR = path.join(__dirname, 'assets', 'sprites');

async function restorePerfectEyes() {
  console.log('=== RESTORING SOLID WHITE & BLACK EYES ACROSS ALL DINO SPRITES ===');

  const eyePatch = await sharp('refined_master_eye_open.png').toBuffer();

  const eyeConfigs = [
    // Standing Idle Frames (128x112)
    { file: 'dino_idle_0.png', left: 68, top: 19 },
    { file: 'dino_idle_1.png', left: 68, top: 19 },
    { file: 'dino_idle_3.png', left: 68, top: 19 },

    // Running Frames (128x112)
    { file: 'dino_run_0.png', left: 68, top: 19 },
    { file: 'dino_run_1.png', left: 68, top: 19 },
    { file: 'dino_run_2.png', left: 68, top: 19 },
    { file: 'dino_run_3.png', left: 68, top: 19 },
    { file: 'dino_run_4.png', left: 68, top: 19 },

    // Jump Frames (140x120)
    { file: 'dino_jump_0.png', left: 71, top: 18 },
    { file: 'dino_jump_1.png', left: 68, top: 15 },
    { file: 'dino_jump_2.png', left: 68, top: 16 },
    { file: 'dino_jump_3.png', left: 68, top: 18 },
    { file: 'dino_jump_4.png', left: 68, top: 20 },

    // Duck Recovery Frames (Open eyes)
    { file: 'dino_duck_0.png', left: 50, top: 6 },
    { file: 'dino_duck_4.png', left: 46, top: 5 }
  ];

  for (const cfg of eyeConfigs) {
    const filePath = path.join(SPRITES_DIR, cfg.file);
    const orig = await sharp(filePath).png().toBuffer();

    const composited = await sharp(orig)
      .composite([{
        input: eyePatch,
        left: cfg.left,
        top: cfg.top
      }])
      .png()
      .toBuffer();

    fs.writeFileSync(filePath, composited);
    console.log(`✓ ${cfg.file}: Composited solid white & black eye at (${cfg.left}, ${cfg.top})`);
  }

  console.log('\n--- VERIFYING EYE PIXELS AFTER RESTORATION ---');
  for (const cfg of eyeConfigs) {
    const { data, info } = await sharp(path.join(SPRITES_DIR, cfg.file)).raw().toBuffer({ resolveWithObject: true });
    let whiteCount = 0, blackCount = 0, redCount = 0;

    for (let y = cfg.top; y < cfg.top + 24; y++) {
      for (let x = cfg.left; x < cfg.left + 24; x++) {
        if (x >= info.width || y >= info.height) continue;
        const idx = (y * info.width + x) * 4;
        const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
        if (a > 200) {
          if (r > 210 && g > 210 && b > 210) whiteCount++;
          if (r < 45 && g < 45 && b < 45) blackCount++;
          if (r > 150 && r > g + 40 && r > b + 40) redCount++;
        }
      }
    }
    console.log(`  ${cfg.file.padEnd(16)}: Eye White=${whiteCount}px, Black Pupil=${blackCount}px, Red Artifacts=${redCount}px`);
  }
}

restorePerfectEyes().catch(err => {
  console.error(err);
  process.exit(1);
});
