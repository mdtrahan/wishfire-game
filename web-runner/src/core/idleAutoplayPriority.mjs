const COLOR_RED = 1;
const COLOR_BLUE = 2;
const COLOR_GOLD = 3;
const COLOR_HEAL = 4;
const COLOR_PURPLE = 5;

const NON_HEAL_COLORS = Object.freeze([
  COLOR_RED,
  COLOR_BLUE,
  COLOR_GOLD,
  COLOR_PURPLE,
]);

const HERO_COLOR_PREFERENCE = Object.freeze({
  falie: COLOR_RED,
  huun: COLOR_GOLD,
  runa: COLOR_BLUE,
});

function normalizeHeroName(heroName) {
  return String(heroName || '').trim().toLowerCase();
}

function getHeroPreferredColor(heroName) {
  const color = HERO_COLOR_PREFERENCE[normalizeHeroName(heroName)];
  return Number.isFinite(color) ? color : null;
}

function normalizeColor(value) {
  const color = Number(value);
  return Number.isFinite(color) && color >= COLOR_RED && color <= COLOR_PURPLE ? color : null;
}

function isLockedGem(gem) {
  if (!gem) return false;
  const countdown = Number(gem.lockCountdown ?? gem.LockCountdown ?? 0);
  return countdown > 0 || gem.locked === true || Number(gem.Locked || 0) === 1;
}

function cellKey(row, col) {
  return `${Number(row || 0)},${Number(col || 0)}`;
}

function normalizeLockedCells(input) {
  if (input instanceof Set) return input;
  const set = new Set();
  for (const item of (Array.isArray(input) ? input : [])) {
    if (typeof item === 'string') {
      set.add(item);
      continue;
    }
    if (item && typeof item === 'object') {
      set.add(cellKey(item.r ?? item.row, item.c ?? item.col));
    }
  }
  return set;
}

function clampRatio(value) {
  const ratio = Number(value);
  if (!Number.isFinite(ratio)) return null;
  return Math.max(0, Math.min(1, ratio));
}

function sumNumeric(values) {
  if (!Array.isArray(values)) return null;
  let total = 0;
  let seen = false;
  for (const value of values) {
    const n = Number(value);
    if (!Number.isFinite(n)) continue;
    total += Math.max(0, n);
    seen = true;
  }
  return seen ? total : null;
}

function pushTier(tiers, colors) {
  const unique = [];
  for (const value of colors) {
    const color = normalizeColor(value);
    if (color == null || unique.includes(color)) continue;
    unique.push(color);
  }
  if (unique.length) tiers.push(Object.freeze(unique));
}

function isExcludedIdleAutoplayColor(color, { heroName = '', hasLivingEnemies = false, forcedBoardColor = null } = {}) {
  if (normalizeColor(forcedBoardColor) === color) return false;
  return color === COLOR_GOLD && !!hasLivingEnemies && normalizeHeroName(heroName) !== 'huun';
}

export function resolveIdleAutoplayPartyHpRatio({
  partyHP,
  partyMaxHP,
  partyHPByIndex,
  partyMaxHPByIndex,
} = {}) {
  const hp = Number(partyHP);
  const maxHP = Number(partyMaxHP);
  if (Number.isFinite(hp) && Number.isFinite(maxHP) && maxHP > 0) {
    return clampRatio(hp / maxHP);
  }

  const indexedHP = sumNumeric(partyHPByIndex);
  const indexedMaxHP = sumNumeric(partyMaxHPByIndex);
  if (indexedHP != null && indexedMaxHP != null && indexedMaxHP > 0) {
    return clampRatio(indexedHP / indexedMaxHP);
  }

  return null;
}

export function getIdleAutoplayColorPriorityTiers(context = {}) {
  const { heroName = '', partyHpRatio = null } = context;
  const ratio = clampRatio(partyHpRatio);
  const heroColor = getHeroPreferredColor(heroName);
  const otherNonHealColors = NON_HEAL_COLORS.filter((color) => color !== heroColor && color !== COLOR_PURPLE);
  const tiers = [];
  const addTier = (colors) => pushTier(
    tiers,
    colors.filter((color) => !isExcludedIdleAutoplayColor(color, context)),
  );

  if (ratio != null && ratio < 0.6) {
    addTier([COLOR_HEAL]);
  }

  if (heroColor != null) {
    addTier([heroColor]);
  }

  addTier([COLOR_PURPLE]);
  addTier(otherNonHealColors);
  addTier([COLOR_HEAL]);

  return Object.freeze(tiers);
}

export function pickIdleAutoplayTriplet(gems = [], context = {}, randomFn = Math.random) {
  const byColor = new Map();
  for (const gem of (Array.isArray(gems) ? gems : [])) {
    if (!gem) continue;
    if (isLockedGem(gem)) continue;
    const color = normalizeColor(gem.color != null ? gem.color : gem.elementIndex);
    if (color == null) continue;
    if (!byColor.has(color)) byColor.set(color, []);
    byColor.get(color).push({ row: Number(gem.cellR || 0), col: Number(gem.cellC || 0) });
  }

  for (const tier of getIdleAutoplayColorPriorityTiers(context)) {
    const tierChoices = tier
      .filter((color) => Array.isArray(byColor.get(color)) && byColor.get(color).length >= 3)
      .map((color) => byColor.get(color).slice(0, 3));
    if (!tierChoices.length) continue;
    const random = Number(typeof randomFn === 'function' ? randomFn() : 0);
    const idx = Math.max(0, Math.min(tierChoices.length - 1, Math.floor((Number.isFinite(random) ? random : 0) * tierChoices.length)));
    return tierChoices[idx];
  }

  return null;
}

export function pickIdleAutoplaySuperGem(superGems = [], context = {}) {
  const candidates = Array.isArray(superGems) ? superGems : [];
  if (!candidates.length) return null;
  const lockedCells = normalizeLockedCells(context.lockedCells);

  for (const tier of getIdleAutoplayColorPriorityTiers(context)) {
    for (const superGem of candidates) {
      const color = normalizeColor(superGem && superGem.baseColor);
      const cells = Array.isArray(superGem && superGem.cells) ? superGem.cells : [];
      if (color == null || !tier.includes(color) || !cells.length) continue;
      if (cells.some((cell) => lockedCells.has(cellKey(cell.r ?? cell.row, cell.c ?? cell.col)))) continue;
      const cell = cells[0];
      return { row: Number(cell.r ?? cell.row ?? 0), col: Number(cell.c ?? cell.col ?? 0) };
    }
  }

  return null;
}
