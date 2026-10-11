const sharp = require('sharp');

(async () => {
  // Extract 22x20 raw crop from dino_run_0.png (left: 63, top: 16)
  const { data, info } = await sharp('assets/sprites/dino_run_0.png')
    .extract({ left: 63, top: 16, width: 22, height: 20 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width; // 22
  const h = info.height; // 20
  const cleaned = Buffer.alloc(w * h * 4, 0);

  // We want to create a clean master eye:
  // 1. Identify eye region (sclera + pupil + eye border)
  // Let's inspect each pixel's RGB and distance to eye center (approx x=10.5, y=10.5)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];

      // Check if it's outside the eye (green skin):
      // Green skin has g > 120 and g > r + 20 and g > b + 20
      const isGreenSkin = (g > 100 && g > r * 1.15 && g > b * 1.15 && !(r > 180 && g > 180 && b > 180));
      
      const dx = x - 10.5;
      const dy = y - 9.5;
      // Ellipse test for eye boundary
      const dist = (dx * dx) / (6.8 * 6.8) + (dy * dy) / (8.5 * 8.5);

      if (dist <= 1.25 && !isGreenSkin) {
        // Inside eye boundary
        if (r > 190 && g > 190 && b > 190) {
          // Pure white sclera or highlight
          cleaned[idx] = 255;
          cleaned[idx + 1] = 255;
          cleaned[idx + 2] = 255;
          cleaned[idx + 3] = 255;
        } else if (r < 65 && g < 65 && b < 65) {
          // Solid black pupil or dark outline
          cleaned[idx] = 17;
          cleaned[idx + 1] = 24;
          cleaned[idx + 2] = 39;
          cleaned[idx + 3] = 255;
        } else {
          // Anti-aliased edge or transition
          cleaned[idx] = r;
          cleaned[idx + 1] = g;
          cleaned[idx + 2] = b;
          cleaned[idx + 3] = a;
        }
      }
    }
  }

  await sharp(cleaned, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile('cleaned_master_eye_22x20.png');

  // Upscale to view
  await sharp('cleaned_master_eye_22x20.png')
    .resize(220, 200, { kernel: 'nearest' })
    .toFile('preview_cleaned_eye.png');

  console.log('Generated cleaned_master_eye_22x20.png and preview_cleaned_eye.png');
})();
