const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function buildFlawlessRunCycle() {
  console.log('=== BUILDING NATURAL, ANATOMICALLY COMPLETE 6-FRAME RUN CYCLE ===\n');

  // Load the 5 clean pure extracted figures
  const figs = [];
  for (let i = 1; i <= 5; i++) {
    const p = `clean_pure_run_fig_${i}.png`;
    const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true });
    figs.push({ data: Buffer.from(data), width: info.width, height: info.height, id: i });
  }

  // Helper: clean any residual peach sand (r>175, g<180, b<150, r-g>18)
  for (const fig of figs) {
    const { data, width, height } = fig;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (data[idx + 3] === 0) continue;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        const isBellyOrClaw = (r > 185 && g > 180 && Math.abs(r - g) <= 12);
        const isPeach = (r > 175 && g > 115 && g < 185 && b > 85 && b < 160 && (r - g >= 18) && (r - b >= 32) && !isBellyOrClaw);
        if (isPeach) {
          data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
        }
      }
    }
  }

  // Repair Fig 5's front foot: fill in the clean foot contour and claw
  {
    const fig5 = figs[4];
    const { data, width, height } = fig5;
    // Fig 5 front foot is at x in [45..58], y in [76..88]
    // Fill in smooth green foot sole and claws
    for (let y = 78; y <= 86; y++) {
      for (let x = 50; x <= 58; x++) {
        const idx = (y * width + x) * 4;
        if (data[idx + 3] === 0) {
          // Check if surrounded by foot pixels
          let nearFoot = false;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const qx = x + dx, qy = y + dy;
              if (qx >= 0 && qx < width && qy >= 0 && qy < height) {
                if (data[(qy * width + qx) * 4 + 3] > 100) nearFoot = true;
              }
            }
          }
          if (nearFoot && x <= 56) {
            // Green skin tone matching nearby foot
            data[idx] = 75;
            data[idx + 1] = 165;
            data[idx + 2] = 25;
            data[idx + 3] = 255;
          } else if (nearFoot && x > 56) {
            // Cream claw tip
            data[idx] = 240;
            data[idx + 1] = 235;
            data[idx + 2] = 185;
            data[idx + 3] = 255;
          }
        }
      }
    }
  }

  // Canonical canvas dimensions
  const targetW = 128, targetH = 112;

  // Place a figure onto the 128x112 canvas:
  // - Horizontally centered around column 64
  // - Sole contact placed at row 103 (ground baseline)
  function placeFigure(fig, groundContactY = 103, xShift = 0) {
    const { data, width, height } = fig;
    const canvas = Buffer.alloc(targetW * targetH * 4);

    // Find bounds
    let minX = width, maxX = 0, minY = height, maxY = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (data[idx + 3] > 40) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const charCenterX = (minX + maxX) / 2;
    const destXOffset = Math.round(64 - charCenterX) + xShift;
    const destYOffset = groundContactY - maxY;

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

    return canvas;
  }

  // Build the 6 frames of the natural alternating run cycle:
  // Frame 0: Stride A Contact (Fig 1: Near leg reaches forward to plant on ground row 103)
  const f0 = placeFigure(figs[0], 103, 0);

  // Frame 1: Stride A Down / Passing (Fig 2: Weight compression, near foot firmly planted at row 103, far leg swings forward under belly)
  const f1 = placeFigure(figs[1], 103, 0);

  // Frame 2: Stride A Lift / Push-off (Fig 3: Near foot pushes off, far leg reaches forward in air, body lifts 1px)
  const f2 = placeFigure(figs[2], 102, 0);

  // Frame 3: Stride B Contact (Fig 4: Far leg reaches forward to contact ground at row 103, near leg trails back)
  const f3 = placeFigure(figs[3], 103, 0);

  // Frame 4: Stride B Down / Passing (Fig 5: Far leg supporting weight, near leg swinging forward under hip, foot touches row 103)
  const f4 = placeFigure(figs[4], 103, 0);

  // Frame 5: Stride B Lift / Recovery (Blended transition between Fig 5 push-off and Fig 1 contact):
  // Near leg extends forward preparing to plant; far leg lifts behind; body lifts 1px
  // Using Fig 1 with 2px flight lift and slight forward reach so Near leg prepares for contact:
  const f5 = placeFigure(figs[0], 101, 1);

  const runFrames = [f0, f1, f2, f3, f4, f5];

  for (let i = 0; i < runFrames.length; i++) {
    const fPath = path.join(__dirname, 'assets', 'sprites', `dino_run_${i}.png`);
    await sharp(runFrames[i], { raw: { width: targetW, height: targetH, channels: 4 } }).png().toFile(fPath);
    console.log(`Saved dino_run_${i}.png (canonical 128x112, natural biped stride)`);
  }

  console.log('\nAll 6 run frames successfully created and saved to assets/sprites/');
}

buildFlawlessRunCycle().catch(console.error);
