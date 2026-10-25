/**
 * OFFLINE DINO - Cartoon Sprite & Animation Engine
 * DIRECTLY RENDERS "STYLE 1 — FRIENDLY CLASSIC" SPRITES EXTRACTED FROM THE USER'S REFERENCE IMAGE:
 * - 4 Idle animation frames (Normal, Breathing, Half-Closed Blinking, Look Around)
 * - 5 Run cycle animation frames (seamless, fluid loop with bounce)
 * - 5 Jump animation phases (Take-off, Ascending, In-air, Descending, Landing)
 * - 5 Ducking animation frames (Anticipation, Lowering, Active Loop with Closed Eyes, Recovery)
 * - Collision & Game Over frame (Standardized 128x112 canonical canvas, baseline aligned)
 * - Saguaro cacti clusters: Single, Double, and Triple multi-body clusters exactly matching hitboxes
 * - Pterodactyl with flapping wings
 * - Day & Night high-resolution seamless desert panoramas with pre-cached atmospheric depth blur
 *
 * Uses Base64 embedded sprite data for 100% instant synchronous offline loading.
 */

class SpriteRenderer {
  constructor() {
    this.images = {};
    this.imagesLoaded = false;
    this.blurredBgs = {}; // Pre-rendered blurred canvases to eliminate per-frame ctx.filter overhead (DINO-007)
    this.currentSkin = (typeof window !== 'undefined' && window.SkinManager)
      ? window.SkinManager.getSelectedSkinId()
      : 'green';
    this.skinCache = {};
    this.loadSprites();
  }

  setSkin(skinId) {
    if (typeof window !== 'undefined' && window.SkinManager) {
      this.currentSkin = window.SkinManager.setSelectedSkinId(skinId);
    } else {
      this.currentSkin = skinId || 'green';
    }
    if (this.currentSkin && this.currentSkin !== 'green') {
      this.preloadSkinSprites(this.currentSkin);
    }
  }

  preloadSkinSprites(skinId) {
    if (!skinId || skinId === 'green') return;
    const runNumberedKeys = [];
    for (let i = 1; i <= 10; i++) runNumberedKeys.push('run_' + i.toString().padStart(2, '0'));
    const dinoRunKeys = [];
    for (let i = 0; i < 10; i++) dinoRunKeys.push('dino_run_' + i);
    const jumpNumberedKeys = [];
    for (let i = 1; i <= 10; i++) jumpNumberedKeys.push('jump_' + i.toString().padStart(2, '0'));
    const dinoJumpKeys = [];
    for (let i = 0; i < 20; i++) dinoJumpKeys.push('dino_jump_' + i);
    const duckNumberedKeys = [];
    for (let i = 1; i <= 10; i++) duckNumberedKeys.push('duck_' + i.toString().padStart(2, '0'));
    const dinoDuckKeys = [];
    for (let i = 0; i < 27; i++) dinoDuckKeys.push('dino_duck_' + i);

    const dinoKeys = [
      'dino_idle_0', 'dino_idle_1', 'dino_idle_2', 'dino_idle_3', 'dino_idle_sclera',
      'dino_front_0', 'dino_front_sclera', 'dino_front_blink', 'dino_front_smile',
      'dino_home_idle', 'dino_home_sclera', 'dino_home_blink', 'dino_home_hover',
      'dino_home_tongue_01', 'dino_home_tongue_02', 'dino_home_tongue_03',
      'dino_turn_fl', 'dino_turn_fr', 'dino_exp_jump',
      ...runNumberedKeys,
      ...dinoRunKeys,
      ...jumpNumberedKeys,
      ...dinoJumpKeys,
      ...duckNumberedKeys,
      ...dinoDuckKeys,
      'dino_hit', 'dino_dead',
      'dino_turn_0', 'dino_turn_1', 'dino_turn_2', 'dino_turn_3', 'dino_turn_4', 'dino_turn_5', 'dino_turn_6',
      'dino_turn_7', 'dino_turn_8', 'dino_turn_9'
    ];
    for (let i = 0; i < dinoKeys.length; i++) {
      this.getDinoSprite(dinoKeys[i], skinId);
    }
  }

