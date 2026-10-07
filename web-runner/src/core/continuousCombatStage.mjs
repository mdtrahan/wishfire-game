import { resetRealtimeSkillAttempt } from './realtimeSkillState.mjs';
import { computeCombatPower } from './combatPower.mjs';
import { deriveCombatArenaBounds, deriveCombatFormationAnchors, deriveCombatWorldBounds } from '../../../src/core/combatOrientation.mjs';
import { cleanseDebuffs } from './combatRules.mjs';
import { saveHeroProgress } from './heroProgression.mjs';
import { advanceContinuousCombatArena } from './arenaCombat.mjs';
import { resetActorPresentationAfterRestore } from './actorPresentationState.mjs';
import { actorFootPoint, actorFootprintRadius } from '../../../src/core/arenaCombatRules.mjs';

export const CONTINUOUS_COMBAT_PACK_INTERVAL_SEC = 3;
export const CONTINUOUS_COMBAT_PACK_CP_STEP = 0.06;
export const CONTINUOUS_COMBAT_WAVES_PER_STAGE = 4;
export const CONTINUOUS_COMBAT_STAGES_PER_REGION = 10;
export const CONTINUOUS_COMBAT_PACKS_PER_WAVE = 6;
export const CONTINUOUS_COMBAT_ENEMIES_PER_WAVE_MAX = CONTINUOUS_COMBAT_PACKS_PER_WAVE * 3;
export const CONTINUOUS_COMBAT_SECTOR_RATIOS = Object.freeze([0.12, 0.27, 0.42, 0.57, 0.72, 0.87]);
export const CONTINUOUS_COMBAT_BOSS_ENTRY_WIPE_MS = 440;

function regroupKnockedOutHeroes(heroes) {
  const living = heroes.filter(hero => Number(hero.hp || 0) > 0);
  const knockedOut = heroes.filter(hero => Number(hero.hp || 0) <= 0);
  if (!living.length || !knockedOut.length) return;

  const world = deriveCombatWorldBounds();
  const arena = deriveCombatArenaBounds();
  const center = living.reduce((sum, hero) => {
    const point = actorFootPoint(hero);
    return { x: sum.x + point.x / living.length, y: sum.y + point.y / living.length };
  }, { x: 0, y: 0 });
  const placed = living.slice();
  const angles = Array.from({ length: 16 }, (_, index) => (index / 16) * Math.PI * 2);
  for (const hero of knockedOut) {
    let position = null;
    for (const radius of [40, 52, 64, 76, 88, 100]) {
      for (const angle of angles) {
        const candidate = {
          x: Math.max(world.heroMinX, Math.min(world.heroMaxX, center.x + Math.cos(angle) * radius)),
          y: Math.max(arena.visibleTopY, Math.min(arena.visibleBottomY, center.y + Math.sin(angle) * radius)),
        };
        const separated = placed.every(other => {
          const point = actorFootPoint(other);
          return Math.hypot(candidate.x - point.x, candidate.y - point.y)
            >= actorFootprintRadius(hero) + actorFootprintRadius(other) + 4;
        });
        if (separated) { position = candidate; break; }
      }
      if (position) break;
    }
    if (!position) continue;
    hero.footX = hero.x = position.x;
    hero.footY = hero.y = position.y;
    placed.push(hero);
  }
}

