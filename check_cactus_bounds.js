const sharp = require('sharp');
async function checkBounds() {
  const { data, info } = await sharp('assets/sprites/btn_home_skins_frame.png').raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  for (let y = 0; y < 45; y++) {
    let minX = 999, maxX = -1;
    for (let x = 0; x < 60; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      if (g > 55 && g > r * 1.1 && g > b) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    if (maxX !== -1) console.log('y=' + y + ': cactus x ' + minX + '..' + maxX);
  }
}
checkBounds();
