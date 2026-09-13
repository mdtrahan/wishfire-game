const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

async function loadReadoutModule() {
  return import(pathToFileURL(path.join(__dirname, '..', 'web-runner/systems/combatTurnQaReadout.mjs')).href);
}

test('combat turn QA readout explains current actor and visible Speed order', async () => {
  const { buildCombatTurnQaReadout, renderCombatTurnQaReadoutHtml } = await loadReadoutModule();
  const state = { globals:{ CurrentTurnIndex:0, PartyBuff_SPD:5, EnemyDebuffs:{ 200:{ SPD:3 } }, TurnOrderArray:[{ uid:100, type:0, spd:10 },{ uid:200, type:1, spd:22 }] }, entities:[{ uid:100, kind:'hero', name:'Huun', hp:35, stats:{ SPD:10 } },{ uid:200, kind:'enemy', name:'Skeleton', hp:35, stats:{ SPD:22 } }] };
  const calls = [];
  function callFunctionWithContext(_ctx, name, actor, stat) {
    calls.push(name);
    if (name === 'GetCurrentTurn') return 100;
    if (name === 'GetEffectiveStat' && stat === 'SPD') return actor.uid === 100 ? 15 : 19;
    return 0;
  }
  const readout = buildCombatTurnQaReadout({ state, callFunctionWithContext, fnContext:{} });
  assert.equal(readout.currentActorName, 'Huun');
  assert.equal(readout.currentTurnReason, 'turn order array index 1 selected this actor.');
  assert.match(readout.speedOrderAnswer, /^No:/);
  assert.deepEqual(readout.rows.map(row => [row.name, row.baseSpeed, row.effectiveSpeed, row.modifier]), [['Huun',10,15,'+5 party Speed buff'],['Skeleton',22,19,'-3 enemy Speed debuff']]);
  assert.ok(calls.includes('GetEffectiveStat'));
  const html = renderCombatTurnQaReadoutHtml({ state, callFunctionWithContext, fnContext:{} });
  assert.match(html, /data-devtool-turn-order-qa/);
  assert.match(html, /CTB timestamp order is preserved/);
  assert.match(html, /Base SPD/);
  assert.match(html, /Effective SPD/);
  assert.match(html, /Why:/);
});

test('combat turn QA readout falls back to living actors without owning effective Speed math', async () => {
  const { buildCombatTurnQaReadout } = await loadReadoutModule();
  const state = { globals:{ PartyBuff_SPD:2 }, entities:[{ uid:1, kind:'hero', name:'Falie', hp:42, stats:{ SPD:9 } }] };
  const readout = buildCombatTurnQaReadout({ state });
  assert.equal(readout.orderSource, 'living actors');
  assert.equal(readout.speedOrderAnswer, 'Unavailable: effective Speed owner was not available.');
  assert.equal(readout.rows[0].baseSpeed, 9);
  assert.equal(readout.rows[0].modifier, '+2 party Speed buff');
  assert.equal(readout.rows[0].effectiveSpeed, null);
  assert.equal(state.entities[0].stats.SPD, 9);
});

test('combat QA readout exposes linked-speed, directed-AF, and shadow evidence', async () => {
  globalThis.__ORKA_SIMULATION_CORE_SHADOW__ = { mismatches:[{ rule:'test' }] };
  const { buildCombatTurnQaReadout, renderCombatTurnQaReadoutHtml } = await loadReadoutModule();
  const state = { entities:[{ uid:1, kind:'hero', name:'Hondo', hp:40, stats:{ SPD:20 } }], globals:{ DevSpeedLinkFixture:{ holderName:'Hondo', linkedSpeed:20, fastestEnemySpeed:10 }, TurnSchedulerAudit:{ events:[{ kind:'speed_multiattack_link' }] }, SpeedMultiattackLinkedActorUID:1, FlowOrbAudit:{ queuedRecipientUID:1, queuedCount:2, arrivedRecipientUID:1, arrivedCount:1 } } };
  const readout = buildCombatTurnQaReadout({ state });
  assert.equal(readout.speedLink.threshold, 20);
  assert.equal(readout.speedLink.links, 1);
  assert.deepEqual(readout.flowOrb, { queuedRecipientUID:1, queuedCount:2, arrivedRecipientUID:1, arrivedCount:1 });
  assert.equal(readout.shadowMismatchCount, 1);
  assert.match(renderCombatTurnQaReadoutHtml({ state }), /CTB timestamp order is preserved/);
});
