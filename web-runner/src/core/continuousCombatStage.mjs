import { resetRealtimeSkillAttempt } from './realtimeSkillState.mjs';
import { computeCombatPower } from './combatPower.mjs';
import { deriveCombatArenaBounds, deriveCombatWorldBounds, deriveCombatWorldStartFormation, deriveCombatWorldVerticalBounds } from '../../../src/core/combatOrientation.mjs';
import { cleanseDebuffs } from './combatRules.mjs';
import { saveHeroProgress } from './heroProgression.mjs';
import { advanceContinuousCombatArena, deriveContinuousCombatSpawnMoat, placeContinuousCombatHeroesInRecoveryHuddle } from './arenaCombat.mjs';
import { isActorRecoveryRevealActive, resetActorPresentationAfterRestore } from './actorPresentationState.mjs';
import { previewSeededRng } from '../../../src/core/seededRngRules.mjs';
import { actorFootprintRadius } from '../../../src/core/arenaCombatRules.mjs';
import { enemyCombatTier } from './routineEnemyScaling.mjs';

export const CONTINUOUS_COMBAT_PACK_INTERVAL_SEC = 3;
export const CONTINUOUS_COMBAT_PACK_CP_STEP = 0.06;
const ORDINARY_LEVEL_ONE_HP_CEILING = Object.freeze({ fodder: 28, routine: 45, hard: 55, elite: 70 });
export const CONTINUOUS_COMBAT_WAVES_PER_STAGE = 4;
export const CONTINUOUS_COMBAT_STAGES_PER_REGION = 10;
export const CONTINUOUS_COMBAT_PACKS_PER_WAVE = 6;
export const CONTINUOUS_COMBAT_SOLOS_PER_WAVE = 6;
export const CONTINUOUS_COMBAT_ALL_PACKS_MASK = (1 << CONTINUOUS_COMBAT_PACKS_PER_WAVE) - 1;
export const CONTINUOUS_COMBAT_ENEMIES_PER_WAVE_MAX = CONTINUOUS_COMBAT_PACKS_PER_WAVE * 6 + CONTINUOUS_COMBAT_SOLOS_PER_WAVE;
export const CONTINUOUS_COMBAT_SECTOR_RATIOS = Object.freeze([0.12, 0.27, 0.42, 0.57, 0.72, 0.87]);
const CONTINUOUS_COMBAT_SOLO_STAT_SCALE = 0.5;
const CONTINUOUS_COMBAT_SOLO_PACK_CLEARANCE = 120;
const CONTINUOUS_COMBAT_SOLO_CLEARANCE = 150;
const CONTINUOUS_COMBAT_PACK_BOUNDARY_INSET = 0.01;
// Three columns keep the clouds spread across the arena. The top and bottom
// rows use the available vertical bounds to maintain a full-footprint gap.
const CONTINUOUS_COMBAT_PACK_COLUMNS = Object.freeze([-0.352, 0, 0.352]);
export const CONTINUOUS_COMBAT_BOSS_ENTRY_WIPE_MS = 440;

// Four normal packs form one repeatable stage. The boss is a gate rather than
// a fifth timed pack.
export const CONTINUOUS_COMBAT_STAGES = Object.freeze([
  Object.freeze({ wave: 1, kind: 'fodder', enemyNames: Object.freeze(['Gobloc', 'Skeleton']) }),
  Object.freeze({ wave: 2, kind: 'fodder', enemyNames: Object.freeze(['Gobloc', 'High Gobloc', 'Skeleton', 'Lizardo']) }),
  Object.freeze({ wave: 3, kind: 'fodder', enemyNames: Object.freeze(['High Gobloc', 'Lizardo', 'Orc']) }),
  Object.freeze({ wave: 4, kind: 'fodder', enemyNames: Object.freeze(['Gobloc', 'High Gobloc', 'Lizardo', 'Orc']) }),
  Object.freeze({ wave: 0, kind: 'boss', enemyNames: Object.freeze(['Troll']), waitForClear: true }),
]);

export function createContinuousCombatStageState(seed = 1, { region = 1, stage = 1 } = {}) {
  const normalizedSeed = Number(seed) >>> 0 || 1;
  const normalizedRegion = Math.max(1, Math.floor(Number(region) || 1));
  const normalizedStage = Math.max(1, Math.min(CONTINUOUS_COMBAT_STAGES_PER_REGION, Math.floor(Number(stage) || 1)));
  return {
    seed: normalizedSeed,
    region: normalizedRegion,
    stage: normalizedStage,
    wave: 1,
    clearedPackMask: 0,
    spawnedPackMask: 0,
    bossAvailable: false,
    bossSummonRequired: false,
    bossArmed: false,
    bossActive: false,
    bossUID: null,
    bossWorldX: null,
    transitions: 0,
    // Runtime measurement counters; checkpoint serialization intentionally omits them.
    ordinaryWaveClears: 0,
    defeatRecoveries: 0,
    clearedBosses: 0,
    nextEmissionAt: 0,
    awaitingPackArrival: false,
    lastUpdatedAt: 0,
    spawnSerial: 0,
  };
}

export function configureContinuousCombatProduction(globals, { productionPath = false } = {}) {
  const enabled = !!productionPath;
  globals.ContinuousCombatStageLoop = enabled ? 1 : 0;
  if (!enabled) return false;
  globals.EncounterPolicy = 'fodder_only';
  globals.EncounterMaxSlots = CONTINUOUS_COMBAT_ENEMIES_PER_WAVE_MAX;
  globals.ContinuousCombatStageComplete = 0;
  globals.RealtimeHeroFocusTargetUID = 0;
  const checkpoint = globals.HeroProgress?.continuousStage;
  globals.ContinuousCombatStage = {
    ...createContinuousCombatStageState(globals.EncounterSeed || 1, checkpoint),
    ...checkpoint,
    clearedPackMask: normalizeContinuousCombatPackMask(checkpoint?.clearedPackMask),
    spawnedPackMask: 0,
    spawnSerial: 0,
  };
  return true;
}

export function getContinuousCombatPartyCP(entities) {
  return (Array.isArray(entities) ? entities : [])
    .filter(actor => actor?.kind === 'hero')
    .reduce((total, hero) => total + computeCombatPower(hero), 0);
}

export function deriveContinuousCombatWavePackProgress(stageState, entities = []) {
  const packsPerWave = CONTINUOUS_COMBAT_PACKS_PER_WAVE;
  if (!stageState) {
    return { clearedPacks: 0, packsPerWave, fraction: 0 };
  }
  if (stageState.bossAvailable || stageState.bossActive) {
    return { clearedPacks: packsPerWave, packsPerWave, fraction: 1 };
  }
  return progressFromMask(deriveContinuousCombatWavePackMask(stageState, entities), packsPerWave);
}

function deriveContinuousCombatWavePackMask(stageState, entities) {
  const packsPerWave = CONTINUOUS_COMBAT_PACKS_PER_WAVE;
  const savedMask = normalizeContinuousCombatPackMask(stageState.clearedPackMask);
  if (Number(stageState.spawnSerial || 0) <= 0) return savedMask;
  const currentPackIndex = Math.max(0, Math.floor(Number(stageState.transitions) || 0));
  const livingPacks = new Set();
  let hasInvalidPackMetadata = false;
  for (const actor of Array.isArray(entities) ? entities : []) {
    if (actor?.kind !== 'enemy' || Number(actor.hp || 0) <= 0) continue;
    const packIndex = Number(actor.streamPackIndex);
    const streamSectorIndex = Number(actor.streamSectorIndex);
    if (!Number.isInteger(packIndex) || packIndex !== currentPackIndex || !Number.isInteger(streamSectorIndex)
      || streamSectorIndex < 0 || Math.floor(streamSectorIndex / packsPerWave) !== packIndex) {
      hasInvalidPackMetadata = true;
      continue;
    }
    livingPacks.add(((streamSectorIndex % packsPerWave) + packsPerWave) % packsPerWave);
  }
  if (hasInvalidPackMetadata) return savedMask;
  const spawnedMask = normalizeContinuousCombatPackMask(stageState.spawnedPackMask);
  const livingMask = [...livingPacks].reduce((mask, sector) => mask | (1 << sector), 0);
  return savedMask | (spawnedMask & ~livingMask);
}

