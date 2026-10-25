const sharp = require('sharp');
const path = require('path');
const uploadDir = 'C:\\Users\\asus\\.gemini\\antigravity-ide\\brain\\1c3e5139-b62e-4146-8621-13708d351c51\\.user_uploaded';
const refPath = path.join(uploadDir, 'media_1792219879817.jpg');

async function buildCleanMenuButtons() {
  // Extract 832x100 menu strip from Screenshot 2:
  const { data: strip } = await sharp(refPath)
    .extract({ left: 96, top: 416, width: 832, height: 100 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buttons = [
    { name: 'skins', left: 0, width: 204 },
    { name: 'highscore', left: 204, width: 202 },
    { name: 'sound', left: 406, width: 202 },
    { name: 'exit', left: 608, width: 224 }
  ];

  for (const b of buttons) {
    const w = b.width;
    const h = 100;
    const out = Buffer.alloc(w * h * 4);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const stripX = b.left + x;
        const sIdx3 = (y * 832 + stripX) * 3;
        const outIdx4 = (y * w + x) * 4;

        const r = strip[sIdx3];
        const g = strip[sIdx3 + 1];
        const bCol = strip[sIdx3 + 2];

        out[outIdx4] = r;
        out[outIdx4 + 1] = g;
        out[outIdx4 + 2] = bCol;
        out[outIdx4 + 3] = 255;

        // Mask above the stone frame:
        // Stone frame top is roughly at y = 17.
        // For y < 17:
        if (y < 17) {
          // Check if this pixel is cactus (green)
          const isGreen = (g > 60 && g > r * 1.12 && g > bCol);
          const isDarkSpine = (g > r && g > bCol && g < 110 && r < 75);
          const isYellowSpine = (r > 130 && g > 130 && bCol < 90 && Math.abs(r - g) < 30);
          
          if (isGreen || isDarkSpine || isYellowSpine) {
            out[outIdx4 + 3] = 255;
          } else {
            out[outIdx4 + 3] = 0;
          }
        }
      }
    }

    // Soften transition at y = 16..17 where mask cuts
    for (let y = 1; y < 18; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        if (out[idx + 3] === 0) {
          const hasFg = (
            out[((y+1)*w + x)*4 + 3] === 255 ||
            out[(y*w + x - 1)*4 + 3] === 255 ||
            out[(y*w + x + 1)*4 + 3] === 255
          );
          if (hasFg) {
            out[idx + 3] = 120;
          }
        }
      }
    }

    const outPath = `assets/sprites/btn_home_${b.name}_frame.png`;
    await sharp(out, { raw: { width: w, height: h, channels: 4 } })
      .png()
      .toFile(outPath);
    console.log(`Saved clean ${outPath} (${w}x${h})`);

    if (b.name === 'sound') {
      // Build sound_off with red mute slash across the speaker wave
      const offBuf = Buffer.from(out);
      for (let y = 42; y <= 66; y++) {
        for (let x = 60; x <= 95; x++) {
          if (Math.abs((x - 60) - (y - 42) * 1.4) < 3.2) {
            const idx4 = (y * w + x) * 4;
            offBuf[idx4] = 230;
            offBuf[idx4 + 1] = 45;
            offBuf[idx4 + 2] = 45;
            offBuf[idx4 + 3] = 255;
          }
        }
      }
      await sharp(offBuf, { raw: { width: w, height: h, channels: 4 } })
        .png()
        .toFile('assets/sprites/btn_home_sound_off_frame.png');
      console.log('Saved clean assets/sprites/btn_home_sound_off_frame.png');
    }
  }
}

buildCleanMenuButtons();
