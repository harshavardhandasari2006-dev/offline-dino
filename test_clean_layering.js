const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Clean sky/halo from an image buffer
function cleanHalo(buf, w, h) {
  const out = Buffer.from(buf);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const a = out[idx + 3];
        if (a === 0) continue;
        
        let touchesTrans = false;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h || out[(ny * w + nx) * 4 + 3] === 0) {
            touchesTrans = true; break;
          }
        }
        
        if (touchesTrans) {
          const r = out[idx], g = out[idx+1], b = out[idx+2];
          if (y >= 94 && r > 180 && g > 170 && b < 150 && (r - b >= 30)) continue;
          if (r > 195 && g > 180 && b < 155 && (r - b >= 40)) continue;
          
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if ((b > 115 && lum > 135) || (r > 155 && g > 165 && b > 135) || (lum > 170 && b > 100) || b > 130 || (a < 180 && (r > 130 || g > 140 || b > 120))) {
            out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
          }
        }
      }
    }
  }
  return out;
}

async function testCleanLayering() {
  const rawRun1 = await sharp('assets/sprites/dino_run_1.png').raw().toBuffer({ resolveWithObject: true });
  const rawIdle0 = await sharp('assets/sprites/dino_idle_0.png').raw().toBuffer({ resolveWithObject: true });
  const W = 128, H = 112;
  
  const dRun1 = cleanHalo(rawRun1.data, W, H);
  const dIdle0 = cleanHalo(rawIdle0.data, W, H);
  
  // Let's create:
  // Frame 1: Stride A (Left leg forward, Right leg back) -> directly dRun1
  // Frame 3: Stride B (Right leg forward, Left leg back)
  
  // In dRun1:
  // Forward leg limb: x in [26..46], y in [76..103]
  // Backward leg limb: x in [52..76], y in [76..103]
  
  // To create Frame 3 without cutting any torso:
  // Take dRun1.
  // The torso, head, arms, back, tail, and cream belly are 100% kept.
  // We want the leg shapes to swap:
  // The leg at [26..46] should now appear at [52..76] (rearward stride).
  // The leg at [52..76] should now appear at [26..46] (forward stride).
  
  const f1 = Buffer.from(dRun1);
  const f3 = Buffer.from(dRun1);
  
  // Extract forward leg patch from dRun1:
  // It's the green pixels at x in [26..47], y in [78..103]
  // Extract rear leg patch from dRun1:
  // It's the green pixels at x in [52..76], y in [78..103]
  
  const forwardPatch = [];
  const rearPatch = [];
  
  for (let y = 76; y <= 103; y++) {
    for (let x = 24; x <= 80; x++) {
      const idx = (y * W + x) * 4;
      if (dRun1[idx + 3] === 0) continue;
      
      const r = dRun1[idx], g = dRun1[idx+1], b = dRun1[idx+2];
      // Skip cream belly
      if (r > 185 && g > 170 && b < 165 && (r - b >= 28)) continue;
      // Skip tail
      if (x < 28 && y < 80) continue;
      
      if (x <= 48) {
        forwardPatch.push({ x, y, r, g, b, a: dRun1[idx + 3] });
      } else {
        rearPatch.push({ x, y, r, g, b, a: dRun1[idx + 3] });
      }
    }
  }
  
  // In f3, erase only the pixels belonging to the two patches:
  for (const p of forwardPatch) {
    const idx = (p.y * W + p.x) * 4;
    f3[idx] = 0; f3[idx+1] = 0; f3[idx+2] = 0; f3[idx+3] = 0;
  }
  for (const p of rearPatch) {
    const idx = (p.y * W + p.x) * 4;
    f3[idx] = 0; f3[idx+1] = 0; f3[idx+2] = 0; f3[idx+3] = 0;
  }
  
  // Now place rearPatch forward (shifted by dx = -24, dy = +2 so foot reaches 103):
  for (const p of rearPatch) {
    const nx = p.x - 24;
    const ny = Math.min(103, p.y + 2);
    if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
      const idx = (ny * W + nx) * 4;
      // Shade as far leg reaching forward
      let r = p.r, g = p.g, b = p.b;
      if (g > 80 && !(r > 180 && g > 180)) {
        r = Math.round(r * 0.94);
        g = Math.round(g * 0.96);
        b = Math.round(b * 0.94);
      }
      f3[idx] = r; f3[idx+1] = g; f3[idx+2] = b; f3[idx+3] = p.a;
    }
  }
  
  // Now place forwardPatch backward (shifted by dx = +24, dy = -2 so foot is slightly lifted):
  for (const p of forwardPatch) {
    const nx = p.x + 24;
    const ny = p.y - 2;
    if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
      const idx = (ny * W + nx) * 4;
      // Near leg highlight
      let r = p.r, g = p.g, b = p.b;
      if (g > 80 && !(r > 180 && g > 180)) {
        r = Math.min(255, Math.round(r * 1.05));
        g = Math.min(255, Math.round(g * 1.05));
      }
      f3[idx] = r; f3[idx+1] = g; f3[idx+2] = b; f3[idx+3] = p.a;
    }
  }
  
  // Solidify contact baseline y=103 for forward foot
  for (let x = 28; x <= 46; x++) {
    const idx103 = (103 * W + x) * 4;
    const idx102 = (102 * W + x) * 4;
    if (f3[idx102 + 3] > 80 && f3[idx103 + 3] === 0) {
      f3[idx103] = f3[idx102];
      f3[idx103+1] = f3[idx102+1];
      f3[idx103+2] = f3[idx102+2];
      f3[idx103+3] = 255;
    }
  }

  // Create Transition 1 (Frame 2):
  // Legs passing mid-stride: Left foot planted at baseline y=103 under center (x in [35..50])
  // Right leg passing forward with knee bent
  const f2 = Buffer.from(dIdle0);
  // Create Transition 2 (Frame 4):
  // Opposite passing frame
  const f4 = Buffer.from(dIdle0);

  // Clean all frames
  const cf1 = cleanHalo(f1, W, H);
  const cf2 = cleanHalo(f2, W, H);
  const cf3 = cleanHalo(f3, W, H);
  const cf4 = cleanHalo(f4, W, H);

  await sharp(cf1, { raw: { width: W, height: H, channels: 4 } }).png().toFile('test_cf1.png');
  await sharp(cf2, { raw: { width: W, height: H, channels: 4 } }).png().toFile('test_cf2.png');
  await sharp(cf3, { raw: { width: W, height: H, channels: 4 } }).png().toFile('test_cf3.png');
  await sharp(cf4, { raw: { width: W, height: H, channels: 4 } }).png().toFile('test_cf4.png');

  await sharp({
    create: {
      width: W * 4 + 20,
      height: H + 20,
      channels: 4,
      background: { r: 77, g: 166, b: 255, alpha: 1 }
    }
  }).composite([
    { input: 'test_cf1.png', left: 5, top: 10 },
    { input: 'test_cf2.png', left: W + 10, top: 10 },
    { input: 'test_cf3.png', left: W * 2 + 15, top: 10 },
    { input: 'test_cf4.png', left: W * 3 + 20, top: 10 }
  ]).png().toFile('test_four_phases.png');

  console.log('Saved test_four_phases.png');
}

testCleanLayering();
