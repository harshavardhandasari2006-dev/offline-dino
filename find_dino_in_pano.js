const sharp = require('sharp');

async function findDinoInPano() {
  const pano = await sharp('assets/sprites/homepage_seamless_panorama.jpg').raw().toBuffer({ resolveWithObject: true });
  const pw = pano.info.width, ph = pano.info.height;
  const pdata = pano.data;

  // Let's inspect the dinosaur above the wooden sign in the panorama (around x: 800..1150, y: 50..420)
  // Let's find:
  // 1. Highest green pixel of the dinosaur head (minY)
  // 2. Leftmost green pixel of the dinosaur (minX)
  // 3. Rightmost green pixel of the dinosaur (tail/paw) (maxX)
  // 4. Lowest pixel of dinosaur hands/body resting on the wooden sign (maxY)

  let minX = pw, maxX = 0, minY = ph, maxY = 0;
  for (let y = 30; y < 450; y++) {
    for (let x = 800; x < 1150; x++) {
      const idx = (y * pw + x) * 3;
      const r = pdata[idx], g = pdata[idx+1], b = pdata[idx+2];
      // Green skin / spikes / cream belly / eyes of the dinosaur
      const isGreen = (g > 110 && g > r * 1.05 && g > b * 1.1);
      const isCreamBelly = (r > 190 && g > 165 && b < 160 && r >= g && r - b > 35);
      const isEyeWhite = (r > 200 && g > 200 && b > 200 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20);
      const isPupil = (r < 40 && g < 40 && b < 40 && y < 270);
      const isDarkSpikes = (g > 45 && g < 110 && g > r && g > b && y < 350);

      if (isGreen || isCreamBelly || isEyeWhite || isPupil || isDarkSpikes) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  console.log(`Dino in 1920x1080 panorama:`);
  console.log(`x: [${minX}, ${maxX}] (width = ${maxX - minX + 1})`);
  console.log(`y: [${minY}, ${maxY}] (height = ${maxY - minY + 1})`);
  console.log(`As percentages of 1920x1080:`);
  console.log(`left: ${(minX / pw * 100).toFixed(6)}%`);
  console.log(`top: ${(minY / ph * 100).toFixed(6)}%`);
  console.log(`width: ${((maxX - minX + 1) / pw * 100).toFixed(6)}%`);
  console.log(`height: ${((maxY - minY + 1) / ph * 100).toFixed(6)}%`);

  // Let's also crop that exact area to an image to verify!
  await sharp('assets/sprites/homepage_seamless_panorama.jpg')
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .toFile('diagnostic_black_skin/exact_pano_dino.png');
}

findDinoInPano().catch(console.error);