  getDinoSprite(key, skinId = this.currentSkin) {
    if (!skinId || skinId === 'green') {
      return this.images[key] || null;
    }
    if (!this.skinCache[skinId]) {
      this.skinCache[skinId] = {};
    }
    if (this.skinCache[skinId][key]) {
      return this.skinCache[skinId][key];
    }
    const baseImg = this.images[key];
    if (baseImg && (baseImg.complete || baseImg.width) && (baseImg.naturalWidth > 0 || baseImg.width > 0)) {
      if (typeof window !== 'undefined' && window.SkinManager) {
        const skin = window.SkinManager.getSkinById(skinId);
        const recolored = window.SkinManager.recolorImage(baseImg, skin);
        this.skinCache[skinId][key] = recolored;
        return recolored;
      }
    }
    return baseImg || null;
  }

  loadSprites() {
    const runNumberedKeys = [];
    for (let i = 1; i <= 10; i++) runNumberedKeys.push('run_' + i.toString().padStart(2, '0'));
    const dinoRunKeys = [];
    for (let i = 0; i < 10; i++) dinoRunKeys.push('dino_run_' + i);
    const jumpNumberedKeys = [];
    for (let i = 1; i <= 10; i++) jumpNumberedKeys.push('jump_' + i.toString().padStart(2, '0'));
    const dinoJumpKeys = [];
    for (let i = 0; i < 20; i++) dinoJumpKeys.push('dino_jump_' + i);
    const duckNumberedKeys = [];
    for (let i = 1; i <= 10; i++) duckNumberedKeys.push('duck_' + i.toString().padStart(2, '0'));
    const dinoDuckKeys = [];
    for (let i = 0; i < 27; i++) dinoDuckKeys.push('dino_duck_' + i);

    const spriteKeys = [
      // Idle (with cursor-tracking sclera base)
      'dino_idle_0', 'dino_idle_1', 'dino_idle_2', 'dino_idle_3', 'dino_idle_sclera',
      // Front-facing & Home Turnaround / Expressions
      'dino_front_0', 'dino_front_sclera', 'dino_front_blink', 'dino_front_smile',
      'dino_home_idle', 'dino_home_sclera', 'dino_home_blink', 'dino_home_hover',
      'dino_home_tongue_01', 'dino_home_tongue_02', 'dino_home_tongue_03',
      'home_pupil_left', 'home_pupil_right', 'home_title_sign',
      'dino_turn_fl', 'dino_turn_fr', 'dino_exp_jump',
      // 10-Frame strictly ordered running animation (Frame 1 -> Frame 10 -> repeat Frame 1)
      ...runNumberedKeys,
      ...dinoRunKeys,
      // Approved 10-frame jump cycle (takeoff, ascent, airborne apex, descent, landing)
      ...jumpNumberedKeys,
      ...dinoJumpKeys,
      // Approved 10-frame duck cycle (crouch drop, sustained crawl loop, smooth rise recovery)
      ...duckNumberedKeys,
      ...dinoDuckKeys,
      // Hit & Dead
      'dino_hit', 'dino_dead',
      // Turnaround (10 full directional 360 degree rotation poses)
      'dino_turn_0', 'dino_turn_1', 'dino_turn_2', 'dino_turn_3', 'dino_turn_4', 'dino_turn_5', 'dino_turn_6',
      'dino_turn_7', 'dino_turn_8', 'dino_turn_9',
      // Obstacles
      'cactus_single', 'cactus_small', 'cactus_double', 'cactus_triple', 'cactus_tall',
      'pterodactyl_0', 'pterodactyl_1',
      // Backgrounds
      'bg_day', 'bg_night'
    ];

    let loadedCount = 0;
    const total = spriteKeys.length;

    spriteKeys.forEach((key) => {
      const img = new Image();
      // Use embedded Base64 sprite data if available for 100% instant offline load
      if (window.STYLE1_SPRITES && window.STYLE1_SPRITES[key]) {
        img.src = window.STYLE1_SPRITES[key];
      } else {
        img.src = 'assets/sprites/' + key + '.png';
      }

      img.onload = () => {
        loadedCount++;
        // Pre-bake blur for backgrounds as soon as they load
        if (key === 'bg_day' || key === 'bg_night') {
          this.createPrebakedBlurredBg(key, img);
        }
        if (loadedCount >= total) {
          this.imagesLoaded = true;
          if (this.currentSkin && this.currentSkin !== 'green') {
            this.preloadSkinSprites(this.currentSkin);
          }
        }
      };
      this.images[key] = img;
    });

    this.imagesLoaded = true;
  }

