const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SPRITES_DIR = path.join(__dirname, 'assets', 'sprites');

async function analyzeAllPerimeters() {
  const files = fs.readdirSync(SPRITES_DIR).filter(f => f.endsWith('.png') && !f.startsWith('bg_'));
  
  for (const file of files) {
    const filePath = path.join(SPRITES_DIR, file);
    const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    
    // Find all pixels that border transparency (a === 0) or the image boundary
    let borderPixels = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels;
        const a = data[idx + 3];
        if (a === 0) continue;
        
        let touchesTransparent = false;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            touchesTransparent = true;
            break;
          } else {
            const nidx = (ny * width + nx) * channels;
            if (data[nidx + 3] === 0) {
              touchesTransparent = true;
              break;
            }
          }
        }
        
        if (touchesTransparent) {
          borderPixels.push({
            x, y,
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2],
            a: data[idx + 3]
          });
        }
      }
    }
    
    // Check for light / pale / white / non-dino border pixels
    // Character colors:
    // Outline: dark (r < 110, g < 110, b < 110)
    // Dino skin: green (g > 110, r < 140, b < 90)
    // Belly / chin: yellow/cream (r > 200, g > 180, b < 140)
    // Toes / claws: yellow/white (y >= 98 in dino: r > 200, g > 200, b < 180)
    // Non-character residue:
    // Anything with b > 120 and r > 140, or high luminance with b > 100, or a < 255 with pale colors
    const suspicious = borderPixels.filter(p => {
      // Sky/cloud residue: high b (sky is blueish) or high brightness
      const lum = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
      // White/pale border
      if (p.r > 150 && p.g > 150 && p.b > 150) return true;
      if (p.b > 120 && lum > 140) return true;
      if (p.r > 170 && p.g > 170) return true;
      return false;
    });
    
    console.log(`[${file}] total border pixels: ${borderPixels.length}, suspicious pale/white pixels: ${suspicious.length}`);
    if (suspicious.length > 0) {
      console.log(`  Sample suspicious for ${file}:`, suspicious.slice(0, 5).map(p => `(${p.x},${p.y}): rgba(${p.r},${p.g},${p.b},${p.a})`));
    }
  }
}

analyzeAllPerimeters();
