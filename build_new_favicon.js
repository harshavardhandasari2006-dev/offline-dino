const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const srcPath = 'C:/Users/asus/.gemini/antigravity-ide/brain/4560904b-80a3-4480-be57-55cba31be0ab/.user_uploaded/media_1792680481438.png';

async function buildFaviconAssets() {
  console.log('=== Step 1: Saving source image to assets/ and public/assets/ ===');
  const assetsDir = path.join(__dirname, 'assets');
  const publicAssetsDir = path.join(__dirname, 'public/assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
  if (!fs.existsSync(publicAssetsDir)) fs.mkdirSync(publicAssetsDir, { recursive: true });

  fs.copyFileSync(srcPath, path.join(assetsDir, 'offline_dino_mascot_logo.png'));
  fs.copyFileSync(srcPath, path.join(publicAssetsDir, 'offline_dino_mascot_logo.png'));
  console.log('✓ Saved assets/offline_dino_mascot_logo.png and public/assets/offline_dino_mascot_logo.png');

  console.log('\n=== Step 2: Creating square crop of dinosaur mascot face (without large text) ===');
  // Crop parameters:
  // left: 355, top: 12, width: 360, height: 360
  // Captures: full green crest top, shiny big eyes, smile, snout, cheeks, and cute front paws resting at bottom.
  // Completely excludes the white 'OFFLINE DINO' text!
  const faceCrop = { left: 355, top: 12, width: 360, height: 360 };

  const faceMaster = await sharp(srcPath)
    .extract(faceCrop)
    .png()
    .toBuffer();

  const iconsDir = path.join(__dirname, 'icons');
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

  // 1. High-res master favicon
  fs.writeFileSync(path.join(iconsDir, 'favicon.png'), faceMaster);
  fs.writeFileSync(path.join(__dirname, 'favicon.png'), faceMaster);
  console.log('✓ Saved icons/favicon.png and root favicon.png (360x360)');

  // 2. 32x32 browser tab favicon
  const fav32 = await sharp(faceMaster)
    .resize(32, 32, { fit: 'contain', kernel: 'lanczos3' })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(iconsDir, 'favicon-32x32.png'), fav32);
  console.log('✓ Saved icons/favicon-32x32.png (32x32)');

  // 3. 16x16 browser tab favicon
  const fav16 = await sharp(faceMaster)
    .resize(16, 16, { fit: 'contain', kernel: 'lanczos3' })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(iconsDir, 'favicon-16x16.png'), fav16);
  console.log('✓ Saved icons/favicon-16x16.png (16x16)');

  // 4. 48x48 icon
  const fav48 = await sharp(faceMaster)
    .resize(48, 48, { fit: 'contain', kernel: 'lanczos3' })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(iconsDir, 'favicon-48x48.png'), fav48);
  console.log('✓ Saved icons/favicon-48x48.png (48x48)');

  // 5. 192x192 PWA icon
  const icon192 = await sharp(faceMaster)
    .resize(192, 192, { fit: 'contain', kernel: 'lanczos3' })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), icon192);
  console.log('✓ Saved icons/icon-192.png (192x192)');

  // 6. 512x512 PWA icon
  const icon512 = await sharp(faceMaster)
    .resize(512, 512, { fit: 'contain', kernel: 'lanczos3' })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), icon512);
  console.log('✓ Saved icons/icon-512.png (512x512)');

  // 7. Create true multi-resolution favicon.ico containing 16x16, 32x32, and 48x48
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
  console.log(`✓ Saved standard multi-resolution favicon.ico (${icoBuffer.length} bytes) to root and icons/`);

  console.log('\n=== All favicon and icon assets generated successfully! ===');
}

buildFaviconAssets().catch(err => {
  console.error('Error generating favicon assets:', err);
  process.exit(1);
});
