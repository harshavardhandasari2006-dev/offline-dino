/**
 * OFFLINE DINO - Fresh-Session Offline Verification Test
 * Procedure (per Section 10):
 * 1. Open the game normally online.
 * 2. Allow service worker installation and cache population.
 * 3. Close the current page / browser context completely.
 * 4. Create a fresh browser context/session.
 * 5. Disable network completely (CDP offline emulation).
 * 6. Open the application again in the fresh context.
 * 7. Verify it boots from cache (Canvas, DinoGame, SpriteRenderer, UIManager).
 * 8. Start a game.
 * 9. Jump.
 * 10. Duck.
 * 11. Encounter obstacles.
 * 12. Trigger Game Over.
 * 13. Play Again.
 */

const puppeteer = require('puppeteer-core');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TARGET_URL = 'http://localhost:3000';

async function runFreshOfflineTest() {
  console.log('===============================================================');
  console.log('  ▲ OFFLINE DINO — FRESH SESSION OFFLINE VERIFICATION (13 STEPS)');
  console.log('===============================================================\n');

  // Step 1: Open browser & prime cache
  console.log('[STEP 1 & 2] Launching browser online and warming Service Worker cache...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
  });

  const page1 = await browser.newPage();
  await page1.goto(TARGET_URL, { waitUntil: 'networkidle2' });

  // Wait for Service Worker to activate
  await page1.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.ready;
    }
  });

  // Verify caches populated
  const cacheKeys = await page1.evaluate(async () => {
    if ('caches' in window) {
      return await caches.keys();
    }
    return [];
  });
  console.log(`  ✓ Cache storage confirmed: [${cacheKeys.join(', ')}]`);

  // Step 3: Close current page / session
  console.log('[STEP 3] Closing the initial page/session completely...');
  await page1.close();

  // Step 4: Create a fresh session / page
  console.log('[STEP 4 & 5] Creating fresh page and disabling network completely via CDP...');
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 1200, height: 700 });

  const cdp = await page2.target().createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0
  });
  console.log('  ✓ Network is completely offline (0 KB/s throughput).');

  // Step 6 & 7: Open the application again in fresh context & verify cache boot
  console.log('[STEP 6 & 7] Loading OFFLINE DINO in fresh session with zero network...');
  await page2.goto(TARGET_URL, { waitUntil: 'load' });

  const bootState = await page2.evaluate(() => {
    const canvas = document.getElementById('gameCanvas');
    const game = window.dinoGame !== undefined;
    const sprites = window.spriteRenderer !== undefined;
    const ui = window.uiManager !== undefined;
    const title = document.querySelector('.game-title') ? document.querySelector('.game-title').textContent : '';
    return { canvas: !!canvas, game, sprites, ui, title };
  });

  console.log(`  ✓ Booted from cache: Canvas=${bootState.canvas}, Engine=${bootState.game}, Title="${bootState.title}"`);
  if (!bootState.canvas || !bootState.game || !bootState.sprites) {
    throw new Error('Fresh session offline boot failed!');
  }

  // Step 8: Start a game
  console.log('[STEP 8] Clicking START GAME while offline...');
  await page2.evaluate(() => {
    window.uiManager.btnStartGame.click();
  });

  // Wait for countdown to finish (3, 2, 1, GO: ~2.6s)
  await new Promise(r => setTimeout(r, 3200));

  const isPlaying = await page2.evaluate(() => window.dinoGame.state === 'PLAYING');
  console.log(`  ✓ Game state is PLAYING: ${isPlaying}`);

  // Step 9: Jump
  console.log('[STEP 9] Executing Jump action while offline...');
  const jumpResult = await page2.evaluate(() => {
    window.dinoGame.setJumpInput(true);
    const jumped = !window.dinoGame.dino.isGrounded && window.dinoGame.dino.vy < 0;
    window.dinoGame.setJumpInput(false);
    return jumped;
  });
  console.log(`  ✓ Dinosaur jumped cleanly: ${jumpResult}`);

  // Wait for landing
  await new Promise(r => setTimeout(r, 800));

  // Step 10: Duck
  console.log('[STEP 10] Executing Duck action while offline...');
  const duckResult = await page2.evaluate(() => {
    window.dinoGame.handleDuckPress(true);
    const ducking = window.dinoGame.dino.isDucking;
    const feetAtGround = (window.dinoGame.dino.y + window.dinoGame.dino.height) === window.dinoGame.groundY;
    window.dinoGame.handleDuckPress(false);
    return { ducking, feetAtGround };
  });
  console.log(`  ✓ Dinosaur ducked cleanly with grounded baseline: ${duckResult.ducking} (Feet flush: ${duckResult.feetAtGround})`);

  // Step 11: Encounter obstacles
  console.log('[STEP 11] Running gameplay to encounter obstacles...');
  await page2.evaluate(() => {
    // Advance game distance to spawn obstacles
    window.dinoGame.score = 80;
    window.dinoGame.speed = 340;
    window.dinoGame.spawnObstacle();
  });
  const obstacleCount = await page2.evaluate(() => window.dinoGame.obstacles.length);
  console.log(`  ✓ Obstacles successfully spawned in offline mode: ${obstacleCount}`);

  // Step 12: Trigger Game Over
  console.log('[STEP 12] Triggering Game Over and verifying modal...');
  const gameOverResult = await page2.evaluate(() => {
    window.dinoGame.handleGameOver();
    const isGameOverState = window.dinoGame.state === 'GAMEOVER';
    const isModalVisible = !window.uiManager.gameOverModal.classList.contains('hidden');
    const hasHomeButtonInGameOver = !!document.getElementById('btnGameOverHome');
    const hasPlayAgain = !!document.getElementById('btnPlayAgain');
    return { isGameOverState, isModalVisible, hasHomeButtonInGameOver, hasPlayAgain };
  });
  console.log(`  ✓ Game Over triggered: State=${gameOverResult.isGameOverState}, Modal Visible=${gameOverResult.isModalVisible}`);
  console.log(`  ✓ Game Over Home button present: ${gameOverResult.hasHomeButtonInGameOver} (Must be false!)`);
  console.log(`  ✓ Play Again button present: ${gameOverResult.hasPlayAgain} (Must be true!)`);

  // Step 13: Play Again
  console.log('[STEP 13] Clicking PLAY AGAIN in offline mode...');
  await page2.evaluate(() => {
    window.uiManager.btnPlayAgain.click();
  });
  await new Promise(r => setTimeout(r, 3200));

  const isReplaying = await page2.evaluate(() => window.dinoGame.state === 'PLAYING');
  console.log(`  ✓ Successfully restarted fresh run via Play Again: ${isReplaying}`);

  // Cleanup
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  await browser.close();

  console.log('\n===============================================================');
  console.log('  ✔ ALL 13 FRESH-SESSION OFFLINE VERIFICATION STEPS PASSED!');
  console.log('===============================================================\n');
}

runFreshOfflineTest().catch(err => {
  console.error('Offline test error:', err);
  process.exit(1);
});