function normalizeContinuousCombatPackMask(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= CONTINUOUS_COMBAT_ALL_PACKS_MASK ? value : 0;
}

function progressFromMask(mask, packsPerWave) {
  const clearedPacks = Array.from({ length: packsPerWave }, (_, index) => (mask & (1 << index)) !== 0).filter(Boolean).length;
  return { clearedPacks, packsPerWave, fraction: clearedPacks / packsPerWave };
}

export function recordContinuousCombatWavePackProgress(stageState, entities = []) {
  if (!stageState || stageState.bossAvailable || stageState.bossActive || Number(stageState.spawnSerial || 0) <= 0) return false;
  const normalizedMask = deriveContinuousCombatWavePackMask(stageState, entities);
  if (normalizedMask === normalizeContinuousCombatPackMask(stageState.clearedPackMask)) return false;
  stageState.clearedPackMask = normalizedMask;
  return true;
}

function streamGeometry(globals, { packIndex = 0, rank = 0, order = 0, sectorIndex = packIndex } = {}) {
  const bounds = deriveCombatArenaBounds();
  const vertical = deriveCombatWorldVerticalBounds();
  const enemySize = Math.max(20, Number(globals.EnemySize || 40));
  const firstY = vertical.minY + enemySize * 0.8;
  const lastY = vertical.maxY - enemySize * 0.8;
  const stateSeed = Number(globals.ContinuousCombatStage?.seed || globals.EncounterSeed || 1) >>> 0;
  const seedMix = (stateSeed ^ (Number(rank) * 2654435761) ^ (Number(packIndex) * 2246822519)) >>> 0;
  const sectorCount = CONTINUOUS_COMBAT_PACKS_PER_WAVE;
  const sectorOrder = (Math.floor(seedMix % sectorCount) + Math.max(0, Number(sectorIndex) || 0) * 5) % sectorCount;
  return {
    spawnX: 360 + enemySize * 1.5,
    y: Math.max(firstY, Math.min(lastY, firstY + sectorOrder * ((lastY - firstY) / Math.max(1, sectorCount - 1)))),
    walkSpeed: Math.max(34, enemySize * 0.9) * 0.7,
    enemySize,
    bounds,
    vertical,
  };
}

function seededPackFoot(globals, { packIndex, rank, sector, order, sectorSize, centerX, centerY, geometry }) {
  const normalizedOrder = Math.max(0, Math.floor(Number(order) || 0));
  const memberCount = Math.max(1, Math.min(6, Math.floor(Number(sectorSize) || normalizedOrder + 1)));
  const stateSeed = Number(globals.ContinuousCombatStage?.seed || globals.EncounterSeed || 1) >>> 0;
  const packSeed = (stateSeed ^ Math.imul((Number(rank) || 0) + 1, 2654435761)
    ^ Math.imul((Number(packIndex) || 0) + 1, 2246822519)
    ^ Math.imul((Number(sector) || 0) + 1, 3266489917)) >>> 0;
  const radius = Math.max(24, geometry.enemySize * 1.45);
  const verticalRadius = Math.min(radius, 54);
  const minSpacing = Math.max(22, Math.min(34, geometry.enemySize * 0.8));
  const world = deriveCombatWorldBounds();
  const xMin = Number(world.heroMinX) + actorFootprintRadius({ kind: 'enemy' });
  const xMax = Number(world.heroMaxX) - actorFootprintRadius({ kind: 'enemy' });
  const yInset = Math.max(actorFootprintRadius({ kind: 'enemy' }), geometry.enemySize * 0.8);
  const yMin = geometry.vertical.minY + yInset;
  const yMax = geometry.vertical.maxY - yInset;
  const placed = [];
  let draw = 0;
  for (let member = 0; member < memberCount; member += 1) {
    let best = null;
    let bestClearance = -Infinity;
    for (let attempt = 0; attempt < 512; attempt += 1) {
      const rawX = previewSeededRng(packSeed, draw++);
      const rawY = previewSeededRng(packSeed, draw++);
      const dx = (rawX * 2 - 1) * radius;
      const dy = (rawY * 2 - 1) * verticalRadius;
      if (dx * dx + dy * dy > radius * radius) continue;
      const candidate = {
        x: centerX + dx,
        y: centerY + dy,
      };
      if (candidate.x < xMin || candidate.x > xMax || candidate.y < yMin || candidate.y > yMax) continue;
      const clearance = placed.length
        ? Math.min(...placed.map(point => Math.hypot(candidate.x - point.x, candidate.y - point.y)))
        : Infinity;
      if (clearance > bestClearance) { best = candidate; bestClearance = clearance; }
      if (clearance >= minSpacing) { best = candidate; break; }
    }
    if (!best) best = { x: Math.max(xMin, Math.min(xMax, centerX)), y: Math.max(yMin, Math.min(yMax, centerY)) };
    placed.push(best);
  }
  const moat = deriveContinuousCombatSpawnMoat();
  const packCenter = placed.reduce((sum, point) => ({ x: sum.x + point.x / placed.length, y: sum.y + point.y / placed.length }), { x: 0, y: 0 });
  const packMinY = Math.min(...placed.map(point => point.y));
  const packMaxY = Math.max(...placed.map(point => point.y));
  const column = CONTINUOUS_COMBAT_PACK_COLUMNS[sector % CONTINUOUS_COMBAT_PACK_COLUMNS.length];
  const row = Math.floor(sector / CONTINUOUS_COMBAT_PACK_COLUMNS.length);
  const targetCenter = {
    x: moat.centerX + world.worldWidth * column,
    y: row === 0 ? yMin + CONTINUOUS_COMBAT_PACK_BOUNDARY_INSET : yMax - CONTINUOUS_COMBAT_PACK_BOUNDARY_INSET,
  };
  const offset = {
    x: targetCenter.x - packCenter.x,
    y: row === 0 ? targetCenter.y - packMinY : targetCenter.y - packMaxY,
  };
  const fits = placed.every(point => point.x + offset.x >= xMin && point.x + offset.x <= xMax
    && point.y + offset.y >= yMin && point.y + offset.y <= yMax);
  const moved = placed.map(point => ({ x: point.x + offset.x, y: point.y + offset.y }));
  const clearsMoat = moved.every(point => Math.hypot(point.x - moat.centerX, point.y - moat.centerY)
    - actorFootprintRadius({ kind: 'enemy' }) >= moat.minimumEnemyCenterDistance);
  if (!fits || !clearsMoat) {
    throw new RangeError('continuous combat pack layout cannot fit this authored cloud outside the recovery moat');
  }
  return moved[normalizedOrder] || moved[moved.length - 1];
}

function seededSoloFoot(stageState, sector, occupiedPackFeet, priorSoloFeet, enemySize = 40) {
  const world = deriveCombatWorldBounds();
  const vertical = deriveCombatWorldVerticalBounds();
  const moat = deriveContinuousCombatSpawnMoat();
  const radius = actorFootprintRadius({ kind: 'enemy' });
  const side = sector < CONTINUOUS_COMBAT_PACKS_PER_WAVE / 2 ? -1 : 1;
  const xMin = side < 0 ? world.heroMinX + radius : moat.centerX + moat.minimumEnemyCenterDistance + radius;
  const xMax = side < 0 ? moat.centerX - moat.minimumEnemyCenterDistance - radius : world.heroMaxX - radius;
  const yMin = vertical.minY + Math.max(radius, enemySize * 0.8);
  const yMax = vertical.maxY - Math.max(radius, enemySize * 0.8);
  const bandHeight = (yMax - yMin) / (CONTINUOUS_COMBAT_PACKS_PER_WAVE / 2);
  const band = sector % (CONTINUOUS_COMBAT_PACKS_PER_WAVE / 2);
  const bandMin = yMin + band * bandHeight;
  const bandMax = yMin + (band + 1) * bandHeight;
  const seed = (Number(stageState?.seed || 1) ^ Math.imul(Number(stageState?.transitions || 0) + 1, 2246822519) ^ Math.imul(sector + 1, 3266489917)) >>> 0;
  const valid = point => Math.hypot(point.x - moat.centerX, point.y - moat.centerY) >= moat.minimumEnemyCenterDistance + radius
    && occupiedPackFeet.every(other => Math.hypot(point.x - other.x, point.y - other.y) >= CONTINUOUS_COMBAT_SOLO_PACK_CLEARANCE)
    && priorSoloFeet.every(other => Math.hypot(point.x - other.x, point.y - other.y) >= CONTINUOUS_COMBAT_SOLO_CLEARANCE);
  let best = null;
  let bestClearance = -Infinity;
  for (const [candidateYMin, candidateYMax] of [[bandMin, bandMax], [yMin, yMax]]) {
    for (let draw = 0; draw < 2048; draw += 1) {
      const point = {
        x: xMin + previewSeededRng(seed, draw * 2) * (xMax - xMin),
        y: candidateYMin + previewSeededRng(seed, draw * 2 + 1) * (candidateYMax - candidateYMin),
      };
      const clearance = Math.min(...occupiedPackFeet.concat(priorSoloFeet).map(other => Math.hypot(point.x - other.x, point.y - other.y)));
      if (clearance > bestClearance && valid(point)) { best = point; bestClearance = clearance; }
    }
    if (best) break;
  }
  if (!best) throw new RangeError('continuous combat solo placement cannot fit outside the recovery moat and pack clouds');
  return best;
}

