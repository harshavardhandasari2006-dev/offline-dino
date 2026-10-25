const sharp = require('sharp');
const fs = require('fs');

async function buildMasterAssets() {
  console.log('Generating master homepage assets...');

  const refPath = 'C:/Users/asus/.gemini/antigravity-ide/brain/abb13d5b-cbc2-4e7d-8cd1-abcf24ce7ce1/.user_uploaded/media_1792143343352.jpg';
  
  // 1. HERO BANNER EXTRACTION
  // Bounding box: left: 220, top: 35, width: 580, height: 275
  const crop = { left: 220, top: 35, width: 580, height: 275 };
  const { data: heroRaw, info: heroInfo } = await sharp(refPath).extract(crop).raw().toBuffer({ resolveWithObject: true });
  const hw = heroInfo.width, hh = heroInfo.height;

  // Background keying for sky, clouds, and bottom start button edge
  const isBgPixel = (x, y) => {
    const idx = (y * hw + x) * 3;
    const r = heroRaw[idx], g = heroRaw[idx + 1], b = heroRaw[idx + 2];
    const isSky = (b > 140 && b > r + 25 && g > r * 0.9);
    const isCloud = (r > 200 && g > 210 && b > 225 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25);
    const isSkyDark = (b > 125 && b > r * 1.35 && g > r * 0.95);
    // Bottom orange button rim
    if (y >= 262 && (r > 180 && g > 90 && b < 40)) return true;
    // Purple fringe near bottom left/right
    if (r > 110 && b > 130 && g < 95) return true;
    return isSky || isCloud || isSkyDark;
  };

  const isBg = new Uint8Array(hw * hh);
  const queue = [];

  for (let x = 0; x < hw; x++) {
    if (isBgPixel(x, 0)) { isBg[0 * hw + x] = 1; queue.push(x, 0); }
    if (isBgPixel(x, hh - 1)) { isBg[(hh - 1) * hw + x] = 1; queue.push(x, hh - 1); }
  }
  for (let y = 0; y < hh; y++) {
    if (isBgPixel(0, y)) { isBg[y * hw + 0] = 1; queue.push(0, y); }
    if (isBgPixel(hw - 1, y)) { isBg[y * hw + (hw - 1)] = 1; queue.push(hw - 1, y); }
  }

  let head = 0;
  while (head < queue.length) {
    const cx = queue[head++];
    const cy = queue[head++];
    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
      if (nx >= 0 && nx < hw && ny >= 0 && ny < hh) {
        const nPos = ny * hw + nx;
        if (!isBg[nPos] && isBgPixel(nx, ny)) {
          isBg[nPos] = 1;
          queue.push(nx, ny);
        }
      }
    }
  }

  const heroRgba = Buffer.alloc(hw * hh * 4);
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < hw; x++) {
      const pos = y * hw + x;
      const sIdx = pos * 3;
      const dIdx = pos * 4;
      heroRgba[dIdx] = heroRaw[sIdx];
      heroRgba[dIdx + 1] = heroRaw[sIdx + 1];
      heroRgba[dIdx + 2] = heroRaw[sIdx + 2];

      if (isBg[pos] || (y >= 262 && heroRaw[sIdx] > 180 && heroRaw[sIdx + 2] < 50)) {
        heroRgba[dIdx + 3] = 0;
      } else {
        let bgDist = 99;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy, nx = x + dx;
            if (nx >= 0 && nx < hw && ny >= 0 && ny < hh) {
              if (isBg[ny * hw + nx]) {
                const dist = Math.hypot(dx, dy);
                if (dist < bgDist) bgDist = dist;
              }
            }
          }
        }
        if (bgDist <= 1.0) {
          heroRgba[dIdx + 3] = Math.round(255 * (bgDist / 1.4));
        } else {
          heroRgba[dIdx + 3] = 255;
        }
      }
    }
  }

  // Replace pupil area inside the dinosaur's eyes with clean white sclera
  // Left eye: center (264, 72), rx: 19, ry: 33
  // Right eye: center (324, 72), rx: 19, ry: 33
  for (let y = 40; y < 105; y++) {
    for (let x = 246; x < 283; x++) {
      const lDx = (x - 264) / 19.0;
      const lDy = (y - 72) / 33.0;
      if (lDx * lDx + lDy * lDy <= 0.82) {
        const dIdx = (y * hw + x) * 4;
        const shade = Math.min(255, Math.round(246 + lDy * 8 - Math.abs(lDx) * 6));
        heroRgba[dIdx] = shade;
        heroRgba[dIdx + 1] = shade;
        heroRgba[dIdx + 2] = shade;
      }
    }
    for (let x = 306; x < 343; x++) {
      const rDx = (x - 324) / 19.0;
      const rDy = (y - 72) / 33.0;
      if (rDx * rDx + rDy * rDy <= 0.82) {
        const dIdx = (y * hw + x) * 4;
        const shade = Math.min(255, Math.round(246 + rDy * 8 - Math.abs(rDx) * 6));
        heroRgba[dIdx] = shade;
        heroRgba[dIdx + 1] = shade;
        heroRgba[dIdx + 2] = shade;
      }
    }
  }

  // Trim transparent borders
  const trimmedHero = await sharp(heroRgba, { raw: { width: hw, height: hh, channels: 4 } })
    .trim()
    .png()
    .toBuffer({ resolveWithObject: true });

  console.log('Trimmed hero size:', trimmedHero.info.width, 'x', trimmedHero.info.height);
  fs.writeFileSync('assets/sprites/home_title_sign.png', trimmedHero.data);
  console.log('Saved assets/sprites/home_title_sign.png');

  // 2. EXTRACT 4 BOTTOM BUTTON GRAPHICS
  // In master reference (1024x576):
  // Bottom button row bounding box: top: 418, height: 98
  // 1. Skins: left: 95, width: 190
  // 2. High Score: left: 295, width: 200
  // 3. Sound: left: 505, width: 195
  // 4. Exit: left: 710, width: 190
  const btnCrops = [
    { key: 'btn_home_skins', left: 95, width: 190 },
    { key: 'btn_home_highscore', left: 295, width: 200 },
    { key: 'btn_home_sound', left: 505, width: 195 },
    { key: 'btn_home_exit', left: 710, width: 190 }
  ];

  for (const b of btnCrops) {
    const { data: bRaw, info: bInfo } = await sharp(refPath)
      .extract({ left: b.left, top: 418, width: b.width, height: 98 })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const bw = bInfo.width, bh = bInfo.height;
    const bRgba = Buffer.alloc(bw * bh * 4);

    // Flood fill background outside button/cacti
    const isOutside = (x, y) => {
      const idx = (y * bw + x) * 3;
      const r = bRaw[idx], g = bRaw[idx + 1], b = bRaw[idx + 2];
      // Desert sand/cliffs above or sand below:
      // Desert mountain: warm orange/salmon (r > 180, g between 90 and 150, b < 100)
      const isMtn = (r > 175 && g > 95 && g < 155 && b < 105 && r > g * 1.25);
      // Sky blue:
      const isSky = (b > 150 && b > r + 30);
      return isMtn || isSky;
    };

    const bBg = new Uint8Array(bw * bh);
    const bq = [];
    for (let x = 0; x < bw; x++) {
      if (isOutside(x, 0)) { bBg[0 * bw + x] = 1; bq.push(x, 0); }
    }
    for (let y = 0; y < bh; y++) {
      if (isOutside(0, y)) { bBg[y * bw + 0] = 1; bq.push(0, y); }
      if (isOutside(bw - 1, y)) { bBg[y * bw + (bw - 1)] = 1; bq.push(bw - 1, y); }
    }

    let bHead = 0;
    while (bHead < bq.length) {
      const cx = bq[bHead++];
      const cy = bq[bHead++];
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        if (nx >= 0 && nx < bw && ny >= 0 && ny < bh) {
          const nPos = ny * bw + nx;
          if (!bBg[nPos] && isOutside(nx, ny)) {
            bBg[nPos] = 1;
            bq.push(nx, ny);
          }
        }
      }
    }

    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const pos = y * bw + x;
        const sIdx = pos * 3;
        const dIdx = pos * 4;
        bRgba[dIdx] = bRaw[sIdx];
        bRgba[dIdx + 1] = bRaw[sIdx + 1];
        bRgba[dIdx + 2] = bRaw[sIdx + 2];

        if (bBg[pos]) {
          bRgba[dIdx + 3] = 0;
        } else {
          bRgba[dIdx + 3] = 255;
        }
      }
    }

    const trimmedBtn = await sharp(bRgba, { raw: { width: bw, height: bh, channels: 4 } })
      .trim()
      .png()
      .toBuffer({ resolveWithObject: true });

    fs.writeFileSync(`assets/sprites/${b.key}.png`, trimmedBtn.data);
    console.log(`Saved assets/sprites/${b.key}.png (${trimmedBtn.info.width}x${trimmedBtn.info.height})`);
  }
}

buildMasterAssets().catch(err => {
  console.error(err);
  process.exit(1);
});
