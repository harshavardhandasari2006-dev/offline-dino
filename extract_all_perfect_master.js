const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function main() {
  const { data, info } = await sharp('assets/style1_reference.jpg').raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [data[idx], data[idx + 1], data[idx + 2]];
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
    if (groundY && y > groundY - 6) return false; // Never treat ground sand as belly!
    const [r, g, b] = getPixel(x, y);
    return (r > 175 && g > 160 && (g - b >= 30) && r > b + 25);
  }
  function isEyeWhite(x, y, topY, maxH) {
    const [r, g, b] = getPixel(x, y);
    return (r > 215 && g > 215 && b > 210 && y < topY + maxH * 0.6);
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
  function isDeadStarOrSpiral(x, y) {
    const [r, g, b] = getPixel(x, y);
    if (r > 190 && g > 160 && b < 110) return true;
    if (r < 80 && g < 80 && b < 80 && y < 630) return true;
    return false;
  }

  // Master dinosaur segmenter
  function segmentDino({ minX, maxX, minY, maxY, groundY, isDead = false }) {
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    function isFg(x, y) {
      if (x < minX || x > maxX || y < minY || y > maxY) return false;
      if (groundY && y > groundY) return false;
      if (isGreen(x, y) || isSpine(x, y) || isTongue(x, y) || isBelly(x, y, groundY) || isClaw(x, y, groundY) || isEyeWhite(x, y, minY, cropH)) return true;
      if (isDead && isDeadStarOrSpiral(x, y)) return true;
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
            if (!isFg(absX, absY)) {
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

    // Seed obvious sky / cloud / mesa / ground sand
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
        // Mesa (salmon tan)
        if (r > 165 && g < 195 && b < 195 && Math.abs(g - b) < 25 && r > g + 20) {
          if (!isFg(absX, absY) && isBg[y * cropW + x] === 0) {
            isBg[y * cropW + x] = 1; q.push([x, y]);
          }
        }
        // Ground sand or shadow
        if (groundY && absY >= groundY - 7) {
          if (!isGreen(absX, absY) && !isClaw(absX, absY, groundY) && !isSpine(absX, absY)) {
            if (r > 140 && (r > g + 10 || r > b + 20)) {
              if (isBg[y * cropW + x] === 0) { isBg[y * cropW + x] = 1; q.push([x, y]); }
            }
          }
        }
      }
    }

    // Flood fill background
    let head = 0;
    while (head < q.length) {
      const [cx, cy] = q[head++];
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        if (nx < 0 || nx >= cropW || ny < 0 || ny >= cropH) continue;
        const nIdx = ny * cropW + nx;
        if (isBg[nIdx] !== 0) continue;
        const absX = minX + nx, absY = minY + ny;
        if (isFg(absX, absY)) continue;
        const [r, g, b] = getPixel(absX, absY);
        if (r < 75 && g < 85 && b < 75) continue; // outline barrier
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

    let maxL = -1, maxSz = 0;
    for (let i = 0; i < sizes.length; i++) {
      if (sizes[i] > maxSz) { maxSz = sizes[i]; maxL = i; }
    }

    const fgMask = new Uint8Array(cropW * cropH);
    for (let i = 0; i < cropW * cropH; i++) {
      if (labels[i] === maxL) {
        fgMask[i] = 1;
      } else if (isDead && labels[i] !== -1 && sizes[labels[i]] > 10) {
        const py = Math.floor(i / cropW);
        if (py < cropH * 0.55) {
          fgMask[i] = 1;
        }
      }
    }

    // Smooth edge antialiasing
    const outBuf = Buffer.alloc(cropW * cropH * 4);
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        const oIdx = idx * 4;
        if (fgMask[idx] === 1) {
          const absX = minX + x, absY = minY + y;
          const [r, g, b] = getPixel(absX, absY);

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

  // Segment Cactus
  function segmentCactus({ minX, maxX, minY, maxY, groundY }) {
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const outBuf = Buffer.alloc(cropW * cropH * 4);

    for (let y = 0; y < cropH; y++) {
      const absY = minY + y;
      if (absY > groundY) continue;
      for (let x = 0; x < cropW; x++) {
        const absX = minX + x;
        const [r, g, b] = getPixel(absX, absY);

        const isGreen = (g > r + 15 && g > b + 15 && g > 55) || (g > 80 && g > r && g > b + 20);
        // Flower cone: orange flower on top of cactus (y between 555 and 575)
        const isFlower = (r > 170 && g < 145 && b < 85 && absY < 578);
        const isOutline = (r < 65 && g < 75 && b < 65 && (r > 5 || g > 5));

        if (isGreen || isFlower || isOutline) {
          const oIdx = (y * cropW + x) * 4;
          outBuf[oIdx] = r;
          outBuf[oIdx + 1] = g;
          outBuf[oIdx + 2] = b;
          outBuf[oIdx + 3] = 255;
        }
      }
    }

    // Keep largest component
    const labels = new Int32Array(cropW * cropH).fill(-1);
    const sizes = [];
    let curL = 0;
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        if (outBuf[idx * 4 + 3] > 0 && labels[idx] === -1) {
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
                if (outBuf[ni * 4 + 3] > 0 && labels[ni] === -1) {
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

    let maxL = -1, maxSz = 0;
    for (let i = 0; i < sizes.length; i++) {
      if (sizes[i] > maxSz) { maxSz = sizes[i]; maxL = i; }
    }

    const cleanBuf = Buffer.alloc(cropW * cropH * 4);
    for (let i = 0; i < cropW * cropH; i++) {
      if (labels[i] === maxL) {
        cleanBuf[i * 4] = outBuf[i * 4];
        cleanBuf[i * 4 + 1] = outBuf[i * 4 + 1];
        cleanBuf[i * 4 + 2] = outBuf[i * 4 + 2];
        cleanBuf[i * 4 + 3] = 255;
      }
    }

    return { buf: cleanBuf, width: cropW, height: cropH };
  }

  // Segment Pterodactyl by removing sky background
  function segmentPtero({ minX, maxX, minY, maxY }) {
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    const isBg = new Uint8Array(cropW * cropH);
    const q = [];
    for (let x = 0; x < cropW; x++) {
      q.push([x, 0]); isBg[0 * cropW + x] = 1;
      q.push([x, cropH - 1]); isBg[(cropH - 1) * cropW + x] = 1;
    }
    for (let y = 0; y < cropH; y++) {
      q.push([0, y]); isBg[y * cropW + 0] = 1;
      q.push([cropW - 1, y]); isBg[y * cropW + (cropW - 1)] = 1;
    }

    let head = 0;
    while (head < q.length) {
      const [cx, cy] = q[head++];
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        if (nx < 0 || nx >= cropW || ny < 0 || ny >= cropH) continue;
        const nIdx = ny * cropW + nx;
        if (isBg[nIdx] !== 0) continue;
        const absX = minX + nx, absY = minY + ny;
        const [r, g, b] = getPixel(absX, absY);
        // Sky is blue / cloud
        if (b > r + 8 && b > 165) {
          isBg[nIdx] = 1;
          q.push([nx, ny]);
        }
      }
    }

    const outBuf = Buffer.alloc(cropW * cropH * 4);
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = y * cropW + x;
        if (isBg[idx] === 0) {
          const absX = minX + x, absY = minY + y;
          const [r, g, b] = getPixel(absX, absY);
          outBuf[idx * 4] = r;
          outBuf[idx * 4 + 1] = g;
          outBuf[idx * 4 + 2] = b;
          outBuf[idx * 4 + 3] = 255;
        }
      }
    }

    return { buf: outBuf, width: cropW, height: cropH };
  }

  const outDir = path.join(__dirname, 'assets', 'sprites');
  const spriteMap = {};

  async function saveSprite(name, rawResult, trim = true) {
    let pipeline = sharp(rawResult.buf, { raw: { width: rawResult.width, height: rawResult.height, channels: 4 } });
    if (trim) pipeline = pipeline.trim();
    const pngBuf = await pipeline.png().toBuffer();
    const targetFile = path.join(outDir, name + '.png');
    fs.writeFileSync(targetFile, pngBuf);
    spriteMap[name] = 'data:image/png;base64,' + pngBuf.toString('base64');
    console.log('Saved ' + name + '.png');
  }

  console.log('--- 1. EXTRACTING RUN FRAMES (NORMALIZED 110x96 CANVAS) ---');
  const runCenters = [543, 648, 752, 860, 968];
  for (let i = 0; i < runCenters.length; i++) {
    const cx = runCenters[i];
    const raw = segmentDino({
      minX: cx - 55,
      maxX: cx + 54,
      minY: 199,
      maxY: 295,
      groundY: 294
    });
    // Normalized canvas: identical dimensions and ground baseline for all run frames
    await saveSprite('dino_run_' + i, raw, false);
  }

  console.log('--- 2. EXTRACTING IDLE FRAMES (NORMALIZED 112x106 CANVAS) ---');
  const idleCenters = [72, 186, 291, 408];
  for (let i = 0; i < idleCenters.length; i++) {
    const cx = idleCenters[i];
    const raw = segmentDino({
      minX: cx - 56,
      maxX: cx + 55,
      minY: 195,
      maxY: 301,
      groundY: 300
    });
    await saveSprite('dino_idle_' + i, raw, false);
  }

  console.log('--- 3. EXTRACTING JUMP FRAMES ---');
  const jumpBoxes = [
    { name: 'dino_jump_0', minX: 20, maxX: 100, minY: 405, maxY: 483, groundY: 480 },
    { name: 'dino_jump_1', minX: 123, maxX: 200, minY: 375, maxY: 462, groundY: 461 },
    { name: 'dino_jump_2', minX: 228, maxX: 304, minY: 360, maxY: 444, groundY: null },
    { name: 'dino_jump_3', minX: 320, maxX: 403, minY: 394, maxY: 468, groundY: 467 },
    { name: 'dino_jump_4', minX: 416, maxX: 501, minY: 412, maxY: 483, groundY: 480 }
  ];
  for (const box of jumpBoxes) {
    const raw = segmentDino(box);
    await saveSprite(box.name, raw, true);
  }

  console.log('--- 4. EXTRACTING DUCK FRAMES (CLOSED EYES) ---');
  // Panel 4:
  // dino_duck_0: Before Duck (eyes open)
  // dino_duck_1: Start Duck (eyes closed, lowering)
  // dino_duck_2: Ducking (eyes closed, low body)
  // dino_duck_3: Continue Duck (eyes closed, lowest body)
  // dino_duck_4: Stand Up (eyes open)
  const duckBoxes = [
    { name: 'dino_duck_0', minX: 526, maxX: 614, minY: 388, maxY: 476, groundY: 474 },
    { name: 'dino_duck_1', minX: 630, maxX: 719, minY: 416, maxY: 476, groundY: 474 },
    { name: 'dino_duck_2', minX: 732, maxX: 818, minY: 422, maxY: 476, groundY: 474 },
    { name: 'dino_duck_3', minX: 834, maxX: 916, minY: 428, maxY: 475, groundY: 473 },
    { name: 'dino_duck_4', minX: 932, maxX: 1016, minY: 394, maxY: 476, groundY: 474 }
  ];
  for (const box of duckBoxes) {
    const raw = segmentDino(box);
    await saveSprite(box.name, raw, true);
  }

  console.log('--- 5. EXTRACTING COLLISION & DEAD FRAMES ---');
  const collBoxes = [
    { name: 'dino_hit', minX: 112, maxX: 198, minY: 556, maxY: 654, groundY: 650 },
    { name: 'dino_dead', minX: 265, maxX: 370, minY: 556, maxY: 654, groundY: 650, isDead: true }
  ];
  for (const box of collBoxes) {
    const raw = segmentDino(box);
    await saveSprite(box.name, raw, true);
  }

  console.log('--- 6. EXTRACTING CACTI OBSTACLES ---');
  const cactusBoxes = [
    // Tall single cactus with flower (Panel 6, #1)
    { name: 'cactus_tall', minX: 426, maxX: 468, minY: 555, maxY: 633, groundY: 631 },
    // Curved double cactus (Panel 6, #2)
    { name: 'cactus_double', minX: 474, maxX: 510, minY: 565, maxY: 633, groundY: 631 },
    // Symmetric single/tall cactus with flower (Panel 6, #3)
    { name: 'cactus_single', minX: 512, maxX: 552, minY: 550, maxY: 633, groundY: 631 },
    // Small single cactus (Panel 6, #4)
    { name: 'cactus_small', minX: 566, maxX: 602, minY: 580, maxY: 633, groundY: 631 }
  ];
  for (const box of cactusBoxes) {
    const raw = segmentCactus(box);
    await saveSprite(box.name, raw, true);
  }

  console.log('--- 7. EXTRACTING PTERODACTYL ---');
  const pteroRaw = segmentPtero({ minX: 605, maxX: 708, minY: 535, maxY: 618 });
  await saveSprite('pterodactyl_0', pteroRaw, true);

  // Pterodactyl frame 1: clean wing-flapped variation
  const ptero0Img = sharp(path.join(outDir, 'pterodactyl_0.png'));
  const p0Meta = await ptero0Img.metadata();
  const p0Raw = await ptero0Img.raw().toBuffer();
  const p1Buf = Buffer.alloc(p0Meta.width * p0Meta.height * 4);
  for (let y = 0; y < p0Meta.height; y++) {
    for (let x = 0; x < p0Meta.width; x++) {
      const srcIdx = (y * p0Meta.width + x) * 4;
      let destY = y;
      if (y < p0Meta.height * 0.55 && x < p0Meta.width * 0.75) {
        destY = Math.min(p0Meta.height - 1, y + Math.round((1 - y / (p0Meta.height * 0.55)) * 6));
      }
      const destIdx = (destY * p0Meta.width + x) * 4;
      if (p0Raw[srcIdx + 3] > 0) {
        p1Buf[destIdx] = p0Raw[srcIdx];
        p1Buf[destIdx + 1] = p0Raw[srcIdx + 1];
        p1Buf[destIdx + 2] = p0Raw[srcIdx + 2];
        p1Buf[destIdx + 3] = p0Raw[srcIdx + 3];
      }
    }
  }
  const p1Png = await sharp(p1Buf, { raw: { width: p0Meta.width, height: p0Meta.height, channels: 4 } }).png().toBuffer();
  fs.writeFileSync(path.join(outDir, 'pterodactyl_1.png'), p1Png);
  spriteMap['pterodactyl_1'] = 'data:image/png;base64,' + p1Png.toString('base64');
  console.log('Saved pterodactyl_1.png');

  console.log('--- 8. GENERATING CLEAN BACKGROUND PANORAMAS ---');
  // Generate Day Background from env_day.jpg cleaned of badge and cacti
  // env_day is 285 x 155
  const rawEnvDay = await sharp('assets/extracted/env_day.jpg').raw().toBuffer({ resolveWithObject: true });
  const edW = rawEnvDay.info.width, edH = rawEnvDay.info.height;
  const edData = rawEnvDay.data;

  // Clean badge: x < 155 and y < 35 -> replace with sky gradient above x = 160
  for (let y = 0; y < 36; y++) {
    const srcX = 165;
    const sIdx = (y * edW + srcX) * 3;
    const sr = edData[sIdx], sg = edData[sIdx + 1], sb = edData[sIdx + 2];
    for (let x = 0; x < 156; x++) {
      const dIdx = (y * edW + x) * 3;
      edData[dIdx] = sr;
      edData[dIdx + 1] = sg;
      edData[dIdx + 2] = sb;
    }
  }

  // Clean left cactus (x: 88..115, y: 80..140): inpaint from x=122..145
  for (let y = 80; y <= 140; y++) {
    for (let x = 88; x <= 115; x++) {
      const srcX = x + 35;
      const sIdx = (y * edW + srcX) * 3;
      const dIdx = (y * edW + x) * 3;
      edData[dIdx] = edData[sIdx];
      edData[dIdx + 1] = edData[sIdx + 1];
      edData[dIdx + 2] = edData[sIdx + 2];
    }
  }

  // Clean right cactus (x: 216..246, y: 75..140): inpaint from x=190..210
  for (let y = 75; y <= 140; y++) {
    for (let x = 216; x <= 246; x++) {
      const srcX = x - 35;
      const sIdx = (y * edW + srcX) * 3;
      const dIdx = (y * edW + x) * 3;
      edData[dIdx] = edData[sIdx];
      edData[dIdx + 1] = edData[sIdx + 1];
      edData[dIdx + 2] = edData[sIdx + 2];
    }
  }

  // Upscale to crisp 1140 x 620 panorama and apply subtle depth blur (1.4px) to distant scenery
  const bgDayBuf = await sharp(edData, { raw: { width: edW, height: edH, channels: 3 } })
    .resize(1140, 620, { kernel: 'lanczos3' })
    .blur(1.2)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(outDir, 'bg_day.png'), bgDayBuf);
  spriteMap['bg_day'] = 'data:image/png;base64,' + bgDayBuf.toString('base64');
  console.log('Saved clean bg_day.png');

  // Clean env_night.jpg (295 x 155)
  const rawEnvNight = await sharp('assets/extracted/env_night.jpg').raw().toBuffer({ resolveWithObject: true });
  const enW = rawEnvNight.info.width, enH = rawEnvNight.info.height;
  const enData = rawEnvNight.data;

  // Clean badge: x < 170 and y < 35 -> replace with night sky from x=175
  for (let y = 0; y < 36; y++) {
    const srcX = 180;
    const sIdx = (y * enW + srcX) * 3;
    const sr = enData[sIdx], sg = enData[sIdx + 1], sb = enData[sIdx + 2];
    for (let x = 0; x < 172; x++) {
      const dIdx = (y * enW + x) * 3;
      enData[dIdx] = sr;
      enData[dIdx + 1] = sg;
      enData[dIdx + 2] = sb;
    }
  }

  // Clean left cactus (x: 60..90, y: 80..140): inpaint from x=105..135
  for (let y = 80; y <= 140; y++) {
    for (let x = 60; x <= 90; x++) {
      const srcX = x + 40;
      const sIdx = (y * enW + srcX) * 3;
      const dIdx = (y * enW + x) * 3;
      enData[dIdx] = enData[sIdx];
      enData[dIdx + 1] = enData[sIdx + 1];
      enData[dIdx + 2] = enData[sIdx + 2];
    }
  }

  // Clean right cactus (x: 215..240, y: 80..140): inpaint from x=180..205
  for (let y = 80; y <= 140; y++) {
    for (let x = 215; x <= 240; x++) {
      const srcX = x - 35;
      const sIdx = (y * enW + srcX) * 3;
      const dIdx = (y * enW + x) * 3;
      enData[dIdx] = enData[sIdx];
      enData[dIdx + 1] = enData[sIdx + 1];
      enData[dIdx + 2] = enData[sIdx + 2];
    }
  }

  const bgNightBuf = await sharp(enData, { raw: { width: enW, height: enH, channels: 3 } })
    .resize(1180, 620, { kernel: 'lanczos3' })
    .blur(1.2)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(outDir, 'bg_night.png'), bgNightBuf);
  spriteMap['bg_night'] = 'data:image/png;base64,' + bgNightBuf.toString('base64');
  console.log('Saved clean bg_night.png');

  // Write embedded Base64 sprites to js/sprite_data.js
  console.log('--- 9. WRITING EMBEDDED SPRITE DATA JS ---');
  let jsContent = '/**\n * OFFLINE DINO - Embedded Style 1 Master Sprite Data\n * High-fidelity, transparent, synchronized cartoon sprites.\n */\nwindow.STYLE1_SPRITES = {\n';
  const keys = Object.keys(spriteMap);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    jsContent += `  "${k}": "${spriteMap[k]}"${i < keys.length - 1 ? ',' : ''}\n`;
  }
  jsContent += '};\n';

  fs.writeFileSync(path.join(__dirname, 'js', 'sprite_data.js'), jsContent, 'utf8');
  console.log('Successfully written js/sprite_data.js with ' + keys.length + ' sprites!');
}

main().catch(console.error);
