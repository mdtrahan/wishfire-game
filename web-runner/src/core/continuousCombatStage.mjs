import { computeCombatPower } from './combatPower.mjs';
import { deriveCombatArenaBounds } from '../../../src/core/combatOrientation.mjs';

export const CONTINUOUS_COMBAT_PACK_INTERVAL_SEC = 10;
export const CONTINUOUS_COMBAT_PACK_CP_STEP = 0.06;
export const CONTINUOUS_COMBAT_WAVES_PER_STAGE = 4;
export const CONTINUOUS_COMBAT_STAGES_PER_REGION = 10;

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
    transitions: 0,
    clearedBosses: 0,
    nextEmissionAt: 0,
    lastUpdatedAt: 0,
    spawnSerial: 0,
  };
}

export function configureContinuousCombatProduction(globals, { productionPath = false } = {}) {
  const enabled = !!productionPath;
  globals.ContinuousCombatStageLoop = enabled ? 1 : 0;
  if (!enabled) return false;
  globals.EncounterPolicy = 'fodder_only';
  globals.EncounterMaxSlots = 5;
  globals.ContinuousCombatStageComplete = 0;
  globals.ContinuousCombatStage = createContinuousCombatStageState(globals.EncounterSeed || 1);
  return true;
}

function streamGeometry(globals, { packIndex = 0, rank = 0, order = 0 } = {}) {
  const bounds = deriveCombatArenaBounds();
  const enemySize = Math.max(20, Number(globals.EnemySize || 40));
  const firstY = bounds.visibleTopY + enemySize / 2;
  const lastY = bounds.visibleBottomY - enemySize / 2;
  const stateSeed = Number(globals.ContinuousCombatStage?.seed || globals.EncounterSeed || 1) >>> 0;
  const sequenceIndex = Math.max(Number(rank) * 3, Number(packIndex) * 3) + Number(order) + 1;
  const yFraction = ((stateSeed * 0.61803398875) + (sequenceIndex * 0.38196601125)) % 1;
  return {
    spawnX: 360 + enemySize * 1.5,
    y: firstY + yFraction * (lastY - firstY),
    walkSpeed: Math.max(34, enemySize * 0.9),
    enemySize,
    bounds,
  };
}

const PACK_ENTRY_DELAY_SEC = Object.freeze([0, 0.4, 0.92, 1.48, 2.12]);
const PACK_WALK_SPEED_SCALE = Object.freeze([1, 0.9, 1.12, 0.82, 1.17]);
const RANGED_ENEMY_NAMES = new Set(['marid', 'djinn', 'chimerilass']);
const BOSS_HOME = Object.freeze({ x: 290, y: 290 });

function rangedHomeX(bounds, packIndex, order) {
  const slot = (packIndex * 3 + order) % 5;
  return bounds.rangedMinX + (slot + 1) * ((bounds.rangedMaxX - bounds.rangedMinX) / 6);
}

