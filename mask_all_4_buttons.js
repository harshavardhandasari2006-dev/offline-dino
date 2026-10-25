const sharp = require('sharp');
const fs = require('fs');

async function maskButtons() {
  const buttons = [
    { name: 'skins', file: 'scratch_ref_btn1_skins.png', w: 204, h: 100 },
    { name: 'highscore', file: 'scratch_ref_btn2_highscore.png', w: 202, h: 100 },
    { name: 'sound', file: 'scratch_ref_btn3_sound.png', w: 202, h: 100 },
    { name: 'exit', file: 'scratch_ref_btn4_exit.png', w: 224, h: 100 }
  ];

  for (const b of buttons) {
    const { data } = await sharp(b.file).raw().toBuffer({ resolveWithObject: true });
    const w = b.w, h = b.h;
    const mask = new Uint8Array(w * h);
    mask.fill(1); // 1 = foreground, 0 = background

    // Exterior BFS flood-fill from top border (y=0) and outer corners
    // In Screenshot 2, at y=0, any pixel that is NOT cactus or stone pedestal is mountain/sky:
    function isBgPixel(x, y) {
      if (y >= 50) return false; // Bottom half is definitely button / frame / pebbles
      const idx = (y * w + x) * 3;
      const r = data[idx], g = data[idx+1], b = data[idx+2];

      // Cactus is green:
      const isGreen = (g > 65 && g > r * 1.15 && g > b);
      const isDarkSpine = (g > r && g > b && g < 100 && r < 60);
      if (isGreen || isDarkSpine) return false;

      // Stone frame has warm brown/tan:
      // Inner cream plate: r > 210, g > 200, b > 170
      // Stone frame border / face: r > 100, g > 50, b < 90, r > b + 35
      // Dark border: r < 70, g < 45, b < 35, r >= b
      const isCream = (r > 200 && g > 190 && b > 160 && r >= g && g >= b);
      const isStone = (r > 90 && g > 45 && b < 100 && r > b + 30);
      const isDarkBorder = (r < 65 && g < 40 && b < 35 && r >= b);
      
      // On High Score & Sound, at top (y < 20), there are stone pedestals:
      // Stone pedestals are also tan/brown rock (r > 100, g > 55, b < 100, r > b + 30)
      if (isCream || isStone || isDarkBorder) return false;

      // Otherwise, it's mountain / sky background:
      // Mountain is purple/blue/orange: high b, or r and b high with low g (purplish), or blue sky
      return true;
    }

    // Seed top border
    const queue = [];
    for (let x = 0; x < w; x++) {
      if (isBgPixel(x, 0)) {
        mask[x] = 0;
        queue.push(x, 0);
      }
    }
    // Seed left/right outer corners for y < 35
    for (let y = 0; y < 35; y++) {
      if (isBgPixel(0, y) && mask[y * w] === 1) {
        mask[y * w] = 0;
        queue.push(0, y);
      }
      if (isBgPixel(w - 1, y) && mask[y * w + w - 1] === 1) {
        mask[y * w + w - 1] = 0;
        queue.push(w - 1, y);
      }
    }

    // BFS
    let head = 0;
    while (head < queue.length) {
      const cx = queue[head++];
      const cy = queue[head++];
      const nbs = [[cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]];
      for (const [nx, ny] of nbs) {
        if (nx >= 0 && nx < w && ny >= 0 && ny < 50) {
          const nidx = ny * w + nx;
          if (mask[nidx] === 1 && isBgPixel(nx, ny)) {
            mask[nidx] = 0;
            queue.push(nx, ny);
          }
        }
      }
    }

    // Build RGBA output
    const out = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const idx3 = i * 3;
      const idx4 = i * 4;
      out[idx4] = data[idx3];
      out[idx4 + 1] = data[idx3 + 1];
      out[idx4 + 2] = data[idx3 + 2];
      out[idx4 + 3] = mask[i] === 1 ? 255 : 0;
    }

    // Anti-alias edge: soften transition between alpha=255 and alpha=0
    for (let y = 1; y < 49; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (mask[idx] === 0) {
          // Check if adjacent to fg
          const hasFg = (mask[idx+1] === 1 || mask[idx-1] === 1 || mask[idx+w] === 1 || mask[idx-w] === 1);
          if (hasFg) {
            out[idx * 4 + 3] = 90;
          }
        }
      }
    }

    const outPath = `assets/sprites/btn_home_${b.name}_frame.png`;
    await sharp(out, { raw: { width: w, height: h, channels: 4 } })
      .png()
      .toFile(outPath);
    console.log(`Saved ${outPath}`);

    // If it's sound, also create sound_off frame
    if (b.name === 'sound') {
      // Create sound_off by replacing the text "ON" with "OFF" or sound wave
      // Let's create sound_off with identical clean frame
      const soundOffOut = Buffer.from(out);
      // In Sound button: text "ON" is at x: 130 to 175, y: 50 to 75
      // Speaker icon wave is at x: 80 to 95, y: 40 to 65
      // Draw red diagonal slash on speaker wave
      for (let y = 42; y <= 66; y++) {
        for (let x = 60; x <= 95; x++) {
          if (Math.abs((x - 60) - (y - 42) * 1.4) < 3.0) {
            const idx4 = (y * w + x) * 4;
            soundOffOut[idx4] = 230;
            soundOffOut[idx4 + 1] = 45;
            soundOffOut[idx4 + 2] = 45;
            soundOffOut[idx4 + 3] = 255;
          }
        }
      }
      // Also clear "ON" and write "OFF"
      // Or save sound_off
      await sharp(soundOffOut, { raw: { width: w, height: h, channels: 4 } })
        .png()
        .toFile('assets/sprites/btn_home_sound_off_frame.png');
      console.log('Saved assets/sprites/btn_home_sound_off_frame.png');
    }
  }
}
maskButtons();
