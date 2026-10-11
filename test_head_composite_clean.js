const sharp = require('sharp');

(async () => {
  const head = await sharp('master_head_crop.png').toBuffer();
  
  for (let i = 0; i < 5; i++) {
    // If i === 0, it's already the source of master_head_crop
    if (i === 0) {
      await sharp('test_clean_run_0.png').toFile('flawless_run_0.png');
      continue;
    }

    // Load original frame i
    const { data, info } = await sharp(`test_clean_run_0.png`) // let's load from original clean if possible
    ;
  }
})();
