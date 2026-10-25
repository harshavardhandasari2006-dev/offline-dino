const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const previewDir = 'repaired_assets_phase2/previews';

async function createContactSheet({ category, files, cols, rows, title, subtitle, filename, contrastBg }) {
  const cellW = 136;
  const cellH = 116;
  const pad = 10;
  const labelH = 24;
  const topHeaderH = 50;

  const totalW = cols * (cellW + pad) + pad;
  const totalH = rows * (cellH + labelH + pad) + pad + topHeaderH;

  const composites = [];

  // Header SVG
  const safeTitle = title.replace(/&/g, '&amp;');
  const safeSubtitle = subtitle.replace(/&/g, '&amp;');
  const headerSvg = Buffer.from(`
    <svg width="${totalW}" height="${topHeaderH}">
      <rect width="100%" height="100%" fill="#0f172a"/>
      <text x="16" y="32" font-family="Segoe UI, sans-serif" font-size="18" font-weight="700" fill="#38bdf8">${safeTitle}</text>
      <text x="${totalW - 16}" y="32" text-anchor="end" font-family="Segoe UI, sans-serif" font-size="12" fill="#94a3b8">${safeSubtitle}</text>
    </svg>
  `);
  composites.push({ input: headerSvg, top: 0, left: 0 });

  for (let i = 0; i < files.length; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = pad + c * (cellW + pad);
    const y = topHeaderH + pad + r * (cellH + labelH + pad);

    const f = files[i];

    // Card background pattern / contrast
    let cardSvg;
    if (contrastBg === 'magenta') {
      // Solid high-contrast magenta to expose any white or transparent defects
      cardSvg = Buffer.from(`
        <svg width="${cellW}" height="${cellH + labelH}">
          <rect width="${cellW}" height="${cellH + labelH}" rx="6" fill="#ff00ff" stroke="#334155" stroke-width="1.5"/>
          <line x1="0" y1="108" x2="${cellW}" y2="108" stroke="#00ffff" stroke-width="1" stroke-dasharray="2,2"/>
          <rect x="0" y="${cellH}" width="${cellW}" height="${labelH}" fill="#1e293b"/>
          <text x="${cellW / 2}" y="${cellH + 16}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="11" font-weight="700" fill="#f8fafc">
            ${f.label}
          </text>
        </svg>
      `);
    } else {
      // Dark slate with alpha checkerboard
      cardSvg = Buffer.from(`
        <svg width="${cellW}" height="${cellH + labelH}">
          <defs>
            <pattern id="chk_${category}_${i}" width="16" height="16" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill="#1e293b"/>
              <rect x="8" width="8" height="8" fill="#334155"/>
              <rect y="8" width="8" height="8" fill="#334155"/>
              <rect x="8" y="8" width="8" height="8" fill="#1e293b"/>
            </pattern>
          </defs>
          <rect width="${cellW}" height="${cellH + labelH}" rx="6" fill="url(#chk_${category}_${i})" stroke="#475569" stroke-width="1.5"/>
          <line x1="0" y1="108" x2="${cellW}" y2="108" stroke="#ef4444" stroke-width="1" stroke-dasharray="2,2"/>
          <rect x="0" y="${cellH}" width="${cellW}" height="${labelH}" fill="#0f172a"/>
          <text x="${cellW / 2}" y="${cellH + 16}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="11" font-weight="700" fill="#38bdf8">
            ${f.label}
          </text>
        </svg>
      `);
    }
    composites.push({ input: cardSvg, top: y, left: x });

    // Dinosaur image
    const dinoBuf = fs.readFileSync(f.path);
    composites.push({ input: dinoBuf, top: y, left: x });
  }

  const outPath = path.join(previewDir, filename);
  await sharp({
    create: {
      width: totalW,
      height: totalH,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 }
    }
  }).composite(composites).png().toFile(outPath);

  console.log(`Generated preview: ${outPath} (${totalW}x${totalH})`);
}

