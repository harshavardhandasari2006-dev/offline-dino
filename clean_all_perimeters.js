const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SPRITES_DIR = path.join(__dirname, 'assets', 'sprites');

function isEdgeHalo(r, g, b, a, x, y, spriteType) {
  if (a < 180) return true; // Semi-transparent edge fringe

  if (spriteType === 'cactus') {
    // Flower top (y < 16): r > 150, g < 130, b < 90
    if (y < 16 && r > 150 && g < 130 && b < 90) return false;
    // Cactus body: b < 65
    if (b < 65 && g > 60) return false;
    // Outline:
    if (r < 75 && g < 85 && b < 65) return false;
    return true; // Any pixel on cactus perimeter with b >= 65 is sky
  }

  if (spriteType === 'ptero') {
    // Pterodactyl body/wings: b < 90
    if (b < 90) return false;
    return true; // Any pixel on ptero perimeter with b >= 90 is sky
  }

  // Dinosaur:
  // Toenails: y >= 94, r > 185, g > 175, b < 160, |r - g| <= 25
  if (y >= 94 && r > 185 && g > 175 && b < 160 && Math.abs(r - g) <= 25) return false;
  // Cream chin / belly: r > 195, g > 175, r - b >= 35, g - b >= 25
  if (r > 195 && g > 175 && (r - b >= 35) && (g - b >= 25)) return false;
  // Dead stars (y < 45 for dino_dead): r > 190, g > 150, b < 110
  if (spriteType === 'dino_dead' && y < 45 && r > 185 && g > 150 && b < 110) return false;

  // Real green skin has b < 90:
  if (g > r + 12 && g > b + 25 && b < 85) return false;
  // Real dark outline has r, g, b < 85:
  if (r < 85 && g < 95 && b < 80) return false;

  // EVERYTHING ELSE on the outer perimeter is sky/cloud halo!
  // Any pixel with b > 110, or lum > 160, or r > 170 & g > 170:
  return true;
}

async function cleanSpritePerimeter(fileName, spriteType) {
  const filePath = path.join(SPRITES_DIR, fileName);
  const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const out = Buffer.from(data);

  let clearedCount = 0;
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        const a = out[idx + 3];
        if (a === 0) continue;

        let touchesTrans = false;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H || out[(ny * W + nx) * 4 + 3] === 0) {
            touchesTrans = true; break;
          }
        }

        if (touchesTrans) {
          const r = out[idx], g = out[idx + 1], b = out[idx + 2];
          if (isEdgeHalo(r, g, b, a, x, y, spriteType)) {
            out[idx] = 0; out[idx + 1] = 0; out[idx + 2] = 0; out[idx + 3] = 0;
            clearedCount++;
          }
        }
      }
    }
  }

  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(filePath);
  console.log(`[PERIMETER CLEAN] ${fileName.padEnd(20)}: Cleared ${clearedCount} halo pixels.`);
}

async function cleanAll() {
  const files = fs.readdirSync(SPRITES_DIR).filter(f => f.endsWith('.png') && !f.startsWith('bg_'));
  for (const f of files) {
    let type = 'dino';
    if (f.startsWith('cactus_')) type = 'cactus';
    else if (f.startsWith('pterodactyl_')) type = 'ptero';
    else if (f === 'dino_dead.png') type = 'dino_dead';
    await cleanSpritePerimeter(f, type);
  }
}

cleanAll();
