const fs = require('fs');
const path = require('path');

const keys = [
  'dino_home_idle',
  'dino_home_sclera',
  'dino_home_blink',
  'dino_home_hover',
  'dino_home_tongue_01',
  'dino_home_tongue_02',
  'dino_home_tongue_03'
];

let spriteDataJs = fs.readFileSync('e:\\dino\\js\\sprite_data.js', 'utf8');

keys.forEach(k => {
  const p = path.join('e:\\dino\\assets\\sprites', k + '.png');
  if (fs.existsSync(p)) {
    const b64 = 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
    if (spriteDataJs.includes('"' + k + '":')) {
      const re = new RegExp('"' + k + '":\\s*"[^"]*"');
      spriteDataJs = spriteDataJs.replace(re, '"' + k + '": "' + b64 + '"');
    } else {
      const lastBrace = spriteDataJs.lastIndexOf('}');
      spriteDataJs = spriteDataJs.slice(0, lastBrace) + '  "' + k + '": "' + b64 + '",\n' + spriteDataJs.slice(lastBrace);
    }
    console.log('Added ' + k + ' (' + b64.length + ' chars)');
  } else {
    console.error('Missing ' + p);
  }
});

fs.writeFileSync('e:\\dino\\js\\sprite_data.js', spriteDataJs, 'utf8');
console.log('Updated e:\\dino\\js\\sprite_data.js successfully!');