const PACK_WALK_SPEED_SCALE = Object.freeze([1, 0.9, 1.12, 0.82, 1.17]);
const RANGED_ENEMY_NAMES = new Set(['marid', 'djinn', 'chimerilass']);
const BOSS_HOME = Object.freeze({ x: 290, y: 290 });
const MAX_SHIELD_SLAM_PUSH = 55;
const MAX_RETURN_GATE_DISTANCE = 100;
const MIN_RETURN_GATE_DISTANCE = 40;

function isDisplaceableStreamEnemy(enemy) {
  return enemy?.kind === 'enemy' && Number(enemy.hp || 0) > 0
    && ['approaching', 'in_range', 'engaged', 'retreating'].includes(enemy.streamState)
    && Number.isFinite(Number(enemy.x));
}

function enemyFoot(enemy) {
  return { x: Number.isFinite(Number(enemy?.footX)) ? Number(enemy.footX) : Number(enemy?.x || 0), y: Number.isFinite(Number(enemy?.footY)) ? Number(enemy.footY) : Number(enemy?.y || 0) };
}
function writeEnemyFoot(enemy, point) { enemy.footX = point.x; enemy.footY = point.y; enemy.x = point.x; enemy.y = point.y; }
function displacementDirection(enemy, source) {
  const target = enemyFoot(enemy), origin = source ? enemyFoot(source) : { x: target.x - 1, y: target.y };
  const dx = target.x - origin.x, dy = target.y - origin.y, length = Math.hypot(dx, dy);
  return length > 0.001 ? { x: dx / length, y: dy / length } : { x: 1, y: 0 };
}
function boundedEnemyFoot(point, clampY = true, enemy = null) {
  if (enemy?.arenaEnabled) {
    const world = deriveCombatWorldBounds();
    const bounds = deriveCombatWorldVerticalBounds();
    return { x: Math.max(world.heroMinX, Math.min(world.heroMaxX, point.x)), y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y)) };
  }
  const bounds = deriveCombatArenaBounds();
  return { x: Math.max(bounds.heroBackCenterX, Math.min(bounds.attackStartX, point.x)), y: clampY ? Math.max(bounds.visibleTopY, Math.min(bounds.visibleBottomY, point.y)) : point.y };
}
function moveStreamEnemyAway(enemy, distance, maxDistance, minimumDistance = 0, source = null) {
  if (!isDisplaceableStreamEnemy(enemy)) return 0;
  const current = source ? enemyFoot(enemy) : { x: Number(enemy.x || 0), y: Number(enemy.y || 0) }, direction = source ? displacementDirection(enemy, source) : { x: 1, y: 0 };
  const requested = Math.min(Math.max(0, Number(distance) || 0), maxDistance);
  const next = boundedEnemyFoot({ x: current.x + direction.x * requested, y: current.y + direction.y * requested }, !!source || Number(enemy.y || 0) >= deriveCombatArenaBounds().visibleTopY, enemy);
  const moved = Math.hypot(next.x - current.x, next.y - current.y);
  if (moved < minimumDistance) return 0;
  enemy.streamEngageX = Number(enemy.streamEngageX ?? enemy.originX ?? current.x);
  writeEnemyFoot(enemy, next);
  const pending = enemy.streamPendingDisplacement || { x: 0, y: 0 };
  enemy.streamPendingDisplacement = { x: Number(pending.x || 0) + next.x - current.x, y: Number(pending.y || 0) + next.y - current.y };
  enemy.streamPendingDisplacementDelta = Number(enemy.streamPendingDisplacement.x || 0);
  delete enemy.streamRetreatStartedAt;
  delete enemy.streamRetreatRemaining;
  delete enemy.streamRetreatAnchor;
  delete enemy.streamRetreatDirection;
  enemy.streamState = 'in_range';
  enemy.arenaInReach = false;
  return moved;
}

export function pushContinuousCombatEnemy(enemy, distance = MAX_SHIELD_SLAM_PUSH, _now = 0, source = null) {
  return moveStreamEnemyAway(enemy, distance, MAX_SHIELD_SLAM_PUSH, 0, source);
}

export function teleportContinuousCombatEnemy(enemy, distance = MAX_RETURN_GATE_DISTANCE, _now = 0, source = null) {
  return moveStreamEnemyAway(enemy, distance, MAX_RETURN_GATE_DISTANCE, MIN_RETURN_GATE_DISTANCE, source);
}

export function reverseContinuousCombatEnemy(enemy, now, durationSeconds = 1.25, source = null) {
  if (!isDisplaceableStreamEnemy(enemy) || enemy.streamState === 'retreating') return false;
  const start = Number(now);
  const duration = Number(durationSeconds);
  if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) return false;
  enemy.streamRetreatStartedAt = start;
  enemy.streamRetreatRemaining = duration;
  enemy.streamRetreatAnchor = enemyFoot(enemy);
  enemy.streamRetreatDirection = displacementDirection(enemy, source);
  enemy.streamState = 'retreating';
  return true;
}

