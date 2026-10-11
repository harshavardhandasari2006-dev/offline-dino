const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('=== STANDARDIZING ALL DINOSAUR SPRITES & EYES ===\n');

  // 1. Generate Canonical Vector Master Eyes (Open and Closed)
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

  const eyeOpenBuf = await sharp(Buffer.from(svgOpen))
    .resize(24, 24, { kernel: 'lanczos3' })
    .png().toBuffer();

  const eyeClosedBuf = await sharp(Buffer.from(svgClosed))
    .resize(24, 24, { kernel: 'lanczos3' })
    .png().toBuffer();

  fs.writeFileSync('canonical_master_eye_v4_open.png', eyeOpenBuf);
  fs.writeFileSync('canonical_master_eye_v4_closed.png', eyeClosedBuf);
  console.log('1. Generated canonical master eyes (open and closed).');

  // Load Reference Sheet
  const { data: refData, info: refInfo } = await sharp('assets/style1_reference.jpg').raw().toBuffer({ resolveWithObject: true });
  const W = refInfo.width, H = refInfo.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [refData[idx], refData[idx + 1], refData[idx + 2]];
  }
  function isGreen(x, y) {
    const [r, g, b] = getPixel(x, y);
    return (g > r + 8 && g > b + 8 && g > 40) || (g > 85 && g > r && g > b + 15);
  }
  function isSpine(x, y) {
    const [r, g, b] = getPixel(x, y);
    return (r < 75 && g < 85 && b < 75 && (r > 10 || g > 10 || b > 10));
  }
  function isTongue(x, y) {
    const [r, g, b] = getPixel(x, y);
    return (r > 135 && g < 115 && b < 125 && r > g + 20) || (r > 90 && r < 145 && g < 55 && b < 65);
  }
  function isBelly(x, y, groundY) {
    if (groundY && y > groundY - 6) return false;
    const [r, g, b] = getPixel(x, y);
    return (r > 175 && g > 160 && (g - b >= 30) && r > b + 25);
  }
  function isEyeWhite(x, y, topY, maxH) {
    const [r, g, b] = getPixel(x, y);
    return (r > 215 && g > 215 && b > 210 && y < topY + maxH * 0.6);
  }
  function isEyePupilOrOutline(x, y, topY, maxH) {
    const [r, g, b] = getPixel(x, y);
    return (r < 60 && g < 60 && b < 60 && y < topY + maxH * 0.55 && y > topY + 10);
  }
  function isClaw(x, y, groundY) {
    if (groundY && y > groundY) return false;
    const [r, g, b] = getPixel(x, y);
    if (!(r > 200 && g > 185 && b > 140 && g - b > 20)) return false;
    for (let dy = -2; dy <= 1; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (isGreen(x + dx, y + dy)) return true;
      }
    }
    return false;
  }
  function isDeadStar(x, y) {
    const [r, g, b] = getPixel(x, y);
    return (r > 190 && g > 160 && b < 110) || (r < 80 && g < 80 && b < 80);
  }

  function segmentDino({ minX, maxX, minY, maxY, groundY, isDead = false }) {
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    function isFg(x, y) {
      if (x < minX || x > maxX || y < minY || y > maxY) return false;
      if (groundY && y > groundY) return false;
      if (isGreen(x, y) || isSpine(x, y) || isTongue(x, y) || isBelly(x, y, groundY) || isClaw(x, y, groundY) || isEyeWhite(x, y, minY, cropH) || isEyePupilOrOutline(x, y, minY, cropH)) return true;
      if (isDead && isDeadStar(x, y)) return true;
      return false;
    }

    const labels = new Int32Array(cropW * cropH).fill(-1);
    const sizes = [];
    let curL = 0;
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        if (labels[idx] === -1 && isFg(minX + x, minY + y)) {
          let sz = 0;
          const q = [idx];
          labels[idx] = curL;
          let head = 0;
          while (head < q.length) {
            const cur = q[head++];
            sz++;
            const cx = cur % cropW, cy = Math.floor(cur / cropW);
            for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
              if (nx >= 0 && nx < cropW && ny >= 0 && ny < cropH) {
                const ni = ny * cropW + nx;
                if (labels[ni] === -1 && isFg(minX + nx, minY + ny)) {
                  labels[ni] = curL;
                  q.push(ni);
                }
              }
            }
          }
          sizes.push(sz);
          curL++;
        }
      }
    }

    let maxSz = 0, maxL = -1;
    for (let i = 0; i < sizes.length; i++) {
      if (sizes[i] > maxSz) { maxSz = sizes[i]; maxL = i; }
    }

    const fgMask = new Uint8Array(cropW * cropH);
    for (let i = 0; i < cropW * cropH; i++) {
      if (labels[i] === maxL) fgMask[i] = 1;
    }

    const outBuf = Buffer.alloc(cropW * cropH * 4);
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        const oIdx = idx * 4;
        if (fgMask[idx] === 1) {
          const absX = minX + x, absY = minY + y;
          const [r, g, b] = getPixel(absX, absY);
          outBuf[oIdx] = r;
          outBuf[oIdx + 1] = g;
          outBuf[oIdx + 2] = b;
          outBuf[oIdx + 3] = 255;
        }
      }
    }
    return { buf: outBuf, width: cropW, height: cropH };
  }

  function cleanSkyAndGround(buf, w, h, maxGroundY = null) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        if (buf[idx + 3] === 0) continue;
        const r = buf[idx], g = buf[idx + 1], b = buf[idx + 2];
        // Blue sky/cloud background remnant
        if (b > 200 && b > r + 8 && b > g + 8) {
          buf[idx + 3] = 0;
        }
        // Sand floor remnant
        if (maxGroundY && y > maxGroundY && r > 200 && g > 170 && b < 170) {
          buf[idx + 3] = 0;
        }
      }
    }
  }

  const spritesDir = path.join(__dirname, 'assets', 'sprites');

  // =========================================================================
  // 2. RUN FRAMES (110x97) — MASTER CHARACTER MODEL GRAFTING
  // =========================================================================
  console.log('2. Building Running Frames with Master Head & Canonical Eye...');
  const runCenters = [543, 648, 752, 860, 968];
  
  // Segment base run frame 0
  const rawRun0 = segmentDino({ minX: runCenters[0] - 55, maxX: runCenters[0] + 54, minY: 199, maxY: 295, groundY: 294 });
  const runW = rawRun0.width, runH = rawRun0.height;
  const baseRun0Buf = Buffer.from(rawRun0.buf);
  cleanSkyAndGround(baseRun0Buf, runW, runH, 92);

  // Composite canonical master eye onto base frame 0 at exact aligned position (left: 61, top: 14)
  const masterRun0WithEye = await sharp(baseRun0Buf, { raw: { width: runW, height: runH, channels: 4 } })
    .composite([{ input: eyeOpenBuf, left: 61, top: 14 }])
    .png().toBuffer();
  
  // Save dino_run_0.png
  fs.writeFileSync(path.join(spritesDir, 'dino_run_0.png'), masterRun0WithEye);
  console.log('  -> Saved dino_run_0.png');

  // Extract Master Head from frame 0
  const masterHeadData = await sharp(masterRun0WithEye)
    .extract({ left: 45, top: 4, width: 62, height: 48 })
    .raw().toBuffer({ resolveWithObject: true });
  
  const headW = masterHeadData.info.width, headH = masterHeadData.info.height;
  const featheredHeadBuf = Buffer.from(masterHeadData.data);
  for (let y = 0; y < headH; y++) {
    for (let x = 0; x < headW; x++) {
      const idx = (y * headW + x) * 4;
      if (featheredHeadBuf[idx + 3] === 0) continue;
      let alphaMult = 1.0;
      if (y >= 38) {
        alphaMult *= (headH - 1 - y) / (headH - 1 - 38);
      }
      if (x < 8 && y > 24) {
        alphaMult *= (x / 8);
      }
      featheredHeadBuf[idx + 3] = Math.round(featheredHeadBuf[idx + 3] * Math.max(0, Math.min(1, alphaMult)));
    }
  }

  // Graft master head onto frames 1 to 4
  for (let i = 1; i < 5; i++) {
    const raw = segmentDino({ minX: runCenters[i] - 55, maxX: runCenters[i] + 54, minY: 199, maxY: 295, groundY: 294 });
    const buf = Buffer.from(raw.buf);
    cleanSkyAndGround(buf, runW, runH, 92);

    // Clear ONLY inner head area (leaving neck and back contour intact so seam is 100% invisible)
    for (let y = 6; y < 40; y++) {
      for (let x = 50; x < runW - 2; x++) {
        buf[(y * runW + x) * 4 + 3] = 0;
      }
    }

    const res = await sharp(buf, { raw: { width: runW, height: runH, channels: 4 } })
      .composite([{
        input: featheredHeadBuf,
        raw: { width: headW, height: headH, channels: 4 },
        left: 45,
        top: 4
      }])
      .png().toBuffer();
    
    fs.writeFileSync(path.join(spritesDir, `dino_run_${i}.png`), res);
    console.log(`  -> Saved dino_run_${i}.png`);
  }

  // =========================================================================
  // 3. JUMP FRAMES (120x100) — PRE-TRIM CANONICAL MASTER EYE COMPOSITING
  // =========================================================================
  console.log('3. Building Jump Frames with Canonical Master Eye...');
  const jumpConfigs = [
    { name: 'dino_jump_0', box: { minX: 20, maxX: 100, minY: 405, maxY: 483, groundY: 476 }, eyeLeft: 48, eyeTop: 6 },
    { name: 'dino_jump_1', box: { minX: 123, maxX: 200, minY: 375, maxY: 462, groundY: 461 }, eyeLeft: 48, eyeTop: 8 },
    { name: 'dino_jump_2', box: { minX: 228, maxX: 304, minY: 360, maxY: 444, groundY: null }, eyeLeft: 49, eyeTop: 8 },
    { name: 'dino_jump_3', box: { minX: 320, maxX: 403, minY: 394, maxY: 468, groundY: 467 }, eyeLeft: 51, eyeTop: 8 },
    { name: 'dino_jump_4', box: { minX: 416, maxX: 501, minY: 412, maxY: 483, groundY: 476 }, eyeLeft: 51, eyeTop: 6 }
  ];

  for (const cfg of jumpConfigs) {
    const raw = segmentDino(cfg.box);
    cleanSkyAndGround(raw.buf, raw.width, raw.height, raw.height - 4);

    // Composite master eye BEFORE trimming for mathematically exact alignment
    const res = await sharp(raw.buf, { raw: { width: raw.width, height: raw.height, channels: 4 } })
      .composite([{ input: eyeOpenBuf, left: cfg.eyeLeft, top: cfg.eyeTop }])
      .trim()
      .extend({ top: 10, bottom: 10, left: 10, right: 10, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    
    fs.writeFileSync(path.join(spritesDir, `${cfg.name}.png`), res);
    console.log(`  -> Saved ${cfg.name}.png`);
  }

  // =========================================================================
  // 4. DUCK FRAMES — NATURAL CLOSED EYES DURING DUCK & CANONICAL MASTER EYE
  // =========================================================================
  console.log('4. Building Duck Frames (Closed eyes during duck, canonical eye on stand)...');
  const duckBoxes = [
    { name: 'dino_duck_0', minX: 526, maxX: 614, minY: 388, maxY: 476, groundY: 474, eye: 'OPEN', left: 49, top: 4 },
    { name: 'dino_duck_1', minX: 630, maxX: 719, minY: 416, maxY: 476, groundY: 474, eye: 'CLOSED' },
    { name: 'dino_duck_2', minX: 732, maxX: 818, minY: 422, maxY: 476, groundY: 474, eye: 'CLOSED' },
    { name: 'dino_duck_3', minX: 834, maxX: 916, minY: 428, maxY: 475, groundY: 473, eye: 'CLOSED' },
    { name: 'dino_duck_4', minX: 932, maxX: 1016, minY: 394, maxY: 476, groundY: 474, eye: 'OPEN', left: 50, top: 4 }
  ];

  for (const cfg of duckBoxes) {
    const raw = segmentDino(cfg);
    const trimmed = await sharp(raw.buf, { raw: { width: raw.width, height: raw.height, channels: 4 } })
      .trim()
      .raw().toBuffer({ resolveWithObject: true });
    
    const buf = Buffer.from(trimmed.data);
    cleanSkyAndGround(buf, trimmed.info.width, trimmed.info.height, trimmed.info.height - 4);

    let pipeline = sharp(buf, { raw: { width: trimmed.info.width, height: trimmed.info.height, channels: 4 } });
    if (cfg.eye === 'OPEN') {
      pipeline = pipeline.composite([{ input: eyeOpenBuf, left: cfg.left, top: cfg.top }]);
    }
    const res = await pipeline.png().toBuffer();
    fs.writeFileSync(path.join(spritesDir, `${cfg.name}.png`), res);
    console.log(`  -> Saved ${cfg.name}.png (${cfg.eye})`);
  }

  // =========================================================================
  // 5. IDLE FRAMES (112x107) — CANONICAL MASTER EYE & CONTROLLED BLINK
  // =========================================================================
  console.log('5. Building Idle Frames (Canonical eye and controlled blink)...');
  const idleBoxes = [
    { name: 'dino_idle_0', cx: 72, eye: 'OPEN', left: 55, top: 6 },
    { name: 'dino_idle_1', cx: 186, eye: 'CLOSED' },
    { name: 'dino_idle_2', cx: 291, eye: 'CLOSED' },
    { name: 'dino_idle_3', cx: 408, eye: 'OPEN', left: 51, top: 8 }
  ];

  for (const cfg of idleBoxes) {
    const raw = segmentDino({ minX: cfg.cx - 56, maxX: cfg.cx + 55, minY: 195, maxY: 301, groundY: 300 });
    const buf = Buffer.from(raw.buf);
    cleanSkyAndGround(buf, raw.width, raw.height, 98);

    let pipeline = sharp(buf, { raw: { width: raw.width, height: raw.height, channels: 4 } });
    if (cfg.eye === 'OPEN') {
      pipeline = pipeline.composite([{ input: eyeOpenBuf, left: cfg.left, top: cfg.top }]);
    }
    const res = await pipeline.png().toBuffer();
    fs.writeFileSync(path.join(spritesDir, `${cfg.name}.png`), res);
    console.log(`  -> Saved ${cfg.name}.png (${cfg.eye})`);
  }

  // =========================================================================
  // 6. COLLISION & DEAD FRAMES
  // =========================================================================
  console.log('6. Building Collision & Dead Frames...');
  const hitRaw = segmentDino({ minX: 112, maxX: 198, minY: 556, maxY: 654, groundY: 650 });
  const hitTrimmed = await sharp(hitRaw.buf, { raw: { width: hitRaw.width, height: hitRaw.height, channels: 4 } }).trim().raw().toBuffer({ resolveWithObject: true });
  const hitBuf = Buffer.from(hitTrimmed.data);
  cleanSkyAndGround(hitBuf, hitTrimmed.info.width, hitTrimmed.info.height, hitTrimmed.info.height - 4);
  fs.writeFileSync(path.join(spritesDir, 'dino_hit.png'), await sharp(hitBuf, { raw: { width: hitTrimmed.info.width, height: hitTrimmed.info.height, channels: 4 } }).png().toBuffer());
  console.log('  -> Saved dino_hit.png');

  const deadRaw = segmentDino({ minX: 265, maxX: 370, minY: 556, maxY: 654, groundY: 650, isDead: true });
  const deadTrimmed = await sharp(deadRaw.buf, { raw: { width: deadRaw.width, height: deadRaw.height, channels: 4 } }).trim().raw().toBuffer({ resolveWithObject: true });
  const deadBuf = Buffer.from(deadTrimmed.data);
  cleanSkyAndGround(deadBuf, deadTrimmed.info.width, deadTrimmed.info.height, deadTrimmed.info.height - 4);
  fs.writeFileSync(path.join(spritesDir, 'dino_dead.png'), await sharp(deadBuf, { raw: { width: deadTrimmed.info.width, height: deadTrimmed.info.height, channels: 4 } }).png().toBuffer());
  console.log('  -> Saved dino_dead.png');

  // =========================================================================
  // 7. SYNCHRONIZE js/sprite_data.js
  // =========================================================================
  console.log('\n7. Synchronizing js/sprite_data.js with all updated assets...');
  const spriteFiles = fs.readdirSync(spritesDir).filter(f => f.endsWith('.png'));
  const spriteDataMap = {};
  for (const file of spriteFiles) {
    const key = path.basename(file, '.png');
    const buf = fs.readFileSync(path.join(spritesDir, file));
    spriteDataMap[key] = `data:image/png;base64,${buf.toString('base64')}`;
  }

  const jsContent = `// Auto-generated master embedded sprite data URI map for offline play & instant cache
window.EMBEDDED_SPRITES = ${JSON.stringify(spriteDataMap, null, 2)};
`;
  fs.writeFileSync(path.join(__dirname, 'js', 'sprite_data.js'), jsContent, 'utf-8');
  console.log(`Synchronized js/sprite_data.js with ${spriteFiles.length} sprites!`);

  console.log('\n=== ALL SPRITES STANDARDIZED SUCCESSFULLY! ===');
}

main().catch(err => {
  console.error('Error during standardization:', err);
  process.exit(1);
});
