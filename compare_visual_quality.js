const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function measureLaplacianVariance(imgPath, crop) {
  let pipeline = sharp(imgPath);
  if (crop) pipeline = pipeline.extract(crop);
  const { data, info } = await pipeline.greyscale().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;

  let sum = 0, sumSq = 0, count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const center = data[idx];
      const lap = (
        data[(y - 1) * w + x] +
        data[(y + 1) * w + x] +
        data[y * w + (x - 1)] +
        data[y * w + (x + 1)] -
        4 * center
      );
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  return (sumSq / count) - (mean * mean);
}

async function runComparison() {
  const oldPano = path.join(__dirname, 'backup_pre_quality_enhancement/homepage_seamless_panorama.jpg');
  const newPano = path.join(__dirname, 'assets/sprites/homepage_seamless_panorama.jpg');

  const testRegions = [
    { name: 'Full Canvas (1920x1080)', crop: null },
    { name: 'Dino Mascot & Eye', crop: { left: 880, top: 110, width: 280, height: 260 } },
    { name: 'OFFLINE DINO Logo', crop: { left: 520, top: 400, width: 450, height: 160 } },
    { name: 'Start Game Button', crop: { left: 700, top: 620, width: 520, height: 120 } },
    { name: 'Skins Button', crop: { left: 347, top: 838, width: 220, height: 84 } },
    { name: 'High Score Button', crop: { left: 681, top: 838, width: 222, height: 84 } },
    { name: 'Sound Button', crop: { left: 1019, top: 838, width: 218, height: 84 } },
    { name: 'Exit Button', crop: { left: 1353, top: 838, width: 219, height: 84 } },
    { name: 'Left Desert Canyon & Mesa', crop: { left: 40, top: 220, width: 350, height: 350 } },
    { name: 'Right Desert Cacti & Sky', crop: { left: 1530, top: 220, width: 350, height: 350 } }
  ];

  console.log('========================================================================');
  console.log('HOMEPAGE VISUAL QUALITY ENHANCEMENT: OBJECTIVE SHARPNESS COMPARISON');
  console.log('(Metric: Laplacian Edge Variance — Higher indicates sharper, clearer edges)');
  console.log('========================================================================\n');

  const results = [];
  for (const r of testRegions) {
    const oldSharp = await measureLaplacianVariance(oldPano, r.crop);
    const newSharp = await measureLaplacianVariance(newPano, r.crop);
    const gainPct = ((newSharp - oldSharp) / oldSharp * 100).toFixed(1);
    results.push({ region: r.name, before: oldSharp.toFixed(1), after: newSharp.toFixed(1), gain: `+${gainPct}%` });
    console.log(`${r.name.padEnd(30)} | Before: ${oldSharp.toFixed(1).padStart(6)} | After: ${newSharp.toFixed(1).padStart(6)} | Sharpness Gain: +${gainPct}%`);
  }

  // Generate visual comparison montages for audit evidence
  console.log('\nGenerating visual side-by-side comparison images...');
  const montageDir = path.join(__dirname, 'scratch/quality_comparison');
  if (!fs.existsSync(montageDir)) fs.mkdirSync(montageDir, { recursive: true });

  for (const r of testRegions) {
    if (!r.crop) continue;
    const oldBuf = await sharp(oldPano).extract(r.crop).png().toBuffer();
    const newBuf = await sharp(newPano).extract(r.crop).png().toBuffer();

    const compW = r.crop.width * 2 + 10;
    const compH = r.crop.height + 40;

    const svgHeader = `
      <svg width="${compW}" height="${compH}">
        <rect width="${compW}" height="${compH}" fill="#0f172a" />
        <text x="${r.crop.width / 2}" y="25" fill="#f87171" font-size="16" font-weight="bold" font-family="sans-serif" text-anchor="middle">BEFORE (Low-Res 906px Upscaled)</text>
        <text x="${r.crop.width + 10 + r.crop.width / 2}" y="25" fill="#4ade80" font-size="16" font-weight="bold" font-family="sans-serif" text-anchor="middle">AFTER (Enhanced Pristine 2K Master)</text>
        <line x1="${r.crop.width + 5}" y1="0" x2="${r.crop.width + 5}" y2="${compH}" stroke="#334155" stroke-width="2" />
      </svg>
    `;

    const safeName = r.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    await sharp(Buffer.from(svgHeader))
      .composite([
        { input: oldBuf, left: 0, top: 35 },
        { input: newBuf, left: r.crop.width + 10, top: 35 }
      ])
      .png()
      .toFile(path.join(montageDir, `compare_${safeName}.png`));
  }

  console.log(`Saved side-by-side comparison images in ${montageDir}`);
}

runComparison().catch(console.error);
