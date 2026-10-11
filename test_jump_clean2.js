const sharp = require('sharp');

(async () => {
  const eyeOpen = await sharp('refined_master_eye_open.png').toBuffer();
  
  // Exact eye top-left positions on each jump frame (120x100):
  const jumpEyePositions = [
    { left: 47, top: 17 }, // jump_0: takeoff
    { left: 55, top: 12 }, // jump_1: ascending
    { left: 52, top: 15 }, // jump_2: in air
    { left: 51, top: 18 }, // jump_3: descending
    { left: 58, top: 19 }  // jump_4: landing
  ];

  for (let i = 0; i < 5; i++) {
    const { left, top } = jumpEyePositions[i];
    
    // Load frame
    const { data, info } = await sharp(`assets/sprites/dino_jump_${i}.png`).raw().toBuffer({ resolveWithObject: true });
    
    const w = info.width;
    const h = info.height;
    const cleaned = Buffer.from(data);

    // Clean old eye socket with dinosaur head green (#56b42b)
    for (let y = top + 1; y < top + 21; y++) {
      for (let x = left + 1; x < left + 21; x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          const idx = (y * w + x) * 4;
          const dx = x - (left + 11.5);
          const dy = y - (top + 11.5);
          if ((dx * dx) / (6.8 * 6.8) + (dy * dy) / (8.8 * 8.8) <= 1.0) {
            cleaned[idx] = 86;     // R
            cleaned[idx + 1] = 180; // G
            cleaned[idx + 2] = 43;  // B
            cleaned[idx + 3] = 255; // A
          }
        }
      }
    }

    // Composite master eye
    await sharp(cleaned, { raw: { width: w, height: h, channels: 4 } })
      .composite([{
        input: eyeOpen,
        left: left,
        top: top
      }])
      .png()
      .toFile(`test_jump_clean2_${i}.png`);

    console.log(`Saved test_jump_clean2_${i}.png`);
  }
})();
