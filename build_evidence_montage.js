const sharp = require('sharp');
const fs = require('fs');

async function buildEvidenceMontage() {
  console.log('Building gameplay animation evidence montage...');

  // The dinosaur in gameplay is located around x: 100..260, y: 350..580 on the 1200x800 canvas
  const crops = [
    { label: 'Run Stride A', file: 'audit_evidence/audit_2_running_stride_0.png', rect: { left: 90, top: 380, width: 220, height: 180 } },
    { label: 'Run Stride B', file: 'audit_evidence/audit_2_running_stride_2.png', rect: { left: 90, top: 380, width: 220, height: 180 } },
    { label: 'Jump Takeoff', file: 'audit_evidence/audit_3_jump_takeoff.png', rect: { left: 90, top: 380, width: 220, height: 180 } },
    { label: 'Jump Ascent', file: 'audit_evidence/audit_3_jump_ascent.png', rect: { left: 90, top: 320, width: 220, height: 180 } },
    { label: 'Jump Apex', file: 'audit_evidence/audit_3_jump_apex.png', rect: { left: 90, top: 220, width: 220, height: 180 } },
    { label: 'Jump Landing', file: 'audit_evidence/audit_3_jump_landing.png', rect: { left: 90, top: 380, width: 220, height: 180 } },
    { label: 'Duck Entry', file: 'audit_evidence/audit_4_duck_entry.png', rect: { left: 90, top: 380, width: 220, height: 180 } },
    { label: 'Duck Slide', file: 'audit_evidence/audit_4_duck_sustained_slide.png', rect: { left: 90, top: 380, width: 220, height: 180 } },
    { label: 'Duck Recovery', file: 'audit_evidence/audit_4_duck_recovery.png', rect: { left: 90, top: 380, width: 220, height: 180 } },
    { label: 'Game Over', file: 'audit_evidence/audit_6_game_over_dead.png', rect: { left: 90, top: 380, width: 220, height: 180 } }
  ];

  const cols = 5;
  const rows = 2;
  const cellW = 220, cellH = 180;
  const montageW = cols * cellW, montageH = rows * cellH;

  const composites = [];
  for (let i = 0; i < crops.length; i++) {
    const item = crops[i];
    if (!fs.existsSync(item.file)) continue;

    const cropped = await sharp(item.file)
      .extract(item.rect)
      .toBuffer();

    const col = i % cols;
    const row = Math.floor(i / cols);
    const left = col * cellW;
    const top = row * cellH;

    composites.push({ input: cropped, left, top });
  }

  await sharp({
    create: {
      width: montageW,
      height: montageH,
      channels: 4,
      background: { r: 20, g: 20, b: 20, alpha: 1 }
    }
  })
  .composite(composites)
  .png()
  .toFile('audit_evidence/audit_gameplay_montage.png');

  console.log('Saved audit_evidence/audit_gameplay_montage.png');
}

buildEvidenceMontage();
