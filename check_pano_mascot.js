const sharp = require('sharp');

async function checkPanoMascot() {
  const pano = await sharp('assets/sprites/homepage_seamless_panorama.jpg').raw().toBuffer({ resolveWithObject: true });
  const pw = pano.info.width, ph = pano.info.height;
  console.log(`Pano is ${pw}x${ph}`);

  // In CSS:
  // left: 42.96875% -> 1920 * 0.4296875 = 825
  // top: 16.493056% -> 1080 * 0.16493056 = 178.125
  // width: 16.6015625% -> 318.75
  // height: 28.645833% -> 309.375
  console.log('Overlay position on 1920x1080: x=825, y=178, w=319, h=309');

  // Let's crop x: 750..1200, y: 100..500 from homepage_seamless_panorama.jpg to inspect the dinosaur mascot in the panorama
  await sharp('assets/sprites/homepage_seamless_panorama.jpg')
    .extract({ left: 750, top: 100, width: 450, height: 400 })
    .toFile('diagnostic_black_skin/pano_mascot_crop.png');

  // Also check home_title_sign_green.png vs home_title_sign_black.png
  console.log('Saved pano_mascot_crop.png');
}

checkPanoMascot().catch(console.error);
