const sharp = require('sharp');
const fs = require('fs');

async function makeStrip() {
  const frames = [];
  for (let i = 1; i <= 10; i++) {
    const pad = i.toString().padStart(2, '0');
    frames.push('assets/sprites/run_' + pad + '.png');
  }

  const w = 160;
  const h = 140;
  const composites = [];
  for (let i = 0; i < 10; i++) {
    const resized = await sharp(frames[i]).resize(w, h, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).toBuffer();
    composites.push({
      input: resized,
      left: i * w,
      top: 0
    });
  }

  fs.mkdirSync('audit_evidence', { recursive: true });
  await sharp({
    create: {
      width: w * 10,
      height: h,
      channels: 4,
      background: { r: 245, g: 245, b: 240, alpha: 1 }
    }
  }).composite(composites).png().toFile('audit_evidence/run_cycle_10_strip.png');
  console.log('Created audit_evidence/run_cycle_10_strip.png');
}
makeStrip().catch(console.error);
