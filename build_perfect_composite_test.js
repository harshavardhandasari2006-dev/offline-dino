const sharp = require('sharp');
const path = require('path');
const uploadDir = 'C:\\Users\\asus\\.gemini\\antigravity-ide\\brain\\1c3e5139-b62e-4146-8621-13708d351c51\\.user_uploaded';
const refPath = path.join(uploadDir, 'media_1792219879817.jpg');

async function testPerfectComposite() {
  const { data: ref } = await sharp(refPath).raw().toBuffer({ resolveWithObject: true });
  const w = 1024, h = 576;
  
  // 1. Build the clean background:
  // Start with Screenshot 2
  const bgData = Buffer.from(ref);
  
  // Replace the hero sign region (x: 239 to 785, y: 38 to 328) with clean sky & cloud:
  // In Screenshot 2:
  // Sky at top is RGB(0, 132, 233)
  // Cloud at y=20..70
  // Distant mesas at y=270..328
  const bgDay = await sharp('assets/sprites/bg_day.png').resize(1024, 460).raw().toBuffer({ resolveWithObject: true });
  
  for (let y = 35; y < 330; y++) {
    for (let x = 236; x <= 788; x++) {
      const idx = (y * w + x) * 3;
      // Smooth feather near boundaries (x in [236, 260], x in [764, 788], y in [35, 45], y in [315, 330])
      let feather = 1.0;
      if (x < 260) feather = Math.min(feather, (x - 236) / 24);
      if (x > 764) feather = Math.min(feather, (788 - x) / 24);
      if (y < 48) feather = Math.min(feather, (y - 35) / 13);
      if (y > 310) feather = Math.min(feather, (330 - y) / 20);

      const dayIdx = (y * 1024 + x) * 3;
      bgData[idx] = Math.round(bgData[idx] * (1 - feather) + bgDay.data[dayIdx] * feather);
      bgData[idx+1] = Math.round(bgData[idx+1] * (1 - feather) + bgDay.data[dayIdx+1] * feather);
      bgData[idx+2] = Math.round(bgData[idx+2] * (1 - feather) + bgDay.data[dayIdx+2] * feather);
    }
  }

  // Save this pristine background
  await sharp(bgData, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toFile('scratch_pristine_bg_test.png');
  console.log('Saved scratch_pristine_bg_test.png');

  // Now composite foreground elements:
  const bg = await sharp('scratch_pristine_bg_test.png').toBuffer();
  const sign = await sharp('scratch_master_sign_perfect.png').toBuffer();
  const btn = await sharp('scratch_perfect_start_btn_v4.png').toBuffer();
  const b1 = await sharp('scratch_ref_btn1_skins.png').toBuffer();
  const b2 = await sharp('scratch_ref_btn2_highscore.png').toBuffer();
  const b3 = await sharp('scratch_ref_btn3_sound.png').toBuffer();
  const b4 = await sharp('scratch_ref_btn4_exit.png').toBuffer();

  const finalComposite = await sharp(bg)
    .composite([
      { input: sign, left: 239, top: 40 },
      { input: btn, left: 360, top: 328 },
      { input: b1, left: 96, top: 416 },
      { input: b2, left: 300, top: 416 },
      { input: b3, left: 502, top: 416 },
      { input: b4, left: 704, top: 416 }
    ])
    .png()
    .toFile('scratch_perfect_composite_result.png');
    
  console.log('Saved scratch_perfect_composite_result.png');
}
testPerfectComposite();
