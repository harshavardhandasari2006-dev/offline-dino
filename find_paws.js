const sharp = require('sharp');

async function findPaws() {
  const pano = await sharp('assets/sprites/homepage_seamless_panorama.jpg').raw().toBuffer({ resolveWithObject: true });
  const pw = pano.info.width;
  const pdata = pano.data;

  // Let's inspect py around 350..415, px around 850..1150
  for (let py = 350; py < 415; py++) {
    for (let px = 850; px < 1150; px++) {
      const idx = (py * pw + px) * 3;
      const r = pdata[idx], g = pdata[idx+1], b = pdata[idx+2];
      // Paws are green with white claws (r>200, g>200, b>200)
      const isClaw = (r > 200 && g > 200 && b > 200);
      const isGreenPaw = (g > 130 && g > r * 1.1 && g > b * 1.1);
      if (isClaw || isGreenPaw) {
        const x = px - 826;
        const y = py - 97;
        // console.log min/max
      }
    }
  }

  let minPawX = 999, maxPawX = 0, minPawY = 999, maxPawY = 0;
  for (let py = 350; py < 415; py++) {
    for (let px = 850; px < 1150; px++) {
      const idx = (py * pw + px) * 3;
      const r = pdata[idx], g = pdata[idx+1], b = pdata[idx+2];
      const isClaw = (r > 190 && g > 190 && b > 180 && py > 380);
      const isGreenPaw = (g > 120 && g > r * 1.05 && g > b * 1.1 && py > 355);
      if (isClaw || isGreenPaw) {
        const x = px - 826;
        const y = py - 97;
        if (x < minPawX) minPawX = x;
        if (x > maxPawX) maxPawX = x;
        if (y < minPawY) minPawY = y;
        if (y > maxPawY) maxPawY = y;
      }
    }
  }

  console.log(`Paws in crop coords (0..371, 0..308):`);
  console.log(`X: [${minPawX}, ${maxPawX}], Y: [${minPawY}, ${maxPawY}]`);
}

findPaws().catch(console.error);
