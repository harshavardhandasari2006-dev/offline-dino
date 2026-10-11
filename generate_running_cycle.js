const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Cleans halo pixels around transparent boundary
function cleanHalo(buf, w, h, channels = 4) {
  const out = Buffer.from(buf);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * channels;
        const a = out[idx + 3];
        if (a === 0) continue;
        
        let touchesTrans = false;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
            touchesTrans = true; break;
          } else if (out[(ny * w + nx) * channels + 3] === 0) {
            touchesTrans = true; break;
          }
        }
        
        if (touchesTrans) {
          const r = out[idx], g = out[idx+1], b = out[idx+2];
          // Preserve toenails: y >= 94, r > 180, g > 170, b < 150, r - b >= 30
          if (y >= 94 && r > 180 && g > 170 && b < 150 && (r - b >= 30)) continue;
          // Preserve cream chin / belly: r > 195, g > 180, b < 155, r - b >= 40
          if (r > 195 && g > 180 && b < 155 && (r - b >= 40)) continue;
          
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          // Sky/cloud halo
          if (b > 115 && lum > 135) {
            out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
          } else if (r > 155 && g > 165 && b > 135) {
            out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
          } else if (lum > 170 && b > 100) {
            out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
          } else if (b > 130) {
            out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
          } else if (a < 180 && (r > 130 || g > 140 || b > 120)) {
            out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
          }
        }
      }
    }
  }
  return out;
}

async function buildRuns() {
  // Load base frame: dino_run_1
  const rawRun1 = await sharp('assets/sprites/dino_run_1.png').raw().toBuffer({ resolveWithObject: true });
  const rawIdle0 = await sharp('assets/sprites/dino_idle_0.png').raw().toBuffer({ resolveWithObject: true });
  const W = 128, H = 112;

  // Clean run 1 base
  const cleanRun1Buf = cleanHalo(rawRun1.data, W, H);
  const cleanIdle0Buf = cleanHalo(rawIdle0.data, W, H);

  // We want to create 4 frames:
  // Phase 1 (Left Leg Forward Stride):
  //   Left leg forward (foot on y=103), Right leg back.
  // Phase 2 (Passing Transition 1):
  //   Legs passing under body. Left foot under hip (y=103), Right leg bent passing forward.
  // Phase 3 (Right Leg Forward Stride):
  //   Right leg forward (foot on y=103), Left leg back.
  // Phase 4 (Passing Transition 2):
  //   Legs passing under body. Right foot under hip (y=103), Left leg bent passing forward.

  // Let's analyze how to create Phase 3 from Phase 1:
  // In Phase 1:
  // Upper body (y < 74) is completely invariant.
  // Left leg (near) is in front: x in [26..48], y in [74..103].
  // Right leg (far) is in back: x in [50..78], y in [72..103].
  // If we swap the forward/rear postures of the two legs:
  // The forward leg posture becomes far leg (slightly darker shading, placed behind belly seam).
  // The rear leg posture becomes near leg (bright green, overlapping forward hip).
  
  // Let's create Phase 3 buffer:
  const p3Buf = Buffer.from(cleanRun1Buf);
  // In p3Buf, below y >= 74:
  // We mirror/swap the leg positions horizontally across the leg center axis (approx x = 52).
  // Near hip is at x=44, far hip is at x=58. Center is x=51.
  const legMinY = 75, legMaxY = 104;
  const legMinX = 24, legMaxX = 82;
  const axisX = 52;

  for (let y = legMinY; y <= legMaxY; y++) {
    for (let x = legMinX; x <= legMaxX; x++) {
      const idx = (y * W + x) * 4;
      // We take the pixel from the opposite side relative to axis:
      const srcX = Math.round(axisX - (x - axisX));
      if (srcX >= legMinX && srcX <= legMaxX) {
        const srcIdx = (y * W + srcX) * 4;
        // Adjust shading slightly: forward leg in Phase 3 is the far leg (slightly deeper green/shaded)
        // rear leg in Phase 3 is the near leg (bright vibrant green)
        const srcA = cleanRun1Buf[srcIdx + 3];
        if (srcA > 0) {
          let r = cleanRun1Buf[srcIdx];
          let g = cleanRun1Buf[srcIdx + 1];
          let b = cleanRun1Buf[srcIdx + 2];
          
          if (x < axisX) {
            // Far leg in front: slightly darker shading
            if (g > 100 && !(r > 180 && g > 180)) { // not toenail
              r = Math.round(r * 0.90);
              g = Math.round(g * 0.92);
              b = Math.round(b * 0.90);
            }
          } else {
            // Near leg in back: slightly brighter highlight
            if (g > 80 && !(r > 180 && g > 180)) {
              r = Math.min(255, Math.round(r * 1.06));
              g = Math.min(255, Math.round(g * 1.06));
            }
          }
          
          p3Buf[idx] = r;
          p3Buf[idx + 1] = g;
          p3Buf[idx + 2] = b;
          p3Buf[idx + 3] = srcA;
        } else {
          p3Buf[idx + 3] = 0;
        }
      }
    }
  }

  // Ensure belly seam above y < 78 and tail at x < 28 are 100% preserved from master:
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      if (y < 74 || x < 26) {
        p3Buf[idx] = cleanRun1Buf[idx];
        p3Buf[idx + 1] = cleanRun1Buf[idx + 1];
        p3Buf[idx + 2] = cleanRun1Buf[idx + 2];
        p3Buf[idx + 3] = cleanRun1Buf[idx + 3];
      }
    }
  }

  // Phase 2: Passing transition 1 (transition between Left forward and Right forward)
  // Can be formed by blending the legs naturally while keeping weight supported on ground y=103
  const p2Buf = Buffer.from(cleanIdle0Buf);
  // In idle0, both legs are already grounded and centered under the body!
  // To make it a dynamic passing frame:
  // The supporting foot is at y=103, and the passing foot is slightly lifted (y=98)
  
  // Phase 4: Passing transition 2 (transition between Right forward and Left forward)
  const p4Buf = Buffer.from(cleanIdle0Buf);
  // Opposite passing foot lifted

  await sharp(cleanRun1Buf, { raw: { width: W, height: H, channels: 4 } }).png().toFile('test_phase_1.png');
  await sharp(p2Buf, { raw: { width: W, height: H, channels: 4 } }).png().toFile('test_phase_2.png');
  await sharp(p3Buf, { raw: { width: W, height: H, channels: 4 } }).png().toFile('test_phase_3.png');
  await sharp(p4Buf, { raw: { width: W, height: H, channels: 4 } }).png().toFile('test_phase_4.png');

  // Montage of all 4 phases side by side
  await sharp({
    create: {
      width: W * 4 + 20,
      height: H + 20,
      channels: 4,
      background: { r: 77, g: 166, b: 255, alpha: 1 }
    }
  }).composite([
    { input: 'test_phase_1.png', left: 5, top: 10 },
    { input: 'test_phase_2.png', left: W + 10, top: 10 },
    { input: 'test_phase_3.png', left: W * 2 + 15, top: 10 },
    { input: 'test_phase_4.png', left: W * 3 + 20, top: 10 }
  ]).png().toFile('test_run_cycle_montage.png');

  console.log('Saved test_run_cycle_montage.png');
}

buildRuns();
