const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createLayoutStateSingleton,
  resetLayoutStateSingletonForTests,
} = require('../src/core');
const { CombatNavigationState } = require('../web-runner/systems/combatNavigationState.mjs');
class TestLayoutGateway extends CombatNavigationState { isInAtomicSection() { return !!(this.combatState.isTurnResolving || this.combatState.isSpikeProcessing || this.combatState.areEffectsAnimating); } }
const { registerCoreLayouts } = require('../src/layout/registerLayouts');

function createEventBus() {
  const events = [];
  return {
    events,
    emit(name, payload) {
      events.push({ name, payload });
    },
  };
}

test('input is locked during layout transition and unlocked after activation', async () => {
  resetLayoutStateSingletonForTests();

  let releaseTransition;
  const transitionGate = new Promise((resolve) => {
    releaseTransition = resolve;
  });

  const eventBus = createEventBus();
  const animationLayer = {
    async playTransition() {
      await transitionGate;
    },
  };

  const combatState = {
    turnQueue: [1, 2, 3],
    currentActorIndex: 0,
    gemInputState: { mode: 'idle', selectedGemIds: [], targetId: null, isRefillQueued: false },
    acceptEvents: false,
    inputEnabled: false,
  };
  const combatGateway = new TestLayoutGateway({ combatState, eventBus });
  const layoutState = createLayoutStateSingleton({ eventBus, animationLayer, combatRuntimeGateway: combatGateway });
  registerCoreLayouts(layoutState, { combatGateway });

  await layoutState.activateInitialLayout('base');
  const inputDomains = layoutState.getInputDomains();
  assert.equal(inputDomains.emit('base', 'base:open-shop', {}), true);

  const transitionPromise = layoutState.requestLayoutChange('shop', 'open-shop');
  assert.equal(inputDomains.isLocked(), true);
  assert.equal(inputDomains.emit('base', 'base:open-shop', {}), false);
  assert.equal(inputDomains.emit('shop', 'shop:purchase', {}), false);

  releaseTransition();
  await transitionPromise;

  assert.equal(layoutState.getActiveLayoutId(), 'shop');
  assert.equal(inputDomains.isLocked(), false);
  assert.equal(inputDomains.getActiveDomain(), 'shop');
  assert.equal(inputDomains.emit('shop', 'shop:purchase', {}), true);
});

test('requestLayoutChange queues request during combat atomic section without throwing', async () => {
  resetLayoutStateSingletonForTests();

  const eventBus = createEventBus();
  const animationLayer = {
    async playTransition() {
      return undefined;
    },
  };

  const combatState = {
    isTurnResolving: true,
    isSpikeProcessing: false,
    areEffectsAnimating: false,
    turnQueue: [1, 2, 3],
    currentActorIndex: 0,
    gemInputState: { mode: 'idle', selectedGemIds: [], targetId: null, isRefillQueued: false },
    acceptEvents: false,
    inputEnabled: false,
  };

  const combatGateway = new TestLayoutGateway({ combatState, eventBus });
  const layoutState = createLayoutStateSingleton({ eventBus, animationLayer, combatRuntimeGateway: combatGateway });
  registerCoreLayouts(layoutState, { combatGateway });
  await layoutState.activateInitialLayout('base');

  await assert.doesNotReject(async () => {
    const result = await layoutState.requestLayoutChange('shop', 'atomic-guard');
    assert.equal(result, false);
  });

  assert.equal(layoutState.getActiveLayoutId(), 'base');
  const queued = layoutState.getQueuedLayoutRequests();
  assert.equal(queued.length, 1);
  assert.equal(queued[0].targetLayoutId, 'shop');
  assert.equal(queued[0].reason, 'atomic-guard');
});

