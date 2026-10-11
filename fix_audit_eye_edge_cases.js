const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function fixAuditEyeEdgeCases() {
  const SPRITES_DIR = path.join(__dirname, 'assets', 'sprites');

  // Master open eye SVG
  const svgOpen = `
  <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(128, 128) rotate(-4) translate(-128, -128)">
      <ellipse cx="128" cy="128" rx="80" ry="102" fill="#ffffff" stroke="#162412" stroke-width="18" />
      <ellipse cx="146" cy="136" rx="46" ry="62" fill="#111827" />
      <circle cx="160" cy="115" r="17" fill="#ffffff" />
      <circle cx="132" cy="154" r="7" fill="#ffffff" opacity="0.65" />
    </g>
  </svg>
  `;
  const eyeOpenBuf = await sharp(Buffer.from(svgOpen))
    .resize(24, 24, { kernel: 'lanczos3' })
    .png().toBuffer();

  // 1. Composite on dino_idle_1 at { left: 68, top: 19 }
  {
    const file = path.join(SPRITES_DIR, 'dino_idle_1.png');
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    const buf = Buffer.from(data);
    const updated = await sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } })
      .composite([{ input: eyeOpenBuf, left: 68, top: 19 }])
      .png().toBuffer();
    fs.writeFileSync(file, updated);
    console.log('✓ Fixed dino_idle_1.png eye');
  }

  // 2. Composite on dino_jump_0 at { left: 71, top: 18 }
  {
    const file = path.join(SPRITES_DIR, 'dino_jump_0.png');
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    const buf = Buffer.from(data);
    const updated = await sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } })
      .composite([{ input: eyeOpenBuf, left: 71, top: 18 }])
      .png().toBuffer();
    fs.writeFileSync(file, updated);
    console.log('✓ Fixed dino_jump_0.png eye');
  }

  // 3. Clear single red pixel in dino_jump_2 in box { left: 68, top: 16 }
  {
    const file = path.join(SPRITES_DIR, 'dino_jump_2.png');
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    const buf = Buffer.from(data);
    for (let y = 16; y < 16 + 24; y++) {
      for (let x = 68; x < 68 + 24; x++) {
        const idx = (y * info.width + x) * 4;
        const r = buf[idx], g = buf[idx + 1], b = buf[idx + 2];
        if (r > 150 && r > g + 40 && r > b + 40) {
          // Replace red pixel with dark cartoon outline
          buf[idx] = 22;
          buf[idx + 1] = 36;
          buf[idx + 2] = 18;
        }
      }
    }
    const updated = await sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png().toBuffer();
    fs.writeFileSync(file, updated);
    console.log('✓ Cleared single red pixel in dino_jump_2.png');
  }

  console.log('\nAll eye audit edge cases resolved!');
}

fixAuditEyeEdgeCases().catch(err => {
  console.error(err);
  process.exit(1);
});
