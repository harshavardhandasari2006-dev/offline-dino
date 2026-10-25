const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function deploySeamlessGround() {
  console.log('=== Deploying Seamless Left Ground Fix ===');

  const panoW = 1920;
  const panoH = 1080;

  // 1. Load pristine reference with untouched right side, center, and intact Skins cactus
  const base = await sharp('assets/sprites/homepage_seamless_panorama.backup_continuity.jpg')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(base.data);

  // 2. Prepare pure sand patch from existing background artwork
  const patchW = 340;
  const patchH = 370; // y = 710 to 1080
  const startY = 710;

  const sandPatch = await sharp('scratch/pure_sand_dunes.png')
    .extract({ left: 75, top: 55, width: 370, height: 185 })
    .resize(patchW, patchH, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 3. Color calibrate sand patch to match the surrounding desert terrain
  let avgR = 0, avgG = 0, avgB = 0;
  const count = sandPatch.data.length / 3;
  for (let i = 0; i < sandPatch.data.length; i += 3) {
    avgR += sandPatch.data[i];
    avgG += sandPatch.data[i+1];
    avgB += sandPatch.data[i+2];
  }
  avgR /= count; avgG /= count; avgB /= count;

  const sR = 246 / avgR;
  const sG = 168 / avgG;
  const sB = 44 / avgB;

  // 4. Apply seamless composite
  for (let y = startY; y < panoH; y++) {
    for (let x = 0; x < patchW; x++) {
      const pIdx = (y * panoW + x) * 3;
      const py = y - startY;
      const px = x;
      const sIdx = (py * patchW + px) * 3;

      // Natural sloping top boundary following canyon cliff base
      const cliffBaseY = 720 + 0.225 * Math.min(200, x);

      let alpha = 0.0;

      if (y < cliffBaseY - 10) {
        alpha = 0.0; // Above cliff base: 100% untouched cliff
      } else if (y <= 970) {
        // Upper zone: protect Skins cactus at x >= 252
        if (x < 210) {
          alpha = 1.0;
        } else if (x <= 252) {
          const u = (x - 210) / (252 - 210);
          alpha = 0.5 + 0.5 * Math.cos(Math.PI * u);
        } else {
          alpha = 0.0; // Strictly 0 at x > 252, preserving cactus completely!
        }

        // Top feather along the sloped cliff base (feather over 25 pixels)
        if (y < cliffBaseY + 15) {
          const v = (y - (cliffBaseY - 10)) / 25;
          alpha *= (0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, v))));
        }
      } else {
        // Floor zone under Skins button (y > 970): clean floor under rocks, covers blurry tip up to x=325
        if (x < 290) {
          alpha = 1.0;
        } else if (x <= 335) {
          const u = (x - 290) / (335 - 290);
          alpha = 0.5 + 0.5 * Math.cos(Math.PI * u);
        } else {
          alpha = 0.0;
        }

        // Smooth diagonal transition between y=970 and y=985
        if (y < 985) {
          const v = (y - 970) / (985 - 970);
          const cutoff = 252 + (335 - 252) * v;
          if (x > cutoff) alpha = 0.0;
        }
      }

      if (alpha > 0) {
        const r = Math.min(255, Math.round(sandPatch.data[sIdx] * sR));
        const g = Math.min(255, Math.round(sandPatch.data[sIdx+1] * sG));
        const b = Math.min(255, Math.round(sandPatch.data[sIdx+2] * sB));

        out[pIdx] = Math.round(base.data[pIdx] * (1 - alpha) + r * alpha);
        out[pIdx+1] = Math.round(base.data[pIdx+1] * (1 - alpha) + g * alpha);
        out[pIdx+2] = Math.round(base.data[pIdx+2] * (1 - alpha) + b * alpha);
      }
    }
  }

  // 5. Verify right side is 100% identical to backup_continuity
  let rightDiffs = 0;
  for (let y = 0; y < panoH; y++) {
    for (let x = 600; x < panoW; x++) {
      const idx = (y * panoW + x) * 3;
      if (out[idx] !== base.data[idx] || out[idx+1] !== base.data[idx+1] || out[idx+2] !== base.data[idx+2]) {
        rightDiffs++;
      }
    }
  }
  console.log(`Right side integrity check (x >= 600): ${rightDiffs} differing pixels (Must be 0)`);
  if (rightDiffs !== 0) {
    throw new Error('Right side was modified! Aborting.');
  }

  // 6. Save target panorama
  const targetPath = 'assets/sprites/homepage_seamless_panorama.jpg';
  await sharp(out, { raw: { width: panoW, height: panoH, channels: 3 } })
    .jpeg({ quality: 98, chromaSubsampling: '4:4:4' })
    .toFile(targetPath);

  console.log(`Saved pristine ${targetPath} successfully!`);

  // 7. Generate verification audit crops
  await sharp(targetPath)
    .extract({ left: 100, top: 760, width: 300, height: 300 })
    .toFile('audit_evidence/audit_user_view_fixed.png');

  await sharp(targetPath)
    .extract({ left: 0, top: 500, width: 500, height: 580 })
    .toFile('audit_evidence/audit_left_ground_fixed.png');

  await sharp(targetPath)
    .extract({ left: 1420, top: 500, width: 500, height: 580 })
    .toFile('audit_evidence/audit_right_ground_unchanged.png');

  console.log('Saved audit evidence crops.');
}

deploySeamlessGround().catch(err => {
  console.error(err);
  process.exit(1);
});
