const sharp = require('sharp');
const fs = require('fs');

async function findExactPanelCoordinates() {
  const { data, info } = await sharp('assets/style1_reference.jpg').raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [data[idx], data[idx + 1], data[idx + 2]];
  }

  function isDino(x, y, groundY) {
    if (groundY && y > groundY) return false;
    const [r, g, b] = getPixel(x, y);
    // Green
    if ((g > r + 10 && g > b + 10 && g > 40) || (g > 80 && g > r && g > b + 15)) return true;
    // Dark scutes/outline
    if (r < 75 && g < 85 && b < 75 && (r > 5 || g > 5 || b > 5)) return true;
    // Cream chin/belly
    if (r > 175 && g > 155 && r > b + 20 && g > b + 15) return true;
    // Eye white / pupil
    if (r > 200 && g > 200 && b > 195 && (!groundY || y < groundY - 20)) return true;
    if (r < 60 && g < 60 && b < 60 && (!groundY || y < groundY - 20)) return true;
    // Tongue/mouth
    if (r > 120 && g < 120 && b < 130 && r > g + 15) return true;
    // Claws
    if (r > 190 && g > 180 && b < 170 && g - b > 15 && (!groundY || (y >= groundY - 12 && y <= groundY))) return true;
    // Dead star/swirl
    if (r > 180 && g > 150 && b < 120) return true;
    return false;
  }

  const panels = [
    { name: 'Panel 1 (Idle)', minX: 10, maxX: 490, minY: 170, maxY: 305, groundY: 300 },
    { name: 'Panel 2 (Run)', minX: 505, maxX: 1020, minY: 170, maxY: 305, groundY: 300 },
    { name: 'Panel 3 (Jump)', minX: 10, maxX: 505, minY: 345, maxY: 485, groundY: 476 },
    { name: 'Panel 4 (Duck)', minX: 515, maxX: 1020, minY: 345, maxY: 485, groundY: 476 },
    { name: 'Panel 5 (Collision)', minX: 10, maxX: 450, minY: 520, maxY: 660, groundY: 642 }
  ];

  for (const p of panels) {
    console.log(`\n=== ${p.name} ===`);
    const cols = [];
    for (let x = p.minX; x <= p.maxX; x++) {
      let count = 0;
      for (let y = p.minY; y <= p.maxY; y++) {
        if (isDino(x, y, p.groundY)) count++;
      }
      cols.push(count);
    }

    const clusters = [];
    let inC = false, start = 0;
    for (let i = 0; i < cols.length; i++) {
      const x = p.minX + i;
      if (cols[i] >= 12 && !inC) {
        inC = true; start = x;
      } else if (cols[i] < 6 && inC) {
        inC = false;
        clusters.push({ start, end: x - 1, w: x - start });
      }
    }
    if (inC) clusters.push({ start, end: p.maxX, w: p.maxX - start + 1 });

    let idx = 0;
    for (const c of clusters) {
      if (c.w < 25) continue;
      // Find exact bounds within cluster
      let bMinX = c.end, bMaxX = c.start, bMinY = p.maxY, bMaxY = p.minY;
      for (let x = c.start; x <= c.end; x++) {
        for (let y = p.minY; y <= p.maxY; y++) {
          if (isDino(x, y, p.groundY)) {
            if (x < bMinX) bMinX = x;
            if (x > bMaxX) bMaxX = x;
            if (y < bMinY) bMinY = y;
            if (y > bMaxY) bMaxY = y;
          }
        }
      }
      console.log(`  Figure ${idx}: x=[${bMinX}..${bMaxX}] (w=${bMaxX - bMinX + 1}), y=[${bMinY}..${bMaxY}] (h=${bMaxY - bMinY + 1}), groundOffset=${p.groundY - bMaxY}`);
      idx++;
    }
  }
}

findExactPanelCoordinates();
