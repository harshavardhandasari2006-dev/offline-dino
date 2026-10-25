const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const baseDir = 'repaired_assets_phase2';
const categories = [
  { name: 'running', count: 16, prefix: 'run_', pad: 2, start: 1 },
  { name: 'ducking', count: 27, prefix: 'duck_', pad: 2, start: 0 },
  { name: 'jumping', count: 20, prefix: 'jump_', pad: 2, start: 0 }
];

async function auditAllFrames() {
  console.log('=== STARTING DEEP STEP 1 & 2 AUDIT ON PHASE 2 ASSETS ===');
  const results = {
    running: [],
    ducking: [],
    jumping: []
  };

  for (const cat of categories) {
    const dir = path.join(baseDir, cat.name);
    console.log(`\n--- Auditing ${cat.name.toUpperCase()} (${cat.count} frames) ---`);

    for (let i = cat.start; i < cat.start + cat.count; i++) {
      const numStr = i.toString().padStart(cat.pad, '0');
      const filename = `${cat.prefix}${numStr}.png`;
      const filePath = path.join(dir, filename);

      if (!fs.existsSync(filePath)) {
        console.error(`File missing: ${filePath}`);
        continue;
      }

      const meta = await sharp(filePath).metadata();
      const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
      const W = info.width;
      const H = info.height;

      let transparentCount = 0;
      let opaqueCount = 0;
      let semiCount = 0;
      let perimeterSolidCount = 0;

      let minX = W, maxX = 0, minY = H, maxY = 0;
      let whiteEyeCount = 0;
      let pupilCount = 0;
      let creamBellyCount = 0;
      let clawCount = 0;

      // Checkerboard remnant detector: neutral gray edge pixels with |R-G| <= 2 and |G-B| <= 2 and R in [135, 220]
      let edgeCheckerboardRemnants = 0;

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const idx = (y * W + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];

          if (a === 0) {
            transparentCount++;
          } else if (a === 255) {
            opaqueCount++;
          } else {
            semiCount++;
          }

          // Check outermost 1-pixel border
          if (x === 0 || x === W - 1 || y === 0 || y === H - 1) {
            if (a > 20) perimeterSolidCount++;
          }

          if (a > 30) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;

            // Anatomy metrics
            if (r > 235 && g > 235 && b > 235) whiteEyeCount++;
            if (r < 30 && g < 30 && b < 30) pupilCount++;
            if (r > 175 && g > 155 && b < 195 && (r >= g) && (r - b > 35) && (g - b > 20)) creamBellyCount++;
            if (r > 195 && g > 190 && b > 140 && (r - b > 20)) clawCount++;

            // Check if this pixel is near transparent boundary (fringe check)
            let isBorderPixel = false;
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
                if (data[(ny * W + nx) * 4 + 3] === 0) {
                  isBorderPixel = true;
                  break;
                }
              }
            }

            if (isBorderPixel) {
              const diff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
              if (diff <= 3 && r >= 135 && r <= 220) {
                edgeCheckerboardRemnants++;
              }
            }
          }
        }
      }

      const totalPixels = W * H;
      const transPercent = ((transparentCount / totalPixels) * 100).toFixed(1);

      const frameAudit = {
        frame: filename,
        dimensions: `${W}x${H}`,
        format: meta.format,
        channels: meta.channels,
        hasAlpha: meta.hasAlpha,
        transPercent: `${transPercent}%`,
        solidPixels: opaqueCount + semiCount,
        bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
        margins: {
          left: minX,
          right: W - 1 - maxX,
          top: minY,
          bottom: H - 1 - maxY
        },
        footBottomY: maxY,
        perimeterSolidCount,
        edgeCheckerboardRemnants,
        whiteEyeCount,
        pupilCount,
        creamBellyCount,
        clawCount,
        status: 'PENDING'
      };

      // Quality evaluation rules
      let defects = [];
      if (W !== 136 || H !== 116) defects.push(`Invalid dimensions ${W}x${H}`);
      if (perimeterSolidCount > 0) defects.push(`Perimeter touch: ${perimeterSolidCount} solid pixels on outer border`);
      if (edgeCheckerboardRemnants > 15) defects.push(`Possible checkerboard fringe: ${edgeCheckerboardRemnants} pixels`);
      if (whiteEyeCount < 50 && cat.name !== 'ducking' && !filename.includes('blink')) defects.push(`Low white eye count: ${whiteEyeCount}`);
      if (pupilCount < 40 && !filename.includes('blink') && !filename.includes('dead')) defects.push(`Low pupil count: ${pupilCount}`);

      frameAudit.defects = defects;
      frameAudit.status = defects.length === 0 ? 'PASSED' : 'FLAGGED';

      results[cat.name].push(frameAudit);
    }
  }

  // Print summary tables
  for (const cat of categories) {
    console.log(`\n=== SUMMARY: ${cat.name.toUpperCase()} ===`);
    const summary = results[cat.name].map(f => ({
      file: f.frame,
      canvas: f.dimensions,
      bbox: `${f.bbox.w}x${f.bbox.h}`,
      left: f.margins.left,
      right: f.margins.right,
      bottom: f.margins.bottom,
      footY: f.footBottomY,
      whiteEye: f.whiteEyeCount,
      pupil: f.pupilCount,
      chkRemnants: f.edgeCheckerboardRemnants,
      status: f.status
    }));
    console.table(summary);
  }

  fs.writeFileSync('repaired_assets_phase2/deep_audit_results.json', JSON.stringify(results, null, 2));
  console.log('\nSaved deep audit results to repaired_assets_phase2/deep_audit_results.json');
}

auditAllFrames().catch(console.error);
