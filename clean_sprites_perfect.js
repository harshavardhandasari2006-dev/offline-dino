const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function cleanSprite(inputPath, outputPath, options = {}) {
  const img = sharp(inputPath);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;

  const mask = new Uint8Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];

      if (a < 20) {
        mask[y * w + x] = 0;
        continue;
      }

      // Check for peach ground / shadow fragments
      const isPeachGround = (r > 190 && r > g + 15 && r > b + 35 && g > 110 && (y > h * 0.55 || options.isDead));
      const isGroundShadow = (r > 140 && r < 210 && g > 100 && g < 165 && b > 80 && b < 140 && r > g + 25 && y > h * 0.65);
      const isSkyCloud = (b > r + 15 && b > 180) || (r > 235 && g > 235 && b > 235 && y < h * 0.5);
      const isMesa = (r > 180 && g < 185 && b < 185 && r > g + 25 && r > b + 25 && y > h * 0.5 && !options.isDead);

      // Definite dinosaur features that must NEVER be removed:
      const isGreen = (g > r + 10 && g > b + 10 && g > 50) || (g > 90 && g > r && g > b + 15);
      const isBelly = (r > 180 && g > 175 && b < 200 && Math.abs(r - g) < 20 && r > b + 20 && y < h * 0.85);
      const isSpine = (r < 75 && g < 85 && b < 75);
      const isMouth = (r > 130 && g < 115 && b < 125 && r > g + 20);
      const isStar = options.isDead && (r > 200 && g > 165 && b < 115 && y < h * 0.4);

      if (isGreen || isBelly || isSpine || isMouth || isStar) {
        mask[y * w + x] = 1; // Keep
      } else if (isPeachGround || isGroundShadow || isSkyCloud || isMesa) {
        mask[y * w + x] = 0; // Remove
      } else {
        // Neutral/toe claw/outline
        mask[y * w + x] = 1;
      }
    }
  }

  // Connected components to remove floating debris
  // Find largest component (main body)
  const labels = new Int32Array(w * h).fill(-1);
  const componentSizes = [];
  let currentLabel = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (mask[idx] === 1 && labels[idx] === -1) {
        // BFS for this component
        let size = 0;
        const queue = [idx];
        labels[idx] = currentLabel;

        let qHead = 0;
        while (qHead < queue.length) {
          const cIdx = queue[qHead++];
          size++;
          const cx = cIdx % w;
          const cy = Math.floor(cIdx / w);

          const neighbors = [
            [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]
          ];
          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const nIdx = ny * w + nx;
              if (mask[nIdx] === 1 && labels[nIdx] === -1) {
                labels[nIdx] = currentLabel;
                queue.push(nIdx);
              }
            }
          }
        }
        componentSizes.push(size);
        currentLabel++;
      }
    }
  }

  // Find max component (dino body)
  let maxIdx = 0, maxSize = 0;
  for (let i = 0; i < componentSizes.length; i++) {
    if (componentSizes[i] > maxSize) {
      maxSize = componentSizes[i];
      maxIdx = i;
    }
  }

  // Keep main body, plus for dead dino keep stars/spirals (size > 15 near top-right)
  const outBuf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const lbl = labels[idx];
      const outIdx = idx * 4;

      let keep = false;
      if (lbl === maxIdx) {
        keep = true;
      } else if (options.isDead && lbl !== -1) {
        // For dead dino, keep star and spiral if y < h * 0.45 and size >= 10
        if (y < h * 0.45 && componentSizes[lbl] >= 8) {
          keep = true;
        }
      }

      if (keep) {
        outBuf[outIdx] = data[outIdx];
        outBuf[outIdx + 1] = data[outIdx + 1];
        outBuf[outIdx + 2] = data[outIdx + 2];
        outBuf[outIdx + 3] = data[outIdx + 3];
      } else {
        outBuf[outIdx] = 0;
        outBuf[outIdx + 1] = 0;
        outBuf[outIdx + 2] = 0;
        outBuf[outIdx + 3] = 0;
      }
    }
  }

  // Trim transparent padding
  const trimmed = await sharp(outBuf, { raw: { width: w, height: h, channels: 4 } })
    .trim()
    .raw()
    .toBuffer({ resolveWithObject: true });

  await sharp(trimmed.data, { raw: { width: trimmed.info.width, height: trimmed.info.height, channels: 4 } })
    .png()
    .toFile(outputPath);

  console.log(`Cleaned ${path.basename(outputPath)}: ${trimmed.info.width}x${trimmed.info.height}`);
}

async function run() {
  const dir = 'assets/sprites';
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (!f.endsWith('.png') || f.startsWith('bg_') || f.startsWith('cactus_')) continue;
    const isDead = f === 'dino_dead.png';
    await cleanSprite(path.join(dir, f), path.join(dir, f), { isDead });
  }
}

run();
