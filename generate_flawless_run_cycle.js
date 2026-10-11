const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function generateFlawlessRunCycle() {
  console.log('=== GENERATING FLAWLESS 8-FRAME RUN CYCLE ===\n');

  // Load the pristine reference sheet
  const refPath = path.join(__dirname, 'assets', 'style1_reference.jpg');
  const { data: refData, info: refInfo } = await sharp(refPath).raw().toBuffer({ resolveWithObject: true });
  const W = refInfo.width, H = refInfo.height;

  function getPixel(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return [255, 255, 255];
    const idx = (y * W + x) * 3;
    return [refData[idx], refData[idx + 1], refData[idx + 2]];
  }

  // 1. Extract the pristine master upper body of the running dinosaur from Panel 2, Figure 1
  // In Panel 2, Fig 1: minX: 494, maxX: 594, minY: 194, maxY: 300
  // Upper body is y in [194..270] (head, eye, snout, mouth, neck, chest, belly, back, spines, and tail)
  // Let's extract this master running dinosaur with pure transparent background
  const fig1PadL = 492, fig1PadR = 598, fig1PadT = 192, fig1PadB = 302;
  const fig1W = fig1PadR - fig1PadL + 1, fig1H = fig1PadB - fig1PadT + 1;

  function isFig1Fg(x, y) {
    const absX = fig1PadL + x, absY = fig1PadT + y;
    if (absY > 299) return false;
    const [r, g, b] = getPixel(absX, absY);

    // Green skin
    if ((g > r + 6 && g > b + 6 && g > 36) || (g > 70 && g > r && g > b + 8)) return true;
    // Dark outline / spines
    if (r < 75 && g < 85 && b < 75 && (r > 4 || g > 4 || b > 4)) return true;
    // Cream chin / throat / chest / belly
    if (r > 155 && g > 135 && r > b + 15 && g > b + 15 && (r - g <= 60)) return true;
    // Mouth / tongue / lips
    if (r > 100 && g < 125 && b < 130 && r > g + 15) return true;
    if (r > 60 && r < 150 && g < 70 && b < 70) return true;
    // Eye white & pupil in head
    if (absX >= 530 && absX <= 585 && absY >= 204 && absY <= 245) {
      if (r > 190 && g > 190 && b > 180) return true;
      if (r < 75 && g < 75 && b < 75) return true;
    }
    // Toenails near ground
    if (absY >= 285 && absY <= 299 && r > 180 && g > 170 && b < 175 && g - b > 8) return true;

    return false;
  }

  const mask1 = new Uint8Array(fig1W * fig1H);
  for (let y = 0; y < fig1H; y++) {
    for (let x = 0; x < fig1W; x++) {
      if (isFig1Fg(x, y)) mask1[y * fig1W + x] = 1;
    }
  }

  // Connected components to keep only the main dinosaur
  const labels1 = new Int32Array(fig1W * fig1H).fill(-1);
  const sizes1 = [];
  let curL1 = 0;
  for (let y = 0; y < fig1H; y++) {
    for (let x = 0; x < fig1W; x++) {
      const idx = y * fig1W + x;
      if (mask1[idx] === 1 && labels1[idx] === -1) {
        let sz = 0;
        const q = [idx];
        labels1[idx] = curL1;
        let head = 0;
        while (head < q.length) {
          const cur = q[head++];
          sz++;
          const cx = cur % fig1W, cy = Math.floor(cur / fig1W);
          for (const [nx, ny] of [[cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]]) {
            if (nx >= 0 && nx < fig1W && ny >= 0 && ny < fig1H) {
              const ni = ny * fig1W + nx;
              if (mask1[ni] === 1 && labels1[ni] === -1) {
                labels1[ni] = curL1;
                q.push(ni);
              }
            }
          }
        }
        sizes1.push(sz);
        curL1++;
      }
    }
  }

  let maxSz1 = 0, maxL1 = -1;
  for (let i = 0; i < sizes1.length; i++) {
    if (sizes1[i] > maxSz1) { maxSz1 = sizes1[i]; maxL1 = i; }
  }

  // Master Figure 1 buffer (crop coordinates)
  const masterFig1Buf = Buffer.alloc(fig1W * fig1H * 4);
  for (let y = 0; y < fig1H; y++) {
    for (let x = 0; x < fig1W; x++) {
      const idx = y * fig1W + x;
      if (labels1[idx] === maxL1) {
        const [r, g, b] = getPixel(fig1PadL + x, fig1PadT + y);
        let a = 255;
        // Check edge de-matting
        let touchesBg = false;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= fig1W || ny < 0 || ny >= fig1H || labels1[ny * fig1W + nx] !== maxL1) {
            touchesBg = true;
            break;
          }
        }
        let outB = b;
        if (touchesBg && b > r + 15 && b > 120 && !(r < 65 && g < 65 && b < 65)) {
          outB = Math.min(outB, Math.round((r + g) / 2));
          a = 210;
        }
        masterFig1Buf[idx * 4] = r;
        masterFig1Buf[idx * 4 + 1] = g;
        masterFig1Buf[idx * 4 + 2] = outB;
        masterFig1Buf[idx * 4 + 3] = a;
      }
    }
  }

  // Clear any sand below row corresponding to baselineY=299:
  // fig1PadT = 192, baseline is 299 - 192 = 107
  const baseCropRow = 299 - fig1PadT; // 107
  for (let y = baseCropRow + 1; y < fig1H; y++) {
    for (let x = 0; x < fig1W; x++) {
      masterFig1Buf[(y * fig1W + x) * 4 + 3] = 0;
    }
  }
  // Clear any non-foot sand at rows baseCropRow - 3 to baseCropRow:
  for (let y = baseCropRow - 4; y <= baseCropRow; y++) {
    for (let x = 0; x < fig1W; x++) {
      const idx = (y * fig1W + x) * 4;
      if (masterFig1Buf[idx + 3] === 0) continue;
      const r = masterFig1Buf[idx], g = masterFig1Buf[idx + 1], b = masterFig1Buf[idx + 2];
      const isGreen = (g > r + 8 && g > b + 8) || (g > 70 && g > r && g > b + 8);
      const isClaw = (r > 185 && g > 175 && b < 175 && g - b > 8);
      const isSole = (r < 60 && g < 70 && b < 60);
      if (!isGreen && !isClaw && !isSole) {
        masterFig1Buf[idx + 3] = 0;
      }
    }
  }

  // 2. Also extract Figure 5 (Panel 2, Fig 5) for the opposite stride leg morphology:
  // minX: 918, maxX: 1016, minY: 194, maxY: 301, baselineY: 299
  const fig5PadL = 916, fig5PadR = 1018, fig5PadT = 192, fig5PadB = 302;
  const fig5W = fig5PadR - fig5PadL + 1, fig5H = fig5PadB - fig5PadT + 1;

  function isFig5Fg(x, y) {
    const absX = fig5PadL + x, absY = fig5PadT + y;
    if (absY > 299) return false;
    const [r, g, b] = getPixel(absX, absY);
    if ((g > r + 6 && g > b + 6 && g > 36) || (g > 70 && g > r && g > b + 8)) return true;
    if (r < 75 && g < 85 && b < 75 && (r > 4 || g > 4 || b > 4)) return true;
    if (r > 155 && g > 135 && r > b + 15 && g > b + 15 && (r - g <= 60)) return true;
    if (r > 100 && g < 125 && b < 130 && r > g + 15) return true;
    if (r > 60 && r < 150 && g < 70 && b < 70) return true;
    if (absX >= 960 && absX <= 1010 && absY >= 204 && absY <= 245) {
      if (r > 190 && g > 190 && b > 180) return true;
      if (r < 75 && g < 75 && b < 75) return true;
    }
    if (absY >= 285 && absY <= 299 && r > 180 && g > 170 && b < 175 && g - b > 8) return true;
    return false;
  }

  const mask5 = new Uint8Array(fig5W * fig5H);
  for (let y = 0; y < fig5H; y++) {
    for (let x = 0; x < fig5W; x++) {
      if (isFig5Fg(x, y)) mask5[y * fig5W + x] = 1;
    }
  }

  const labels5 = new Int32Array(fig5W * fig5H).fill(-1);
  const sizes5 = [];
  let curL5 = 0;
  for (let y = 0; y < fig5H; y++) {
    for (let x = 0; x < fig5W; x++) {
      const idx = y * fig5W + x;
      if (mask5[idx] === 1 && labels5[idx] === -1) {
        let sz = 0;
        const q = [idx];
        labels5[idx] = curL5;
        let head = 0;
        while (head < q.length) {
          const cur = q[head++];
          sz++;
          const cx = cur % fig5W, cy = Math.floor(cur / fig5W);
          for (const [nx, ny] of [[cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]]) {
            if (nx >= 0 && nx < fig5W && ny >= 0 && ny < fig5H) {
              const ni = ny * fig5W + nx;
              if (mask5[ni] === 1 && labels5[ni] === -1) {
                labels5[ni] = curL5;
                q.push(ni);
              }
            }
          }
        }
        sizes5.push(sz);
        curL5++;
      }
    }
  }

  let maxSz5 = 0, maxL5 = -1;
  for (let i = 0; i < sizes5.length; i++) {
    if (sizes5[i] > maxSz5) { maxSz5 = sizes5[i]; maxL5 = i; }
  }

  const masterFig5Buf = Buffer.alloc(fig5W * fig5H * 4);
  for (let y = 0; y < fig5H; y++) {
    for (let x = 0; x < fig5W; x++) {
      const idx = y * fig5W + x;
      if (labels5[idx] === maxL5) {
        const [r, g, b] = getPixel(fig5PadL + x, fig5PadT + y);
        let a = 255;
        let touchesBg = false;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= fig5W || ny < 0 || ny >= fig5H || labels5[ny * fig5W + nx] !== maxL5) {
            touchesBg = true;
            break;
          }
        }
        let outB = b;
        if (touchesBg && b > r + 15 && b > 120 && !(r < 65 && g < 65 && b < 65)) {
          outB = Math.min(outB, Math.round((r + g) / 2));
          a = 210;
        }
        masterFig5Buf[idx * 4] = r;
        masterFig5Buf[idx * 4 + 1] = g;
        masterFig5Buf[idx * 4 + 2] = outB;
        masterFig5Buf[idx * 4 + 3] = a;
      }
    }
  }

  // Clear sand on Fig 5 below ground
  for (let y = baseCropRow + 1; y < fig5H; y++) {
    for (let x = 0; x < fig5W; x++) {
      masterFig5Buf[(y * fig5W + x) * 4 + 3] = 0;
    }
  }
  for (let y = baseCropRow - 4; y <= baseCropRow; y++) {
    for (let x = 0; x < fig5W; x++) {
      const idx = (y * fig5W + x) * 4;
      if (masterFig5Buf[idx + 3] === 0) continue;
      const r = masterFig5Buf[idx], g = masterFig5Buf[idx + 1], b = masterFig5Buf[idx + 2];
      const isGreen = (g > r + 8 && g > b + 8) || (g > 70 && g > r && g > b + 8);
      const isClaw = (r > 185 && g > 175 && b < 175 && g - b > 8);
      const isSole = (r < 60 && g < 70 && b < 60);
      if (!isGreen && !isClaw && !isSole) {
        masterFig5Buf[idx + 3] = 0;
      }
    }
  }

  // Now, let's place master Figure 1 onto a canonical 128x112 canvas:
  // Baseline ground is at row 103!
  // In Fig 1, baseCropRow is 107.
  // destYOffset = 103 - 107 = -4!
  // Character center X:
  let minF1X = fig1W, maxF1X = 0;
  for (let y = 0; y < fig1H; y++) {
    for (let x = 0; x < fig1W; x++) {
      if (masterFig1Buf[(y * fig1W + x) * 4 + 3] > 0) {
        if (x < minF1X) minF1X = x;
        if (x > maxF1X) maxF1X = x;
      }
    }
  }
  const f1CenterX = (minF1X + maxF1X) / 2;
  const f1DestXOffset = Math.round(62 - f1CenterX);

  const targetW = 128, targetH = 112;

  // Let's create an offscreen canvas for Fig 1 on 128x112:
  const canvasFig1 = Buffer.alloc(targetW * targetH * 4);
  for (let y = 0; y < fig1H; y++) {
    for (let x = 0; x < fig1W; x++) {
      const sIdx = (y * fig1W + x) * 4;
      if (masterFig1Buf[sIdx + 3] > 0) {
        const dx = x + f1DestXOffset;
        const dy = y + (103 - baseCropRow);
        if (dx >= 0 && dx < targetW && dy >= 0 && dy < targetH) {
          const dIdx = (dy * targetW + dx) * 4;
          canvasFig1[dIdx] = masterFig1Buf[sIdx];
          canvasFig1[dIdx + 1] = masterFig1Buf[sIdx + 1];
          canvasFig1[dIdx + 2] = masterFig1Buf[sIdx + 2];
          canvasFig1[dIdx + 3] = masterFig1Buf[sIdx + 3];
        }
      }
    }
  }

  // And offscreen canvas for Fig 5 on 128x112:
  let minF5X = fig5W, maxF5X = 0;
  for (let y = 0; y < fig5H; y++) {
    for (let x = 0; x < fig5W; x++) {
      if (masterFig5Buf[(y * fig5W + x) * 4 + 3] > 0) {
        if (x < minF5X) minF5X = x;
        if (x > maxF5X) maxF5X = x;
      }
    }
  }
  const f5CenterX = (minF5X + maxF5X) / 2;
  const f5DestXOffset = Math.round(62 - f5CenterX);
  const canvasFig5 = Buffer.alloc(targetW * targetH * 4);
  for (let y = 0; y < fig5H; y++) {
    for (let x = 0; x < fig5W; x++) {
      const sIdx = (y * fig5W + x) * 4;
      if (masterFig5Buf[sIdx + 3] > 0) {
        const dx = x + f5DestXOffset;
        const dy = y + (103 - baseCropRow);
        if (dx >= 0 && dx < targetW && dy >= 0 && dy < targetH) {
          const dIdx = (dy * targetW + dx) * 4;
          canvasFig5[dIdx] = masterFig5Buf[sIdx];
          canvasFig5[dIdx + 1] = masterFig5Buf[sIdx + 1];
          canvasFig5[dIdx + 2] = masterFig5Buf[sIdx + 2];
          canvasFig5[dIdx + 3] = masterFig5Buf[sIdx + 3];
        }
      }
    }
  }

  // Now, look at Fig 1 and Fig 5:
  // In Fig 1:
  // Near leg is forward, planted at y=103 (x in [30..48]).
  // Far leg is back, foot in air (x in [58..78], y in [80..98]).
  // In Fig 5:
  // Far leg is forward, reaching forward (x in [50..70], y in [86..103]).
  // Near leg is back, tucked (x in [32..48], y in [82..98]).

  // Let's build the 8-frame run cycle:
  // Frame 0: Contact A (Fig 1: Near leg forward firmly on y=103, Far leg extended back)
  // Frame 1: Down / Compression A (Near leg fully supporting at y=103, Far leg knee bends forward, body subtle down 1.5px)
  // Frame 2: Passing A (Near leg driving under hip at y=103, Far leg swinging forward through center)
  // Frame 3: Up / Reach A (Near leg pushing off ground, Far leg reaching forward preparing to plant, body subtle up 1.5px)
  // Frame 4: Contact B (Opposite stride: Far leg forward firmly planted on y=103, Near leg extended back)
  // Frame 5: Down / Compression B (Far leg fully supporting at y=103, Near leg knee bends forward, body subtle down 1.5px)
  // Frame 6: Passing B (Far leg driving under hip at y=103, Near leg swinging forward through center)
  // Frame 7: Up / Reach B (Far leg pushing off ground, Near leg reaching forward preparing to plant, body subtle up 1.5px)

  const runFrames = [];

  // Helper: clone canvas
  function clone(buf) {
    return Buffer.from(buf);
  }

  // Frame 0: Contact A (Prong 1: Fig 1)
  const frame0 = clone(canvasFig1);
  // Ensure solid foot contact at y=103 for the forward near foot:
  // Forward near foot is at x in [30..42]
  for (let x = 30; x <= 42; x++) {
    const idx103 = (103 * targetW + x) * 4;
    const idx102 = (102 * targetW + x) * 4;
    if (frame0[idx102 + 3] > 100 && frame0[idx103 + 3] === 0) {
      frame0[idx103] = frame0[idx102];
      frame0[idx103 + 1] = frame0[idx102 + 1];
      frame0[idx103 + 2] = frame0[idx102 + 2];
      frame0[idx103 + 3] = 255;
    }
  }
  runFrames.push(frame0);

  // Frame 1: Down / Compression A:
  // Weight is absorbed onto the planted near leg (y=103).
  // The upper body compresses down by 1px (natural compression).
  // The far leg swings forward with bent knee (shifts forward by ~4px).
  const frame1 = Buffer.alloc(targetW * targetH * 4);
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const sIdx = (y * targetW + x) * 4;
      if (frame0[sIdx + 3] === 0) continue;
      // If upper body (y < 75): shift down by 1px
      if (y < 75) {
        const dy = y + 1;
        if (dy < targetH) {
          const dIdx = (dy * targetW + x) * 4;
          frame1[dIdx] = frame0[sIdx];
          frame1[dIdx + 1] = frame0[sIdx + 1];
          frame1[dIdx + 2] = frame0[sIdx + 2];
          frame1[dIdx + 3] = frame0[sIdx + 3];
        }
      } else {
        // Legs:
        // Near leg (x <= 48): firmly planted on ground y=103
        // Far leg (x > 48): knee bends, shifting forward by 3px
        if (x > 48) {
          const dx = x - 3;
          const dy = y;
          const dIdx = (dy * targetW + dx) * 4;
          frame1[dIdx] = frame0[sIdx];
          frame1[dIdx + 1] = frame0[sIdx + 1];
          frame1[dIdx + 2] = frame0[sIdx + 2];
          frame1[dIdx + 3] = frame0[sIdx + 3];
        } else {
          // Near leg stays solid
          frame1[sIdx] = frame0[sIdx];
          frame1[sIdx + 1] = frame0[sIdx + 1];
          frame1[sIdx + 2] = frame0[sIdx + 2];
          frame1[sIdx + 3] = frame0[sIdx + 3];
        }
      }
    }
  }
  runFrames.push(frame1);

  // Frame 2: Passing A:
  // Near leg is directly supporting under hip at y=103.
  // Far leg is passing forward under the body (knee bent, foot clearing ground at y=96).
  const frame2 = Buffer.alloc(targetW * targetH * 4);
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const sIdx = (y * targetW + x) * 4;
      if (frame0[sIdx + 3] === 0) continue;
      if (y < 75) {
        // Upper body normal height
        frame2[sIdx] = frame0[sIdx];
        frame2[sIdx + 1] = frame0[sIdx + 1];
        frame2[sIdx + 2] = frame0[sIdx + 2];
        frame2[sIdx + 3] = frame0[sIdx + 3];
      } else {
        if (x > 48) {
          // Far leg swinging forward through center (shift forward by 7px, lift by 3px)
          const dx = x - 7;
          const dy = Math.max(75, y - 3);
          const dIdx = (dy * targetW + dx) * 4;
          frame2[dIdx] = frame0[sIdx];
          frame2[dIdx + 1] = frame0[sIdx + 1];
          frame2[dIdx + 2] = frame0[sIdx + 2];
          frame2[dIdx + 3] = frame0[sIdx + 3];
        } else {
          // Near supporting leg rolling back slightly
          const dx = x + 2;
          const dIdx = (y * targetW + dx) * 4;
          frame2[dIdx] = frame0[sIdx];
          frame2[dIdx + 1] = frame0[sIdx + 1];
          frame2[dIdx + 2] = frame0[sIdx + 2];
          frame2[dIdx + 3] = frame0[sIdx + 3];
        }
      }
    }
  }
  runFrames.push(frame2);

  // Frame 3: Up / Recovery A:
  // Near leg pushing off backward (toe at y=102..103).
  // Far leg reaching forward preparing to plant.
  // Body rises subtly by 1px (leap/flight phase).
  const frame3 = Buffer.alloc(targetW * targetH * 4);
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const sIdx = (y * targetW + x) * 4;
      if (canvasFig5[sIdx + 3] === 0) continue;
      // In Fig 5, far leg is already forward and near leg is back!
      if (y < 75) {
        // Upper body rises 1px
        const dy = Math.max(0, y - 1);
        const dIdx = (dy * targetW + x) * 4;
        frame3[dIdx] = canvasFig5[sIdx];
        frame3[dIdx + 1] = canvasFig5[sIdx + 1];
        frame3[dIdx + 2] = canvasFig5[sIdx + 2];
        frame3[dIdx + 3] = canvasFig5[sIdx + 3];
      } else {
        frame3[sIdx] = canvasFig5[sIdx];
        frame3[sIdx + 1] = canvasFig5[sIdx + 1];
        frame3[sIdx + 2] = canvasFig5[sIdx + 2];
        frame3[sIdx + 3] = canvasFig5[sIdx + 3];
      }
    }
  }
  runFrames.push(frame3);

  // Frame 4: Contact B (Opposite Stride: Far leg forward firmly planted on row 103, Near leg back):
  // Based on Fig 5 with Far foot firmly touching row 103!
  const frame4 = clone(canvasFig5);
  // Ensure far forward foot firmly touches y=103:
  // Find lowest pixels of the forward foot in frame4 (around x in [50..70])
  let lowestFarY = 0;
  for (let y = 90; y < targetH; y++) {
    for (let x = 45; x <= 75; x++) {
      if (frame4[(y * targetW + x) * 4 + 3] > 100) {
        if (y > lowestFarY) lowestFarY = y;
      }
    }
  }
  const farDrop = 103 - lowestFarY;
  // Shift the forward far foot down so it contacts y=103 solidly:
  for (let y = 90; y < targetH; y++) {
    for (let x = 45; x <= 75; x++) {
      const sIdx = (y * targetW + x) * 4;
      if (canvasFig5[sIdx + 3] > 100) {
        const dy = y + farDrop;
        if (dy <= 103 && dy >= 0) {
          const dIdx = (dy * targetW + x) * 4;
          frame4[dIdx] = canvasFig5[sIdx];
          frame4[dIdx + 1] = canvasFig5[sIdx + 1];
          frame4[dIdx + 2] = canvasFig5[sIdx + 2];
          frame4[dIdx + 3] = canvasFig5[sIdx + 3];
        }
      }
    }
  }
  runFrames.push(frame4);

  // Frame 5: Down / Compression B:
  // Far leg is fully supporting at y=103.
  // Upper body drops 1px.
  // Near leg knee bends and swings forward under the hip.
  const frame5 = Buffer.alloc(targetW * targetH * 4);
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const sIdx = (y * targetW + x) * 4;
      if (frame4[sIdx + 3] === 0) continue;
      if (y < 75) {
        const dy = y + 1;
        if (dy < targetH) {
          const dIdx = (dy * targetW + x) * 4;
          frame5[dIdx] = frame4[sIdx];
          frame5[dIdx + 1] = frame4[sIdx + 1];
          frame5[dIdx + 2] = frame4[sIdx + 2];
          frame5[dIdx + 3] = frame4[sIdx + 3];
        }
      } else {
        if (x <= 48) {
          // Near rear leg swings forward toward center (shift forward by 4px)
          const dx = x + 4;
          if (dx < targetW) {
            const dIdx = (y * targetW + dx) * 4;
            frame5[dIdx] = frame4[sIdx];
            frame5[dIdx + 1] = frame4[sIdx + 1];
            frame5[dIdx + 2] = frame4[sIdx + 2];
            frame5[dIdx + 3] = frame4[sIdx + 3];
          }
        } else {
          // Far leg supporting at ground
          frame5[sIdx] = frame4[sIdx];
          frame5[sIdx + 1] = frame4[sIdx + 1];
          frame5[sIdx + 2] = frame4[sIdx + 2];
          frame5[sIdx + 3] = frame4[sIdx + 3];
        }
      }
    }
  }
  runFrames.push(frame5);

  // Frame 6: Passing B:
  // Far leg driving under hip at y=103.
  // Near leg passing through center, knee bent forward, foot clearing ground (y=96).
  const frame6 = Buffer.alloc(targetW * targetH * 4);
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const sIdx = (y * targetW + x) * 4;
      if (frame4[sIdx + 3] === 0) continue;
      if (y < 75) {
        frame6[sIdx] = frame4[sIdx];
        frame6[sIdx + 1] = frame4[sIdx + 1];
        frame6[sIdx + 2] = frame4[sIdx + 2];
        frame6[sIdx + 3] = frame4[sIdx + 3];
      } else {
        if (x <= 48) {
          // Near leg swinging through center (shift forward 8px, lift 3px)
          const dx = x + 8;
          const dy = Math.max(75, y - 3);
          if (dx < targetW) {
            const dIdx = (dy * targetW + dx) * 4;
            frame6[dIdx] = frame4[sIdx];
            frame6[dIdx + 1] = frame4[sIdx + 1];
            frame6[dIdx + 2] = frame4[sIdx + 2];
            frame6[dIdx + 3] = frame4[sIdx + 3];
          }
        } else {
          // Far leg supporting
          const dx = x - 2;
          const dIdx = (y * targetW + dx) * 4;
          frame6[dIdx] = frame4[sIdx];
          frame6[dIdx + 1] = frame4[sIdx + 1];
          frame6[dIdx + 2] = frame4[sIdx + 2];
          frame6[dIdx + 3] = frame4[sIdx + 3];
        }
      }
    }
  }
  runFrames.push(frame6);

  // Frame 7: Up / Recovery B:
  // Far leg pushes off backward.
  // Near leg extends forward reaching for ground row 103 (transitions seamlessly to Frame 0!).
  // Upper body rises 1px.
  const frame7 = Buffer.alloc(targetW * targetH * 4);
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const sIdx = (y * targetW + x) * 4;
      if (frame0[sIdx + 3] === 0) continue;
      if (y < 75) {
        const dy = Math.max(0, y - 1);
        const dIdx = (dy * targetW + x) * 4;
        frame7[dIdx] = frame0[sIdx];
        frame7[dIdx + 1] = frame0[sIdx + 1];
        frame7[dIdx + 2] = frame0[sIdx + 2];
        frame7[dIdx + 3] = frame0[sIdx + 3];
      } else {
        // Near leg reaching forward ready to touch ground
        frame7[sIdx] = frame0[sIdx];
        frame7[sIdx + 1] = frame0[sIdx + 1];
        frame7[sIdx + 2] = frame0[sIdx + 2];
        frame7[sIdx + 3] = frame0[sIdx + 3];
      }
    }
  }
  runFrames.push(frame7);

  // Save all 8 frames
  for (let i = 0; i < 8; i++) {
    const fPath = path.join(__dirname, 'assets', 'sprites', `dino_run_${i}.png`);
    await sharp(runFrames[i], { raw: { width: targetW, height: targetH, channels: 4 } }).png().toFile(fPath);
    console.log(`Saved dino_run_${i}.png`);
  }

  // Create an 8-frame contact sheet on sky blue with red baseline at row 103
  const bg = { r: 77, g: 166, b: 255, alpha: 1 };
  const montageW = (targetW + 10) * 8 + 10;
  const montageH = targetH + 30;

  const compositeList = [];
  for (let i = 0; i < 8; i++) {
    compositeList.push({
      input: path.join(__dirname, 'assets', 'sprites', `dino_run_${i}.png`),
      left: i * (targetW + 10) + 10,
      top: 10
    });
  }

  const canvas = await sharp({
    create: { width: montageW, height: montageH, channels: 4, background: bg }
  }).composite(compositeList).png().toBuffer();

  const { data: cData, info: cInfo } = await sharp(canvas).raw().toBuffer({ resolveWithObject: true });
  const redY = 10 + 103;
  for (let x = 0; x < cInfo.width; x++) {
    const idx = (redY * cInfo.width + x) * 4;
    cData[idx] = 255; cData[idx+1] = 0; cData[idx+2] = 0; cData[idx+3] = 255;
  }

  await sharp(cData, { raw: { width: cInfo.width, height: cInfo.height, channels: 4 } })
    .png()
    .toFile('contact_sheet_run_cycle_8frames.png');
  console.log('Saved contact_sheet_run_cycle_8frames.png');
}

generateFlawlessRunCycle();