// Four normal packs form one repeatable stage. The boss is a gate rather than
// a fifth timed pack.
export const CONTINUOUS_COMBAT_STAGES = Object.freeze([
  Object.freeze({ wave: 1, kind: 'fodder', enemyNames: Object.freeze(['Gobloc', 'Skeleton']) }),
  Object.freeze({ wave: 2, kind: 'fodder', enemyNames: Object.freeze(['Gobloc', 'High Gobloc', 'Skeleton', 'Lizardo']) }),
  Object.freeze({ wave: 3, kind: 'fodder', enemyNames: Object.freeze(['High Orc', 'Chimerilass', 'Djinn']) }),
  Object.freeze({ wave: 4, kind: 'fodder', enemyNames: Object.freeze(['Orc', 'High Orc', 'Chimerilass', 'Djinn']) }),
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
    bossAvailable: false,
    bossArmed: false,
    bossActive: false,
    bossWorldX: null,
    transitions: 0,
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
  globals.ContinuousCombatStage = { ...createContinuousCombatStageState(globals.EncounterSeed || 1, checkpoint), ...checkpoint };
  return true;
}

function streamGeometry(globals, { packIndex = 0, rank = 0, order = 0 } = {}) {
  const bounds = deriveCombatArenaBounds();
  const enemySize = Math.max(20, Number(globals.EnemySize || 40));
  const firstY = bounds.visibleTopY + enemySize / 2;
  const lastY = bounds.visibleBottomY - enemySize / 2;
  const stateSeed = Number(globals.ContinuousCombatStage?.seed || globals.EncounterSeed || 1) >>> 0;
  const sequenceIndex = Math.max(Number(rank) * 3, Number(packIndex) * 3) + Number(order) + 1;
  const heroYs = deriveCombatFormationAnchors({ globals, heroCount: 4 }).heroYs;
  const laneIndex = (Math.floor(stateSeed % 4) + sequenceIndex) % 4;
  return {
    spawnX: 360 + enemySize * 1.5,
    y: heroYs[laneIndex] ?? (firstY + lastY) / 2,
    walkSpeed: Math.max(34, enemySize * 0.9) * 0.7,
    enemySize,
    bounds,
  };
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
    const bounds = deriveCombatArenaBounds();
    return { x: Math.max(world.heroMinX, Math.min(world.heroMaxX, point.x)), y: clampY ? Math.max(bounds.visibleTopY, Math.min(bounds.visibleBottomY, point.y)) : point.y };
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

export function activateContinuousCombatSpawnedEnemy(globals, enemy, { lane = 1, rank = 0, packIndex = 0, entryOrder = lane, sectorIndex = null, bossX = BOSS_HOME.x } = {}) {
  if (!enemy) return null;
  const order = Math.max(0, Math.floor(Number(entryOrder || 0))) % 3;
  const geometry = streamGeometry(globals, { packIndex, rank, order });
  const delivery = RANGED_ENEMY_NAMES.has(String(enemy.name || '').trim().toLowerCase()) ? 'ranged' : 'melee';
  const meleeLine = order % 2;
  const normalizedPackIndex = Math.max(0, Number(packIndex || 0));
  const boss = String(enemy.enemyRole || enemy.role || '').toLowerCase() === 'boss';
  const world = deriveCombatWorldBounds();
  const sector = sectorIndex == null
    ? Math.max(0, Math.min(CONTINUOUS_COMBAT_PACKS_PER_WAVE - 1, Number(packIndex || 0) % CONTINUOUS_COMBAT_PACKS_PER_WAVE))
    : Math.max(0, Math.min(CONTINUOUS_COMBAT_PACKS_PER_WAVE - 1, Math.floor(Number(sectorIndex) || 0)));
  const sectorX = world.worldWidth * CONTINUOUS_COMBAT_SECTOR_RATIOS[sector] + (order - 1) * geometry.enemySize * 1.25;
  const engageX = boss ? bossX : sectorX;
  const homeY = boss ? BOSS_HOME.y : geometry.y;
  Object.assign(enemy, {
    combatRank: ['boss','subboss'].includes(String(enemy.enemyRole || enemy.role || '').toLowerCase()) ? String(enemy.enemyRole || enemy.role).toLowerCase() : 'ordinary',
    streamState: 'roaming', streamLane: lane, streamRank: rank, streamPackIndex: packIndex, streamSectorIndex: sector + Number(packIndex || 0) * CONTINUOUS_COMBAT_PACKS_PER_WAVE, streamEntryOrder: order,
    streamDelivery: delivery, streamMeleeLine: meleeLine,
    actionState: 'spawn', actionFacing: 'left', actionStateStartedAt: Number(globals.time || 0), actionStateUntil: Number(globals.time || 0) + 0.35,
    streamEngageX: engageX, streamWalkSpeed: geometry.walkSpeed * PACK_WALK_SPEED_SCALE[order],
    streamStartAt: Number(globals.time || 0),
    x: engageX, y: homeY, originX: engageX, originY: homeY,
    footX: engageX, footY: homeY, facing: 'left', locomotion: 'idle', arenaEnabled: true,
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
  const packSize = Math.max(1, Math.ceil(productionEnemies.length / CONTINUOUS_COMBAT_PACKS_PER_WAVE));
  let enemyOrder = 0;
  for (const actor of Array.isArray(entities) ? entities : []) {
    if (actor?.kind === 'hero') {
      actor.flow = 0;
      actor.flowReady = false;
    } else if (actor?.kind === 'enemy') {
      const sectorIndex = Math.min(CONTINUOUS_COMBAT_PACKS_PER_WAVE - 1, Math.floor(enemyOrder / packSize));
      const entryOrder = enemyOrder % packSize;
      activateContinuousCombatSpawnedEnemy(globals, actor, { lane: Number(actor.slotIndex ?? 1), rank: 0, packIndex: 0, entryOrder, sectorIndex });
      enemyOrder += 1;
    }
  }
  if (globals.ContinuousCombatStage) {
    globals.ContinuousCombatStage.nextEmissionAt = now + CONTINUOUS_COMBAT_PACK_INTERVAL_SEC;
    globals.ContinuousCombatStage.awaitingPackArrival = false;
    globals.ContinuousCombatStage.lastUpdatedAt = now;
    globals.ContinuousCombatStage.spawnSerial = (entities || []).filter(actor => actor?.kind === 'enemy').length;
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
      bossAvailable: false,
      bossArmed: false,
      bossActive: false,
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
  const state = currentWave >= CONTINUOUS_COMBAT_WAVES_PER_STAGE
    ? { ...stageState, wave: 1, bossAvailable: true, transitions }
    : { ...stageState, wave: currentWave + 1, transitions };
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

export function resetContinuousCombatAfterDefeat(globals) {
  const state = globals?.ContinuousCombatStage;
  if (!state) return false;
  globals.ContinuousCombatStage = {
    ...state,
    wave: 1,
    bossAvailable: !!state.bossAvailable || !!state.bossActive,
    bossArmed: false,
    bossActive: false,
    bossCameraCenterX: null,
    bossWorldX: null,
    bossTransitionStartedAtMs: null,
    bossTransitionEndsAtMs: null,
    transitions: Number(state.transitions || 0) + 1,
    nextEmissionAt: Number(globals.time || 0) + CONTINUOUS_COMBAT_PACK_INTERVAL_SEC,
    awaitingPackArrival: false,
    lastUpdatedAt: Number(globals.time || 0),
  };
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

function expandWaveRows(stage, byName, catalogRows) {
  const pool = stage.enemyNames.map(name => byName.get(name)).filter(Boolean);
  if (stage.kind === 'boss' || !pool.length) return pool;
  const bossNames = new Set(CONTINUOUS_COMBAT_STAGES.filter(candidate => candidate.kind === 'boss').flatMap(candidate => candidate.enemyNames));
  const catalogCP = catalogRows.filter(row => String(row?.combatTier || '').toLowerCase() !== 'boss' && !bossNames.has(String(row?.name || row?.EnemyName || ''))).map(computeCombatPower);
  const minCP = Math.min(...catalogCP);
  const maxCP = Math.max(...catalogCP);
  const averageCP = pool.reduce((sum, row) => sum + computeCombatPower(row), 0) / pool.length;
  const strength = maxCP > minCP ? (averageCP - minCP) / (maxCP - minCP) : 0.5;
  const packSize = strength <= 0.2 ? 3 : 2;
  return Array.from({ length: packSize * CONTINUOUS_COMBAT_PACKS_PER_WAVE }, (_, index) => pool[index % pool.length]);
}

export function buildContinuousCombatSpawnPlan(enemyRows, stageState, { slotBase = 0 } = {}) {
  const stage = getContinuousCombatStage(stageState);
  const rows = Array.isArray(enemyRows) ? enemyRows : [];
  if (!stage || !rows.length) return [];
  const byName = new Map(rows.map(row => [String(row?.name || row?.EnemyName || '').trim(), row]));
  const selectedRows = expandWaveRows(stage, byName, rows);
  const baselineRows = expandWaveRows(CONTINUOUS_COMBAT_STAGES[0], byName, rows);
  const totalCP = entries => entries.reduce((sum, row) => sum + computeCombatPower(row), 0);
  const stageOrdinal = (Math.max(1, Number(stage.region || 1)) - 1) * CONTINUOUS_COMBAT_STAGES_PER_REGION
    + Math.max(0, Number(stage.stage || 1) - 1);
  const waveStep = stage.kind === 'boss' ? CONTINUOUS_COMBAT_WAVES_PER_STAGE - 1 : Math.max(0, Number(stage.wave || 1) - 1);
  const progressionScale = 1 + stageOrdinal * 0.08 + waveStep * 0.04;
  const linearTarget = totalCP(baselineRows) * progressionScale * (stage.kind === 'boss' ? 1.35 : 1);
  const packScale = selectedRows.length ? findPackScale(selectedRows, linearTarget) : 1;
  const packSize = stage.kind === 'boss' ? 1 : selectedRows.length / CONTINUOUS_COMBAT_PACKS_PER_WAVE;
  return selectedRows.map((row, index) => ({
    row: scaleContinuousCombatRow(row, packScale),
    slotIndex: Number(slotBase || 0) + index,
    lane: index % packSize,
    rank: Math.floor(Number(slotBase || 0) / CONTINUOUS_COMBAT_PACKS_PER_WAVE),
    packIndex: Number(stageState?.transitions || 0),
    entryOrder: index % packSize,
    sectorIndex: stage.kind === 'boss' ? 1 : Math.floor(index / packSize),
  })).filter(entry => entry.row?.name && Number.isInteger(entry.slotIndex));
}

function spawnContinuousCombatStage({ globals, entities, call, state }) {
  const slotBase = 0;
  const plan = buildContinuousCombatSpawnPlan(globals.EnemyData, state, { slotBase });
  if (!plan.length) return false;
  globals.ContinuousCombatStage = {
    ...state,
    nextEmissionAt: Number(globals.time || 0) + CONTINUOUS_COMBAT_PACK_INTERVAL_SEC,
    awaitingPackArrival: false,
    lastUpdatedAt: Number(globals.time || 0),
    spawnSerial: plan.length,
  };
  for (const entry of plan) {
    const stage = getContinuousCombatStage(state);
    const enemy = call('SpawnEnemy', { ...entry.row, enemyRole: stage?.kind === 'boss' ? 'boss' : String(entry.row.enemyRole || entry.row.role || 'fodder') }, entry.slotIndex);
    const livingHeroes = entities.filter(actor => actor?.kind === 'hero' && Number(actor.hp || 0) > 0);
    const bossX = Number.isFinite(state.bossWorldX)
      ? Number(state.bossWorldX)
      : livingHeroes.length ? livingHeroes.reduce((sum, hero) => sum + Number(hero.footX ?? hero.x ?? 0), 0) / livingHeroes.length + 260 : BOSS_HOME.x;
    activateContinuousCombatSpawnedEnemy(globals, enemy, { ...entry, bossX, entryOrder: entry.entryOrder });
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
  if (stageState.bossActive && Number(stageState.bossTransitionEndsAtMs || 0) > Date.now()) return false;
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
    call('SettleContinuousCombatRewards');
    transition = advanceContinuousCombatStage(stageState);
  } else {
    if (!clear || !timerReady) return false;
    transition = advanceContinuousCombatStage(stageState);
  }

  if (!transition?.stage || !spawnContinuousCombatStage({ globals, entities, call, state: transition.state })) return false;
  if (transition.clearedBoss) {
    resetRealtimeSkillAttempt(globals,entities);
    const heroes = entities.filter(actor => actor?.kind === 'hero');
    regroupKnockedOutHeroes(heroes);
    for (const hero of heroes) {
      hero.hp = Number(hero.maxHP || 0);
      hero.isAlive = hero.hp > 0;
      resetActorPresentationAfterRestore(hero, now);
      cleanseDebuffs(hero);
      if (globals.HeroProgress) saveHeroProgress(hero, globals.HeroProgress);
    }
    if (globals.HeroProgress) globals.HeroProgressDirty = true;
    call('UpdateHeroHPUI');
  }
  globals.ContinuousCombatStageLastTransition = { from: current?.id || '', to: transition.stage.id, at: now };
  globals.NativeBattleEnded = false;
  return true;
}
