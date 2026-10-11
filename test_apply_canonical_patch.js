const sharp = require('sharp');

(async () => {
  const patch = await sharp('canonical_eye_patch.png').toBuffer();
  
  // In dino_run_0, patch was extracted from x0: 58, y0: 11
  // On other run frames (110x97):
  const runOffsets = [
    { left: 58, top: 11 }, // run_0
    { left: 57, top: 10 }, // run_1
    { left: 56, top: 9  }, // run_2
    { left: 57, top: 10 }, // run_3
    { left: 57, top: 10 }  // run_4
  ];

  for (let i = 0; i < 5; i++) {
    const { left, top } = runOffsets[i];
    await sharp(`test_clean_run_0.png`) // or original frame
      // let's use the actual body of frame i!
      // To get frame i body without our previous test edits, let's load from assets or re-extract
    ;
  }
})();