async function buildAllPreviews() {
  // A. RUNNING (16 frames, 8 cols x 2 rows)
  const runFiles = [];
  for (let i = 1; i <= 16; i++) {
    const num = i.toString().padStart(2, '0');
    runFiles.push({
      path: `repaired_assets_phase2/running/run_${num}.png`,
      label: `run_${num}.png`
    });
  }

  // 1. Running Contact Sheet (Checkerboard)
  await createContactSheet({
    category: 'run',
    files: runFiles,
    cols: 8,
    rows: 2,
    title: 'OFFLINE DINO — Running Animation Contact Sheet (16 Frames)',
    subtitle: 'Strict Sequential Playback: Frame 01 → 16 (Loop) | Baseline y=108px',
    filename: 'contact_sheet_running_16.png',
    contrastBg: 'checkerboard'
  });

  // 2. Running Contrast Preview (Solid Magenta)
  await createContactSheet({
    category: 'run_mag',
    files: runFiles,
    cols: 8,
    rows: 2,
    title: 'OFFLINE DINO — Running Alpha Transparency Contrast Audit (Magenta Test)',
    subtitle: 'Exposes Edge Halos & Internal Sclera/Pupil Integrity | Cyan Baseline y=108px',
    filename: 'contrast_running_magenta_16.png',
    contrastBg: 'magenta'
  });

  // B. DUCKING (27 frames, 9 cols x 3 rows)
  const duckFiles = [];
  for (let i = 0; i < 27; i++) {
    const num = i.toString().padStart(2, '0');
    const phaseLabel = i < 9 ? 'Entry' : (i < 18 ? 'Slide' : 'Rise');
    duckFiles.push({
      path: `repaired_assets_phase2/ducking/duck_${num}.png`,
      label: `d_${num} (${phaseLabel})`
    });
  }

  // 1. Ducking Contact Sheet (Checkerboard)
  await createContactSheet({
    category: 'duck',
    files: duckFiles,
    cols: 9,
    rows: 3,
    title: 'OFFLINE DINO — Ducking & Crawling Animation Contact Sheet (27 Frames)',
    subtitle: 'Row 0: Entry Drop (0..8) | Row 1: Low Slide (9..17) | Row 2: Recovery (18..26)',
    filename: 'contact_sheet_ducking_27.png',
    contrastBg: 'checkerboard'
  });

  // 2. Ducking Contrast Preview (Solid Magenta)
  await createContactSheet({
    category: 'duck_mag',
    files: duckFiles,
    cols: 9,
    rows: 3,
    title: 'OFFLINE DINO — Ducking Alpha Transparency Contrast Audit (Magenta Test)',
    subtitle: 'Verifies Natural Anatomical Crouch & Genuine Alpha | Cyan Baseline y=108px',
    filename: 'contrast_ducking_magenta_27.png',
    contrastBg: 'magenta'
  });

  // C. JUMPING (20 frames, 10 cols x 2 rows)
  const jumpFiles = [];
  for (let i = 0; i < 20; i++) {
    const num = i.toString().padStart(2, '0');
    const phaseLabel = i < 3 ? 'Takeoff' : (i < 7 ? 'Ascent' : (i < 9 ? 'Apex' : (i < 14 ? 'Descent' : (i < 17 ? 'Land' : 'Rebound'))));
    jumpFiles.push({
      path: `repaired_assets_phase2/jumping/jump_${num}.png`,
      label: `j_${num} (${phaseLabel})`
    });
  }

  // 1. Jumping Contact Sheet (Checkerboard)
  await createContactSheet({
    category: 'jump',
    files: jumpFiles,
    cols: 10,
    rows: 2,
    title: 'OFFLINE DINO — Jumping Trajectory Animation Contact Sheet (20 Frames)',
    subtitle: 'Takeoff (0..2) | Ascent (3..6) | Apex (7..8) | Descent (9..13) | Impact/Recovery (14..19)',
    filename: 'contact_sheet_jumping_20.png',
    contrastBg: 'checkerboard'
  });

  // 2. Jumping Contrast Preview (Solid Magenta)
  await createContactSheet({
    category: 'jump_mag',
    files: jumpFiles,
    cols: 10,
    rows: 2,
    title: 'OFFLINE DINO — Jumping Alpha Transparency Contrast Audit (Magenta Test)',
    subtitle: 'Preserves True Airborne Elevation Above Baseline | Cyan Baseline y=108px',
    filename: 'contrast_jumping_magenta_20.png',
    contrastBg: 'magenta'
  });
}

buildAllPreviews().catch(console.error);
