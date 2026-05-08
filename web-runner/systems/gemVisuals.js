const GEM_ASSET_BY_COLOR = {
  0: 'gems/green_gem.png',
  1: 'gems/red_gem.png',
  2: 'gems/blue_gem.png',
  3: 'gems/coin.png',
  4: 'gems/heal_gem.png',
  5: 'gems/purple_gem.png',
};

const LEGACY_GEM_BY_COLOR = {
  0: 'images/gem-animation 1-000.png',
  1: 'images/gem-animation 1-001.png',
  2: 'images/gem-animation 1-002.png',
  3: 'images/gem-animation 1-003.png',
  4: 'images/gem-animation 1-004.png',
  5: 'images/gem-animation 1-005.png',
};

const SUPER_GEM_ASSET_BY_COLOR = {
  0: 'gems/super_green.png',
  1: 'gems/super-red.png',
  2: 'gems/super_blue.png',
  3: 'gems/super_coin.png',
  4: 'gems/super_heal.png',
  5: 'gems/super_purple.png',
};

export async function loadGemVisuals({ assetUrl, loadImage }) {
  const gemFrameImages = [];
  const superGemFrameImages = [];
  let superGemRainbowImage = null;

  await Promise.all([
    ...Array.from({ length: 6 }, (_, i) => i).map(async (i) => {
      const primary = await loadImage(assetUrl(GEM_ASSET_BY_COLOR[i]));
      if (primary) {
        gemFrameImages[i] = primary;
        return;
      }
      const fallback = await loadImage(assetUrl(LEGACY_GEM_BY_COLOR[i]));
      if (fallback) gemFrameImages[i] = fallback;
    }),
    ...Array.from({ length: 6 }, (_, i) => i).map(async (i) => {
      const img = await loadImage(assetUrl(SUPER_GEM_ASSET_BY_COLOR[i]));
      if (img) superGemFrameImages[i] = img;
    }),
    (async () => {
      superGemRainbowImage = await loadImage(assetUrl('gems/super_rainbow.png'));
    })(),
  ]);

  return {
    gemFrameImages,
    superGemFrameImages,
    superGemRainbowImage,
  };
}
