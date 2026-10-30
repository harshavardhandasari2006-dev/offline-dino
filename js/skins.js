/**
 * OFFLINE DINO - Dinosaur Skins & Palette Engine
 * Provides the 9 canonical skin palettes with protected anatomy
 * (cream belly, white sclera, black pupils, white catchlight, ivory claws, coral tongue).
 */

(function(window) {
  'use strict';

  // RGB <-> HSL helper utilities
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return [h * 360, s, l];
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    h /= 360;
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      function hue2rgb(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      }
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  const ORANGE_GAMEPLAY_SKIN = {
    id: 'orange',
    name: 'SUNSET ORANGE',
    subtitle: 'Amber Runner',
    swatchColor: '#ed8936',
    accentColor: '#7b341e',
    borderGrad: 'linear-gradient(135deg, #fbd38d, #dd6b20)',
    targetH: 26,
    sMul: 1.12,
    lMul: 1.0,
    previewAsset: 'assets/sprites/skin_orange.png',
    gameplaySkinId: 'orange'
  };

  const DINO_SKINS = [
    {
      id: 'green',
      name: 'CLASSIC GREEN',
      subtitle: 'Original Explorer (Default)',
      swatchColor: '#48bb78',
      accentColor: '#276749',
      borderGrad: 'linear-gradient(135deg, #68d391, #2f855a)',
      targetH: 92,
      sMul: 1.0,
      lMul: 1.0,
      previewAsset: 'assets/sprites/skin_green.png',
      gameplaySkinId: 'green'
    },
    {
      id: 'blue',
      name: 'SAPPHIRE BLUE',
      subtitle: 'Coastal Wanderer',
      swatchColor: '#3182ce',
      accentColor: '#1a365d',
      borderGrad: 'linear-gradient(135deg, #63b3ed, #2b6cb0)',
      targetH: 204,
      sMul: 1.05,
      lMul: 0.98,
      previewAsset: 'assets/sprites/skin_blue.png',
      gameplaySkinId: 'blue'
    },
    {
      id: 'red',
      name: 'CRIMSON RED',
      subtitle: 'Volcanic Sprinter',
      swatchColor: '#e53e3e',
      accentColor: '#742a2a',
      borderGrad: 'linear-gradient(135deg, #fc8181, #c53030)',
      targetH: 4,
      sMul: 1.10,
      lMul: 0.95,
      previewAsset: 'assets/sprites/skin_red.png',
      gameplaySkinId: 'red'
    },
    {
      id: 'brown',
      name: 'CHOCOLATE BROWN',
      subtitle: 'Earth Rover',
      swatchColor: '#8c593b',
      accentColor: '#3d2516',
      borderGrad: 'linear-gradient(135deg, #b7791f, #744210)',
      targetH: 26,
      sMul: 1.12,
      lMul: 1.0,
      previewAsset: 'assets/sprites/skin_brown.png',
      gameplaySkinId: 'orange' // CRITICAL: Uses existing Orange dinosaur during gameplay!
    },
    {
      id: 'black',
      name: 'CHARCOAL BLACK',
      subtitle: 'Shadow Stalker',
      swatchColor: '#4a5568',
      accentColor: '#1a202c',
      borderGrad: 'linear-gradient(135deg, #718096, #2d3748)',
      targetH: 215,
      sMul: 0.12,
      lMul: 0.55,
      previewAsset: 'assets/sprites/skin_black.png',
      gameplaySkinId: 'black'
    }
  ];

  const REMOVED_SKIN_IDS = ['yellow', 'purple', 'pink', 'orange'];
  const STORAGE_KEY = 'offline_dino_selected_skin';
  const DEFAULT_SKIN_ID = 'green';
  let activeSkinId = DEFAULT_SKIN_ID;

  // Restore previously saved skin from localStorage safely
  try {
    let saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'orange') {
      saved = 'brown';
      try { localStorage.setItem(STORAGE_KEY, 'brown'); } catch(e) {}
    }
    if (saved && !REMOVED_SKIN_IDS.includes(saved) && DINO_SKINS.some(s => s.id === saved)) {
      activeSkinId = saved;
    } else if (saved) {
      localStorage.setItem(STORAGE_KEY, DEFAULT_SKIN_ID);
      activeSkinId = DEFAULT_SKIN_ID;
    }
  } catch (e) {
    // Storage restricted or disabled
  }

  const SkinManager = {
    skins: DINO_SKINS,
    DEFAULT_SKIN_ID,
    REMOVED_SKIN_IDS,
    ORANGE_GAMEPLAY_SKIN,

    getSelectedSkinId() {
      if (!activeSkinId || REMOVED_SKIN_IDS.includes(activeSkinId) || !DINO_SKINS.some(s => s.id === activeSkinId)) {
        activeSkinId = DEFAULT_SKIN_ID;
      }
      return activeSkinId;
    },

    setSelectedSkinId(skinId) {
      if (skinId === 'orange') skinId = 'brown';
      if (!skinId || REMOVED_SKIN_IDS.includes(skinId) || !DINO_SKINS.some(s => s.id === skinId)) {
        skinId = DEFAULT_SKIN_ID;
      }
      activeSkinId = skinId;
      try {
        localStorage.setItem(STORAGE_KEY, activeSkinId);
      } catch (e) {}
      return activeSkinId;
    },

    getGameplaySkinId(skinId) {
      const targetId = skinId || activeSkinId;
      if (targetId === 'brown') return 'orange';
      const skin = this.getSkinById(targetId);
      return (skin && skin.gameplaySkinId) ? skin.gameplaySkinId : (targetId || 'green');
    },

    resetToDefault() {
      activeSkinId = DEFAULT_SKIN_ID;
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      return activeSkinId;
    },

    getSkinById(skinId) {
      if (skinId === 'orange') {
        return ORANGE_GAMEPLAY_SKIN;
      }
      if (!skinId || REMOVED_SKIN_IDS.includes(skinId)) {
        return DINO_SKINS[0];
      }
      return DINO_SKINS.find(s => s.id === skinId) || DINO_SKINS[0];
    },

    /**
     * Recolor an HTMLImageElement or Canvas to a target skin palette.
     * Accurately protects cream belly, eye sclera, pupil, catchlight, claws, and mouth.
     */
    recolorImage(sourceImg, skin) {
      if (!sourceImg || !sourceImg.naturalWidth && !sourceImg.width) return sourceImg;
      const w = sourceImg.naturalWidth || sourceImg.width;
      const h = sourceImg.naturalHeight || sourceImg.height;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(sourceImg, 0, 0);

      if (skin.id === 'green') {
        return canvas; // Green is original canonical palette
      }

      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 15) continue;

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const [hue, sat, lit] = rgbToHsl(r, g, b);

        // ============================================================
        // STRICT ANATOMICAL FEATURE PROTECTION
        // ============================================================

        // 1. Pure White / Eye Catchlight / Specular Highlights
        const isCatchlight = (lit > 0.88 && sat < 0.28) || (lit > 0.94);

        // 2. Eye Sclera (White eye region, including shaded and anti-aliased edges)
        const isEyeWhite = (sat < 0.18 && lit > 0.40) ||
                           (sat < 0.28 && lit > 0.65 && (hue < 75 || hue > 175));

        // 3. Black Pupil & Deep Shadows & Dark Nostrils (must be neutral, not green)
        const isPupilOrNostril = (r < 28 && g < 28 && b < 28) ||
                                 (lit < 0.11 && Math.abs(r - g) <= 6 && Math.abs(g - b) <= 6);

        // 4. Cream Belly, Chest, Chin & Tail Underside (pastel cream requires b >= 38)
        const isBelly = (b >= 38) && (
          (r > 165 && g > 140 && b < 195 && (r >= g - 2) && (r - b > 25) && (g - b > 15)) ||
          (hue >= 25 && hue <= 68 && sat >= 0.12 && lit >= 0.20 && (r >= g - 25) && (r > b + 15) && (g > b + 10))
        );

        // 5. Claws & Toenails (Ivory / warm off-white claws on paws and feet)
        const isClaw = (lit >= 0.55 && sat <= 0.45 && r >= g - 5 && r > b);

        // 6. Mouth / Tongue (Coral pink / red) & Teeth
        const isMouth = (r > 150 && g < 125 && b < 135 && (r - g > 30));
        const isTeeth = (sat < 0.18 && lit > 0.70);

        // If any protected feature matches, PRESERVE IT 100% (Do not recolor!)
        if (isCatchlight || isEyeWhite || isPupilOrNostril || isBelly || isClaw || isMouth || isTeeth) {
          continue;
        }

        // ============================================================
        // RECOLOR EVERY SKIN PIXEL (including dark contours & highlights)
        // ============================================================
        const isDinoSkin = (hue >= 35 && hue <= 190 && sat >= 0.08 && lit >= 0.07);
        const isDarkSpikes = (hue >= 65 && hue <= 185 && lit <= 0.40 && sat >= 0.08 && g >= r);

        if (isDinoSkin || isDarkSpikes) {
          let newH = skin.targetH;
          let newS = Math.min(1.0, Math.max(0.0, sat * skin.sMul));
          let newL = Math.min(1.0, Math.max(0.0, lit * skin.lMul));

          if (skin.id === 'black') {
            newH = 220; // Soft charcoal grey-black tone
            newS = Math.min(0.08, sat * 0.12);
            // Continuous smooth lightness curve with NO jumps - brightened to soft charcoal
            newL = 0.15 + Math.pow(lit, 1.08) * 0.48;
            if (isDarkSpikes) {
              newL = Math.max(0.09, newL * 0.75);
            }
          } else if (skin.id === 'yellow') {
            newH = 48;
            newL = Math.min(0.92, lit * 1.12);
            newS = Math.min(0.98, sat * 1.15);
          }

          const [newR, newG, newB] = hslToRgb(newH, newS, newL);
          data[i] = newR;
          data[i + 1] = newG;
          data[i + 2] = newB;
        }
      }

      ctx.putImageData(imgData, 0, 0);
      return canvas;
    }
  };

  window.DINO_SKINS = DINO_SKINS;
  window.SkinManager = SkinManager;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DINO_SKINS, SkinManager, rgbToHsl, hslToRgb };
  }
})(typeof window !== 'undefined' ? window : global);