  // Pre-render blurred background to an offscreen canvas once (DINO-007)
  // Pre-render blurred background to an offscreen canvas with wrap-around boundary filtering
  // Eliminates canvas edge darkening so seams between tiled backgrounds are 100% invisible
  createPrebakedBlurredBg(key, img) {
    if (!img || img.naturalWidth === 0) return;
    try {
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;

      // 1. Create a 3-tile panorama offscreen canvas to allow wrap-around blur
      const wrapCanvas = document.createElement('canvas');
      wrapCanvas.width = nw * 3;
      wrapCanvas.height = nh;
      const wCtx = wrapCanvas.getContext('2d');
      if (!wCtx) {
        this.blurredBgs[key] = img;
        return;
      }

      // Draw 3 contiguous tiles
      wCtx.drawImage(img, 0, 0);
      wCtx.drawImage(img, nw, 0);
      wCtx.drawImage(img, nw * 2, 0);

      // 2. Blur the 3-tile strip
      const blurCanvas = document.createElement('canvas');
      blurCanvas.width = nw * 3;
      blurCanvas.height = nh;
      const bCtx = blurCanvas.getContext('2d');
      if (bCtx) {
        bCtx.filter = 'blur(1.4px)';
        bCtx.drawImage(wrapCanvas, 0, 0);

        // 3. Extract the pristine center tile (nw .. 2*nw) where boundary blur bleed is 0
        const offscreen = document.createElement('canvas');
        offscreen.width = nw;
        offscreen.height = nh;
        const offCtx = offscreen.getContext('2d');
        if (offCtx) {
          offCtx.drawImage(blurCanvas, nw, 0, nw, nh, 0, 0, nw, nh);
          this.blurredBgs[key] = offscreen;
          return;
        }
      }
      this.blurredBgs[key] = img;
    } catch (e) {
      this.blurredBgs[key] = img;
    }
  }

  update(dt) {
    // Driven by animTime
  }

  // Fast, smooth RGB color interpolation helper
  lerpColor(r1, g1, b1, r2, g2, b2, t) {
    const clampedT = Math.max(0, Math.min(1, t));
    const r = Math.round(r1 + (r2 - r1) * clampedT);
    const g = Math.round(g1 + (g2 - g1) * clampedT);
    const b = Math.round(b1 + (b2 - b1) * clampedT);
    return `rgb(${r}, ${g}, ${b})`;
  }

