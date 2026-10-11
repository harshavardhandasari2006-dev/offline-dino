const sharp = require('sharp');

(async () => {
  for (let i = 0; i < 5; i++) {
    await sharp(`assets/sprites/dino_run_${i}.png`)
      .extract({ left: 45, top: 5, width: 55, height: 48 })
      .toFile(`head_run_${i}.png`);
  }
  console.log('Saved head crops head_run_0.png through head_run_4.png');
})();
