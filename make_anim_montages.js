const sharp = require('sharp');
const path = require('path');

async function createMontage(prefix, count, outName) {
  const images = [];
  for (let i = 1; i <= count; i++) {
    const pad = i.toString().padStart(2, '0');
    const p = path.join('assets/sprites', `${prefix}_${pad}.png`);
    images.push(p);
  }

  // Composite them horizontally: 10 * 240 = 2400 x 210
  const compositeList = [];
  for (let i = 0; i < count; i++) {
    compositeList.push({
      input: images[i],
      left: i * 240,
      top: 0
    });
  }

  await sharp({
    create: {
      width: count * 240,
      height: 210,
      channels: 4,
      background: { r: 240, g: 240, b: 240, alpha: 1 }
    }
  })
  .composite(compositeList)
  .png()
  .toFile(outName);

  console.log(`Saved ${outName}`);
}

async function run() {
  await createMontage('run', 10, 'scratch_run_montage.png');
  await createMontage('jump', 10, 'scratch_jump_montage.png');
  await createMontage('duck', 10, 'scratch_duck_montage.png');
}
run();
