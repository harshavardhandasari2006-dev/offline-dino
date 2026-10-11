const sharp = require('sharp');

(async () => {
  // Let's inspect the master eye in dino_run_0.png (left: 63, top: 16, width: 22, height: 20)
  // Let's extract this exact master eye with transparent surrounding
  const { data, info } = await sharp('assets/sprites/dino_run_0.png').raw().toBuffer({ resolveWithObject: true });

  // In dino_run_0, let's find the exact eye pixels (sclera + pupil + dark outline)
  // Eye is around x: 65..80, y: 17..33
  // Let's create a transparent RGBA buffer for the master eye (e.g. 24x24)
  const eyeW = 24;
  const eyeH = 24;
  const eyeX0 = 62; // in dino_run_0
  const eyeY0 = 15; // in dino_run_0

  const eyeBuf = Buffer.alloc(eyeW * eyeH * 4, 0);
  for (let y = 0; y < eyeH; y++) {
    for (let x = 0; x < eyeW; x++) {
      const srcIdx = ((eyeY0 + y) * info.width + (eyeX0 + x)) * 4;
      const dstIdx = (y * eyeW + x) * 4;
      
      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];
      const a = data[srcIdx + 3];

      // If it's part of the eye (sclera, pupil, or eye contour)
      // Check distance from center of eye (x=11, y=11 in eyeBuf)
      const dx = x - 11.5;
      const dy = y - 11.5;
      const distSq = (dx * dx) / (7.5 * 7.5) + (dy * dy) / (9.0 * 9.0);

      if (distSq <= 1.05) {
        eyeBuf[dstIdx] = r;
        eyeBuf[dstIdx + 1] = g;
        eyeBuf[dstIdx + 2] = b;
        eyeBuf[dstIdx + 3] = a;
      }
    }
  }

  await sharp(eyeBuf, { raw: { width: eyeW, height: eyeH, channels: 4 } })
    .png()
    .toFile('isolated_master_eye.png');
  console.log('Saved isolated_master_eye.png');
})();
