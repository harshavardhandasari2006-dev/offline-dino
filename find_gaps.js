const sharp = require('sharp');

async function findGaps() {
  const { data, info } = await sharp('crop_running_8_frames.png').raw().toBuffer({ resolveWithObject: true });
  console.log('Image width:', info.width, 'height:', info.height);

  const dinoCount = [];
  for (let x = 0; x < info.width; x++) {
    let cnt = 0;
    for (let y = 35; y < 132; y++) {
      const idx = (y * info.width + x) * info.channels;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      // Dino pixel: green body, cream belly, or dark outline
      const isDino = (g > r + 8 && g > b + 8 && g > 45) ||
                     (r < 80 && g < 85 && b < 80) ||
                     (r > 165 && g > 145 && b < 185 && r >= g);
      if (isDino) cnt++;
    }
    dinoCount.push(cnt);
  }

  // Find local minima where dinoCount is smallest between each figure
  console.log('Dino column density profile:');
  for (let x = 0; x < info.width; x += 10) {
    const chunk = dinoCount.slice(x, x + 10).map(v => String(v).padStart(2, ' ')).join(' ');
    console.log(`x=${String(x).padStart(3, '0')}: ${chunk}`);
  }
}

findGaps().catch(console.error);
