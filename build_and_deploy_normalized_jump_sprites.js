const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function buildAndDeployNormalizedJumps() {
  console.log('=== NORMALIZING & DEPLOYING JUMP FRAMES ===');

  const srcPath = path.join(__dirname, 'test_duck_jump_animations', 'jump_sheet_original.png');
  const jumpFramesDir = path.join(__dirname, 'test_duck_jump_animations', 'jump_frames');
  const assetsSpritesDir = path.join(__dirname, 'assets', 'sprites');
  const backupDir = path.join(__dirname, 'backup_pre_jump_normalize');

  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  // Backup current jump assets
  for (let i = 1; i <= 10; i++) {
    const pad = i.toString().padStart(2, '0');
    const f1 = path.join(assetsSpritesDir, `jump_${pad}.png`);
    const f2 = path.join(assetsSpritesDir, `dino_jump_${i - 1}.png`);
    if (fs.existsSync(f1)) fs.copyFileSync(f1, path.join(backupDir, `jump_${pad}.png`));
    if (fs.existsSync(f2)) fs.copyFileSync(f2, path.join(backupDir, `dino_jump_${i - 1}.png`));
  }
  console.log('Backed up previous jump sprites to backup_pre_jump_normalize/');

  const { data, info } = await sharp(srcPath).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;

  const cuts = [
    [0, 212, 420, 620, 820, 1024],
    [0, 195, 405, 610, 818, 1024]
  ];

  const CANVAS_W = 240;
  const CANVAS_H = 210;
  const TARGET_GROUND_Y = 194;
  const TARGET_SNOUT_X = 220;
  const SCALE = 1.20; // Exactly matches running dinosaur scale (158.5px tall)

  const isDino = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    const idx = (y * w + x) * 4;
    return (data[idx] > 12 || data[idx+1] > 12 || data[idx+2] > 12);
  };

  for (let r = 0; r < 2; r++) {
    const y0 = r === 0 ? 0 : 220;
    const y1 = r === 0 ? 208 : h;

    for (let c = 0; c < 5; c++) {
      const frameIdx = r * 5 + c + 1;
      const padNum = frameIdx.toString().padStart(2, '0');
      const x0 = cuts[r][c];
      const x1 = cuts[r][c+1];

      let minX = w, maxX = 0, minY = h, maxY = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (isDino(x, y)) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      const tightW = maxX - minX + 1;
      const tightH = maxY - minY + 1;

      // Extract tight raw figure
      const cropW = tightW;
      const cropH = tightH;
      const cropRaw = Buffer.alloc(cropW * cropH * 4);
      for (let cy = 0; cy < cropH; cy++) {
        for (let cx = 0; cx < cropW; cx++) {
          const sIdx = ((minY + cy) * w + (minX + cx)) * 4;
          const dIdx = (cy * cropW + cx) * 4;
          cropRaw[dIdx] = data[sIdx];
          cropRaw[dIdx+1] = data[sIdx+1];
          cropRaw[dIdx+2] = data[sIdx+2];
          cropRaw[dIdx+3] = 255;
        }
      }

      // BFS flood fill outer black background
      const isBg = (cx, cy) => {
        const idx = (cy * cropW + cx) * 4;
        return cropRaw[idx] <= 12 && cropRaw[idx+1] <= 12 && cropRaw[idx+2] <= 12;
      };
      const visited = new Uint8Array(cropW * cropH);
      const queue = [];
      for (let cx = 0; cx < cropW; cx++) {
        if (isBg(cx, 0)) { queue.push(cx, 0); visited[0 * cropW + cx] = 1; }
        if (isBg(cx, cropH - 1)) { queue.push(cx, cropH - 1); visited[(cropH - 1) * cropW + cx] = 1; }
      }
      for (let cy = 0; cy < cropH; cy++) {
        if (isBg(0, cy) && !visited[cy * cropW]) { queue.push(0, cy); visited[cy * cropW] = 1; }
        if (isBg(cropW - 1, cy) && !visited[cy * cropW + cropW - 1]) { queue.push(cropW - 1, cy); visited[cy * cropW + cropW - 1] = 1; }
      }
      let qHead = 0;
      while (qHead < queue.length) {
        const qx = queue[qHead++];
        const qy = queue[qHead++];
        const nbrs = [[qx+1, qy], [qx-1, qy], [qx, qy+1], [qx, qy-1]];
        for (const [nx, ny] of nbrs) {
          if (nx >= 0 && nx < cropW && ny >= 0 && ny < cropH) {
            const nidx = ny * cropW + nx;
            if (!visited[nidx] && isBg(nx, ny)) {
              visited[nidx] = 1;
              queue.push(nx, ny);
            }
          }
        }
      }

      for (let i = 0; i < cropW * cropH; i++) {
        if (visited[i]) {
          cropRaw[i * 4 + 3] = 0;
        }
      }

      // Rescale by SCALE (1.20)
      const rescaledW = Math.round(cropW * SCALE);
      const rescaledH = Math.round(cropH * SCALE);

      const rescaledBuf = await sharp(cropRaw, { raw: { width: cropW, height: cropH, channels: 4 } })
        .resize(rescaledW, rescaledH, { kernel: 'lanczos3' })
        .raw()
        .toBuffer();

      // Find local rightmost (snout) in rescaledBuf
      let localSnoutX = 0;
      for (let cy = 0; cy < rescaledH; cy++) {
        for (let cx = rescaledW - 1; cx >= 0; cx--) {
          if (rescaledBuf[(cy * rescaledW + cx) * 4 + 3] > 30) {
            if (cx > localSnoutX) localSnoutX = cx;
            break;
          }
        }
      }

      // Horizontal placement: align snout with TARGET_SNOUT_X (220)
      let placedX = TARGET_SNOUT_X - localSnoutX;
      if (placedX < 0) placedX = 0;
      if (placedX + rescaledW > CANVAS_W) placedX = CANVAS_W - rescaledW;

      // Vertical placement:
      // Grounded frames (1, 2, 3, 9, 10): feet on TARGET_GROUND_Y (194)
      // Airborne frames (4, 5, 6, 7, 8): head aligned with running head (y = 36)
      let placedY;
      if (frameIdx === 1 || frameIdx === 2 || frameIdx === 3 || frameIdx === 9 || frameIdx === 10) {
        placedY = TARGET_GROUND_Y - rescaledH;
      } else {
        placedY = 36;
      }

      const canvasBuf = Buffer.alloc(CANVAS_W * CANVAS_H * 4, 0);
      for (let cy = 0; cy < rescaledH; cy++) {
        for (let cx = 0; cx < rescaledW; cx++) {
          const dx = placedX + cx;
          const dy = placedY + cy;
          if (dx >= 0 && dx < CANVAS_W && dy >= 0 && dy < CANVAS_H) {
            const sIdx = (cy * rescaledW + cx) * 4;
            const dIdx = (dy * CANVAS_W + dx) * 4;
            const a = rescaledBuf[sIdx + 3];
            if (a > 0) {
              canvasBuf[dIdx] = rescaledBuf[sIdx];
              canvasBuf[dIdx+1] = rescaledBuf[sIdx+1];
              canvasBuf[dIdx+2] = rescaledBuf[sIdx+2];
              canvasBuf[dIdx+3] = a;
            }
          }
        }
      }

      // Save to test_duck_jump_animations/jump_frames/
      const outTestPath = path.join(jumpFramesDir, `jump_${padNum}.png`);
      await sharp(canvasBuf, { raw: { width: CANVAS_W, height: CANVAS_H, channels: 4 } }).png().toFile(outTestPath);

      // Save to assets/sprites/ as jump_XX.png and dino_jump_X.png
      const outSprite1 = path.join(assetsSpritesDir, `jump_${padNum}.png`);
      const outSprite2 = path.join(assetsSpritesDir, `dino_jump_${frameIdx - 1}.png`);
      await sharp(canvasBuf, { raw: { width: CANVAS_W, height: CANVAS_H, channels: 4 } }).png().toFile(outSprite1);
      await sharp(canvasBuf, { raw: { width: CANVAS_W, height: CANVAS_H, channels: 4 } }).png().toFile(outSprite2);

      console.log(`  Frame ${padNum}: rescaled to ${rescaledW}x${rescaledH}, placed at (${placedX}, ${placedY}), saved to assets/sprites`);
    }
  }

  // Update js/sprite_data.js
  console.log('Re-baking js/sprite_data.js with embedded Base64 sprites...');
  const files = fs.readdirSync(assetsSpritesDir).filter(f => f.endsWith('.png'));
  const spriteMap = {};
  for (const file of files) {
    const key = file.replace('.png', '');
    const buf = fs.readFileSync(path.join(assetsSpritesDir, file));
    spriteMap[key] = 'data:image/png;base64,' + buf.toString('base64');
  }

  let jsContent = '/**\n * OFFLINE DINO - Embedded Style 1 Master Sprite Data\n * High-fidelity, transparent, synchronized cartoon sprites.\n */\nwindow.STYLE1_SPRITES = {\n';
  const keys = Object.keys(spriteMap);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    jsContent += `  ${JSON.stringify(k)}: ${JSON.stringify(spriteMap[k])}${i < keys.length - 1 ? ',' : ''}\n`;
  }
  jsContent += '};\n';

  fs.writeFileSync(path.join(__dirname, 'js', 'sprite_data.js'), jsContent);
  console.log(`Successfully updated js/sprite_data.js with ${keys.length} embedded sprites.`);
}

buildAndDeployNormalizedJumps().catch(console.error);
