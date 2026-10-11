const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const delay = ms => new Promise(r => setTimeout(r, ms));

async function runTests() {
  console.log('Launching Edge via puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,700']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 700 });

  // 1. Load Home
  console.log('Navigating to http://localhost:3000/...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await delay(600);

  // 2. Test High Score modal
  console.log('Testing High Score modal...');
  await page.click('#btnHomeHighScore');
  await delay(400);
  await page.screenshot({ path: path.join(__dirname, 'screenshot_highscore.png') });
  console.log('Captured screenshot_highscore.png');
  await page.click('#btnHighScoreBack');
  await delay(400);

  // 3. Test Sound Toggle
  console.log('Testing Sound toggle...');
  const soundLabelBefore = await page.$eval('#homeSoundLabel', el => el.textContent);
  console.log('Sound before:', soundLabelBefore);
  await page.click('#btnHomeSound');
  await delay(200);
  const soundLabelMuted = await page.$eval('#homeSoundLabel', el => el.textContent);
  console.log('Sound after 1st click:', soundLabelMuted);
  await page.click('#btnHomeSound');
  await delay(200);
  const soundLabelRestored = await page.$eval('#homeSoundLabel', el => el.textContent);
  console.log('Sound after 2nd click:', soundLabelRestored);

  // 4. Start Game
  console.log('Clicking START GAME...');
  await page.click('#btnStartGame');

  // Wait for countdown to finish (3..2..1..GO ~ 2.6s)
  await delay(2700);

  // Pause game immediately (safe before any obstacle appears)
  console.log('Pausing game right after start...');
  await page.click('#btnPause');
  await delay(400);
  await page.screenshot({ path: path.join(__dirname, 'screenshot_pause_modal.png') });
  console.log('Captured screenshot_pause_modal.png');

  // Check buttons inside Pause modal
  const pauseButtons = await page.$$eval('#pauseModal .cartoon-btn', btns => btns.map(b => b.textContent.trim()));
  console.log('Pause modal buttons:', pauseButtons);

  // Resume game
  console.log('Resuming game...');
  await page.evaluate(() => {
    document.getElementById('btnPauseResume').click();
  });
  await delay(600);

  // 5. Test Jump
  console.log('Testing Jump...');
  await page.keyboard.press('Space');
  await delay(200);
  await page.screenshot({ path: path.join(__dirname, 'screenshot_gameplay_jump.png') });
  console.log('Captured screenshot_gameplay_jump.png');
  await delay(800);

  // 6. Test Duck
  console.log('Testing Duck (holding ArrowDown)...');
  await page.keyboard.down('ArrowDown');
  await delay(250);
  await page.screenshot({ path: path.join(__dirname, 'screenshot_gameplay_duck.png') });
  console.log('Captured screenshot_gameplay_duck.png');
  await page.keyboard.up('ArrowDown');
  await delay(500);

  // 7. Trigger Game Over
  console.log('Triggering collision / Game Over...');
  await page.evaluate(() => {
    window.dinoGame.handleGameOver();
  });
  await delay(500);
  await page.screenshot({ path: path.join(__dirname, 'screenshot_game_over.png') });
  console.log('Captured screenshot_game_over.png');

  const gameOverButtons = await page.$$eval('#gameOverModal .cartoon-btn', btns => btns.map(b => b.textContent.trim()));
  console.log('Game Over modal buttons:', gameOverButtons);

  // 8. Return to Home from Game Over
  console.log('Clicking HOME on Game Over modal...');
  await page.evaluate(() => {
    document.getElementById('btnGameOverHome').click();
  });
  await delay(500);
  await page.screenshot({ path: path.join(__dirname, 'screenshot_home_restored.png') });
  console.log('Captured screenshot_home_restored.png');

  await browser.close();
  console.log('All automated tests completed successfully!');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
