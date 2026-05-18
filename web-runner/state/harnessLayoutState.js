import * as runtimeDebugLogging from '../systems/runtimeDebugLogging.js';

export function createHarnessEventBus() {
  const listeners = new Map();
  const events = [];
  return {
    events,
    on(eventName, handler) {
      if (!listeners.has(eventName)) listeners.set(eventName, new Set());
      listeners.get(eventName).add(handler);
      return () => listeners.get(eventName)?.delete(handler);
    },
    emit(eventName, payload = {}) {
      events.push({ name: eventName, payload });
      const subs = listeners.get(eventName);
      if (!subs || subs.size === 0) return;
      for (const fn of [...subs]) fn(payload);
    },
  };
}

export class HarnessInputDomainManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.activeDomain = null;
    this.locked = false;
  }

  setActiveDomain(domain) {
    this.activeDomain = domain || null;
  }

  getActiveDomain() {
    return this.activeDomain;
  }

  lock() {
    this.locked = true;
    runtimeDebugLogging.debugLayoutLog('[Input] Locked');
  }

  unlock() {
    this.locked = false;
    runtimeDebugLogging.debugLayoutLog('[Input] Unlocked');
  }

  emit(domain, eventName, payload = {}) {
    const allowed = !this.locked && !!domain && domain === this.activeDomain;
    runtimeDebugLogging.debugLayoutLog(`[Input] Emit -> domain:${domain} event:${eventName} allowed:${allowed} active:${this.activeDomain}`);
    if (!allowed) return false;
    this.eventBus.emit(eventName, { ...payload, domain });
    return true;
  }
}

export function createHarnessLayoutState({ eventBus, inputDomains }) {
  const layouts = new Map();
  const snapshotsByLayout = new Map();
  let activeLayoutId = null;
  let isTransitioning = false;

  return {
    registerLayout(descriptor) {
      layouts.set(descriptor.id, descriptor);
    },
    hasLayout(layoutId) {
      return layouts.has(layoutId);
    },
    canTransitionTo(targetLayoutId) {
      const sourceLayout = activeLayoutId ? layouts.get(activeLayoutId) : null;
      if (!layouts.has(targetLayoutId)) {
        return { allowed: false, reason: 'target-unregistered', from: activeLayoutId, to: targetLayoutId };
      }
      if (sourceLayout && Array.isArray(sourceLayout.allowedTransitions) && !sourceLayout.allowedTransitions.includes(targetLayoutId)) {
        return { allowed: false, reason: 'transition-forbidden', from: activeLayoutId, to: targetLayoutId };
      }
      return { allowed: true, reason: 'ok', from: activeLayoutId, to: targetLayoutId };
    },
    getActiveLayoutId() {
      return activeLayoutId;
    },
    getSnapshot(layoutId) {
      return snapshotsByLayout.get(layoutId);
    },
    async activateInitialLayout(layoutId, payload = {}) {
      const targetLayout = layouts.get(layoutId);
      if (!targetLayout) throw new Error(`Missing layout: ${layoutId}`);
      activeLayoutId = layoutId;
      inputDomains.setActiveDomain(layoutId);
      runtimeDebugLogging.debugLayoutLog(`[Layout] Initial activation -> ${layoutId}`);
      const context = {
        eventBus,
        payload,
        reason: 'harness-initial',
        from: null,
        to: layoutId,
        resumeSnapshot: snapshotsByLayout.get(layoutId) || null,
      };
      if (typeof targetLayout.onEnter === 'function') await targetLayout.onEnter(context);
      if (typeof targetLayout.onActive === 'function') await targetLayout.onActive(context);
    },
    async requestLayoutChange(targetLayoutId, reason = 'harness-request', payload = {}) {
      runtimeDebugLogging.debugLayoutLog(`[Layout] Request -> from:${activeLayoutId} to:${targetLayoutId} reason:${reason}`);
      if (isTransitioning) return false;
      if (activeLayoutId === targetLayoutId) return false;
      const sourceLayout = activeLayoutId ? layouts.get(activeLayoutId) : null;
      const targetLayout = layouts.get(targetLayoutId);
      if (!targetLayout) return false;
      if (sourceLayout && Array.isArray(sourceLayout.allowedTransitions)) {
        if (!sourceLayout.allowedTransitions.includes(targetLayoutId)) {
          runtimeDebugLogging.debugLayoutLog(`[Layout] Invalid transition -> from:${activeLayoutId} to:${targetLayoutId}`);
          return false;
        }
      }

      isTransitioning = true;
      inputDomains.lock();
      eventBus.emit('layout:changeRequested', { from: activeLayoutId, to: targetLayoutId, reason });
      try {
        if (sourceLayout && typeof sourceLayout.onExit === 'function') {
          const exitContext = { eventBus, payload, reason, from: activeLayoutId, to: targetLayoutId };
          const snapshot = await sourceLayout.onExit(exitContext);
          if (snapshot !== undefined) snapshotsByLayout.set(activeLayoutId, snapshot);
        }
        const from = activeLayoutId;
        activeLayoutId = targetLayoutId;
        inputDomains.setActiveDomain(targetLayoutId);
        const enterContext = {
          eventBus,
          payload,
          reason,
          from,
          to: targetLayoutId,
          resumeSnapshot: snapshotsByLayout.get(targetLayoutId) || null,
        };
        if (typeof targetLayout.onEnter === 'function') await targetLayout.onEnter(enterContext);
        if (typeof targetLayout.onActive === 'function') await targetLayout.onActive(enterContext);
        eventBus.emit('layout:changed', { from, to: targetLayoutId, reason });
        runtimeDebugLogging.debugLayoutLog(`[Layout] Active -> ${targetLayoutId}`);
        return true;
      } finally {
        isTransitioning = false;
        inputDomains.unlock();
      }
    },
  };
}
