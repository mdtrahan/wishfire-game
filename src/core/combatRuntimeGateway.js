function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

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

function combatLog(message) {
  if (!DEBUG_LAYOUT) return;
  console.log(message);
}

export class CombatRuntimeGateway {
  constructor({ combatState, eventBus, layoutState, callFunctionWithContext } = {}) {
    this.combatState = combatState || {};
    this.eventBus = eventBus || null;
    this.layoutState = layoutState || null;
    this.callFunctionWithContext = callFunctionWithContext || null;
  }

  setLayoutState(layoutState) {
    this.layoutState = layoutState || null;
  }

  isCombatLayoutActive() {
    if (!this.layoutState || typeof this.layoutState.getActiveLayoutId !== 'function') return false;
    return this.layoutState.getActiveLayoutId() === 'combat';
  }

  runCombatStep(fnContext, functionName) {
    if (!this.isCombatLayoutActive()) return;
    if (typeof this.callFunctionWithContext === 'function') {
      return this.callFunctionWithContext(fnContext, functionName);
    }
    if (fnContext && typeof fnContext.callFunction === 'function') {
      return fnContext.callFunction(functionName);
    }
    return;
  }

  runCombatBootstrap(fn, ...args) {
    if (!this.isCombatLayoutActive()) return;
    if (typeof fn === 'function') return fn(...args);
    return;
  }

  runCombatBoardInit(fn, ...args) {
    if (!this.isCombatLayoutActive()) return;
    if (typeof fn === 'function') return fn(...args);
    return;
  }

  isInAtomicSection() {
    const s = this.combatState || {};
    const atomic = typeof s.substate === 'string'
      ? s.substate !== 'Neutral'
      : Boolean(
      s.isTurnResolving ||
      s.isSpikeProcessing ||
      s.areEffectsAnimating
    );
    if (atomic) {
      combatLog('[Combat] Atomic section active');
    }
    return atomic;
  }

  takeSnapshot() {
    return {
      turnQueue: cloneJson(this.combatState.turnQueue || []),
      currentActorIndex: Number(this.combatState.currentActorIndex || 0),
    };
  }

  resetGemInputState() {
    this.combatState.gemInputState = {
      mode: 'idle',
      selectedGemIds: [],
      targetId: null,
      isRefillQueued: false,
    };
  }

  suspend() {
    const snapshot = this.takeSnapshot();
    this.resetGemInputState();
    this.combatState.inputEnabled = false;
    this.combatState.acceptEvents = false;
    combatLog('[Combat] Suspended');
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit('combat:suspended', { snapshot });
    }
    return snapshot;
  }

  resume(snapshot) {
    if (snapshot && Array.isArray(snapshot.turnQueue)) {
      this.combatState.turnQueue = cloneJson(snapshot.turnQueue);
      this.combatState.currentActorIndex = Number(snapshot.currentActorIndex || 0);
    }
    this.resetGemInputState();
    this.combatState.inputEnabled = true;
    this.combatState.acceptEvents = true;
    combatLog('[Combat] Resumed');
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit('combat:resumed', { snapshot: snapshot || null });
    }
  }

  canAcceptEvents() {
    return this.combatState.acceptEvents === true;
  }

  handleEvent(eventName, payload = {}) {
    if (!this.canAcceptEvents()) return false;
    if (typeof this.combatState.onEvent === 'function') {
      this.combatState.onEvent(eventName, payload);
    }
    return true;
  }
}
