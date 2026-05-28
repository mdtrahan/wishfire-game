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

test('snapshot/resume use authoritative turn-state adapters when provided', () => {
  const combatState = {
    turnQueue: [9, 9, 9],
    currentActorIndex: 0,
    acceptEvents: false,
    inputEnabled: false,
  };
  const authority = {
    turnQueue: [{ uid: 101, type: 0 }, { uid: 202, type: 1 }],
    currentActorIndex: 1,
    capturedAtTick: 777,
  };
  const gateway = new CombatRuntimeGateway({
    combatState,
    getAuthoritativeTurnState() {
      return authority;
    },
    applyAuthoritativeTurnState(nextTurnState) {
      authority.turnQueue = nextTurnState.turnQueue;
      authority.currentActorIndex = nextTurnState.currentActorIndex;
    },
  });

  const snapshot = gateway.suspend();
  assert.deepEqual(snapshot.turnState.turnQueue, [{ uid: 101, type: 0 }, { uid: 202, type: 1 }]);
  assert.equal(snapshot.turnState.currentActorIndex, 1);
  assert.equal(snapshot.turnState.capturedAtTick, 777);
  assert.deepEqual(combatState.turnQueue, [{ uid: 101, type: 0 }, { uid: 202, type: 1 }]);
  assert.equal(combatState.currentActorIndex, 1);

  authority.turnQueue = [{ uid: 303, type: 1 }];
  authority.currentActorIndex = 0;
  gateway.resume(snapshot);
  assert.deepEqual(authority.turnQueue, [{ uid: 101, type: 0 }, { uid: 202, type: 1 }]);
  assert.equal(authority.currentActorIndex, 1);
  assert.deepEqual(combatState.turnQueue, [{ uid: 101, type: 0 }, { uid: 202, type: 1 }]);
  assert.equal(combatState.currentActorIndex, 1);
});
