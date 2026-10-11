const sharp = require('sharp');
const fs = require('fs');

(async () => {
  // Let's test on test_clean_run_0.png and other test run crops if they exist
  // Or run extract_all_perfect_master.js logic for panel 2 (running frames)
  // Let's inspect where panel 2 frames are in assets/style1_reference.jpg:
  const { data, info } = await sharp('assets/style1_reference.jpg').raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  console.log('style1_reference dimensions:', W, H);
})();
