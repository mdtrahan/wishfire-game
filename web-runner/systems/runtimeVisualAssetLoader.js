import {
  CANONICAL_HERO_ROSTER,
  FIGMA_HERO_BACK_URL,
  FIGMA_HERO_CLOSE_OVAL_URL,
  FIGMA_HERO_NEXT_URL,
  FIGMA_MINUS_URL,
  FIGMA_PLUS_URL,
  HERO_PACK_CLOSE_OVAL_PATH,
  HERO_PACK_MINUS_PATH,
  HERO_PACK_PLUS_PATH,
} from '../state/heroScreenConfig.js';

export async function loadRuntimeImage(url, { resolveRuntimeImageUrl = (value) => value } = {}) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = resolveRuntimeImageUrl(url);
  });
}

export async function loadRuntimeVisualAssets({
  types,
  assetUrl,
  makeImagePath,
  gemVisuals,
  updateStartupLoadState,
  runtimeDebugLogging,
  resolveRuntimeImageUrl,
}) {
  const loadImage = (url) => loadRuntimeImage(url, { resolveRuntimeImageUrl });
  const images = {};
  const enemySpriteImages = {};
  const heroPortraitImages = {};
  let wardBarrierImage = null;
  let heroSkillIconsBySlot = [];
  let heroSelectorImage = null;
  let gemFrameImages = [];
  let superGemFrameImages = [];
  let superGemRainbowImage = null;
  const buffIconFrameImages = {};
  const debuffIconImages = {};
  let mapBackgroundImage = null;
  const heroCapsuleImages = {};
  let plusIconImage = null;
  let minusIconImage = null;
  let heroBackArrowImage = null;
  let heroNextArrowImage = null;
  let closeWinOvalImage = null;
  let loadedCount = 0;
  const failedImages = [];

  const getSpriteImagePath = (t, data) => {
    const pluginId = data && data['plugin-id'];
    if (pluginId && pluginId !== 'Sprite') return null;
    let animName = null;
    try {
      animName = data.animations && data.animations.items && data.animations.items[0] && data.animations.items[0].name;
    } catch {}
    const imgPath = makeImagePath(t, animName);
    if (!imgPath) return null;
    return { imgPath, animName };
  };

  const loadSpriteTypeImage = async (t, data) => {
    const meta = getSpriteImagePath(t, data);
    if (!meta) return { type: t, skipped: true };
    try {
      const img = await loadImage(meta.imgPath);
      if (img) {
        images[t] = img;
        loadedCount += 1;
        if (['UI_NavCloseButton', 'UI_NavCloseX', 'UI_CloseWin'].includes(t)) {
          runtimeDebugLogging.startupDebugLog(`[LOAD] SUCCESS: ${t} loaded from ${meta.imgPath}`);
        }
        return { type: t, ok: true };
      }
      failedImages.push({ type: t, path: meta.imgPath, anim: meta.animName });
      if (['UI_NavCloseButton', 'UI_NavCloseX', 'UI_CloseWin'].includes(t)) {
        console.log(`[LOAD] FAILED: ${t} from ${meta.imgPath}`);
      }
      return { type: t, ok: false };
    } catch (e) {
      console.warn(`[LOAD] Failed to load image for type ${t}:`, e.message);
      failedImages.push({ type: t, path: meta.imgPath, anim: meta.animName });
      return { type: t, ok: false, reason: e.message };
    }
  };

  const loadBaseSprites = async (typeNames, progressStart = null, progressEnd = null) => {
    const names = Array.isArray(typeNames) ? typeNames : [];
    if (names.length === 0) return;
    let completed = 0;
    await Promise.all(names.map(async (t) => {
      await loadSpriteTypeImage(t, types[t]);
      completed += 1;
      if (progressStart != null && progressEnd != null) {
        const tNorm = completed / names.length;
        const pct = progressStart + ((progressEnd - progressStart) * tNorm);
        updateStartupLoadState({ progress: pct });
      }
    }));
  };

  const loadCoreVisuals = async () => {
    const tasks = [];
    const heroPortraitLoads = ['Falie', 'Huun', 'Runa', 'Kojonn'].map(async (heroName) => {
      heroPortraitImages[heroName] = await loadImage(assetUrl(`images/cap_${heroName}.png`));
    });
    const wardBarrierLoad = (async () => {
      wardBarrierImage = await loadImage(assetUrl('images/falie_ward_84x62.png'));
    })();
    const chainStrikeArcLoad = (async () => {
      const path = assetUrl('images/skill_chain_strike_arc_160x48.png');
      const img = await loadImage(path);
      if (img) {
        images.SkillChainStrikeArc = img;
        loadedCount += 1;
      } else {
        failedImages.push({ type: 'SkillChainStrikeArc', path, anim: 'chain-strike' });
      }
    })();
    const heroSkillIconLoads = [
      'images/bufficon1-animation 1-000.png',
      'images/bufficon2-animation 1-000.png',
      'images/bufficon3-animation 1-000.png',
    ].map(async (imgPath, idx) => {
      heroSkillIconsBySlot[idx] = await loadImage(assetUrl(imgPath));
    });
    const gemVisualLoads = (async () => {
      const loadedGemVisuals = await gemVisuals.loadGemVisuals({ assetUrl, loadImage });
      gemFrameImages = loadedGemVisuals.gemFrameImages;
      superGemFrameImages = loadedGemVisuals.superGemFrameImages;
      superGemRainbowImage = loadedGemVisuals.superGemRainbowImage;
    })();
    const heroCapsuleLoads = CANONICAL_HERO_ROSTER.map(async (hero) => {
      const key = String(hero.name || '');
      if (!key) return;
      heroCapsuleImages[key] = await loadImage(assetUrl(`images/cap_${key}.png`));
    });
    const plusPromise = loadImage(assetUrl(HERO_PACK_PLUS_PATH)).then(img => img || loadImage(FIGMA_PLUS_URL));
    const minusPromise = loadImage(assetUrl(HERO_PACK_MINUS_PATH)).then(img => img || loadImage(FIGMA_MINUS_URL));
    const closePromise = loadImage(assetUrl(HERO_PACK_CLOSE_OVAL_PATH)).then(img => img || loadImage(FIGMA_HERO_CLOSE_OVAL_URL));

    tasks.push(
      ...heroPortraitLoads,
      wardBarrierLoad,
      chainStrikeArcLoad,
      ...heroSkillIconLoads,
      ...heroCapsuleLoads,
      gemVisualLoads,
      (async () => { heroSelectorImage = await loadImage(assetUrl('images/h_selector-animation 1-000.png')); })(),
      (async () => { mapBackgroundImage = await loadImage(assetUrl('images/map-layout.png')); })(),
      (async () => { plusIconImage = await plusPromise; })(),
      (async () => { minusIconImage = await minusPromise; })(),
      (async () => { heroBackArrowImage = await loadImage(FIGMA_HERO_BACK_URL); })(),
      (async () => { heroNextArrowImage = await loadImage(FIGMA_HERO_NEXT_URL); })(),
      (async () => { closeWinOvalImage = await closePromise; })(),
    );

    let completed = 0;
    const total = Math.max(1, tasks.length);
    await Promise.all(tasks.map(async (task) => {
      await task;
      completed += 1;
      const tNorm = completed / total;
      updateStartupLoadState({ progress: 0.55 + (0.35 * tNorm) });
    }));
  };

  const loadDeferredVisuals = async () => {
    const enemyType = types['Enemy_Sprite'];
    if (enemyType && enemyType.animations && Array.isArray(enemyType.animations.items)) {
      for (const anim of enemyType.animations.items) {
        const animName = anim.name;
        const imgPath = makeImagePath('Enemy_Sprite', animName);
        if (!imgPath) continue;
        const img = await loadImage(imgPath);
        if (img) enemySpriteImages[String(animName).toLowerCase()] = img;
      }
      runtimeDebugLogging.startupDebugLog('[LOAD] Enemy_Sprite animations loaded:', Object.keys(enemySpriteImages).length);
    }
    for (let i = 1; i <= 4; i++) {
      const key = `buffIcon${i}`;
      buffIconFrameImages[key] = [];
      for (let f = 0; f < 5; f++) {
        const imgPath = assetUrl(`images/bufficon${i}-animation 1-${String(f).padStart(3, '0')}.png`);
        const img = await loadImage(imgPath);
        if (img) buffIconFrameImages[key][f] = img;
      }
    }
    debuffIconImages.ATK = await loadImage(assetUrl('images/ATK_down.png'));
    debuffIconImages.DEF = await loadImage(assetUrl('images/DEF_down.png'));
    debuffIconImages.MAG = await loadImage(assetUrl('images/MAG_down.png'));
    debuffIconImages.RES = await loadImage(assetUrl('images/RES_down.png'));
    debuffIconImages.SPD = await loadImage(assetUrl('images/SPD_down.png'));
  };

  const allTypeNames = Object.keys(types);
  await loadBaseSprites(allTypeNames, 0.3, 0.74);
  updateStartupLoadState({ phase: 'bootstrap', label: 'Loading hero and board visuals...', progress: 0.74 });
  await loadCoreVisuals();
  updateStartupLoadState({ phase: 'bootstrap', label: 'Loading extended visuals...', progress: 0.9 });
  await loadDeferredVisuals();
  updateStartupLoadState({ phase: 'bootstrap', label: 'Finalizing runtime...', progress: 0.96 });

  return {
    images,
    enemySpriteImages,
    heroPortraitImages,
    wardBarrierImage,
    heroSkillIconsBySlot,
    heroSelectorImage,
    gemFrameImages,
    superGemFrameImages,
    superGemRainbowImage,
    buffIconFrameImages,
    debuffIconImages,
    mapBackgroundImage,
    heroCapsuleImages,
    plusIconImage,
    minusIconImage,
    heroBackArrowImage,
    heroNextArrowImage,
    closeWinOvalImage,
    loadedCount,
    failedImages,
  };
}
