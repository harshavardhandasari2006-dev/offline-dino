const sharp = require('sharp');
const path = require('path');

async function exportCleanLoadingDino() {
  await sharp('scratch_segmented_img1.png')
    .extract({ left: 9, top: 10, width: 154, height: 78 })
    .png()
    .toFile('assets/sprites/loading_dino.png');

  console.log('Saved clean static loading dino: assets/sprites/loading_dino.png (154x78)');
}

exportCleanLoadingDino().catch(console.error);
