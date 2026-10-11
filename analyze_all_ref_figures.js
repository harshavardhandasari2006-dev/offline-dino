const sharp = require('sharp');
const fs = require('fs');

async function analyzeAllRefFigures() {
  const { data, info } = await sharp('assets/style1_reference.jpg').raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [data[idx], data[idx + 1], data[idx + 2]];
  }

  // Check ground lines in each panel row:
  // Row 1: Idle & Run (around y ~ 290..305)
  // Row 2: Jump & Duck (around y ~ 470..485)
  // Row 3: Collision (around y ~ 645..660)

  // In Row 1 (Idle & Run):
  // Let's sample x=80 (Idle 0) from y=280 to 305:
  console.log('--- Idle 0 ground line ---');
  for (let y = 285; y <= 305; y++) {
    const [r, g, b] = getPixel(80, y);
    console.log(`y=${y}: R=${r}, G=${g}, B=${b}`);
  }

  console.log('--- Run 0 ground line ---');
  for (let y = 285; y <= 305; y++) {
    const [r, g, b] = getPixel(543, y);
    console.log(`y=${y}: R=${r}, G=${g}, B=${b}`);
  }

  console.log('--- Jump 0 ground line ---');
  for (let y = 460; y <= 480; y++) {
    const [r, g, b] = getPixel(60, y);
    console.log(`y=${y}: R=${r}, G=${g}, B=${b}`);
  }

  console.log('--- Duck 0 ground line ---');
  for (let y = 460; y <= 480; y++) {
    const [r, g, b] = getPixel(560, y);
    console.log(`y=${y}: R=${r}, G=${g}, B=${b}`);
  }

  console.log('--- Dead dino ground line ---');
  for (let y = 635; y <= 655; y++) {
    const [r, g, b] = getPixel(270, y);
    console.log(`y=${y}: R=${r}, G=${g}, B=${b}`);
  }
}

analyzeAllRefFigures();
