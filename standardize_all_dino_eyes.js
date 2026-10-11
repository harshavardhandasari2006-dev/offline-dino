const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('=== STANDARDIZING ALL DINOSAUR EYES ACROSS ENTIRE GAME ===');
  
  const eyeOpen = await sharp('refined_master_eye_open.png').toBuffer();
  
  const spriteConfigs = [
    // RUNNING FRAMES (110x97)
    { name: 'dino_run_0', left: 62, top: 11, cleanBox: { x0: 58, x1: 80, y0: 8, y1: 34 } },
    { name: 'dino_run_1', left: 61, top: 10, cleanBox: { x0: 57, x1: 79, y0: 7, y1: 33 } },
    { name: 'dino_run_2', left: 60, top: 9,  cleanBox: { x0: 56, x1: 78, y0: 6, y1: 32 } },
    { name: 'dino_run_3', left: 61, top: 10, cleanBox: { x0: 57, x1: 79, y0: 7, y1: 33 } },
    { name: 'dino_run_4', left: 61, top: 10, cleanBox: { x0: 57, x1: 79, y0: 7, y1: 33 } },

    // JUMP FRAMES (120x100)
    { name: 'dino_jump_0', left: 51, top: 15, cleanBox: { x0: 46, x1: 70, y0: 10, y1: 38 } },
    { name: 'dino_jump_1', left: 57, top: 13, cleanBox: { x0: 52, x1: 76, y0: 8,  y1: 36 } },
    { name: 'dino_jump_2', left: 56, top: 13, cleanBox: { x0: 51, x1: 75, y0: 8,  y1: 36 } },
    { name: 'dino_jump_3', left: 54, top: 15, cleanBox: { x0: 49, x1: 73, y0: 10, y1: 38 } },
    { name: 'dino_jump_4', left: 55, top: 16, cleanBox: { x0: 50, x1: 74, y0: 11, y1: 39 } },

    // IDLE FRAMES (112x107)
    { name: 'dino_idle_0', left: 49, top: 8,  cleanBox: { x0: 45, x1: 68, y0: 5,  y1: 30 } },
    { name: 'dino_idle_1', left: 49, top: 8,  cleanBox: { x0: 45, x1: 68, y0: 5,  y1: 30 } },
    { name: 'dino_idle_3', left: 50, top: 9,  cleanBox: { x0: 46, x1: 69, y0: 6,  y1: 31 } },

    // DUCK TRANSITION FRAMES (STAND/RECOVER)
    { name: 'dino_duck_0', left: 51, top: 11, cleanBox: { x0: 47, x1: 70, y0: 7,  y1: 33 } },
    { name: 'dino_duck_4', left: 49, top: 11, cleanBox: { x0: 45, x1: 68, y0: 7,  y1: 33 } }
  ];

  for (const cfg of spriteConfigs) {
    const filePath = path.join(__dirname, 'assets', 'sprites', `${cfg.name}.png`);
    const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    const cleaned = Buffer.from(data);

    const { x0, x1, y0, y1 } = cfg.cleanBox;

    // 1. Clean eye socket area (fill old sclera/pupil pixels with smooth head green #58b42b)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          const idx = (y * w + x) * 4;
          const r = cleaned[idx];
          const g = cleaned[idx + 1];
          const b = cleaned[idx + 2];
          const a = cleaned[idx + 3];

          if (a > 40) {
            const isWhite = (r > 170 && g > 170 && b > 170);
            const isDark = (r < 55 && g < 55 && b < 55);
            const isCream = (r > 180 && g > 180 && b < 160 && y < y1 - 2);
            if (isWhite || isDark || isCream) {
              cleaned[idx] = 88;     // R
              cleaned[idx + 1] = 180; // G
              cleaned[idx + 2] = 43;  // B
              cleaned[idx + 3] = 255; // A
            }
          }
        }
      }
    }

    // 2. Extra mouth cleanup for dino_jump_1 and dino_jump_2 where teeth had white spill
    if (cfg.name === 'dino_jump_1' || cfg.name === 'dino_jump_2') {
      const mouthX0 = cfg.name === 'dino_jump_1' ? 66 : 64;
      const mouthX1 = cfg.name === 'dino_jump_1' ? 84 : 86;
      for (let y = 34; y < 48; y++) {
        for (let x = mouthX0; x < mouthX1; x++) {
          const idx = (y * w + x) * 4;
          const r = cleaned[idx], g = cleaned[idx+1], b = cleaned[idx+2], a = cleaned[idx+3];
          if (a > 50 && r > 190 && g > 190 && b > 190) {
            // Fill with mouth maroon / tongue red (#992c2c)
            cleaned[idx] = 153;
            cleaned[idx + 1] = 44;
            cleaned[idx + 2] = 44;
            cleaned[idx + 3] = 255;
          }
        }
      }
    }

    // 3. Composite the master eye
    await sharp(cleaned, { raw: { width: w, height: h, channels: 4 } })
      .composite([{
        input: eyeOpen,
        left: cfg.left,
        top: cfg.top
      }])
      .png()
      .toFile(filePath);

    console.log(`Processed & updated: ${cfg.name}.png (eye at ${cfg.left}, ${cfg.top})`);
  }

  console.log('\nAll sprite assets updated! Now synchronizing js/sprite_data.js...');
})();
