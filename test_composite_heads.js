const sharp = require('sharp');

(async () => {
  // Let's create an alpha feathered mask or seamless composite for the master head
  const head = await sharp('master_head_crop.png').toBuffer();
  
  for (let i = 1; i < 5; i++) {
    // Composite onto dino_run_i at left: 48, top: 5
    const out = await sharp(`assets/sprites/dino_run_${i}.png`)
      .composite([{
        input: head,
        left: 48,
        top: 5
      }])
      .toFile(`test_composite_run_${i}.png`);
    console.log(`Created test_composite_run_${i}.png`);
  }
})();
