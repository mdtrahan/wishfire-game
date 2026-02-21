function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

const SNAPSHOT_VERSION = 1;
const CHECKPOINT_IDS = Object.freeze({
  PRE_SUSPEND: 'CHK_PRE_SUSPEND',
  SNAPSHOT_EMIT: 'CHK_SNAPSHOT_EMIT',
  POST_RESUME: 'CHK_POST_RESUME',
});

const FAILURE_IDS = Object.freeze({
  E_TURN_QUEUE_NOT_ARRAY: 'E_TURN_QUEUE_NOT_ARRAY',
  E_CURRENT_INDEX_OUT_OF_RANGE: 'E_CURRENT_INDEX_OUT_OF_RANGE',
  E_CURRENT_INDEX_INVALID_WITH_EMPTY_QUEUE: 'E_CURRENT_INDEX_INVALID_WITH_EMPTY_QUEUE',
  E_SNAPSHOT_SCHEMA_INVALID: 'E_SNAPSHOT_SCHEMA_INVALID',
  E_RESUME_TOKEN_MISMATCH: 'E_RESUME_TOKEN_MISMATCH',
});

function hasValidCurrentIndex(turnQueue, currentActorIndex) {
  if (!Array.isArray(turnQueue)) return false;
  if (turnQueue.length === 0) return Number(currentActorIndex) === 0;
  return Number.isInteger(currentActorIndex) && currentActorIndex >= 0 && currentActorIndex < turnQueue.length;
}

function makeResumeToken(turnQueue, currentActorIndex, capturedAtTick) {
  return `${capturedAtTick}:${turnQueue.length}:${currentActorIndex}`;
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

  getAuthoritativeTurnState() {
    const turnQueue = cloneJson(this.combatState.turnQueue || []);
    const currentActorIndex = Number(this.combatState.currentActorIndex || 0);
    const capturedAtTick = Number(this.combatState.tickCount || this.combatState.turnTick || 0);
    return {
      turnQueue,
      currentActorIndex,
      capturedAtTick,
    };
  }

  getCheckpointDefinitions() {
    return {
      ids: CHECKPOINT_IDS,
      failureIds: FAILURE_IDS,
    };
  }

  emitCheckpointResult(stage, result, meta = {}) {
    const payload = {
      stage,
      checkpointId: result.checkpointId,
      pass: result.pass,
      failures: result.failures,
      ...meta,
    };
    this.combatState.lastCheckpointResult = payload;
    combatLog(`[Combat] ${stage} ${result.checkpointId} pass=${result.pass} failures=${JSON.stringify(result.failures)}`);
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit('combat:checkpoint', payload);
    }
  }

  evaluateCheckpoint(checkpointId, payload = {}) {
    const failures = [];
    if (checkpointId === CHECKPOINT_IDS.PRE_SUSPEND || checkpointId === CHECKPOINT_IDS.POST_RESUME) {
      const { turnQueue, currentActorIndex } = payload;
      if (!Array.isArray(turnQueue)) {
        failures.push(FAILURE_IDS.E_TURN_QUEUE_NOT_ARRAY);
      } else if (!hasValidCurrentIndex(turnQueue, currentActorIndex)) {
        if (turnQueue.length === 0) failures.push(FAILURE_IDS.E_CURRENT_INDEX_INVALID_WITH_EMPTY_QUEUE);
        else failures.push(FAILURE_IDS.E_CURRENT_INDEX_OUT_OF_RANGE);
      }
    }
    if (checkpointId === CHECKPOINT_IDS.SNAPSHOT_EMIT) {
      const snap = payload.snapshot || {};
      const hasSchema = Number(snap.snapshotVersion) === SNAPSHOT_VERSION &&
        snap.turnState &&
        Array.isArray(snap.turnState.turnQueue) &&
        Number.isInteger(snap.turnState.currentActorIndex) &&
        typeof snap.resumeToken === 'string' &&
        snap.resumeToken.length > 0;
      if (!hasSchema) failures.push(FAILURE_IDS.E_SNAPSHOT_SCHEMA_INVALID);
    }
    if (checkpointId === CHECKPOINT_IDS.POST_RESUME) {
      const { turnQueue, currentActorIndex, expectedResumeToken, capturedAtTick } = payload;
      if (expectedResumeToken) {
        const computed = makeResumeToken(turnQueue || [], Number(currentActorIndex || 0), Number(capturedAtTick || 0));
        if (computed !== expectedResumeToken) failures.push(FAILURE_IDS.E_RESUME_TOKEN_MISMATCH);
      }
    }
    return {
      checkpointId,
      pass: failures.length === 0,
      failures,
    };
  }

  takeSnapshot() {
    const turnState = this.getAuthoritativeTurnState();
    const resumeToken = makeResumeToken(turnState.turnQueue, turnState.currentActorIndex, turnState.capturedAtTick);
    const snapshot = {
      snapshotVersion: SNAPSHOT_VERSION,
      capturedAtTick: turnState.capturedAtTick,
      turnState,
      resumeToken,
      turnQueue: cloneJson(turnState.turnQueue),
      currentActorIndex: Number(turnState.currentActorIndex || 0),
    };
    const checkpoint = this.evaluateCheckpoint(CHECKPOINT_IDS.SNAPSHOT_EMIT, { snapshot });
    this.emitCheckpointResult('snapshot_emit', checkpoint, {
      snapshotVersion: snapshot.snapshotVersion,
      capturedAtTick: snapshot.capturedAtTick,
    });
    return snapshot;
  }

  validateSuspendCheckpoint() {
    const turnState = this.getAuthoritativeTurnState();
    return this.evaluateCheckpoint(CHECKPOINT_IDS.PRE_SUSPEND, turnState);
  }

  validateResumeCheckpoint(snapshot = null) {
    const turnState = this.getAuthoritativeTurnState();
    return this.evaluateCheckpoint(CHECKPOINT_IDS.POST_RESUME, {
      ...turnState,
      expectedResumeToken: snapshot && snapshot.resumeToken ? snapshot.resumeToken : '',
    });
  }

  takeLegacySnapshot() {
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
    const pre = this.validateSuspendCheckpoint();
    this.emitCheckpointResult('pre_suspend', pre);
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
    this.combatState.acceptEvents = false;
    this.combatState.inputEnabled = false;
    if (snapshot && snapshot.turnState && Array.isArray(snapshot.turnState.turnQueue)) {
      this.combatState.turnQueue = cloneJson(snapshot.turnState.turnQueue);
      this.combatState.currentActorIndex = Number(snapshot.turnState.currentActorIndex || 0);
    } else if (snapshot && Array.isArray(snapshot.turnQueue)) {
      this.combatState.turnQueue = cloneJson(snapshot.turnQueue);
      this.combatState.currentActorIndex = Number(snapshot.currentActorIndex || 0);
    }
    this.resetGemInputState();
    const post = this.validateResumeCheckpoint(snapshot || null);
    this.emitCheckpointResult('post_resume', post, {
      expectedResumeToken: snapshot && snapshot.resumeToken ? snapshot.resumeToken : '',
    });
    this.combatState.inputEnabled = true;
    this.combatState.acceptEvents = true;
    combatLog('[Combat] Resumed');
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit('combat:resumed', { snapshot: snapshot || null, checkpoint: post });
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
