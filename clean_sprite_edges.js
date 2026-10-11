/**
 * OFFLINE DINO - High-Precision Sprite Edge & Background Halo Cleaner
 * Eliminates all white/pale/cyan background artifacts outside the character outlines
 * while preserving exact character artwork, canvas dimensions, and baseline anchors.
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SPRITES_DIR = path.join(__dirname, 'assets', 'sprites');

// Cleans pale/whitish halo pixels on the outer perimeter of an image
async function cleanSprite(fileName, options = {}) {
  const filePath = path.join(SPRITES_DIR, fileName);
  const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const channels = info.channels;

  // Clone buffer
  const out = Buffer.from(data);

  let cleanedPixels = 0;

  // Multi-pass exterior perimeter clearing:
  // Identify pixels that touch transparency (directly or transitively from outside)
  // that are pale/whitish/cyan background residue
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels;
        const a = out[idx + 3];
        if (a === 0) continue;

        // Check if touches a transparent pixel
        let touchesTransparent = false;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            touchesTransparent = true;
            break;
          } else {
            const nidx = (ny * width + nx) * channels;
            if (out[nidx + 3] === 0) {
              touchesTransparent = true;
              break;
            }
          }
        }

        if (touchesTransparent) {
          const r = out[idx], g = out[idx + 1], b = out[idx + 2];
          // Conditions for pale/white/cyan background residue outside character outline:
          // 1. High brightness near-white: (r > 190 && g > 190 && b > 190)
          // 2. Pale cyan/green background tint: (g > 205 && b > 205 && r > 165)
          // 3. Very light tint: (r > 215 && g > 215)
          const isPaleHalo = (r > 190 && g > 190 && b > 190) ||
                             (g > 205 && b > 205 && r > 165) ||
                             (r > 215 && g > 215);

          const isCactusEdgeBorder = options.isCactus &&
                                     (x <= 1 || x >= width - 2) &&
                                     (r > 170 && g > 190 && b > 160);

          if (isPaleHalo || isCactusEdgeBorder) {
            out[idx] = 0;
            out[idx + 1] = 0;
            out[idx + 2] = 0;
            out[idx + 3] = 0;
            cleanedPixels++;
          }
        }
      }
    }
  }

  let finalSharp = sharp(out, { raw: { width, height, channels } });

  // If pterodactyl: check if beak is facing right (beak at right half of sprite)
  // If facing right, flop horizontally so beak and eyes face LEFT towards player (Section 3 & 4)
  if (options.isPtero) {
    let rightHalfPixels = 0, leftHalfPixels = 0;
    for (let y = 30; y < 55; y++) {
      for (let x = 0; x < width; x++) {
        if (out[(y * width + x) * channels + 3] > 40) {
          if (x > width / 2) rightHalfPixels++;
          else leftHalfPixels++;
        }
      }
    }
    // If beak/head is on the right side, flip to face left towards oncoming player
    if (rightHalfPixels > leftHalfPixels * 1.3) {
      finalSharp = finalSharp.flop();
      console.log(`[PTERO FLIPPED] ${fileName} horizontally flipped to face left.`);
    }
  }

  await finalSharp.png().toFile(filePath);
  console.log(`[CLEANED] ${fileName.padEnd(22)}: ${cleanedPixels} halo/border pixels cleared.`);
}

async function run() {
  console.log('Cleaning all sprite edges...');
  const files = fs.readdirSync(SPRITES_DIR).filter(f => f.endsWith('.png') && !f.startsWith('bg_'));

  for (const f of files) {
    const isCactus = f.startsWith('cactus_');
    const isPtero = f.startsWith('pterodactyl_');
    await cleanSprite(f, {
      isCactus,
      isPtero
    });
  }

  console.log('All sprites cleaned successfully.');
}

run();
