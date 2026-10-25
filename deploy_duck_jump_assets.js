const fs = require('fs');
const path = require('path');

const srcDuckDir = path.join(__dirname, 'test_duck_jump_animations', 'duck_frames');
const srcJumpDir = path.join(__dirname, 'test_duck_jump_animations', 'jump_frames');
const targetSpritesDir = path.join(__dirname, 'assets', 'sprites');

console.log('Copying approved Duck and Jump frames into assets/sprites/ ...');

// 1. Copy 10 Duck frames
for (let i = 1; i <= 10; i++) {
  const pad = i.toString().padStart(2, '0');
  const src = path.join(srcDuckDir, `duck_${pad}.png`);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source duck frame: ${src}`);
  }
  // Copy as duck_XX.png
  fs.copyFileSync(src, path.join(targetSpritesDir, `duck_${pad}.png`));
  // Also copy as dino_duck_${i-1}.png for backwards compatibility
  fs.copyFileSync(src, path.join(targetSpritesDir, `dino_duck_${i - 1}.png`));
}
console.log('Copied 10 approved Duck frames (duck_01..10 and dino_duck_0..9).');

// 2. Copy 10 Jump frames
for (let i = 1; i <= 10; i++) {
  const pad = i.toString().padStart(2, '0');
  const src = path.join(srcJumpDir, `jump_${pad}.png`);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source jump frame: ${src}`);
  }
  // Copy as jump_XX.png
  fs.copyFileSync(src, path.join(targetSpritesDir, `jump_${pad}.png`));
  // Also copy as dino_jump_${i-1}.png for backwards compatibility
  fs.copyFileSync(src, path.join(targetSpritesDir, `dino_jump_${i - 1}.png`));
}
console.log('Copied 10 approved Jump frames (jump_01..10 and dino_jump_0..9).');

// 3. Re-bake js/sprite_data.js
const files = fs.readdirSync(targetSpritesDir).filter(f => f.endsWith('.png'));
const spriteMap = {};
for (const file of files) {
  const key = file.replace('.png', '');
  const buf = fs.readFileSync(path.join(targetSpritesDir, file));
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
