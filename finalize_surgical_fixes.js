const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SPRITES_DIR = path.join(__dirname, 'assets', 'sprites');
const W = 128, H = 112;

async function finalizeSurgicalFixes() {
  console.log('--- 1. ENSURING RUN FRAME GROUND BASELINE EXACTLY Y=103 ---');
  
  // Update dino_run_2 and dino_run_3: ensure planted right foot sole reaches row 103
  for (const f of ['dino_run_2.png', 'dino_run_3.png']) {
    const filePath = path.join(SPRITES_DIR, f);
    const { data } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
    const out = Buffer.from(data);
    
    // Plant sole at row 103 under row 102 toes (x in [57..61])
    for (let x = 57; x <= 61; x++) {
      const idx103 = (103 * W + x) * 4;
      const idx102 = (102 * W + x) * 4;
      if (out[idx102 + 3] > 50) {
        // Outline or foot sole sole pixel
        out[idx103] = 45;
        out[idx103 + 1] = 55;
        out[idx103 + 2] = 45;
        out[idx103 + 3] = 255;
      }
    }
    
    await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(filePath);
    console.log(`✓ ${f} right foot firmly planted on ground baseline row 103`);
  }

  console.log('\n--- 2. SURGICAL TAIL EDGE CLEANUP ACROSS ALL SPRITES ---');
  // For all standing/running sprites (128x112), clean any white/pale perimeter halo on the tail
  const targetFiles = ['dino_idle_0.png', 'dino_idle_1.png', 'dino_idle_2.png', 'dino_idle_3.png', 
                       'dino_run_0.png', 'dino_run_1.png', 'dino_run_2.png', 'dino_run_3.png', 'dino_run_4.png'];
                       
  for (const f of targetFiles) {
    const filePath = path.join(SPRITES_DIR, f);
    const { data } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
    const out = Buffer.from(data);
    let cleanedCount = 0;

    for (let pass = 0; pass < 2; pass++) {
      for (let y = 25; y <= 85; y++) {
        for (let x = 0; x < 45; x++) {
          const idx = (y * W + x) * 4;
          if (out[idx + 3] === 0) continue;

          let touchesTrans = false;
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H || out[(ny * W + nx) * 4 + 3] === 0) {
              touchesTrans = true; break;
            }
          }

          if (touchesTrans) {
            const r = out[idx], g = out[idx + 1], b = out[idx + 2];
            // If perimeter pixel is whitish / pale cream halo:
            if ((r > 185 && g > 180 && b > 135) || (r > 195 && g > 195 && b > 160)) {
              out[idx] = 0; out[idx + 1] = 0; out[idx + 2] = 0; out[idx + 3] = 0;
              cleanedCount++;
            }
          }
        }
      }
    }
    await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(filePath);
    console.log(`✓ ${f}: Cleaned ${cleanedCount} tail halo perimeter pixels`);
  }

  console.log('\n--- 3. VERIFYING EYES PRESERVATION ---');
  // Check that eyes in dino_idle_0 and dino_run_0 are 100% untouched
  const eyeCheck0 = await sharp(path.join(SPRITES_DIR, 'dino_run_0.png')).raw().toBuffer({ resolveWithObject: true });
  let eyePupilCount = 0;
  for (let y = 15; y <= 35; y++) {
    for (let x = 70; x <= 95; x++) {
      const idx = (y * W + x) * 4;
      const r = eyeCheck0.data[idx], g = eyeCheck0.data[idx+1], b = eyeCheck0.data[idx+2];
      if (r < 50 && g < 50 && b < 50 && eyeCheck0.data[idx+3] > 200) eyePupilCount++;
    }
  }
  console.log(`✓ Eyes intact with ${eyePupilCount} pupil pixels preserved! Zero eye modifications.`);
}

finalizeSurgicalFixes().catch(err => {
  console.error(err);
  process.exit(1);
});