export function activateContinuousCombatSpawnedEnemy(globals, enemy, { lane = 1, rank = 0, packIndex = 0, entryOrder = lane, sectorIndex = null, sectorSize = 3, bossX = BOSS_HOME.x, isSolo = false, soloFootX = null, soloFootY = null } = {}) {
  if (!enemy) return null;
  const order = Math.max(0, Math.floor(Number(entryOrder || 0)));
  const normalizedSectorSize = Math.max(1, Math.floor(Number(sectorSize) || 3));
  const sector = sectorIndex == null
    ? Math.max(0, Math.min(CONTINUOUS_COMBAT_PACKS_PER_WAVE - 1, Number(packIndex || 0) % CONTINUOUS_COMBAT_PACKS_PER_WAVE))
    : Math.max(0, Math.min(CONTINUOUS_COMBAT_PACKS_PER_WAVE - 1, Math.floor(Number(sectorIndex) || 0)));
  const geometry = streamGeometry(globals, { packIndex, rank, order, sectorIndex: sector });
  const delivery = RANGED_ENEMY_NAMES.has(String(enemy.name || '').trim().toLowerCase()) ? 'ranged' : 'melee';
  const meleeLine = order % 2;
  const normalizedPackIndex = Math.max(0, Number(packIndex || 0));
  const boss = String(enemy.enemyRole || enemy.role || '').toLowerCase() === 'boss';
  const world = deriveCombatWorldBounds();
  const sectorX = world.worldWidth * CONTINUOUS_COMBAT_SECTOR_RATIOS[sector];
  const engageX = boss ? bossX : sectorX;
  const packFoot = boss ? null : isSolo && Number.isFinite(Number(soloFootX)) && Number.isFinite(Number(soloFootY))
    ? { x: Number(soloFootX), y: Number(soloFootY) }
    : seededPackFoot(globals, {
    packIndex, rank, sector, order, sectorSize: isSolo ? 1 : normalizedSectorSize,
    centerX: sectorX, centerY: geometry.y, geometry,
  });
  const homeY = boss ? BOSS_HOME.y : packFoot.y;
  const homeX = boss ? engageX : packFoot.x;
  Object.assign(enemy, {
    combatRank: ['boss','subboss'].includes(String(enemy.enemyRole || enemy.role || '').toLowerCase()) ? String(enemy.enemyRole || enemy.role).toLowerCase() : 'ordinary',
    streamState: 'roaming', streamLane: lane, streamRank: rank, streamPackIndex: packIndex,
    streamSectorIndex: sector + Number(packIndex || 0) * CONTINUOUS_COMBAT_PACKS_PER_WAVE,
    streamEngagementGroupId: sector + Number(packIndex || 0) * CONTINUOUS_COMBAT_PACKS_PER_WAVE + (isSolo ? CONTINUOUS_COMBAT_PACKS_PER_WAVE : 0),
    streamSolo: isSolo ? 1 : 0,
    streamSoloAnchorX: isSolo ? homeX : undefined,
    streamSoloAnchorY: isSolo ? homeY : undefined,
    streamSoloPhase: isSolo ? previewSeededRng(Number(globals.ContinuousCombatStage?.seed || globals.EncounterSeed || 1) >>> 0, Number(globals.ContinuousCombatStage?.transitions || 0) * CONTINUOUS_COMBAT_PACKS_PER_WAVE + sector + 0x1000) * Math.PI * 2 : undefined,
    streamEntryOrder: order,
    streamDelivery: delivery, streamMeleeLine: order % 2,
    actionState: 'spawn', actionFacing: 'left', actionStateStartedAt: Number(globals.time || 0), actionStateUntil: Number(globals.time || 0) + 0.35,
    streamEngageX: homeX, streamWalkSpeed: geometry.walkSpeed * PACK_WALK_SPEED_SCALE[order % PACK_WALK_SPEED_SCALE.length],
    streamStartAt: Number(globals.time || 0),
    x: homeX, y: homeY, originX: homeX, originY: homeY,
    footX: homeX, footY: homeY, facing: 'left', locomotion: 'idle', arenaEnabled: true,
  });
  return enemy;
}

export function finalizeContinuousCombatProduction(globals, entities = []) {
  if (Number(globals.ContinuousCombatStageLoop || 0) !== 1) return false;
  const now = Number(globals.time || 0);
  globals.QuestFiniteEncounter = 1;
  globals.ContinuousCombatStageComplete = 0;
  delete globals.SessionLevelUpSettlement;
  globals.PendingFlowThresholds = [];
  globals.FlowOrbs = [];
  globals.AstralFlowKoOrbQueue = [];
  globals.AstralFlowKoOrbPresentationPending = 0;
  globals.AstralFlowKoOrbPresentationActive = 0;
  const productionEnemies = (Array.isArray(entities) ? entities : []).filter(actor => actor?.kind === 'enemy');
  const productionHeroes = (Array.isArray(entities) ? entities : []).filter(actor => actor?.kind === 'hero');
  const startFormation = deriveCombatWorldStartFormation(productionHeroes.length);
  const packSize = Math.max(1, Math.ceil(productionEnemies.length / CONTINUOUS_COMBAT_PACKS_PER_WAVE));
  let enemyOrder = 0;
  let heroOrder = 0;
  for (const actor of Array.isArray(entities) ? entities : []) {
    if (actor?.kind === 'hero') {
      if (!Number.isFinite(Number(actor.footX))) actor.footX = startFormation.heroX[heroOrder];
      actor.flow = 0;
      actor.flowReady = false;
      heroOrder += 1;
    } else if (actor?.kind === 'enemy') {
      const explicitSector = actor.continuousStageSectorIndex;
      const hasExplicitPlacement = Number.isInteger(explicitSector);
      const sectorIndex = hasExplicitPlacement ? explicitSector : Math.min(CONTINUOUS_COMBAT_PACKS_PER_WAVE - 1, Math.floor(enemyOrder / packSize));
      const entryOrder = hasExplicitPlacement ? actor.continuousStageEntryOrder : enemyOrder % packSize;
      const sectorSize = hasExplicitPlacement ? actor.continuousStageSectorSize : packSize;
      const packIndex = hasExplicitPlacement ? actor.continuousStagePackIndex : 0;
      const rank = hasExplicitPlacement ? Number(actor.continuousStageRank || 0) : 0;
      const isSolo = hasExplicitPlacement && Number(actor.continuousStageSolo || 0) === 1;
      const soloFootX = hasExplicitPlacement ? actor.continuousStageSoloFootX : null;
      const soloFootY = hasExplicitPlacement ? actor.continuousStageSoloFootY : null;
      activateContinuousCombatSpawnedEnemy(globals, actor, { lane: Number(actor.slotIndex ?? 1), rank, packIndex, entryOrder, sectorIndex, sectorSize, isSolo, soloFootX, soloFootY });
      delete actor.continuousStageSectorIndex;
      delete actor.continuousStageEntryOrder;
      delete actor.continuousStageSectorSize;
      delete actor.continuousStagePackIndex;
      delete actor.continuousStageRank;
      delete actor.continuousStageSolo;
      delete actor.continuousStageSoloFootX;
      delete actor.continuousStageSoloFootY;
      enemyOrder += 1;
    }
  }
  if (globals.ContinuousCombatStage) {
    globals.ContinuousCombatStage.nextEmissionAt = now + CONTINUOUS_COMBAT_PACK_INTERVAL_SEC;
    globals.ContinuousCombatStage.awaitingPackArrival = false;
    globals.ContinuousCombatStage.lastUpdatedAt = now;
    globals.ContinuousCombatStage.spawnSerial = (entities || []).filter(actor => actor?.kind === 'enemy').length;
    globals.ContinuousCombatStage.spawnedPackMask = (entities || []).filter(actor => actor?.kind === 'enemy')
      .reduce((mask, actor) => Number.isInteger(actor.streamSectorIndex) ? mask | (1 << (actor.streamSectorIndex % CONTINUOUS_COMBAT_PACKS_PER_WAVE)) : mask, 0);
  }
  const hasBossActor = productionEnemies.some(actor => String(actor.combatRank || actor.enemyRole || actor.role || '').toLowerCase() === 'boss');
  if (globals.ContinuousCombatStage && !globals.ContinuousCombatStage.bossActive && !hasBossActor) {
    globals.ContinuousCombatRoamAttempt = -1;
    placeContinuousCombatHeroesInRecoveryHuddle({ globals, heroes: productionHeroes, now });
  } else {
    delete globals.ContinuousCombatInitialRoam;
    delete globals.ContinuousCombatRoamAttempt;
  }
  globals.NativeBattleEnded = false;
  if (globals.ProgressionBattle) {
    globals.ProgressionBattle.outcome = 'active';
    globals.ProgressionBattle.settled = false;
    globals.ProgressionBattle.defeatSettled = false;
  }
  return entities.length > 0;
}

export function getContinuousCombatStage(stageState) {
  const region = Math.max(1, Math.floor(Number(stageState?.region) || 1));
  const stage = Math.max(1, Math.min(CONTINUOUS_COMBAT_STAGES_PER_REGION, Math.floor(Number(stageState?.stage) || 1)));
  const bossActive = !!stageState?.bossActive;
  const wave = Math.max(1, Math.min(CONTINUOUS_COMBAT_WAVES_PER_STAGE, Math.floor(Number(stageState?.wave) || 1)));
  const template = bossActive
    ? CONTINUOUS_COMBAT_STAGES[CONTINUOUS_COMBAT_STAGES.length - 1]
    : CONTINUOUS_COMBAT_STAGES[wave - 1];
  return template ? { ...template, id: `${region}-${stage}-${bossActive ? 'boss' : `wave-${wave}`}`, region, stage, wave } : null;
}

