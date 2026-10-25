const sharp = require('sharp');
const path = require('path');
const uploadDir = 'C:\\Users\\asus\\.gemini\\antigravity-ide\\brain\\1c3e5139-b62e-4146-8621-13708d351c51\\.user_uploaded';
const refPath = path.join(uploadDir, 'media_1792219879817.jpg');

async function buildCleanMaskedButtons() {
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

        // Background identification:
        // 1. Blue sky
        const isSky = (bCol > 130 && bCol > r + 10);
        // 2. Purple / mauve distant mountains
        const isPurpleMountain = (bCol > 105 && r > 100 && Math.abs(r - bCol) < 55 && g < r + 10 && g > 90);
        // 3. Bright orange canyon rocks
        const isOrangeCanyon = (r > 195 && g in [110, 185] && bCol < 95);
        // 4. Green cactus or leaf
        const isGreen = (g > 55 && g > r * 1.06 && g > bCol);
        const isDarkSpine = (g > r && g > bCol && g < 100 && r < 75);

        if (y < 45) {
          if (!isGreen && !isDarkSpine) {
            if (isSky || isPurpleMountain || isOrangeCanyon) {
              out[outIdx4 + 3] = 0;
            } else if (y < 17) {
              // Above stone frame, if it's not green cactus, it must be background!
              // (Stone frame does not begin until y >= 17)
              out[outIdx4 + 3] = 0;
            }
          }
        }
      }
    }

    const outPath = `assets/sprites/btn_home_${b.name}_frame.png`;
    await sharp(out, { raw: { width: w, height: h, channels: 4 } })
      .png()
      .toFile(outPath);
    console.log(`Saved pristine ${outPath}`);

    if (b.name === 'sound') {
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
      console.log('Saved pristine assets/sprites/btn_home_sound_off_frame.png');
    }
  }
}

buildCleanMaskedButtons();
