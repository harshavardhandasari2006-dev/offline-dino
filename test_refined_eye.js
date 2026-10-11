const sharp = require('sharp');

(async () => {
  // Let's create the refined classic cartoon eye SVG:
  // Dimensions: 24x24 canvas
  // Eye ellipse: cx: 12, cy: 12, rx: 5.5, ry: 7.5, stroke-width: 1.4, fill: #ffffff, stroke: #1a2e15
  // Pupil: cx: 13.5, cy: 12.5, rx: 3.2, ry: 4.5, fill: #111827
  // Catchlight highlight: cx: 14.5, cy: 10.5, r: 1.1, fill: #ffffff
  
  const svgOpen = `
  <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(12, 12) rotate(-6) translate(-12, -12)">
      <!-- Clean white cartoon sclera with fine dark outline -->
      <ellipse cx="12" cy="12" rx="5.6" ry="7.6" fill="#ffffff" stroke="#142410" stroke-width="1.3" />
      <!-- Centered/forward-looking solid black pupil -->
      <ellipse cx="13.2" cy="12.2" rx="3.1" ry="4.3" fill="#111827" />
      <!-- Crisp classic catchlight -->
      <circle cx="14.2" cy="10.2" r="1.1" fill="#ffffff" />
    </g>
  </svg>
  `;

  // Closed eye (⌒)
  const svgClosed = `
  <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(12, 12) rotate(-6) translate(-12, -12)">
      <path d="M 6.5,13.5 Q 12,8.5 17.5,13.5" fill="none" stroke="#142410" stroke-width="1.8" stroke-linecap="round" />
    </g>
  </svg>
  `;

  await sharp(Buffer.from(svgOpen)).png().toFile('refined_master_eye_open.png');
  await sharp(Buffer.from(svgClosed)).png().toFile('refined_master_eye_closed.png');

  // Now let's composite onto dino_run_0 at the exact eye center:
  // In dino_run_0 (110x97): eye center is at (73.5, 23.5)
  // Our 24x24 eye has center at (12, 12)
  // So left = Math.round(73.5 - 12) = 62, top = Math.round(23.5 - 12) = 12
  const eyeOpen = await sharp('refined_master_eye_open.png').toBuffer();
  
  await sharp('assets/sprites/dino_run_0.png')
    .composite([{
      input: eyeOpen,
      left: 62,
      top: 11
    }])
    .toFile('test_run_0_refined_eye.png');

  console.log('Created refined_master_eye_open.png and test_run_0_refined_eye.png');
})();
