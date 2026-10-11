const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function analyzeLegs() {
  const { data, info } = await sharp('assets/sprites/dino_run_1.png').raw().toBuffer({ resolveWithObject: true });
  console.log('Dino run 1: inspecting region x: [20..90], y: [68..104]');
  
  // Let's create an ASCII or cluster map of the leg region
  for (let y = 70; y <= 104; y += 2) {
    let row = '';
    for (let x = 20; x <= 90; x += 1) {
      const idx = (y * info.width + x) * 4;
      const a = data[idx + 3];
      if (a < 50) row += ' ';
      else {
        const r = data[idx], g = data[idx+1], b = data[idx+2];
        if (r < 60 && g < 60 && b < 60) row += '#'; // outline
        else if (r > 180 && g > 180) row += '*'; // claw / toenail
        else if (g > 150) row += 'O'; // bright green (near leg)
        else if (g > 90) row += 'o'; // shaded green (far leg)
        else row += '.';
      }
    }
    console.log(`y=${String(y).padStart(3)}: ${row}`);
  }
}

analyzeLegs();
