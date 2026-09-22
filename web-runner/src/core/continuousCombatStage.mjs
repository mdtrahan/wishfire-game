import { computeCombatPower } from './combatPower.mjs';
import { deriveCombatArenaBounds } from '../../../src/core/combatOrientation.mjs';

export const CONTINUOUS_COMBAT_PACK_INTERVAL_SEC = 10;
export const CONTINUOUS_COMBAT_PACK_CP_STEP = 0.06;

// One shallow linear ramp. Timed overlap supplies pressure without stat spikes.
export const CONTINUOUS_COMBAT_STAGES = Object.freeze([
  Object.freeze({ id: '1-1-pack-1', kind: 'fodder', enemyNames: Object.freeze(['Gobloc', 'Skeleton']), cpStep: 0 }),
  Object.freeze({ id: '1-1-pack-2', kind: 'fodder', enemyNames: Object.freeze(['Gobloc', 'High Gobloc', 'Skeleton', 'Lizardo']), cpStep: 1 }),
  Object.freeze({ id: '1-1-pack-3', kind: 'fodder', enemyNames: Object.freeze(['High Orc', 'Chimerilass', 'Djinn']), cpStep: 2 }),
  Object.freeze({ id: '1-1-boss', kind: 'boss', enemyNames: Object.freeze(['Troll']), cpStep: 3, waitForClear: true }),
  Object.freeze({ id: '1-2-pack-1', kind: 'fodder', enemyNames: Object.freeze(['Gobloc', 'High Gobloc', 'Skeleton']), cpStep: 0, waitForClear: true }),
]);

