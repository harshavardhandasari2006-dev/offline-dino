const sharp = require('sharp');

async function cleanHalos() {
  for (let fIdx = 0; fIdx < 8; fIdx++) {
    const file = `assets/sprites/dino_run_${fIdx}.png`;
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;

    // First pass: identify pixels with alpha > 0
    const alphaMap = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      alphaMap[i] = data[i * 4 + 3];
    }

    // Distance to transparency (0 = transparent, 1 = touches transparent, 2 = 1px inside)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        const a = alphaMap[idx];
        if (a < 30) continue;

        let touchesAlpha = false;
        for (const [dx, dy] of [[1,0], [-1,0], [0,1], [0,-1], [1,1], [-1,-1], [1,-1], [-1,1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H || alphaMap[ny * W + nx] < 30) {
            touchesAlpha = true;
            break;
          }
        }

        if (touchesAlpha) {
          const pIdx = idx * 4;
          const r = data[pIdx], g = data[pIdx + 1], b = data[pIdx + 2];

          // If this edge pixel is bright (white/gray checkerboard remnant)
          // The dinosaur outer border is dark green/black outline (r < 60, g < 75, b < 60).
          // If r > 120 and g > 120 and b > 120, it is 100% a checkerboard halo!
          if (r > 130 && g > 130 && b > 130) {
            // Find the nearest inner dinosaur pixel color to blend with
            let bestR = 25, bestG = 40, bestB = 25;
            for (let dist = 1; dist <= 3; dist++) {
              let found = false;
              for (const [dx, dy] of [[dist, 0], [-dist, 0], [0, dist], [0, -dist]]) {
                const nx = x + dx, ny = y + dy;
                if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
                  const nIdx = (ny * W + nx) * 4;
                  const nr = data[nIdx], ng = data[nIdx + 1], nb = data[nIdx + 2];
                  // If inner pixel is dark outline or green skin
                  if (nr < 90 && ng < 110 && nb < 90) {
                    bestR = nr;
                    bestG = ng;
                    bestB = nb;
                    found = true;
                    break;
                  }
                }
              }
              if (found) break;
            }

            data[pIdx] = bestR;
            data[pIdx + 1] = bestG;
            data[pIdx + 2] = bestB;
            // Also soften alpha slightly for smooth edge
            data[pIdx + 3] = Math.min(a, 200);
          }
        }
      }
    }

    await sharp(data, { raw: { width: W, height: H, channels: 4 } })
      .png()
      .toFile(file);
    console.log(`Cleaned ${file}`);
  }

  // Generate updated strip
  const stripComposites = [];
  for (let i = 0; i < 8; i++) {
    stripComposites.push({
      input: `assets/sprites/dino_run_${i}.png`,
      left: i * 128,
      top: 0
    });
  }

  await sharp({
    create: {
      width: 128 * 8,
      height: 112,
      channels: 4,
      background: { r: 100, g: 150, b: 200, alpha: 1 }
    }
  })
  .composite(stripComposites)
  .toFile('cleaned_8_run_strip.png');

  console.log('Saved cleaned_8_run_strip.png');
}

cleanHalos().catch(console.error);
