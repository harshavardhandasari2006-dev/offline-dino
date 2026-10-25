const sharp = require('sharp');
const fs = require('fs');

async function generatePerfectSoundOff() {
  const w = 218;
  const h = 84;
  const left = 1019;
  const top = 838;

  // Extract base Sound button directly from master panorama at left: 1019, top: 838, width: 218, height: 84
  const pano = sharp('assets/sprites/homepage_seamless_panorama.jpg');
  const baseBuffer = await pano
    .extract({ left, top, width: w, height: h })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const data = Buffer.from(baseBuffer.data);

  // Start with a completely transparent buffer of 218x84
  // Outer frame, corners, wooden borders, and "Sound:" remain 100% untouched!
  const patchData = Buffer.alloc(w * h * 4, 0);

  // 1. Cover sound waves region: x in [50..82], y in [22..68]
  // Samples natural vertical cream gradient from clean reference column x = 85
  for (let y = 22; y <= 68; y++) {
    for (let x = 50; x <= 82; x++) {
      const idx = (y * w + x) * 4;
      const refIdx = (y * w + 85) * 4;
      patchData[idx] = data[refIdx];
      patchData[idx+1] = data[refIdx+1];
      patchData[idx+2] = data[refIdx+2];
      patchData[idx+3] = 255;
    }
  }

  // 2. Cover ON text region: x in [106..176], y in [44..76]
  // Fully covers all original ON text pixels so no dark edges or underline artifacts leak through
  for (let y = 44; y <= 76; y++) {
    for (let x = 106; x <= 176; x++) {
      const idx = (y * w + x) * 4;
      const refIdx = (y * w + 85) * 4;
      patchData[idx] = data[refIdx];
      patchData[idx+1] = data[refIdx+1];
      patchData[idx+2] = data[refIdx+2];
      patchData[idx+3] = 255;
    }
  }

  // Smooth 2px alpha feather strictly along outer boundaries
  for (let y = 22; y <= 68; y++) {
    for (let x = 50; x <= 82; x++) {
      const idx = (y * w + x) * 4;
      const dist = Math.min(x - 50, 82 - x, y - 22, 68 - y);
      if (dist === 0) patchData[idx+3] = 90;
      else if (dist === 1) patchData[idx+3] = 180;
    }
  }
  for (let y = 44; y <= 76; y++) {
    for (let x = 106; x <= 176; x++) {
      const idx = (y * w + x) * 4;
      const dist = Math.min(x - 106, 176 - x, y - 44, 76 - y);
      if (dist === 0) patchData[idx+3] = 90;
      else if (dist === 1) patchData[idx+3] = 180;
    }
  }

  const baseCleanPng = await sharp(patchData, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();

  // 3. Render vector overlay at 4x resolution for subpixel smoothness and lanczos3 antialiasing
  // Typography matches "ON", "Skins", "High Score", and "Exit":
  // - Font style: Heavy rounded cartoon sans-serif
  // - Color: Dark navy #0f172a
  // - Stroke thickness: 5.25px (matching 'O', 'N', 'E')
  // - Cap-height: 19.0px (y: 52.5 to 71.5), Baseline: 71.5 (identical to "ON")
  // - Alignment: Centered under "Sound:" at x = 139.5
  const scale = 4;
  const sw = w * scale;
  const sh = h * scale;

  const svgOverlay = `
    <svg width="${sw}" height="${sh}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <!-- Dark drop shadow for slash -->
      <line x1="22" y1="23" x2="55" y2="63" stroke="rgba(0,0,0,0.35)" stroke-width="4.8" stroke-linecap="round"/>
      <!-- Dark red border for slash -->
      <line x1="22" y1="23" x2="55" y2="63" stroke="#8b0000" stroke-width="4.0" stroke-linecap="round"/>
      <!-- Crisp vibrant red core -->
      <line x1="22" y1="23" x2="55" y2="63" stroke="#ef4444" stroke-width="2.6" stroke-linecap="round"/>
      
      <!-- 'OFF' Text in dark navy #0f172a matching button typography -->
      <g fill="#0f172a">
        <!-- Letter 'O' (Superellipse outer with oval inner counter, matching 'O' in 'ON') -->
        <path fill-rule="evenodd" d="
          M 119.5 52.5
          h 4.5
          a 6.5 6.5 0 0 1 6.5 6.5
          v 6.0
          a 6.5 6.5 0 0 1 -6.5 6.5
          h -4.5
          a 6.5 6.5 0 0 1 -6.5 -6.5
          v -6.0
          a 6.5 6.5 0 0 1 6.5 -6.5
          Z
          M 121.75 57.2
          a 3.5 4.8 0 0 0 -3.5 4.8
          v 0
          a 3.5 4.8 0 0 0 7.0 0
          v 0
          a 3.5 4.8 0 0 0 -3.5 -4.8
          Z
        " />
        
        <!-- Letter 'F' #1 (Rounded corners, 5.25px stem, matching 'E' in 'Exit') -->
        <path d="
          M 136.2 52.5
          h 10.05
          a 2.25 2.25 0 0 1 2.25 2.25
          v 0
          a 2.25 2.25 0 0 1 -2.25 2.25
          h -7.05
          v 3.5
          h 4.3
          a 2.0 2.0 0 0 1 2.0 2.0
          v 0
          a 2.0 2.0 0 0 1 -2.0 2.0
          h -4.3
          v 4.8
          a 2.2 2.2 0 0 1 -2.2 2.2
          h -0.85
          a 2.2 2.2 0 0 1 -2.2 -2.2
          v -14.6
          a 2.2 2.2 0 0 1 2.2 -2.2
          Z
        " />

        <!-- Letter 'F' #2 (Exact pair matching F #1) -->
        <path d="
          M 154.2 52.5
          h 10.05
          a 2.25 2.25 0 0 1 2.25 2.25
          v 0
          a 2.25 2.25 0 0 1 -2.25 2.25
          h -7.05
          v 3.5
          h 4.3
          a 2.0 2.0 0 0 1 2.0 2.0
          v 0
          a 2.0 2.0 0 0 1 -2.0 2.0
          h -4.3
          v 4.8
          a 2.2 2.2 0 0 1 -2.2 2.2
          h -0.85
          a 2.2 2.2 0 0 1 -2.2 -2.2
          v -14.6
          a 2.2 2.2 0 0 1 2.2 -2.2
          Z
        " />
      </g>
    </svg>
  `;

  const overlayPng = await sharp(Buffer.from(svgOverlay))
    .resize(w, h, { kernel: 'lanczos3' })
    .png()
    .toBuffer();

  const finalPatch = await sharp(baseCleanPng)
    .composite([
      { input: overlayPng, blend: 'over' }
    ])
    .png()
    .toBuffer();

  fs.writeFileSync('assets/sprites/home_sound_off_patch.png', finalPatch);
  console.log(`Successfully created pixel-perfect assets/sprites/home_sound_off_patch.png (${w}x${h})`);

  // Update js/sprite_data.js
  const base64 = finalPatch.toString('base64');
  let spriteCode = fs.readFileSync('js/sprite_data.js', 'utf8');
  spriteCode = spriteCode.replace(
    /"home_sound_off_patch": "data:image\/png;base64,[^"]+"/,
    `"home_sound_off_patch": "data:image/png;base64,${base64}"`
  );
  fs.writeFileSync('js/sprite_data.js', spriteCode);
  console.log('Successfully updated js/sprite_data.js with new base64 patch');
}

generatePerfectSoundOff().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
