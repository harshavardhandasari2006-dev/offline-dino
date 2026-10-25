import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

if (typeof window === 'undefined') {
  global.window = {};
}
if (typeof FileReader === 'undefined') {
  global.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then(buf => {
        this.result = buf;
        if (this.onload) this.onload({ target: this });
        if (this.onloadend) this.onloadend({ target: this });
      });
    }
  };
}

/**
 * Creates the faithful 3D Dinosaur character matching OFFLINE DINO gameplay sprites.
 * Authentic theropod forward-leaning cartoon posture, large expressive head,
 * blocky snout, arched brow ridges, massive soulful pupils with double catchlights,
 * continuous cream belly, rounded dorsal plates, and upturned balanced tail.
 */
export function createFaithfulDinoModel(skinColors = {}) {
  const swatchColor = skinColors.swatchColor || '#60b932';
  const accentColor = skinColors.accentColor || '#276749';

  const root = new THREE.Group();
  root.name = 'Faithful_Dino_Root';

  // Materials
  const materials = {
    skin: new THREE.MeshStandardMaterial({
      color: new THREE.Color(swatchColor),
      roughness: 0.42,
      metalness: 0.04,
      name: 'Mat_DinoSkin'
    }),
    spots: new THREE.MeshStandardMaterial({
      color: new THREE.Color(accentColor),
      roughness: 0.46,
      metalness: 0.03,
      name: 'Mat_DinoSpots'
    }),
    spikes: new THREE.MeshStandardMaterial({
      color: new THREE.Color(accentColor),
      roughness: 0.38,
      metalness: 0.06,
      name: 'Mat_DorsalSpikes'
    }),
    belly: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fbf4d4'),
      roughness: 0.52,
      metalness: 0.02,
      name: 'Mat_CreamBelly'
    }),
    eyeWhite: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f8fafc'),
      roughness: 0.18,
      metalness: 0.05,
      name: 'Mat_EyeWhite'
    }),
    pupil: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#0a0f1d'),
      roughness: 0.10,
      metalness: 0.08,
      name: 'Mat_Pupil'
    }),
    catchlight: new THREE.MeshBasicMaterial({
      color: 0xffffff,
      name: 'Mat_Catchlight'
    }),
    claws: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fef3c7'),
      roughness: 0.32,
      metalness: 0.05,
      name: 'Mat_Claws'
    }),
    nostrils: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1e293b'),
      roughness: 0.8,
      name: 'Mat_Nostrils'
    }),
    mouth: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1e293b'),
      roughness: 0.85,
      name: 'Mat_Mouth'
    })
  };

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

  return { root, bodyGroup, headGroup, eyelidR, eyelidL, materials };
}

if (process.argv[1] && process.argv[1].includes('build_faithful_dino.js')) {
  console.log('Building Faithful Dino 3D Model with Theropod Posture...');
  const { root } = createFaithfulDinoModel();
  const exporter = new GLTFExporter();
  exporter.parse(
    root,
    (gltf) => {
      const outPath = path.join(process.cwd(), 'assets', 'models', 'dino.glb');
      fs.writeFileSync(outPath, Buffer.from(gltf));
      console.log(`✔ Successfully built & exported faithful 3D model to ${outPath} (${fs.statSync(outPath).size} bytes)`);
    },
    (err) => {
      console.error('GLTF Export failed:', err);
    },
    { binary: true }
  );
}
