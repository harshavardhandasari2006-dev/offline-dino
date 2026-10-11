const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function extractAll() {
  const { data, info } = await sharp('assets/style1_reference.jpg').raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [data[idx], data[idx + 1], data[idx + 2]];
  }

  // Segment a character in a specific region
  function segmentCharacter({ minX, maxX, minY, maxY, groundY, isDead = false, isCactus = false, isPtero = false }) {
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    // Sobel gradient magnitude
    const edge = new Float32Array(cropW * cropH);
    for (let y = 1; y < cropH - 1; y++) {
      for (let x = 1; x < cropW - 1; x++) {
        let gx = 0, gy = 0;
        for (let c = 0; c < 3; c++) {
          const absX = minX + x, absY = minY + y;
          const p00 = getPixel(absX - 1, absY - 1)[c];
          const p02 = getPixel(absX + 1, absY - 1)[c];
          const p10 = getPixel(absX - 1, absY)[c];
          const p12 = getPixel(absX + 1, absY)[c];
          const p20 = getPixel(absX - 1, absY + 1)[c];
          const p22 = getPixel(absX + 1, absY + 1)[c];
          const p01 = getPixel(absX, absY - 1)[c];
          const p21 = getPixel(absX, absY + 1)[c];
          gx += (-p00 + p02 - 2 * p10 + 2 * p12 - p20 + p22);
          gy += (-p00 - 2 * p01 - p02 + p20 + 2 * p21 + p22);
        }
        edge[y * cropW + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    function isDefiniteFgCore(absX, absY) {
      if (groundY && absY > groundY) return false;
      const [r, g, b] = getPixel(absX, absY);

      if (isCactus) {
        // Green stem / arms
        if (g > r + 15 && g > b + 15 && g > 60) return true;
        // Orange flower on top
        if (r > 175 && g < 135 && b < 85) return true;
        // Dark outline
        if (r < 60 && g < 75 && b < 60 && (r > 5 || g > 5)) return true;
        return false;
      }

      if (isPtero) {
        // Brown/tan wings & body
        if (r > 90 && g > 55 && b < 80 && r > g + 15) return true;
        // Beak / head
        if (r > 160 && g > 110 && b < 80) return true;
        // Dark outline
        if (r < 70 && g < 70 && b < 70) return true;
        return false;
      }

      // Dinosaur:
      // Green body
      if (g > r + 8 && g > b + 8 && g > 40) return true;
      if (g > 85 && g > r && g > b + 15) return true;
      // Dark spine / outline
      if (r < 75 && g < 85 && b < 75 && (r > 10 || g > 10 || b > 10)) return true;
      // Tongue / mouth
      if (r > 135 && g < 115 && b < 125 && r > g + 20) return true;
      if (r > 90 && r < 145 && g < 55 && b < 65) return true;
      // Cream belly / lower jaw / throat:
      if (r > 175 && g > 160 && (g - b >= 30) && r > b + 25) return true;
      // White eye sclera
      if (r > 215 && g > 215 && b > 210 && absY < minY + cropH * 0.6) return true;

      // Claws near ground
      if (groundY && absY >= groundY - 6 && absY <= groundY && r > 190 && g > 180 && b > 140) {
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const [pr, pg, pb] = getPixel(absX + dx, absY + dy);
            if (pg > pr + 12 && pg > pb + 12) return true;
          }
        }
      }
      // Dead dino stars & spirals
      if (isDead) {
        if (r > 190 && g > 160 && b < 110) return true;
        if (r < 80 && g < 80 && b < 80 && absY < 640) return true;
      }

      return false;
    }

    const isBg = new Uint8Array(cropW * cropH);
    const q = [];

    // Seed 4 outer borders of crop box
    for (let x = 0; x < cropW; x++) {
      q.push([x, 0]); isBg[0 * cropW + x] = 1;
      q.push([x, cropH - 1]); isBg[(cropH - 1) * cropW + x] = 1;
    }
    for (let y = 0; y < cropH; y++) {
      q.push([0, y]); isBg[y * cropW + 0] = 1;
      q.push([cropW - 1, y]); isBg[y * cropW + (cropW - 1)] = 1;
    }

    // Seed below ground line
    if (groundY) {
      for (let y = 0; y < cropH; y++) {
        const absY = minY + y;
        if (absY >= groundY) {
          for (let x = 0; x < cropW; x++) {
            const absX = minX + x;
            if (!isDefiniteFgCore(absX, absY)) {
              const idx = y * cropW + x;
              if (isBg[idx] === 0) {
                isBg[idx] = 1;
                q.push([x, y]);
              }
            }
          }
        }
      }
    }

    // Seed obvious sky background (B is dominant and high)
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const absX = minX + x, absY = minY + y;
        const [r, g, b] = getPixel(absX, absY);
        // Sky
        if (b > 180 && b > r + 8 && b >= g) {
          if (isBg[y * cropW + x] === 0) { isBg[y * cropW + x] = 1; q.push([x, y]); }
        }
        // Cloud
        if (r > 220 && g > 220 && b > 235) {
          if (isBg[y * cropW + x] === 0) { isBg[y * cropW + x] = 1; q.push([x, y]); }
        }
      }
    }

    // BFS Flood fill
    let head = 0;
    while (head < q.length) {
      const [cx, cy] = q[head++];
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        if (nx < 0 || nx >= cropW || ny < 0 || ny >= cropH) continue;
        const nIdx = ny * cropW + nx;
        if (isBg[nIdx] !== 0) continue;

        const absX = minX + nx, absY = minY + ny;
        if (isDefiniteFgCore(absX, absY)) continue;

        const [r, g, b] = getPixel(absX, absY);
        // Outline barrier
        if (r < 75 && g < 85 && b < 75) continue;

        // Belly / jaw barrier
        if (!isCactus && !isPtero && edge[nIdx] > 380 && (r > 160 && g > 150 && b < 210 && Math.abs(r - g) < 40)) {
          continue;
        }

        isBg[nIdx] = 1;
        q.push([nx, ny]);
      }
    }

    // Connected components on candidate foreground
    const labels = new Int32Array(cropW * cropH).fill(-1);
    const sizes = [];
    let curL = 0;
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        if (isBg[idx] === 0 && labels[idx] === -1) {
          let sz = 0;
          const cq = [idx];
          labels[idx] = curL;
          let ch = 0;
          while (ch < cq.length) {
            const c = cq[ch++];
            sz++;
            const cx = c % cropW, cy = Math.floor(c / cropW);
            for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
              if (nx >= 0 && nx < cropW && ny >= 0 && ny < cropH) {
                const ni = ny * cropW + nx;
                if (isBg[ni] === 0 && labels[ni] === -1) {
                  labels[ni] = curL;
                  cq.push(ni);
                }
              }
            }
          }
          sizes.push(sz);
          curL++;
        }
      }
    }

    // Find largest component
    let maxL = -1, maxSz = 0;
    for (let i = 0; i < sizes.length; i++) {
      if (sizes[i] > maxSz) { maxSz = sizes[i]; maxL = i; }
    }

    const fgMask = new Uint8Array(cropW * cropH);
    for (let i = 0; i < cropW * cropH; i++) {
      if (labels[i] === maxL) {
        fgMask[i] = 1;
      } else if (isDead && labels[i] !== -1 && sizes[labels[i]] > 10) {
        // Keep dizzy stars and spirals above dead dino
        const py = Math.floor(i / cropW);
        if (py < cropH * 0.55) {
          fgMask[i] = 1;
        }
      }
    }

    // 1-pixel morphological cleanup to remove single isolated pixel noise and smooth edges
    const outBuf = Buffer.alloc(cropW * cropH * 4);
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        const oIdx = idx * 4;
        if (fgMask[idx] === 1) {
          const absX = minX + x, absY = minY + y;
          const [r, g, b] = getPixel(absX, absY);

          // Check boundary touching background for gentle antialiasing
          let bgCount = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const qx = x + dx, qy = y + dy;
              if (qx < 0 || qx >= cropW || qy < 0 || qy >= cropH || fgMask[qy * cropW + qx] === 0) {
                bgCount++;
              }
            }
          }

          outBuf[oIdx] = r;
          outBuf[oIdx + 1] = g;
          outBuf[oIdx + 2] = b;
          outBuf[oIdx + 3] = bgCount > 0 ? Math.max(160, 255 - bgCount * 14) : 255;
        }
      }
    }

    return { buf: outBuf, width: cropW, height: cropH };
  }

  // Create output directory
  const outDir = path.join(__dirname, 'assets', 'sprites_perfect');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log('--- EXTRACTING RUN FRAMES ---');
  const runDefs = [
    { name: 'dino_run_0', minX: 492, maxX: 593, minY: 198, maxY: 296, groundY: 294 },
    { name: 'dino_run_1', minX: 600, maxX: 696, minY: 198, maxY: 296, groundY: 294 },
    { name: 'dino_run_2', minX: 708, maxX: 799, minY: 198, maxY: 296, groundY: 294 },
    { name: 'dino_run_3', minX: 810, maxX: 908, minY: 198, maxY: 296, groundY: 294 },
    { name: 'dino_run_4', minX: 918, maxX: 1016, minY: 198, maxY: 296, groundY: 294 }
  ];

  for (const def of runDefs) {
    const raw = segmentCharacter(def);
    await sharp(raw.buf, { raw: { width: raw.width, height: raw.height, channels: 4 } })
      .trim()
      .png()
      .toFile(path.join(outDir, `${def.name}.png`));
    console.log(`Saved ${def.name}.png`);
  }

  console.log('--- EXTRACTING IDLE FRAMES ---');
  const idleDefs = [
    { name: 'dino_idle_0', minX: 14, maxX: 124, minY: 194, maxY: 302, groundY: 300 },
    { name: 'dino_idle_1', minX: 126, maxX: 236, minY: 194, maxY: 302, groundY: 300 },
    { name: 'dino_idle_2', minX: 237, maxX: 338, minY: 194, maxY: 302, groundY: 300 },
    { name: 'dino_idle_3', minX: 352, maxX: 458, minY: 194, maxY: 302, groundY: 300 }
  ];

  for (const def of idleDefs) {
    const raw = segmentCharacter(def);
    await sharp(raw.buf, { raw: { width: raw.width, height: raw.height, channels: 4 } })
      .trim()
      .png()
      .toFile(path.join(outDir, `${def.name}.png`));
    console.log(`Saved ${def.name}.png`);
  }

  console.log('--- EXTRACTING JUMP FRAMES ---');
  const jumpDefs = [
    { name: 'dino_jump_0', minX: 20, maxX: 100, minY: 405, maxY: 483, groundY: 480 },
    { name: 'dino_jump_1', minX: 123, maxX: 200, minY: 375, maxY: 462, groundY: 461 },
    { name: 'dino_jump_2', minX: 228, maxX: 304, minY: 360, maxY: 444, groundY: null },
    { name: 'dino_jump_3', minX: 320, maxX: 403, minY: 394, maxY: 468, groundY: 467 },
    { name: 'dino_jump_4', minX: 416, maxX: 501, minY: 412, maxY: 483, groundY: 480 }
  ];

  for (const def of jumpDefs) {
    const raw = segmentCharacter(def);
    await sharp(raw.buf, { raw: { width: raw.width, height: raw.height, channels: 4 } })
      .trim()
      .png()
      .toFile(path.join(outDir, `${def.name}.png`));
    console.log(`Saved ${def.name}.png`);
  }

  console.log('--- EXTRACTING DUCK FRAMES ---');
  const duckDefs = [
    { name: 'dino_duck_0', minX: 526, maxX: 614, minY: 388, maxY: 480, groundY: 477 }, // Before Duck
    { name: 'dino_duck_1', minX: 630, maxX: 719, minY: 416, maxY: 480, groundY: 477 }, // Start Duck (eyes closed)
    { name: 'dino_duck_2', minX: 732, maxX: 818, minY: 422, maxY: 480, groundY: 477 }, // Ducking (eyes closed)
    { name: 'dino_duck_3', minX: 834, maxX: 916, minY: 428, maxY: 480, groundY: 477 }, // Continue Duck (lowest, eyes closed)
    { name: 'dino_duck_4', minX: 932, maxX: 1016, minY: 394, maxY: 480, groundY: 478 } // Stand Up
  ];

  for (const def of duckDefs) {
    const raw = segmentCharacter(def);
    await sharp(raw.buf, { raw: { width: raw.width, height: raw.height, channels: 4 } })
      .trim()
      .png()
      .toFile(path.join(outDir, `${def.name}.png`));
    console.log(`Saved ${def.name}.png`);
  }

  console.log('--- EXTRACTING COLLISION & DEAD FRAMES ---');
  const collDefs = [
    { name: 'dino_hit', minX: 112, maxX: 196, minY: 556, maxY: 658, groundY: 656 },
    { name: 'dino_dead', minX: 245, maxX: 370, minY: 556, maxY: 658, groundY: 656, isDead: true }
  ];

  for (const def of collDefs) {
    const raw = segmentCharacter(def);
    await sharp(raw.buf, { raw: { width: raw.width, height: raw.height, channels: 4 } })
      .trim()
      .png()
      .toFile(path.join(outDir, `${def.name}.png`));
    console.log(`Saved ${def.name}.png`);
  }

  console.log('--- EXTRACTING CACTI & PTERODACTYL ---');
  const obsDefs = [
    // Cactus 1: Tall single cactus with flower (Panel 6)
    { name: 'cactus_tall', minX: 427, maxX: 468, minY: 535, maxY: 635, groundY: 632, isCactus: true },
    // Cactus 2: Double / curved arms cactus (Panel 6)
    { name: 'cactus_double', minX: 475, maxX: 508, minY: 550, maxY: 635, groundY: 632, isCactus: true },
    // Cactus 3: Large symmetric with flower (Panel 6)
    { name: 'cactus_single', minX: 512, maxX: 552, minY: 535, maxY: 635, groundY: 632, isCactus: true },
    // Cactus 4: Small single cactus (Panel 6)
    { name: 'cactus_small', minX: 568, maxX: 602, minY: 565, maxY: 635, groundY: 632, isCactus: true },
    // Pterodactyl: wings up (Panel 6)
    { name: 'pterodactyl_0', minX: 680, maxX: 785, minY: 535, maxY: 630, groundY: null, isPtero: true }
  ];

  for (const def of obsDefs) {
    const raw = segmentCharacter(def);
    await sharp(raw.buf, { raw: { width: raw.width, height: raw.height, channels: 4 } })
      .trim()
      .png()
      .toFile(path.join(outDir, `${def.name}.png`));
    console.log(`Saved ${def.name}.png`);
  }
}

extractAll().catch(console.error);
