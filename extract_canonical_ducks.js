const sharp = require('sharp');
const fs = require('fs');

async function testExtractDucks() {
  const { data: refData, info: refInfo } = await sharp('assets/style1_reference.jpg').raw().toBuffer({ resolveWithObject: true });
  const W = refInfo.width, H = refInfo.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [refData[idx], refData[idx + 1], refData[idx + 2]];
  }
  function isGreen(x, y) {
    const [r, g, b] = getPixel(x, y);
    return (g > r + 8 && g > b + 8 && g > 40) || (g > 85 && g > r && g > b + 15);
  }
  function isSpine(x, y) {
    const [r, g, b] = getPixel(x, y);
    return (r > 35 && r < 95 && g > 45 && g < 105 && b > 25 && b < 80);
  }
  function isBelly(x, y) {
    const [r, g, b] = getPixel(x, y);
    return (r > 190 && g > 185 && b > 140 && r > b + 25);
  }
  function isEyeOrMouth(x, y) {
    const [r, g, b] = getPixel(x, y);
    if (r < 45 && g < 45 && b < 45) return true;
    if (r > 200 && g > 200 && b > 200) return true;
    if (r > 140 && g < 90 && b < 90) return true; // tongue
    return false;
  }
  function isDino(x, y) {
    return isGreen(x, y) || isSpine(x, y) || isBelly(x, y) || isEyeOrMouth(x, y);
  }

  const configs = [
    { name: 'duck_0', cx: 572 },
    { name: 'duck_1', cx: 677 },
    { name: 'duck_2', cx: 777 },
    { name: 'duck_3', cx: 879 },
    { name: 'duck_4', cx: 975 }
  ];

  const canvasW = 128, canvasH = 112;

  for (const cfg of configs) {
    const buf = Buffer.alloc(canvasW * canvasH * 4, 0);

    for (let cy = 0; cy < canvasH; cy++) {
      const refY = 476 - (103 - cy);
      for (let cx = 0; cx < canvasW; cx++) {
        const refX = cfg.cx - 64 + cx;
        if (isDino(refX, refY)) {
          const [r, g, b] = getPixel(refX, refY);
          const idx = (cy * canvasW + cx) * 4;
          buf[idx] = r;
          buf[idx + 1] = g;
          buf[idx + 2] = b;
          buf[idx + 3] = 255;
        }
      }
    }
    await sharp(buf, { raw: { width: canvasW, height: canvasH, channels: 4 } })
      .png()
      .toFile(`test_canonical_${cfg.name}.png`);
    console.log(`Saved test_canonical_${cfg.name}.png`);
  }

  // Create a 5-frame montage
  const compositeList = configs.map((cfg, i) => ({
    input: `test_canonical_${cfg.name}.png`,
    left: i * canvasW,
    top: 0
  }));

  await sharp({
    create: {
      width: canvasW * 5,
      height: canvasH,
      channels: 4,
      background: { r: 50, g: 150, b: 240, alpha: 1 }
    }
  })
  .composite(compositeList)
  .png()
  .toFile('test_canonical_ducks_montage.png');
  console.log('Saved test_canonical_ducks_montage.png');
}

testExtractDucks();
