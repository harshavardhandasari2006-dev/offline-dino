const sharp = require('sharp');
const fs = require('fs');

async function finalizeSign() {
  const refPath = 'C:/Users/asus/.gemini/antigravity-ide/brain/abb13d5b-cbc2-4e7d-8cd1-abcf24ce7ce1/.user_uploaded/media_1792143343352.jpg';
  
  // Extract crop: left: 220, top: 35, width: 580, height: 275
  const crop = { left: 220, top: 35, width: 580, height: 275 };
  const { data: raw, info } = await sharp(refPath).extract(crop).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;

  // Background keying for sky/cloud
  const isBg = new Uint8Array(w * h);
  const queue = [];

  const isSkyOrCloud = (x, y) => {
    const idx = (y * w + x) * 3;
    const r = raw[idx], g = raw[idx+1], b = raw[idx+2];
    const isSky = (b > 140 && b > r + 25 && g > r * 0.9);
    const isCloud = (r > 200 && g > 210 && b > 225 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25);
    const isSkyDark = (b > 125 && b > r * 1.35 && g > r * 0.95);
    // Orange start button rim at bottom center
    if (y >= 262 && (r > 175 && g > 85 && b < 45)) return true;
    // Purple fringe near edges
    if (r > 105 && b > 125 && g < 95) return true;
    return isSky || isCloud || isSkyDark;
  };

  for (let x = 0; x < w; x++) {
    if (isSkyOrCloud(x, 0)) { isBg[0 * w + x] = 1; queue.push(x, 0); }
    if (isSkyOrCloud(x, h - 1)) { isBg[(h - 1) * w + x] = 1; queue.push(x, h - 1); }
  }
  for (let y = 0; y < h; y++) {
    if (isSkyOrCloud(0, y)) { isBg[y * w + 0] = 1; queue.push(0, y); }
    if (isSkyOrCloud(w - 1, y)) { isBg[y * w + (w - 1)] = 1; queue.push(w - 1, y); }
  }

  let head = 0;
  while (head < queue.length) {
    const cx = queue[head++];
    const cy = queue[head++];
    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const nPos = ny * w + nx;
        if (!isBg[nPos] && isSkyOrCloud(nx, ny)) {
          isBg[nPos] = 1;
          queue.push(nx, ny);
        }
      }
    }
  }

  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pos = y * w + x;
      const sIdx = pos * 3;
      const dIdx = pos * 4;
      out[dIdx] = raw[sIdx];
      out[dIdx + 1] = raw[sIdx + 1];
      out[dIdx + 2] = raw[sIdx + 2];

      if (isBg[pos] || (y >= 262 && raw[sIdx] > 175 && raw[sIdx+2] < 50)) {
        out[dIdx + 3] = 0;
      } else {
        let bgDist = 99;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy, nx = x + dx;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              if (isBg[ny * w + nx]) {
                const dist = Math.hypot(dx, dy);
                if (dist < bgDist) bgDist = dist;
              }
            }
          }
        }
        if (bgDist <= 1.0) {
          out[dIdx + 3] = Math.round(255 * (bgDist / 1.4));
        } else {
          out[dIdx + 3] = 255;
        }
      }
    }
  }

  // Trim transparent borders
  const trimmed = await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .trim()
    .png()
    .toBuffer({ resolveWithObject: true });

  console.log('Trimmed master sign size:', trimmed.info.width, 'x', trimmed.info.height);
  fs.writeFileSync('assets/sprites/home_title_sign.png', trimmed.data);
  console.log('Saved assets/sprites/home_title_sign.png successfully!');
}

finalizeSign().catch(err => {
  console.error(err);
  process.exit(1);
});
