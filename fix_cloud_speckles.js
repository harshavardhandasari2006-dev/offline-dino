const sharp = require('sharp');

async function fixCloudSpeckles() {
  const { data, info } = await sharp('test_clean_desktop_bg_v6.png').raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const out = Buffer.from(data);

  // Cloud speckle 1 is around x: 280 to 325, y: 130 to 170
  // Cloud speckle 2 is around x: 215 to 250, y: 228 to 260
  // Let's inspect and smooth both regions using authentic surrounding cloud color
  for (let y = 130; y <= 170; y++) {
    for (let x = 280; x <= 325; x++) {
      const idx = (y * w + x) * 3;
      const r = out[idx], g = out[idx+1], b = out[idx+2];
      // If it's a bluish artifact inside the cloud:
      if (b - r > 30 && r > 150) {
        // Sample pure cloud from x - 25 or x + 25
        const sIdx = (y * w + (x - 30)) * 3;
        out[idx] = out[sIdx];
        out[idx+1] = out[sIdx+1];
        out[idx+2] = out[sIdx+2];
      }
    }
  }

  for (let y = 225; y <= 265; y++) {
    for (let x = 210; x <= 255; x++) {
      const idx = (y * w + x) * 3;
      const r = out[idx], g = out[idx+1], b = out[idx+2];
      if (b - r > 30 && r > 150) {
        const sIdx = (y * w + (x - 25)) * 3;
        out[idx] = out[sIdx];
        out[idx+1] = out[sIdx+1];
        out[idx+2] = out[sIdx+2];
      }
    }
  }

  // Also apply a mild 3x3 median / smooth filter on those two small patches so transitions are seamless:
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 132; y <= 168; y++) {
      for (let x = 282; x <= 323; x++) {
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * w + (x + dx)) * 3;
            sumR += out[idx]; sumG += out[idx+1]; sumB += out[idx+2];
            count++;
          }
        }
        const cidx = (y * w + x) * 3;
        out[cidx] = Math.round(sumR / count);
        out[cidx+1] = Math.round(sumG / count);
        out[cidx+2] = Math.round(sumB / count);
      }
    }
  }

  await sharp(out, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toFile('assets/sprites/home_bg_desktop.png');
  console.log('Saved pristine assets/sprites/home_bg_desktop.png!');
}

fixCloudSpeckles();