test('queued layout changes execute after atomic section clears and transition finalizes', async () => {
  resetLayoutStateSingletonForTests();

  const eventBus = createEventBus();
  const animationLayer = {
    async playTransition() {
      return undefined;
    },
  };

  const combatState = {
    isTurnResolving: true,
    isSpikeProcessing: false,
    areEffectsAnimating: false,
    turnQueue: [11, 22, 33],
    currentActorIndex: 1,
    gemInputState: { mode: 'idle', selectedGemIds: [], targetId: null, isRefillQueued: false },
    acceptEvents: false,
    inputEnabled: false,
  };

  const combatGateway = new TestLayoutGateway({ combatState, eventBus });
  const layoutState = createLayoutStateSingleton({ eventBus, animationLayer, combatRuntimeGateway: combatGateway });
  registerCoreLayouts(layoutState, { combatGateway });
  await layoutState.activateInitialLayout('base');

  const queuedResult = await layoutState.requestLayoutChange('combat', 'atomic-queue');
  assert.equal(queuedResult, false);
  assert.equal(layoutState.getQueuedLayoutRequests().length, 1);
  assert.equal(layoutState.getActiveLayoutId(), 'base');

  combatState.isTurnResolving = false;
  combatState.isSpikeProcessing = false;
  combatState.areEffectsAnimating = false;

  const kickoffResult = await layoutState.requestLayoutChange('shop', 'kickoff-transition');
  assert.equal(kickoffResult, true);
  assert.equal(layoutState.getQueuedLayoutRequests().length, 0);
  assert.equal(layoutState.getActiveLayoutId(), 'combat');
});

test('queued layout requests preserve FIFO order', async () => {
  resetLayoutStateSingletonForTests();

  const eventBus = createEventBus();
  const animationLayer = {
    async playTransition() {
      return undefined;
    },
  };

  const combatState = {
    isTurnResolving: true,
    isSpikeProcessing: false,
    areEffectsAnimating: false,
    turnQueue: [7, 8, 9],
    currentActorIndex: 0,
    gemInputState: { mode: 'idle', selectedGemIds: [], targetId: null, isRefillQueued: false },
    acceptEvents: false,
    inputEnabled: false,
  };

  const combatGateway = new TestLayoutGateway({ combatState, eventBus });
  const layoutState = createLayoutStateSingleton({ eventBus, animationLayer, combatRuntimeGateway: combatGateway });
  registerCoreLayouts(layoutState, { combatGateway });
  await layoutState.activateInitialLayout('base');

  const q1 = await layoutState.requestLayoutChange('combat', 'queued-1');
  const q2 = await layoutState.requestLayoutChange('shop', 'queued-2');
  assert.equal(q1, false);
  assert.equal(q2, false);
  assert.equal(layoutState.getQueuedLayoutRequests().length, 2);

  const blockedProcess = await layoutState.processQueuedLayoutRequest();
  assert.equal(blockedProcess, false);
  assert.equal(layoutState.getQueuedLayoutRequests().length, 2);
  assert.equal(layoutState.getActiveLayoutId(), 'base');

  combatState.isTurnResolving = false;
  combatState.isSpikeProcessing = false;
  combatState.areEffectsAnimating = false;

  const kickoff = await layoutState.requestLayoutChange('intro', 'kickoff-fifo');
  assert.equal(kickoff, true);
  assert.equal(layoutState.getQueuedLayoutRequests().length, 0);
  assert.equal(layoutState.getActiveLayoutId(), 'shop');

  const changedSequence = eventBus.events
    .filter(e => e.name === 'layout:changed')
    .map(e => `${e.payload.from}->${e.payload.to}`);
  assert.deepEqual(changedSequence, ['base->intro', 'intro->combat', 'combat->shop']);
});

test('core layouts reject the retired AstralFlow route and preserve the Gold shop route', async () => {
  resetLayoutStateSingletonForTests();

  const eventBus = createEventBus();
  const animationLayer = {
    async playTransition() {
      return undefined;
    },
  };

  const combatState = {
    turnQueue: [1, 2, 3],
    currentActorIndex: 0,
    gemInputState: { mode: 'idle', selectedGemIds: [], targetId: null, isRefillQueued: false },
    acceptEvents: false,
    inputEnabled: false,
  };
  const combatGateway = new TestLayoutGateway({ combatState, eventBus });
  const layoutState = createLayoutStateSingleton({ eventBus, animationLayer, combatRuntimeGateway: combatGateway });
  registerCoreLayouts(layoutState, { combatGateway });

  await layoutState.activateInitialLayout('combat');
  assert.equal(layoutState.getActiveLayoutId(), 'combat');

  await assert.rejects(layoutState.requestLayoutChange('astralOverlay', 'nav-astral-flow'), /Unknown target layout/);
  assert.equal(layoutState.getActiveLayoutId(), 'combat');

  const toGoldShop = await layoutState.requestLayoutChange('shop', 'nav-shop');
  assert.equal(toGoldShop, true);
  assert.equal(layoutState.getActiveLayoutId(), 'shop');

  const backToCombat = await layoutState.requestLayoutChange('combat', 'shop-close');
  assert.equal(backToCombat, true);
  assert.equal(layoutState.getActiveLayoutId(), 'combat');
});
