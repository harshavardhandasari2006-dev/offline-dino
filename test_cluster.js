const sharp = require('sharp');
const fs = require('fs');

async function findClusters() {
  const { data, info } = await sharp('assets/extracted/panel_run.jpg').raw().toBuffer({ resolveWithObject: true });
  const greenCols = [];
  for (let x = 0; x < info.width; x++) {
    let count = 0;
    for (let y = 30; y < 140; y++) {
      const idx = (y * info.width + x) * 3;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      // Dino green or yellow-cream belly or dark spines
      const isGreen = g > r + 15 && g > b + 10;
      const isBelly = r > 180 && g > 170 && b < 170 && r > b + 20 && Math.abs(r - g) < 40;
      const isSpine = (r < 70 && g < 90 && b < 70) && Math.abs(r - b) < 25;
      if (isGreen || isBelly || isSpine) count++;
    }
    greenCols[x] = count;
  }

  const clusters = [];
  let inCluster = false, start = 0;
  for (let x = 0; x < info.width; x++) {
    if (greenCols[x] >= 15 && !inCluster) {
      inCluster = true;
      start = x;
    } else if (greenCols[x] < 8 && inCluster) {
      inCluster = false;
      clusters.push({ start, end: x - 1, width: x - start });
    }
  }
  if (inCluster) clusters.push({ start, end: info.width - 1, width: info.width - start });
  console.log('Dino clusters in panel_run:', clusters);
}

findClusters();
