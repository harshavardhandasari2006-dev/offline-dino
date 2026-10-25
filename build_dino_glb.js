import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Polyfill minimal browser elements for GLTFExporter in Node
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

function createDinoModel() {
  const root = new THREE.Group();
  root.name = 'Dinosaur_Character';

  // Materials
  const materials = {
    skin: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#60b932'),
      roughness: 0.42,
      metalness: 0.04,
      name: 'Mat_DinoSkin'
    }),
    spikes: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#276749'),
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
      color: new THREE.Color('#0f172a'),
      roughness: 0.12,
      metalness: 0.08,
      name: 'Mat_Pupil'
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
    })
  };

  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'Body_Group';

  // Torso
  const bodyGeom = new THREE.SphereGeometry(1.6, 24, 20);
  bodyGeom.scale(1.0, 1.25, 1.15);
  const bodyMesh = new THREE.Mesh(bodyGeom, materials.skin);
  bodyMesh.name = 'Torso';
  bodyMesh.position.set(0, 3.2, 0);
  bodyMesh.rotation.x = 0.12;
  bodyGroup.add(bodyMesh);

  // Cream Belly
  const bellyGeom = new THREE.SphereGeometry(1.35, 24, 18);
  bellyGeom.scale(0.92, 1.22, 0.98);
  const bellyMesh = new THREE.Mesh(bellyGeom, materials.belly);
  bellyMesh.name = 'Chest_Belly';
  bellyMesh.position.set(0, 3.08, 0.42);
  bellyMesh.rotation.x = 0.15;
  bodyGroup.add(bellyMesh);

  // Neck
  const neckGeom = new THREE.CylinderGeometry(1.0, 1.25, 1.2, 20);
  const neckMesh = new THREE.Mesh(neckGeom, materials.skin);
  neckMesh.name = 'Neck';
  neckMesh.position.set(0, 4.45, 0.32);
  neckMesh.rotation.x = 0.22;
  bodyGroup.add(neckMesh);

  // Head
  const headGroup = new THREE.Group();
  headGroup.name = 'Head_Group';
  headGroup.position.set(0, 5.55, 0.55);

  const craniumGeom = new THREE.SphereGeometry(1.48, 24, 20);
  craniumGeom.scale(1.05, 1.0, 1.18);
  const craniumMesh = new THREE.Mesh(craniumGeom, materials.skin);
  craniumMesh.name = 'Cranium';
  headGroup.add(craniumMesh);

  const snoutGeom = new THREE.SphereGeometry(1.18, 24, 18);
  snoutGeom.scale(0.95, 0.78, 1.15);
  const snoutMesh = new THREE.Mesh(snoutGeom, materials.skin);
  snoutMesh.name = 'Snout';
  snoutMesh.position.set(0, -0.32, 1.05);
  headGroup.add(snoutMesh);

  const jawGeom = new THREE.SphereGeometry(0.92, 20, 16);
  jawGeom.scale(0.88, 0.52, 0.95);
  const jawMesh = new THREE.Mesh(jawGeom, materials.skin);
  jawMesh.name = 'LowerJaw';
  jawMesh.position.set(0, -0.85, 0.88);
  headGroup.add(jawMesh);

  // Nostrils
  const nostrilGeom = new THREE.SphereGeometry(0.08, 10, 8);
  nostrilGeom.scale(0.8, 1.4, 0.6);
  const nostrilL = new THREE.Mesh(nostrilGeom, materials.nostrils);
  nostrilL.position.set(-0.35, -0.05, 2.15);
  headGroup.add(nostrilL);
  const nostrilR = new THREE.Mesh(nostrilGeom, materials.nostrils);
  nostrilR.position.set(0.35, -0.05, 2.15);
  headGroup.add(nostrilR);

  // Eyes
  const eyeGeom = new THREE.SphereGeometry(0.56, 20, 16);
  eyeGeom.scale(0.85, 1.1, 0.85);

  const pupilGeom = new THREE.SphereGeometry(0.34, 16, 14);
  pupilGeom.scale(0.85, 1.12, 0.35);

  // Right eye
  const eyeRGroup = new THREE.Group();
  eyeRGroup.name = 'Eye_Right';
  eyeRGroup.position.set(0.98, 0.22, 0.72);
  eyeRGroup.rotation.y = 0.42;
  const scleraR = new THREE.Mesh(eyeGeom, materials.eyeWhite);
  eyeRGroup.add(scleraR);
  const pupilR = new THREE.Mesh(pupilGeom, materials.pupil);
  pupilR.position.set(0.08, 0.02, 0.42);
  eyeRGroup.add(pupilR);
  headGroup.add(eyeRGroup);

  // Left eye
  const eyeLGroup = new THREE.Group();
  eyeLGroup.name = 'Eye_Left';
  eyeLGroup.position.set(-0.98, 0.22, 0.72);
  eyeLGroup.rotation.y = -0.42;
  const scleraL = new THREE.Mesh(eyeGeom, materials.eyeWhite);
  eyeLGroup.add(scleraL);
  const pupilL = new THREE.Mesh(pupilGeom, materials.pupil);
  pupilL.position.set(-0.08, 0.02, 0.42);
  eyeLGroup.add(pupilL);
  headGroup.add(eyeLGroup);

  bodyGroup.add(headGroup);

  // Dorsal Spikes
  const spikeConfigs = [
    { x: 0, y: 6.95, z: 0.35, rx: -0.25, s: 0.42 },
    { x: 0, y: 6.60, z: -0.65, rx: -0.55, s: 0.46 },
    { x: 0, y: 5.50, z: -0.85, rx: -0.65, s: 0.52 },
    { x: 0, y: 4.45, z: -1.20, rx: -0.75, s: 0.56 },
    { x: 0, y: 3.45, z: -1.45, rx: -0.85, s: 0.54 },
    { x: 0, y: 2.55, z: -1.75, rx: -0.95, s: 0.48 },
    { x: 0, y: 2.10, z: -2.40, rx: -1.15, s: 0.40 },
    { x: 0, y: 2.15, z: -3.20, rx: -1.30, s: 0.32 },
    { x: 0, y: 2.35, z: -3.95, rx: -1.45, s: 0.24 }
  ];

  spikeConfigs.forEach((cfg, i) => {
    const spikeGeom = new THREE.ConeGeometry(0.42 * cfg.s, 1.25 * cfg.s, 4);
    spikeGeom.scale(0.38, 1.0, 1.25);
    const spike = new THREE.Mesh(spikeGeom, materials.spikes);
    spike.name = 'Spike_' + (i + 1);
    spike.position.set(cfg.x, cfg.y, cfg.z);
    spike.rotation.x = cfg.rx;
    bodyGroup.add(spike);
  });

  // Tail
  const tail1 = new THREE.CylinderGeometry(0.85, 1.25, 1.4, 18);
  tail1.scale(0.88, 1.0, 1.15);
  const tailMesh1 = new THREE.Mesh(tail1, materials.skin);
  tailMesh1.position.set(0, 2.25, -1.55);
  tailMesh1.rotation.x = -1.05;
  bodyGroup.add(tailMesh1);

  const tail2 = new THREE.CylinderGeometry(0.45, 0.85, 1.4, 16);
  tail2.scale(0.85, 1.0, 1.1);
  const tailMesh2 = new THREE.Mesh(tail2, materials.skin);
  tailMesh2.position.set(0, 1.95, -2.65);
  tailMesh2.rotation.x = -1.45;
  bodyGroup.add(tailMesh2);

  const tail3 = new THREE.ConeGeometry(0.45, 1.3, 14);
  tail3.scale(0.82, 1.0, 1.0);
  const tailMesh3 = new THREE.Mesh(tail3, materials.skin);
  tailMesh3.position.set(0, 2.15, -3.85);
  tailMesh3.rotation.x = -1.75;
  bodyGroup.add(tailMesh3);

  // Arms
  const armGeom = new THREE.CylinderGeometry(0.24, 0.32, 0.95, 14);
  armGeom.scale(0.85, 1.0, 1.1);
  const clawGeom = new THREE.ConeGeometry(0.09, 0.28, 8);
  clawGeom.scale(0.7, 1.0, 1.2);

  const armRGroup = new THREE.Group();
  armRGroup.name = 'Arm_Right';
  armRGroup.position.set(1.28, 3.65, 0.65);
  armRGroup.rotation.set(0.65, 0.25, -0.42);
  armRGroup.add(new THREE.Mesh(armGeom, materials.skin));
  const clawR1 = new THREE.Mesh(clawGeom, materials.claws);
  clawR1.position.set(-0.08, -0.55, 0.12);
  clawR1.rotation.x = 0.55;
  armRGroup.add(clawR1);
  const clawR2 = new THREE.Mesh(clawGeom, materials.claws);
  clawR2.position.set(0.08, -0.55, 0.12);
  clawR2.rotation.x = 0.55;
  armRGroup.add(clawR2);
  bodyGroup.add(armRGroup);

  const armLGroup = new THREE.Group();
  armLGroup.name = 'Arm_Left';
  armLGroup.position.set(-1.28, 3.65, 0.65);
  armLGroup.rotation.set(0.65, -0.25, 0.42);
  armLGroup.add(new THREE.Mesh(armGeom, materials.skin));
  const clawL1 = new THREE.Mesh(clawGeom, materials.claws);
  clawL1.position.set(-0.08, -0.55, 0.12);
  clawL1.rotation.x = 0.55;
  armLGroup.add(clawL1);
  const clawL2 = new THREE.Mesh(clawGeom, materials.claws);
  clawL2.position.set(0.08, -0.55, 0.12);
  clawL2.rotation.x = 0.55;
  armLGroup.add(clawL2);
  bodyGroup.add(armLGroup);

  // Legs & Feet
  const thighGeom = new THREE.SphereGeometry(1.05, 18, 16);
  thighGeom.scale(0.85, 1.25, 1.15);
  const calfGeom = new THREE.CylinderGeometry(0.48, 0.58, 1.25, 16);
  const footGeom = new THREE.SphereGeometry(0.72, 18, 14);
  footGeom.scale(0.92, 0.45, 1.55);
  const toeClawGeom = new THREE.ConeGeometry(0.12, 0.42, 10);
  toeClawGeom.scale(0.8, 1.0, 1.4);

  // Right Leg
  const legRGroup = new THREE.Group();
  legRGroup.name = 'Leg_Right';
  legRGroup.position.set(1.22, 0, 0);
  const thighR = new THREE.Mesh(thighGeom, materials.skin);
  thighR.position.set(0.18, 2.35, -0.05);
  thighR.rotation.x = -0.12;
  legRGroup.add(thighR);
  const calfR = new THREE.Mesh(calfGeom, materials.skin);
  calfR.position.set(0.05, 1.15, 0.12);
  calfR.rotation.x = 0.15;
  legRGroup.add(calfR);
  const footR = new THREE.Mesh(footGeom, materials.skin);
  footR.position.set(0.05, 0.32, 0.52);
  legRGroup.add(footR);
  [-0.24, 0, 0.24].forEach(xOff => {
    const claw = new THREE.Mesh(toeClawGeom, materials.claws);
    claw.position.set(0.05 + xOff, 0.16, 1.52);
    claw.rotation.x = 1.35;
    legRGroup.add(claw);
  });
  bodyGroup.add(legRGroup);

  // Left Leg
  const legLGroup = new THREE.Group();
  legLGroup.name = 'Leg_Left';
  legLGroup.position.set(-1.22, 0, 0);
  const thighL = new THREE.Mesh(thighGeom, materials.skin);
  thighL.position.set(-0.18, 2.35, -0.05);
  thighL.rotation.x = -0.12;
  legLGroup.add(thighL);
  const calfL = new THREE.Mesh(calfGeom, materials.skin);
  calfL.position.set(-0.05, 1.15, 0.12);
  calfL.rotation.x = 0.15;
  legLGroup.add(calfL);
  const footL = new THREE.Mesh(footGeom, materials.skin);
  footL.position.set(-0.05, 0.32, 0.52);
  legLGroup.add(footL);
  [-0.24, 0, 0.24].forEach(xOff => {
    const claw = new THREE.Mesh(toeClawGeom, materials.claws);
    claw.position.set(-0.05 + xOff, 0.16, 1.52);
    claw.rotation.x = 1.35;
    legLGroup.add(claw);
  });
  bodyGroup.add(legLGroup);

  bodyGroup.position.set(0, -0.2, 0.3);
  root.add(bodyGroup);

  return root;
}

const dino = createDinoModel();
const exporter = new GLTFExporter();

exporter.parse(
  dino,
  (gltf) => {
    const outPath = path.join(process.cwd(), 'assets', 'models', 'dino.glb');
    fs.writeFileSync(outPath, Buffer.from(gltf));
    console.log(`✔ Successfully built & exported 3D model to ${outPath} (${fs.statSync(outPath).size} bytes)`);
  },
  (err) => {
    console.error('GLTF Export failed:', err);
  },
  { binary: true }
);
