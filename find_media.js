const fs = require('fs');
const path = require('path');

const logPath = path.join('C:', 'Users', 'asus', '.gemini', 'antigravity-ide', 'brain', '93f495db-673d-4394-aa97-d24e9db54f56', '.system_generated', 'logs', 'transcript.jsonl');
if (fs.existsSync(logPath)) {
  const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(lines[i]);
      if (parsed.type === 'USER_INPUT') {
        console.log('User input at line', i);
        console.log('Keys:', Object.keys(parsed));
        if (parsed.media_paths || parsed.mediaPaths || parsed.files) {
          console.log('Media paths:', parsed.media_paths || parsed.mediaPaths || parsed.files);
        }
        console.log('Content snippet:', typeof parsed.content === 'string' ? parsed.content.slice(0, 300) : JSON.stringify(parsed.content).slice(0, 300));
        break;
      }
    } catch(e) {}
  }
}

