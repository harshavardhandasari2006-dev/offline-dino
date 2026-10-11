const sharp = require('sharp');

(async () => {
  // In dino_run_0 (110x97), the eye center was at (74.4, 23.9)
  // Our 24x24 master eye has center at (12, 12)
  // So top-left is at (74.4 - 12 = 62.4, 23.9 - 12 = 11.9) -> left: 62, top: 12
  const eye = await sharp('master_eye_open_24.png').toBuffer();

  const testDino = await sharp('assets/sprites/dino_run_0.png')
    .composite([{
      input: eye,
      left: 62,
      top: 12
    }])
    .toFile('test_dino_run_0_master_eye.png');
  console.log('Saved test_dino_run_0_master_eye.png');
})();