export function advanceContinuousCombatStage(stageState) {
  const current = getContinuousCombatStage(stageState);
  const transitions = Number(stageState?.transitions || 0) + 1;
  if (stageState?.bossActive) {
    const currentStage = Math.max(1, Math.floor(Number(stageState?.stage) || 1));
    const nextRegion = currentStage >= CONTINUOUS_COMBAT_STAGES_PER_REGION
      ? Math.max(1, Math.floor(Number(stageState?.region) || 1)) + 1
      : Math.max(1, Math.floor(Number(stageState?.region) || 1));
    const nextStage = currentStage >= CONTINUOUS_COMBAT_STAGES_PER_REGION ? 1 : currentStage + 1;
    const state = {
      ...stageState,
      region: nextRegion,
      stage: nextStage,
      wave: 1,
      clearedPackMask: 0,
      spawnedPackMask: 0,
      bossAvailable: false,
      bossSummonRequired: false,
      bossArmed: false,
      bossActive: false,
      bossUID: null,
      bossCameraCenterX: null,
      bossWorldX: null,
      bossTransitionStartedAtMs: null,
      bossTransitionEndsAtMs: null,
      transitions,
      clearedBosses: Number(stageState?.clearedBosses || 0) + 1,
    };
    return { done: false, stage: getContinuousCombatStage(state), state, clearedBoss: current?.id || '' };
  }
  const currentWave = Math.max(1, Math.min(CONTINUOUS_COMBAT_WAVES_PER_STAGE, Math.floor(Number(stageState?.wave) || 1)));
  const ordinaryWaveClears = Math.max(0, Math.floor(Number(stageState?.ordinaryWaveClears) || 0)) + 1;
  const state = currentWave >= CONTINUOUS_COMBAT_WAVES_PER_STAGE
    ? { ...stageState, wave: 1, clearedPackMask: 0, spawnedPackMask: 0, bossAvailable: true, transitions, ordinaryWaveClears }
    : { ...stageState, wave: currentWave + 1, clearedPackMask: 0, spawnedPackMask: 0, transitions, ordinaryWaveClears };
  return { done: false, stage: getContinuousCombatStage(state), state };
}

export function armContinuousCombatBoss(globals, entities, call, { wallNowMs = Date.now(), transitionDurationMs = CONTINUOUS_COMBAT_BOSS_ENTRY_WIPE_MS } = {}) {
  const state = globals?.ContinuousCombatStage;
  if (!state || !state.bossAvailable || state.bossActive) return false;
  const livingHeroes = entities.filter(actor => actor?.kind === 'hero' && Number(actor.hp || 0) > 0);
  let squadCenterX = livingHeroes.length
    ? livingHeroes.reduce((sum, hero) => sum + Number(hero.footX ?? hero.x ?? 0), 0) / livingHeroes.length
    : BOSS_HOME.x - 130;
  if (livingHeroes.length) {
    const world = deriveCombatWorldBounds();
    const safeCenterX = Math.max(world.heroMinX + 320, Math.min(world.heroMaxX - 260 - 72 - 32, squadCenterX));
    const shiftX = safeCenterX - squadCenterX;
    if (shiftX) for (const hero of livingHeroes) {
      const nextX = Math.max(world.heroMinX, Math.min(world.heroMaxX, Number(hero.footX ?? hero.x ?? safeCenterX) + shiftX));
      hero.footX = hero.x = nextX;
    }
    squadCenterX = safeCenterX;
  }
  const startedAtMs = Number(wallNowMs);
  const next = {
    ...state,
    bossArmed: true,
    bossActive: true,
    bossWorldX: squadCenterX + 260,
    bossCameraCenterX: squadCenterX + 130,
    bossTransitionStartedAtMs: startedAtMs,
    bossTransitionEndsAtMs: startedAtMs + Math.max(0, Number(transitionDurationMs) || 0),
    bossUID: null,
    transitions: Number(state.transitions || 0) + 1,
  };
  if (!buildContinuousCombatSpawnPlan(globals.EnemyData, next).length) return false;
  call('SettleContinuousCombatRewards');
  // Abandon the fodder encounter, including its queued hits, without awarding kills.
  const heroUIDs = new Set(entities.filter(a => a?.kind === 'hero').map(a => String(a.uid)));
  entities.splice(0, entities.length, ...entities.filter(a => a?.kind !== 'enemy'));
  Object.assign(globals, {
    EnemySlots: [], PendingDeaths: {}, EnemyDeathVisualHoldByUID: {},
    RealtimeEnemyActionsByUID: {}, RealtimeEnemyActionReadyAt: {},
    PendingHeroHits: [], RealtimeHeroBasicScheduledActions: {}, RealtimeHeroFocusTargetUID: 0,
    EnemyDebuffs: {}, EnemyDebuffSlots: {}, EnemyDebuffTurns: {}, EnemyDebuffPop: {}, EnemyDamageOverTime: [],
    RealtimeSkillZones: [], ChainStrikeVisuals: [], ArcanePulseVisuals: [], DamageTexts: [], CombatImpactRequests: [], CombatImpactVisuals: [], CombatProjectileVisuals: [],
    SelectedEnemyUID: 0, SelectedEnemyUIDOwner: 0, ActionInProgress: 0, IsPlayerBusy: 0,
    ActionOwnerUID: 0, ActionActorUID: 0, ActionLockUntil: 0, DeferAdvance: 0, AdvanceAfterAction: 0, TextAnimEndAt: 0,
    NativeBattleEnded: false,
  });
  globals.RealtimeSkillEffects = Object.fromEntries(Object.entries(globals.RealtimeSkillEffects || {}).filter(([uid]) => heroUIDs.has(uid)));
  delete globals.HeroAction; delete globals.EnemyAction; delete globals.NativeCommandSequence;
  for (const clock of Object.values(globals.RealtimeHeroBasicClocks || {})) clock.castUntil = 0;
  spawnContinuousCombatStage({ globals, entities, call, state: next });
  return true;
}

export function summonContinuousCombatBoss(globals, entities, call, options = {}) {
  const state = globals?.ContinuousCombatStage;
  if (!state?.bossAvailable || !state.bossSummonRequired || state.bossActive) return false;
  const heroes = (entities || []).filter(actor => actor?.kind === 'hero');
  const now = Number(globals.time || 0);
  if (!heroes.length || heroes.some(hero => Number(hero.hp || 0) <= 0 || isActorRecoveryRevealActive(hero, now))) return false;
  if (!armContinuousCombatBoss(globals, entities, call, options)) return false;
  if (globals.HeroProgress) globals.HeroProgressDirty = true;
  return true;
}

export function resetContinuousCombatAfterDefeat(globals) {
  const state = globals?.ContinuousCombatStage;
  if (!state) return false;
  const recordedPackMask = normalizeContinuousCombatPackMask(state.clearedPackMask);
  const finalWaveClear = !state.bossActive && Number(state.wave || 1) >= CONTINUOUS_COMBAT_WAVES_PER_STAGE
    && recordedPackMask === CONTINUOUS_COMBAT_ALL_PACKS_MASK;
  const bossAvailable = !!state.bossAvailable || !!state.bossActive || finalWaveClear;
  const clearedPackMask = bossAvailable ? 0 : recordedPackMask;
  globals.ContinuousCombatStage = {
    ...state,
    transitions: Math.max(0, Math.floor(Number(state.transitions) || 0)) + 1,
    defeatRecoveries: Math.max(0, Math.floor(Number(state.defeatRecoveries) || 0)) + 1,
    wave: bossAvailable ? 1 : state.wave,
    clearedPackMask,
    spawnedPackMask: 0,
    bossAvailable,
    bossSummonRequired: true,
    bossArmed: false,
    bossActive: false,
    bossCameraCenterX: null,
    bossWorldX: null,
    bossTransitionStartedAtMs: null,
    bossTransitionEndsAtMs: null,
    bossUID: null,
    nextEmissionAt: Number(globals.time || 0) + (bossAvailable ? CONTINUOUS_COMBAT_PACK_INTERVAL_SEC : 0),
    awaitingPackArrival: false,
    lastUpdatedAt: Number(globals.time || 0),
  };
  if (globals.HeroProgress) globals.HeroProgressDirty = true;
  return true;
}

export function continuousCombatBossControlState(stageState) {
  if (stageState?.bossActive) return 'active';
  if (stageState?.bossArmed) return 'armed';
  if (stageState?.bossAvailable) return 'available';
  return 'locked';
}

