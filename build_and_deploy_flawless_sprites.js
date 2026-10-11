const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SPRITES_DIR = path.join(__dirname, 'assets', 'sprites');

// Precision halo and artifact cleaner
function cleanSpriteData(buf, w, h, spriteType = 'dino') {
  const out = Buffer.from(buf);

  // 1. Wipe strictly below baseline y = 103 for dinosaur sprites
  if (spriteType === 'dino' || spriteType === 'dino_run' || spriteType === 'dino_jump') {
    for (let y = 104; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
      }
    }
  }

  // 2. Erase sand particles (peach/salmon sand color) anywhere near bottom
  for (let y = 80; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (out[idx + 3] === 0) continue;
      const r = out[idx], g = out[idx+1], b = out[idx+2];
      // Sand: peach/salmon tan (r > 175, g < 170, b < 145, r - g >= 25, r - b >= 45)
      if (r > 170 && g < 168 && b < 145 && (r - g >= 25) && (r - b >= 42)) {
        out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
      }
    }
  }

  // 3. Multi-pass perimeter halo cleaning (cleans light sky/cloud artifacts outside dark outline)
  for (let pass = 0; pass < 4; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const a = out[idx + 3];
        if (a === 0) continue;

        let touchesTrans = false;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h || out[(ny * w + nx) * 4 + 3] === 0) {
            touchesTrans = true; break;
          }
        }

        if (touchesTrans) {
          const r = out[idx], g = out[idx+1], b = out[idx+2];

          if (spriteType === 'cactus') {
            // Cactus: Flower is orange/red near top (y < 16, r > 150, g < 130, b < 90)
            if (y < 16 && r > 150 && g < 130 && b < 90) continue;
            // Yellow-green body: b < 65, g > 70
            if (b < 65 && g > 65) continue;
            // Dark outline:
            if (r < 75 && g < 85 && b < 65) continue;
            // Sky halo on cactus:
            if (b > 70 || (r > 140 && g > 150 && b > 110) || a < 180) {
              out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
            }
            continue;
          }

          if (spriteType === 'ptero') {
            // Pterodactyl has NO blue: body/wings have b < 90
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (b > 90 || (lum > 165 && b > 85) || (a < 180 && (r > 130 || g > 140 || b > 120))) {
              out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
            }
            continue;
          }

          // Dinosaur sprite:
          // PROTECT: Claws/toenails (y >= 92)
          if (y >= 92 && r > 185 && g > 175 && b < 165 && Math.abs(r - g) <= 25) continue;
          // PROTECT: Cream chin, throat, chest, belly:
          if (r > 180 && g > 160 && (r - b >= 25) && (g - b >= 20)) continue;
          // PROTECT: Dead stars/spirals (for dino_dead):
          if (spriteType === 'dino_dead' && y < 45 && r > 180 && g > 150 && b < 110) continue;

          // Sky/cloud halo removal:
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const isSkyCyan = (b > r + 8 && b > 110) || (b > 115 && lum > 130 && r < 190);
          const isCloudFringe = (r > 165 && g > 175 && b > 160 && Math.abs(r - b) < 20);
          const isTransFringe = (a < 180 && (r > 130 || g > 140 || b > 120));

          if (isSkyCyan || isCloudFringe || isTransFringe || b > 125) {
            out[idx] = 0; out[idx+1] = 0; out[idx+2] = 0; out[idx+3] = 0;
          }
        }
      }
    }
  }

  return out;
}

