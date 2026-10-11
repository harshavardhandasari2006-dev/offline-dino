const sharp = require('sharp');

(async () => {
  const masterBuf = await sharp('assets/sprites/dino_run_0.png').raw().toBuffer({ resolveWithObject: true });
  const mW = masterBuf.info.width; // 110
  const mH = masterBuf.info.height; // 97
  const mData = masterBuf.data;

  // Extract head from master (y < 46, x >= 36)
  // Let's create an RGBA buffer of the same size with ONLY the master head
  const headOnly = Buffer.alloc(mW * mH * 4, 0);
  for (let y = 0; y < 46; y++) {
    for (let x = 36; x < mW; x++) {
      const idx = (y * mW + x) * 4;
      headOnly[idx] = mData[idx];
      headOnly[idx + 1] = mData[idx + 1];
      headOnly[idx + 2] = mData[idx + 2];
      headOnly[idx + 3] = mData[idx + 3];
    }
  }

  // Now for each run frame 0..4:
  for (let i = 0; i < 5; i++) {
    const frameBuf = await sharp(`assets/sprites/dino_run_${i}.png`).raw().toBuffer({ resolveWithObject: true });
    const fData = frameBuf.data;
    const fW = frameBuf.info.width;
    const fH = frameBuf.info.height;

    // Create a new buffer:
    // Copy frame body (for y >= 46, OR for x < 36)
    // For y < 46 and x >= 36: use master head!
    // Near the seam (y around 43..46), let's ensure smooth blending if needed
    const result = Buffer.alloc(fW * fH * 4, 0);
    for (let y = 0; y < fH; y++) {
      for (let x = 0; x < fW; x++) {
        const idx = (y * fW + x) * 4;
        if (y < 44 && x >= 36) {
          // Master head
          result[idx] = headOnly[idx];
          result[idx + 1] = headOnly[idx + 1];
          result[idx + 2] = headOnly[idx + 2];
          result[idx + 3] = headOnly[idx + 3];
        } else if (y >= 44 && y <= 46 && x >= 42 && x <= 65) {
          // Seam transition between neck and torso
          // Blend 50/50 or use master head if master head has pixels
          if (headOnly[idx + 3] > 100) {
            result[idx] = headOnly[idx];
            result[idx + 1] = headOnly[idx + 1];
            result[idx + 2] = headOnly[idx + 2];
            result[idx + 3] = headOnly[idx + 3];
          } else {
            result[idx] = fData[idx];
            result[idx + 1] = fData[idx + 1];
            result[idx + 2] = fData[idx + 2];
            result[idx + 3] = fData[idx + 3];
          }
        } else {
          // Body from frame i
          result[idx] = fData[idx];
          result[idx + 1] = fData[idx + 1];
          result[idx + 2] = fData[idx + 2];
          result[idx + 3] = fData[idx + 3];
        }
      }
    }

    await sharp(result, { raw: { width: fW, height: fH, channels: 4 } })
      .png()
      .toFile(`graft_run_${i}.png`);
    console.log(`Created graft_run_${i}.png`);
  }
})();
