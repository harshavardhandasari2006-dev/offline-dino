const sharp = require('sharp');

async function fineTune() {
  const pano = await sharp('assets/sprites/homepage_seamless_panorama.jpg').raw().toBuffer({ resolveWithObject: true });
  const pw = pano.info.width, ph = pano.info.height;
  const pdata = pano.data;

  // Let's find the EXACT bounding box of the green dinosaur in 1920x1080 panorama
  // Let's check pixel-by-pixel for green skin:
  // On the head: y starts where?
  let headTopY = 9999;
  for (let y = 50; y < 200; y++) {
    for (let x = 850; x < 1050; x++) {
      const idx = (y * pw + x) * 3;
      const r = pdata[idx], g = pdata[idx+1], b = pdata[idx+2];
      if (g > 60 && g > r * 1.1 && g > b * 1.1) {
        if (y < headTopY) headTopY = y;
      }
    }
  }

  // Leftmost green pixel (on left tail / crest / paw):
  let leftX = 9999;
  for (let y = 100; y < 450; y++) {
    for (let x = 750; x < 950; x++) {
      const idx = (y * pw + x) * 3;
      const r = pdata[idx], g = pdata[idx+1], b = pdata[idx+2];
      if (g > 70 && g > r * 1.1 && g > b * 1.1) {
        if (x < leftX) leftX = x;
      }
    }
  }

  // Rightmost green pixel (on right tail):
  let rightX = 0;
  for (let y = 100; y < 450; y++) {
    for (let x = 1000; x < 1200; x++) {
      const idx = (y * pw + x) * 3;
      const r = pdata[idx], g = pdata[idx+1], b = pdata[idx+2];
      if (g > 70 && g > r * 1.1 && g > b * 1.1) {
        if (x > rightX) rightX = x;
      }
    }
  }

  // Lowest green pixel (hands on sign / tail):
  let bottomY = 0;
  for (let y = 300; y < 480; y++) {
    for (let x = 800; x < 1150; x++) {
      const idx = (y * pw + x) * 3;
      const r = pdata[idx], g = pdata[idx+1], b = pdata[idx+2];
      if (g > 70 && g > r * 1.1 && g > b * 1.1) {
        if (y > bottomY) bottomY = y;
      }
    }
  }

  console.log(`Exact Green Dino Bounds in 1920x1080:`);
  console.log(`Top Y: ${headTopY}`);
  console.log(`Left X: ${leftX}`);
  console.log(`Right X: ${rightX} (Width = ${rightX - leftX + 1})`);
  console.log(`Bottom Y: ${bottomY} (Height = ${bottomY - headTopY + 1})`);

  console.log(`Percentages:`);
  console.log(`left: ${(leftX / pw * 100).toFixed(6)}%`);
  console.log(`top: ${(headTopY / ph * 100).toFixed(6)}%`);
  console.log(`width: ${((rightX - leftX + 1) / pw * 100).toFixed(6)}%`);
  console.log(`height: ${((bottomY - headTopY + 1) / ph * 100).toFixed(6)}%`);
}

fineTune().catch(console.error);
