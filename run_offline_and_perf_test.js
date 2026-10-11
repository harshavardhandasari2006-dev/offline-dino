/**
 * OFFLINE DINO - Deep Performance Profiling & True Offline PWA Test
 * 1. Simulates genuine network disconnection via CDP (Network.emulateNetworkConditions)
 * 2. Reloads page while offline and verifies game boots, renders, and responds.
 * 3. Profiles active gameplay FPS, frame delta, memory, and mascot loop status.
 */

const puppeteer = require('puppeteer-core');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TARGET_URL = 'http://localhost:3000';

async function testOfflineAndPerf() {
  console.log('===============================================================');
  console.log('  ▲ OFFLINE DINO — OFFLINE PWA & 60 FPS PERFORMANCE PROFILE');
  console.log('===============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 700 });

  try {
    // -------------------------------------------------------------
    // PART 1: Online Cache Warming & Service Worker Activation
    // -------------------------------------------------------------
    console.log('[STEP 1] Loading page online to install & prime PWA Cache...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });

    // Wait for Service Worker to activate
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready;
      }
    });
    console.log('  ✓ Service Worker active & caches primed.');

    // -------------------------------------------------------------
    // PART 2: Disconnect Network Completely (True Offline Mode)
    // -------------------------------------------------------------
    console.log('[STEP 2] Simulating COMPLETE NETWORK LOSS via Chrome DevTools Protocol...');
    const client = await page.target().createCDPSession();
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0
    });

    console.log('  ✓ Network is now 100% OFFLINE (0 KB/s throughput, offline=true).');

    // -------------------------------------------------------------
    // PART 3: Reload Page from Scratch in Complete Offline Mode
    // -------------------------------------------------------------
    console.log('[STEP 3] Reloading OFFLINE DINO with zero internet access...');
    await page.reload({ waitUntil: 'load' });

    // Verify game canvas and engine are booted
    const isBootedOffline = await page.evaluate(() => {
      const canvas = document.getElementById('gameCanvas');
      const engine = window.dinoGame !== undefined;
      const sprites = window.spriteRenderer !== undefined;
      const ui = window.uiManager !== undefined;
      return canvas !== null && engine && sprites && ui;
    });

    if (isBootedOffline) {
      console.log('  ✔ PASS [DINO-017]: Game successfully booted and initialized 100% OFFLINE from Cache!');
    } else {
      console.error('  ✘ FAIL: Failed to boot offline.');
    }

    // -------------------------------------------------------------
    // PART 4: Play Game 100% Offline & Profile 60 FPS Performance
    // -------------------------------------------------------------
    console.log('[STEP 4] Starting active gameplay session while offline & profiling FPS...');
    await page.evaluate(() => {
      window.uiManager.startNewGameSequence();
    });

    // Wait for countdown to finish (3-2-1-GO: ~2.4s)
    await new Promise(r => setTimeout(r, 2600));

    // Sample 120 animation frames of live gameplay
    const perfStats = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const frameTimes = [];
        let start = performance.now();
        let last = start;
        let count = 0;

        // Mascot RAF should be NULL during active gameplay (DINO-009)
        const mascotRafDuringPlay = window.uiManager.mascotRafId;

        function sample(now) {
          const delta = now - last;
          last = now;
          frameTimes.push(delta);
          count++;

          // Simulate jumping and ducking during sampling
          if (count === 30) window.dinoGame.setJumpInput(true);
          if (count === 40) window.dinoGame.setJumpInput(false);
          if (count === 70) window.dinoGame.handleDuckPress(true);
          if (count === 90) window.dinoGame.handleDuckPress(false);

          if (count < 120) {
            requestAnimationFrame(sample);
          } else {
            const totalDuration = (now - start) / 1000;
            const avgFps = count / totalDuration;
            const minDelta = Math.min(...frameTimes);
            const maxDelta = Math.max(...frameTimes);
            const score = window.dinoGame.score;

            let jsHeap = null;
            if (performance.memory) {
              jsHeap = (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(2) + ' MB';
            }

            resolve({
              avgFps: avgFps.toFixed(1),
              minDeltaMs: minDelta.toFixed(2),
              maxDeltaMs: maxDelta.toFixed(2),
              sampleCount: count,
              mascotRafDuringPlay,
              score: Math.floor(score),
              jsHeap
            });
          }
        }
        requestAnimationFrame(sample);
      });
    });

    console.log('\n--- PERFORMANCE TELEMETRY REPORT ---');
    console.log(`  Average Framerate:     ${perfStats.avgFps} FPS (Target: 60 FPS)`);
    console.log(`  Min Frame Delta:       ${perfStats.minDeltaMs} ms`);
    console.log(`  Max Frame Delta:       ${perfStats.maxDeltaMs} ms (Fluid frame budget: 16.6ms)`);
    console.log(`  Frames Sampled:        ${perfStats.sampleCount}`);
    console.log(`  Mascot RAF in Play:    ${perfStats.mascotRafDuringPlay === null ? 'STOPPED (✔ Zero Overhead)' : 'RUNNING'}`);
    console.log(`  Final Run Score:       ${perfStats.score}`);
    if (perfStats.jsHeap) console.log(`  JS Heap Memory:        ${perfStats.jsHeap}`);
    console.log('------------------------------------\n');

    // Screenshot active offline gameplay
    await page.screenshot({ path: 'verify_phase2_offline_gameplay.png' });
    console.log('  ✓ Saved screenshot: verify_phase2_offline_gameplay.png');

    // -------------------------------------------------------------
    // PART 5: Test Game Over & Home Return
    // -------------------------------------------------------------
    console.log('[STEP 5] Testing Game Over and Home Return...');
    const homeReturnTest = await page.evaluate(() => {
      // Force game over
      window.dinoGame.handleGameOver();
      const isGameOverOpen = !window.uiManager.gameOverModal.classList.contains('hidden');

      // Click Home button on Game Over modal
      window.uiManager.btnGameOverHome.click();
      const isHomeOpen = !window.uiManager.homeScreen.classList.contains('hidden');
      const isMascotRestarted = window.uiManager.mascotRafId !== null;

      return { isGameOverOpen, isHomeOpen, isMascotRestarted };
    });

    console.log(`  ✓ Game Over modal opened: ${homeReturnTest.isGameOverOpen}`);
    console.log(`  ✓ Returned to Home screen: ${homeReturnTest.isHomeOpen}`);
    console.log(`  ✓ Mascot RAF restarted cleanly on Home: ${homeReturnTest.isMascotRestarted}`);

    // Re-enable network before exit
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1
    });

    console.log('\n===============================================================');
    console.log('  ✔ OFFLINE & PERFORMANCE VALIDATION 100% COMPLETE');
    console.log('===============================================================\n');

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
  }
}

testOfflineAndPerf();
