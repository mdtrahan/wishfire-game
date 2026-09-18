const freezeCrop = crop => Object.freeze({ ...crop });

const freezeHeroArt = ({ key, displayName, combat, card, strip }) => Object.freeze({
  key,
  displayName,
  path: `images/${key}.png`,
  combat: freezeCrop(combat),
  card: freezeCrop(card),
  strip: freezeCrop(strip),
});

/**
 * Presentation-only hero artwork. The canonical keys match the shipped
 * source files; aliases are accepted at the boundary for display objects.
 */
export const HERO_ART_ASSETS = Object.freeze({
  Fara: freezeHeroArt({
    key: 'Fara',
    displayName: 'Fara',
    combat: { x: 0, y: 0, width: 1, height: 1 },
    card: { position: '54% 8%', scale: 1.16 },
    strip: { position: '54% 7%', scale: 2.35, width: '38%' },
  }),
  Hondo: freezeHeroArt({
    key: 'Hondo',
    displayName: 'Hondo',
    combat: { x: 0, y: 0, width: 1, height: 1 },
    card: { position: '57% 8%', scale: 1.16 },
    strip: { position: '57% 7%', scale: 2.35, width: '38%' },
  }),
  Runa: freezeHeroArt({
    key: 'Runa',
    displayName: 'Runa',
    combat: { x: 0, y: 0, width: 1, height: 1 },
    card: { position: '50% 7%', scale: 1.17 },
    strip: { position: '50% 6%', scale: 2.4, width: '38%' },
  }),
  Kaja: freezeHeroArt({
    key: 'Kaja',
    displayName: 'Kaja',
    combat: { x: 0, y: 0, width: 1, height: 1 },
    card: { position: '53% 8%', scale: 1.17 },
    strip: { position: '53% 6%', scale: 2.4, width: '34%' },
  }),
});

const HERO_ART_ALIASES = Object.freeze({
  Falie: 'Fara',
  Huun: 'Hondo',
  Kojonn: 'Kaja',
});

export function heroArtKey(heroOrName) {
  const raw = typeof heroOrName === 'string'
    ? heroOrName
    : heroOrName?.portraitName || heroOrName?.baseHeroName || heroOrName?.name || heroOrName?.displayName || '';
  return HERO_ART_ALIASES[raw] || raw;
}

export function heroArtAsset(heroOrName) {
  return HERO_ART_ASSETS[heroArtKey(heroOrName)] || null;
}

export function heroArtPath(heroOrName) {
  return heroArtAsset(heroOrName)?.path || '';
}

export function heroArtCrop(heroOrName, surface = 'combat') {
  return heroArtAsset(heroOrName)?.[surface] || null;
}

export function resolveHeroArtSourceRect(image, crop) {
  if (!image || !crop) return null;
  const imageWidth = Number(image.naturalWidth || image.width);
  const imageHeight = Number(image.naturalHeight || image.height);
  const x = Number(crop.x);
  const y = Number(crop.y);
  const width = Number(crop.width);
  const height = Number(crop.height);
  if (![imageWidth, imageHeight, x, y, width, height].every(Number.isFinite)) return null;
  if (imageWidth <= 0 || imageHeight <= 0 || width <= 0 || height <= 0) return null;
  return {
    sourceX: imageWidth * Math.max(0, Math.min(1, x)),
    sourceY: imageHeight * Math.max(0, Math.min(1, y)),
    sourceWidth: imageWidth * Math.max(0, Math.min(1 - x, width)),
    sourceHeight: imageHeight * Math.max(0, Math.min(1 - y, height)),
  };
}