export function activateContinuousCombatSpawnedEnemy(globals, enemy, { lane = 1, rank = 0, packIndex = 0, entryOrder = lane } = {}) {
  if (!enemy) return null;
  const order = Math.max(0, Math.floor(Number(entryOrder || 0))) % PACK_ENTRY_DELAY_SEC.length;
  const geometry = streamGeometry(globals, { packIndex, rank, order });
  const delivery = RANGED_ENEMY_NAMES.has(String(enemy.name || '').trim().toLowerCase()) ? 'ranged' : 'melee';
  const meleeLine = order % 2;
  const normalizedPackIndex = Math.max(0, Number(packIndex || 0));
  const boss = String(enemy.enemyRole || enemy.role || '').toLowerCase() === 'boss';
  const engageX = boss ? BOSS_HOME.x : delivery === 'melee'
    ? geometry.bounds.meleeLeftEdgeX
    : rangedHomeX(geometry.bounds, normalizedPackIndex, order);
  const homeY = boss ? BOSS_HOME.y : geometry.y;
  Object.assign(enemy, {
    streamState: 'approaching', streamLane: lane, streamRank: rank, streamPackIndex: packIndex, streamEntryOrder: order,
    streamDelivery: delivery, streamMeleeLine: meleeLine,
    streamEngageX: engageX, streamWalkSpeed: geometry.walkSpeed * PACK_WALK_SPEED_SCALE[order],
    streamStartAt: Number(globals.time || 0) + PACK_ENTRY_DELAY_SEC[order],
    x: geometry.spawnX, y: homeY, originX: engageX, originY: homeY,
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
  let enemyOrder = 0;
  for (const actor of Array.isArray(entities) ? entities : []) {
    if (actor?.kind === 'hero') {
      actor.flow = 0;
      actor.flowReady = false;
    } else if (actor?.kind === 'enemy') {
      activateContinuousCombatSpawnedEnemy(globals, actor, { lane: Number(actor.slotIndex ?? 1), rank: 0, packIndex: 0, entryOrder: enemyOrder++ });
    }
  }
  if (globals.ContinuousCombatStage) {
    globals.ContinuousCombatStage.nextEmissionAt = now + CONTINUOUS_COMBAT_PACK_INTERVAL_SEC;
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
      bossActive: false,
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

export function armContinuousCombatBoss(globals) {
  const state = globals?.ContinuousCombatStage;
  if (!state || !state.bossAvailable || state.bossActive) return false;
  state.bossArmed = true;
  return true;
}

export function resetContinuousCombatAfterDefeat(globals) {
  const state = globals?.ContinuousCombatStage;
  if (!state) return false;
  globals.ContinuousCombatStage = {
    ...state,
    wave: 1,
    bossAvailable: false,
    bossArmed: false,
    bossActive: false,
    transitions: Number(state.transitions || 0) + 1,
    nextEmissionAt: Number(globals.time || 0) + CONTINUOUS_COMBAT_PACK_INTERVAL_SEC,
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
  const size = strength <= 0.2 ? 5 : strength >= 0.6 ? 3 : 4;
  return Array.from({ length: size }, (_, index) => pool[index % pool.length]);
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
  const lanes = selectedRows.length === 1 ? [1] : [1, 0, 2, 0, 2];
  return selectedRows.map((row, index) => ({
    row: scaleContinuousCombatRow(row, packScale),
    slotIndex: Number(slotBase || 0) + index,
    lane: lanes[index] ?? 1,
    rank: Math.floor(Number(slotBase || 0) / 3),
    packIndex: Number(stageState?.transitions || 0),
    entryOrder: index,
  })).filter(entry => entry.row?.name && Number.isInteger(entry.slotIndex));
}

function restoreContinuousCombatHeroes(globals, entities, call) {
  for (const hero of Array.isArray(entities) ? entities : []) {
    if (hero?.kind !== 'hero') continue;
    hero.hp = Number(hero.maxHP || hero.hp || 1);
    hero.isAlive = true;
    if (globals.PendingDeaths) delete globals.PendingDeaths[hero.uid];
  }
  call('UpdateHeroHPUI');
}

function spawnContinuousCombatStage({ globals, entities, call, state }) {
  const slotBase = Number(state.spawnSerial || 0);
  const plan = buildContinuousCombatSpawnPlan(globals.EnemyData, state, { slotBase });
  if (!plan.length) return false;
  globals.ContinuousCombatStage = {
    ...state,
    nextEmissionAt: Number(globals.time || 0) + CONTINUOUS_COMBAT_PACK_INTERVAL_SEC,
    lastUpdatedAt: Number(globals.time || 0),
    spawnSerial: slotBase + plan.length,
  };
  for (const entry of plan) {
    const stage = getContinuousCombatStage(state);
    const enemy = call('SpawnEnemy', { ...entry.row, enemyRole: stage?.kind === 'boss' ? 'boss' : String(entry.row.enemyRole || entry.row.role || 'fodder') }, entry.slotIndex);
    activateContinuousCombatSpawnedEnemy(globals, enemy, entry);
  }
  call('UpdateEnemyHPUI');
  return true;
}

function presentationIsClear(globals, presentationBarrier) {
  const lanes = presentationBarrier?.lanes || {};
  return !Object.entries(lanes).some(([name, active]) => !['levelUpSettlement', 'flowOrbs'].includes(name) && active)
    && !globals.ActionInProgress
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
  const packsReached = new Set();
  for (const enemy of entities || []) {
    if (enemy?.kind !== 'enemy' || Number(enemy.hp || 0) <= 0 || !['approaching', 'in_range'].includes(enemy.streamState)) continue;
    if (now < Number(enemy.streamStartAt || 0)) continue;
    const geometry = streamGeometry(globals, {
      packIndex: Number(enemy.streamPackIndex || 0),
      rank: Number(enemy.streamRank || 0),
      order: Number(enemy.streamEntryOrder ?? enemy.streamLane ?? 0),
    });
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
    packsReached.add(Number(enemy.streamPackIndex || 0));
    becameAvailable += 1;
  }
  for (const packIndex of packsReached) {
    const packStillApproaching = (entities || []).some(enemy => enemy?.kind === 'enemy'
      && Number(enemy.hp || 0) > 0
      && Number(enemy.streamPackIndex || 0) === packIndex
      && enemy.streamState !== 'engaged');
    if (!packStillApproaching && Number(state?.stageIndex || 0) === packIndex) {
      state.nextEmissionAt = now + CONTINUOUS_COMBAT_PACK_INTERVAL_SEC;
    }
  }
  return becameAvailable;
}

export function maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier, call, runCombatStep } = {}) {
  if (!globals || Number(globals.ContinuousCombatStageLoop || 0) !== 1) return false;
  const stageState = globals.ContinuousCombatStage;
  if (!stageState) return false;
  const now = Number(globals.time || 0);
  const newlyEngaged = updateApproachingEnemies(globals, entities, now);
  if (globals.GamePhase === 'RUNTIME' && !globals.BattleStartActive) call('TickRealtimeHeroBasics');
  if ((newlyEngaged > 0 || entities?.some(enemy => enemy?.kind === 'enemy' && Number(enemy.hp || 0) > 0 && enemy.streamState === 'engaged'))
    && !globals.ActionInProgress && !globals.IsPlayerBusy && !globals.DeferAdvance
    && globals.GamePhase === 'RUNTIME' && !globals.BattleStartActive) {
    globals.NativeBattleEnded = false;
    runCombatStep('ProcessTurn');
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
    restoreContinuousCombatHeroes(globals, entities, call);
  } else if (stageState.bossAvailable && stageState.bossArmed) {
    if (!clear) return false;
    call('SettleContinuousCombatRewards');
    const state = { ...stageState, bossActive: true, transitions: Number(stageState.transitions || 0) + 1 };
    transition = { state, stage: getContinuousCombatStage(state) };
  } else if (Number(stageState.wave || 1) >= CONTINUOUS_COMBAT_WAVES_PER_STAGE) {
    if (!clear) return false;
    call('SettleContinuousCombatRewards');
    transition = advanceContinuousCombatStage(stageState);
    if (transition.state.bossArmed) {
      transition.state = { ...transition.state, bossActive: true };
      transition.stage = getContinuousCombatStage(transition.state);
    } else {
      restoreContinuousCombatHeroes(globals, entities, call);
    }
  } else {
    if (!timerReady) return false;
    transition = advanceContinuousCombatStage(stageState);
  }

  if (!transition?.stage || !spawnContinuousCombatStage({ globals, entities, call, state: transition.state })) return false;
  globals.ContinuousCombatStageLastTransition = { from: current?.id || '', to: transition.stage.id, at: now };
  globals.NativeBattleEnded = false;
  return true;
}
