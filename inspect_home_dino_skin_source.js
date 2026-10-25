const sharp = require('sharp');

async function inspectHomeDinoSkin() {
  const green = await sharp('assets/sprites/home_dino_skin_green.png').raw().toBuffer({ resolveWithObject: true });
  const w = green.info.width, h = green.info.height;
  const data = green.data;

  console.log(`home_dino_skin_green is ${w}x${h}`);

  // Find non-transparent pixels
  let minX = w, maxX = 0, minY = h, maxY = 0, count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (data[idx + 3] > 10) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  console.log(`Bounds: x=[${minX}, ${maxX}], y=[${minY}, ${maxY}], non-transparent count=${count}`);

  // Compare home_dino_skin_green with home_title_sign_green
  const sign = await sharp('assets/sprites/home_title_sign_green.png').raw().toBuffer({ resolveWithObject: true });
  const sw = sign.info.width, sh = sign.info.height;
  const sdata = sign.data;

  // Let's check pixel-by-pixel if home_dino_skin_green matches sign at offset (188, 10) or similar
  for (let offsetY = 0; offsetY <= sh - h; offsetY++) {
    for (let offsetX = 0; offsetX <= sw - w; offsetX++) {
      let matches = 0;
      let totalChecked = 0;
      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          const gIdx = (y * w + x) * 4;
          if (data[gIdx + 3] < 50) continue;
          totalChecked++;
          const sIdx = ((y + offsetY) * sw + (x + offsetX)) * 4;
          if (Math.abs(data[gIdx] - sdata[sIdx]) <= 5 &&
              Math.abs(data[gIdx+1] - sdata[sIdx+1]) <= 5 &&
              Math.abs(data[gIdx+2] - sdata[sIdx+2]) <= 5) {
            matches++;
          }
        }
      }
      if (totalChecked > 500 && matches / totalChecked > 0.95) {
        console.log(`Exact match found at offsetX=${offsetX}, offsetY=${offsetY}! (${matches}/${totalChecked})`);
      }
    }
  }
}

inspectHomeDinoSkin().catch(console.error);
