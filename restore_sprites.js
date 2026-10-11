const fs = require('fs');
const path = require('path');
const SPRITES_DIR = path.join(__dirname, 'assets', 'sprites');

for (let i = 0; i <= 4; i++) {
  fs.copyFileSync(`clean_duck_${i}.png`, path.join(SPRITES_DIR, `dino_duck_${i}.png`));
  fs.copyFileSync(`clean_jump_${i}.png`, path.join(SPRITES_DIR, `dino_jump_${i}.png`));
}
fs.copyFileSync('clean_dino_dead.png', path.join(SPRITES_DIR, 'dino_dead.png'));
fs.copyFileSync('clean_dino_hit.png', path.join(SPRITES_DIR, 'dino_hit.png'));
console.log('✓ Successfully restored approved master sprites');
