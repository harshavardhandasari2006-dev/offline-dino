const sharp = require('sharp');
const path = require('path');
const uploadDir = 'C:\\Users\\asus\\.gemini\\antigravity-ide\\brain\\1c3e5139-b62e-4146-8621-13708d351c51\\.user_uploaded';
const refPath = path.join(uploadDir, 'media_1792219879817.jpg');

async function buildCleanMenuButtonsV2() {
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

        const isGreen = (g > 55 && g > r * 1.05 && g > bCol);
        const isDarkSpine = (g > r && g > bCol && g < 100 && r < 75);
        const isCactus = isGreen || isDarkSpine;
        const isSky = (bCol > 130 && bCol > r + 5);

        if (y < 17) {
          if (b.name === 'skins') {
            if (x > 65 || !isCactus) out[outIdx4 + 3] = 0;
          } else if (b.name === 'exit') {
            if (x < 135 || !isCactus) out[outIdx4 + 3] = 0;
          } else if (b.name === 'highscore' || b.name === 'sound') {
            // For High Score and Sound: keep cacti AND rock pedestal bases
            const isPedestalX = (x >= 60 && x <= 160);
            const isPedestalRock = isPedestalX && !isSky && (
              isCactus ||
              (r > 60 && g > 30 && r > bCol + 15) ||
              (r < 65 && g < 45 && bCol < 40)
            );
            if (isCactus || isPedestalRock) {
              out[outIdx4 + 3] = 255;
            } else {
              out[outIdx4 + 3] = 0;
            }
          }
        } else {
          // At or below stone frame (y >= 17):
          // Only outer corner notches outside cacti:
          if (b.name === 'skins' && x < 24 && y < 38 && !isCactus) {
            out[outIdx4 + 3] = 0;
          } else if (b.name === 'exit' && x > 218 && y < 38 && !isCactus) {
            out[outIdx4 + 3] = 0;
          }
        }
      }
    }

    const outPath = `assets/sprites/btn_home_${b.name}_frame.png`;
    await sharp(out, { raw: { width: w, height: h, channels: 4 } })
      .png()
      .toFile(outPath);
    console.log(`Saved clean ${outPath}`);

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
      console.log('Saved clean assets/sprites/btn_home_sound_off_frame.png');
    }
  }
}

buildCleanMenuButtonsV2();
