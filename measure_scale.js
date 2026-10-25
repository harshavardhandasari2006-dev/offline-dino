const sharp = require('sharp');

async function measureScale() {
  const run1 = await sharp('assets/sprites/run_01.png').metadata();
  console.log('run_01 metadata:', run1.width, run1.height);

  for (let i = 1; i <= 10; i++) {
    const pad = i.toString().padStart(2, '0');
    const { data, info } = await sharp(`assets/sprites/jump_${pad}.png`).raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height;
    let minX = w, maxX = 0, minY = h, maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = data[(y * w + x) * 4 + 3];
        if (a > 15) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const dw = maxX - minX + 1;
    const dh = maxY - minY + 1;
    console.log(`jump_${pad}: dino bbox=[${minX}, ${minY} to ${maxX}, ${maxY}], w=${dw}, h=${dh}, bottomY=${maxY}`);
  }

  for (let i = 1; i <= 10; i++) {
    const pad = i.toString().padStart(2, '0');
    const { data, info } = await sharp(`assets/sprites/run_${pad}.png`).raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height;
    let minX = w, maxX = 0, minY = h, maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = data[(y * w + x) * 4 + 3];
        if (a > 15) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const dw = maxX - minX + 1;
    const dh = maxY - minY + 1;
    console.log(`run_${pad}: dino bbox=[${minX}, ${minY} to ${maxX}, ${maxY}], w=${dw}, h=${dh}, bottomY=${maxY}`);
  }
}
measureScale();
