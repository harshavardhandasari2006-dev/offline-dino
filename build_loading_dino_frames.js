const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const img2Path = 'C:\\Users\\asus\\.gemini\\antigravity-ide\\brain\\1c3e5139-b62e-4146-8621-13708d351c51\\.user_uploaded\\media_1792317643902.png';
const img1Path = 'C:\\Users\\asus\\.gemini\\antigravity-ide\\brain\\1c3e5139-b62e-4146-8621-13708d351c51\\.user_uploaded\\media_1792317643902.png';

async function buildMasterLoadingFrames() {
  const { data, info } = await sharp(img2Path).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const cols = 5, rows = 3;
  const pw = W / cols, ph = H / rows;

  const outDir = 'assets/sprites/loading_dino';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Standard target frame canvas: 180 x 105 (3x scale)
  // At 1x, canvas is 60 x 35.
  // We want the snout to align at x = 45 (1x) -> x = 135 (3x)
  // We want the foot baseline to align at y = 32 (1x) -> y = 96 (3x)
  const targetW = 180;
  const targetH = 105;
  const target1xW = 60;
  const target1xH = 35;
  const targetSnout1x = 44;
  const targetBaseline1x = 31;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c + 1;
      const minPX = Math.floor(c * pw);
      const maxPX = Math.floor((c + 1) * pw);
      const minPY = Math.floor(r * ph);
      const maxPY = Math.floor((r + 1) * ph);

      // Find dinosaur green body bounds in this panel
      let minX = maxPX, maxX = minPX, minY = maxPY, maxY = minPY;
      for (let y = minPY + 50; y < minPY + 105; y++) {
        for (let x = minPX + 30; x < maxPX - 20; x++) {
          const pIdx = (y * W + x) * info.channels;
          const red = data[pIdx], green = data[pIdx + 1], blue = data[pIdx + 2];
          if (green > 90 && green > red + 25 && green > blue + 25) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      }

      // Snout is maxX (or maxX+1 with outline)
      // Foot baseline is maxY (or maxY+1 with sole outline)
      let snoutX = maxX;
      for (let x = maxX; x <= maxX + 2; x++) {
        for (let y = minY; y <= maxY; y++) {
          const pIdx = (y * W + x) * info.channels;
          if (data[pIdx] < 70 && data[pIdx+1] < 70 && data[pIdx+2] < 70) {
            snoutX = Math.max(snoutX, x);
          }
        }
      }

      let baselineY = maxY;
      for (let y = maxY; y <= maxY + 2; y++) {
        for (let x = minX; x <= maxX; x++) {
          const pIdx = (y * W + x) * info.channels;
          if (data[pIdx] < 70 && data[pIdx+1] < 70 && data[pIdx+2] < 70) {
            baselineY = Math.max(baselineY, y);
          }
        }
      }

      // Crop window in panel:
      // Left = snoutX - targetSnout1x
      // Top = baselineY - targetBaseline1x
      const cropLeft = snoutX - targetSnout1x;
      const cropTop = baselineY - targetBaseline1x;

      const rawCrop = await sharp(img2Path)
        .extract({ left: cropLeft, top: cropTop, width: target1xW, height: target1xH })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const cData = rawCrop.data;

      // Clean background to transparent
      for (let y = 0; y < target1xH; y++) {
        for (let x = 0; x < target1xW; x++) {
          const pIdx = (y * target1xW + x) * 4;
          const pr = cData[pIdx];
          const pg = cData[pIdx + 1];
          const pb = cData[pIdx + 2];

          // Sky blue background
          const isSky = (pb > 180 && pb > pr + 40 && pg > pr + 15);
          // Bar line at bottom (below foot baseline)
          const isBar = (y >= targetBaseline1x && pr > 180 && pg > 120 && pb < 80);
          // Pale border lines below foot baseline
          const isBarBorder = (y > targetBaseline1x && (pr > 200 && pg > 200 && pb > 200));

          if (isSky || isBar || isBarBorder) {
            cData[pIdx + 3] = 0;
          } else {
            // Keep pixel
            cData[pIdx + 3] = 255;
          }
        }
      }

      // 3x nearest-neighbor upscale for crisp pixel art
      const outPath = `${outDir}/dino_run_${String(idx).padStart(2, '0')}.png`;
      await sharp(cData, { raw: { width: target1xW, height: target1xH, channels: 4 } })
        .resize(targetW, targetH, { kernel: 'nearest' })
        .png()
        .toFile(outPath);

      console.log(`Saved ${outPath} (${targetW}x${targetH})`);
    }
  }

  console.log('All 15 master loading frames successfully created!');
}

buildMasterLoadingFrames().catch(console.error);
