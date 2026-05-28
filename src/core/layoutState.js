const { InputDomainManager } = require('./inputDomains');

const DEBUG_LAYOUT = (() => {
  let enabled = false;
  try {
    if (typeof process !== 'undefined' && process && process.env && process.env.DEBUG_LAYOUT === 'true') {
      enabled = true;
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && window && window.DEBUG_LAYOUT === true) {
      enabled = true;
    }
  } catch {}
  return enabled;
})();

function layoutLog(message) {
  if (!DEBUG_LAYOUT) return;
  console.log(message);
}

function assertLayoutDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== 'object') {
    throw new Error('Layout descriptor must be an object');
  }
  if (!descriptor.id || typeof descriptor.id !== 'string') {
    throw new Error('Layout descriptor id must be a non-empty string');
  }
  if (!Array.isArray(descriptor.allowedTransitions)) {
    throw new Error(`Layout "${descriptor.id}" must define allowedTransitions`);
  }
  if (typeof descriptor.onEnter !== 'function') {
    throw new Error(`Layout "${descriptor.id}" must define onEnter()`);
  }
  if (typeof descriptor.onExit !== 'function') {
    throw new Error(`Layout "${descriptor.id}" must define onExit()`);
  }
  if (typeof descriptor.onActive !== 'function') {
    throw new Error(`Layout "${descriptor.id}" must define onActive()`);
  }
}

async function runTransitionAnimation(animationLayer, params) {
  if (!animationLayer) return;
  if (typeof animationLayer.playTransition === 'function') {
    await animationLayer.playTransition(params);
    return;
  }
  if (typeof animationLayer.play === 'function') {
    await animationLayer.play('layout-transition', params);
  }
}

class LayoutStateController {
  constructor({ eventBus, animationLayer, inputDomains, combatRuntimeGateway } = {}) {
    this.eventBus = eventBus || null;
    this.animationLayer = animationLayer || null;
    this.inputDomains = inputDomains || new InputDomainManager(this.eventBus);
    this.combatRuntimeGateway = combatRuntimeGateway || null;
    this.layouts = new Map();
    this.activeLayoutId = null;
    this.isTransitioning = false;
    this.snapshotsByLayout = new Map();
    this.layoutRequestQueue = [];
  }

  registerLayout(descriptor) {
    assertLayoutDescriptor(descriptor);
    if (this.layouts.has(descriptor.id)) {
      throw new Error(`Layout "${descriptor.id}" is already registered`);
    }
    this.layouts.set(descriptor.id, descriptor);
  }

  getActiveLayoutId() {
    return this.activeLayoutId;
  }

  getInputDomains() {
    return this.inputDomains;
  }

  getSnapshot(layoutId) {
    return this.snapshotsByLayout.get(layoutId);
  }

  getQueuedLayoutRequests() {
    return [...this.layoutRequestQueue];
  }

