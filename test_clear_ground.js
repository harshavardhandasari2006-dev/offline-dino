const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function testClearGround() {
  const W = 128, H = 112;
  for (let i = 0; i <= 4; i++) {
    const { data } = await sharp(`test_clean_raw_run_${i}.png`).raw().toBuffer({ resolveWithObject: true });
    const out = Buffer.from(data);

    // Erase everything strictly below baseline row 103 (i.e. y >= 104)
    for (let y = 104; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
      }
    }

    // Also erase any sand pixels touching the feet at row 100..103
    for (let y = 98; y <= 103; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        if (out[idx + 3] === 0) continue;
        const r = out[idx], g = out[idx+1], b = out[idx+2];
        const isSand = (r > 175 && g < 170 && b < 145 && (r - g >= 25) && (r - b >= 45));
        if (isSand) {
          out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
        }
      }
    }

    await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(`final_clean_run_${i}.png`);
  }

  // Composite on night background to verify zero white edges
  await sharp({
    create: {
      width: 130 * 5,
      height: 120,
      channels: 4,
      background: { r: 25, g: 35, b: 65, alpha: 1 } // Dark night background
    }
  }).composite([
    { input: 'final_clean_run_0.png', left: 0, top: 0 },
    { input: 'final_clean_run_1.png', left: 130, top: 0 },
    { input: 'final_clean_run_2.png', left: 260, top: 0 },
    { input: 'final_clean_run_3.png', left: 390, top: 0 },
    { input: 'final_clean_run_4.png', left: 520, top: 0 }
  ]).png().toFile('test_final_runs_night.png');

  console.log('Saved test_final_runs_night.png');
}

testClearGround();
