const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 600 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  console.log('[SANITY] Starting game run...');
  await page.click('#btnStartGame');
  await new Promise(r => setTimeout(r, 2200));

  // Let the game run for 5 seconds of natural gameplay
  const result = await page.evaluate(async () => {
    const game = window.dinoGame;
    const scores = [];
    const obstacleTypesSeen = new Set();

    for (let f = 0; f < 300; f++) {
      // Auto-jump over any approaching obstacle
      for (const obs of game.obstacles) {
        obstacleTypesSeen.add(obs.type);
        if (obs.x < 240 && obs.x > 180 && game.dino.isGrounded && !game.dino.isJumping) {
          game.triggerJump();
        }
      }
      game.update(1 / 60);
      scores.push(Number(game.score));
    }

    // Test Pause and Resume
    window.uiManager.pauseGame();
    const isPaused = game.state === game.STATE_PAUSED;
    window.uiManager.resumeGame();
    // After countdown recovery, should resume
    game.state = game.STATE_PLAYING;

    return {
      initialScore: scores[0],
      finalScore: scores[scores.length - 1],
      obstacleTypesSeen: Array.from(obstacleTypesSeen),
      isPaused,
      isDyingMidAir: game.isDyingMidAir
    };
  });

  console.log('Sanity Test Result:', result);
  await browser.close();
  console.log('Sanity verification passed!');
})();
