const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const userUploadedDir = 'C:\\Users\\asus\\.gemini\\antigravity-ide\\brain\\baf186b1-2f4d-4f3d-9084-83c9edace571\\.user_uploaded';
const outputDir = 'e:\\dino\\assets\\sprites';
const testDir = 'e:\\dino\\test_home_dino';

if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

// Check if pixel is neutral checkerboard / background shadow
function isBgPixel(r, g, b) {
  const isNeutral = Math.abs(r - g) <= 22 && Math.abs(g - b) <= 22 && Math.abs(r - b) <= 22;
  // Checkerboard squares (180..255) and soft background anti-aliased shadow (130..180)
  return isNeutral && r >= 135 && g >= 135 && b >= 135;
}

// Flood fill background removal from borders
function floodFillAlpha(data, width, height, channels, seedTolerance = 170) {
  const total = width * height;
  const visited = new Uint8Array(total);
  const q = new Int32Array(total);
  let qHead = 0, qTail = 0;

  function isBg(x, y) {
    const idx = (y * width + x) * channels;
    return isBgPixel(data[idx], data[idx + 1], data[idx + 2]);
  }

  // Seed borders
  for (let x = 0; x < width; x++) {
    if (isBg(x, 0)) { visited[x] = 1; q[qTail++] = x; }
    const btm = (height - 1) * width + x;
    if (isBg(x, height - 1) && !visited[btm]) { visited[btm] = 1; q[qTail++] = btm; }
  }
  for (let y = 0; y < height; y++) {
    const lft = y * width;
    if (isBg(0, y) && !visited[lft]) { visited[lft] = 1; q[qTail++] = lft; }
    const rgt = y * width + (width - 1);
    if (isBg(width - 1, y) && !visited[rgt]) { visited[rgt] = 1; q[qTail++] = rgt; }
  }

  while (qHead < qTail) {
    const curr = q[qHead++];
    const cx = curr % width;
    const cy = Math.floor(curr / width);

    const nbrs = [curr - 1, curr + 1, curr - width, curr + width];
    for (const n of nbrs) {
      if (n >= 0 && n < total) {
        const nx = n % width;
        const ny = Math.floor(n / width);
        if (Math.abs(nx - cx) <= 1 && Math.abs(ny - cy) <= 1 && !visited[n]) {
          if (isBg(nx, ny)) {
            visited[n] = 1;
            q[qTail++] = n;
          }
        }
      }
    }
  }

  // Create RGBA buffer
  const outBuf = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const sIdx = idx * channels;
      const oIdx = idx * 4;

      const r = data[sIdx];
      const g = data[sIdx + 1];
      const b = data[sIdx + 2];

      outBuf[oIdx] = r;
      outBuf[oIdx + 1] = g;
      outBuf[oIdx + 2] = b;

      if (visited[idx]) {
        outBuf[oIdx + 3] = 0; // Pure transparent background
      } else {
        let touchingBg = false;
        const nbrs = [idx - 1, idx + 1, idx - width, idx + width];
        for (const nb of nbrs) {
          if (nb >= 0 && nb < total && visited[nb]) {
            touchingBg = true;
            break;
          }
        }

        if (touchingBg) {
          const bright = (r + g + b) / 3;
          if (bright > 195 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25) {
            outBuf[oIdx + 3] = Math.max(0, Math.min(255, Math.round((255 - bright) * 3.5)));
          } else {
            outBuf[oIdx + 3] = 255;
          }
        } else {
          outBuf[oIdx + 3] = 255;
        }
      }
    }
  }

  return { outBuf, visited };
}

