const sharp = require('sharp');

(async () => {
  // Let's inspect the eye of dino_run_0 with high precision
  // In dino_run_0 (110x97):
  // Let's crop the eye box: left: 60, top: 14, width: 26, height: 24
  const eyeCrop = await sharp('assets/sprites/dino_run_0.png')
    .extract({ left: 60, top: 14, width: 26, height: 24 })
    .toFile('master_eye_crop.png');
  console.log('Created master_eye_crop.png');

  // Also crop the entire head of dino_run_0:
  // left: 48, top: 5, width: 56, height: 48
  const headCrop = await sharp('assets/sprites/dino_run_0.png')
    .extract({ left: 48, top: 5, width: 56, height: 48 })
    .toFile('master_head_crop.png');
  console.log('Created master_head_crop.png');
})();