  // ==========================================
  // BACKGROUND RENDERING (Style 1 Desert Mesas Panorama)
  // Seamless day-to-night crossfade with Stage C cinematic twilight sky gradient
  // ==========================================
  drawBackground(ctx, scrollX, width, groundY, nightProgress = 0) {
    const bgDay = this.blurredBgs['bg_day'] || this.images['bg_day'];
    const bgNight = this.blurredBgs['bg_night'] || this.images['bg_night'];

    // Support both numeric progress [0..1] and legacy boolean
    const p = typeof nightProgress === 'number'
      ? Math.max(0, Math.min(1, nightProgress))
      : (nightProgress ? 1.0 : 0.0);

    if (bgDay && (bgDay.width || bgDay.naturalWidth)) {
      ctx.save();
      const naturalW = bgDay.width || bgDay.naturalWidth;
      const naturalH = bgDay.height || bgDay.naturalHeight;
      const aspect = naturalW / naturalH;
      const bgH = groundY;
      const bgW = bgH * aspect;
      const parallaxSpeed = scrollX * 0.16;
      const offset = -(parallaxSpeed % bgW);

      const startTile = -1;
      const endTile = Math.ceil(width / bgW) + 1;

      // 1. Draw Day Background (base layer: Stage A)
      for (let l = startTile; l <= endTile; l++) {
        const bx0 = Math.round(offset + l * bgW);
        const bx1 = Math.round(offset + (l + 1) * bgW);
        ctx.drawImage(bgDay, bx0, 0, bx1 - bx0, bgH);
      }

      // 2. Crossfade Night Background (aligned mesas, clouds, stars & moon)
      if (p > 0.001 && bgNight && (bgNight.width || bgNight.naturalWidth)) {
        ctx.save();
        ctx.globalAlpha = p;
        for (let l = startTile; l <= endTile; l++) {
          const bx0 = Math.round(offset + l * bgW);
          const bx1 = Math.round(offset + (l + 1) * bgW);
          ctx.drawImage(bgNight, bx0, 0, bx1 - bx0, bgH);
        }
        ctx.restore();
      }

      // 3. Stage C — Main Twilight Environmental Sky Gradient (30% - 70%)
      // Peaks at p = 0.50 with a gentle bell-curve for cinematic twilight atmosphere
      const twilightFactor = Math.sin(p * Math.PI);
      if (twilightFactor > 0.02) {
        ctx.save();
        const twGrad = ctx.createLinearGradient(0, 0, 0, groundY);
        const a = twilightFactor * 0.28;
        twGrad.addColorStop(0, `rgba(49, 46, 129, ${a.toFixed(3)})`); // Deep indigo aloft
        twGrad.addColorStop(0.45, `rgba(109, 40, 217, ${(a * 0.75).toFixed(3)})`); // Twilight purple
        twGrad.addColorStop(0.85, `rgba(194, 65, 12, ${(a * 0.35).toFixed(3)})`); // Soft warm dusk
        twGrad.addColorStop(1.0, 'rgba(180, 83, 9, 0)');
        ctx.fillStyle = twGrad;
        ctx.fillRect(0, 0, width, groundY);
        ctx.restore();
      }

      ctx.restore();
    } else {
      // Clean fallback gradient with smooth day-to-night interpolation
      ctx.save();
      const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
      const topCol = this.lerpColor(77, 166, 255, 19, 26, 56, p);
      const botCol = this.lerpColor(166, 219, 255, 39, 51, 105, p);
      skyGrad.addColorStop(0, topCol);
      skyGrad.addColorStop(1, botCol);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, groundY);
      ctx.restore();
    }
  }

  // ==========================================
  // GROUND RENDERING
  // Smooth day-to-night color gradient, baseline & pebble interpolation
  // ==========================================
  drawGround(ctx, scrollX, width, height, groundY, nightProgress = 0) {
    ctx.save();
    const p = typeof nightProgress === 'number'
      ? Math.max(0, Math.min(1, nightProgress))
      : (nightProgress ? 1.0 : 0.0);

    // Smoothly interpolated ground terrain gradient
    const fillGradient = ctx.createLinearGradient(0, groundY, 0, height);
    fillGradient.addColorStop(0, this.lerpColor(252, 211, 77, 51, 65, 85, p));
    fillGradient.addColorStop(0.12, this.lerpColor(251, 191, 36, 30, 41, 59, p));
    fillGradient.addColorStop(0.4, this.lerpColor(245, 158, 11, 20, 30, 48, p));
    fillGradient.addColorStop(1, this.lerpColor(217, 119, 6, 15, 23, 42, p));

    ctx.fillStyle = fillGradient;
    ctx.fillRect(0, groundY, width, height - groundY);

    // Ground dividing baseline
    const lineColor = this.lerpColor(217, 119, 6, 71, 85, 105, p);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // Stylized terrain dashes & smooth pebbles
    const patternWidth = 600;
    const startIdx = Math.floor(scrollX / patternWidth) - 1;
    const endIdx = Math.ceil((scrollX + width) / patternWidth) + 1;

    const dashColor = this.lerpColor(180, 83, 9, 100, 116, 139, p);
    ctx.fillStyle = dashColor;
    ctx.strokeStyle = dashColor;
    ctx.lineWidth = 2.2;

    const dashPatterns = [
      // Pattern 0: Classic balanced grouping
      [
        { x: 30, y: 7, len: 14, dot: true },
        { x: 75, y: 15, len: 10, dot: false },
        { x: 120, y: 8, len: 22, dot: true },
        { x: 180, y: 14, len: 12, dot: false },
        { x: 230, y: 6, len: 18, dot: true },
        { x: 285, y: 16, len: 9, dot: false },
        { x: 335, y: 9, len: 24, dot: true },
        { x: 400, y: 13, len: 15, dot: false },
        { x: 455, y: 7, len: 20, dot: true },
        { x: 515, y: 15, len: 11, dot: false },
        { x: 565, y: 8, len: 16, dot: true }
      ],
      // Pattern 1: Elongated sandy ridges
      [
        { x: 20, y: 12, len: 26, dot: true },
        { x: 80, y: 6, len: 12, dot: false },
        { x: 135, y: 16, len: 16, dot: true },
        { x: 195, y: 9, len: 22, dot: false },
        { x: 260, y: 14, len: 10, dot: true },
        { x: 310, y: 7, len: 28, dot: false },
        { x: 380, y: 15, len: 14, dot: true },
        { x: 435, y: 8, len: 18, dot: false },
        { x: 495, y: 13, len: 24, dot: true },
        { x: 555, y: 6, len: 12, dot: false }
      ],
      // Pattern 2: Rhythmic pebble clusters
      [
        { x: 40, y: 8, len: 18, dot: true },
        { x: 95, y: 14, len: 14, dot: true },
        { x: 150, y: 7, len: 20, dot: false },
        { x: 210, y: 16, len: 8, dot: true },
        { x: 255, y: 9, len: 26, dot: false },
        { x: 320, y: 13, len: 12, dot: true },
        { x: 375, y: 6, len: 22, dot: false },
        { x: 440, y: 15, len: 16, dot: true },
        { x: 490, y: 8, len: 10, dot: false },
        { x: 540, y: 14, len: 24, dot: true }
      ],
      // Pattern 3: Minimalist desert stride
      [
        { x: 25, y: 10, len: 20, dot: false },
        { x: 70, y: 16, len: 12, dot: true },
        { x: 130, y: 7, len: 24, dot: false },
        { x: 190, y: 13, len: 16, dot: true },
        { x: 245, y: 8, len: 14, dot: false },
        { x: 300, y: 15, len: 22, dot: true },
        { x: 365, y: 6, len: 18, dot: false },
        { x: 425, y: 14, len: 10, dot: true },
        { x: 475, y: 9, len: 26, dot: false },
        { x: 545, y: 12, len: 15, dot: true }
      ]
    ];

    for (let k = startIdx; k <= endIdx; k++) {
      const baseX = k * patternWidth - scrollX;
      const patternIdx = ((k % 4) + 4) % 4;
      const dashes = dashPatterns[patternIdx];

      for (let i = 0; i < dashes.length; i++) {
        const d = dashes[i];
        const dx = baseX + d.x;
        if (dx + d.len >= -20 && dx <= width + 20) {
          ctx.beginPath();
          ctx.moveTo(dx, groundY + d.y);
          ctx.lineTo(dx + d.len, groundY + d.y);
          ctx.stroke();

          if (d.dot) {
            ctx.beginPath();
            ctx.arc(dx + d.len + 6, groundY + d.y + 3, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    ctx.restore();
  }

  // ==========================================
  // ==========================================
  // CACTUS OBSTACLE RENDERING — REPLACED WITH MASTER CARTOON ARTWORK
  // Renders dedicated high-fidelity cartoon cactus artwork:
  // - Single cactus (Image 1): Single variant (w=26/32, h=48/70)
  // - Two-cactus obstacle (Image 2): Double variant (w=48/60, h=48/70)
  // - Three-cactus obstacle (Image 3): Triple variant (w=68/88, h=48/70)
  // Maintains exact ground baseline alignment, in-game footprint, and natural proportions
  // ==========================================
  drawCactus(ctx, x, y, w, h, type, nightProgress = 0) {
    ctx.save();
    const p = typeof nightProgress === 'number'
      ? Math.max(0, Math.min(1, nightProgress))
      : (nightProgress ? 1.0 : 0.0);

    const groundBase = y + h;

    // Ground shadow underneath the entire obstacle (smooth day-to-night interpolation)
    const sr = Math.round(180 + (15 - 180) * p);
    const sg = Math.round(83 + (23 - 83) * p);
    const sb = Math.round(9 + (42 - 9) * p);
    const sa = 0.32 + (0.45 - 0.32) * p;
    ctx.fillStyle = `rgba(${sr}, ${sg}, ${sb}, ${sa.toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, groundBase, Math.max(w, 24) * 0.52, 4.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Map each obstacle variant to its corresponding new cartoon cactus artwork:
    // Single cactus: Image 1 (cactus_single / cactus_small)
    // Double cactus: Image 2 (cactus_double)
    // Triple cactus: Image 3 (cactus_triple / cactus_tall)
    let spriteKey = 'cactus_single';
    let renderW = w;
    let renderH = h;

    if (type === 'CACTUS_SMALL_DOUBLE' || type === 'CACTUS_LARGE_DOUBLE') {
      spriteKey = 'cactus_double';
      renderW = (h < 55) ? 46 : 66;
    } else if (type === 'CACTUS_SMALL_TRIPLE' || type === 'CACTUS_LARGE_TRIPLE') {
      spriteKey = 'cactus_triple';
      renderW = (h < 55) ? 58 : 82;
    } else {
      spriteKey = (h < 55) ? 'cactus_small' : 'cactus_single';
      renderW = (h < 55) ? 26 : 36;
    }

    const img = this.images[spriteKey] || this.images['cactus_tall'] || this.images['cactus_single'];
    // Center horizontally over obstacle footprint and anchor bottom to ground baseline
    const drawX = x + (w - renderW) / 2;
    const drawY = groundBase - renderH;

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, drawX, drawY, renderW, renderH);
    } else {
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(x, groundBase - h, w, h);
    }

    ctx.restore();
  }

  // ==========================================
  // PTERODACTYL RENDERING (Style 1 Panel 6)
  // True wing-flapping animation cycle: Frame 0 (wings up), Frame 1 (wings down)
  // ==========================================
  drawPterodactyl(ctx, x, y, flapFrame = 0, isNight = false) {
    const imgKey = flapFrame === 0 ? 'pterodactyl_0' : 'pterodactyl_1';
    const img = this.images[imgKey] || this.images['pterodactyl_0'];

    ctx.save();
    if (img && img.complete && img.naturalWidth > 0) {
      const targetH = 46;
      const targetW = 60;
      ctx.drawImage(img, x, y, targetW, targetH);
    } else {
      ctx.fillStyle = '#b45309';
      ctx.fillRect(x, y, 60, 46);
    }
    ctx.restore();
  }

  // =========================================================================
  // DINOSAUR RENDERING — STYLE 1 "FRIENDLY CLASSIC" MASTER SPRITE DRAWING
  // =========================================================================
  // DINOSAUR RENDERING — STYLE 1 "FRIENDLY CLASSIC" MASTER SPRITE DRAWING
  // 100% Unified single character model on uniform 128x112 canonical canvas:
  // - Complete visible tail on all 5 jump phases (take-off, ascending, in-air, descending, landing)
  // - Head, neck, body, tail, arms, and legs move together naturally as ONE character
  // - Canonical eye consistency on all frames
  // - Smooth ducking with closed eyes and anticipation frame
  // - Standardized 128x112 dead pose on baseline
  // - Strict foot-to-ground baseline alignment (targetH=70, dyOffset=-2)
  // =========================================================================
  drawDino(ctx, x, y, state, animTime = 0, isNight = false, isGrounded = true, jumpPhase = 'IN_AIR', duckDuration = 0, duckEnding = false, gameSpeed = 340, landingTimer = 0, vy = 0, takeOffTimer = 0, duckEndingTimer = 0) {
    ctx.save();

    let img = null;
    const targetH = 70; // Standard canonical standing/running height
    const dyOffset = -1; // Aligns sprite row 195 (feet soles) precisely with ground line surface (y=groundY-64)
    let dxOffset = 0;

    // 1. DEAD / GAME OVER (Style 1: Standardized 128x112 canvas, baseline aligned)
    if (state === 'DEAD') {
      img = this.getDinoSprite('dino_dead');
    }
    // 2. MID-AIR HIT IMPACT POSE
    else if (state === 'HIT') {
      img = this.getDinoSprite('dino_hit') || this.getDinoSprite('jump_08') || this.getDinoSprite('dino_jump_14');
    }
    // 3. DUCKING & SLIDING (Approved 10-Frame Duck Cycle)
    // - Crouch Entry (Frames 01, 02, 03, 04, 05): lowering body naturally into low crouch
    // - Sustained Stable Crouch (Frame 05): stable crouching pose held steadily without jitter/shaking
    // - Smooth Recovery Rise (Frames 06, 07, 08, 09, 10): rising back up to standing upon release
    else if (state === 'DUCKING' || duckEnding || duckEndingTimer > 0) {
      if (duckEnding || duckEndingTimer > 0) {
        // Recovery transition: rising back up smoothly (Frames 06 -> 07 -> 08 -> 09 -> 10)
        const recDuration = 0.14;
        const remaining = Math.max(0, duckEndingTimer);
        const p = Math.min(1, Math.max(0, 1 - (remaining / recDuration)));
        const recIdx = Math.min(10, 6 + Math.floor(p * 5));
        const pad = recIdx.toString().padStart(2, '0');
        img = this.getDinoSprite('duck_' + pad) || this.getDinoSprite('dino_duck_' + (recIdx - 1));
      } else if (duckDuration < 0.12) {
        // Crouch Entry: lowering body naturally (Frames 01 -> 02 -> 03 -> 04 -> 05)
        const p = Math.min(1, Math.max(0, duckDuration / 0.12));
        const entryIdx = Math.min(5, 1 + Math.floor(p * 5));
        const pad = entryIdx.toString().padStart(2, '0');
        img = this.getDinoSprite('duck_' + pad) || this.getDinoSprite('dino_duck_' + (entryIdx - 1));
      } else {
        // Sustained Stable Crouch: held steadily without bouncing, shaking, or jitter
        img = this.getDinoSprite('duck_05') || this.getDinoSprite('dino_duck_4');
      }
    }
    // 4. JUMPING SEQUENCE (Approved 10-Frame Jump Trajectory)
    // - Takeoff Anticipation & Launch (Frames 01, 02, 03)
    // - Leaping Ascent (Frame 04)
    // - High Apex Flight Peak & Glide (Frames 05, 06)
    // - Descent Trajectory & Touchdown Reach (Frames 07, 08)
    // - Impact Compression & Landing Rebound (Frames 09, 10)
    // 4. JUMPING SEQUENCE (Frozen Airborne Pose)
    // Once the dinosaur leaves the ground (!isGrounded), its body animation is completely frozen
    // in one consistent, natural airborne pose (jump_04) for the entire airborne duration.
    // Zero body wobble, zero limb movement, zero frame cycling mid-air.
    // Upon landing, smoothly restores the running animation without flickering or sudden visual jumps.
    else if (state === 'JUMPING' || !isGrounded) {
      img = this.getDinoSprite('jump_04') || this.getDinoSprite('dino_jump_3');
    }
    // 5. RUNNING CYCLE (Approved 10-Frame strictly ordered bipedal running animation)
    // Plays Frame 1 -> Frame 2 -> ... -> Frame 10 -> repeat Frame 1
    // Synchronized with gameplay speed without skipping frames:
    else if (state === 'RUNNING') {
      const runFps = Math.min(24.0, 14.0 + Math.max(0, gameSpeed - 250) * 0.024);
      const frameIdx = Math.floor(animTime * runFps) % 10;
      const frameNum = (frameIdx + 1).toString().padStart(2, '0');
      img = this.getDinoSprite('run_' + frameNum) || this.getDinoSprite('dino_run_' + frameIdx) || this.getDinoSprite('dino_run_0');
    }
    // 6. IDLE ANIMATION (Standing, breathing, natural occasional blinks)
    else {
      const loopTime = animTime % 6.0;
      if (loopTime > 4.8) {
        img = this.getDinoSprite('dino_idle_3'); // Look Around
      } else if (loopTime >= 2.68 && loopTime < 2.75) {
        img = this.getDinoSprite('dino_idle_1'); // Half closed blink
      } else if (loopTime >= 2.75 && loopTime < 2.92) {
        img = this.getDinoSprite('dino_idle_2'); // Fully closed blink
      } else if (loopTime >= 2.92 && loopTime < 2.99) {
        img = this.getDinoSprite('dino_idle_1'); // Half closed reopen
      } else {
        img = this.getDinoSprite('dino_idle_0'); // Standing & breathing
      }
    }

    const nw = img ? (img.naturalWidth || img.width || 0) : 0;
    const nh = img ? (img.naturalHeight || img.height || 0) : 0;
    const isReady = img && (img.complete !== undefined ? img.complete : true) && nw > 0 && nh > 0;

    if (isReady) {
      const targetW = targetH * (nw / nh);
      ctx.drawImage(img, x + dxOffset, y + dyOffset, targetW, targetH);
    } else {
      // Safe fallback to original canonical green sprite if recolored frame is still initializing
      // NEVER draw a solid color box or rectangle!
      const fallbackImg = this.images['dino_run_0'];
      if (fallbackImg && (fallbackImg.naturalWidth || fallbackImg.width)) {
        const fw = fallbackImg.naturalWidth || fallbackImg.width;
        const fh = fallbackImg.naturalHeight || fallbackImg.height;
        const targetW = targetH * (fw / fh);
        ctx.drawImage(fallbackImg, x + dxOffset, y + dyOffset, targetW, targetH);
      }
    }

    ctx.restore();
  }

  // =========================================================================
  // HOME SCREEN ANIMATED MASCOT
  // Stationary mascot character with cute subtle micro-expressions:
  // - Adorable calm standing pose (dino_idle_0)
  // - Occasional natural eye blinks (dino_idle_1 -> dino_idle_2 -> dino_idle_1)
  // - Curious look-around / head tilt micro-expression (dino_idle_3)
  // - Subtle breathing micro-motion (<0.8px)
  // =========================================================================
  // HOME SCREEN ANIMATED MASCOT — STABLE BODY WITH INDEPENDENT EYE TRACKING
  // =========================================================================
  drawMascot(
    ctx,
    cx = 0,
    cy = 0,
    size = 140,
    animTime = 0,
    lookX = 0,
    lookY = 0,
    scaleX = 1,
    scaleY = 1,
    blinkStage = 'OPEN',
    headTilt = 0,
    smileProgress = 0,
    clickReactionProgress = 0,
    isFront = true,
    skinId = this.currentSkin,
    turnStage = 0
  ) {
    ctx.clearRect(0, 0, 546, 288);

    // Natural blink animation: only draw closed eyelid arcs during blink frames;
    // When open, preserve the authentic, pristine reference dinosaur artwork from home_title_sign.png
    if (blinkStage === 'CLOSED' || blinkStage === 'HALF') {
      const leftSocketCx = 258.5;
      const leftSocketCy = 51.7;
      const rightSocketCx = 304.5;
      const rightSocketCy = 53.5;

      ctx.save();
      const skinObj = (window.SkinManager) ? window.SkinManager.getSkinById(skinId) : null;
      ctx.strokeStyle = (skinObj && skinObj.accentColor) ? skinObj.accentColor : '#1a3311';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';

      // Left eye closed eyelid
      ctx.save();
      ctx.translate(leftSocketCx, leftSocketCy);
      ctx.rotate(-0.08);
      ctx.beginPath();
      ctx.arc(0, 2, 8, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.restore();

      // Right eye closed eyelid
      ctx.save();
      ctx.translate(rightSocketCx, rightSocketCy);
      ctx.rotate(0.08);
      ctx.beginPath();
      ctx.arc(0, 2, 8, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.restore();

      ctx.restore();
    }
  }

  // =========================================================================
  // CONTINUOUS 360-DEGREE TURNAROUND DRAWING FOR CUSTOMIZATION SCREEN (SKIN-01..05)
  // Seamless, zero-jitter, continuous 360 rotation with 10 approved keyframes:
  // 0: Profile Right (0°)
  // 1: Back-Right 3/4 (36°)
  // 2: Rear-Right (72°)
  // 3: Direct Back (108°)
  // 4: Rear-Left (144°)
  // 5: Back-Left 3/4 (180°)
  // 6: Profile Left (216°)
  // 7: Front-Left 3/4 (252°)
  // 8: Direct Front (288°)
  // 9: Front-Right 3/4 (324°)
  // Supports all 9 skins, smooth opacity cross-fade between keyframes,
  // stable proportions, cream belly, transparent background, and zero distortion.
  // =========================================================================
  drawTurnaround360(
    ctx,
    cx,
    cy,
    size = 145,
    angle = 0,
    skinId = this.currentSkin,
    blinkStage = 'OPEN',
    bounceY = 0
  ) {
    ctx.save();
    ctx.translate(cx, cy + bounceY);

    // Normalize angle into [0, 2*PI)
    const twoPi = Math.PI * 2;
    const normAngle = ((angle % twoPi) + twoPi) % twoPi;

    // Map angle to discrete frame [0 .. 9]
    // Exactly ONE complete, clearly visible dinosaur frame is rendered with alpha 1.0.
    // Zero multi-angle cross-fading, zero ghosting, zero overlapping limbs or duplicate tails.
    const frameIndex = Math.round((normAngle / twoPi) * 10) % 10;
    const img = this.getDinoSprite('dino_turn_' + frameIndex, skinId);

    if (img && (img.complete || img.width) && (img.naturalHeight > 0 || img.height > 0)) {
      const nw = img.naturalWidth || img.width;
      const nh = img.naturalHeight || img.height;
      const targetH = size;
      const targetW = targetH * (nw / nh);

      ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
    }

    ctx.restore();
  }

  // Compatibility wrapper for legacy frameIndex callers
  drawTurnaround(
    ctx,
    cx,
    cy,
    size = 145,
    frameIndex = 0,
    skinId = this.currentSkin,
    blinkStage = 'OPEN',
    bounceY = 0
  ) {
    const angle = (frameIndex / 10.0) * (Math.PI * 2);
    this.drawTurnaround360(ctx, cx, cy, size, angle, skinId, blinkStage, bounceY);
  }
}

window.spriteRenderer = new SpriteRenderer();
