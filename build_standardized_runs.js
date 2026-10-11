const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

function cleanHaloAndSand(buf, w, h) {
  const out = Buffer.from(buf);

  // 1. Clear any ground sand below baseline y = 103
  for (let y = 104; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
    }
  }

  // 2. Clear ground shadow sand particles touching feet at y in [100..103]:
  // Sand is peach/orange: r > 185, g in [110..165], b in [80..135], r - g > 35, r - b > 55
  for (let y = 98; y <= 103; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (out[idx + 3] === 0) continue;
      const r = out[idx], g = out[idx+1], b = out[idx+2];
      const isSand = (r > 180 && g < 165 && b < 140 && (r - g >= 30) && (r - b >= 50));
      if (isSand) {
        out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
      }
    }
  }

  // 3. Multi-pass sky/halo cleaning
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const a = out[idx + 3];
        if (a === 0) continue;

        let touchesTrans = false;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h || out[(ny * w + nx) * 4 + 3] === 0) {
            touchesTrans = true; break;
          }
        }

        if (touchesTrans) {
          const r = out[idx], g = out[idx+1], b = out[idx+2];
          // Preserve toenails:
          if (y >= 94 && r > 180 && g > 170 && b < 150 && (r - b >= 30)) continue;
          // Preserve cream chin / belly:
          if (r > 195 && g > 180 && b < 155 && (r - b >= 40)) continue;

          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if ((b > 115 && lum > 135) || (r > 155 && g > 165 && b > 135) || (lum > 170 && b > 100) || b > 130 || (a < 180 && (r > 130 || g > 140 || b > 120))) {
            out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
          }
        }
      }
    }
  }

  return out;
}

async function buildStandardizedRuns() {
  const W = 128, H = 112;

  // Master head crop from test_clean_raw_run_0 (which is the canon pose)
  const master0 = await sharp('test_clean_raw_run_0.png').raw().toBuffer({ resolveWithObject: true });
  const clean0 = cleanHaloAndSand(master0.data, W, H);
  await sharp(clean0, { raw: { width: W, height: H, channels: 4 } }).png().toFile('canonical_run_0.png');

  // Master head buffer: x in [45..107], y in [4..52] (width 62, height 48)
  const masterHead = await sharp('canonical_run_0.png')
    .extract({ left: 45, top: 4, width: 62, height: 48 })
    .toBuffer();

  for (let i = 1; i <= 4; i++) {
    const raw = await sharp(`test_clean_raw_run_${i}.png`).raw().toBuffer({ resolveWithObject: true });
    const buf = cleanHaloAndSand(raw.data, W, H);

    // Clear head region above neck seam (y < 46 && x >= 46)
    for (let y = 0; y < 46; y++) {
      for (let x = 46; x < W; x++) {
        const idx = (y * W + x) * 4;
        buf[idx] = 0; buf[idx+1] = 0; buf[idx+2] = 0; buf[idx+3] = 0;
      }
    }

    // Composite master head
    const grafted = await sharp(buf, { raw: { width: W, height: H, channels: 4 } })
      .composite([{
        input: masterHead,
        left: 45,
        top: 4
      }])
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Clean any halo on seam
    const finalClean = cleanHaloAndSand(grafted.data, W, H);
    await sharp(finalClean, { raw: { width: W, height: H, channels: 4 } }).png().toFile(`canonical_run_${i}.png`);
    console.log(`Saved canonical_run_${i}.png`);
  }

  // Composite montage of all 5 canonical frames
  await sharp({
    create: {
      width: 130 * 5,
      height: 120,
      channels: 4,
      background: { r: 77, g: 166, b: 255, alpha: 1 }
    }
  }).composite([
    { input: 'canonical_run_0.png', left: 0, top: 0 },
    { input: 'canonical_run_1.png', left: 130, top: 0 },
    { input: 'canonical_run_2.png', left: 260, top: 0 },
    { input: 'canonical_run_3.png', left: 390, top: 0 },
    { input: 'canonical_run_4.png', left: 520, top: 0 }
  ]).png().toFile('preview_canonical_runs_montage.png');

  console.log('Saved preview_canonical_runs_montage.png');
}

buildStandardizedRuns();