function scaleContinuousCombatRow(row, scale) {
  if (!row) return null;
  const scaled = { ...row };
  for (const key of ['HP', 'ATK', 'DEF', 'MAG', 'RES', 'SPD']) scaled[key] = Math.max(1, Math.round(Number(row?.[key] || 1) * scale));
  scaled.maxHP = scaled.HP;
  scaled.CombatPower = computeCombatPower(scaled);
  scaled.streamCpScale = scale;
  return scaled;
}

function boundOrdinaryWaveHP(row, progressionScale) {
  const ceiling = ORDINARY_LEVEL_ONE_HP_CEILING[enemyCombatTier(row)];
  if (!ceiling) return row;
  const hp = Math.min(row.HP, Math.max(1, Math.round(ceiling * progressionScale)));
  return { ...row, HP: hp, maxHP: hp, CombatPower: computeCombatPower({ ...row, HP: hp, maxHP: hp }) };
}

export function scaleContinuousCombatPackRow(row, cpStep = 0) {
  return scaleContinuousCombatRow(row, 1 + Math.max(0, Number(cpStep || 0)) * CONTINUOUS_COMBAT_PACK_CP_STEP);
}

function findPackScale(rows, targetCP) {
  let low = 0.25;
  let high = 50;
  for (let i = 0; i < 16; i += 1) {
    const scale = (low + high) / 2;
    const total = rows.reduce((sum, row) => sum + scaleContinuousCombatRow(row, scale).CombatPower, 0);
    if (total < targetCP) low = scale;
    else high = scale;
  }
  return high;
}

function expandWaveRows(stage, byName, catalogRows, compositionSeed = null) {
  const pool = stage.enemyNames.map(name => byName.get(name)).filter(Boolean);
  if (stage.kind === 'boss' || !pool.length) return pool;
  const bossNames = new Set(CONTINUOUS_COMBAT_STAGES.filter(candidate => candidate.kind === 'boss').flatMap(candidate => candidate.enemyNames));
  const catalogCP = catalogRows.filter(row => String(row?.combatTier || '').toLowerCase() !== 'boss' && !bossNames.has(String(row?.name || row?.EnemyName || ''))).map(computeCombatPower);
  const minCP = Math.min(...catalogCP);
  const maxCP = Math.max(...catalogCP);
  const averageCP = pool.reduce((sum, row) => sum + computeCombatPower(row), 0) / pool.length;
  const strength = maxCP > minCP ? (averageCP - minCP) / (maxCP - minCP) : 0.5;
  const packSize = strength <= 0.2 ? 3 : 2;
  if (compositionSeed == null) return Array.from({ length: packSize * CONTINUOUS_COMBAT_PACKS_PER_WAVE }, (_, index) => pool[index % pool.length]);
  const seed = Number(compositionSeed) >>> 0 || 1;
  return Array.from({ length: packSize * CONTINUOUS_COMBAT_PACKS_PER_WAVE }, (_, index) => pool[Math.floor(previewSeededRng(seed, index) * pool.length)]);
}

export function buildContinuousCombatSpawnPlan(enemyRows, stageState, { slotBase = 0, partyCP = 0, enemySize = 40 } = {}) {
  if (stageState?.bossAvailable && !stageState?.bossActive && !stageState?.bossSummonRequired) return [];
  const stage = getContinuousCombatStage(stageState);
  const rows = Array.isArray(enemyRows) ? enemyRows : [];
  if (!stage || !rows.length) return [];
  const byName = new Map(rows.map(row => [String(row?.name || row?.EnemyName || '').trim(), row]));
  const compositionSeed = (Number(stageState?.seed || 1)
    ^ Math.imul(Math.max(0, Math.floor(Number(stageState?.transitions) || 0)) + 1, 2654435761)
    ^ Math.imul(Math.max(1, Math.floor(Number(stage.wave) || 1)), 2246822519)) >>> 0;
  const selectedRows = expandWaveRows(stage, byName, rows, compositionSeed);
  const baselineRows = expandWaveRows(CONTINUOUS_COMBAT_STAGES[0], byName, rows);
  const totalCP = entries => entries.reduce((sum, row) => sum + computeCombatPower(row), 0);
  const stageOrdinal = (Math.max(1, Number(stage.region || 1)) - 1) * CONTINUOUS_COMBAT_STAGES_PER_REGION
    + Math.max(0, Number(stage.stage || 1) - 1);
  const waveStep = stage.kind === 'boss' ? CONTINUOUS_COMBAT_WAVES_PER_STAGE - 1 : Math.max(0, Number(stage.wave || 1) - 1);
  const progressionScale = 1 + stageOrdinal * 0.08 + waveStep * 0.04;
  // A boss challenges one local pack's party, not all six dispersed packs at once.
  const baselineCP = totalCP(baselineRows) / (stage.kind === 'boss' ? CONTINUOUS_COMBAT_PACKS_PER_WAVE : 1);
  const linearTarget = baselineCP * progressionScale * (stage.kind === 'boss' ? 1.35 : 1);
  const introductoryBoss = stage.kind === 'boss' && stageOrdinal === 0;
  const packScale = introductoryBoss ? 1 : selectedRows.length ? findPackScale(selectedRows, linearTarget) : 1;
  const packSize = stage.kind === 'boss' ? 1 : selectedRows.length / CONTINUOUS_COMBAT_PACKS_PER_WAVE;
  const entries = selectedRows.map((row, index) => ({
    row: stage.kind === 'boss' ? scaleContinuousCombatRow(row, packScale) : boundOrdinaryWaveHP(scaleContinuousCombatRow(row, packScale), progressionScale),
    lane: index % packSize,
    rank: Math.floor(Number(slotBase || 0) / CONTINUOUS_COMBAT_PACKS_PER_WAVE),
    packIndex: Number(stageState?.transitions || 0),
    entryOrder: index % packSize,
    sectorIndex: stage.kind === 'boss' ? 1 : Math.floor(index / packSize),
  })).filter(entry => entry.row?.name);

  const deployedPartyCP = Math.max(0, Number(partyCP) || 0);
  if (stage.kind !== 'boss' && deployedPartyCP > 0) {
    const countDrawBase = Math.max(0, Math.floor(Number(stageState?.transitions) || 0)) * CONTINUOUS_COMBAT_PACKS_PER_WAVE;
    for (let sector = 0; sector < CONTINUOUS_COMBAT_PACKS_PER_WAVE; sector += 1) {
      const pack = entries.filter(entry => entry.sectorIndex === sector);
      if (!pack.length || totalCP(pack.map(entry => entry.row)) >= deployedPartyCP) continue;
      const extraCount = 1 + Math.floor(previewSeededRng(stageState?.seed || 1, countDrawBase + sector) * 3);
      for (let index = 0; index < extraCount; index += 1) {
        const source = pack[index % pack.length];
        entries.push({ ...source, row: { ...source.row }, entryOrder: pack.length + index });
      }
    }
  }

  const remainingEntries = stage.kind === 'boss' ? entries : entries.filter(entry => !(normalizeContinuousCombatPackMask(stageState?.clearedPackMask) & (1 << entry.sectorIndex)));
  if (stage.kind !== 'boss' && remainingEntries.length) {
    const soloRows = ['Gobloc', 'Skeleton'].map(name => byName.get(name)).filter(Boolean);
    const soloTargetCP = Math.min(...remainingEntries.map(entry => computeCombatPower(entry.row))) * CONTINUOUS_COMBAT_SOLO_STAT_SCALE;
    const placementGlobals = { ContinuousCombatStage: stageState, EnemySize: enemySize, time: 0 };
    const placementSectorSizes = new Map();
    for (const entry of remainingEntries) placementSectorSizes.set(entry.sectorIndex, (placementSectorSizes.get(entry.sectorIndex) || 0) + 1);
    const placementSectorOrders = new Map();
    const occupiedPackFeet = remainingEntries.map((entry, index) => {
      const actor = { kind: 'enemy', uid: index + 1, name: entry.row.name, enemyRole: entry.row.enemyRole || entry.row.role, hp: 1, ...entry.row };
      const entryOrder = placementSectorOrders.get(entry.sectorIndex) || 0;
      placementSectorOrders.set(entry.sectorIndex, entryOrder + 1);
      activateContinuousCombatSpawnedEnemy(placementGlobals, actor, { ...entry, entryOrder, sectorSize: placementSectorSizes.get(entry.sectorIndex) });
      return { x: actor.footX, y: actor.footY };
    });
    const soloFeet = [];
    for (let sector = 0; soloRows.length && sector < CONTINUOUS_COMBAT_SOLOS_PER_WAVE; sector += 1) {
      if (normalizeContinuousCombatPackMask(stageState?.clearedPackMask) & (1 << sector)) continue;
      const soloRow = soloRows[Math.floor(previewSeededRng(stageState?.seed || 1, Number(stageState?.transitions || 0) * CONTINUOUS_COMBAT_SOLOS_PER_WAVE + sector) * soloRows.length)];
      const foot = seededSoloFoot(stageState, sector, occupiedPackFeet, soloFeet, enemySize);
      soloFeet.push(foot);
      const scaledSolo = scaleContinuousCombatRow(soloRow, findPackScale([soloRow], soloTargetCP));
      scaledSolo.HP = Math.max(1, Math.ceil(scaledSolo.HP * 0.5));
      scaledSolo.maxHP = scaledSolo.HP;
      scaledSolo.CombatPower = computeCombatPower(scaledSolo);
      remainingEntries.push({
        row: scaledSolo,
        lane: 0,
        rank: Number(remainingEntries[0].rank || 0) + 1,
        packIndex: Number(remainingEntries[0].packIndex || 0),
        entryOrder: 0,
        sectorIndex: sector,
        isSolo: true,
        soloFootX: foot.x,
        soloFootY: foot.y,
      });
    }
  }
  const sectorSizes = new Map();
  const sectorOrders = new Map();
  for (const entry of remainingEntries) if (!entry.isSolo) sectorSizes.set(entry.sectorIndex, (sectorSizes.get(entry.sectorIndex) || 0) + 1);
  return remainingEntries.map((entry, index) => {
    const entryOrder = entry.isSolo ? 0 : (sectorOrders.get(entry.sectorIndex) || 0);
    if (!entry.isSolo) sectorOrders.set(entry.sectorIndex, entryOrder + 1);
    return {
      ...entry,
      slotIndex: Number(slotBase || 0) + index,
      entryOrder,
      sectorSize: entry.isSolo ? 1 : sectorSizes.get(entry.sectorIndex),
    };
  }).filter(entry => Number.isInteger(entry.slotIndex));
}

