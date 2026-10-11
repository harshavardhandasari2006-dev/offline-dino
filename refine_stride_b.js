const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function refineStrideB() {
  const { data: d1, info } = await sharp('assets/sprites/dino_run_1.png').raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  
  // Base is clean run 1
  const out = Buffer.from(d1);
  
  // Belly pixels have: r > 180, g > 165, b < 160, r - b >= 30, and y < 86
  // Tail pixels have: x < 32 and y < 82
  // We identify leg pixels:
  // Green skin: (g > r + 10 && g > b + 20) or (g > 90 && g > b + 15)
  // Toenails: y >= 95 && r > 180 && g > 175
  // Outline: r < 60 && g < 60 && b < 60
  
  // Front leg limb mask in run 1:
  // Connected green/outline/claws below hip at y >= 78, x in [26..50]
  // Rear leg limb mask in run 1:
  // Connected green/outline/claws below hip at y >= 78, x in [50..80]
  
  const frontLegMask = new Uint8Array(W * H);
  const rearLegMask = new Uint8Array(W * H);
  
  for (let y = 78; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      if (d1[idx + 3] === 0) continue;
      
      const r = d1[idx], g = d1[idx + 1], b = d1[idx + 2];
      const isBelly = (r > 180 && g > 165 && b < 160 && (r - b >= 30) && y < 86);
      const isTail = (x < 28 && y < 82);
      if (isBelly || isTail) continue;
      
      // Classify front leg vs rear leg
      if (x <= 48 && (y >= 82 || (y >= 78 && x <= 46))) {
        frontLegMask[y * W + x] = 1;
      } else if (x > 48 && y >= 78) {
        rearLegMask[y * W + x] = 1;
      }
    }
  }
  
  // Create Frame 3 (Stride B: Rear leg forward, Front leg back):
  // Start with clean run 1
  const f3 = Buffer.from(d1);
  
  // Clear the leg pixels from f3
  for (let y = 78; y < H; y++) {
    for (let x = 24; x <= 82; x++) {
      const idx = y * W + x;
      if (frontLegMask[idx] === 1 || rearLegMask[idx] === 1) {
        f3[idx * 4] = 0;
        f3[idx * 4 + 1] = 0;
        f3[idx * 4 + 2] = 0;
        f3[idx * 4 + 3] = 0;
      }
    }
  }
  
  // Now place rear leg in front (shifted to front leg foot baseline x in [30..44], y=103):
  // Rear leg in run 1 was at x in [52..74], y in [78..103]
  // Front leg in run 1 was at x in [28..46], y in [78..103]
  // In Frame 3:
  // Rear leg swings forward: x_new = x_front_equiv = x - 22
  // Front leg swings backward: x_new = x_rear_equiv = x + 24
  
  // Draw the far leg in forward position (drawn first, behind body)
  for (let y = 78; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (frontLegMask[idx] === 1) {
        // Front leg shape rendered as rear leg (shifted backward)
        const destX = x + 24;
        const destY = y - 4; // lifted slightly in rear stride
        if (destX < W && destY < H && destY >= 74) {
          const destIdx = (destY * W + destX) * 4;
          const srcIdx = idx * 4;
          // Far leg shading (slightly deeper)
          let r = d1[srcIdx], g = d1[srcIdx + 1], b = d1[srcIdx + 2];
          if (g > 100 && !(r > 180 && g > 180)) {
            r = Math.round(r * 0.92);
            g = Math.round(g * 0.94);
            b = Math.round(b * 0.92);
          }
          f3[destIdx] = r;
          f3[destIdx + 1] = g;
          f3[destIdx + 2] = b;
          f3[destIdx + 3] = d1[srcIdx + 3];
        }
      }
    }
  }
  
  // Draw the near leg in forward position (foot planted firmly on y=103)
  for (let y = 78; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (rearLegMask[idx] === 1) {
        // Rear leg shape rendered forward to ground baseline y=103
        const destX = x - 22;
        const destY = Math.min(103, y + 2); // perfectly touches ground y=103
        if (destX >= 0 && destX < W && destY < H) {
          const destIdx = (destY * W + destX) * 4;
          const srcIdx = idx * 4;
          // Near leg highlights (bright vibrant green)
          let r = d1[srcIdx], g = d1[srcIdx + 1], b = d1[srcIdx + 2];
          if (g > 70 && !(r > 180 && g > 180)) {
            r = Math.min(255, Math.round(r * 1.08));
            g = Math.min(255, Math.round(g * 1.08));
          }
          f3[destIdx] = r;
          f3[destIdx + 1] = g;
          f3[destIdx + 2] = b;
          f3[destIdx + 3] = d1[srcIdx + 3];
        }
      }
    }
  }
  
  // Ensure ground row 103 has solid foot contact
  for (let x = 32; x <= 44; x++) {
    const idx = (103 * W + x) * 4;
    const aboveIdx = (102 * W + x) * 4;
    if (f3[aboveIdx + 3] > 100 && f3[idx + 3] === 0) {
      f3[idx] = f3[aboveIdx];
      f3[idx + 1] = f3[aboveIdx + 1];
      f3[idx + 2] = f3[aboveIdx + 2];
      f3[idx + 3] = 255;
    }
  }

  await sharp(f3, { raw: { width: W, height: H, channels: 4 } }).png().toFile('test_refined_stride_b.png');
  console.log('Saved test_refined_stride_b.png');
}

refineStrideB();
