const sharp = require('sharp');

(async () => {
  // Let's test on dino_jump_2 (the one that had the white mouth artifact and eye issue)
  const { data, info } = await sharp('assets/sprites/dino_jump_2.png').raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const cleaned = Buffer.from(data);

  // Clean all white and black pixels in the eye & upper face region (x: 48..82, y: 10..38)
  for (let y = 10; y < 38; y++) {
    for (let x = 48; x < 82; x++) {
      const idx = (y * w + x) * 4;
      const r = cleaned[idx];
      const g = cleaned[idx + 1];
      const b = cleaned[idx + 2];
      const a = cleaned[idx + 3];

      if (a > 50) {
        // If it's white (sclera/mouth artifact) or dark black (old pupil/outline)
        const isWhite = (r > 175 && g > 175 && b > 175);
        const isBlack = (r < 50 && g < 50 && b < 50);
        if (isWhite || isBlack) {
          // Replace with smooth dinosaur head green (#5cb72f)
          cleaned[idx] = 92;
          cleaned[idx + 1] = 183;
          cleaned[idx + 2] = 47;
          cleaned[idx + 3] = 255;
        }
      }
    }
  }

  // Also clean the mouth white artifact in dino_jump_2 (around x: 68..88, y: 35..48)
  // The mouth interior should be dark red / maroon (#9e2a2b), NOT bright white!
  for (let y = 35; y < 48; y++) {
    for (let x = 68; x < 88; x++) {
      const idx = (y * w + x) * 4;
      const r = cleaned[idx];
      const g = cleaned[idx + 1];
      const b = cleaned[idx + 2];
      const a = cleaned[idx + 3];

      if (a > 50 && r > 200 && g > 200 && b > 200) {
        // Bright white mouth artifact -> fill with mouth maroon / tongue red (#992c2c)
        cleaned[idx] = 153;
        cleaned[idx + 1] = 44;
        cleaned[idx + 2] = 44;
        cleaned[idx + 3] = 255;
      }
    }
  }

  // Now stamp the clean master eye at eye position (left: 56, top: 13)
  const eyeOpen = await sharp('refined_master_eye_open.png').toBuffer();
  
  await sharp(cleaned, { raw: { width: w, height: h, channels: 4 } })
    .composite([{
      input: eyeOpen,
      left: 56,
      top: 13
    }])
    .png()
    .toFile('test_jump_2_flawless.png');

  console.log('Created test_jump_2_flawless.png');
})();
