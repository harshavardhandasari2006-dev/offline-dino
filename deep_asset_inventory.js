const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const userUploadedDir = 'C:\\Users\\asus\\.gemini\\antigravity-ide\\brain\\93f495db-673d-4394-aa97-d24e9db54f56\\.user_uploaded';

async function inspectSourceSheets() {
  console.log('=== 1. SOURCE SPRITE SHEETS AUDIT ===');
  const sourceFiles = [
    { name: 'media_1792043577245.png', desc: 'Running 16-frame Master Sheet (2 rows x 8 poses with badges/banners)' },
    { name: 'media_1792039293849.png', desc: 'Running 24-frame Legacy Sheet (3 rows x 8 poses)' },
    { name: 'media_1792039315447.png', desc: 'Ducking 27-frame Master Sheet (3 rows x 9 poses: crouch, slide, recover)' },
    { name: 'media_1792039332642.png', desc: 'Jumping 20-frame Master Sheet (takeoff, ascent, apex, descent, landing)' },
    { name: 'media_1792038501500.jpg', desc: 'Home Page 9-expression Character Reference (3 rows x 3 panels)' }
  ];

  for (const s of sourceFiles) {
    const p = path.join(userUploadedDir, s.name);
    if (!fs.existsSync(p)) {
      console.log(`File not found: ${s.name}`);
      continue;
    }
    const meta = await sharp(p).metadata();
    console.log(`\n--- ${s.name} (${s.desc}) ---`);
    console.log(`  Dimensions: ${meta.width}x${meta.height}`);
    console.log(`  Format: ${meta.format}, Channels: ${meta.channels}, Alpha: ${meta.hasAlpha}`);
  }
}

async function inspectActiveGameplaySprites() {
  console.log('\n=== 2. ACTIVE GAMEPLAY SPRITE AUDIT ===');
  const spriteDir = 'assets/sprites';
  const categories = [
    { prefix: 'run_', count: 16, pad: 2, label: 'Running Frames (run_01..16)' },
    { prefix: 'dino_duck_', count: 27, pad: 0, label: 'Ducking Frames (dino_duck_0..26)' },
    { prefix: 'dino_jump_', count: 20, pad: 0, label: 'Jumping Frames (dino_jump_0..19)' },
    { prefix: 'dino_idle_', count: 4, pad: 0, label: 'Idle Frames (dino_idle_0..3)' },
    { specific: ['dino_idle_sclera', 'dino_front_0', 'dino_front_sclera', 'dino_front_blink', 'dino_front_smile', 'dino_hit', 'dino_dead'], label: 'Core / Home / Death Sprites' }
  ];

  for (const cat of categories) {
    console.log(`\n--- ${cat.label} ---`);
    const keys = [];
    if (cat.specific) {
      keys.push(...cat.specific);
    } else {
      for (let i = (cat.pad === 2 ? 1 : 0); i < (cat.pad === 2 ? cat.count + 1 : cat.count); i++) {
        const idStr = cat.pad === 2 ? i.toString().padStart(2, '0') : i.toString();
        keys.push(`${cat.prefix}${idStr}`);
      }
    }

    const summaries = [];
    for (const k of keys) {
      const p = path.join(spriteDir, `${k}.png`);
      if (!fs.existsSync(p)) {
        summaries.push({ key: k, status: 'MISSING' });
        continue;
      }
      const meta = await sharp(p).metadata();
      const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true });
      let minX = info.width, maxX = 0, minY = info.height, maxY = 0;
      let solidCount = 0;
      let whiteEyeCount = 0;
      let pupilCount = 0;

      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          const idx = (y * info.width + x) * 4;
          const a = data[idx + 3];
          if (a > 25) {
            solidCount++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;

            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            if (r > 235 && g > 235 && b > 235) whiteEyeCount++;
            if (r < 30 && g < 30 && b < 30) pupilCount++;
          }
        }
      }

      summaries.push({
        key: k,
        canvas: `${info.width}x${info.height}`,
        bbox: `${maxX - minX + 1}x${maxY - minY + 1} at (${minX},${minY})`,
        bottomPad: info.height - 1 - maxY,
        solidPx: solidCount,
        whitePx: whiteEyeCount,
        pupilPx: pupilCount
      });
    }

    // Print summary stats
    console.table(summaries);
  }
}

async function run() {
  await inspectSourceSheets();
  await inspectActiveGameplaySprites();
}

run().catch(console.error);
