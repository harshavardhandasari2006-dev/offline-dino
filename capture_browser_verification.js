const puppeteer = require('puppeteer-core');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function captureVerification() {
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  
  const page = await browser.newPage();
  
  // 1. 1536 x 824 (User's laptop viewport)
  console.log('Capturing 1536x824 (laptop viewport)...');
  await page.setViewport({ width: 1536, height: 824 });
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'verify_homepage_1536x824.png' });
  
  // 2. 1920 x 1080 (Full HD standard)
  console.log('Capturing 1920x1080 (1080p full display)...');
  await page.setViewport({ width: 1920, height: 1080 });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'verify_homepage_1920x1080.png' });

  // 3. 1440 x 900 (16:10 laptop standard)
  console.log('Capturing 1440x900 (16:10 standard)...');
  await page.setViewport({ width: 1440, height: 900 });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'verify_homepage_1440x900.png' });
  
  await browser.close();
  
  // Now extract detailed inspection crops from 1536x824:
  console.log('Extracting inspection crops from 1536x824...');
  
  // A. Top-left clouds & cliff (User Photo 2 defect zone)
  await sharp('verify_homepage_1536x824.png')
    .extract({ left: 0, top: 0, width: 450, height: 500 })
    .toFile('verify_crop_left_clouds_cliff.png');
    
  // B. Top-right clouds & mesa (User Photo 1 defect zone)
  await sharp('verify_homepage_1536x824.png')
    .extract({ left: 1536 - 450, top: 0, width: 450, height: 500 })
    .toFile('verify_crop_right_clouds_mesa.png');

  // C. Bottom-left cactus & terrain (Foreground scenery check)
  await sharp('verify_homepage_1536x824.png')
    .extract({ left: 0, top: 824 - 400, width: 450, height: 400 })
    .toFile('verify_crop_bottom_left_cactus.png');

  // D. Bottom-right scenery & terrain
  await sharp('verify_homepage_1536x824.png')
    .extract({ left: 1536 - 450, top: 824 - 400, width: 450, height: 400 })
    .toFile('verify_crop_bottom_right_scenery.png');

  // E. Center Start Game button & logo
  await sharp('verify_homepage_1536x824.png')
    .extract({ left: Math.round(1536/2 - 250), top: Math.round(824 * 0.45), width: 500, height: 300 })
    .toFile('verify_crop_center_start_button.png');

  console.log('All verification captures and crops completed successfully!');
}

captureVerification().catch(console.error);