function spawnContinuousCombatStage({ globals, entities, call, state }) {
  const slotBase = 0;
  const plan = buildContinuousCombatSpawnPlan(globals.EnemyData, state, { slotBase, partyCP: getContinuousCombatPartyCP(entities), enemySize: Number(globals.EnemySize || 40) });
  if (!plan.length) return false;
  const spawnedPackMask = plan.reduce((mask, entry) => mask | (1 << entry.sectorIndex), 0);
  globals.ContinuousCombatStage = {
    ...state,
    spawnedPackMask,
    nextEmissionAt: Number(globals.time || 0) + CONTINUOUS_COMBAT_PACK_INTERVAL_SEC,
    awaitingPackArrival: false,
    lastUpdatedAt: Number(globals.time || 0),
    spawnSerial: plan.length,
    bossUID: null,
  };
  for (const entry of plan) {
    const stage = getContinuousCombatStage(state);
    const enemy = call('SpawnEnemy', { ...entry.row, enemyRole: stage?.kind === 'boss' ? 'boss' : String(entry.row.enemyRole || entry.row.role || 'fodder') }, entry.slotIndex);
    const livingHeroes = entities.filter(actor => actor?.kind === 'hero' && Number(actor.hp || 0) > 0);
    const bossX = Number.isFinite(state.bossWorldX)
      ? Number(state.bossWorldX)
      : livingHeroes.length ? livingHeroes.reduce((sum, hero) => sum + Number(hero.footX ?? hero.x ?? 0), 0) / livingHeroes.length + 260 : BOSS_HOME.x;
    activateContinuousCombatSpawnedEnemy(globals, enemy, { ...entry, bossX, entryOrder: entry.entryOrder });
    if (stage?.kind === 'boss' && Number.isSafeInteger(enemy?.uid) && enemy.uid > 0) globals.ContinuousCombatStage.bossUID = enemy.uid;
  }
  call('UpdateEnemyHPUI');
  return true;
}

function presentationIsClear(globals, presentationBarrier) {
  const lanes = presentationBarrier?.lanes || {};
  const enemyActionActive = Object.values(globals.RealtimeEnemyActionsByUID || {}).some(action => action?.active);
  return !Object.entries(lanes).some(([name, active]) => !['levelUpSettlement', 'flowOrbs'].includes(name) && active)
    && !globals.ActionInProgress
    && !enemyActionActive
    && !(Array.isArray(globals.PendingHeroHits) && globals.PendingHeroHits.length)
    && Object.keys(globals.EnemyDeathVisualHoldByUID || {}).length === 0;
}

export function isContinuousCombatWaveCleared({ entities = [], pendingDeaths = {}, presentationClear = false } = {}) {
  const livingEnemy = entities.some(entity => entity?.kind === 'enemy' && Number(entity.hp || 0) > 0);
  return !!presentationClear && !livingEnemy && Object.keys(pendingDeaths || {}).length === 0;
}

function updateApproachingEnemies(globals, entities, now) {
  const state = globals.ContinuousCombatStage;
  const prior = Number(state?.lastUpdatedAt || now);
  const dt = Math.max(0, Math.min(0.1, now - prior));
  if (state) state.lastUpdatedAt = now;
  let becameAvailable = 0;
  const hasLivingHeroes = (entities || []).some(actor => actor?.kind === 'hero' && Number(actor.hp || 0) > 0);
  for (const enemy of entities || []) {
    if (enemy?.kind !== 'enemy' || Number(enemy.hp || 0) <= 0 || !['approaching', 'retreating'].includes(enemy.streamState)
      && (hasLivingHeroes || !['in_range', 'engaged'].includes(enemy.streamState))) continue;
    if (now < Number(enemy.streamStartAt || 0)) continue;
    const geometry = streamGeometry(globals, {
      packIndex: Number(enemy.streamPackIndex || 0),
      rank: Number(enemy.streamRank || 0),
      order: Number(enemy.streamEntryOrder ?? enemy.streamLane ?? 0),
      sectorIndex: Number(enemy.streamSectorIndex || 0) % CONTINUOUS_COMBAT_PACKS_PER_WAVE,
    });
    const action = globals.RealtimeEnemyActionsByUID?.[String(enemy.uid)]
      ?? globals.RealtimeEnemyActionsByUID?.[enemy.uid];
    const pendingDisplacement = enemy.streamPendingDisplacement || { x: Number(enemy.streamPendingDisplacementDelta || 0), y: 0 };
    if (action?.active) {
      if (pendingDisplacement.x || pendingDisplacement.y) {
        enemy.originX = Number(enemy.originX ?? enemy.streamEngageX ?? enemy.x) + Number(pendingDisplacement.x || 0);
        enemy.originY = Number(enemy.originY ?? enemy.y ?? 0) + Number(pendingDisplacement.y || 0);
        if (action.forwardX != null && Number.isFinite(Number(action.forwardX))) action.forwardX = Number(action.forwardX) + Number(pendingDisplacement.x || 0);
        if (action.anticipationX != null && Number.isFinite(Number(action.anticipationX))) action.anticipationX = Number(action.anticipationX) + Number(pendingDisplacement.x || 0);
        writeEnemyFoot(enemy, { x: enemy.originX, y: enemy.originY });
        delete enemy.streamPendingDisplacement;
        delete enemy.streamPendingDisplacementDelta;
      }
      continue;
    }
    if (pendingDisplacement.x || pendingDisplacement.y) { delete enemy.streamPendingDisplacement; delete enemy.streamPendingDisplacementDelta; }
    if (enemy.streamState === 'retreating') {
      const retreatStart = Number(enemy.streamRetreatStartedAt ?? now);
      const retreatRemaining = Math.max(0, Number(enemy.streamRetreatRemaining || 0));
      const retreatAnchor = enemy.streamRetreatAnchor || enemyFoot(enemy);
      const retreatDirection = enemy.streamRetreatDirection || { x: 1, y: 0 };
      const currentFoot = enemyFoot(enemy);
      const availableDt = Math.max(0, Math.min(dt, now - retreatStart));
      const retreatDuration = Math.min(availableDt, retreatRemaining);
      const retreatFoot = boundedEnemyFoot({ x: currentFoot.x + retreatDirection.x * Number(enemy.streamWalkSpeed || 40) * retreatDuration, y: currentFoot.y + retreatDirection.y * Number(enemy.streamWalkSpeed || 40) * retreatDuration }, true, enemy);
      writeEnemyFoot(enemy, retreatFoot);
      enemy.streamRetreatRemaining = Math.max(0, retreatRemaining - retreatDuration);
      if (enemy.streamRetreatRemaining > 1e-9) continue;
      const returnDuration = Math.max(0, availableDt - retreatDuration);
      const dx = retreatAnchor.x - retreatFoot.x, dy = retreatAnchor.y - retreatFoot.y, returnLength = Math.hypot(dx, dy);
      const returnStep = Math.min(returnLength, Number(enemy.streamWalkSpeed || 40) * returnDuration);
      const returnFoot = returnLength > 0.001 ? { x: retreatFoot.x + dx / returnLength * returnStep, y: retreatFoot.y + dy / returnLength * returnStep } : retreatAnchor;
      writeEnemyFoot(enemy, returnFoot);
      delete enemy.streamRetreatStartedAt;
      delete enemy.streamRetreatRemaining;
      delete enemy.streamRetreatAnchor;
      delete enemy.streamRetreatDirection;
      enemy.streamState = Math.hypot(returnFoot.x - retreatAnchor.x, returnFoot.y - retreatAnchor.y) <= 1e-9 ? 'engaged' : 'in_range';
      if (enemy.streamState === 'engaged') becameAvailable += 1;
      continue;
    }
    if (!hasLivingHeroes) {
      const engageX = Number(enemy.streamEngageX || enemy.originX || enemy.x || 0);
      enemy.streamEngageX = engageX;
      enemy.originX = engageX;
      enemy.x = Math.max(engageX, Number(enemy.x || 0) - Number(enemy.streamWalkSpeed || 40) * dt);
      enemy.y = Number(enemy.originY ?? enemy.y ?? 0);
      if (enemy.streamState === 'approaching' && enemy.x <= geometry.bounds.attackStartX) {
        enemy.streamState = 'in_range';
        becameAvailable += 1;
      }
      if (enemy.x > engageX) continue;
      enemy.x = engageX;
      enemy.originX = engageX;
      enemy.streamState = 'engaged';
      becameAvailable += 1;
      continue;
    }
    const entryBoundary = Number(geometry.bounds.attackStartX);
    enemy.x = Math.max(entryBoundary, Number(enemy.x || 0) - Number(enemy.streamWalkSpeed || 40) * dt);
    enemy.footX = enemy.x;
    enemy.footY = Number(enemy.originY ?? enemy.y ?? 0);
    enemy.y = Number(enemy.originY ?? enemy.y ?? 0);
    if (enemy.streamState === 'approaching' && enemy.x <= entryBoundary) {
      enemy.streamState = 'in_range';
      becameAvailable += 1;
    }
  }
  return becameAvailable;
}

