const sharp = require('sharp');

(async () => {
  const patch = await sharp('canonical_eye_patch.png').toBuffer();
  
  // In dino_run_0, patch was extracted from x0: 58, y0: 11
  // On each run frame (110x97):
  const runOffsets = [
    { left: 58, top: 11 }, // run_0
    { left: 57, top: 10 }, // run_1
    { left: 56, top: 9  }, // run_2
    { left: 57, top: 10 }, // run_3
    { left: 57, top: 10 }  // run_4
  ];

  for (let i = 0; i < 5; i++) {
    const { left, top } = runOffsets[i];
    // Re-extract raw from style1_reference.jpg to ensure 100% clean source
    // cx = [543, 648, 752, 860, 968][i]
    // Or load from test_main_run_0 or similar if available, or extract
    console.log(`Frame ${i} patch at ${left}, ${top}`);
  }
})();
