const sharp = require('sharp');

(async () => {
  const { data, info } = await sharp('assets/sprites/dino_run_0.png').raw().toBuffer({ resolveWithObject: true });
  console.log('--- HEAD & EYE REGION IN dino_run_0 ---');
  for (let y = 10; y < 38; y++) {
    let row = '';
    for (let x = 60; x < 95; x++) {
      const idx = (y * info.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a < 50) {
        row += ' ';
      } else if (r > 200 && g > 200 && b > 200) {
        row += 'W'; // white sclera or highlight
      } else if (r < 50 && g < 50 && b < 50) {
        row += '#'; // dark pupil or outline
      } else if (g > r && g > b) {
        row += '.'; // green skin
      } else {
        row += '+'; // mouth / cream
      }
    }
    console.log(y.toString().padStart(2, '0') + ': ' + row);
  }
})();
