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
          // Pterodactyl has NO blue: all colors have b < 90
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (b > 90 || (lum > 165 && (r > 155 && g > 155 && b > 100)) || (a < 180 && (r > 130 || g > 140 || b > 120))) {
            out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
          }
        }
      }
    }
  }
  return out;
}

async function createPteroFrames() {
  const raw0 = await sharp('assets/sprites/pterodactyl_0.png').raw().toBuffer({ resolveWithObject: true });
  const W = raw0.info.width, H = raw0.info.height;
  
  // Clean frame 0 (Wings Up)
  const p0 = cleanHalo(raw0.data, W, H);
  
  // Create frame 1 (Wings Down):
  // We keep: Head, Beak, Torso, Belly, Tail, Feet (everything below y >= 38 and x <= 74)
  // The wing that reaches up into [y < 36, x in 38..96] flaps downward!
  
  const p1 = Buffer.alloc(W * H * 4);
  
  // Copy head, beak, body, feet from p0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      if (p0[idx + 3] === 0) continue;
      
      // Is body/head/feet/tail (not the high up-wing):
      // Head/beak: x <= 38
      // Body/feet: x in [36..74], y >= 38
      const isBodyOrHead = (x <= 38) || (x <= 74 && y >= 38);
      if (isBodyOrHead) {
        p1[idx] = p0[idx];
        p1[idx + 1] = p0[idx + 1];
        p1[idx + 2] = p0[idx + 2];
        p1[idx + 3] = p0[idx + 3];
      }
    }
  }
  
  // Now synthesize the down-wing:
  // The wing extends from shoulder/back (x approx 42..54, y approx 36..42)
  // downwards and backwards to (x approx 75..95, y approx 48..66)
  // Wing arm bone: from (46, 38) -> (68, 52) -> (90, 60)
  // Wing membrane: triangular web between body back (x: 48..70, y: 44..52) and wing bone
  
  // Let's sample colors from p0 wing:
  // Wing arm bone: dark brown (130, 75, 40)
  // Wing membrane: warm orange-yellow (215, 145, 45), shaded (190, 115, 35)
  // Outline: dark (50, 30, 20)
  
  // Draw wing membrane and bone:
  for (let y = 34; y <= 68; y++) {
    for (let x = 40; x <= 96; x++) {
      const idx = (y * W + x) * 4;
      if (p1[idx + 3] > 100) continue; // Don't overwrite existing body
      
      // Parametric shape of down-wing:
      // Top boundary of down-wing: y_top(x) = 36 + (x - 42) * 0.28
      // Bottom boundary of down-wing: y_bot(x) = 46 + (x - 42) * 0.32
      // Wing tip reaches to x = 94, y = 58
      const relX = x - 42;
      if (relX >= 0 && relX <= 52) {
        const topY = 36 + relX * 0.32;
        const botY = 44 + relX * 0.38 + Math.sin(relX / 52 * Math.PI) * 6;
        
        if (y >= topY && y <= botY) {
          const isEdge = (y <= topY + 1.4) || (y >= botY - 1.4) || (relX >= 50);
          const isBone = Math.abs(y - (topY + 2.2)) < 2.0 && relX < 45;
          
          if (isEdge) {
            p1[idx] = 52; p1[idx + 1] = 32; p1[idx + 2] = 20; p1[idx + 3] = 255;
          } else if (isBone) {
            p1[idx] = 135; p1[idx + 1] = 78; p1[idx + 2] = 40; p1[idx + 3] = 255;
          } else {
            // Warm wing membrane with subtle gradient
            const grad = (y - topY) / (botY - topY);
            const r = Math.round(218 - grad * 25);
            const g = Math.round(150 - grad * 35);
            const b = Math.round(48 - grad * 15);
            p1[idx] = r; p1[idx + 1] = g; p1[idx + 2] = b; p1[idx + 3] = 255;
          }
        }
      }
    }
  }
  
  // Clean halo on both
  const cp0 = cleanHalo(p0, W, H);
  const cp1 = cleanHalo(p1, W, H);
  
  await sharp(cp0, { raw: { width: W, height: H, channels: 4 } }).png().toFile('test_ptero_up.png');
  await sharp(cp1, { raw: { width: W, height: H, channels: 4 } }).png().toFile('test_ptero_down.png');
  
  // Compare side-by-side on night blue
  await sharp({
    create: {
      width: W * 2 + 20,
      height: H + 20,
      channels: 4,
      background: { r: 25, g: 35, b: 65, alpha: 1 }
    }
  }).composite([
    { input: 'test_ptero_up.png', left: 5, top: 10 },
    { input: 'test_ptero_down.png', left: W + 15, top: 10 }
  ]).png().toFile('test_ptero_compare.png');
  
  console.log('Saved test_ptero_compare.png');
}

createPteroFrames();
