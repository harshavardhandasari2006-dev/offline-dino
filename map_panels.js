const sharp = require('sharp');
const fs = require('fs');

async function mapPanels() {
  const { data, info } = await sharp('assets/style1_reference.jpg').raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  function pixel(x, y) {
    const idx = (y * w + x) * 3;
    return [data[idx], data[idx + 1], data[idx + 2]];
  }

  // Find panel rows
  // Look for white background separator lines or panel headers
  console.log('Sampling headers across y:');
  for (let y = 150; y < 650; y += 10) {
    let pLeft = pixel(20, y);
    let pRight = pixel(510, y);
    if (pLeft[0] < 30 && pLeft[1] < 60 && pLeft[2] > 70) {
      console.log(`y=${y}: Left has dark blue header pill:`, pLeft);
    }
    if (pRight[0] < 30 && pRight[1] < 60 && pRight[2] > 70) {
      console.log(`y=${y}: Right has dark blue header pill:`, pRight);
    }
  }
}

mapPanels();
