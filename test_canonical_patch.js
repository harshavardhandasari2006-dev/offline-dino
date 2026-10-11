const sharp = require('sharp');

(async () => {
  // Extract canonical eye patch from test_flawless_run_0.png
  // Let's examine region x: 58..82, y: 11..34 (width: 24, height: 23)
  const patchW = 24;
  const patchH = 23;
  const patchX0 = 58;
  const patchY0 = 11;

  const { data: raw0, info: info0 } = await sharp('test_flawless_run_0.png').raw().toBuffer({ resolveWithObject: true });
  
  // Create an RGBA buffer with soft feathered alpha along the outer green border
  const patchBuf = Buffer.alloc(patchW * patchH * 4, 0);

  for (let py = 0; py < patchH; py++) {
    for (let px = 0; px < patchW; px++) {
      const srcX = patchX0 + px;
      const srcY = patchY0 + py;
      const srcIdx = (srcY * info0.width + srcX) * 4;
      const dstIdx = (py * patchW + px) * 4;

      const r = raw0[srcIdx];
      const g = raw0[srcIdx + 1];
      const b = raw0[srcIdx + 2];
      const a = raw0[srcIdx + 3];

      if (a < 20) continue;

      // Distance from center of patch
      const dx = px - 12;
      const dy = py - 11.5;
      const dist = (dx * dx) / (11.5 * 11.5) + (dy * dy) / (11.0 * 11.0);

      let alpha = a;
      if (dist > 1.0) {
        alpha = 0;
      } else if (dist > 0.82) {
        // Smooth feather edge for seamless blend into surrounding head green
        const t = (1.0 - dist) / (1.0 - 0.82);
        alpha = Math.round(a * Math.sin(t * Math.PI / 2));
      }

      patchBuf[dstIdx] = r;
      patchBuf[dstIdx + 1] = g;
      patchBuf[dstIdx + 2] = b;
      patchBuf[dstIdx + 3] = alpha;
    }
  }

  await sharp(patchBuf, { raw: { width: patchW, height: patchH, channels: 4 } })
    .png()
    .toFile('canonical_eye_patch.png');
  console.log('Created canonical_eye_patch.png');

  // Upscale to view
  await sharp('canonical_eye_patch.png')
    .resize(240, 230, { kernel: 'nearest' })
    .toFile('preview_canonical_patch.png');
})();
