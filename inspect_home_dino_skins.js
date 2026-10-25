const sharp = require('sharp');
const fs = require('fs');

async function inspectHomeDinoSkins() {
  const files = fs.readdirSync('assets/sprites').filter(f => f.startsWith('home_dino_skin_'));
  for (const f of files) {
    const meta = await sharp(`assets/sprites/${f}`).metadata();
    console.log(`${f}: ${meta.width}x${meta.height}, format=${meta.format}`);
  }
}

inspectHomeDinoSkins().catch(console.error);
