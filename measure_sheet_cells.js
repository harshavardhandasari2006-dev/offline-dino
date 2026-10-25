const sharp = require('sharp');
const path = require('path');

async function measureSheet() {
  const { data, info } = await sharp('test_duck_jump_animations/jump_sheet_original.png').raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const cuts = [
    [0, 212, 420, 620, 820, 1024],
    [0, 195, 405, 610, 818, 1024]
  ];

  for (let r = 0; r < 2; r++) {
    const y0 = r === 0 ? 0 : 210;
    const y1 = r === 0 ? 210 : h;
    for (let c = 0; c < 5; c++) {
      const x0 = cuts[r][c];
      const x1 = cuts[r][c+1];
      let minX = w, maxX = 0, minY = h, maxY = 0, count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * w + x) * 4;
          if (data[idx] > 12 || data[idx+1] > 12 || data[idx+2] > 12) {
            count++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      const frameNum = r * 5 + c + 1;
      const dw = maxX - minX + 1;
      const dh = maxY - minY + 1;
      console.log(`Cell ${frameNum} (r=${r}, c=${c}): bbox=[${minX}, ${minY} to ${maxX}, ${maxY}], w=${dw}, h=${dh}`);
    }
  }
}
measureSheet();
