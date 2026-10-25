const sharp = require('sharp');

async function findContours() {
  const buttons = ['skins', 'highscore', 'sound', 'exit'];
  for (const name of buttons) {
    const { data, info } = await sharp(`assets/sprites/btn_home_${name}_frame.png`).raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    console.log(`=== ${name} (w=${w}) ===`);
    for (let y = 15; y < 30; y += 3) {
      let minX = 999, maxX = -1;
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = data[idx], g = data[idx+1], b = data[idx+2];
        const isCactus = (g > 55 && g > r * 1.06 && g > b);
        const isStone = (r > 80 && g > 40 && b < 100 && r > b + 20);
        const isDark = (r < 75 && g < 55 && b < 45 && r >= b);
        const isCream = (r > 190 && g > 180 && b > 140);
        if (isCactus || isStone || isDark || isCream) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
      console.log(`y=${y}: fg spans ${minX}..${maxX}`);
    }
  }
}
findContours();
