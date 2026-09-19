import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContinuousCombatSpawnPlan,
  createContinuousCombatStageState,
  advanceContinuousCombatStage,
  isContinuousCombatWaveCleared,
  maybeAdvanceContinuousCombatStage,
  configureContinuousCombatProduction,
  finalizeContinuousCombatProduction,
} from '../web-runner/src/core/continuousCombatStage.mjs';
import {
  applyDynamicInitiativeActionCompleted,
  selectDynamicInitiativeTurn,
} from '../web-runner/src/core/dynamicInitiativeRules.mjs';

test('continuous stage sequence is deterministic from the production seed', () => {
  const start = createContinuousCombatStageState(42);
  const first = advanceContinuousCombatStage(start);
  const second = advanceContinuousCombatStage(first.state);
  assert.equal(start.stageId, '1-1');
  assert.equal(first.stage.id, '1-1-boss');
  assert.equal(second.stage.id, '1-2');
  assert.deepEqual(second.state.completed, ['1-1', '1-1-boss']);
  assert.equal(second.state.seed, 42);
});

test('production adapter is queryless while QA paths remain untouched', () => {
  const globals = {};
  assert.equal(configureContinuousCombatProduction(globals, { productionPath: true }), true);
  assert.equal(globals.ContinuousCombatStageLoop, 1);
  assert.equal(globals.EncounterPolicy, 'fodder_only');
  assert.equal(globals.ContinuousCombatStage.stageId, '1-1');
  assert.equal(configureContinuousCombatProduction(globals, { productionPath: false }), false);
  assert.equal(globals.ContinuousCombatStageLoop, 0);
});

test('stage spawn plans preserve authored duplicate rows and center-first slots', () => {
  const rows = ['Gobloc', 'Skeleton', 'High Gobloc', 'Lizardo', 'Orc', 'Troll']
    .map(name => ({ name }));
  const startPlan = buildContinuousCombatSpawnPlan(rows, createContinuousCombatStageState(7));
  assert.deepEqual(startPlan.map(entry => [entry.row.name, entry.slotIndex]), [
    ['Gobloc', 1], ['Skeleton', 0], ['Gobloc', 2],
  ]);
  const bossState = advanceContinuousCombatStage(createContinuousCombatStageState(7)).state;
  assert.deepEqual(buildContinuousCombatSpawnPlan(rows, bossState).map(entry => [entry.row.name, entry.slotIndex]), [['Troll', 1]]);
});

test('wave completion waits for presentation and death holds to clear', () => {
  const empty = { enemySlots: [0, 0, 0], entities: [], pendingDeaths: {}, presentationClear: true };
  assert.equal(isContinuousCombatWaveCleared(empty), true);
  assert.equal(isContinuousCombatWaveCleared({ ...empty, presentationClear: false }), false);
  assert.equal(isContinuousCombatWaveCleared({ ...empty, pendingDeaths: { 12: true } }), false);
  assert.equal(isContinuousCombatWaveCleared({ ...empty, entities: [{ kind: 'enemy', hp: 1 }] }), false);
});

test('runtime transition adapter clears the terminal wave and starts the next authored package', () => {
  const globals = {
    ContinuousCombatStageLoop: 1,
    ContinuousCombatStage: advanceContinuousCombatStage(createContinuousCombatStageState(9)).state,
    GamePhase: 'RUNTIME',
    EnemySlots: [0, 0, 0],
    EnemyData: ['Gobloc', 'Skeleton', 'High Gobloc', 'Lizardo', 'Orc', 'Troll'].map(name => ({ name, HP: 10 })),
    PendingDeaths: {},
    time: 12,
    NativeBattleEnded: true,
  };
  const entities = [{ kind: 'hero', uid: 1, heroInstanceKey: 'Fara' }];
  const calls = [];
  let ran = '';
  const advanced = maybeAdvanceContinuousCombatStage({
    globals,
    entities,
    presentationBarrier: { lanes: {} },
    call: (name, ...args) => calls.push([name, ...args]),
    runCombatStep: name => { ran = name; },
  });
  assert.equal(advanced, true);
  assert.equal(globals.ContinuousCombatStage.stageId, '1-2');
  assert.equal(globals.NativeBattleEnded, false);
  assert.deepEqual(calls.filter(([name]) => name === 'SpawnEnemy').map(([, row, slot]) => [row.name, slot]), [
    ['High Gobloc', 1], ['Lizardo', 0], ['Orc', 2],
  ]);
  assert.equal(calls.at(-1)?.[0], 'StartRound');
  assert.equal(ran, 'ProcessTurn');
});

test('continuous actors follow deterministic readiness thresholds instead of a fixed round cycle', () => {
  const actors = [
    { uid: 1, type: 0, name: 'Fara', speed: 70, hp: 100 },
    { uid: 2, type: 1, name: 'Troll', speed: 55, hp: 100 },
  ];
  let progress = {};
  progress = applyDynamicInitiativeActionCompleted({ actors, progress }).progress;
  assert.equal(selectDynamicInitiativeTurn({ actors, progress }).actor, null);
  progress = applyDynamicInitiativeActionCompleted({ actors, progress }).progress;
  let selected = selectDynamicInitiativeTurn({ actors, progress });
  assert.equal(selected.actor.uid, 1);
  assert.equal(selected.progress['1'], 40);
  progress = applyDynamicInitiativeActionCompleted({ actors, progress: selected.progress }).progress;
  selected = selectDynamicInitiativeTurn({ actors, progress });
  assert.equal(selected.actor.uid, 2);
  assert.equal(selected.progress['2'], 65);
});

test('continuous production starts with AF disabled and clears stale AF state', () => {
  const globals = {
    ContinuousCombatStageLoop: 1,
    PendingFlowThresholds: [{ heroUID: 1 }],
    FlowOrbs: [{ id: 1 }],
    AstralFlowKoOrbQueue: [{ id: 2 }],
    AstralFlowKoOrbPresentationPending: 1,
    AstralFlowKoOrbPresentationActive: 1,
    ProgressionBattle: { outcome: 'defeat', settled: true, defeatSettled: true },
  };
  const entities = [{ kind: 'hero', uid: 1, flow: 100, flowReady: true }];
  assert.equal(finalizeContinuousCombatProduction(globals, entities), true);
  assert.equal(entities[0].flow, 0);
  assert.equal(entities[0].flowReady, false);
  assert.deepEqual(globals.PendingFlowThresholds, []);
  assert.deepEqual(globals.FlowOrbs, []);
  assert.deepEqual(globals.AstralFlowKoOrbQueue, []);
  assert.equal(globals.AstralFlowKoOrbPresentationPending, 0);
  assert.equal(globals.AstralFlowKoOrbPresentationActive, 0);
});
