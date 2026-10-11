const sharp = require('sharp');

(async () => {
  // Let's create an SVG of the master cartoon eye at 8x supersampling (192x192) then resize down to 24x24
  // Eye outer contour: tilted oval
  // Sclera: pure white #FFFFFF
  // Outline: clean crisp dark #182215 / #111827
  // Pupil: rich solid black #111827
  // Highlight: clean pure white dot #FFFFFF
  
  const svgOpen = `
  <svg width="192" height="192" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(96, 96) rotate(-8) translate(-96, -96)">
      <!-- Outer black cartoon contour & white sclera -->
      <ellipse cx="96" cy="96" rx="58" ry="74" fill="#ffffff" stroke="#182215" stroke-width="15" />
      
      <!-- Solid black pupil looking forward-right -->
      <ellipse cx="112" cy="106" rx="36" ry="46" fill="#111827" />
      
      <!-- Crisp classic cartoon catchlight highlight -->
      <circle cx="122" cy="88" r="13" fill="#ffffff" />
    </g>
  </svg>
  `;

  // Closed eyelid curve (⌒)
  const svgClosed = `
  <svg width="192" height="192" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(96, 96) rotate(-8) translate(-96, -96)">
      <!-- Clean cartoon closed eyelid arc -->
      <path d="M 44,110 Q 96,62 148,110" fill="none" stroke="#182215" stroke-width="16" stroke-linecap="round" />
    </g>
  </svg>
  `;

  await sharp(Buffer.from(svgOpen))
    .resize(24, 24, { kernel: 'lanczos3' })
    .png()
    .toFile('master_eye_open_24.png');

  await sharp(Buffer.from(svgClosed))
    .resize(24, 24, { kernel: 'lanczos3' })
    .png()
    .toFile('master_eye_closed_24.png');

  console.log('Generated master_eye_open_24.png and master_eye_closed_24.png');
})();