export function maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier, call, runCombatStep } = {}) {
  if (!globals || Number(globals.ContinuousCombatStageLoop || 0) !== 1) return false;
  if (globals.DevToolingPaused || globals.QaScenarioPaused || globals.QaFixtureHoldTurn) return false;
  const stageState = globals.ContinuousCombatStage;
  if (!stageState) return false;
  if (recordContinuousCombatWavePackProgress(stageState, entities)) globals.HeroProgressDirty = true;
  if (!stageState.bossActive && (entities || []).some(actor => actor?.kind === 'hero' && Number(actor.hp || 0) <= 0)) return false;
  if (stageState.bossActive && Number(stageState.bossTransitionEndsAtMs || 0) > Date.now()) return false;
  if ((entities || []).some(actor => actor?.kind === 'hero' && isActorRecoveryRevealActive(actor, globals.time || 0))) return false;
  if (stageState.bossAvailable && !stageState.bossActive && !stageState.bossSummonRequired
    && Number(globals.time || 0) >= Number(stageState.nextEmissionAt || 0) && globals.GamePhase === 'RUNTIME' && !globals.BattleStartActive) {
    return armContinuousCombatBoss(globals, entities, call);
  }
  const now = Number(globals.time || 0);
  const newlyAvailable = updateApproachingEnemies(globals, entities, now);
  const newlyEngaged = advanceContinuousCombatArena({ globals, entities, seconds: Math.max(0, Math.min(0.1, now - Number(stageState.lastArenaUpdatedAt ?? now))) });
  stageState.lastArenaUpdatedAt = now;
  if (globals.GamePhase === 'RUNTIME' && !globals.BattleStartActive) call('TickRealtimeHeroBasics');
  if ((newlyAvailable > 0 || newlyEngaged > 0 || entities?.some(enemy => enemy?.kind === 'enemy' && Number(enemy.hp || 0) > 0 && enemy.streamState === 'engaged'))
    && globals.GamePhase === 'RUNTIME' && !globals.BattleStartActive) {
    globals.NativeBattleEnded = false;
    call('TickRealtimeEnemyActions');
  }
  if (!stageState.bossActive && (entities || []).some(actor => actor?.kind === 'hero' && Number(actor.hp || 0) <= 0)) return false;
  if (globals.GamePhase !== 'RUNTIME' || globals.BattleStartActive) return false;

  const current = getContinuousCombatStage(stageState);
  const clear = isContinuousCombatWaveCleared({
    enemySlots: globals.EnemySlots,
    entities,
    pendingDeaths: globals.EnemyDeathVisualHoldByUID || globals.PendingDeaths,
    presentationClear: presentationIsClear(globals, presentationBarrier),
  });
  const timerReady = now >= Number(stageState.nextEmissionAt || 0);
  let transition = null;

  if (stageState.bossActive) {
    if (!clear) return false;
    call('SettleContinuousCombatRewards');
    transition = advanceContinuousCombatStage(stageState);
  } else if (Number(stageState.wave || 1) >= CONTINUOUS_COMBAT_WAVES_PER_STAGE) {
    if (!clear || !timerReady) return false;
    transition = advanceContinuousCombatStage(stageState);
  } else {
    if (!clear || !timerReady) return false;
    transition = advanceContinuousCombatStage(stageState);
  }

  const enteringBoss = !!transition?.state?.bossAvailable && !stageState.bossAvailable && !stageState.bossSummonRequired;
  if (!transition?.stage) return false;
  if (enteringBoss) {
    globals.ContinuousCombatStage = transition.state;
    if (!armContinuousCombatBoss(globals, entities, call)) return false;
    transition = { ...transition, stage: getContinuousCombatStage(globals.ContinuousCombatStage) };
  } else if (!spawnContinuousCombatStage({ globals, entities, call, state: transition.state })) return false;
  if (transition.clearedBoss) {
    resetRealtimeSkillAttempt(globals,entities);
    const heroes = entities.filter(actor => actor?.kind === 'hero');
    const revivedKoHero = heroes.some(hero => Number(hero.hp || 0) <= 0);
    for (const hero of heroes) {
      hero.hp = Number(hero.maxHP || 0);
      hero.isAlive = hero.hp > 0;
      if (!revivedKoHero) resetActorPresentationAfterRestore(hero, now);
      cleanseDebuffs(hero);
      if (globals.HeroProgress) saveHeroProgress(hero, globals.HeroProgress);
    }
    if (revivedKoHero) placeContinuousCombatHeroesInRecoveryHuddle({ globals, heroes, now });
    if (globals.HeroProgress) globals.HeroProgressDirty = true;
    call('UpdateHeroHPUI');
  }
  globals.ContinuousCombatStageLastTransition = { from: current?.id || '', to: transition.stage.id, at: now };
  globals.NativeBattleEnded = false;
  return true;
}

export function continuousCombatWaveClearEventId(stageState) {
  if (!stageState) return '';
  const transitions = Math.max(0, Math.floor(Number(stageState.transitions) || 0));
  return `clear:${stageState.region}-${stageState.stage}-${transitions}-${stageState.wave}-${stageState.bossActive ? 'boss' : 'wave'}`;
}
