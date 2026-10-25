const sharp = require('sharp');
const fs = require('fs');

async function checkOverlay() {
  const metaOverlay = await sharp('assets/sprites/home_dino_skin_green.png').metadata();
  console.log('home_dino_skin_green:', metaOverlay);

  const metaSign = await sharp('assets/sprites/home_title_sign_green.png').metadata();
  console.log('home_title_sign_green:', metaSign);

  // Check if home_dino_skin_green is a crop of home_title_sign_green
  const overlayBuf = await sharp('assets/sprites/home_dino_skin_green.png').raw().toBuffer({ resolveWithObject: true });
  const signBuf = await sharp('assets/sprites/home_title_sign_green.png').raw().toBuffer({ resolveWithObject: true });

  const ow = overlayBuf.info.width, oh = overlayBuf.info.height;
  const sw = signBuf.info.width, sh = signBuf.info.height;

  // Let's search for best match of overlay in sign
  let bestMatch = { x: -1, y: -1, diff: 999999999 };
  for (let sy = 0; sy <= sh - oh; sy++) {
    for (let sx = 0; sx <= sw - ow; sx++) {
      let diff = 0;
      let matchedPixels = 0;
      for (let oy = 0; oy < oh; oy += 4) {
        for (let ox = 0; ox < ow; ox += 4) {
          const oIdx = (oy * ow + ox) * 4;
          if (overlayBuf.data[oIdx + 3] < 50) continue;
          const sIdx = ((sy + oy) * sw + (sx + ox)) * 4;
          diff += Math.abs(overlayBuf.data[oIdx] - signBuf.data[sIdx]) +
                  Math.abs(overlayBuf.data[oIdx + 1] - signBuf.data[sIdx + 1]) +
                  Math.abs(overlayBuf.data[oIdx + 2] - signBuf.data[sIdx + 2]);
          matchedPixels++;
        }
      }
      if (matchedPixels > 100 && diff < bestMatch.diff) {
        bestMatch = { x: sx, y: sy, diff };
      }
    }
  }

  console.log('Best match in home_title_sign:', bestMatch);

  // Let's also check homepage_seamless_panorama.jpg (which is 1024x576)
  const pano = await sharp('assets/sprites/homepage_seamless_panorama.jpg').raw().toBuffer({ resolveWithObject: true });
  console.log('homepage_seamless_panorama:', pano.info);

  // In css:
  // left: 42.96875% of 1024 = 440
  // top: 16.493056% of 576 = 95
  // width: 16.6015625% of 1024 = 170
  // height: 28.645833% of 576 = 165
  console.log('CSS overlay box on 1024x576: x=440, y=95, w=170, h=165');
}

checkOverlay().catch(console.error);
