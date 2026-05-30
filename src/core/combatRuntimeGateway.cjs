const {
  createSimulationCoreRequest,
  createSimulationCoreResponse,
  normalizeSimulationRngState,
} = require('./simulationCorePacket.cjs');

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

function parseResumeToken(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return { valid: false, capturedAtTick: 0, turnQueueLength: 0, currentActorIndex: 0 };
  }
  const parts = value.split(':');
  if (parts.length !== 3) {
    return { valid: false, capturedAtTick: 0, turnQueueLength: 0, currentActorIndex: 0 };
  }
  const capturedAtTick = Number(parts[0]);
  const turnQueueLength = Number(parts[1]);
  const currentActorIndex = Number(parts[2]);
  const valid = Number.isFinite(capturedAtTick) &&
    Number.isFinite(turnQueueLength) &&
    Number.isFinite(currentActorIndex);
  return { valid, capturedAtTick, turnQueueLength, currentActorIndex };
}

function makeCheckpointResult(checkpointId, failures, owner = 'js') {
  const normalizedFailures = Array.isArray(failures) ? failures.map(String) : [];
  return {
    checkpointId,
    pass: normalizedFailures.length === 0,
    failures: normalizedFailures,
    owner,
  };
}

function normalizeSnapshotIndex(value) {
  return Number.isInteger(value) ? value : 0.5;
}

