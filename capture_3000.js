const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const tempOut = path.join(process.env.TEMP, 'dino_home_3000.png');

try {
  if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
  execSync(`"${edgePath}" --headless --disable-gpu --screenshot="${tempOut}" --window-size=1280,720 "http://localhost:3000/"`, { stdio: 'inherit' });
  if (fs.existsSync(tempOut)) {
    fs.copyFileSync(tempOut, path.join(__dirname, 'actual_home_3000.png'));
    console.log('SUCCESS: actual_home_3000.png created! Size:', fs.statSync('actual_home_3000.png').size);
  } else {
    console.log('tempOut does not exist');
  }
} catch (err) {
  console.error('Error:', err.message);
}
