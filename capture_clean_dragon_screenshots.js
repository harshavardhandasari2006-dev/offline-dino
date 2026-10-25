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

  // Start fresh game properly via UI
  console.log('Starting fresh game via UI button...');
  await page.click('#btnStartGame');
  // Wait for 3-2-1 countdown
  await new Promise(r => setTimeout(r, 2200));

  // Place dragon approaching dino
  await page.evaluate(() => {
    const game = window.dinoGame;
    game.obstacles = [{
      type: 'PTERODACTYL',
      x: 420,
      y: game.groundY - 48,
      groundOffset: -48,
      width: 60,
      height: 46,
      flapTimer: 0,
      flapFrame: 0,
      heightLabel: 'LOW'
    }];
  });

  await page.screenshot({ path: 'verify_dragon_approaching_live.png' });
  console.log('Saved verify_dragon_approaching_live.png');

  // Trigger jump and advance physics to jump apex directly over dragon
  await page.evaluate(() => {
    const game = window.dinoGame;
    game.triggerJump();
    // Advance physics to apex directly above dragon
    const dt = 1 / 60;
    for (let i = 0; i < 20; i++) {
      game.update(dt);
    }
  });

  await page.screenshot({ path: 'verify_dragon_jump_apex_live.png' });
  console.log('Saved verify_dragon_jump_apex_live.png');

  await browser.close();
  console.log('Done capturing live screenshots!');
})();
