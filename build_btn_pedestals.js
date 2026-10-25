const sharp = require('sharp');

async function buildButtonWithPedestalsV3() {
  const { data, info } = await sharp('scratch_start_and_pedestals_88.png').raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const out = Buffer.alloc(w * h * 4);

  const cx1 = 44.5, cx2 = 257.5;
  const cy = 32.8;
  const radius = 32.4;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx3 = (y * w + x) * 3;
      const idx4 = (y * w + x) * 4;
      const r = data[idx3], g = data[idx3 + 1], b = data[idx3 + 2];

      out[idx4] = r;
      out[idx4 + 1] = g;
      out[idx4 + 2] = b;
      out[idx4 + 3] = 255;

      if (y < 66) {
        // Upper pill area:
        let dist = 0;
        if (x < cx1) dist = Math.hypot(x - cx1, y - cy);
        else if (x > cx2) dist = Math.hypot(x - cx2, y - cy);
        else dist = Math.abs(y - cy);

        if (dist >= radius + 0.5) {
          out[idx4 + 3] = 0;
        } else if (dist > radius - 0.5) {
          out[idx4 + 3] = Math.round((radius + 0.5 - dist) * 255);
        }
      } else {
        // Lower pedestal area (y >= 66):
        // Left pedestal is strictly at x in [24, 105]
        // Right pedestal is strictly at x in [195, 265]
        const isLeft = (x >= 24 && x <= 105);
        const isRight = (x >= 195 && x <= 265);

        if (!isLeft && !isRight) {
          out[idx4 + 3] = 0;
        } else {
          const isRock = (r > 70 && g > 40 && r > b + 15);
          const isRockHighlight = (r > 160 && g > 120 && b > 80 && r >= g && g >= b);
          const isLeaf = (g > 65 && g > r * 1.05);
          const isBorder = (r < 75 && g < 50 && b < 40 && r >= b);
          const isBlueSky = (b > 150 && b > r + 25);

          if ((isRock || isRockHighlight || isLeaf || isBorder) && !isBlueSky) {
            out[idx4 + 3] = 255;
          } else {
            out[idx4 + 3] = 0;
          }
        }
      }
    }
  }

  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile('scratch_button_and_pedestals_perfect.png');
  console.log('Saved scratch_button_and_pedestals_perfect.png');
}
buildButtonWithPedestalsV3();