async function processAllSprites() {
  console.log('--- 1. PROCESSING IDLE FRAMES ---');
  for (let i = 0; i <= 3; i++) {
    const raw = await sharp(path.join(SPRITES_DIR, `dino_idle_${i}.png`)).raw().toBuffer({ resolveWithObject: true });
    const clean = cleanSpriteData(raw.data, raw.info.width, raw.info.height, 'dino');
    await sharp(clean, { raw: { width: raw.info.width, height: raw.info.height, channels: 4 } })
      .png().toFile(path.join(SPRITES_DIR, `dino_idle_${i}.png`));
    console.log(`✓ dino_idle_${i}.png cleaned`);
  }

  console.log('--- 2. DEPLOYING 4-PHASE ALTERNATING RUN CYCLE ---');
  // Use final_clean_run_0 through 4 (alternating two-leg cycle directly from raw panels!)
  for (let i = 0; i <= 4; i++) {
    const raw = await sharp(`final_clean_run_${i}.png`).raw().toBuffer({ resolveWithObject: true });
    const clean = cleanSpriteData(raw.data, raw.info.width, raw.info.height, 'dino_run');
    await sharp(clean, { raw: { width: raw.info.width, height: raw.info.height, channels: 4 } })
      .png().toFile(path.join(SPRITES_DIR, `dino_run_${i}.png`));
    console.log(`✓ dino_run_${i}.png deployed (alternating two-leg run, maxY=103)`);
  }

  console.log('--- 3. DEPLOYING CLEAN JUMP FRAMES ---');
  // Use clean_jump_0 through 4 (with full tails!)
  for (let i = 0; i <= 4; i++) {
    const raw = await sharp(`clean_jump_${i}.png`).raw().toBuffer({ resolveWithObject: true });
    const clean = cleanSpriteData(raw.data, raw.info.width, raw.info.height, 'dino_jump');
    await sharp(clean, { raw: { width: raw.info.width, height: raw.info.height, channels: 4 } })
      .png().toFile(path.join(SPRITES_DIR, `dino_jump_${i}.png`));
    console.log(`✓ dino_jump_${i}.png deployed (full tail, zero halo)`);
  }

  console.log('--- 4. DEPLOYING CLEAN DUCK FRAMES (NATURAL CLOSED EYES, ZERO GREEN BOXES) ---');
  // Use clean_duck_0 through 4 (authentic cartoon closed eyes from master art!)
  for (let i = 0; i <= 4; i++) {
    const raw = await sharp(`clean_duck_${i}.png`).raw().toBuffer({ resolveWithObject: true });
    const clean = cleanSpriteData(raw.data, raw.info.width, raw.info.height, 'dino');
    await sharp(clean, { raw: { width: raw.info.width, height: raw.info.height, channels: 4 } })
      .png().toFile(path.join(SPRITES_DIR, `dino_duck_${i}.png`));
    console.log(`✓ dino_duck_${i}.png deployed (authentic closed eyes, zero patches)`);
  }

  console.log('--- 5. DEPLOYING CLEAN HIT & DEAD FRAMES ---');
  {
    const rawHit = await sharp('clean_dino_hit.png').raw().toBuffer({ resolveWithObject: true });
    const cleanHit = cleanSpriteData(rawHit.data, rawHit.info.width, rawHit.info.height, 'dino');
    await sharp(cleanHit, { raw: { width: rawHit.info.width, height: rawHit.info.height, channels: 4 } })
      .png().toFile(path.join(SPRITES_DIR, 'dino_hit.png'));
    console.log('✓ dino_hit.png deployed');

    const rawDead = await sharp('clean_dino_dead.png').raw().toBuffer({ resolveWithObject: true });
    const cleanDead = cleanSpriteData(rawDead.data, rawDead.info.width, rawDead.info.height, 'dino_dead');
    await sharp(cleanDead, { raw: { width: rawDead.info.width, height: rawDead.info.height, channels: 4 } })
      .png().toFile(path.join(SPRITES_DIR, 'dino_dead.png'));
    console.log('✓ dino_dead.png deployed');
  }

  console.log('--- 6. DEPLOYING CLEAN CACTI ---');
  for (const c of ['cactus_single', 'cactus_double', 'cactus_small', 'cactus_tall']) {
    const raw = await sharp(path.join(SPRITES_DIR, `${c}.png`)).raw().toBuffer({ resolveWithObject: true });
    const clean = cleanSpriteData(raw.data, raw.info.width, raw.info.height, 'cactus');
    await sharp(clean, { raw: { width: raw.info.width, height: raw.info.height, channels: 4 } })
      .png().toFile(path.join(SPRITES_DIR, `${c}.png`));
    console.log(`✓ ${c}.png cleaned`);
  }

  console.log('--- 7. DEPLOYING PTERODACTYL FRAMES (WINGS UP & WINGS DOWN) ---');
  {
    // Wings Up: test_ptero_up.png
    const rawUp = await sharp('test_ptero_up.png').raw().toBuffer({ resolveWithObject: true });
    const cleanUp = cleanSpriteData(rawUp.data, rawUp.info.width, rawUp.info.height, 'ptero');
    await sharp(cleanUp, { raw: { width: rawUp.info.width, height: rawUp.info.height, channels: 4 } })
      .png().toFile(path.join(SPRITES_DIR, 'pterodactyl_0.png'));
    console.log('✓ pterodactyl_0.png deployed (Wings Up)');

    // Wings Down: test_ptero_flap_down_clean.png
    const rawDown = await sharp('test_ptero_flap_down_clean.png').raw().toBuffer({ resolveWithObject: true });
    const cleanDown = cleanSpriteData(rawDown.data, rawDown.info.width, rawDown.info.height, 'ptero');
    await sharp(cleanDown, { raw: { width: rawDown.info.width, height: rawDown.info.height, channels: 4 } })
      .png().toFile(path.join(SPRITES_DIR, 'pterodactyl_1.png'));
    console.log('✓ pterodactyl_1.png deployed (Wings Down)');
  }

  console.log('\n=== ALL SPRITES DEPLOYED CLEANLY ===');
}

processAllSprites();
