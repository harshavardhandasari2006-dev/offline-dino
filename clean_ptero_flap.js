const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function cleanPteroFlap() {
  const { data, info } = await sharp('test_ptero_rot_down2.png').raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const out = Buffer.from(data);

  // Clear stray pixels floating above head/back: x in [45..58], y < 35
  for (let y = 0; y < 35; y++) {
    for (let x = 44; x < 58; x++) {
      const idx = (y * W + x) * 4;
      out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
    }
  }

  // Seal shoulder joint at x in [44..50], y in [34..42] with dark brown bone color:
  // RGB: (110, 65, 35) with outline (50, 30, 20)
  for (let y = 35; y <= 42; y++) {
    for (let x = 46; x <= 52; x++) {
      const idx = (y * W + x) * 4;
      if (out[idx + 3] === 0) {
        out[idx] = 118; out[idx+1] = 68; out[idx+2] = 36; out[idx+3] = 255;
      }
    }
  }

  // Clean perimeter halo
  // Pterodactyl has NO blue: all colors have b < 90
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        const a = out[idx + 3];
        if (a === 0) continue;
        
        let touchesTrans = false;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H || out[(ny * W + nx) * 4 + 3] === 0) {
            touchesTrans = true; break;
          }
        }
        if (touchesTrans) {
          const r = out[idx], g = out[idx+1], b = out[idx+2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (b > 90 || (lum > 165 && b > 85)) {
            out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
          }
        }
      }
    }
  }

  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile('test_ptero_flap_down_clean.png');

  // Compare Frame 0 (Wings Up) and Frame 1 (Wings Down)
  await sharp({
    create: {
      width: W * 2 + 20,
      height: H + 20,
      channels: 4,
      background: { r: 25, g: 35, b: 65, alpha: 1 }
    }
  }).composite([
    { input: 'test_ptero_up.png', left: 5, top: 10 },
    { input: 'test_ptero_flap_down_clean.png', left: W + 15, top: 10 }
  ]).png().toFile('test_ptero_flap_final.png');

  console.log('Saved test_ptero_flap_final.png');
}

cleanPteroFlap();