function getGlobalCombatSnapshotOwner() {
  try {
    const root = typeof globalThis !== 'undefined' ? globalThis : null;
    return root && typeof root.__ORKA_COMBAT_SNAPSHOT_OWNER__ === 'function'
      ? root.__ORKA_COMBAT_SNAPSHOT_OWNER__
      : null;
  } catch (_) {
    return null;
  }
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

class CombatRuntimeGateway {
  constructor({
    combatState,
    eventBus,
    layoutState,
    callFunctionWithContext,
    getAuthoritativeTurnState,
    applyAuthoritativeTurnState,
    combatSnapshotOwner,
    getDeterministicRngState,
  } = {}) {
    this.combatState = combatState || {};
    this.eventBus = eventBus || null;
    this.layoutState = layoutState || null;
    this.callFunctionWithContext = callFunctionWithContext || null;
    this.getAuthoritativeTurnStateAdapter = typeof getAuthoritativeTurnState === 'function'
      ? getAuthoritativeTurnState
      : null;
    this.applyAuthoritativeTurnStateAdapter = typeof applyAuthoritativeTurnState === 'function'
      ? applyAuthoritativeTurnState
      : null;
    this.combatSnapshotOwner = typeof combatSnapshotOwner === 'function'
      ? combatSnapshotOwner
      : null;
    this.getDeterministicRngStateAdapter = typeof getDeterministicRngState === 'function'
      ? getDeterministicRngState
      : null;
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
    if (this.getAuthoritativeTurnStateAdapter) {
      const turnState = this.getAuthoritativeTurnStateAdapter() || {};
      const normalized = {
        turnQueue: cloneJson(turnState.turnQueue || []),
        currentActorIndex: Number(turnState.currentActorIndex || 0),
        capturedAtTick: Number(turnState.capturedAtTick || 0),
      };
      this.combatState.turnQueue = cloneJson(normalized.turnQueue);
      this.combatState.currentActorIndex = Number(normalized.currentActorIndex || 0);
      return normalized;
    }
    const turnQueue = cloneJson(this.combatState.turnQueue || []);
    const currentActorIndex = Number(this.combatState.currentActorIndex || 0);
    const capturedAtTick = Number(this.combatState.tickCount || this.combatState.turnTick || 0);
    return {
      turnQueue,
      currentActorIndex,
      capturedAtTick,
    };
  }

  getDeterministicRngState() {
    if (this.getDeterministicRngStateAdapter) {
      return normalizeSimulationRngState(this.getDeterministicRngStateAdapter() || {});
    }
    return normalizeSimulationRngState(this.combatState && this.combatState.rngState ? this.combatState.rngState : {});
  }

  createSimulationCoreRequest(action = {}, context = {}, turnStateOverride = null) {
    const turnState = turnStateOverride || this.getAuthoritativeTurnState();
    const request = createSimulationCoreRequest({
      gameState: {
        turnState: cloneJson(turnState),
      },
      action,
      rngState: this.getDeterministicRngState(),
      context,
    });
    this.combatState.lastSimulationCoreRequest = cloneJson(request);
    return request;
  }

  applySimulationCoreResponse(response = {}) {
    const normalized = createSimulationCoreResponse(response);
    const turnState = normalized.nextGameState && normalized.nextGameState.turnState
      ? normalized.nextGameState.turnState
      : null;
    if (turnState && Array.isArray(turnState.turnQueue)) {
      if (this.applyAuthoritativeTurnStateAdapter) {
        this.applyAuthoritativeTurnStateAdapter(cloneJson(turnState));
      }
      this.combatState.turnQueue = cloneJson(turnState.turnQueue);
      this.combatState.currentActorIndex = Number(turnState.currentActorIndex || 0);
    }
    this.combatState.lastSimulationCoreResponse = cloneJson(normalized);
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit('combat:simulation-response', { response: normalized });
      for (const event of normalized.events) {
        this.eventBus.emit('combat:simulation-event', { event, response: normalized });
      }
    }
    return normalized;
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

  resolveCombatSnapshotOwner() {
    return this.combatSnapshotOwner || getGlobalCombatSnapshotOwner();
  }

  evaluateCheckpointJsFailures(checkpointId, payload = {}) {
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
    return failures;
  }

  createCombatSnapshotOwnerPayload(checkpointId, payload = {}, jsFailures = []) {
    const isSnapshotEmit = checkpointId === CHECKPOINT_IDS.SNAPSHOT_EMIT;
    const snap = isSnapshotEmit ? (payload.snapshot || {}) : {};
    const turnState = isSnapshotEmit ? (snap.turnState || {}) : payload;
    const turnQueue = turnState.turnQueue;
    const expectedResumeToken = checkpointId === CHECKPOINT_IDS.POST_RESUME
      ? String(payload.expectedResumeToken || '')
      : '';
    const expected = parseResumeToken(expectedResumeToken);
    return {
      source: 'CombatRuntimeGateway.evaluateCheckpoint',
      checkpointId,
      snapshotVersion: isSnapshotEmit ? Number(snap.snapshotVersion || 0) : SNAPSHOT_VERSION,
      hasTurnState: isSnapshotEmit && snap.turnState ? 1 : (isSnapshotEmit ? 0 : 1),
      turnQueueIsArray: Array.isArray(turnQueue) ? 1 : 0,
      turnQueueLength: Array.isArray(turnQueue) ? turnQueue.length : 0,
      currentActorIndex: normalizeSnapshotIndex(turnState.currentActorIndex),
      hasResumeToken: isSnapshotEmit && typeof snap.resumeToken === 'string' && snap.resumeToken.length > 0 ? 1 : 0,
      hasExpectedToken: expected.valid ? 1 : 0,
      capturedAtTick: Number(turnState.capturedAtTick || snap.capturedAtTick || 0),
      expectedCapturedAtTick: Number(expected.capturedAtTick || 0),
      expectedTurnQueueLength: Number(expected.turnQueueLength || 0),
      expectedCurrentActorIndex: Number(expected.currentActorIndex || 0),
      jsFailures: [...jsFailures],
    };
  }

  evaluateCheckpoint(checkpointId, payload = {}) {
    const jsFailures = this.evaluateCheckpointJsFailures(checkpointId, payload);
    const owner = this.resolveCombatSnapshotOwner();
    if (typeof owner === 'function') {
      try {
        const ownerResult = owner(this.createCombatSnapshotOwnerPayload(checkpointId, payload, jsFailures));
        if (ownerResult && String(ownerResult.owner || '') === 'rust' && Array.isArray(ownerResult.failures)) {
          return makeCheckpointResult(checkpointId, ownerResult.failures, 'rust');
        }
      } catch (err) {
        this.combatState.lastCombatSnapshotOwnerError = String(err && err.message ? err.message : err || 'unknown');
      }
    }
    return makeCheckpointResult(checkpointId, jsFailures);
  }

  takeSnapshot() {
    const turnState = this.getAuthoritativeTurnState();
    const resumeToken = makeResumeToken(turnState.turnQueue, turnState.currentActorIndex, turnState.capturedAtTick);
    const simulationCoreRequest = this.createSimulationCoreRequest(
      { type: 'gateway.snapshot', source: 'CombatRuntimeGateway.takeSnapshot' },
      { checkpointId: CHECKPOINT_IDS.SNAPSHOT_EMIT },
      turnState,
    );
    const snapshot = {
      snapshotVersion: SNAPSHOT_VERSION,
      capturedAtTick: turnState.capturedAtTick,
      turnState,
      simulationCoreRequest,
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
    let restoredTurnState = null;
    if (snapshot && snapshot.turnState && Array.isArray(snapshot.turnState.turnQueue)) {
      restoredTurnState = {
        turnQueue: cloneJson(snapshot.turnState.turnQueue),
        currentActorIndex: Number(snapshot.turnState.currentActorIndex || 0),
        capturedAtTick: Number(snapshot.turnState.capturedAtTick || snapshot.capturedAtTick || 0),
      };
    } else if (snapshot && Array.isArray(snapshot.turnQueue)) {
      restoredTurnState = {
        turnQueue: cloneJson(snapshot.turnQueue),
        currentActorIndex: Number(snapshot.currentActorIndex || 0),
        capturedAtTick: Number(snapshot.capturedAtTick || 0),
      };
    }
    if (restoredTurnState) {
      if (this.applyAuthoritativeTurnStateAdapter) {
        this.applyAuthoritativeTurnStateAdapter(cloneJson(restoredTurnState));
      }
      this.combatState.turnQueue = cloneJson(restoredTurnState.turnQueue);
      this.combatState.currentActorIndex = Number(restoredTurnState.currentActorIndex || 0);
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

module.exports = {
  CombatRuntimeGateway,
};
