const sharp = require('sharp');
const fs = require('fs');

async function cleanButtons() {
  const btnFiles = [
    { name: 'skins', file: 'scratch_ref_btn1_skins.png', w: 204, h: 100 },
    { name: 'highscore', file: 'scratch_ref_btn2_highscore.png', w: 202, h: 100 },
    { name: 'sound', file: 'scratch_ref_btn3_sound.png', w: 202, h: 100 },
    { name: 'exit', file: 'scratch_ref_btn4_exit.png', w: 224, h: 100 }
  ];

  for (const b of btnFiles) {
    const { data } = await sharp(b.file).raw().toBuffer({ resolveWithObject: true });
    const w = b.w, h = b.h;
    const mask = new Uint8Array(w * h);
    mask.fill(1); // 1 = fg, 0 = bg

    // For y < 25 (above stone frame):
    // If not cactus (not green) and not stone frame:
    for (let y = 0; y < 25; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 3;
        const r = data[idx], g = data[idx+1], b = data[idx+2];
        const isGreenCactus = (g > 75 && g > r * 1.15 && g > b);
        const isDarkCactusSpine = (g > r && g > b && r < 60 && g < 100);
        const isStoneTop = (y >= 16 && r > 110 && g > 60 && b < 60 && r > b + 50);
        const isDarkStoneBorder = (y >= 15 && r < 80 && g < 50 && b < 40 && r > b);
        
        if (!isGreenCactus && !isDarkCactusSpine && !isStoneTop && !isDarkStoneBorder) {
          mask[y * w + x] = 0;
        }
      }
    }
    
    // Build RGBA output
    const out = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const idx3 = i * 3;
      const idx4 = i * 4;
      out[idx4] = data[idx3];
      out[idx4 + 1] = data[idx3 + 1];
      out[idx4 + 2] = data[idx3 + 2];
      out[idx4 + 3] = mask[i] === 1 ? 255 : 0;
    }
    
    await sharp(out, { raw: { width: w, height: h, channels: 4 } })
      .png()
      .toFile('scratch_test_clean_' + b.name + '.png');
    console.log('Saved scratch_test_clean_' + b.name + '.png');
  }
}
cleanButtons();
