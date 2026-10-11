const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function buildCanonicalDucks() {
  console.log('=== BUILDING PERFECT CANONICAL DUCK FRAMES (128x112, BASELINE y=103) ===');

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
    return (r < 80 && g < 90 && b < 75 && (r > 15 || g > 15 || b > 15));
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

  function segmentDino({ minX, maxX, minY, maxY, groundY, idx }) {
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    function isFg(x, y) {
      if (x < minX || x > maxX || y < minY || y > maxY) return false;
      if (groundY && y > groundY) return false;
      // Tail overlap filters between adjacent panels
      if (idx === 1 && x > 716 && y > 444) return false;
      if (idx === 2 && x > 818 && y > 446) return false;
      if (idx === 3 && x > 922 && y > 446) return false;
      if (idx === 4 && y > 476) return false;

      if (isGreen(x, y) || isSpine(x, y) || isTongue(x, y) || isBelly(x, y, groundY) || isClaw(x, y, groundY) || isEyeWhite(x, y, minY, cropH) || isEyePupilOrOutline(x, y, minY, cropH)) return true;
      return false;
    }

    const labels = new Int32Array(cropW * cropH).fill(-1);
    const sizes = [];
    let curL = 0;
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idxCoord = y * cropW + x;
        if (labels[idxCoord] === -1 && isFg(minX + x, minY + y)) {
          let sz = 0;
          const q = [idxCoord];
          labels[idxCoord] = curL;
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
        const iIdx = y * cropW + x;
        const oIdx = iIdx * 4;
        if (fgMask[iIdx] === 1) {
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

  // Canonical vector open master eye
  const svgOpen = `
  <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(128, 128) rotate(-4) translate(-128, -128)">
      <ellipse cx="128" cy="128" rx="80" ry="102" fill="#ffffff" stroke="#162412" stroke-width="18" />
      <ellipse cx="146" cy="136" rx="46" ry="62" fill="#111827" />
      <circle cx="160" cy="115" r="17" fill="#ffffff" />
      <circle cx="132" cy="154" r="7" fill="#ffffff" opacity="0.65" />
    </g>
  </svg>`;
  const eyeOpenBuf = await sharp(Buffer.from(svgOpen)).resize(24, 24, { kernel: 'lanczos3' }).png().toBuffer();

  const duckBoxes = [
    { name: 'dino_duck_0', minX: 518, maxX: 625, minY: 388, maxY: 476, groundY: 476, canvasLeft: 8, eye: 'OPEN', eyeLeft: 62, eyeTop: 24, idx: 0 },
    { name: 'dino_duck_1', minX: 622, maxX: 728, minY: 416, maxY: 476, groundY: 476, canvasLeft: 8, eye: 'CLOSED', idx: 1 },
    { name: 'dino_duck_2', minX: 715, maxX: 830, minY: 422, maxY: 476, groundY: 475, canvasLeft: 6, eye: 'CLOSED', idx: 2 },
    { name: 'dino_duck_3', minX: 818, maxX: 930, minY: 428, maxY: 476, groundY: 475, canvasLeft: 6, eye: 'CLOSED', idx: 3 },
    { name: 'dino_duck_4', minX: 924, maxX: 1016, minY: 394, maxY: 478, groundY: 478, canvasLeft: 14, eye: 'OPEN', eyeLeft: 65, eyeTop: 31, idx: 4 }
  ];

  const canvasW = 128, canvasH = 112;

  for (let i = 0; i < duckBoxes.length; i++) {
    const cfg = duckBoxes[i];
    const seg = segmentDino(cfg);

    const canvasBuf = Buffer.alloc(canvasW * canvasH * 4, 0);
    const top = 103 - (cfg.groundY - cfg.minY);

    for (let y = 0; y < seg.height; y++) {
      const cy = top + y;
      if (cy < 0 || cy >= canvasH) continue;
      for (let x = 0; x < seg.width; x++) {
        const cx = cfg.canvasLeft + x;
        if (cx < 0 || cx >= canvasW) continue;
        const sIdx = (y * seg.width + x) * 4;
        if (seg.buf[sIdx + 3] === 0) continue;
        const dIdx = (cy * canvasW + cx) * 4;
        canvasBuf[dIdx] = seg.buf[sIdx];
        canvasBuf[dIdx + 1] = seg.buf[sIdx + 1];
        canvasBuf[dIdx + 2] = seg.buf[sIdx + 2];
        canvasBuf[dIdx + 3] = 255;
      }
    }

    // Clean perimeter sky/cloud/halo fringes
    const maxSnoutX = [117, 116, 122, 120, 107][i];
    for (let y = 0; y < canvasH; y++) {
      for (let x = 0; x < canvasW; x++) {
        const idx = (y * canvasW + x) * 4;
        if (canvasBuf[idx + 3] === 0) continue;

        // Strip any stray pixels beyond dinosaur snout or below ground baseline
        if (x > maxSnoutX || y > 103) {
          canvasBuf[idx + 3] = 0;
          continue;
        }

        // Strip previous panel snout overlap on left of duck_2 and duck_3
        if (i === 2 && x < 9 && y >= 64 && y <= 82) {
          canvasBuf[idx + 3] = 0;
          continue;
        }
        if ((i === 2 || i === 3) && x < 7 && y < 75) {
          canvasBuf[idx + 3] = 0;
          continue;
        }

        // Strip sand clump in front of duck_4
        if (i === 4 && x > 94 && y > 85) {
          canvasBuf[idx + 3] = 0;
          continue;
        }

        const r = canvasBuf[idx], g = canvasBuf[idx + 1], b = canvasBuf[idx + 2];

        // Check if touches transparent
        let isPerimeter = false;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= canvasW || ny < 0 || ny >= canvasH || canvasBuf[(ny * canvasW + nx) * 4 + 3] === 0) {
            isPerimeter = true; break;
          }
        }
        if (isPerimeter) {
          if (b > 120 && b > r - 20) { canvasBuf[idx + 3] = 0; continue; }
          if (r > 185 && g > 180 && b > 135) { canvasBuf[idx + 3] = 0; continue; }
          if (r > 130 && g > 140 && b > 110) { canvasBuf[idx + 3] = 0; continue; }
        }
      }
    }

    let pipeline = sharp(canvasBuf, { raw: { width: canvasW, height: canvasH, channels: 4 } });
    if (cfg.eye === 'OPEN') {
      pipeline = pipeline.composite([{ input: eyeOpenBuf, left: cfg.eyeLeft, top: cfg.eyeTop }]);
    }

    const outBuf = await pipeline.png().toBuffer();
    const destPath = path.join('assets', 'sprites', `${cfg.name}.png`);
    fs.writeFileSync(destPath, outBuf);
    console.log(`✓ Saved ${destPath} on canonical 128x112 canvas (baseline y=103, eye: ${cfg.eye})`);
  }

  // Create verification montage with dino_run_0
  const frames = [
    'assets/sprites/dino_run_0.png',
    'assets/sprites/dino_duck_0.png',
    'assets/sprites/dino_duck_1.png',
    'assets/sprites/dino_duck_2.png',
    'assets/sprites/dino_duck_3.png',
    'assets/sprites/dino_duck_4.png'
  ];

  const montageW = canvasW * 6;
  const montageH = canvasH;
  const compositeList = frames.map((f, idx) => ({
    input: f,
    left: idx * canvasW,
    top: 0
  }));

  const bg = Buffer.alloc(montageW * montageH * 4);
  for (let y = 0; y < montageH; y++) {
    for (let x = 0; x < montageW; x++) {
      const idx = (y * montageW + x) * 4;
      if (y === 103) {
        bg[idx] = 255; bg[idx + 1] = 0; bg[idx + 2] = 0; bg[idx + 3] = 255;
      } else if (y > 103) {
        bg[idx] = 245; bg[idx + 1] = 160; bg[idx + 2] = 30; bg[idx + 3] = 255;
      } else {
        bg[idx] = 77; bg[idx + 1] = 166; bg[idx + 2] = 255; bg[idx + 3] = 255;
      }
    }
  }

  await sharp(bg, { raw: { width: montageW, height: montageH, channels: 4 } })
    .composite(compositeList)
    .png()
    .toFile('verify_canonical_ducks_montage.png');
  console.log('Saved verify_canonical_ducks_montage.png');
}

buildCanonicalDucks().catch(console.error);
