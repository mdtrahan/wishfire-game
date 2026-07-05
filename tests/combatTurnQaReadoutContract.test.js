const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

async function loadReadoutModule() {
  return import(pathToFileURL(path.join(__dirname, '..', 'web-runner/systems/combatTurnQaReadout.mjs')).href);
}

test('combat turn QA readout explains current actor and visible Speed order', async () => {
  const { buildCombatTurnQaReadout, renderCombatTurnQaReadoutHtml } = await loadReadoutModule();
  const state = {
    globals: {
      CurrentTurnIndex: 0,
      PartyBuff_SPD: 5,
      EnemyDebuffs: { 200: { SPD: 3 } },
      TurnOrderArray: [
        { uid: 100, type: 0, spd: 10 },
        { uid: 200, type: 1, spd: 22 },
      ],
    },
    entities: [
      { uid: 100, kind: 'hero', name: 'Huun', hp: 35, stats: { SPD: 10 } },
      { uid: 200, kind: 'enemy', name: 'Skeleton', hp: 35, stats: { SPD: 22 } },
    ],
  };
  const calls = [];
  function callFunctionWithContext(_ctx, name, actor, stat) {
    calls.push(name);
    if (name === 'GetCurrentTurn') return 100;
    if (name === 'GetEffectiveStat' && stat === 'SPD') return actor.uid === 100 ? 15 : 19;
    return 0;
  }

  const readout = buildCombatTurnQaReadout({ state, callFunctionWithContext, fnContext: {} });

  assert.equal(readout.currentActorName, 'Huun');
  assert.equal(readout.currentTurnReason, 'turn order array index 1 selected this actor.');
  assert.match(readout.speedOrderAnswer, /^No:/);
  assert.deepEqual(readout.rows.map(row => [row.name, row.baseSpeed, row.effectiveSpeed, row.modifier]), [
    ['Huun', 10, 15, '+5 party Speed buff'],
    ['Skeleton', 22, 19, '-3 enemy Speed debuff'],
  ]);
  assert.ok(calls.includes('GetEffectiveStat'), 'readout must use existing effective stat owner path');

  const html = renderCombatTurnQaReadoutHtml({ state, callFunctionWithContext, fnContext: {} });
  assert.match(html, /data-devtool-turn-order-qa/);
  assert.match(html, /Is combat sorted by Speed\? No:/);
  assert.match(html, /Base SPD/);
  assert.match(html, /Effective SPD/);
  assert.match(html, /Why:/);
});

test('combat turn QA readout falls back to living actors and local modifiers without mutation', async () => {
  const { buildCombatTurnQaReadout } = await loadReadoutModule();
  const state = {
    globals: { PartyBuff_SPD: 2 },
    entities: [
      { uid: 1, kind: 'hero', name: 'Falie', hp: 42, stats: { SPD: 9 } },
    ],
  };

  const readout = buildCombatTurnQaReadout({ state });

  assert.equal(readout.orderSource, 'living actors');
  assert.match(readout.speedOrderAnswer, /^Yes:/);
  assert.equal(readout.rows[0].effectiveSpeed, 11);
  assert.equal(state.entities[0].stats.SPD, 9);
});
