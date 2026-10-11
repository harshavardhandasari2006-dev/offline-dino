const sharp = require('sharp');
const fs = require('fs');

async function testPerfectMasterEye() {
  const svgOpen = `
  <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(128, 128) rotate(-4) translate(-128, -128)">
      <!-- Smooth cartoon outer outline and pure white sclera -->
      <ellipse cx="128" cy="128" rx="80" ry="102" fill="#ffffff" stroke="#162412" stroke-width="18" />
      
      <!-- Forward-facing solid black pupil -->
      <ellipse cx="146" cy="136" rx="46" ry="62" fill="#111827" />
      
      <!-- Crisp classic cartoon catchlight highlight -->
      <circle cx="160" cy="115" r="17" fill="#ffffff" />
      <circle cx="132" cy="154" r="7" fill="#ffffff" opacity="0.65" />
    </g>
  </svg>
  `;

  const svgClosed = `
  <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(128, 128) rotate(-4) translate(-128, -128)">
      <!-- Smooth curved cartoon closed eyelid arc (⌒) -->
      <path d="M 64,142 Q 128,78 192,142" fill="none" stroke="#162412" stroke-width="20" stroke-linecap="round" />
    </g>
  </svg>
  `;

  const masterEyeOpen = await sharp(Buffer.from(svgOpen))
    .resize(24, 24, { kernel: 'lanczos3' })
    .png().toBuffer();

  const masterEyeClosed = await sharp(Buffer.from(svgClosed))
    .resize(24, 24, { kernel: 'lanczos3' })
    .png().toBuffer();

  fs.writeFileSync('canonical_master_eye_v4_open.png', masterEyeOpen);
  fs.writeFileSync('canonical_master_eye_v4_closed.png', masterEyeClosed);

  await sharp(masterEyeOpen).resize(240, 240, { kernel: 'nearest' }).toFile('preview_master_eye_v4_open.png');
  await sharp(masterEyeClosed).resize(240, 240, { kernel: 'nearest' }).toFile('preview_master_eye_v4_closed.png');

  console.log('Saved preview_master_eye_v4_open.png and closed');
}

testPerfectMasterEye();
