const sharp = require('sharp');
const path = require('path');
const uploadDir = 'C:\\Users\\asus\\.gemini\\antigravity-ide\\brain\\1c3e5139-b62e-4146-8621-13708d351c51\\.user_uploaded';
const refPath = path.join(uploadDir, 'media_1792219879817.jpg');

async function buildCleanSceneryBg() {
  const { data: ref } = await sharp(refPath).raw().toBuffer({ resolveWithObject: true });
  const w = 1024, h = 576;
  const bg = Buffer.from(ref);

  // 1. Clean the hero region (dino + sign): x: 236 to 788, y: 35 to 330:
  // Blend with clean sky from bg_day.png
  const bgDay = await sharp('assets/sprites/bg_day.png').resize(1024, 460).raw().toBuffer({ resolveWithObject: true });
  for (let y = 35; y < 330; y++) {
    for (let x = 236; x <= 788; x++) {
      const idx = (y * w + x) * 3;
      let feather = 1.0;
      if (x < 260) feather = Math.min(feather, (x - 236) / 24);
      if (x > 764) feather = Math.min(feather, (788 - x) / 24);
      if (y < 48) feather = Math.min(feather, (y - 35) / 13);
      if (y > 310) feather = Math.min(feather, (330 - y) / 20);

      const dayIdx = (y * 1024 + x) * 3;
      bg[idx] = Math.round(bg[idx] * (1 - feather) + bgDay.data[dayIdx] * feather);
      bg[idx+1] = Math.round(bg[idx+1] * (1 - feather) + bgDay.data[dayIdx+1] * feather);
      bg[idx+2] = Math.round(bg[idx+2] * (1 - feather) + bgDay.data[dayIdx+2] * feather);
    }
  }

  // 2. Clean the orange Start Game button from the background (x: 360 to 664, y: 328 to 395):
  // Replace orange button with canyon/horizon
  for (let y = 328; y < 396; y++) {
    for (let x = 360; x <= 664; x++) {
      const idx = (y * w + x) * 3;
      const dayIdx = (y * 1024 + x) * 3;
      bg[idx] = bgDay.data[dayIdx];
      bg[idx+1] = bgDay.data[dayIdx+1];
      bg[idx+2] = bgDay.data[dayIdx+2];
    }
  }

  // 3. Keep the two stone pedestals at x: 370..465 and x: 550..645, y: 396..418!
  // In ref, between y=396 and 418, the pedestals are intact.
  // In the center between them (x: 466 to 549, y: 396 to 418): keep canyon horizon from bgDay
  for (let y = 396; y <= 418; y++) {
    for (let x = 466; x <= 549; x++) {
      const idx = (y * w + x) * 3;
      const dayIdx = (y * 1024 + x) * 3;
      bg[idx] = bgDay.data[dayIdx];
      bg[idx+1] = bgDay.data[dayIdx+1];
      bg[idx+2] = bgDay.data[dayIdx+2];
    }
  }

  // 4. In the bottom menu area (x: 96 to 928, y: 416 to 520):
  // Remove the baked-in buttons from the background!
  // Replace with seamless warm sand floor and canyon horizon:
  // From y=416 to 445: Canyon horizon / soft sand gradient from neighboring regions
  // From y=445 to 520: Pure warm golden desert sand!
  for (let y = 416; y < 516; y++) {
    for (let x = 96; x <= 928; x++) {
      const idx = (y * w + x) * 3;
      
      // Let's sample authentic sand from y=525:
      const sandIdx = (525 * w + x) * 3;
      const sandR = ref[sandIdx], sandG = ref[sandIdx+1], sandB = ref[sandIdx+2];
      
      // At y=416..435, blend with canyon horizon
      if (y < 435) {
        // Horizon color at y=415:
        const t = (y - 416) / 19; // 0 to 1
        const dayIdx = (Math.min(459, y) * 1024 + x) * 3;
        const horizR = bgDay.data[dayIdx], horizG = bgDay.data[dayIdx+1], horizB = bgDay.data[dayIdx+2];
        bg[idx] = Math.round(horizR * (1 - t) + sandR * t);
        bg[idx+1] = Math.round(horizG * (1 - t) + sandG * t);
        bg[idx+2] = Math.round(horizB * (1 - t) + sandB * t);
      } else {
        // Pure sand with slight upward brightness
        const sandFactor = 1.0 + (516 - y) * 0.001;
        bg[idx] = Math.min(255, Math.round(sandR * sandFactor));
        bg[idx+1] = Math.min(255, Math.round(sandG * sandFactor));
        bg[idx+2] = Math.min(255, Math.round(sandB * sandFactor));
      }
    }
  }

  await sharp(bg, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toFile('assets/sprites/home_bg_desktop.png');
    
  console.log('Saved pure scenery assets/sprites/home_bg_desktop.png!');
}
buildCleanSceneryBg();
