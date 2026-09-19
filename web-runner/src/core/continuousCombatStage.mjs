// The production auto-combat slice is deliberately small.  A stage is a
// deterministic sequence of encounter packages; presentation and combat
// resolution remain owned by the existing runtime.

export const CONTINUOUS_COMBAT_STAGES = Object.freeze([
  Object.freeze({
    id: '1-1',
    kind: 'fodder',
    enemyNames: Object.freeze(['Gobloc', 'Skeleton', 'Gobloc']),
  }),
  Object.freeze({
    id: '1-1-boss',
    kind: 'boss',
    enemyNames: Object.freeze(['Troll']),
  }),
  Object.freeze({
    id: '1-2',
    kind: 'fodder',
    enemyNames: Object.freeze(['High Gobloc', 'Lizardo', 'Orc']),
  }),
]);

export function createContinuousCombatStageState(seed = 1) {
  const normalizedSeed = Number(seed) >>> 0 || 1;
  return {
    seed: normalizedSeed,
    stageIndex: 0,
    stageId: CONTINUOUS_COMBAT_STAGES[0].id,
    transitions: 0,
    completed: [],
  };
}

export function configureContinuousCombatProduction(globals, { productionPath = false } = {}) {
  const enabled = !!productionPath;
  globals.ContinuousCombatStageLoop = enabled ? 1 : 0;
  if (!enabled) return false;
  globals.EncounterPolicy = 'fodder_only';
  globals.EncounterMaxSlots = 3;
  globals.ContinuousCombatStage = createContinuousCombatStageState(globals.EncounterSeed || 1);
  return true;
}

