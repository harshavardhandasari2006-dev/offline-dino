const sharp = require('sharp');

async function mapAllFrames() {
  const { data, info } = await sharp('assets/style1_reference.jpg').raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [data[idx], data[idx + 1], data[idx + 2]];
  }

  function isCharacter(x, y, groundY) {
    if (groundY && y > groundY) return false;
    const [r, g, b] = getPixel(x, y);
    // Green
    if (g > r + 8 && g > b + 8 && g > 40) return true;
    if (g > 85 && g > r && g > b + 15) return true;
    // Spines / dark
    if (r < 75 && g < 85 && b < 75 && (r > 10 || g > 10 || b > 10)) return true;
    // Tongue
    if (r > 130 && g < 120 && b < 130 && r > g + 15) return true;
    // Belly cream
    if (r > 170 && g > 160 && r > b + 20 && g > b + 20) return true;
    // Eye white / pupil
    if (r > 200 && g > 200 && b > 200 && (!groundY || y < groundY - 25)) return true;
    if (r < 60 && g < 60 && b < 60 && (!groundY || y < groundY - 25)) return true;
    // Claws
    if (groundY && y <= groundY && r > 200 && g > 185 && b > 140 && g - b > 20) return true;
    // Star eyes on dead dino
    if (r > 180 && g > 150 && b < 120) return true;
    return false;
  }

  const panels = [
    { name: 'Panel 1 (Idle)', minX: 10, maxX: 470, minY: 194, maxY: 301, groundY: 299 },
    { name: 'Panel 2 (Run)', minX: 485, maxX: 1020, minY: 194, maxY: 301, groundY: 294 },
    { name: 'Panel 3 (Jump)', minX: 10, maxX: 505, minY: 360, maxY: 480, groundY: 476 },
    { name: 'Panel 4 (Duck)', minX: 520, maxX: 1020, minY: 385, maxY: 480, groundY: 475 },
    { name: 'Panel 5 (Collision)', minX: 10, maxX: 400, minY: 550, maxY: 660, groundY: 650 }
  ];

  for (const p of panels) {
    console.log('=== ' + p.name + ' ===');
    const cols = [];
    for (let x = p.minX; x <= p.maxX; x++) {
      let count = 0;
      for (let y = p.minY; y <= p.maxY; y++) {
        if (isCharacter(x, y, p.groundY)) count++;
      }
      cols.push(count);
    }
    
    const clusters = [];
    let inClust = false, startX = 0;
    for (let i = 0; i < cols.length; i++) {
      const x = p.minX + i;
      if (cols[i] >= 12 && !inClust) {
        inClust = true; startX = x;
      } else if (cols[i] < 12 && inClust) {
        inClust = false;
        clusters.push({ startX, endX: x - 1, w: x - startX });
      }
    }
    if (inClust) clusters.push({ startX, endX: p.maxX, w: p.maxX - startX + 1 });
    
    let frameIdx = 0;
    for (let ci = 0; ci < clusters.length; ci++) {
      const c = clusters[ci];
      if (c.w < 20) continue;
      let actualMinX = c.endX, actualMaxX = c.startX, actualMinY = p.maxY, actualMaxY = p.minY;
      for (let x = c.startX; x <= c.endX; x++) {
        for (let y = p.minY; y <= p.maxY; y++) {
          if (isCharacter(x, y, p.groundY)) {
            if (x < actualMinX) actualMinX = x;
            if (x > actualMaxX) actualMaxX = x;
            if (y < actualMinY) actualMinY = y;
            if (y > actualMaxY) actualMaxY = y;
          }
        }
      }
      console.log('  Frame ' + frameIdx + ': x=[' + actualMinX + '..' + actualMaxX + '] (w=' + (actualMaxX - actualMinX + 1) + '), y=[' + actualMinY + '..' + actualMaxY + '] (h=' + (actualMaxY - actualMinY + 1) + ')');
      frameIdx++;
    }
  }
}
mapAllFrames();
