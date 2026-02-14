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

function inputLog(message) {
  if (!DEBUG_LAYOUT) return;
  console.log(message);
}

class InputDomainManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.activeDomain = null;
    this.locked = false;
    this.lockReason = '';
  }

  setActiveDomain(domain) {
    this.activeDomain = domain || null;
  }

  getActiveDomain() {
    return this.activeDomain;
  }

  lock(reason = 'transition') {
    this.locked = true;
    this.lockReason = reason;
    inputLog('[Input] Locked');
  }

  unlock() {
    this.locked = false;
    this.lockReason = '';
    inputLog('[Input] Unlocked');
  }

  isLocked() {
    return this.locked;
  }

  isInputAllowed(domain) {
    return !this.locked && this.activeDomain === domain;
  }

  emit(domain, eventName, payload = {}) {
    const allowed = this.isInputAllowed(domain);
    inputLog(`[Input] Emit → domain:${domain} event:${eventName} allowed:${allowed} active:${this.activeDomain}`);
    if (!allowed) return false;
    if (!this.eventBus || typeof this.eventBus.emit !== 'function') return false;
    this.eventBus.emit(eventName, { ...payload, domain });
    return true;
  }
}

module.exports = {
  InputDomainManager,
};
