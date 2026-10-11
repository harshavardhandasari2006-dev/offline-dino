const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const tempOut = path.join(process.env.TEMP, 'dino_home.png');

try {
  execSync(`"${edgePath}" --headless --disable-gpu --screenshot="${tempOut}" --window-size=1200,700 "http://localhost:3000/"`, { stdio: 'inherit' });
  if (fs.existsSync(tempOut)) {
    fs.copyFileSync(tempOut, path.join(__dirname, 'screenshot_home.png'));
    console.log('SUCCESS: screenshot_home.png created! Size:', fs.statSync('screenshot_home.png').size);
  } else {
    console.log('tempOut does not exist');
  }
} catch (err) {
  console.error('Error:', err.message);
}
