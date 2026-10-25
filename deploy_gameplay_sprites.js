const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'assets', 'sprites');

// 1. Copy 24 run frames
for (let i = 0; i < 24; i++) {
  fs.copyFileSync(`standard_runs/dino_run_${i}.png`, path.join(targetDir, `dino_run_${i}.png`));
}
console.log('Copied 24 run frames.');

// 2. Copy 27 duck frames
for (let i = 0; i < 27; i++) {
  fs.copyFileSync(`standard_ducks/dino_duck_${i}.png`, path.join(targetDir, `dino_duck_${i}.png`));
}
console.log('Copied 27 duck frames.');

// 3. Copy 20 jump frames
for (let i = 0; i < 20; i++) {
  fs.copyFileSync(`standard_jumps/dino_jump_${i}.png`, path.join(targetDir, `dino_jump_${i}.png`));
}
console.log('Copied 20 jump frames.');

// 4. Run update_sprite_data.js logic
require('./update_sprite_data.js');
