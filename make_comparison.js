const sharp = require('sharp');

async function makeComparisonVisual() {
  const beforeHead = await sharp('test_50_frames_validation/cleanest_10_cycle/run_01.png')
    .extract({ left: 130, top: 35, width: 100, height: 90 })
    .png().toBuffer();

  const afterHead = await sharp('test_snout_fixed_validation/frame_01.png')
    .extract({ left: 130, top: 35, width: 100, height: 90 })
    .png().toBuffer();

  const refHead = await sharp('test_new_10_validation/ss2_head_crop.png')
    .extract({ left: 135, top: 0, width: 140, height: 120 })
    .resize(100, 90)
    .png().toBuffer();

  const W = 360, H = 150;
  const svg = Buffer.from(`
    <svg width="${W}" height="${H}">
      <style>
        .t { font-family: sans-serif; font-size: 11px; font-weight: bold; text-anchor: middle; }
        .bad { fill: #ef4444; }
        .good { fill: #22c55e; }
        .sub { font-family: sans-serif; font-size: 9px; fill: #94a3b8; text-anchor: middle; }
      </style>
      <text x="60" y="20" class="t bad">BEFORE (Clipped)</text>
      <text x="60" y="136" class="sub">Flat Vertical Edge</text>
      <text x="180" y="20" class="t good">AFTER (Corrected)</text>
      <text x="180" y="136" class="sub">Full Rounded Muzzle</text>
      <text x="300" y="20" class="t good">REFERENCE (SS2)</text>
      <text x="300" y="136" class="sub">Desired Target Anatomy</text>
    </svg>
  `);

  await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 1 } }
  }).composite([
    { input: svg, left: 0, top: 0 },
    { input: beforeHead, left: 10, top: 30 },
    { input: afterHead, left: 130, top: 30 },
    { input: refHead, left: 250, top: 30 }
  ]).png().toFile('test_snout_fixed_validation/snout_before_after_ref.png');

  console.log('Saved test_snout_fixed_validation/snout_before_after_ref.png');
}
makeComparisonVisual();
