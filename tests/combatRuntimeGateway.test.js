const test = require('node:test');
const assert = require('node:assert/strict');

const { CombatRuntimeGateway } = require('../src/core');

test('isInAtomicSection returns true when combat substate is not Neutral', () => {
  const gateway = new CombatRuntimeGateway({
    combatState: {
      substate: 'ResolvingTurn',
      isTurnResolving: false,
      isSpikeProcessing: false,
      areEffectsAnimating: false,
    },
  });

  assert.equal(gateway.isInAtomicSection(), true);
});

test('isInAtomicSection returns false when combat substate is Neutral', () => {
  const gateway = new CombatRuntimeGateway({
    combatState: {
      substate: 'Neutral',
      isTurnResolving: true,
      isSpikeProcessing: true,
      areEffectsAnimating: true,
    },
  });

  assert.equal(gateway.isInAtomicSection(), false);
});

test('isInAtomicSection returns true from resolution flags when substate is absent', () => {
  const gateway = new CombatRuntimeGateway({
    combatState: {
      isTurnResolving: false,
      isSpikeProcessing: true,
      areEffectsAnimating: false,
    },
  });

  assert.equal(gateway.isInAtomicSection(), true);
});
