const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

function cleanAllArtifacts(buf, w, h) {
  const out = Buffer.from(buf);

  // 1. Erase any pixel strictly below baseline y = 103
  for (let y = 104; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
    }
  }

  // 2. Erase sand particles (peach/sand color) anywhere below y >= 95
  for (let y = 95; y <= 103; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (out[idx + 3] === 0) continue;
      const r = out[idx], g = out[idx+1], b = out[idx+2];
      // Sand is peach/orange: r > 175, g in [110..165], b in [80..140], r - g >= 25, r - b >= 45
      // Claws are yellow/cream: r > 200, g > 190, b in [110..150], so r - g is small (< 20)
      if (r > 170 && g < 165 && b < 140 && (r - g >= 25) && (r - b >= 45)) {
        out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
      }
    }
  }

  // 3. Multi-pass sky halo cleaner:
  for (let pass = 0; pass < 4; pass++) {
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
          
          // PROTECT: Claws/toenails (y >= 94)
          if (y >= 94 && r > 185 && g > 175 && b < 165 && Math.abs(r - g) <= 25) continue;
          // PROTECT: Cream chin, throat, chest, belly:
          // Distinct from sky because r > b + 28 AND g > b + 25 (Sky ALWAYS has b >= r or b close to r)
          const isCreamChinOrBelly = (r > 185 && g > 165 && (r - b >= 28) && (g - b >= 25));
          if (isCreamChinOrBelly) continue;

          // Sky/cloud halo removal:
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          // 1. Blue/cyan sky: b > r + 10 or (b > 115 && r < 190 && lum > 130)
          const isSkyCyan = (b > r + 8 && b > 110) || (b > 120 && lum > 135 && r < 190);
          // 2. White/pale cloud fringe:
          const isCloudFringe = (r > 165 && g > 175 && b > 160 && Math.abs(r - b) < 20);
          // 3. Semi-transparent halo:
          const isTransFringe = (a < 180 && (r > 130 || g > 140 || b > 120));

          if (isSkyCyan || isCloudFringe || isTransFringe) {
            out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
          }
        }
      }
    }
  }

  return out;
}

async function testCleanRuns() {
  const W = 128, H = 112;
  for (let i = 0; i <= 4; i++) {
    const raw = await sharp(`test_clean_raw_run_${i}.png`).raw().toBuffer({ resolveWithObject: true });
    const clean = cleanAllArtifacts(raw.data, W, H);
    await sharp(clean, { raw: { width: W, height: H, channels: 4 } }).png().toFile(`pure_clean_run_${i}.png`);
  }

  await sharp({
    create: {
      width: 130 * 5,
      height: 120,
      channels: 4,
      background: { r: 77, g: 166, b: 255, alpha: 1 }
    }
  }).composite([
    { input: 'pure_clean_run_0.png', left: 0, top: 0 },
    { input: 'pure_clean_run_1.png', left: 130, top: 0 },
    { input: 'pure_clean_run_2.png', left: 260, top: 0 },
    { input: 'pure_clean_run_3.png', left: 390, top: 0 },
    { input: 'pure_clean_run_4.png', left: 520, top: 0 }
  ]).png().toFile('preview_pure_clean_runs2.png');

  console.log('Saved preview_pure_clean_runs2.png');
}

testCleanRuns();
