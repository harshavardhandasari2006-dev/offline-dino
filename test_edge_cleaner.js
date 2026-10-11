const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SPRITES_DIR = path.join(__dirname, 'assets', 'sprites');

function isHaloPixel(r, g, b, a, x, y, w, h, spriteType) {
  if (a === 0) return false;
  
  // Semi-transparent fringe with light color
  if (a < 180 && (r > 130 || g > 140 || b > 120)) return true;
  
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  
  if (spriteType === 'cactus') {
    // Flower is orange/red: r > 160, g < 130, b < 80 near top (y < 15)
    if (y < 15 && r > 150 && g < 130 && b < 90) return false;
    // Cactus green: g > r, g > b, b < 80
    // Outline: r < 75, g < 85, b < 65
    // Anything with b > 75 or r > 130 is sky/cloud/halo
    if (b > 70) return true;
    if (r > 130 && g > 140) return true;
    if (lum > 150 && b > 60) return true;
    return false;
  }
  
  if (spriteType === 'ptero') {
    // Pterodactyl has NO blue: all body/wings have b < 90
    // Eyes are interior (not on outer perimeter of transparent sprite)
    if (b > 95) return true;
    if (lum > 175 && (r > 160 && g > 160 && b > 110)) return true;
    if (g > 170 && b > 85) return true;
    return false;
  }
  
  // Dinosaur:
  // Interior belly/chin (cream/yellow): r > 190, g > 170, b < 150, r - b >= 35
  // Claws (toenails at y >= 95): r > 180, g > 170, b < 140
  // Green skin: g > r + 10, g > b + 20
  // Outline: r < 90, g < 110, b < 85
  // Dead stars (for dino_dead): r > 190, g > 160, b < 110, y < 45
  
  // Preserve toenails/claws at bottom:
  if (y >= 94 && r > 180 && g > 170 && b < 150 && (r - b >= 30)) {
    return false;
  }
  // Preserve chin/belly if cream/yellow:
  if (r > 195 && g > 180 && b < 155 && (r - b >= 40)) {
    return false;
  }
  // Preserve dead star:
  if (spriteType === 'dino_dead' && y < 45 && r > 180 && g > 150 && b < 110) {
    return false;
  }
  
  // Sky/cloud halo:
  // Cyan/sky: b > 120 && lum > 135
  if (b > 115 && lum > 135) return true;
  // White/pale border:
  if (r > 155 && g > 165 && b > 135) return true;
  if (r > 175 && g > 175 && b > 160) return true;
  if (lum > 170 && b > 100) return true;
  // Faded green-cyan sky transition:
  if (g > 180 && b > 130 && r > 140) return true;
  if (b > 130) return true;

  return false;
}

async function testClean(file) {
  const filePath = path.join(SPRITES_DIR, file);
  const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.from(data);
  
  let spriteType = 'dino';
  if (file.startsWith('cactus_')) spriteType = 'cactus';
  else if (file.startsWith('pterodactyl_')) spriteType = 'ptero';
  else if (file === 'dino_dead.png') spriteType = 'dino_dead';
  
  let totalCleared = 0;
  // Perform 4 passes to clean anti-aliasing layers from outer perimeter inward
  for (let pass = 0; pass < 4; pass++) {
    let passCleared = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels;
        const a = out[idx + 3];
        if (a === 0) continue;
        
        // Check if touches transparency (8 neighbors)
        let touchesTransparent = false;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            touchesTransparent = true;
            break;
          } else {
            const nidx = (ny * width + nx) * channels;
            if (out[nidx + 3] === 0) {
              touchesTransparent = true;
              break;
            }
          }
        }
        
        if (touchesTransparent) {
          const r = out[idx], g = out[idx + 1], b = out[idx + 2];
          if (isHaloPixel(r, g, b, a, x, y, width, height, spriteType)) {
            out[idx] = 0;
            out[idx + 1] = 0;
            out[idx + 2] = 0;
            out[idx + 3] = 0;
            passCleared++;
          }
        }
      }
    }
    totalCleared += passCleared;
    if (passCleared === 0) break;
  }
  
  console.log(`[${file}] Cleared ${totalCleared} halo pixels.`);
  await sharp(out, { raw: { width, height, channels } }).png().toFile('test_clean_' + file);
}

async function run() {
  await testClean('dino_idle_0.png');
  await testClean('cactus_single.png');
  await testClean('pterodactyl_0.png');
}

run();
