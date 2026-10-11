const fs = require('fs');
const path = require('path');

const spritesDir = path.join(__dirname, 'assets', 'sprites');
const files = fs.readdirSync(spritesDir).filter(f => f.endsWith('.png'));

const spriteMap = {};
for (const file of files) {
  const key = file.replace('.png', '');
  const buf = fs.readFileSync(path.join(spritesDir, file));
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
console.log(`Successfully updated js/sprite_data.js with ${keys.length} sprites.`);
