const fs = require('fs');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Run Cycle Viewer</title>
<style>
body { background: #1e293b; color: #fff; font-family: sans-serif; text-align: center; margin: 20px; }
.card { background: #334155; border-radius: 12px; padding: 20px; margin: 20px auto; max-width: 800px; }
.row { display: flex; justify-content: center; gap: 12px; margin-top: 15px; flex-wrap: wrap; }
canvas { background: #4da6ff; border: 3px solid #64748b; border-radius: 8px; image-rendering: pixelated; }
.frame-box { display: flex; flex-direction: column; align-items: center; }
.frame-box img { background: #4da6ff; border: 2px solid #94a3b8; border-radius: 6px; width: 100px; }
</style>
</head>
<body>
<h1>Offline Dino - Animation Diagnostics</h1>

<div class="card">
  <h2>1. Current 6-Frame Running Cycle</h2>
  <canvas id="cCurrent" width="256" height="224"></canvas>
  <div class="row" id="stripCurrent"></div>
</div>

<div class="card">
  <h2>2. Raw Reference Figures 1 to 5 (from Panel 2)</h2>
  <canvas id="cRaw" width="256" height="224"></canvas>
  <div class="row" id="stripRaw"></div>
</div>

<script>
const currentImgs = [];
const stripCurrent = document.getElementById('stripCurrent');
for (let i = 0; i <= 5; i++) {
  const img = new Image();
  img.src = 'assets/sprites/dino_run_' + i + '.png';
  currentImgs.push(img);

  const box = document.createElement('div');
  box.className = 'frame-box';
  box.innerHTML = '<img src=\"assets/sprites/dino_run_' + i + '.png\"><span>Frame ' + i + '</span>';
  stripCurrent.appendChild(box);
}

const rawImgs = [];
const stripRaw = document.getElementById('stripRaw');
for (let i = 1; i <= 5; i++) {
  const img = new Image();
  img.src = 'generous_run_fig_' + i + '.png';
  rawImgs.push(img);

  const box = document.createElement('div');
  box.className = 'frame-box';
  box.innerHTML = '<img src=\"generous_run_fig_' + i + '.png\"><span>Fig ' + i + '</span>';
  stripRaw.appendChild(box);
}

const ctxCur = document.getElementById('cCurrent').getContext('2d');
const ctxRaw = document.getElementById('cRaw').getContext('2d');
ctxCur.imageSmoothingEnabled = false;
ctxRaw.imageSmoothingEnabled = false;

let curIdx = 0;
let rawIdx = 0;

setInterval(() => {
  curIdx = (curIdx + 1) % 6;
  ctxCur.clearRect(0, 0, 256, 224);
  ctxCur.strokeStyle = '#d97706';
  ctxCur.lineWidth = 4;
  ctxCur.beginPath(); ctxCur.moveTo(0, 206); ctxCur.lineTo(256, 206); ctxCur.stroke();
  if (currentImgs[curIdx].complete) {
    ctxCur.drawImage(currentImgs[curIdx], 0, 0, 256, 224);
  }
}, 110);

setInterval(() => {
  rawIdx = (rawIdx + 1) % 5;
  ctxRaw.clearRect(0, 0, 256, 224);
  if (rawImgs[rawIdx].complete) {
    ctxRaw.drawImage(rawImgs[rawIdx], 10, 0, 236, 224);
  }
}, 120);
</script>
</body>
</html>`;

fs.writeFileSync('preview_run.html', html);
console.log('Saved preview_run.html');
