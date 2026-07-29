export const COMBAT_ORIENTATION_LEFT_WISE = 'left-wise';
export const COMBAT_ORIENTATION_RIGHT_WISE = 'right-wise';
export const RIGHT_WISE_FORMATION_TRANSLATE_X = -40;

export function normalizeCombatOrientation(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === COMBAT_ORIENTATION_RIGHT_WISE
    ? COMBAT_ORIENTATION_RIGHT_WISE
    : COMBAT_ORIENTATION_LEFT_WISE;
}

export function readCombatOrientationFromSearch(search = '') {
  const params = new URLSearchParams(String(search ?? ''));
  return normalizeCombatOrientation(params.get('combat_orientation'));
}

export function orientCombatWorldX(x, layoutW, orientation) {
  const worldX = Number(x);
  const worldWidth = Number(layoutW);
  if (!Number.isFinite(worldX) || !Number.isFinite(worldWidth)) return worldX;
  return normalizeCombatOrientation(orientation) === COMBAT_ORIENTATION_RIGHT_WISE
    ? worldWidth - worldX
    : worldX;
}

export function orientCombatWorldOffsetX(offsetX, orientation) {
  const offset = Number(offsetX);
  if (!Number.isFinite(offset)) return offset;
  return normalizeCombatOrientation(orientation) === COMBAT_ORIENTATION_RIGHT_WISE
    ? -offset
    : offset;
}

function finiteMidpoint(values = []) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) return null;
  return (Math.min(...finite) + Math.max(...finite)) / 2;
}

export function deriveCombatFormationAnchors({ globals = {}, entities = [], heroCount = 0 } = {}) {
  const rect = globals?.EnemyAreaRect;
  const count = Math.max(0, Math.floor(Number(heroCount) || 0));
  const enemySize = Number(globals?.EnemySize || 40);
  const enemyGap = Number(globals?.enemyGAP || 8);
  const enemySpacing = Number(globals?.Spacing || (enemySize + enemyGap));
  const heroYs = [];
  if (rect && count > 0) {
    const minY = Number(rect.minY);
    const maxY = Number(rect.maxY);
    if (Number.isFinite(minY) && Number.isFinite(maxY)) {
      const gap = 8;
      const availableH = maxY - minY;
      const heroH = Math.min(enemySize, (availableH - gap * Math.max(0, count - 1)) / count);
      const heroSpacing = heroH + gap;
      for (let index = 0; index < count; index += 1) {
        heroYs.push(minY + (heroH / 2) + index * heroSpacing);
      }
    }
  }
  const enemyYs = entities
    .filter((entity) => entity?.kind === 'enemy')
    .map((enemy) => {
      const slot = Number(enemy?.slotIndex || 0);
      const fallbackY = Number(globals?.EnemyAreaY0 || 140) + slot * enemySpacing;
      const originY = enemy?.originY == null ? null : Number(enemy.originY);
      const y = enemy?.y == null ? null : Number(enemy.y);
      return Number.isFinite(originY) ? originY : (Number.isFinite(y) ? y : fallbackY);
    })
    .filter(Number.isFinite);
  return { heroYs, enemyYs };
}

export function createCombatFormationProjection({
  orientation,
  layoutW,
  heroYs = [],
  enemyYs = [],
} = {}) {
  const normalizedOrientation = normalizeCombatOrientation(orientation);
  const rightWise = normalizedOrientation === COMBAT_ORIENTATION_RIGHT_WISE;
  const heroMidY = finiteMidpoint(heroYs);
  const enemyMidY = finiteMidpoint(enemyYs);
  const enemyTranslateY = rightWise && Number.isFinite(heroMidY) && Number.isFinite(enemyMidY)
    ? heroMidY - enemyMidY
    : 0;
  const translateX = rightWise ? RIGHT_WISE_FORMATION_TRANSLATE_X : 0;
  return {
    orientation: normalizedOrientation,
    translateX,
    enemyTranslateY,
    heroMidY,
    enemyMidY,
    project(x, y, actorKind = '') {
      const worldY = Number(y);
      const kind = String(actorKind || '').trim().toLowerCase();
      return {
        x: orientCombatWorldX(x, layoutW, normalizedOrientation) + translateX,
        y: (Number.isFinite(worldY) ? worldY : 0)
          + (rightWise && kind === 'enemy' ? enemyTranslateY : 0),
      };
    },
  };
}

export function createCombatOrientationGeometry({ orientation, layoutW, actors = [] } = {}) {
  const normalizedOrientation = normalizeCombatOrientation(orientation);
  const worldWidth = Number(layoutW);
  const heroYs = actors
    .filter((actor) => actor?.kind === 'hero' || actor?.kind === 'escort')
    .map((actor) => actor?.y);
  const enemyYs = actors.filter((actor) => actor?.kind === 'enemy').map((actor) => actor?.y);
  const projection = createCombatFormationProjection({
    orientation: normalizedOrientation,
    layoutW: worldWidth,
    heroYs,
    enemyYs,
  });
  return {
    orientation: normalizedOrientation,
    axis: Number.isFinite(worldWidth) ? worldWidth / 2 : null,
    layoutW: Number.isFinite(worldWidth) ? worldWidth : null,
    translateX: projection.translateX,
    enemyTranslateY: projection.enemyTranslateY,
    heroMidY: projection.heroMidY,
    enemyMidY: projection.enemyMidY,
    actors: actors.map((actor) => {
      const canonicalX = Number(actor?.canonicalX ?? actor?.x);
      const canonicalY = Number(actor?.y);
      const projected = projection.project(canonicalX, canonicalY, actor?.kind);
      return {
        ...actor,
        canonicalX,
        canonicalY,
        x: projected.x,
        y: projected.y,
      };
    }),
  };
}