async function run() {
  console.log('=== EXTRACTING APPROVED HOMEPAGE DINOSAUR SUITE ===\n');

  const CANON_W = 280;
  const CANON_H = 400;
  const FOOT_Y = 385;
  const CENTER_X = 140;

  const deployedFrames = {};

  // -------------------------------------------------------------
  // 1. MASTER IDLE DINOSAUR (From Image 1: media_1792084934401.jpg)
  // -------------------------------------------------------------
  console.log('1. Processing Image 1 for Master Idle Dinosaur...');
  const img1Path = path.join(userUploadedDir, 'media_1792084934401.jpg');
  const img1Raw = await sharp(img1Path).raw().toBuffer({ resolveWithObject: true });
  const w1 = img1Raw.info.width, h1 = img1Raw.info.height;
  const { outBuf: img1Rgba } = floodFillAlpha(img1Raw.data, w1, h1, img1Raw.info.channels);

  // Crop to exact dino bounds: minX: 95, maxX: 810, minY: 12, maxY: 1005
  const img1CroppedBuf = await sharp(img1Rgba, { raw: { width: w1, height: h1, channels: 4 } })
    .extract({ left: 95, top: 12, width: 716, height: 994 })
    .toBuffer({ resolveWithObject: true });

  // Resize to height 375
  const img1ResizedBuf = await sharp(img1CroppedBuf.data, {
    raw: { width: img1CroppedBuf.info.width, height: img1CroppedBuf.info.height, channels: 4 }
  })
    .resize({ height: 375, fit: 'contain' })
    .toBuffer({ resolveWithObject: true });

  const rw1 = img1ResizedBuf.info.width;
  const rh1 = img1ResizedBuf.info.height;
  console.log(`  -> Resized Image 1: ${rw1}x${rh1} px`);

  // Place on canonical CANON_W x CANON_H with feet at FOOT_Y, center at CENTER_X
  const idleFrameBuf = Buffer.alloc(CANON_W * CANON_H * 4, 0);
  const idleDestX = CENTER_X - Math.round(rw1 / 2);
  const idleDestY = FOOT_Y - rh1;

  for (let sy = 0; sy < rh1; sy++) {
    const dy = idleDestY + sy;
    if (dy < 0 || dy >= CANON_H) continue;
    for (let sx = 0; sx < rw1; sx++) {
      const dx = idleDestX + sx;
      if (dx < 0 || dx >= CANON_W) continue;
      const sIdx = (sy * rw1 + sx) * 4;
      const dIdx = (dy * CANON_W + dx) * 4;
      idleFrameBuf[dIdx] = img1ResizedBuf.data[sIdx];
      idleFrameBuf[dIdx + 1] = img1ResizedBuf.data[sIdx + 1];
      idleFrameBuf[dIdx + 2] = img1ResizedBuf.data[sIdx + 2];
      idleFrameBuf[dIdx + 3] = img1ResizedBuf.data[sIdx + 3];
    }
  }

  deployedFrames['dino_home_idle'] = idleFrameBuf;
  await sharp(idleFrameBuf, { raw: { width: CANON_W, height: CANON_H, channels: 4 } })
    .png().toFile(path.join(testDir, 'dino_home_idle.png'));
  console.log('  -> Generated dino_home_idle.png (Flawless Master Artwork)');

  // -------------------------------------------------------------
  // 2. DYNAMIC SCLERA BASE (Clean Eye Whites for Cursor Tracking)
  // -------------------------------------------------------------
  console.log('\n2. Generating Sclera Base for Natural Pupil Tracking...');
  const scleraFrameBuf = Buffer.from(idleFrameBuf);

  // In CANON_W x CANON_H:
  // Clean both eye sockets of the original black pupil and iris glow
  // STRICT RULE: y must be <= 124 (STRICTLY ABOVE THE SNOUT!)
  // Preserves 100% untouched snout, nose, nostrils, mouth, chin, belly, claws, tail.
  for (let y = 72; y <= 124; y++) {
    for (let x = 100; x <= 218; x++) {
      const idx = (y * CANON_W + x) * 4;
      const r = idleFrameBuf[idx];
      const g = idleFrameBuf[idx + 1];
      const b = idleFrameBuf[idx + 2];

      // Left eye pupil area: x in [100, 135], y in [73, 124]
      if (x >= 100 && x <= 135 && y >= 73 && y <= 124) {
        const isSnoutSkin = (r > 120 && g > 180);
        const isEyebrow = (y < 73);
        if (!isSnoutSkin && !isEyebrow) {
          scleraFrameBuf[idx] = 250;
          scleraFrameBuf[idx + 1] = 252;
          scleraFrameBuf[idx + 2] = 252;
          scleraFrameBuf[idx + 3] = 255;
        }
      }

      // Right eye pupil area: x in [180, 215], y in [75, 124]
      if (x >= 180 && x <= 215 && y >= 75 && y <= 124) {
        const isSnoutSkin = (r > 120 && g > 180);
        const isEyebrow = (y < 74);
        if (!isSnoutSkin && !isEyebrow) {
          scleraFrameBuf[idx] = 250;
          scleraFrameBuf[idx + 1] = 252;
          scleraFrameBuf[idx + 2] = 252;
          scleraFrameBuf[idx + 3] = 255;
        }
      }
    }
  }

  deployedFrames['dino_home_sclera'] = scleraFrameBuf;
  await sharp(scleraFrameBuf, { raw: { width: CANON_W, height: CANON_H, channels: 4 } })
    .png().toFile(path.join(testDir, 'dino_home_sclera.png'));
  console.log('  -> Generated dino_home_sclera.png (Clean White Sclera)');

  // -------------------------------------------------------------
  // 3. TONGUE-OUT ANIMATION SEQUENCE (From Image 2: media_1792084951250.jpg)
  // -------------------------------------------------------------
  console.log('\n3. Processing Image 2 for Tongue-Out Click Reaction Sequence...');
  const img2Path = path.join(userUploadedDir, 'media_1792084951250.jpg');
  const img2Raw = await sharp(img2Path).raw().toBuffer({ resolveWithObject: true });
  const w2 = img2Raw.info.width, h2 = img2Raw.info.height;
  const { outBuf: img2Rgba } = floodFillAlpha(img2Raw.data, w2, h2, img2Raw.info.channels);

  const tonguePoses = [
    { id: '01', name: 'dino_home_tongue_01', minX: 268, maxX: 512, desc: 'Wink + Tongue Start' },
    { id: '02', name: 'dino_home_tongue_02', minX: 524, maxX: 767, desc: 'Happy Closed Eyes + Big Tongue Out' },
    { id: '03', name: 'dino_home_tongue_03', minX: 780, maxX: 1022, desc: 'Playful Tongue Hold / Side Glance' }
  ];

  for (const p of tonguePoses) {
    let sMinX = w2, sMaxX = 0, sMinY = h2, sMaxY = 0;
    for (let y = 140; y < 560; y++) {
      for (let x = p.minX; x <= p.maxX; x++) {
        const idx = (y * w2 + x) * 4;
        if (img2Rgba[idx + 3] > 30) {
          if (x < sMinX) sMinX = x; if (x > sMaxX) sMaxX = x;
          if (y < sMinY) sMinY = y; if (y > sMaxY) sMaxY = y;
        }
      }
    }

    const sw = sMaxX - sMinX + 1;
    const sh = sMaxY - sMinY + 1;

    // Place on canonical CANON_W x CANON_H with feet at FOOT_Y, center at CENTER_X
    const frameBuf = Buffer.alloc(CANON_W * CANON_H * 4, 0);
    const destX = CENTER_X - Math.round(sw / 2);
    const destY = FOOT_Y - sh;

    for (let sy = 0; sy < sh; sy++) {
      const dy = destY + sy;
      if (dy < 0 || dy >= CANON_H) continue;
      for (let sx = 0; sx < sw; sx++) {
        const dx = destX + sx;
        if (dx < 0 || dx >= CANON_W) continue;
        const sIdx = ((sMinY + sy) * w2 + (sMinX + sx)) * 4;
        const dIdx = (dy * CANON_W + dx) * 4;
        frameBuf[dIdx] = img2Rgba[sIdx];
        frameBuf[dIdx + 1] = img2Rgba[sIdx + 1];
        frameBuf[dIdx + 2] = img2Rgba[sIdx + 2];
        frameBuf[dIdx + 3] = img2Rgba[sIdx + 3];
      }
    }

    deployedFrames[p.name] = frameBuf;
    await sharp(frameBuf, { raw: { width: CANON_W, height: CANON_H, channels: 4 } })
      .png().toFile(path.join(testDir, `${p.name}.png`));
    console.log(`  -> Generated ${p.name}.png (${p.desc})`);
  }

  // -------------------------------------------------------------
  // 4. NATURAL BLINK FRAME (Closed Smiling Eyelids)
  // -------------------------------------------------------------
  console.log('\n4. Generating Natural Blink Frame...');
  const happyBuf = deployedFrames['dino_home_tongue_02']; // Happy pose has closed smiling eyelid curves
  const blinkFrameBuf = Buffer.from(idleFrameBuf);

  // Map closed smiling eyes from happyBuf (y: 115..175, x: 75..205)
  for (let y = 115; y < 178; y++) {
    for (let x = 75; x < 205; x++) {
      const idx = (y * CANON_W + x) * 4;
      if (happyBuf[idx + 3] > 50) {
        blinkFrameBuf[idx] = happyBuf[idx];
        blinkFrameBuf[idx + 1] = happyBuf[idx + 1];
        blinkFrameBuf[idx + 2] = happyBuf[idx + 2];
        blinkFrameBuf[idx + 3] = happyBuf[idx + 3];
      }
    }
  }

  deployedFrames['dino_home_blink'] = blinkFrameBuf;
  await sharp(blinkFrameBuf, { raw: { width: CANON_W, height: CANON_H, channels: 4 } })
    .png().toFile(path.join(testDir, 'dino_home_blink.png'));
  console.log('  -> Generated dino_home_blink.png (Closed Smiling Eyelids)');

  // -------------------------------------------------------------
  // 5. CUTE HOVER REACTION (From Image 3: R2C5 with Hearts & Blushing Cheeks)
  // -------------------------------------------------------------
  console.log('\n5. Processing Image 3 for Cute Hover Blushing Reaction...');
  const img3Path = path.join(userUploadedDir, 'media_1792084964594.jpg');
  const img3Raw = await sharp(img3Path).raw().toBuffer({ resolveWithObject: true });
  const w3 = img3Raw.info.width, h3 = img3Raw.info.height;
  const { outBuf: img3Rgba } = floodFillAlpha(img3Raw.data, w3, h3, img3Raw.info.channels);

  // R2C5 bounds: x: 693..837, y: 250..451
  let hMinX = w3, hMaxX = 0, hMinY = h3, hMaxY = 0;
  for (let y = 245; y <= 453; y++) {
    for (let x = 690; x <= 845; x++) {
      const idx = (y * w3 + x) * 4;
      if (img3Rgba[idx + 3] > 30) {
        if (x < hMinX) hMinX = x; if (x > hMaxX) hMaxX = x;
        if (y < hMinY) hMinY = y; if (y > hMaxY) hMaxY = y;
      }
    }
  }

  const hw = hMaxX - hMinX + 1;
  const hh = hMaxY - hMinY + 1;


  const hoverCropped = await sharp(img3Rgba, { raw: { width: w3, height: h3, channels: 4 } })
    .extract({ left: hMinX, top: hMinY, width: hw, height: hh })
    .resize({ height: 375, fit: 'contain' })
    .toBuffer({ resolveWithObject: true });

  const hoverFrameBuf = Buffer.alloc(CANON_W * CANON_H * 4, 0);
  const hoverDestX = CENTER_X - Math.round(hoverCropped.info.width / 2);
  const hoverDestY = FOOT_Y - hoverCropped.info.height;

  for (let sy = 0; sy < hoverCropped.info.height; sy++) {
    const dy = hoverDestY + sy;
    if (dy < 0 || dy >= CANON_H) continue;
    for (let sx = 0; sx < hoverCropped.info.width; sx++) {
      const dx = hoverDestX + sx;
      if (dx < 0 || dx >= CANON_W) continue;
      const sIdx = (sy * hoverCropped.info.width + sx) * 4;
      const dIdx = (dy * CANON_W + dx) * 4;
      hoverFrameBuf[dIdx] = hoverCropped.data[sIdx];
      hoverFrameBuf[dIdx + 1] = hoverCropped.data[sIdx + 1];
      hoverFrameBuf[dIdx + 2] = hoverCropped.data[sIdx + 2];
      hoverFrameBuf[dIdx + 3] = hoverCropped.data[sIdx + 3];
    }
  }

  deployedFrames['dino_home_hover'] = hoverFrameBuf;
  await sharp(hoverFrameBuf, { raw: { width: CANON_W, height: CANON_H, channels: 4 } })
    .png().toFile(path.join(testDir, 'dino_home_hover.png'));
  console.log('  -> Generated dino_home_hover.png (Blissful Hearts & Blushing Reaction)');

  // -------------------------------------------------------------
  // 6. DEPLOY TO assets/sprites/ AND UPDATE sprite_data.js
  // -------------------------------------------------------------
  console.log('\n6. Deploying All Frames to assets/sprites/...');
  for (const [name, buf] of Object.entries(deployedFrames)) {
    const targetPng = path.join(outputDir, `${name}.png`);
    await sharp(buf, { raw: { width: CANON_W, height: CANON_H, channels: 4 } })
      .png().toFile(targetPng);
    console.log(`  -> Deployed ${name}.png`);
  }

  // Also build contact sheet for inspection
  console.log('\n7. Generating Inspection Contact Sheet (7 frames)...');
  const contactW = CANON_W * 7;
  const contactH = CANON_H;
  const contactBuf = Buffer.alloc(contactW * contactH * 4, 0);

  const frameOrder = [
    'dino_home_idle',
    'dino_home_sclera',
    'dino_home_blink',
    'dino_home_hover',
    'dino_home_tongue_01',
    'dino_home_tongue_02',
    'dino_home_tongue_03'
  ];

  for (let i = 0; i < frameOrder.length; i++) {
    const fn = frameOrder[i];
    const fb = deployedFrames[fn];
    const offX = i * CANON_W;

    for (let y = 0; y < CANON_H; y++) {
      for (let x = 0; x < CANON_W; x++) {
        const sIdx = (y * CANON_W + x) * 4;
        const dIdx = (y * contactW + (offX + x)) * 4;
        contactBuf[dIdx] = fb[sIdx];
        contactBuf[dIdx + 1] = fb[sIdx + 1];
        contactBuf[dIdx + 2] = fb[sIdx + 2];
        contactBuf[dIdx + 3] = fb[sIdx + 3];
      }
    }
  }

  const contactPath = path.join(testDir, 'contact_sheet_home_dino.png');
  await sharp(contactBuf, { raw: { width: contactW, height: contactH, channels: 4 } })
    .png().toFile(contactPath);
  console.log(`  -> Saved contact sheet: ${contactPath}`);

  console.log('\n=== HOMEPAGE DINOSAUR FRAME EXTRACTION COMPLETED! ===');
}

run().catch(err => {
  console.error('Extraction error:', err);
  process.exit(1);
});
