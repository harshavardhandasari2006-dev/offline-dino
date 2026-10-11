const sharp = require('sharp');

(async () => {
  const { data, info } = await sharp('assets/sprites/dino_run_0.png').raw().toBuffer({ resolveWithObject: true });
  
  // Find all non-transparent pixels in the head (y: 0..45, x: 40..110)
  let minX = 999, maxX = 0, minY = 999, maxY = 0;
  for (let y = 0; y < 45; y++) {
    for (let x = 40; x < info.width; x++) {
      const idx = (y * info.width + x) * 4;
      if (data[idx + 3] > 20) { // non-transparent
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  console.log('Complete Head bounds in dino_run_0:', { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 });
})();
