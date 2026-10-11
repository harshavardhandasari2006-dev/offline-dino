const sharp = require('sharp');

(async () => {
  const eyeOpen = await sharp('refined_master_eye_open.png').toBuffer();
  
  // Exact eye top-left positions relative to head on each run frame (110x97):
  const runEyePositions = [
    { left: 62, top: 11 }, // run_0
    { left: 61, top: 10 }, // run_1
    { left: 60, top: 9  }, // run_2
    { left: 61, top: 10 }, // run_3
    { left: 61, top: 10 }  // run_4
  ];

  for (let i = 0; i < 5; i++) {
    const { left, top } = runEyePositions[i];
    
    // Load frame
    const { data, info } = await sharp(`assets/sprites/dino_run_${i}.png`).raw().toBuffer({ resolveWithObject: true });
    
    // In the eye box (x: left+2..left+18, y: top+2..top+18):
    // If a pixel is white (old sclera) or black (old pupil) or yellow/cream, fill it with head skin green (#56b42b)
    const w = info.width;
    const h = info.height;
    const cleaned = Buffer.from(data);

    for (let y = top + 1; y < top + 21; y++) {
      for (let x = left + 1; x < left + 21; x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          const idx = (y * w + x) * 4;
          const r = cleaned[idx];
          const g = cleaned[idx + 1];
          const b = cleaned[idx + 2];
          const a = cleaned[idx + 3];

          // Ellipse check for eye socket:
          const dx = x - (left + 11.5);
          const dy = y - (top + 11.5);
          if ((dx * dx) / (6.5 * 6.5) + (dy * dy) / (8.5 * 8.5) <= 1.0) {
            // Fill with smooth local dinosaur green skin
            cleaned[idx] = 86;     // R
            cleaned[idx + 1] = 180; // G
            cleaned[idx + 2] = 43;  // B
            cleaned[idx + 3] = 255; // A
          }
        }
      }
    }

    // Now composite the clean master eye
    await sharp(cleaned, { raw: { width: w, height: h, channels: 4 } })
      .composite([{
        input: eyeOpen,
        left: left,
        top: top
      }])
      .png()
      .toFile(`test_run_clean_${i}.png`);

    console.log(`Saved test_run_clean_${i}.png`);
  }
})();
