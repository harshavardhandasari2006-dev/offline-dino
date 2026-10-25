const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function cleanAndSaveSprite(srcPath, outPaths) {
  const img = sharp(srcPath);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const isBg = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);

  // 1. Identify all background components (outer border + enclosed pockets between branches)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx]) continue;
      const pIdx = idx * channels;
      if (Math.max(data[pIdx], data[pIdx + 1], data[pIdx + 2]) <= 12) {
        const queue = [x, y];
        const comp = [idx];
        visited[idx] = 1;
        let head = 0;
        let touchesBorder = false;
        let minX = x, maxX = x, minY = y, maxY = y;

        while (head < queue.length) {
          const qx = queue[head++];
          const qy = queue[head++];
          if (qx === 0 || qx === width - 1 || qy === 0 || qy === height - 1) touchesBorder = true;
          if (qx < minX) minX = qx;
          if (qx > maxX) maxX = qx;
          if (qy < minY) minY = qy;
          if (qy > maxY) maxY = qy;

          const nbs = [[qx - 1, qy], [qx + 1, qy], [qx, qy - 1], [qx, qy + 1]];
          for (const [nx, ny] of nbs) {
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (!visited[nIdx]) {
                const npIdx = nIdx * channels;
                if (Math.max(data[npIdx], data[npIdx + 1], data[npIdx + 2]) <= 12) {
                  visited[nIdx] = 1;
                  queue.push(nx, ny);
                  comp.push(nIdx);
                }
              }
            }
          }
        }

        const compW = maxX - minX + 1;
        const compH = maxY - minY + 1;

        // Marked as background if it touches border OR is a substantial pocket between cacti
        if (touchesBorder || comp.length >= 80 || (compW >= 8 && compH >= 8)) {
          for (const cIdx of comp) {
            isBg[cIdx] = 1;
          }
        }
      }
    }
  }

  // 2. Expand background slightly into anti-aliased transition edges (up to brightness 28)
  const expandedBg = new Uint8Array(isBg);
  for (let iter = 0; iter < 3; iter++) {
    const nextBg = new Uint8Array(expandedBg);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (!expandedBg[idx]) {
          const hasBgNeighbor = (x > 0 && expandedBg[idx - 1]) ||
                                (x < width - 1 && expandedBg[idx + 1]) ||
                                (y > 0 && expandedBg[idx - width]) ||
                                (y < height - 1 && expandedBg[idx + width]);
          if (hasBgNeighbor) {
            const pIdx = idx * channels;
            const maxVal = Math.max(data[pIdx], data[pIdx + 1], data[pIdx + 2]);
            if (maxVal <= 28) {
              nextBg[idx] = 1;
            }
          }
        }
      }
    }
    expandedBg.set(nextBg);
  }

  // 3. Construct transparent RGBA buffer
  const outBuf = Buffer.alloc(width * height * 4);
  let minArtX = width, maxArtX = 0, minArtY = height, maxArtY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const pIdx = idx * channels;
      const oIdx = idx * 4;

      const r = data[pIdx], g = data[pIdx + 1], b = data[pIdx + 2];
      const maxVal = Math.max(r, g, b);

      if (expandedBg[idx]) {
        if (maxVal <= 12) {
          outBuf[oIdx + 3] = 0;
        } else {
          // Smooth anti-aliased edge
          const alphaFactor = (maxVal - 12) / (28 - 12);
          const alpha = Math.min(255, Math.max(0, Math.round(alphaFactor * 255)));
          outBuf[oIdx] = r;
          outBuf[oIdx + 1] = g;
          outBuf[oIdx + 2] = b;
          outBuf[oIdx + 3] = alpha;
          if (alpha > 30) {
            if (x < minArtX) minArtX = x;
            if (x > maxArtX) maxArtX = x;
            if (y < minArtY) minArtY = y;
            if (y > maxArtY) maxArtY = y;
          }
        }
      } else {
        outBuf[oIdx] = r;
        outBuf[oIdx + 1] = g;
        outBuf[oIdx + 2] = b;
        outBuf[oIdx + 3] = 255;
        if (x < minArtX) minArtX = x;
        if (x > maxArtX) maxArtX = x;
        if (y < minArtY) minArtY = y;
        if (y > maxArtY) maxArtY = y;
      }
    }
  }

  const cropW = maxArtX - minArtX + 1;
  const cropH = maxArtY - minArtY + 1;
  console.log(`Extracted artwork bounds: ${cropW}x${cropH} at (${minArtX}, ${minArtY})`);

  const pngBuffer = await sharp(outBuf, { raw: { width, height, channels: 4 } })
    .extract({ left: minArtX, top: minArtY, width: cropW, height: cropH })
    .png()
    .toBuffer();

  for (const outPath of outPaths) {
    fs.writeFileSync(outPath, pngBuffer);
    console.log(`  ✓ Saved ${outPath} (${(pngBuffer.length / 1024).toFixed(1)} KB)`);
  }
}

async function main() {
  console.log('====================================================');
  console.log('  GENERATING MASTER CACTUS SPRITE ASSETS');
  console.log('====================================================\n');

  const uploadDir = 'C:\\Users\\asus\\.gemini\\antigravity-ide\\brain\\1c3e5139-b62e-4146-8621-13708d351c51\\.user_uploaded\\';
  const spritesDir = path.join(__dirname, 'assets', 'sprites');

  // 1. Image 1: Single cactus
  console.log('[1/3] Processing Single Cactus (Image 1)...');
  await cleanAndSaveSprite(
    path.join(uploadDir, 'media_1792289833023.jpg'),
    [
      path.join(spritesDir, 'cactus_single.png'),
      path.join(spritesDir, 'cactus_small.png')
    ]
  );

  // 2. Image 2: Two-cactus obstacle
  console.log('\n[2/3] Processing Two-Cactus Obstacle (Image 2)...');
  await cleanAndSaveSprite(
    path.join(uploadDir, 'media_1792289848036.jpg'),
    [
      path.join(spritesDir, 'cactus_double.png')
    ]
  );

  // 3. Image 3: Three-cactus obstacle
  console.log('\n[3/3] Processing Three-Cactus Obstacle (Image 3)...');
  await cleanAndSaveSprite(
    path.join(uploadDir, 'media_1792289875810.jpg'),
    [
      path.join(spritesDir, 'cactus_triple.png'),
      path.join(spritesDir, 'cactus_tall.png')
    ]
  );

  console.log('\n====================================================');
  console.log('  ALL MASTER CACTUS SPRITES GENERATED SUCCESSFULLY!');
  console.log('====================================================');
}

main().catch(err => {
  console.error('Error generating cactus sprites:', err);
  process.exit(1);
});
