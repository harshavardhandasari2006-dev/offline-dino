import fs from 'fs';
import path from 'path';

const faithfulPath = path.join(process.cwd(), 'build_faithful_dino.js');
const dino3dPath = path.join(process.cwd(), 'js', 'dino3d.js');

const faithfulCode = fs.readFileSync(faithfulPath, 'utf8');
let dino3dCode = fs.readFileSync(dino3dPath, 'utf8');

// Extract body of createFaithfulDinoModel from build_faithful_dino.js
const funcStart = faithfulCode.indexOf('export function createFaithfulDinoModel');
const codeFromFunc = faithfulCode.slice(funcStart);
const openBrace = codeFromFunc.indexOf('{');
const closeReturn = codeFromFunc.indexOf('return { root, bodyGroup, headGroup, eyelidR, eyelidL, materials };');

if (openBrace === -1 || closeReturn === -1) {
  console.error('Failed to locate function bounds in build_faithful_dino.js');
  process.exit(1);
}

// Extract lines after materials definition up to the return
const geomCodeStart = codeFromFunc.indexOf('const bodyGroup = new THREE.Group();');
const geomCode = codeFromFunc.slice(geomCodeStart, closeReturn).trim();

// Now build the new buildDinoModel method
const newBuildMethod = `    buildDinoModel(skinId) {
      if (this.dinoGroup) {
        this.scene.remove(this.dinoGroup);
      }

      this.initMaterials(skinId);
      const materials = this.materials;
      const root = new THREE.Group();
      root.name = 'Faithful_Dino_Root';

      ${geomCode}

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
`;

// Replace in js/dino3d.js
const startMarker = '    buildDinoModel(skinId) {';
const endMarker = '    rotateBy(deltaRadians) {';

const startIndex = dino3dCode.indexOf(startMarker);
const endIndex = dino3dCode.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Markers not found in dino3d.js!');
  process.exit(1);
}

const updatedDino3d = dino3dCode.slice(0, startIndex) + newBuildMethod + '\n' + dino3dCode.slice(endIndex);
fs.writeFileSync(dino3dPath, updatedDino3d, 'utf8');
console.log('✔ Successfully synchronized js/dino3d.js with faithful 3D model!');
