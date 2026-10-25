const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const srcPath = 'C:/Users/asus/.gemini/antigravity-ide/brain/4560904b-80a3-4480-be57-55cba31be0ab/.user_uploaded/media_1792683598349.jpg';

async function buildCompleteFavicons() {
  console.log('=== Step 1: Processing Complete Logo with Genuine Alpha Transparency ===');
  const { data, info } = await sharp(srcPath).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;

  // Outer BFS Flood Fill to isolate the external black background
  const outerBg = new Uint8Array(w * h);
  const queue = [];

  function getB(x, y) {
    const idx = (y * w + x) * 3;
    return Math.max(data[idx], data[idx+1], data[idx+2]);
  }

  // Seed with all perimeter edge pixels
  for (let x = 0; x < w; x++) {
    queue.push(x, 0); outerBg[x] = 1;
    queue.push(x, h - 1); outerBg[(h - 1) * w + x] = 1;
  }
  for (let y = 0; y < h; y++) {
    if (!outerBg[y * w]) { queue.push(0, y); outerBg[y * w] = 1; }
    if (!outerBg[y * w + w - 1]) { queue.push(w - 1, y); outerBg[y * w + w - 1] = 1; }
  }

  let head = 0;
  while (head < queue.length) {
    const cx = queue[head++];
    const cy = queue[head++];

    for (const [nx, ny] of [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]) {
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const nIdx = ny * w + nx;
        if (!outerBg[nIdx] && getB(nx, ny) <= 9) {
          outerBg[nIdx] = 1;
          queue.push(nx, ny);
        }
      }
    }
  }

  // Smooth anti-aliased edge ramp for the boundary
  const transitionAlpha = new Float32Array(w * h).fill(1.0);
  for (let i = 0; i < w * h; i++) {
    if (outerBg[i]) transitionAlpha[i] = 0;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (outerBg[y * w + x]) {
        for (const [nx, ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nIdx = ny * w + nx;
            if (!outerBg[nIdx] && transitionAlpha[nIdx] === 1.0) {
              const b = getB(nx, ny);
              if (b <= 40) {
                const t = Math.max(0, Math.min(1, (b - 8) / 30));
                transitionAlpha[nIdx] = t * t * (3 - 2 * t);
              }
            }
          }
        }
      }
    }
  }

  const rgba = Buffer.alloc(w * h * 4);
  let minX = w, maxX = 0, minY = h, maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 3;
      const dstIdx = (y * w + x) * 4;
      const a = transitionAlpha[y * w + x];

      if (a <= 0.001) {
        rgba[dstIdx] = 0;
        rgba[dstIdx + 1] = 0;
        rgba[dstIdx + 2] = 0;
        rgba[dstIdx + 3] = 0;
      } else if (a >= 0.999) {
        rgba[dstIdx] = data[srcIdx];
        rgba[dstIdx + 1] = data[srcIdx + 1];
        rgba[dstIdx + 2] = data[srcIdx + 2];
        rgba[dstIdx + 3] = 255;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      } else {
        const unscale = Math.min(2.5, 1 / a);
        rgba[dstIdx] = Math.min(255, Math.round(data[srcIdx] * unscale));
        rgba[dstIdx + 1] = Math.min(255, Math.round(data[srcIdx + 1] * unscale));
        rgba[dstIdx + 2] = Math.min(255, Math.round(data[srcIdx + 2] * unscale));
        rgba[dstIdx + 3] = Math.round(a * 255);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  console.log(`Logo bounds: X=[${minX}..${maxX}] (${maxX-minX+1}px), Y=[${minY}..${maxY}] (${maxY-minY+1}px)`);

  // Extract the tight bounding box of the logo so aspect-ratio scaling and padding are 100% accurate
  const logoWidth = maxX - minX + 1;
  const logoHeight = maxY - minY + 1;

  const croppedLogoBuf = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: minX, top: minY, width: logoWidth, height: logoHeight })
    .png()
    .toBuffer();

  const assetsDir = path.join(__dirname, 'assets');
  const publicAssetsDir = path.join(__dirname, 'public/assets');
  const iconsDir = path.join(__dirname, 'icons');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
  if (!fs.existsSync(publicAssetsDir)) fs.mkdirSync(publicAssetsDir, { recursive: true });
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

  // Save the full transparent logo into assets/ and public/assets/
  const fullTransparentBuf = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(assetsDir, 'offline_dino_mascot_logo.png'), fullTransparentBuf);
  fs.writeFileSync(path.join(publicAssetsDir, 'offline_dino_mascot_logo.png'), fullTransparentBuf);
  console.log('✓ Saved transparent master logo to assets/ and public/assets/');

  // Step 2: Scale proportionally onto square transparent canvas with clean padding
  console.log('\n=== Step 2: Generating Multi-Resolution Favicon Suite with Guaranteed Padding ===');

  async function generateProportionalIcon(canvasSize, paddingFactor, targetPath) {
    // paddingFactor e.g. 0.90 means the logo occupies at most 90% of the canvas, ensuring 5% padding on all sides
    const maxInnerDim = Math.max(1, Math.floor(canvasSize * paddingFactor));
    
    let targetW, targetH;
    if (logoWidth >= logoHeight) {
      targetW = maxInnerDim;
      targetH = Math.max(1, Math.round(maxInnerDim * (logoHeight / logoWidth)));
    } else {
      targetH = maxInnerDim;
      targetW = Math.max(1, Math.round(maxInnerDim * (logoWidth / logoHeight)));
    }

    // High quality Lanczos3 resize of the logo
    const resizedLogo = await sharp(croppedLogoBuf)
      .resize(targetW, targetH, { fit: 'fill', kernel: 'lanczos3' })
      .png()
      .toBuffer();

    // Composite centered onto square transparent canvas
    const offsetX = Math.floor((canvasSize - targetW) / 2);
    const offsetY = Math.floor((canvasSize - targetH) / 2);

    const squareIconBuf = await sharp({
      create: {
        width: canvasSize,
        height: canvasSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{ input: resizedLogo, left: offsetX, top: offsetY }])
      .png()
      .toBuffer();

    fs.writeFileSync(targetPath, squareIconBuf);
    console.log(`✓ Saved ${path.relative(__dirname, targetPath)} (${canvasSize}x${canvasSize}, inner: ${targetW}x${targetH}, padX: ${offsetX}px, padY: ${offsetY}px)`);
    return squareIconBuf;
  }

  // Generate all standard sizes with 90% scale (5% padding on each side)
  const fav16 = await generateProportionalIcon(16, 0.88, path.join(iconsDir, 'favicon-16x16.png'));
  const fav32 = await generateProportionalIcon(32, 0.90, path.join(iconsDir, 'favicon-32x32.png'));
  const fav48 = await generateProportionalIcon(48, 0.90, path.join(iconsDir, 'favicon-48x48.png'));
  const apple180 = await generateProportionalIcon(180, 0.90, path.join(iconsDir, 'apple-touch-icon.png'));
  const icon192 = await generateProportionalIcon(192, 0.90, path.join(iconsDir, 'icon-192.png'));
  const icon512 = await generateProportionalIcon(512, 0.92, path.join(iconsDir, 'icon-512.png'));

  // Root copies
  fs.writeFileSync(path.join(iconsDir, 'favicon.png'), icon512);
  fs.writeFileSync(path.join(__dirname, 'favicon.png'), icon512);
  fs.writeFileSync(path.join(__dirname, 'apple-touch-icon.png'), apple180);

  // Multi-resolution favicon.ico containing 16x16, 32x32, and 48x48
  function createIco(images) {
    const count = images.length;
    const headerSize = 6;
    const dirEntrySize = 16;
    let offset = headerSize + count * dirEntrySize;

    const header = Buffer.alloc(headerSize);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // type 1 = icon
    header.writeUInt16LE(count, 4); // number of images

    const dirEntries = [];
    for (const img of images) {
      const entry = Buffer.alloc(dirEntrySize);
      entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
      entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
      entry.writeUInt8(0, 2); // color count
      entry.writeUInt8(0, 3); // reserved
      entry.writeUInt16LE(1, 4); // color planes
      entry.writeUInt16LE(32, 6); // bpp
      entry.writeUInt32LE(img.buffer.length, 8); // size
      entry.writeUInt32LE(offset, 12); // offset
      dirEntries.push(entry);
      offset += img.buffer.length;
    }

    return Buffer.concat([header, ...dirEntries, ...images.map(img => img.buffer)]);
  }

  const icoBuffer = createIco([
    { width: 16, height: 16, buffer: fav16 },
    { width: 32, height: 32, buffer: fav32 },
    { width: 48, height: 48, buffer: fav48 }
  ]);

  fs.writeFileSync(path.join(__dirname, 'favicon.ico'), icoBuffer);
  fs.writeFileSync(path.join(iconsDir, 'favicon.ico'), icoBuffer);
  console.log(`✓ Saved multi-resolution favicon.ico (${icoBuffer.length} bytes) to root and icons/`);

  console.log('\n=== Favicon Suite Successfully Built! ===');
}

buildCompleteFavicons().catch(err => {
  console.error('Error generating favicon suite:', err);
  process.exit(1);
});
