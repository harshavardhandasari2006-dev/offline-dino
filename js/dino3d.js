/**
 * OFFLINE DINO — 3D Dinosaur Engine (Three.js)
 * Provides genuine, fully modeled 3D cartoon dinosaur with continuous 360° rotation,
 * interactive drag controls, studio lighting, and full 9-skin palette support.
 */

(function(window) {
  'use strict';

  class Dino3DViewer {
    constructor() {
      this.container = null;
      this.canvas = null;
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      this.dinoGroup = null;
      this.materials = {};
      this.skinId = 'green';
      this.mode = 'customization'; // 'customization' (360 drag) or 'mascot' (home cursor tracking)

      // Rotation state
      this.currentRotationY = 0.55; // Initial friendly 3/4 front-right pose
      this.targetRotationY = 0.55;
      this.isDragging = false;
      this.lastPointerX = 0;
      this.pointerVelocity = 0;
      this.rafId = null;
      this.clock = null;

      // Home mascot cursor tracking & cute reaction state
      this.hasCursor = false;
      this.trackingTargetY = 0;
      this.trackingTargetX = 0;
      this.currentRotationX = 0;
      this.currentTilt = 0;
      this.headTilt = 0;
      this.mascotBounceY = 0;
      this.bounceVelocity = 0;
      this.isCursorNear = false;
      this.approachCooldown = 0;
      this.onCanvasClick = null;

      // Micro-animation state
      this.idleTime = 0;
      this.blinkTimer = 0;
      this.isBlinking = false;
      this.eyelidLeft = null;
      this.eyelidRight = null;

      // Bound handlers for cleanup
      this.onPointerDown = this.handlePointerDown.bind(this);
      this.onPointerMove = this.handlePointerMove.bind(this);
      this.onPointerUp = this.handlePointerUp.bind(this);
      this.onResize = this.handleResize.bind(this);
    }

    /**
     * Initialize 3D Viewer inside target container or canvas
     */
    init(targetElement, initialSkinId = 'green', options = {}) {
      if (!window.THREE) {
        console.warn('[Dino3D] Three.js not loaded. Falling back to 2D.');
        return false;
      }

      this.mode = options.mode || 'customization';
      this.skinId = initialSkinId;
      this.clock = new THREE.Clock();

      if (this.mode === 'mascot') {
        this.currentRotationY = 0;
        this.targetRotationY = 0;
        this.trackingTargetY = 0;
        this.trackingTargetX = 0;
      } else {
        this.currentRotationY = 0.55;
        this.targetRotationY = 0.55;
      }

      // Check if target is canvas or container
      if (targetElement.tagName === 'CANVAS') {
        this.canvas = targetElement;
        this.container = targetElement.parentElement;
      } else {
        this.container = targetElement;
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'dino3DCanvas';
        this.container.appendChild(this.canvas);
      }

      const width = this.container.clientWidth || (this.mode === 'mascot' ? 220 : 260);
      const height = this.container.clientHeight || (this.mode === 'mascot' ? 170 : 240);

      // 1. Create WebGL Renderer
      try {
        this.renderer = new THREE.WebGLRenderer({
          canvas: this.canvas,
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance'
        });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(width, height, false);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
      } catch (err) {
        console.error('[Dino3D] WebGL initialization failed:', err);
        return false;
      }

      // 2. Create Scene & Camera
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
      if (this.mode === 'mascot') {
        this.camera.position.set(0, 4.0, 16.5);
        this.camera.lookAt(0, 3.75, 0);
      } else {
        this.camera.position.set(0, 4.3, 17.5);
        this.camera.lookAt(0, 3.8, 0);
      }

      // 3. Studio Stage Lighting Setup (Key, Fill, Rim)
      this.setupLighting();

      // 4. Construct Full 3D Dinosaur Mesh
      this.buildDinoModel(this.skinId);

      // 5. Attach Interactive Pointer / Drag Controls
      this.bindEvents();

      // 6. Start Render Loop
      this.startLoop();

      return true;
    }

    setupLighting() {
      // Warm ambient light for soft cartoon shadows
      const ambient = new THREE.AmbientLight(0xfffaed, 1.4);
      this.scene.add(ambient);

      // Key Sunlight (Front-Right-High)
      const sunLight = new THREE.DirectionalLight(0xfff5e6, 2.2);
      sunLight.position.set(7, 14, 11);
      this.scene.add(sunLight);

      // Rim / Backlight (Highlights dorsal spine and head silhouette from rear)
      const rimLight = new THREE.DirectionalLight(0x90cdf4, 1.6);
      rimLight.position.set(-6, 9, -12);
      this.scene.add(rimLight);

      // Soft Fill Light (Left-Low)
      const fillLight = new THREE.DirectionalLight(0xfef08a, 0.7);
      fillLight.position.set(-8, 3, 7);
      this.scene.add(fillLight);
    }

    /**
     * Get or create materials for active skin palette
     */
    initMaterials(skinId) {
      let skinDef = null;
      if (window.SkinManager && typeof window.SkinManager.getSkinById === 'function') {
        skinDef = window.SkinManager.getSkinById(skinId);
      }
      if (!skinDef) {
        skinDef = {
          swatchColor: '#60b932',
          accentColor: '#276749'
        };
      }

      // 1. Main Skin Material (PBR Standard Material with rich cartoon feel)
      this.materials.skin = new THREE.MeshStandardMaterial({
        color: new THREE.Color(skinDef.swatchColor),
        roughness: 0.42,
        metalness: 0.04
      });

      // 2. Dorsal Spikes Accent Material (Darker harmonious accent tone)
      this.materials.spikes = new THREE.MeshStandardMaterial({
        color: new THREE.Color(skinDef.accentColor),
        roughness: 0.38,
        metalness: 0.06
      });

      // 3. Flank Spots & Brow Accent Material
      this.materials.spots = new THREE.MeshStandardMaterial({
        color: new THREE.Color(skinDef.accentColor),
        roughness: 0.46,
        metalness: 0.03
      });

      // 4. Protected Cream Belly & Chest (#fbf4d4)
      this.materials.belly = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fbf4d4'),
        roughness: 0.52,
        metalness: 0.02
      });

      // 5. Protected Eye Sclera (Warm White #f8fafc)
      this.materials.eyeWhite = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#f8fafc'),
        roughness: 0.18,
        metalness: 0.05
      });

      // 6. Protected Black Pupil (#0a0f1d)
      this.materials.pupil = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#0a0f1d'),
        roughness: 0.10,
        metalness: 0.08
      });

      // 7. Crisp White Catchlight Highlight
      this.materials.catchlight = new THREE.MeshBasicMaterial({
        color: 0xffffff
      });

      // 8. Ivory Claws & Teeth (#fef3c7)
      this.materials.claws = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#fef3c7'),
        roughness: 0.32,
        metalness: 0.05
      });

      // 9. Nostrils & Mouth Crease
      this.materials.nostrils = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#1e293b'),
        roughness: 0.8
      });
      this.materials.mouth = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#1e293b'),
        roughness: 0.85
      });

      // 10. Soft Pedestal Contact Shadow
      const shadowCanvas = document.createElement('canvas');
      shadowCanvas.width = 128;
      shadowCanvas.height = 128;
      const sCtx = shadowCanvas.getContext('2d');
      const grad = sCtx.createRadialGradient(64, 64, 10, 64, 64, 60);
      grad.addColorStop(0, 'rgba(15, 23, 42, 0.48)');
      grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.25)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
      sCtx.fillStyle = grad;
      sCtx.beginPath();
      sCtx.arc(64, 64, 60, 0, Math.PI * 2);
      sCtx.fill();

      const shadowTex = new THREE.CanvasTexture(shadowCanvas);
      this.materials.shadow = new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false
      });
    }

    /**
     * Build the cohesive 3D Cartoon Dinosaur Model
     */
    buildDinoModel(skinId) {
      if (this.dinoGroup) {
        this.scene.remove(this.dinoGroup);
      }

      this.initMaterials(skinId);
      const materials = this.materials;
      const root = new THREE.Group();
      root.name = 'Faithful_Dino_Root';

      const bodyGroup = new THREE.Group();
  bodyGroup.name = 'Body_Group';

  // ==============================================================
  // 1. FORWARD-LEANING TORSO & CHUBBY CREAM BELLY
  // Authentic theropod posture: angled forward at ~26 deg
  // ==============================================================
  const torsoGeom = new THREE.SphereGeometry(1.68, 32, 28);
  torsoGeom.scale(1.02, 1.28, 1.32);
  const torsoMesh = new THREE.Mesh(torsoGeom, materials.skin);
  torsoMesh.name = 'Torso';
  torsoMesh.position.set(0, 2.92, -0.15);
  torsoMesh.rotation.x = 0.44;
  bodyGroup.add(torsoMesh);

  // Prominent Cream Belly Shield (Forms the gleaming front/underside silhouette)
  const bellyGeom = new THREE.SphereGeometry(1.55, 32, 26);
  bellyGeom.scale(0.88, 1.25, 1.15);
  const bellyMesh = new THREE.Mesh(bellyGeom, materials.belly);
  bellyMesh.name = 'Cream_Belly';
  bellyMesh.position.set(0, 2.82, 0.62); // Project forward so it defines the anterior profile
  bellyMesh.rotation.x = 0.46;
  bodyGroup.add(bellyMesh);

  // Anterior throat cream plate connecting lower jaw to chest
  const throatGeom = new THREE.CylinderGeometry(0.88, 1.12, 1.55, 24);
  throatGeom.scale(0.82, 1.0, 0.95);
  const throatMesh = new THREE.Mesh(throatGeom, materials.belly);
  throatMesh.name = 'Cream_Throat';
  throatMesh.position.set(0, 4.12, 1.05);
  throatMesh.rotation.x = 0.52;
  bodyGroup.add(throatMesh);

  // ==============================================================
  // 2. MUSCULAR FORWARD NECK
  // Fleshy neck flowing from upper chest into skull base
  // ==============================================================
  const neckGeom = new THREE.CylinderGeometry(1.22, 1.48, 1.62, 28);
  neckGeom.scale(0.92, 1.0, 1.08);
  const neckMesh = new THREE.Mesh(neckGeom, materials.skin);
  neckMesh.name = 'Neck';
  neckMesh.position.set(0, 4.08, 0.48);
  neckMesh.rotation.x = 0.48;
  bodyGroup.add(neckMesh);

  // ==============================================================
  // 3. LARGE EXPRESSIVE CARTOON HEAD
  // Authentic T-Rex: ~45% of character height, boxy snout, arched brow
  // ==============================================================
  const headGroup = new THREE.Group();
  headGroup.name = 'Head_Group';
  headGroup.position.set(0, 5.05, 1.35); // Forward position matching 2D sprite

  // A. Cranium / Skull Box
  const craniumGeom = new THREE.SphereGeometry(1.72, 32, 28);
  craniumGeom.scale(1.10, 1.05, 1.28);
  const craniumMesh = new THREE.Mesh(craniumGeom, materials.skin);
  craniumMesh.name = 'Cranium';
  headGroup.add(craniumMesh);

  // B. Arched Supraorbital Brow Ridges (Left & Right)
  const browGeom = new THREE.SphereGeometry(0.85, 24, 20);
  browGeom.scale(0.85, 0.65, 1.38);

  const browR = new THREE.Mesh(browGeom, materials.skin);
  browR.name = 'Brow_Right';
  browR.position.set(0.84, 0.88, 0.45);
  browR.rotation.set(-0.15, 0.24, -0.20);
  headGroup.add(browR);

  const browL = new THREE.Mesh(browGeom, materials.skin);
  browL.name = 'Brow_Left';
  browL.position.set(-0.84, 0.88, 0.45);
  browL.rotation.set(-0.15, -0.24, 0.20);
  headGroup.add(browL);

  // Brow shadow creases above eyes
  const creaseGeom = new THREE.TorusGeometry(0.68, 0.09, 12, 22, Math.PI * 0.75);
  const creaseR = new THREE.Mesh(creaseGeom, materials.spots);
  creaseR.position.set(0.90, 0.98, 0.48);
  creaseR.rotation.set(0.20, 0.32, -0.25);
  headGroup.add(creaseR);

  const creaseL = new THREE.Mesh(creaseGeom, materials.spots);
  creaseL.position.set(-0.90, 0.98, 0.48);
  creaseL.rotation.set(0.20, -0.32, 0.25);
  headGroup.add(creaseL);

  // C. Blocky Cartoon Snout / Muzzle
  const snoutGeom = new THREE.SphereGeometry(1.48, 30, 24);
  snoutGeom.scale(1.02, 0.88, 1.38);
  const snoutMesh = new THREE.Mesh(snoutGeom, materials.skin);
  snoutMesh.name = 'Snout';
  snoutMesh.position.set(0, -0.22, 1.32);
  headGroup.add(snoutMesh);

  // Nose bridge bevel
  const noseBridgeGeom = new THREE.CylinderGeometry(0.95, 1.18, 1.12, 24);
  noseBridgeGeom.scale(1.08, 0.78, 1.25);
  const noseBridge = new THREE.Mesh(noseBridgeGeom, materials.skin);
  noseBridge.position.set(0, 0.18, 1.72);
  noseBridge.rotation.x = -0.32;
  headGroup.add(noseBridge);

  // Two dark nostril pits on snout top
  const nostrilGeom = new THREE.SphereGeometry(0.12, 14, 12);
  nostrilGeom.scale(0.85, 1.40, 0.65);
  const nostrilL = new THREE.Mesh(nostrilGeom, materials.nostrils);
  nostrilL.position.set(-0.40, 0.24, 2.58);
  headGroup.add(nostrilL);

  const nostrilR = new THREE.Mesh(nostrilGeom, materials.nostrils);
  nostrilR.position.set(0.40, 0.24, 2.58);
  headGroup.add(nostrilR);

  // D. Smiling Mouth Line & Cheeks
  const mouthGeom = new THREE.TorusGeometry(1.08, 0.055, 10, 26, Math.PI * 0.58);
  const mouthLineR = new THREE.Mesh(mouthGeom, materials.mouth);
  mouthLineR.position.set(0.58, -0.55, 1.12);
  mouthLineR.rotation.set(0.25, 0.45, -0.22);
  headGroup.add(mouthLineR);

  const mouthLineL = new THREE.Mesh(mouthGeom, materials.mouth);
  mouthLineL.position.set(-0.58, -0.55, 1.12);
  mouthLineL.rotation.set(0.25, -0.45, 0.22);
  headGroup.add(mouthLineL);

  // Cute tiny white upper tooth accents
  const toothGeom = new THREE.ConeGeometry(0.09, 0.22, 8);
  toothGeom.scale(0.85, 1.0, 0.85);
  const toothR = new THREE.Mesh(toothGeom, materials.claws);
  toothR.position.set(0.70, -0.70, 1.55);
  toothR.rotation.x = Math.PI;
  headGroup.add(toothR);

  const toothL = new THREE.Mesh(toothGeom, materials.claws);
  toothL.position.set(-0.70, -0.70, 1.55);
  toothL.rotation.x = Math.PI;
  headGroup.add(toothL);

  // E. Recessed Lower Jaw with Cream Throat Underneath
  const jawGeom = new THREE.SphereGeometry(1.18, 24, 20);
  jawGeom.scale(0.88, 0.55, 1.15);
  const jawMesh = new THREE.Mesh(jawGeom, materials.belly);
  jawMesh.name = 'Lower_Jaw_Cream';
  jawMesh.position.set(0, -0.85, 1.18); // Extending forward under snout
  headGroup.add(jawMesh);

  // ==============================================================
  // 4. THE SOULFUL CARTOON EYES (Embedded, Big Pupils, Double Glint)
  // Perfectly nestled inside orbital sockets under the brows
  // ==============================================================
  const eyeScleraGeom = new THREE.SphereGeometry(0.82, 28, 24);
  eyeScleraGeom.scale(0.86, 1.18, 0.82);

  // Massive circular glossy pupil (72% coverage of eye height)
  const pupilGeom = new THREE.SphereGeometry(0.66, 26, 22);
  pupilGeom.scale(0.88, 1.15, 0.35);

  // Double Catchlight Highlights (Signature OFFLINE DINO glint)
  const mainGlintGeom = new THREE.SphereGeometry(0.24, 14, 12);
  const secondaryGlintGeom = new THREE.SphereGeometry(0.10, 10, 8);

  // --- RIGHT EYE ---
  const eyeRGroup = new THREE.Group();
  eyeRGroup.name = 'Eye_Right_Group';
  eyeRGroup.position.set(0.98, 0.45, 0.92);
  eyeRGroup.rotation.set(-0.06, 0.28, -0.05);

  const scleraR = new THREE.Mesh(eyeScleraGeom, materials.eyeWhite);
  eyeRGroup.add(scleraR);

  const pupilR = new THREE.Mesh(pupilGeom, materials.pupil);
  pupilR.position.set(0.04, 0.02, 0.55);
  eyeRGroup.add(pupilR);

  // Primary Catchlight (Upper-Front)
  const glintR1 = new THREE.Mesh(mainGlintGeom, materials.catchlight);
  glintR1.position.set(0.20, 0.30, 0.72);
  eyeRGroup.add(glintR1);

  // Secondary Sparkle (Lower-Rear)
  const glintR2 = new THREE.Mesh(secondaryGlintGeom, materials.catchlight);
  glintR2.position.set(-0.18, -0.24, 0.65);
  eyeRGroup.add(glintR2);

  // Eyelid for smooth blinking
  const eyelidGeom = new THREE.SphereGeometry(0.86, 26, 20, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const eyelidR = new THREE.Mesh(eyelidGeom, materials.skin);
  eyelidR.name = 'Eyelid_Right';
  eyelidR.position.set(0, 0.05, 0);
  eyelidR.rotation.x = -Math.PI * 0.55; // Open
  eyeRGroup.add(eyelidR);

  headGroup.add(eyeRGroup);

  // --- LEFT EYE ---
  const eyeLGroup = new THREE.Group();
  eyeLGroup.name = 'Eye_Left_Group';
  eyeLGroup.position.set(-0.98, 0.45, 0.92);
  eyeLGroup.rotation.set(-0.06, -0.28, 0.05);

  const scleraL = new THREE.Mesh(eyeScleraGeom, materials.eyeWhite);
  eyeLGroup.add(scleraL);

  const pupilL = new THREE.Mesh(pupilGeom, materials.pupil);
  pupilL.position.set(-0.04, 0.02, 0.55);
  eyeLGroup.add(pupilL);

  // Primary Catchlight (Upper-Front)
  const glintL1 = new THREE.Mesh(mainGlintGeom, materials.catchlight);
  glintL1.position.set(-0.08, 0.30, 0.72);
  eyeLGroup.add(glintL1);

  // Secondary Sparkle (Lower-Rear)
  const glintL2 = new THREE.Mesh(secondaryGlintGeom, materials.catchlight);
  glintL2.position.set(0.18, -0.24, 0.65);
  eyeLGroup.add(glintL2);

  const eyelidL = new THREE.Mesh(eyelidGeom, materials.skin);
  eyelidL.name = 'Eyelid_Left';
  eyelidL.position.set(0, 0.05, 0);
  eyelidL.rotation.x = -Math.PI * 0.55; // Open
  eyeLGroup.add(eyelidL);

  headGroup.add(eyeLGroup);

  bodyGroup.add(headGroup);

  // ==============================================================
  // 5. PROMINENT DORSAL CREST PLATES (Stegosaurus/Godzilla Cartoon Crest)
  // Thin in X, wide in Z, tall in Y with rounded apex along spine
  // Elevated coordinates so plates ride proudly above the back surface
  // ==============================================================
  function createDorsalPlate(scaleX, scaleY, scaleZ) {
    const geom = new THREE.ConeGeometry(0.75 * scaleX, 1.65 * scaleY, 4);
    geom.scale(0.32, 1.0, 1.45 * scaleZ);
    return geom;
  }

  const plateConfigs = [
    { x: 0, y: 6.85, z: 1.25, rx: -0.15, sx: 0.80, sy: 0.75, sz: 0.80 }, // Head crown between brows
    { x: 0, y: 6.45, z: 0.35, rx: -0.38, sx: 1.05, sy: 0.95, sz: 1.05 }, // Back of skull
    { x: 0, y: 5.55, z: -0.35, rx: -0.55, sx: 1.25, sy: 1.15, sz: 1.25 }, // Upper neck
    { x: 0, y: 4.65, z: -0.85, rx: -0.70, sx: 1.55, sy: 1.42, sz: 1.55 }, // Upper back / Shoulders
    { x: 0, y: 3.75, z: -1.35, rx: -0.82, sx: 1.62, sy: 1.48, sz: 1.62 }, // Mid back (prominent crest)
    { x: 0, y: 2.85, z: -1.85, rx: -0.95, sx: 1.42, sy: 1.28, sz: 1.42 }, // Pelvic spine
    { x: 0, y: 2.45, z: -2.55, rx: -1.15, sx: 1.15, sy: 1.05, sz: 1.15 }, // Tail base
    { x: 0, y: 2.38, z: -3.35, rx: -1.32, sx: 0.88, sy: 0.78, sz: 0.88 }, // Mid tail
    { x: 0, y: 2.62, z: -4.18, rx: -1.55, sx: 0.62, sy: 0.55, sz: 0.62 }  // Tail tip
  ];

  plateConfigs.forEach((cfg, idx) => {
    const geom = createDorsalPlate(cfg.sx, cfg.sy, cfg.sz);
    const plate = new THREE.Mesh(geom, materials.spikes);
    plate.name = `Dorsal_Plate_${idx}`;
    plate.position.set(cfg.x, cfg.y, cfg.z);
    plate.rotation.x = cfg.rx;
    bodyGroup.add(plate);
  });

  // ==============================================================
  // 6. CONTINUOUS ORGANIC TAIL (Horizontal with upturned tip)
  // Perfectly counterbalances the forward-leaning head and chest
  // ==============================================================
  const tailSeg1 = new THREE.CylinderGeometry(1.15, 1.68, 1.75, 26);
  tailSeg1.scale(0.92, 1.0, 1.25);
  const tailMesh1 = new THREE.Mesh(tailSeg1, materials.skin);
  tailMesh1.name = 'Tail_Segment_1';
  tailMesh1.position.set(0, 2.15, -1.75);
  tailMesh1.rotation.x = -1.02;
  bodyGroup.add(tailMesh1);

  const tailSeg2 = new THREE.CylinderGeometry(0.65, 1.15, 1.75, 22);
  tailSeg2.scale(0.88, 1.0, 1.18);
  const tailMesh2 = new THREE.Mesh(tailSeg2, materials.skin);
  tailMesh2.name = 'Tail_Segment_2';
  tailMesh2.position.set(0, 1.95, -3.05);
  tailMesh2.rotation.x = -1.42;
  bodyGroup.add(tailMesh2);

  const tailSeg3 = new THREE.ConeGeometry(0.65, 1.75, 20);
  tailSeg3.scale(0.82, 1.0, 1.10);
  const tailMesh3 = new THREE.Mesh(tailSeg3, materials.skin);
  tailMesh3.name = 'Tail_Segment_3';
  tailMesh3.position.set(0, 2.35, -4.45);
  tailMesh3.rotation.x = -1.75; // Graceful upward cartoon flick
  bodyGroup.add(tailMesh3);

  // Under-tail cream transition at base
  const underTailGeom = new THREE.SphereGeometry(0.88, 20, 16);
  underTailGeom.scale(0.72, 0.48, 1.28);
  const underTail = new THREE.Mesh(underTailGeom, materials.belly);
  underTail.position.set(0, 1.65, -1.55);
  bodyGroup.add(underTail);

  // ==============================================================
  // 7. ARMS & FORELIMBS
  // Small cute T-Rex arms positioned on forward chest
  // ==============================================================
  const armGeom = new THREE.CylinderGeometry(0.26, 0.38, 1.05, 18);
  armGeom.scale(0.85, 1.0, 1.12);

  const armClawGeom = new THREE.ConeGeometry(0.09, 0.28, 8);
  armClawGeom.scale(0.7, 1.0, 1.2);

  // Right Arm
  const armRGroup = new THREE.Group();
  armRGroup.name = 'Arm_Right_Group';
  armRGroup.position.set(1.32, 3.45, 0.92);
  armRGroup.rotation.set(0.65, 0.22, -0.38);

  const armR = new THREE.Mesh(armGeom, materials.skin);
  armRGroup.add(armR);

  const aClawR1 = new THREE.Mesh(armClawGeom, materials.claws);
  aClawR1.position.set(-0.09, -0.58, 0.14);
  aClawR1.rotation.x = 0.55;
  armRGroup.add(aClawR1);

  const aClawR2 = new THREE.Mesh(armClawGeom, materials.claws);
  aClawR2.position.set(0.09, -0.58, 0.14);
  aClawR2.rotation.x = 0.55;
  armRGroup.add(aClawR2);

  bodyGroup.add(armRGroup);

  // Left Arm
  const armLGroup = new THREE.Group();
  armLGroup.name = 'Arm_Left_Group';
  armLGroup.position.set(-1.32, 3.45, 0.92);
  armLGroup.rotation.set(0.65, -0.22, 0.38);

  const armL = new THREE.Mesh(armGeom, materials.skin);
  armLGroup.add(armL);

  const aClawL1 = new THREE.Mesh(armClawGeom, materials.claws);
  aClawL1.position.set(-0.09, -0.58, 0.14);
  aClawL1.rotation.x = 0.55;
  armLGroup.add(aClawL1);

  const aClawL2 = new THREE.Mesh(armClawGeom, materials.claws);
  aClawL2.position.set(0.09, -0.58, 0.14);
  aClawL2.rotation.x = 0.55;
  armLGroup.add(aClawL2);

  bodyGroup.add(armLGroup);

  // ==============================================================
  // 8. LEGS & 3-TOED FEET WITH WHITE/CREAM CLAWS
  // Chunky muscular thighs, stout calves, plantigrade cartoon feet
  // ==============================================================
  const thighGeom = new THREE.SphereGeometry(1.32, 26, 22);
  thighGeom.scale(0.85, 1.35, 1.25);

  const calfGeom = new THREE.CylinderGeometry(0.58, 0.72, 1.35, 22);

  const footGeom = new THREE.SphereGeometry(0.85, 22, 18);
  footGeom.scale(0.92, 0.42, 1.72);

  const toeClawGeom = new THREE.ConeGeometry(0.15, 0.46, 12);
  toeClawGeom.scale(0.85, 1.0, 1.35);

  const spotGeom = new THREE.CircleGeometry(0.22, 16);

  // --- Right Leg ---
  const legRGroup = new THREE.Group();
  legRGroup.name = 'Leg_Right_Group';
  legRGroup.position.set(1.30, 0, -0.15);

  const thighR = new THREE.Mesh(thighGeom, materials.skin);
  thighR.position.set(0.20, 2.35, -0.05);
  thighR.rotation.x = -0.10;
  legRGroup.add(thighR);

  // Right Flank Spots (freckles matching 2D sprite)
  const spotR1 = new THREE.Mesh(spotGeom, materials.spots);
  spotR1.position.set(1.18, 2.65, 0.05);
  spotR1.rotation.y = Math.PI / 2;
  legRGroup.add(spotR1);

  const spotR2 = new THREE.Mesh(spotGeom, materials.spots);
  spotR2.scale.set(0.72, 0.72, 0.72);
  spotR2.position.set(1.12, 2.32, 0.38);
  spotR2.rotation.y = Math.PI / 2;
  legRGroup.add(spotR2);

  const calfR = new THREE.Mesh(calfGeom, materials.skin);
  calfR.position.set(0.08, 1.15, 0.15);
  calfR.rotation.x = 0.14;
  legRGroup.add(calfR);

  const footR = new THREE.Mesh(footGeom, materials.skin);
  footR.position.set(0.08, 0.34, 0.62);
  legRGroup.add(footR);

  // 3 Claws on Right Foot
  [-0.28, 0, 0.28].forEach(xOff => {
    const claw = new THREE.Mesh(toeClawGeom, materials.claws);
    claw.position.set(0.08 + xOff, 0.18, 1.82);
    claw.rotation.x = 1.35;
    legRGroup.add(claw);
  });

  bodyGroup.add(legRGroup);

  // --- Left Leg ---
  const legLGroup = new THREE.Group();
  legLGroup.name = 'Leg_Left_Group';
  legLGroup.position.set(-1.30, 0, -0.15);

  const thighL = new THREE.Mesh(thighGeom, materials.skin);
  thighL.position.set(-0.20, 2.35, -0.05);
  thighL.rotation.x = -0.10;
  legLGroup.add(thighL);

  // Left Flank Spots
  const spotL1 = new THREE.Mesh(spotGeom, materials.spots);
  spotL1.position.set(-1.18, 2.65, 0.05);
  spotL1.rotation.y = -Math.PI / 2;
  legLGroup.add(spotL1);

  const spotL2 = new THREE.Mesh(spotGeom, materials.spots);
  spotL2.scale.set(0.72, 0.72, 0.72);
  spotL2.position.set(-1.12, 2.32, 0.38);
  spotL2.rotation.y = -Math.PI / 2;
  legLGroup.add(spotL2);

  const calfL = new THREE.Mesh(calfGeom, materials.skin);
  calfL.position.set(-0.08, 1.15, 0.15);
  calfL.rotation.x = 0.14;
  legLGroup.add(calfL);

  const footL = new THREE.Mesh(footGeom, materials.skin);
  footL.position.set(-0.08, 0.34, 0.62);
  legLGroup.add(footL);

  // 3 Claws on Left Foot
  [-0.28, 0, 0.28].forEach(xOff => {
    const claw = new THREE.Mesh(toeClawGeom, materials.claws);
    claw.position.set(-0.08 + xOff, 0.18, 1.82);
    claw.rotation.x = 1.35;
    legLGroup.add(claw);
  });

  bodyGroup.add(legLGroup);

  // Balance dinosaur in local space centered on hips/feet
  bodyGroup.position.set(0, -0.20, 0.40);
  root.add(bodyGroup);

      // ==============================================================
      // 9. STAGE CONTACT SHADOW
      // ==============================================================
      if (this.mode !== 'mascot') {
        const shadowPlane = new THREE.PlaneGeometry(5.8, 5.8);
        const shadowMesh = new THREE.Mesh(shadowPlane, this.materials.shadow);
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.set(0, 0.02, -0.2);
        bodyGroup.add(shadowMesh);
      }

      this.eyelidR = eyelidR;
      this.eyelidL = eyelidL;
      this.dinoGroup = root;
      this.dinoBodyGroup = bodyGroup;
      this.headGroup = headGroup;
      this.dinoGroup.rotation.y = this.currentRotationY;
      this.scene.add(this.dinoGroup);
    }

    /**
     * Switch skin palette in real time
     */
    setSkin(skinId) {
      this.skinId = skinId;
      let skinDef = null;
      if (window.SkinManager && typeof window.SkinManager.getSkinById === 'function') {
        skinDef = window.SkinManager.getSkinById(skinId);
      }
      if (!skinDef) {
        skinDef = { swatchColor: '#60b932', accentColor: '#276749' };
      }

      if (this.materials.skin) {
        this.materials.skin.color.set(skinDef.swatchColor);
      }
      if (this.materials.spikes) {
        this.materials.spikes.color.set(skinDef.accentColor);
      }
      if (this.materials.spots) {
        this.materials.spots.color.set(skinDef.accentColor);
      }
    }

    rotateBy(deltaRadians) {
      this.targetRotationY += deltaRadians;
    }

    rotateTo(targetRadians) {
      this.targetRotationY = targetRadians;
    }

    getRotation() {
      return this.currentRotationY;
    }

    bindEvents() {
      if (!this.canvas) return;

      this.canvas.style.touchAction = 'none';
      this.canvas.style.cursor = 'grab';

      this.canvas.addEventListener('pointerdown', this.onPointerDown);
      window.addEventListener('pointermove', this.onPointerMove);
      window.addEventListener('pointerup', this.onPointerUp);
      window.addEventListener('pointercancel', this.onPointerUp);
      window.addEventListener('resize', this.onResize);
    }

    handlePointerDown(e) {
      this.isDragging = true;
      this.lastPointerX = e.clientX;
      this.pointerVelocity = 0;
      if (this.canvas) this.canvas.style.cursor = 'grabbing';
    }

    handlePointerMove(e) {
      if (!this.isDragging) return;
      const deltaX = e.clientX - this.lastPointerX;
      this.lastPointerX = e.clientX;
      const sensitivity = 0.014;
      this.targetRotationY += deltaX * sensitivity;
      this.pointerVelocity = deltaX * sensitivity;
    }

    handlePointerUp() {
      if (!this.isDragging) return;
      this.isDragging = false;
      if (this.canvas) this.canvas.style.cursor = 'grab';
    }

    handleResize() {
      if (!this.container || !this.renderer || !this.camera) return;
      const width = this.container.clientWidth || 260;
      const height = this.container.clientHeight || 240;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
    }

    /**
     * Frame-Rate-Independent Render Loop
     */
    startLoop() {
      const render = () => {
        this.rafId = requestAnimationFrame(render);
        const dt = Math.min(this.clock.getDelta(), 0.1);

        // 1. Smooth continuous rotation damping
        if (this.isDragging) {
          this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.35;
        } else {
          // Inertia glide when released
          if (Math.abs(this.pointerVelocity) > 0.0005) {
            this.targetRotationY += this.pointerVelocity;
            this.pointerVelocity *= 0.92;
          }
          this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.14;
        }

        if (this.dinoGroup) {
          this.dinoGroup.rotation.y = this.currentRotationY;

          // 2. Cute cartoon breathing micro-motion
          this.idleTime += dt;
          const breathScale = 1.0 + Math.sin(this.idleTime * 2.8) * 0.008;
          if (this.dinoBodyGroup) {
            this.dinoBodyGroup.scale.set(1.0, breathScale, 1.0);
          }

          // 3. Cute natural blinking
          this.blinkTimer += dt;
          if (this.blinkTimer > 3.8 && !this.isBlinking) {
            this.isBlinking = true;
          }
          if (this.isBlinking) {
            if (this.eyelidR && this.eyelidL) {
              const blinkProgress = (this.blinkTimer - 3.8) / 0.18;
              if (blinkProgress <= 0.5) {
                // Closing
                const t = blinkProgress * 2;
                const rotX = -Math.PI * 0.55 + t * Math.PI * 0.55;
                this.eyelidR.rotation.x = rotX;
                this.eyelidL.rotation.x = rotX;
              } else if (blinkProgress < 1.0) {
                // Reopening
                const t = (blinkProgress - 0.5) * 2;
                const rotX = 0 - t * Math.PI * 0.55;
                this.eyelidR.rotation.x = rotX;
                this.eyelidL.rotation.x = rotX;
              } else {
                this.eyelidR.rotation.x = -Math.PI * 0.55;
                this.eyelidL.rotation.x = -Math.PI * 0.55;
                this.isBlinking = false;
                this.blinkTimer = 0;
              }
            }
          }
        }

        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera);
        }
      };

      this.rafId = requestAnimationFrame(render);
    }

    stopLoop() {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }

    dispose() {
      this.stopLoop();

      if (this.canvas) {
        this.canvas.removeEventListener('pointerdown', this.onPointerDown);
      }
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      window.removeEventListener('pointercancel', this.onPointerUp);
      window.removeEventListener('resize', this.onResize);

      if (this.renderer) {
        this.renderer.dispose();
      }

      // Dispose scene geometries and materials
      if (this.scene) {
        this.scene.traverse(child => {
          if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
      }
    }
  }

  window.Dino3DViewer = Dino3DViewer;
})(typeof window !== 'undefined' ? window : global);