  enqueueLayoutRequest(targetLayoutId, reason = 'unspecified', payload = {}) {
    const req = { targetLayoutId, reason, payload };
    this.layoutRequestQueue.push(req);
    layoutLog(`[Layout] Enqueue → ${targetLayoutId} queueLength:${this.layoutRequestQueue.length}`);
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit('layout:changeQueued', {
        targetLayoutId,
        reason,
        queueLength: this.layoutRequestQueue.length,
      });
    }
    return req;
  }

  async processQueuedLayoutRequest() {
    if (this.isTransitioning) return false;
    if (this.layoutRequestQueue.length === 0) return false;
    layoutLog(`[Layout] Dequeue attempt → queueLength:${this.layoutRequestQueue.length}`);
    if (
      this.combatRuntimeGateway &&
      typeof this.combatRuntimeGateway.isInAtomicSection === 'function' &&
      this.combatRuntimeGateway.isInAtomicSection()
    ) {
      layoutLog('[Layout] Dequeue blocked by atomic');
      return false;
    }
    const next = this.layoutRequestQueue.shift();
    if (!next) return false;
    layoutLog(`[Layout] Dequeued transition → ${next.targetLayoutId}`);
    await this.requestLayoutChange(next.targetLayoutId, next.reason, next.payload);
    return true;
  }

  isValidTransition(fromLayoutId, targetLayoutId) {
    if (!fromLayoutId) return true;
    const source = this.layouts.get(fromLayoutId);
    if (!source) return false;
    return source.allowedTransitions.includes(targetLayoutId);
  }

  async activateInitialLayout(layoutId, payload = {}) {
    if (this.activeLayoutId) {
      throw new Error('Initial layout can only be activated once');
    }
    const target = this.layouts.get(layoutId);
    if (!target) {
      throw new Error(`Unknown layout "${layoutId}"`);
    }
    this.activeLayoutId = layoutId;
    this.inputDomains.setActiveDomain(layoutId);
    layoutLog(`[Layout] Initial activation → ${layoutId}`);
    const context = {
      layoutState: this,
      eventBus: this.eventBus,
      payload,
      reason: 'initial-activation',
      from: null,
      to: layoutId,
      resumeSnapshot: this.snapshotsByLayout.get(layoutId) || null,
    };
    await target.onEnter(context);
    await target.onActive(context);
  }

  async requestLayoutChange(targetLayoutId, reason = 'unspecified', payload = {}) {
    const currentLayoutId = this.activeLayoutId;
    layoutLog(`[Layout] Request → from:${currentLayoutId} to:${targetLayoutId} reason:${reason}`);
    if (
      this.combatRuntimeGateway &&
      typeof this.combatRuntimeGateway.isInAtomicSection === 'function' &&
      this.combatRuntimeGateway.isInAtomicSection()
    ) {
      this.enqueueLayoutRequest(targetLayoutId, reason, payload);
      layoutLog(`[Layout] Queued (atomic) → ${targetLayoutId}`);
      return false;
    }
    if (this.isTransitioning) {
      throw new Error('Layout transition already in progress');
    }
    if (currentLayoutId === targetLayoutId) return false;
    if (!this.layouts.has(targetLayoutId)) {
      layoutLog(`[Layout] Invalid transition → from:${currentLayoutId} to:${targetLayoutId}`);
      throw new Error(`Unknown target layout "${targetLayoutId}"`);
    }
    if (!this.isValidTransition(currentLayoutId, targetLayoutId)) {
      layoutLog(`[Layout] Invalid transition → from:${currentLayoutId} to:${targetLayoutId}`);
      throw new Error(`Transition not allowed: "${currentLayoutId}" -> "${targetLayoutId}"`);
    }

    const currentLayout = currentLayoutId ? this.layouts.get(currentLayoutId) : null;
    const targetLayout = this.layouts.get(targetLayoutId);

    this.isTransitioning = true;
    this.inputDomains.lock('layout-transition');

    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit('layout:changeRequested', {
        from: currentLayoutId,
        to: targetLayoutId,
        reason,
      });
    }

    try {
      if (currentLayout) {
        const exitContext = {
          layoutState: this,
          eventBus: this.eventBus,
          payload,
          reason,
          from: currentLayoutId,
          to: targetLayoutId,
        };
        const snapshot = await currentLayout.onExit(exitContext);
        if (snapshot !== undefined) {
          this.snapshotsByLayout.set(currentLayoutId, snapshot);
        }
      }

      await runTransitionAnimation(this.animationLayer, {
        from: currentLayoutId,
        to: targetLayoutId,
        reason,
      });

      this.activeLayoutId = targetLayoutId;
      this.inputDomains.setActiveDomain(targetLayoutId);

      const enterContext = {
        layoutState: this,
        eventBus: this.eventBus,
        payload,
        reason,
        from: currentLayoutId,
        to: targetLayoutId,
        resumeSnapshot: this.snapshotsByLayout.get(targetLayoutId) || null,
      };

      await targetLayout.onEnter(enterContext);
      await targetLayout.onActive(enterContext);

      if (this.eventBus && typeof this.eventBus.emit === 'function') {
        this.eventBus.emit('layout:changed', {
          from: currentLayoutId,
          to: targetLayoutId,
          reason,
        });
      }
      layoutLog(`[Layout] Active → ${targetLayoutId}`);
      return true;
    } finally {
      this.isTransitioning = false;
      this.inputDomains.unlock();
      await this.processQueuedLayoutRequest();
    }
  }
}

let singleton = null;

function createLayoutStateSingleton(deps = {}) {
  if (!singleton) {
    singleton = new LayoutStateController(deps);
  }
  return singleton;
}

function getLayoutStateSingleton() {
  if (!singleton) {
    throw new Error('LayoutState singleton has not been created');
  }
  return singleton;
}

function resetLayoutStateSingletonForTests() {
  singleton = null;
}

module.exports = {
  DEBUG_LAYOUT,
  LayoutStateController,
  createLayoutStateSingleton,
  getLayoutStateSingleton,
  resetLayoutStateSingletonForTests,
};