export function finalizeContinuousCombatProduction(globals, entities = []) {
  if (Number(globals.ContinuousCombatStageLoop || 0) !== 1) return false;
  globals.QuestFiniteEncounter = 1;
  delete globals.SessionLevelUpSettlement;
  globals.PendingFlowThresholds = [];
  globals.FlowOrbs = [];
  globals.AstralFlowKoOrbQueue = [];
  globals.AstralFlowKoOrbPresentationPending = 0;
  globals.AstralFlowKoOrbPresentationActive = 0;
  for (const actor of Array.isArray(entities) ? entities : []) {
    if (actor?.kind !== 'hero') continue;
    actor.flow = 0;
    actor.flowReady = false;
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
  const index = Math.max(0, Math.min(
    CONTINUOUS_COMBAT_STAGES.length - 1,
    Math.floor(Number(stageState?.stageIndex ?? 0)),
  ));
  return CONTINUOUS_COMBAT_STAGES[index] || null;
}

export function advanceContinuousCombatStage(stageState) {
  const current = getContinuousCombatStage(stageState);
  const currentIndex = Math.max(0, Math.min(
    CONTINUOUS_COMBAT_STAGES.length - 1,
    Math.floor(Number(stageState?.stageIndex ?? 0)),
  ));
  const nextIndex = currentIndex + 1;
  const completed = Array.isArray(stageState?.completed) ? [...stageState.completed] : [];
  if (current && !completed.includes(current.id)) completed.push(current.id);
  if (nextIndex >= CONTINUOUS_COMBAT_STAGES.length) {
    return {
      done: true,
      stage: null,
      state: {
        ...stageState,
        stageIndex: currentIndex,
        stageId: current?.id || '',
        transitions: Number(stageState?.transitions || 0) + 1,
        completed,
      },
    };
  }
  const next = CONTINUOUS_COMBAT_STAGES[nextIndex];
  return {
    done: false,
    stage: next,
    state: {
      seed: Number(stageState?.seed) >>> 0 || 1,
      stageIndex: nextIndex,
      stageId: next.id,
      transitions: Number(stageState?.transitions || 0) + 1,
      completed,
    },
  };
}

export function buildContinuousCombatSpawnPlan(enemyRows, stageState) {
  const stage = getContinuousCombatStage(stageState);
  const rows = Array.isArray(enemyRows) ? enemyRows : [];
  if (!stage || !rows.length) return [];
  const byName = new Map(rows.map(row => [String(row?.name || row?.EnemyName || '').trim(), row]));
  const slotOrder = [1, 0, 2];
  return stage.enemyNames
    .map((name, index) => ({ row: byName.get(name), slotIndex: slotOrder[index] }))
    .filter(entry => entry.row && Number.isInteger(entry.slotIndex));
}

export function isContinuousCombatWaveCleared({ enemySlots = [], entities = [], pendingDeaths = {}, presentationClear = false } = {}) {
  const livingEnemy = entities.some(entity => entity?.kind === 'enemy' && Number(entity.hp || 0) > 0);
  const occupiedSlot = (Array.isArray(enemySlots) ? enemySlots : []).some(value => Number(value || 0) > 0);
  return !!presentationClear && !livingEnemy && !occupiedSlot && Object.keys(pendingDeaths || {}).length === 0;
}

export function maybeAdvanceContinuousCombatStage({ globals, entities, presentationBarrier, call, runCombatStep } = {}) {
  if (!globals || Number(globals.ContinuousCombatStageLoop || 0) !== 1) return false;
  if (globals.GamePhase !== 'RUNTIME' || globals.BattleStartActive) return false;
  const stageState = globals.ContinuousCombatStage;
  if (!stageState) return false;
  const lanes = presentationBarrier?.lanes || {};
  const presentationClear = !Object.entries(lanes).some(([name, active]) => name !== 'levelUpSettlement' && active)
    && !globals.ActionInProgress
    && !(Array.isArray(globals.PendingHeroHits) && globals.PendingHeroHits.length)
    && Object.keys(globals.EnemyDeathVisualHoldByUID || {}).length === 0;
  if (!isContinuousCombatWaveCleared({
    enemySlots: globals.EnemySlots,
    entities,
    pendingDeaths: globals.EnemyDeathVisualHoldByUID || globals.PendingDeaths,
    presentationClear,
  })) return false;
  const transition = advanceContinuousCombatStage(stageState);
  if (transition.done || !transition.stage) {
    globals.ContinuousCombatStageLoop = 0;
    return false;
  }
  const plan = buildContinuousCombatSpawnPlan(globals.EnemyData, transition.state);
  if (!plan.length) return false;
  globals.ContinuousCombatStage = transition.state;
  globals.ContinuousCombatStageLastTransition = { from: stageState.stageId, to: transition.stage.id, at: Number(globals.time || 0) };
  globals.QuestFiniteEncounter = 1;
  globals.InitialSpawn = 1;
  globals.EnemySlots = [];
  globals.EnemyIDs = [];
  globals.PendingEnemyRespawnSlots = [];
  globals.PendingEnemyRespawnTimerActive = 0;
  globals.EnemyDeathVisualHoldByUID = {};
  globals.PendingDeaths = {};
  globals.NativeCommandSequence = null;
  globals.PendingHeroHits = [];
  globals.NativeBattleEnded = false;
  delete globals.SessionLevelUpSettlement;
  globals.PendingFlowThresholds = [];
  globals.ProgressionBattle = {
    id: `continuous-${transition.state.seed}-${transition.state.transitions}`,
    participants: (entities || []).filter(actor => actor?.kind === 'hero').map(hero => hero.heroInstanceKey),
    defeated: {},
    defeatedGold: {},
    settled: false,
    outcome: 'active',
    defeatSettled: false,
  };
  Object.assign(globals, {
    DeferAdvance: 0,
    AdvanceAfterAction: 0,
    ActionOwnerUID: 0,
    ActionActorUID: 0,
    ActionInProgress: 0,
    ActionLockUntil: 0,
    PendingSkillID: '',
    PendingActor: 0,
    TurnPhase: 0,
    CanPickGems: 0,
    IsPlayerBusy: 0,
  });
  for (const entry of plan) {
    const row = entry.row;
    call('SpawnEnemy', { ...row, HP: Number(row.HP || row.maxHP || 0), ATK: Number(row.ATK || 0), DEF: Number(row.DEF || 0), MAG: Number(row.MAG || 0), RES: Number(row.RES || 0), SPD: Number(row.SPD || 0), enemyRole: String(row.enemyRole || row.role || 'fodder') }, entry.slotIndex);
  }
  globals.InitialSpawn = 0;
  call('UpdateEnemyHPUI');
  call('StartRound');
  runCombatStep('ProcessTurn');
  return true;
}
