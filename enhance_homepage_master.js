const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function enhanceHomepage() {
  console.log('=== STEP 1: Creating backup of pre-enhancement assets ===');
  const backupDir = path.join(__dirname, 'backup_pre_quality_enhancement');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const backupFiles = [
    'assets/sprites/homepage_seamless_panorama.jpg',
    'assets/sprites/home_sound_off_patch.png',
    'assets/sprites/btn_mask_skins.png',
    'assets/sprites/btn_mask_highscore.png',
    'assets/sprites/btn_mask_sound.png',
    'assets/sprites/btn_mask_exit.png'
  ];
  const skins = ['green', 'blue', 'red', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black'];
  skins.forEach(s => backupFiles.push(`assets/sprites/home_dino_skin_${s}.png`));

  for (const f of backupFiles) {
    if (fs.existsSync(f)) {
      const dest = path.join(backupDir, path.basename(f));
      fs.copyFileSync(f, dest);
    }
  }
  console.log(`Backed up ${backupFiles.length} files to ${backupDir}`);

  console.log('\n=== STEP 2: Generating Pristine 1920x1080 Master Panorama ===');
  const pristineSource = path.join(__dirname, 'scratch/pristine_master_2048x1152.png');
  if (!fs.existsSync(pristineSource)) {
    throw new Error(`Pristine source not found at ${pristineSource}`);
  }

  // Lanczos3 downsampling from 2048x1152 to 1920x1080 (gentle 1.0667x supersampling)
  // Saved at JPEG quality 100 with chromaSubsampling 4:4:4 for absolute visual fidelity
  const outPanorama = path.join(__dirname, 'assets/sprites/homepage_seamless_panorama.jpg');
  await sharp(pristineSource)
    .resize(1920, 1080, { fit: 'fill', kernel: 'lanczos3' })
    .jpeg({ quality: 100, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toFile(outPanorama);

  const panoStats = fs.statSync(outPanorama);
  console.log(`Generated high-definition ${outPanorama}: 1920x1080, ${panoStats.size} bytes`);

  console.log('\n=== STEP 3: Regenerating home_sound_off_patch.png from pristine master ===');
  execSync('node generate_perfect_sound_off.js', { stdio: 'inherit', cwd: __dirname });

  console.log('\n=== STEP 4: Regenerating all 9 home_dino_skin_*.png overlays from pristine master ===');
  execSync('node generate_perfect_home_dino_skins.js', { stdio: 'inherit', cwd: __dirname });

  console.log('\n=== STEP 5: Regenerating all 4 btn_mask_*.png from pristine master ===');
  execSync('node scratch/build_button_masks.js', { stdio: 'inherit', cwd: __dirname });

  console.log('\n=== ALL HOMEPAGE ASSETS ENHANCED SUCCESSFULLY! ===');
}

enhanceHomepage().catch(err => {
  console.error('Enhancement error:', err);
  process.exit(1);
});
