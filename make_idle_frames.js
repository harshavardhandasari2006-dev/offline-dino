const sharp = require('sharp');
const fs = require('fs');

async function makeIdleFrames() {
  const baseImg = await sharp('assets/sprites/dino_run_2.png').toBuffer();

  // 1. dino_idle_0: The flawless standing upright mascot pose (open happy eyes, cute smile, rounded skull)
  fs.copyFileSync('assets/sprites/dino_run_2.png', 'assets/sprites/dino_idle_0.png');
  console.log('Saved dino_idle_0.png (Clean, rounded, stationary mascot)');

  // 2. dino_idle_1: Half-closed blink / cute micro-expression (eyelid partially lowered)
  const svgHalfBlink = Buffer.from(`
    <svg width="128" height="112" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="83" cy="27" rx="6.5" ry="4.5" fill="#6ec837" />
      <path d="M 76,28 Q 83,24 89,28" fill="none" stroke="#1b2d12" stroke-width="2.2" stroke-linecap="round" />
    </svg>
  `);
  await sharp(baseImg)
    .composite([{ input: svgHalfBlink }])
    .png()
    .toFile('assets/sprites/dino_idle_1.png');
  console.log('Saved dino_idle_1.png (Half-closed eyelid)');

  // 3. dino_idle_2: Fully closed peaceful blink (⌒)
  const svgClosedBlink = Buffer.from(`
    <svg width="128" height="112" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="83" cy="30" rx="7.2" ry="6.2" fill="#62ba32" />
      <ellipse cx="83" cy="30" rx="6.5" ry="5.5" fill="#6ec837" />
      <path d="M 76,31 Q 83,24 90,31" fill="none" stroke="#1b2d12" stroke-width="2.5" stroke-linecap="round" />
    </svg>
  `);
  await sharp(baseImg)
    .composite([{ input: svgClosedBlink }])
    .png()
    .toFile('assets/sprites/dino_idle_2.png');
  console.log('Saved dino_idle_2.png (Fully closed cute blink)');

  // 4. dino_idle_3: Curious look-around / raised eyebrow micro-expression
  const svgRaisedBrow = Buffer.from(`
    <svg width="128" height="112" xmlns="http://www.w3.org/2000/svg">
      <!-- Natural cute cartoon brow raise on the forehead contour -->
      <path d="M 77,20 Q 83,16 89,20" fill="none" stroke="#1b2d12" stroke-width="2.3" stroke-linecap="round" />
    </svg>
  `);
  await sharp(baseImg)
    .composite([{ input: svgRaisedBrow }])
    .png()
    .toFile('assets/sprites/dino_idle_3.png');
  console.log('Saved dino_idle_3.png (Raised eyebrow / curious expression)');
}

makeIdleFrames().catch(err => {
  console.error(err);
  process.exit(1);
});
