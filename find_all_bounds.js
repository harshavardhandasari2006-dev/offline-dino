const sharp = require('sharp');

async function findCharacters() {
  const { data, info } = await sharp('assets/style1_reference.jpg').raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  function isDinoPixel(x, y) {
    const idx = (y * w + x) * 3;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    // Green skin
    if (g > r + 15 && g > b + 15) return true;
    // Belly cream
    if (r > 190 && g > 180 && b < 190 && Math.abs(r - g) < 30 && r > b + 25) return true;
    // Spines / eye
    if (r < 65 && g < 75 && b < 65) return true;
    return false;
  }

  function getClustersInRegion(rx1, ry1, rx2, ry2, minColCount = 15) {
    const colCounts = [];
    for (let x = rx1; x <= rx2; x++) {
      let count = 0;
      for (let y = ry1; y <= ry2; y++) {
        if (isDinoPixel(x, y)) count++;
      }
      colCounts[x] = count;
    }
    const clusters = [];
    let inCluster = false, start = 0;
    for (let x = rx1; x <= rx2; x++) {
      if (colCounts[x] >= minColCount && !inCluster) {
        inCluster = true;
        start = x;
      } else if (colCounts[x] < minColCount && inCluster) {
        inCluster = false;
        clusters.push({ start, end: x - 1, width: x - start });
      }
    }
    if (inCluster) clusters.push({ start, end: rx2, width: rx2 - start + 1 });
    return clusters;
  }

  console.log('Panel 1 (Idle):', getClustersInRegion(5, 190, 480, 320));
  console.log('Panel 2 (Run):', getClustersInRegion(485, 190, 1020, 320));
  console.log('Panel 3 (Jump):', getClustersInRegion(5, 360, 510, 500));
  console.log('Panel 4 (Duck):', getClustersInRegion(515, 360, 1020, 500));
  console.log('Panel 5 (Collision):', getClustersInRegion(5, 545, 410, 660));
}

findCharacters();