export function createContinuousCombatStageState(seed = 1) {
  const normalizedSeed = Number(seed) >>> 0 || 1;
  return { seed: normalizedSeed, stageIndex: 0, stageId: CONTINUOUS_COMBAT_STAGES[0].id, transitions: 0, cycles: 0, completed: [], nextEmissionAt: 0, lastUpdatedAt: 0, spawnSerial: 0 };
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

function rangedHomeX(bounds, packIndex, order, boss) {
  if (boss) return (bounds.rangedMinX + bounds.rangedMaxX) / 2;
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
  const engageX = delivery === 'melee'
    ? geometry.bounds.meleeLeftEdgeX
    : rangedHomeX(geometry.bounds, normalizedPackIndex, order, boss);
  Object.assign(enemy, {
    streamState: 'approaching', streamLane: lane, streamRank: rank, streamPackIndex: packIndex, streamEntryOrder: order,
    streamDelivery: delivery, streamMeleeLine: meleeLine,
    streamEngageX: engageX, streamWalkSpeed: geometry.walkSpeed * PACK_WALK_SPEED_SCALE[order],
    streamStartAt: Number(globals.time || 0) + PACK_ENTRY_DELAY_SEC[order],
    x: geometry.spawnX, y: geometry.y, originX: engageX, originY: geometry.y,
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
  const index = Math.max(0, Math.min(CONTINUOUS_COMBAT_STAGES.length - 1, Math.floor(Number(stageState?.stageIndex ?? 0))));
  return CONTINUOUS_COMBAT_STAGES[index] || null;
}

export function advanceContinuousCombatStage(stageState) {
  const current = getContinuousCombatStage(stageState);
  const currentIndex = Math.max(0, Math.min(CONTINUOUS_COMBAT_STAGES.length - 1, Math.floor(Number(stageState?.stageIndex ?? 0))));
  const nextIndex = currentIndex + 1;
  const completed = Array.isArray(stageState?.completed) ? [...stageState.completed] : [];
  if (current && !completed.includes(current.id)) completed.push(current.id);
  const wrapped = nextIndex >= CONTINUOUS_COMBAT_STAGES.length;
  const resolvedIndex = wrapped ? 0 : nextIndex;
  const next = CONTINUOUS_COMBAT_STAGES[resolvedIndex];
  return { done: false, stage: next, state: { ...stageState, stageIndex: resolvedIndex, stageId: next.id, transitions: Number(stageState?.transitions || 0) + 1, cycles: Number(stageState?.cycles || 0) + (wrapped ? 1 : 0), completed: wrapped ? [] : completed } };
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
  let high = 2;
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
  const linearTarget = totalCP(baselineRows) * (1 + Math.max(0, Number(stage.cpStep || 0)) * CONTINUOUS_COMBAT_PACK_CP_STEP);
  const packScale = stage.kind === 'boss'
    ? 1 + Number(stage.cpStep || 0) * CONTINUOUS_COMBAT_PACK_CP_STEP
    : Number(stage.cpStep || 0) === 0 ? 1 : findPackScale(selectedRows, linearTarget);
  const lanes = selectedRows.length === 1 ? [1] : [1, 0, 2, 0, 2];
  return selectedRows.map((row, index) => ({
    row: scaleContinuousCombatRow(row, packScale),
    slotIndex: Number(slotBase || 0) + index,
    lane: lanes[index] ?? 1,
    rank: Math.floor(Number(slotBase || 0) / 3),
    packIndex: Number(stageState?.stageIndex || 0),
    entryOrder: index,
  })).filter(entry => entry.row?.name && Number.isInteger(entry.slotIndex));
}

function presentationIsClear(globals, presentationBarrier) {
  const lanes = presentationBarrier?.lanes || {};
  return !Object.entries(lanes).some(([name, active]) => name !== 'levelUpSettlement' && active)
    && !globals.ActionInProgress
    && !(Array.isArray(globals.PendingHeroHits) && globals.PendingHeroHits.length)
    && Object.keys(globals.EnemyDeathVisualHoldByUID || {}).length === 0;
}

export function isContinuousCombatWaveCleared({ enemySlots = [], entities = [], pendingDeaths = {}, presentationClear = false } = {}) {
  const livingEnemy = entities.some(entity => entity?.kind === 'enemy' && Number(entity.hp || 0) > 0);
  const occupiedSlot = (Array.isArray(enemySlots) ? enemySlots : []).some(value => Number(value || 0) > 0);
  return !!presentationClear && !livingEnemy && !occupiedSlot && Object.keys(pendingDeaths || {}).length === 0;
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
  if (newlyEngaged > 0 && !globals.ActionInProgress && !globals.IsPlayerBusy && globals.GamePhase === 'RUNTIME' && !globals.BattleStartActive) {
    globals.NativeBattleEnded = false;
    runCombatStep('ProcessTurn');
  }
  if (globals.GamePhase !== 'RUNTIME' || globals.BattleStartActive) return false;

  const current = getContinuousCombatStage(stageState);
  const transition = advanceContinuousCombatStage(stageState);
  const clear = isContinuousCombatWaveCleared({
    enemySlots: globals.EnemySlots,
    entities,
    pendingDeaths: globals.EnemyDeathVisualHoldByUID || globals.PendingDeaths,
    presentationClear: presentationIsClear(globals, presentationBarrier),
  });
  const timerReady = now >= Number(stageState.nextEmissionAt || 0);
  if (transition.stage.waitForClear ? !clear : !timerReady) return false;

  const slotBase = Number(stageState.spawnSerial || 0);
  const plan = buildContinuousCombatSpawnPlan(globals.EnemyData, transition.state, { slotBase });
  if (!plan.length) return false;
  globals.ContinuousCombatStage = { ...transition.state, nextEmissionAt: now + CONTINUOUS_COMBAT_PACK_INTERVAL_SEC, lastUpdatedAt: now, spawnSerial: slotBase + plan.length };
  globals.ContinuousCombatStageLastTransition = { from: current?.id || '', to: transition.stage.id, at: now };
  globals.NativeBattleEnded = false;
  if (globals.ProgressionBattle) {
    globals.ProgressionBattle.outcome = 'active';
    globals.ProgressionBattle.settled = false;
  }
  for (const entry of plan) {
    const enemy = call('SpawnEnemy', { ...entry.row, enemyRole: String(entry.row.enemyRole || entry.row.role || transition.stage.kind) }, entry.slotIndex);
    activateContinuousCombatSpawnedEnemy(globals, enemy, entry);
  }
  call('UpdateEnemyHPUI');
  return true;
}
