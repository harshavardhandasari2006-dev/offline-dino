const sharp = require('sharp');

(async () => {
  // Let's create the master eye with clean white sclera, solid black pupil, crisp highlight, clean dark outline
  const svgOpen = `
  <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(12, 12) rotate(-5) translate(-12, -12)">
      <!-- Pure white sclera with clean dark cartoon outline -->
      <ellipse cx="12" cy="12" rx="6.0" ry="8.2" fill="#ffffff" stroke="#142410" stroke-width="1.4" />
      <!-- Solid black cartoon pupil looking forward -->
      <ellipse cx="13.2" cy="12.4" rx="3.3" ry="4.5" fill="#111827" />
      <!-- Clean cartoon catchlight highlight -->
      <circle cx="14.4" cy="10.2" r="1.15" fill="#ffffff" />
    </g>
  </svg>
  `;

  await sharp(Buffer.from(svgOpen)).png().toFile('master_eye_v3.png');
  const eyeBuf = await sharp('master_eye_v3.png').toBuffer();

  // Test composite on clean run_0 from original backup or clean
  // Let's see: in dino_run_0, top-left is (61, 10)
  const out = await sharp('test_run_clean_0.png')
    .composite([{
      input: eyeBuf,
      left: 61,
      top: 10
    }])
    .toFile('test_run_0_v3.png');

  console.log('Created test_run_0_v3.png');
})();
