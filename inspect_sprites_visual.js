const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function inspectSprites() {
  const dir = path.join(__dirname, 'assets', 'sprites');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png') && !f.startsWith('bg_'));

  for (const f of files) {
    const { data, info } = await sharp(path.join(dir, f)).raw().toBuffer({ resolveWithObject: true });
    let palePerimeter = 0;
    let totalPerimeter = 0;

    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const idx = (y * info.width + x) * 4;
        if (data[idx + 3] > 10) {
          let isPerim = false;
          for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= info.width || ny < 0 || ny >= info.height) {
              isPerim = true;
              break;
            } else {
              const nidx = (ny * info.width + nx) * 4;
              if (data[nidx + 3] <= 10) {
                isPerim = true;
                break;
              }
            }
          }
          if (isPerim) {
            totalPerimeter++;
            const r = data[idx], g = data[idx+1], b = data[idx+2];
            // Check if pale / whitish
            if (r > 195 && g > 195 && b > 195) {
              palePerimeter++;
            }
          }
        }
      }
    }
    console.log(`${f.padEnd(20)} | Perim: ${String(totalPerimeter).padStart(4)} | Pale/White border: ${String(palePerimeter).padStart(3)}`);
  }
}

inspectSprites();
