const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
  input: fs.createReadStream('C:/Users/asus/.gemini/antigravity-ide/brain/f2226fc1-8dd7-4bb5-906a-dcd211e6bb37/.system_generated/logs/transcript.jsonl')
});
rl.on('line', (line) => {
  if (line.includes('"step_index":824')) {
    const data = JSON.parse(line);
    console.log(data.content);
  }
});
