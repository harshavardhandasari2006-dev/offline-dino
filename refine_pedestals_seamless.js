const sharp = require('sharp');

async function refinePedestalsSeamless() {
  const { data: bgData } = await sharp('assets/sprites/home_bg_desktop.png').raw().toBuffer({ resolveWithObject: true });
  const { data: v6Data } = await sharp('test_clean_desktop_bg_v6.png').raw().toBuffer({ resolveWithObject: true });
  const w = 1024, h = 576;

  // In the strip y=390 to 425, x=340 to 680:
  // We want to KEEP ONLY the authentic rocks and leaves of the two pedestals!
  // Any pixel in this strip that is NOT rock, NOT leaf, NOT pedestal outline:
  // Must be restored to the clean background mesa from v6Data!
  for (let y = 390; y <= 425; y++) {
    for (let x = 340; x <= 680; x++) {
      const inLeftPedestal = (x >= 370 && x <= 462 && y >= 396 && y <= 420);
      const inRightPedestal = (x >= 552 && x <= 645 && y >= 396 && y <= 420);

      const idx = (y * w + x) * 3;
      const r = bgData[idx], g = bgData[idx+1], b = bgData[idx+2];

      if (inLeftPedestal || inRightPedestal) {
        // Check if it's actually rock or leaf
        const isRock = (r > 90 && g > 45 && b < 115 && r > b + 25);
        const isLeaf = (g > 65 && g > r * 1.1);
        const isBorder = (r < 75 && g < 50 && b < 40 && r >= b);

        if (isRock || isLeaf || isBorder) {
          // Keep the pedestal rock/leaf pixel!
          continue;
        }
      }

      // Otherwise, restore the clean, seamless canyon background from v6Data!
      bgData[idx] = v6Data[idx];
      bgData[idx+1] = v6Data[idx+1];
      bgData[idx+2] = v6Data[idx+2];
    }
  }

  // Also check y=416..435 across x=96..928:
  // In v6Data, the sand floor transitions smoothly
  // Let's make sure there are no stray blue pixels along y=414..420
  for (let y = 412; y <= 420; y++) {
    for (let x = 90; x <= 935; x++) {
      const inLeftPed = (x >= 370 && x <= 462);
      const inRightPed = (x >= 552 && x <= 645);
      if (inLeftPed || inRightPed) continue;

      const idx = (y * w + x) * 3;
      // If it has blue sky tint (b > 180 && b > r + 30)
      if (bgData[idx+2] > 180 && bgData[idx+2] > bgData[idx] + 30) {
        bgData[idx] = v6Data[idx];
        bgData[idx+1] = v6Data[idx+1];
        bgData[idx+2] = v6Data[idx+2];
      }
    }
  }

  await sharp(bgData, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toFile('assets/sprites/home_bg_desktop.png');
    
  console.log('Cleaned pedestals and background seamlessly!');
}
refinePedestalsSeamless();
