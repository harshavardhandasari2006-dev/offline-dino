const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function stitchMasterPanorama() {
  const panoW = 2880;
  const panoH = 1080;
  const centerW = 1920;
  const centerLeft = Math.round((panoW - centerW) / 2); // 480
  const extW = centerLeft; // 480
  
  console.log(`Stitching Master Panorama: ${panoW}x${panoH}, center: [${centerLeft}, ${centerLeft + centerW}]`);
  
  const brainDir = 'C:/Users/asus/.gemini/antigravity-ide/brain/1c3e5139-b62e-4146-8621-13708d351c51/';
  const leftExtPath = path.join(brainDir, 'desert_left_extension_1792295600599.jpg');
  const rightExtPath = path.join(brainDir, 'desert_right_extension_1792295635551.jpg');
  const pristineMasterPath = path.join(brainDir, '.user_uploaded/media_1792219879817.jpg');

  // 1. Maintain pristine 1024x576 artwork with reduced button as master reference
  await sharp(pristineMasterPath)
    .resize(1024, 576, { fit: 'fill' })
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toFile('assets/sprites/homepage_master_reference.jpg');

  // Load master reference resized to 1920 x 1080
  const master = await sharp('assets/sprites/homepage_master_reference.jpg')
    .resize(centerW, panoH, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const leftW = Math.round(1376 * panoH / 768); // 1935
  const leftExt = await sharp(leftExtPath)
    .resize(leftW, panoH, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rightW = Math.round(1376 * panoH / 768); // 1935
  const rightExt = await sharp(rightExtPath)
    .resize(rightW, panoH, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  console.log(`Loaded Master (${master.info.width}x${master.info.height}), LeftExt (${leftExt.info.width}x${leftExt.info.height}), RightExt (${rightExt.info.width}x${rightExt.info.height})`);

  // 2. Global Linear Color Calibration
  const leftScaleR = 0.9552, leftScaleG = 1.0239, leftScaleB = 1.1631;
  for (let i = 0; i < leftExt.data.length; i += 3) {
    leftExt.data[i] = Math.min(255, Math.round(leftExt.data[i] * leftScaleR));
    leftExt.data[i + 1] = Math.min(255, Math.round(leftExt.data[i + 1] * leftScaleG));
    leftExt.data[i + 2] = Math.min(255, Math.round(leftExt.data[i + 2] * leftScaleB));
  }

  const rightScaleR = 0.9485, rightScaleG = 1.0399, rightScaleB = 1.1299;
  for (let i = 0; i < rightExt.data.length; i += 3) {
    rightExt.data[i] = Math.min(255, Math.round(rightExt.data[i] * rightScaleR));
    rightExt.data[i + 1] = Math.min(255, Math.round(rightExt.data[i + 1] * rightScaleG));
    rightExt.data[i + 2] = Math.min(255, Math.round(rightExt.data[i + 2] * rightScaleB));
  }

  // Sub-pixel alignment offsets based on exact feature correlation
  const leftMatchX = 1305; // Column in leftExt that matches master x = 0
  const rightMatchX = 686; // Column in rightExt that matches master x = centerW - 1

  const pano = Buffer.alloc(panoW * panoH * 3);
  const blendW = 60; // 60px smooth C1 cosine feather zone strictly inside shared 2D content

  for (let y = 0; y < panoH; y++) {
    for (let px = 0; px < panoW; px++) {
      const pIdx = (y * panoW + px) * 3;

      if (px < centerLeft) {
        // Pure left extension (no clamping, full genuine left artwork)
        const lx = leftMatchX - centerLeft + px;
        if (lx >= 0 && lx < leftW) {
          const lIdx = (y * leftW + lx) * 3;
          pano[pIdx] = leftExt.data[lIdx];
          pano[pIdx + 1] = leftExt.data[lIdx + 1];
          pano[pIdx + 2] = leftExt.data[lIdx + 2];
        }
      } else if (px < centerLeft + blendW) {
        // Left blend zone: both master and leftExt have full 2D content here!
        const u = (px - centerLeft) / blendW;
        const t = 0.5 - 0.5 * Math.cos(Math.PI * u); // 0 at leftExt, 1 at master

        const mx = px - centerLeft; // in [0, blendW]
        const lx = leftMatchX + mx; // in [leftMatchX, leftMatchX + blendW]

        const lIdx = (y * leftW + lx) * 3;
        const mIdx = (y * centerW + mx) * 3;

        const lR = leftExt.data[lIdx], lG = leftExt.data[lIdx + 1], lB = leftExt.data[lIdx + 2];
        const mR = master.data[mIdx], mG = master.data[mIdx + 1], mB = master.data[mIdx + 2];

        pano[pIdx] = Math.round(lR * (1 - t) + mR * t);
        pano[pIdx + 1] = Math.round(lG * (1 - t) + mG * t);
        pano[pIdx + 2] = Math.round(lB * (1 - t) + mB * t);
      } else if (px < centerLeft + centerW - blendW) {
        // Pure master artwork core
        const mx = px - centerLeft;
        const mIdx = (y * centerW + mx) * 3;
        pano[pIdx] = master.data[mIdx];
        pano[pIdx + 1] = master.data[mIdx + 1];
        pano[pIdx + 2] = master.data[mIdx + 2];
      } else if (px < centerLeft + centerW) {
        // Right blend zone: both master and rightExt have full 2D content here!
        const offsetFromEnd = centerLeft + centerW - px; // blendW down to 0
        const u = (blendW - offsetFromEnd) / blendW;
        const t = 0.5 - 0.5 * Math.cos(Math.PI * u); // 0 at master, 1 at rightExt

        const mx = px - centerLeft; // in [centerW - blendW, centerW]
        const rx = rightMatchX - offsetFromEnd; // in [rightMatchX - blendW, rightMatchX]

        const mIdx = (y * centerW + mx) * 3;
        const rIdx = (y * rightW + rx) * 3;

        const mR = master.data[mIdx], mG = master.data[mIdx + 1], mB = master.data[mIdx + 2];
        const rR = rightExt.data[rIdx], rG = rightExt.data[rIdx + 1], rB = rightExt.data[rIdx + 2];

        pano[pIdx] = Math.round(mR * (1 - t) + rR * t);
        pano[pIdx + 1] = Math.round(mG * (1 - t) + rG * t);
        pano[pIdx + 2] = Math.round(mB * (1 - t) + rB * t);
      } else {
        // Pure right extension (no clamping, full genuine right artwork)
        const rx = rightMatchX + (px - (centerLeft + centerW));
        if (rx >= 0 && rx < rightW) {
          const rIdx = (y * rightW + rx) * 3;
          pano[pIdx] = rightExt.data[rIdx];
          pano[pIdx + 1] = rightExt.data[rIdx + 1];
          pano[pIdx + 2] = rightExt.data[rIdx + 2];
        }
      }
    }
  }

  const outPath = path.join(__dirname, 'assets/sprites/homepage_seamless_panorama.jpg');
  await sharp(pano, { raw: { width: panoW, height: panoH, channels: 3 } })
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toFile(outPath);

  const stats = fs.statSync(outPath);
  console.log(`SUCCESS: Created ${outPath} (${stats.size} bytes)`);
}

stitchMasterPanorama().catch(console.error);
