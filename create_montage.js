const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createMontage() {
  const cellW = 136;
  const cellH = 116;
  const cols = 8;
  const rows = 2;
  const pad = 12;
  const labelH = 26;

  const totalW = cols * (cellW + pad) + pad;
  const totalH = rows * (cellH + labelH + pad) + pad + 56;

  const composites = [];

  const titleSvg = Buffer.from(`
    <svg width="${totalW}" height="56">
      <rect width="100%" height="100%" fill="#0f172a"/>
      <text x="20" y="36" font-family="Segoe UI, -apple-system, sans-serif" font-size="20" font-weight="700" fill="#38bdf8">
        OFFLINE DINO — 16-FRAME PRODUCTION RUNNING ANIMATION AUDIT
      </text>
      <text x="${totalW - 20}" y="36" text-anchor="end" font-family="Segoe UI, -apple-system, sans-serif" font-size="13" font-weight="500" fill="#94a3b8">
        Strict Sequence: 01 → 16 (Loop) | 136×116 Uniform Canvas | Ground Baseline 108px
      </text>
    </svg>
  `);
  composites.push({ input: titleSvg, top: 0, left: 0 });

  for (let i = 1; i <= 16; i++) {
    const idx = i - 1;
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const x = pad + c * (cellW + pad);
    const y = 56 + pad + r * (cellH + labelH + pad);

    const frameFile = 'assets/sprites/run_' + i.toString().padStart(2, '0') + '.png';

    const cardSvg = Buffer.from(`
      <svg width="${cellW}" height="${cellH + labelH}">
        <defs>
          <pattern id="chk_${i}" width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#1e293b" />
            <rect x="8" width="8" height="8" fill="#334155" />
            <rect y="8" width="8" height="8" fill="#334155" />
            <rect x="8" y="8" width="8" height="8" fill="#1e293b" />
          </pattern>
        </defs>
        <rect width="${cellW}" height="${cellH + labelH}" rx="8" fill="url(#chk_${i})" stroke="#475569" stroke-width="1.5"/>
        <rect x="0" y="${cellH}" width="${cellW}" height="${labelH}" fill="#1e293b" rx="0"/>
        <line x1="0" y1="108" x2="${cellW}" y2="108" stroke="#ef4444" stroke-width="1" stroke-dasharray="2,2"/>
        <text x="${cellW / 2}" y="${cellH + 18}" text-anchor="middle" font-family="Segoe UI, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#38bdf8">
          run_${i.toString().padStart(2, '0')}.png
        </text>
      </svg>
    `);
    composites.push({ input: cardSvg, top: y, left: x });

    const dinoImgBuf = fs.readFileSync(frameFile);
    composites.push({ input: dinoImgBuf, top: y, left: x });
  }

  await sharp({
    create: {
      width: totalW,
      height: totalH,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 }
    }
  }).composite(composites).png().toFile('audit_evidence/audit_16_frame_montage.png');

  console.log('Created audit_evidence/audit_16_frame_montage.png');
  fs.copyFileSync('audit_evidence/audit_16_frame_montage.png', 'C:\\Users\\asus\\.gemini\\antigravity-ide\\brain\\93f495db-673d-4394-aa97-d24e9db54f56\\audit_16_frame_montage.png');
  console.log('Copied to brain directory');
}

createMontage();
