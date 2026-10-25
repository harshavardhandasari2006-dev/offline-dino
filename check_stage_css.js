const sharp = require('sharp');

async function checkAlignment() {
  const pano = await sharp('assets/sprites/homepage_seamless_panorama.jpg').raw().toBuffer({ resolveWithObject: true });
  const pw = pano.info.width, ph = pano.info.height;
  const pdata = pano.data;

  const skin = await sharp('assets/sprites/home_dino_skin_green.png').raw().toBuffer({ resolveWithObject: true });
  const sw = skin.info.width, sh = skin.info.height;
  const sdata = skin.data;

  console.log(`Pano is ${pw}x${ph}, Skin is ${sw}x${sh}`);

  // In index.html, homeMasterBg is styled as:
  // Let's check css for #homeMasterBg and .homepage-stage!
}

checkAlignment().catch(console.error);
