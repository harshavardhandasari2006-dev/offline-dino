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
    for (let i = 1; i <= 16; i++) runNumberedKeys.push('run_' + i.toString().padStart(2, '0'));
    const dinoRunKeys = [];
    for (let i = 0; i < 24; i++) dinoRunKeys.push('dino_run_' + i);
    const dinoJumpKeys = [];
    for (let i = 0; i < 20; i++) dinoJumpKeys.push('dino_jump_' + i);
    const dinoDuckKeys = [];
    for (let i = 0; i < 27; i++) dinoDuckKeys.push('dino_duck_' + i);

    const dinoKeys = [
      'dino_idle_0', 'dino_idle_1', 'dino_idle_2', 'dino_idle_3', 'dino_idle_sclera',
      'dino_front_0', 'dino_front_sclera', 'dino_front_blink', 'dino_front_smile',
      'dino_turn_fl', 'dino_turn_fr', 'dino_exp_jump',
      ...runNumberedKeys,
      ...dinoRunKeys,
      ...dinoJumpKeys,
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
    for (let i = 1; i <= 16; i++) runNumberedKeys.push('run_' + i.toString().padStart(2, '0'));
    const dinoRunKeys = [];
    for (let i = 0; i < 24; i++) dinoRunKeys.push('dino_run_' + i);
    const dinoJumpKeys = [];
    for (let i = 0; i < 20; i++) dinoJumpKeys.push('dino_jump_' + i);
    const dinoDuckKeys = [];
    for (let i = 0; i < 27; i++) dinoDuckKeys.push('dino_duck_' + i);

    const spriteKeys = [
      // Idle (with cursor-tracking sclera base)
      'dino_idle_0', 'dino_idle_1', 'dino_idle_2', 'dino_idle_3', 'dino_idle_sclera',
      // Front-facing & Home Turnaround / Expressions
      'dino_front_0', 'dino_front_sclera', 'dino_front_blink', 'dino_front_smile',
      'dino_turn_fl', 'dino_turn_fr', 'dino_exp_jump',
      // 16-Frame strictly ordered running animation (Frame 1 -> Frame 16 -> repeat Frame 1)
      ...runNumberedKeys,
      // Run (canonical frames)
      ...dinoRunKeys,
      // Jump (20 trajectory frames: takeoff, ascent, apex, descent, landing recovery)
      ...dinoJumpKeys,
      // Duck (27 frames: smooth crouch drop, sustained low slide, smooth rise recovery)
      ...dinoDuckKeys,
      // Hit & Dead
      'dino_hit', 'dino_dead',
      // Turnaround (10 full directional 360 degree rotation poses)
      'dino_turn_0', 'dino_turn_1', 'dino_turn_2', 'dino_turn_3', 'dino_turn_4', 'dino_turn_5', 'dino_turn_6',
      'dino_turn_7', 'dino_turn_8', 'dino_turn_9',
      // Obstacles
      'cactus_single', 'cactus_small', 'cactus_double', 'cactus_tall',
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
  // CACTUS CLUSTER RENDERING (DINO-001 & DINO-018 FIX)
  // Renders 1, 2, or 3 visible cacti corresponding to the exact obstacle width
  // Single -> 1 body; Double -> 2 bodies; Triple -> 3 bodies
  // Zero invisible empty air collision boxes!
  // ==========================================
  drawCactus(ctx, x, y, w, h, type, nightProgress = 0) {
    ctx.save();
    const p = typeof nightProgress === 'number'
      ? Math.max(0, Math.min(1, nightProgress))
      : (nightProgress ? 1.0 : 0.0);

    // Define multi-body cactus layouts matching exact collision bounds
    // Each layout specifies: sprite key, x offset, relative height, body width
    let layout = [];

    switch (type) {
      case 'CACTUS_SMALL_SINGLE':
        // 1 small cactus body (w=26, h=48) - uses authentic cactus_small (DINO-018)
        layout = [
          { key: 'cactus_small', xOff: 0, bodyW: 26, bodyH: 48 }
        ];
        break;

      case 'CACTUS_SMALL_DOUBLE':
        // 2 small cactus bodies (w=48, h=48)
        layout = [
          { key: 'cactus_small', xOff: 0, bodyW: 24, bodyH: 48 },
          { key: 'cactus_double', xOff: 22, bodyW: 26, bodyH: 46 }
        ];
        break;

      case 'CACTUS_SMALL_TRIPLE':
        // 3 small cactus bodies (w=68, h=48)
        layout = [
          { key: 'cactus_small', xOff: 0, bodyW: 23, bodyH: 48 },
          { key: 'cactus_double', xOff: 22, bodyW: 23, bodyH: 45 },
          { key: 'cactus_tall', xOff: 44, bodyW: 24, bodyH: 48 }
        ];
        break;

      case 'CACTUS_LARGE_SINGLE':
        // 1 large cactus body (w=32, h=70)
        layout = [
          { key: 'cactus_single', xOff: 0, bodyW: 32, bodyH: 70 }
        ];
        break;

      case 'CACTUS_LARGE_DOUBLE':
        // 2 large cactus bodies (w=60, h=70)
        layout = [
          { key: 'cactus_single', xOff: 0, bodyW: 32, bodyH: 70 },
          { key: 'cactus_tall', xOff: 28, bodyW: 32, bodyH: 68 }
        ];
        break;

      case 'CACTUS_LARGE_TRIPLE':
        // 3 large cactus bodies (w=88, h=70)
        layout = [
          { key: 'cactus_single', xOff: 0, bodyW: 31, bodyH: 70 },
          { key: 'cactus_double', xOff: 28, bodyW: 30, bodyH: 66 },
          { key: 'cactus_tall', xOff: 57, bodyW: 31, bodyH: 70 }
        ];
        break;

      default:
        layout = [
          { key: 'cactus_small', xOff: 0, bodyW: w || 26, bodyH: h || 48 }
        ];
    }

    const groundBase = y + h;

    // Ground shadow underneath the entire cluster (smooth day-to-night interpolation)
    const sr = Math.round(180 + (15 - 180) * p);
    const sg = Math.round(83 + (23 - 83) * p);
    const sb = Math.round(9 + (42 - 9) * p);
    const sa = 0.32 + (0.45 - 0.32) * p;
    ctx.fillStyle = `rgba(${sr}, ${sg}, ${sb}, ${sa.toFixed(2)})`;
    ctx.beginPath();
    const clusterW = w || layout[layout.length - 1].xOff + layout[layout.length - 1].bodyW;
    ctx.ellipse(x + clusterW / 2, groundBase, clusterW * 0.52, 4.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Render each cactus in the cluster
    for (let i = 0; i < layout.length; i++) {
      const part = layout[i];
      const img = this.images[part.key] || this.images['cactus_small'];
      const drawX = x + part.xOff;
      const drawY = groundBase - part.bodyH;

      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, drawX, drawY, part.bodyW, part.bodyH);
      } else {
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(drawX, drawY, part.bodyW, part.bodyH);
      }
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
    const dyOffset = -2; // Aligns sprite row 103 (feet soles) precisely with ground line surface (y=groundY-64)
    let dxOffset = 0;

    // 1. DEAD / GAME OVER (Style 1: Standardized 128x112 canvas, baseline aligned)
    if (state === 'DEAD') {
      img = this.getDinoSprite('dino_dead');
    }
    // 2. MID-AIR HIT IMPACT POSE
    else if (state === 'HIT') {
      img = this.getDinoSprite('dino_hit') || this.getDinoSprite('dino_jump_14');
    }
    // 3. DUCKING & SLIDING (Master Reference 2: 27 frames across 3 rows)
    // - Row 0 (frames 0..8): Smooth crouch drop from standing (h=94 -> h=64)
    // - Row 1 (frames 9..17): Sustained low crawling / sliding across ground (h=41..50)
    // - Row 2 (frames 18..26): Smooth recovery rising back up to running (h=75 -> h=88)
    else if (state === 'DUCKING' || duckEnding || duckEndingTimer > 0) {
      if (duckEnding || duckEndingTimer > 0) {
        // Recovery transition: rising back up, eyes reopened
        const recDuration = 0.12;
        const remaining = Math.max(0, duckEndingTimer);
        const p = Math.min(1, Math.max(0, 1 - (remaining / recDuration)));
        const recIdx = Math.min(26, 18 + Math.floor(p * 9));
        img = this.getDinoSprite('dino_duck_' + recIdx) || this.getDinoSprite('dino_duck_26');
      } else if (duckDuration < 0.12) {
        // Crouch Entry (knees bending, lowering head & torso naturally)
        const entryIdx = Math.min(8, Math.floor((duckDuration / 0.12) * 9));
        img = this.getDinoSprite('dino_duck_' + entryIdx);
      } else {
        // Sustained Slide / Crawl Loop: streamlined, passes safely under obstacles
        const slideProgress = duckDuration - 0.12;
        const slideFps = Math.min(22.0, 14.0 + Math.max(0, gameSpeed - 250) * 0.02);
        const slideIdx = 9 + (Math.floor(slideProgress * slideFps) % 9);
        img = this.getDinoSprite('dino_duck_' + slideIdx) || this.getDinoSprite('dino_duck_13');
      }
    }
    // 4. JUMPING SEQUENCE (Master Reference 3: 20 trajectory frames)
    // - Takeoff (frames 0, 1, 2): grounded preparation, crouch, spring off baseline
    // - Ascent (frames 3, 4, 5, 6): upward leap trajectory
    // - Apex (frames 7, 8): highest point deceleration
    // - Descent (frames 9..13): downward trajectory, legs preparing for landing
    // - Touchdown & Compression (frames 14, 15, 16): contact with ground, impact absorption
    // - Landing Recovery (frames 17, 18, 19): rebound, rising back to running
    else if (state === 'JUMPING' || !isGrounded || jumpPhase === 'LANDING' || landingTimer > 0) {
      if (jumpPhase === 'TAKE_OFF' || takeOffTimer > 0) {
        const toDuration = 0.08;
        const p = Math.min(1, Math.max(0, 1 - (takeOffTimer / toDuration)));
        const f = Math.min(2, Math.floor(p * 3));
        img = this.getDinoSprite('dino_jump_' + f);
      } else if (jumpPhase === 'LANDING' || landingTimer > 0) {
        const totalLandDuration = 0.12;
        if (landingTimer > 0.06) {
          // Touchdown compression (frames 14, 15, 16)
          const compP = Math.min(1, Math.max(0, (totalLandDuration - landingTimer) / 0.06));
          const f = Math.min(16, 14 + Math.floor(compP * 3));
          img = this.getDinoSprite('dino_jump_' + f);
        } else {
          // Rebound recovery step into run (frames 17, 18, 19)
          const recP = Math.min(1, Math.max(0, (0.06 - landingTimer) / 0.06));
          const f = Math.min(19, 17 + Math.floor(recP * 3));
          img = this.getDinoSprite('dino_jump_' + f);
        }
      } else if (vy < -160) {
        // Leaping ascent (frames 3..6)
        const ascP = Math.min(1, Math.max(0, (-vy - 160) / 320));
        const f = 3 + Math.floor((1 - ascP) * 4);
        img = this.getDinoSprite('dino_jump_' + Math.min(6, Math.max(3, f)));
      } else if (Math.abs(vy) <= 160) {
        // Highest apex flight (frames 7, 8)
        const f = vy <= 0 ? 7 : 8;
        img = this.getDinoSprite('dino_jump_' + f);
      } else {
        // Descent (frames 9..13)
        const descP = Math.min(1, Math.max(0, (vy - 160) / 360));
        const f = 9 + Math.floor(descP * 5);
        img = this.getDinoSprite('dino_jump_' + Math.min(13, Math.max(9, f)));
      }
    }
    // 5. RUNNING CYCLE (16-Frame strictly ordered bipedal running animation from Master Reference)
    // Plays Frame 1 -> Frame 2 -> ... -> Frame 16 -> repeat Frame 1
    // Synchronized with gameplay speed without skipping frames:
    else if (state === 'RUNNING') {
      const runFps = Math.min(24.0, 14.0 + Math.max(0, gameSpeed - 250) * 0.024);
      const frameIdx = Math.floor(animTime * runFps) % 16;
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
    cx,
    cy,
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
    ctx.save();

    const spriteScale = size / 112.0;

    // Natural stationary micro-breathing (<0.6px)
    const breath = Math.sin(animTime * Math.PI * 1.1) * 0.60;

    // Gentle, playful hop & squash-stretch during click/touch (Section 8)
    const clickHop = clickReactionProgress > 0 ? (-6.0 * Math.sin(clickReactionProgress * Math.PI) * spriteScale) : 0;
    const clickScaleY = clickReactionProgress > 0 ? (1.0 + Math.sin(clickReactionProgress * Math.PI) * 0.035) : 1.0;

    // Soft ground shadow beneath dinosaur (stable, gently cushions on hop)
    const shadowAlpha = 0.16 * (1.0 - Math.abs(clickHop) / (25.0 * spriteScale));
    if (shadowAlpha > 0.02) {
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha.toFixed(3)})`;
      ctx.beginPath();
      const shadowW = 28.0 * spriteScale * (1.0 - Math.abs(clickHop) / (40.0 * spriteScale));
      const shadowH = 5.0 * spriteScale;
      ctx.ellipse(cx, cy + (50.0 / 112.0) * size + breath * 0.5, Math.max(6, shadowW), Math.max(2, shadowH), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Torso and body remain upright and stable (Section 4)
    // Only imperceptible subtle head tilt (max ±0.02 rad) when gaze turns
    ctx.translate(cx, cy + breath + clickHop);
    ctx.scale(1.0, clickScaleY);
    if (headTilt) {
      ctx.rotate(headTilt);
    }

    const nw = 128.0;
    const nh = 112.0;
    const targetH = size;
    const targetW = targetH * (nw / nh);
    const drawX = -targetW / 2;
    const drawY = -targetH / 2;

    // Base front-facing dinosaur artwork with clean white sclera
    const baseImg = this.getDinoSprite('dino_front_sclera', skinId) ||
                    this.getDinoSprite('dino_front_0', skinId);

    if (baseImg && (baseImg.complete || baseImg.width)) {
      ctx.drawImage(baseImg, drawX, drawY, targetW, targetH);
    }

    // Canonical eye centers (128x112 coords):
    // Left eye center: (52.8, 28.2), Right eye center: (75.8, 28.8)
    const leftEyeRelX = (52.8 / 128.0 - 0.5) * targetW;
    const leftEyeRelY = (28.2 / 112.0 - 0.5) * targetH;
    const rightEyeRelX = (75.8 / 128.0 - 0.5) * targetW;
    const rightEyeRelY = (28.8 / 112.0 - 0.5) * targetH;

    // Eye boundaries (for clipping to natural white sclera contour):
    const leftEyeRx = 6.8 * spriteScale;
    const leftEyeRy = 9.8 * spriteScale;
    const rightEyeRx = 8.8 * spriteScale;
    const rightEyeRy = 9.6 * spriteScale;

    // Pupil dimensions (large, expressive cartoon pupils):
    const pupilRx = 4.2 * spriteScale;
    const pupilRy = 6.0 * spriteScale;

    // Travel range within eye boundaries:
    const leftMaxTravelX = 3.6 * spriteScale;
    const leftMaxTravelY = 3.8 * spriteScale;
    const rightMaxTravelX = 4.6 * spriteScale;
    const rightMaxTravelY = 3.8 * spriteScale;

    // Clamp normalized look vector within unit ellipse
    let lx = lookX;
    let ly = lookY;
    const distSq = (lx * lx) + (ly * ly);
    if (distSq > 1.0) {
      const d = Math.sqrt(distSq);
      lx /= d;
      ly /= d;
    }

    // Pupils follow gaze
    const leftPupilX = leftEyeRelX + lx * leftMaxTravelX;
    const leftPupilY = leftEyeRelY + ly * leftMaxTravelY;
    const rightPupilX = rightEyeRelX + lx * rightMaxTravelX;
    const rightPupilY = rightEyeRelY + ly * rightMaxTravelY;

    // Playful wink during mid-phase of click reaction (Row 7-9 in reference)
    const isWinking = (clickReactionProgress > 0.22 && clickReactionProgress < 0.68);
    const isEyeClosed = (blinkStage === 'CLOSED') || isWinking;
    const isHalfEye = (blinkStage === 'HALF') && !isWinking;

    const blinkImg = this.getDinoSprite('dino_front_blink', skinId);

    if (isEyeClosed && blinkImg && (blinkImg.complete || blinkImg.width)) {
      // Draw authentic closed eyelid artwork from dino_front_blink (128x112 coords: x: 44..88, y: 17..36)
      const patchX = (44.0 / 128.0 - 0.5) * targetW;
      const patchY = (17.0 / 112.0 - 0.5) * targetH;
      const patchW = (44.0 / 128.0) * targetW;
      const patchH = (19.0 / 112.0) * targetH;
      ctx.drawImage(blinkImg, 44, 17, 44, 19, patchX, patchY, patchW, patchH);
    } else if (isEyeClosed) {
      // Fallback closed smiling arcs
      ctx.save();
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2.6 * spriteScale;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.ellipse(leftEyeRelX, leftEyeRelY, leftEyeRx, leftEyeRy, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#85c80e';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(leftEyeRelX, leftEyeRelY - 0.5 * spriteScale, leftEyeRx * 0.95, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(rightEyeRelX, rightEyeRelY, rightEyeRx, rightEyeRy, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#98d70e';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rightEyeRelX, rightEyeRelY - 0.5 * spriteScale, rightEyeRx * 0.92, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();

      ctx.restore();
    } else {
      // Open or half-open: render both tracking pupils inside clipped eye whites
      // --- Left Eye ---
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(leftEyeRelX, leftEyeRelY, leftEyeRx, leftEyeRy, 0, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.ellipse(leftPupilX, leftPupilY, pupilRx, pupilRy, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dual crisp white catchlights (specular + reflex)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(leftPupilX + 1.8 * spriteScale, leftPupilY - 2.0 * spriteScale, 1.8 * spriteScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
      ctx.beginPath();
      ctx.arc(leftPupilX - 1.5 * spriteScale, leftPupilY + 2.4 * spriteScale, 1.1 * spriteScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // --- Right Eye ---
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(rightEyeRelX, rightEyeRelY, rightEyeRx, rightEyeRy, 0, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.ellipse(rightPupilX, rightPupilY, pupilRx, pupilRy, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dual crisp white catchlights (specular + reflex)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(rightPupilX + 1.8 * spriteScale, rightPupilY - 2.0 * spriteScale, 1.8 * spriteScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
      ctx.beginPath();
      ctx.arc(rightPupilX - 1.5 * spriteScale, rightPupilY + 2.4 * spriteScale, 1.1 * spriteScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Half-closed eyelids
      if (isHalfEye && blinkImg && (blinkImg.complete || blinkImg.width)) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(drawX, drawY, targetW, (targetH / 2) - 32.0 * spriteScale);
        ctx.clip();
        const patchX = (44.0 / 128.0 - 0.5) * targetW;
        const patchY = (17.0 / 112.0 - 0.5) * targetH;
        const patchW = (44.0 / 128.0) * targetW;
        const patchH = (19.0 / 112.0) * targetH;
        ctx.drawImage(blinkImg, 44, 17, 44, 19, patchX, patchY, patchW, patchH);
        ctx.restore();
      }
    }

    // Cute smiling open mouth, tooth, tongue & cheeks when cursor is nearby (Row 6) or during click reaction
    const effectiveSmile = Math.max(smileProgress, clickReactionProgress > 0 ? Math.sin(clickReactionProgress * Math.PI) : 0);
    if (effectiveSmile > 0.05) {
      ctx.save();
      const sp = Math.min(1.0, effectiveSmile);
      ctx.globalAlpha = sp;

      // Mouth center: (0, y = 43 on 112)
      const mouthCenterY = (43.0 / 112.0 - 0.5) * targetH;

      // 1. Open happy smile cavity
      ctx.fillStyle = '#6b1212';
      ctx.beginPath();
      ctx.ellipse(0, mouthCenterY + 1.2 * spriteScale, 7.5 * spriteScale * sp, 4.2 * spriteScale * sp, 0, 0, Math.PI);
      ctx.fill();

      // 2. Rosy coral tongue
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.ellipse(0, mouthCenterY + 3.8 * spriteScale, 5.2 * spriteScale * sp, 2.5 * spriteScale * sp, 0, Math.PI, Math.PI * 2);
      ctx.fill();

      // 3. Cute white central front tooth
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.rect(-1.8 * spriteScale, mouthCenterY - 0.5 * spriteScale, 3.6 * spriteScale, 2.2 * spriteScale * sp);
      ctx.fill();

      // 4. Crisp dark smile outline
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2.4 * spriteScale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, mouthCenterY, 8.2 * spriteScale * sp, Math.PI * 0.08, Math.PI * 0.92);
      ctx.stroke();

      // 5. Rosy blushing cheeks
      ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
      ctx.beginPath();
      ctx.ellipse(leftEyeRelX - 3.5 * spriteScale, mouthCenterY - 1.5 * spriteScale, 4.0 * spriteScale * sp, 2.2 * spriteScale * sp, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(rightEyeRelX + 3.5 * spriteScale, mouthCenterY - 1.5 * spriteScale, 4.0 * spriteScale * sp, 2.2 * spriteScale * sp, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
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

    // Map angle to 10 frames [0 .. 10)
    const floatFrame = (normAngle / twoPi) * 10.0;
    const idx0 = Math.floor(floatFrame) % 10;
    const idx1 = (idx0 + 1) % 10;
    const frac = floatFrame - Math.floor(floatFrame);

    // Smooth cubic Hermite interpolation for seamless transition
    const blend = frac * frac * (3.0 - 2.0 * frac);

    const img0 = this.getDinoSprite('dino_turn_' + idx0, skinId);
    const img1 = this.getDinoSprite('dino_turn_' + idx1, skinId);

    const drawFrame = (img, alpha) => {
      if (!img || (!img.complete && !img.width) || (img.naturalHeight <= 0 && img.height <= 0)) return;
      const nw = img.naturalWidth || img.width;
      const nh = img.naturalHeight || img.height;
      const targetH = size;
      const targetW = targetH * (nw / nh);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
      ctx.restore();
    };

    if (blend < 0.05) {
      drawFrame(img0, 1.0);
    } else if (blend > 0.95) {
      drawFrame(img1, 1.0);
    } else {
      drawFrame(img0, 1.0 - blend);
      drawFrame(img1, blend);
    }

    // Cute cartoon eye-blink micro-reaction (when settled or triggered)
    if (blinkStage === 'CLOSED') {
      const activeIdx = blend > 0.5 ? idx1 : idx0;
      // If facing camera or profile (0, 6, 7, 8, 9)
      if (activeIdx === 0 || activeIdx === 6 || activeIdx === 7 || activeIdx === 8 || activeIdx === 9) {
        ctx.save();
        const spriteScale = size / 112.0;
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2.6 * spriteScale;
        ctx.lineCap = 'round';

        if (activeIdx === 8) {
          // Both eyes closed
          ctx.beginPath();
          ctx.arc(-11.0 * spriteScale, -23.0 * spriteScale, 4.5 * spriteScale, Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(11.0 * spriteScale, -23.0 * spriteScale, 4.5 * spriteScale, Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();
        } else {
          // Profile eye closed
          const isRight = (activeIdx === 0 || activeIdx === 9);
          const eyeX = (isRight ? 18.0 : -18.0) * spriteScale;
          const eyeY = -36.0 * spriteScale;
          ctx.beginPath();
          ctx.arc(eyeX, eyeY, 5.5 * spriteScale, Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();
        }
        ctx.restore();
      }
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
