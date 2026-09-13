const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('combat QA readout exposes linked-speed, directed-AF, and shadow evidence', async () => {
  globalThis.__ORKA_SIMULATION_CORE_SHADOW__ = { mismatches:[{ rule:'test' }] };
  const { buildCombatTurnQaReadout, renderCombatTurnQaReadoutHtml } = await import(pathToFileURL(path.join(__dirname, '..', 'web-runner', 'systems', 'combatTurnQaReadout.mjs')));
  const state = { entities:[{ uid:1, kind:'hero', name:'Hondo', hp:40, stats:{ SPD:20 } }], globals:{
    DevSpeedLinkFixture:{ holderName:'Hondo', linkedSpeed:20, fastestEnemySpeed:10 },
    TurnSchedulerAudit:{ events:[{ kind:'speed_multiattack_link' }] },
    SpeedMultiattackLinkedActorUID:1,
    FlowOrbAudit:{ queuedRecipientUID:1, queuedCount:2, arrivedRecipientUID:1, arrivedCount:1 },
  } };
  const readout = buildCombatTurnQaReadout({ state });
  assert.equal(readout.speedLink.threshold, 20);
  assert.equal(readout.speedLink.links, 1);
  assert.deepEqual(readout.flowOrb, { queuedRecipientUID:1, queuedCount:2, arrivedRecipientUID:1, arrivedCount:1 });
  assert.equal(readout.shadowMismatchCount, 1);
  assert.match(renderCombatTurnQaReadoutHtml({ state }), /CTB timestamp order is preserved/);
});
