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
    this.loadSprites();
  }

  loadSprites() {
    const spriteKeys = [
      // Idle
      'dino_idle_0', 'dino_idle_1', 'dino_idle_2', 'dino_idle_3',
      // Run (6 fluid frames - alternating strides A and B)
      'dino_run_0', 'dino_run_1', 'dino_run_2', 'dino_run_3', 'dino_run_4', 'dino_run_5',
      // Jump (5 phases)
      'dino_jump_0', 'dino_jump_1', 'dino_jump_2', 'dino_jump_3', 'dino_jump_4',
      // Duck (smooth transition with closed eyes)
      'dino_duck_0', 'dino_duck_1', 'dino_duck_2', 'dino_duck_3', 'dino_duck_4',
      // Hit & Dead
      'dino_hit', 'dino_dead',
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

  // ==========================================
  // BACKGROUND RENDERING (Style 1 Desert Mesas Panorama)
  // Zero per-frame blur filter: uses pre-cached softened canvas (DINO-007)
  // ==========================================
  drawBackground(ctx, scrollX, width, groundY, isNight = false) {
    const bgKey = isNight ? 'bg_night' : 'bg_day';
    const bgImg = this.blurredBgs[bgKey] || this.images[bgKey];

    if (bgImg && (bgImg.width || bgImg.naturalWidth)) {
      ctx.save();
      const naturalW = bgImg.width || bgImg.naturalWidth;
      const naturalH = bgImg.height || bgImg.naturalHeight;
      const aspect = naturalW / naturalH;
      const bgH = groundY;
      const bgW = bgH * aspect;
      const parallaxSpeed = scrollX * 0.16;
      const offset = -(parallaxSpeed % bgW);

      for (let l = -1; l <= Math.ceil(width / bgW) + 1; l++) {
        const bx0 = Math.round(offset + l * bgW);
        const bx1 = Math.round(offset + (l + 1) * bgW);
        ctx.drawImage(bgImg, bx0, 0, bx1 - bx0, bgH);
      }
      ctx.restore();
    } else {
      // Clean fallback gradient
      ctx.save();
      const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
      if (isNight) {
        skyGrad.addColorStop(0, '#131a38');
        skyGrad.addColorStop(1, '#273369');
      } else {
        skyGrad.addColorStop(0, '#4da6ff');
        skyGrad.addColorStop(1, '#a6dbff');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, groundY);
      ctx.restore();
    }
  }

  // ==========================================
  // GROUND RENDERING
  // ==========================================
  drawGround(ctx, scrollX, width, height, groundY, isNight = false) {
    ctx.save();

    const lineColor = isNight ? '#475569' : '#d97706';
    const fillGradient = ctx.createLinearGradient(0, groundY, 0, height);
    if (isNight) {
      fillGradient.addColorStop(0, '#334155');
      fillGradient.addColorStop(0.2, '#1e293b');
      fillGradient.addColorStop(1, '#0f172a');
    } else {
      fillGradient.addColorStop(0, '#fcd34d');
      fillGradient.addColorStop(0.12, '#fbbf24');
      fillGradient.addColorStop(0.4, '#f59e0b');
      fillGradient.addColorStop(1, '#d97706');
    }

    ctx.fillStyle = fillGradient;
    ctx.fillRect(0, groundY, width, height - groundY);

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // Stylized terrain dashes & smooth pebbles (Varied 2400px cycle for wide screens - ISSUE-05)
    const patternWidth = 600;
    const startIdx = Math.floor(scrollX / patternWidth) - 1;
    const endIdx = Math.ceil((scrollX + width) / patternWidth) + 1;

    ctx.fillStyle = isNight ? '#64748b' : '#b45309';
    ctx.strokeStyle = isNight ? '#64748b' : '#b45309';
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
  drawCactus(ctx, x, y, w, h, type, isNight = false) {
    ctx.save();

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

    // Ground shadow underneath the entire cluster
    ctx.fillStyle = isNight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(180, 83, 9, 0.32)';
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
      const targetH = 48;
      const targetW = targetH * (img.naturalWidth / img.naturalHeight);
      ctx.drawImage(img, x, y, targetW, targetH);
    } else {
      ctx.fillStyle = '#b45309';
      ctx.fillRect(x, y, 62, 48);
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
  drawDino(ctx, x, y, state, animTime = 0, isNight = false, isGrounded = true, jumpPhase = 'IN_AIR', duckDuration = 0, duckEnding = false, gameSpeed = 340) {
    ctx.save();

    let img = null;
    const targetH = 70; // Standard canonical standing/running height
    const dyOffset = -2; // Aligns sprite row 103 (feet soles) precisely with ground line surface (y=groundY-64)
    let dxOffset = 0;

    // 1. DEAD / GAME OVER (Style 1: Standardized 128x112 canvas, baseline aligned, zero magic offsets) (DINO-020)
    if (state === 'DEAD') {
      img = this.images['dino_dead'];
    }
    // 2. MID-AIR HIT IMPACT POSE (DINO-012 transition)
    else if (state === 'HIT') {
      img = this.images['dino_hit'] || this.images['dino_jump_2'];
    }
    // 3. DUCKING (Style 1 Panel 4: Smooth lowering with anticipation, CLOSED EYES during duck, reopen when standing up)
    else if (state === 'DUCKING' || duckEnding) {
      if (duckEnding) {
        // Reopen eyes during recovery transition to running
        img = this.images['dino_duck_4'];
      } else if (duckDuration < 0.04) {
        // Anticipation frame: bending knees, preparing to drop (DINO-011)
        img = this.images['dino_duck_0'];
      } else if (duckDuration < 0.08) {
        // Lowering body into duck posture with eyes closing
        img = this.images['dino_duck_1'];
      } else if (duckDuration < 0.12) {
        // Transitional lowering into full duck posture
        img = this.images['dino_duck_2'];
      } else {
        // Stable sustained crouch pose ("Continue Duck") with CLOSED EYES — rock solid, zero shaking
        img = this.images['dino_duck_3'] || this.images['dino_duck_2'];
      }
    }
    // 4. JUMPING SEQUENCE (Style 1 Panel 3: 5 Distinct Phases with Full Tails)
    else if (state === 'JUMPING' || !isGrounded) {
      if (jumpPhase === 'TAKE_OFF') {
        img = this.images['dino_jump_0'];
      } else if (jumpPhase === 'ASCENDING') {
        img = this.images['dino_jump_1'];
      } else if (jumpPhase === 'IN_AIR') {
        img = this.images['dino_jump_2'];
      } else if (jumpPhase === 'DESCENDING') {
        img = this.images['dino_jump_3'];
      } else if (jumpPhase === 'LANDING') {
        img = this.images['dino_jump_4'];
      } else {
        img = this.images['dino_jump_2'];
      }
    }
    // 5. RUNNING CYCLE (Strictly alternating two-leg cartoon run cycle - 6 frames)
    // Frame 0 -> Stride A Contact (Near leg forward, far leg back, heel/foot firmly planted on baseline y=103)
    // Frame 1 -> Stride A Passing (Near leg supporting on baseline y=103, far leg knee tucking forward)
    // Frame 2 -> Stride A Push-off / Extension (Near leg push-off, far leg extending)
    // Frame 3 -> Stride B Contact (Far leg forward, near leg back, far foot planted on baseline y=103)
    // Frame 4 -> Stride B Passing (Far leg supporting on baseline y=103, near leg swinging forward)
    // Frame 5 -> Stride B Push-off / Extension (Far leg push-off, near leg extending forward smoothly into Frame 0)
    // Both legs visibly participate with believable ground contact at y=103 and zero floating
    else if (state === 'RUNNING') {
      const runFps = Math.min(16.0, 10.0 + (gameSpeed / 85.0));
      const runSequence = [0, 1, 2, 3, 4, 5];
      const frameIdx = Math.floor(animTime * runFps) % runSequence.length;
      img = this.images['dino_run_' + runSequence[frameIdx]] || this.images['dino_run_0'];
    }
    // 6. IDLE ANIMATION (Normal, Breathing, Half-Closed Blinking, Look Around)
    else {
      const loopTime = animTime % 6.0;
      if (loopTime > 4.8) {
        img = this.images['dino_idle_3']; // Look Around
      } else if (loopTime >= 2.68 && loopTime < 2.75) {
        img = this.images['dino_idle_1']; // Half closed (closing)
      } else if (loopTime >= 2.75 && loopTime < 2.92) {
        img = this.images['dino_idle_2']; // Fully closed blink
      } else if (loopTime >= 2.92 && loopTime < 2.99) {
        img = this.images['dino_idle_1']; // Half closed (reopening)
      } else {
        img = this.images['dino_idle_0']; // Standing & breathing
      }
    }

    let targetW = targetH;
    if (img && img.complete && img.naturalHeight > 0) {
      targetW = targetH * (img.naturalWidth / img.naturalHeight);
    }

    // Draw the clean Style 1 sprite directly on the ground line without artificial blob overlays

    // Draw the clean Style 1 sprite
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, x + dxOffset, y + dyOffset, targetW, targetH);
    } else {
      ctx.fillStyle = '#52be32';
      ctx.fillRect(x, y + dyOffset, targetW, targetH);
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
  // - CRITICAL: Stationary mascot — NEVER loops running frames!
  // - NO ground surface, NO platform, and NO ground shadow!
  // =========================================================================
  drawMascot(ctx, cx, cy, size = 135, animTime = 0) {
    ctx.save();

    // Natural varied idle timeline (~7.4 second cycle)
    const cycle = animTime % 7.4;
    let imgKey = 'dino_idle_0'; // Base cute relaxed standing mascot

    if (cycle >= 2.50 && cycle < 2.58) {
      imgKey = 'dino_idle_1'; // Eye blink start
    } else if (cycle >= 2.58 && cycle < 2.74) {
      imgKey = 'dino_idle_2'; // Closed eye gentle blink
    } else if (cycle >= 2.74 && cycle < 2.82) {
      imgKey = 'dino_idle_1'; // Eye blink reopening
    } else if (cycle >= 4.60 && cycle < 5.70) {
      imgKey = 'dino_idle_3'; // Sweet curious look-around / head tilt with perky expression
    } else if (cycle >= 6.30 && cycle < 6.37) {
      imgKey = 'dino_idle_1'; // Occasional quick secondary blink start
    } else if (cycle >= 6.37 && cycle < 6.50) {
      imgKey = 'dino_idle_2'; // Closed eye blink
    } else if (cycle >= 6.50 && cycle < 6.57) {
      imgKey = 'dino_idle_1'; // Eye blink reopening
    }

    const img = this.images[imgKey] || this.images['dino_idle_0'];

    if (img && img.complete && img.naturalHeight > 0) {
      const targetH = size;
      const targetW = targetH * (img.naturalWidth / img.naturalHeight);

      // Very subtle stationary micro-breathing (<0.8px), NO running/walking/jumping
      const breath = Math.sin(animTime * Math.PI * 1.1) * 0.75;
      const drawX = cx - targetW / 2;
      const drawY = cy - targetH / 2 + breath;

      // Draw mascot directly with NO ground surface and NO ground shadow
      ctx.drawImage(img, drawX, drawY, targetW, targetH);
    }

    ctx.restore();
  }
}

window.spriteRenderer = new SpriteRenderer();
