const sharp = require('sharp');
const path = require('path');
const uploadDir = 'C:\\Users\\asus\\.gemini\\antigravity-ide\\brain\\1c3e5139-b62e-4146-8621-13708d351c51\\.user_uploaded';
const refPath = path.join(uploadDir, 'media_1792219879817.jpg');

async function buildMasterBg() {
  const { data: ref } = await sharp(refPath).raw().toBuffer({ resolveWithObject: true });
  const w = 1024, h = 576;
  const out = Buffer.from(ref);

  // 1. Inpaint behind the central hero (x: 235 to 788, y: 0 to 328):
  // Let's sample sky gradient from x=150 and x=870
  // For each y from 0 to 280, interpolate sky between left sky and right sky:
  for (let y = 0; y < 280; y++) {
    const leftIdx = (y * w + 180) * 3;
    const rightIdx = (y * w + 840) * 3;
    const rL = ref[leftIdx], gL = ref[leftIdx+1], bL = ref[leftIdx+2];
    const rR = ref[rightIdx], gR = ref[rightIdx+1], bR = ref[rightIdx+2];

    for (let x = 238; x <= 785; x++) {
      // Check if this pixel is foreground (dino, leaves, sign, etc.)
      // In the hero box, if it's not pure sky/cloud:
      const idx = (y * w + x) * 3;
      const r = ref[idx], g = ref[idx+1], b = ref[idx+2];
      
      const t = (x - 238) / (785 - 238);
      // Interpolated clean sky
      const skyR = Math.round(rL * (1 - t) + rR * t);
      const skyG = Math.round(gL * (1 - t) + gR * t);
      const skyB = Math.round(bL * (1 - t) + bR * t);

      // In the hero region, replace dino/sign/leaves with sky:
      // Keep pure cloud pixels if they are white/light cyan (r > 190, g > 210, b > 235)
      const isCloud = (r > 190 && g > 210 && b > 235);
      if (!isCloud) {
        out[idx] = skyR;
        out[idx+1] = skyG;
        out[idx+2] = skyB;
      }
    }
  }

  // From y = 280 to 380 (distant mesas/horizon behind sign):
  // We can sample distant mesas from x=210..235 and x=785..810:
  for (let y = 280; y < 380; y++) {
    const leftIdx = (y * w + 220) * 3;
    const rightIdx = (y * w + 800) * 3;
    const rL = ref[leftIdx], gL = ref[leftIdx+1], bL = ref[leftIdx+2];
    const rR = ref[rightIdx], gR = ref[rightIdx+1], bR = ref[rightIdx+2];

    for (let x = 238; x <= 785; x++) {
      const idx = (y * w + x) * 3;
      const t = (x - 238) / (785 - 238);
      out[idx] = Math.round(rL * (1 - t) + rR * t);
      out[idx+1] = Math.round(gL * (1 - t) + gR * t);
      out[idx+2] = Math.round(bL * (1 - t) + bR * t);
    }
  }

  // 2. In the region of the two stone pedestals (x: 360 to 664, y: 380 to 445):
  // We PRESERVE the two stone pedestals from ref!
  // But inside the orange Start Game button (x: 360 to 664, y: 328 to 395):
  // If it's orange button or white text, fill with sky / distant mesa
  for (let y = 328; y < 390; y++) {
    for (let x = 360; x <= 664; x++) {
      const idx = (y * w + x) * 3;
      const r = ref[idx], g = ref[idx+1], b = ref[idx+2];
      const isOrangeBtn = (r > 180 && g > 80 && b < 60);
      const isWhiteText = (r > 200 && g > 200 && b > 200);
      const isDarkBorder = (r < 60 && g < 40 && b < 40);
      if (isOrangeBtn || isWhiteText || isDarkBorder) {
        // Sample horizon at x=340
        const sampleIdx = (y * w + 340) * 3;
        out[idx] = ref[sampleIdx];
        out[idx+1] = ref[sampleIdx+1];
        out[idx+2] = ref[sampleIdx+2];
      }
    }
  }

  // 3. In the bottom menu region (x: 90 to 935, y: 416 to 520):
  // We want clean, seamless sand floor behind the buttons!
  // In Screenshot 2, the sand floor starts around y=440 and extends to 576.
  // Between the buttons, and below the buttons (y > 516), we have authentic sand!
  // For each column x, we can smoothly interpolate sand from y=520 upward:
  for (let y = 435; y < 516; y++) {
    for (let x = 90; x <= 935; x++) {
      const idx = (y * w + x) * 3;
      // Sample sand at (x, 525)
      const sandIdx = (525 * w + x) * 3;
      // Slight vertical gradient: sand is slightly lighter towards horizon
      const sandFactor = 1.0 + (516 - y) * 0.0015;
      out[idx] = Math.min(255, Math.round(ref[sandIdx] * sandFactor));
      out[idx+1] = Math.min(255, Math.round(ref[sandIdx+1] * sandFactor));
      out[idx+2] = Math.min(255, Math.round(ref[sandIdx+2] * sandFactor));
    }
  }

  await sharp(out, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toFile('scratch_clean_master_bg.png');
  console.log('Saved scratch_clean_master_bg.png');
}
buildMasterBg();
