const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function inspectSprites() {
  console.log('=== Checking assets/sprites/ ===');
  const files = fs.readdirSync('assets/sprites');

  // Check run, jump, duck
  const groups = {
    run: files.filter(f => /^run_\d+\.png$|^dino_run_\d+\.png$/.test(f)).sort(),
    jump: files.filter(f => /^jump_\d+\.png$|^dino_jump_\d+\.png$/.test(f)).sort(),
    duck: files.filter(f => /^duck_\d+\.png$|^dino_duck_\d+\.png$/.test(f)).sort()
  };

  for (const [groupName, groupFiles] of Object.entries(groups)) {
    console.log(`\n--- Group: ${groupName} (${groupFiles.length} files) ---`);
    for (const f of groupFiles) {
      const p = path.join('assets/sprites', f);
      const meta = await sharp(p).metadata();
      const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true });
      const w = info.width, h = info.height, ch = info.channels;
      
      let minX = w, maxX = 0, minY = h, maxY = 0, nonAlpha = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * ch;
          const a = ch === 4 ? data[idx + 3] : 255;
          if (a > 10) {
            nonAlpha++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      const charW = nonAlpha > 0 ? (maxX - minX + 1) : 0;
      const charH = nonAlpha > 0 ? (maxY - minY + 1) : 0;
      console.log(`${f.padEnd(16)}: img=${w}x${h}, dino_bbox=[${minX},${minY} to ${maxX},${maxY}], dino_size=${charW}x${charH}, bottom_pad=${h - 1 - maxY}`);
    }
  }
}

inspectSprites();
