const activeTweens = new WeakMap();

function isDomTarget(target) {
  return !!target && typeof target === 'object' && 'style' in target;
}

function normalizeValue(value) {
  return Number.isFinite(Number(value)) ? Number(value) : value;
}

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function scheduleFrame(callback) {
  if (typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(callback);
    return { type: 'raf', id };
  }
  const id = setTimeout(() => callback(nowMs()), 16);
  return { type: 'timeout', id };
}

function cancelScheduledFrame(handle) {
  if (!handle) return;
  if (handle.type === 'raf' && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle.id);
  } else {
    clearTimeout(handle.id);
  }
}

function parseEase(name) {
  const key = String(name || 'none').toLowerCase();
  if (key === 'none' || key === 'linear') return (t) => t;
  if (key === 'sine.inout') return (t) => 0.5 - (Math.cos(Math.PI * t) / 2);
  if (key === 'sine.out') return (t) => Math.sin((t * Math.PI) / 2);
  if (key === 'sine.in') return (t) => 1 - Math.cos((t * Math.PI) / 2);
  if (key === 'power1.out') return (t) => 1 - ((1 - t) ** 2);
  if (key === 'power2.out') return (t) => 1 - ((1 - t) ** 3);
  if (key === 'power2.in') return (t) => t ** 3;
  if (key === 'power1.in') return (t) => t ** 2;
  if (key === 'expo.in') return (t) => (t <= 0 ? 0 : 2 ** (10 * (t - 1)));
  if (key === 'expo.out') return (t) => (t >= 1 ? 1 : 1 - (2 ** (-10 * t)));
  if (key.startsWith('back.out')) {
    return (t) => {
      const s = 1.70158;
      const u = t - 1;
      return (u * u * ((s + 1) * u + s)) + 1;
    };
  }
  if (key.startsWith('back.in')) {
    return (t) => {
      const s = 1.70158;
      return t * t * ((s + 1) * t - s);
    };
  }
  return (t) => t;
}

function getDomState(target) {
  if (!target.__gsapShimState) {
    target.__gsapShimState = {
      baseTransform: null,
      x: 0,
      y: 0,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
      transformOrigin: 'center center',
    };
  }
  return target.__gsapShimState;
}

function isTimingKey(key) {
  return [
    'duration',
    'delay',
    'ease',
    'onStart',
    'onUpdate',
    'onComplete',
    'repeat',
    'yoyo',
    'stagger',
    'overwrite',
    'repeatDelay',
    'immediateRender',
    'clearProps',
  ].includes(key);
}

function isTransformKey(key) {
  return ['x', 'y', 'scale', 'scaleX', 'scaleY', 'rotation', 'opacity', 'transformOrigin'].includes(key);
}

function applyDomStyle(target, patch = {}) {
  const state = getDomState(target);
  if (state.baseTransform == null) {
    state.baseTransform = String(target.style.transform || '');
  }
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'scale') {
      const numeric = normalizeValue(value);
      state.scale = numeric;
      state.scaleX = numeric;
      state.scaleY = numeric;
    } else if (key === 'scaleX' || key === 'scaleY' || key === 'x' || key === 'y' || key === 'rotation' || key === 'opacity') {
      state[key] = normalizeValue(value);
    } else if (key === 'transformOrigin') {
      state.transformOrigin = String(value);
    }
  }

  const style = target.style;
  style.opacity = String(state.opacity);
  style.transformOrigin = String(state.transformOrigin);

  const transforms = [];
  if (Number.isFinite(Number(state.x))) transforms.push(`translateX(${Number(state.x)}px)`);
  if (Number.isFinite(Number(state.y))) transforms.push(`translateY(${Number(state.y)}px)`);
  if (Number.isFinite(Number(state.scaleX)) || Number.isFinite(Number(state.scaleY))) {
    const sx = Number.isFinite(Number(state.scaleX)) ? Number(state.scaleX) : 1;
    const sy = Number.isFinite(Number(state.scaleY)) ? Number(state.scaleY) : 1;
    transforms.push(`scale(${sx}, ${sy})`);
  } else if (Number.isFinite(Number(state.scale))) {
    transforms.push(`scale(${Number(state.scale)})`);
  }
  if (Number.isFinite(Number(state.rotation))) transforms.push(`rotate(${Number(state.rotation)}deg)`);
  const baseTransform = String(state.baseTransform || '').trim();
  style.transform = [baseTransform, transforms.join(' ')].filter(Boolean).join(' ').trim();
}

function applyVars(target, vars = {}) {
  if (!target || typeof target !== 'object') return;
  for (const [key, value] of Object.entries(vars)) {
    if (isTimingKey(key)) continue;
    if (isDomTarget(target) && isTransformKey(key)) {
      applyDomStyle(target, { [key]: value });
    } else {
      target[key] = value;
    }
  }
}

function readCurrentValue(target, key) {
  if (isDomTarget(target)) {
    const state = getDomState(target);
    if (key in state) return state[key];
  }
  const current = target[key];
  return Number.isFinite(Number(current)) ? Number(current) : current;
}

function resolveTweenValue(startValue, rawValue) {
  if (rawValue == null) return startValue;
  if (typeof rawValue === 'string' && /^[+-]=/.test(rawValue) && Number.isFinite(Number(startValue))) {
    const delta = Number(rawValue.slice(2)) * (rawValue[0] === '-' ? -1 : 1);
    return Number(startValue) + delta;
  }
  if (Number.isFinite(Number(rawValue))) return Number(rawValue);
  return rawValue;
}

function collectAnimatableKeys(vars = {}) {
  const keys = new Set();
  for (const [key] of Object.entries(vars || {})) {
    if (!isTimingKey(key)) keys.add(key);
  }
  return [...keys];
}

function cloneStateForKeys(target, keys) {
  const state = {};
  for (const key of keys) {
    const current = readCurrentValue(target, key);
    if (key === 'scale') {
      const numeric = Number.isFinite(Number(current)) ? Number(current) : 1;
      state.scale = numeric;
      state.scaleX = numeric;
      state.scaleY = numeric;
    } else if (key === 'scaleX' || key === 'scaleY' || key === 'x' || key === 'y' || key === 'rotation' || key === 'opacity') {
      state[key] = Number.isFinite(Number(current)) ? Number(current) : (key === 'opacity' ? 1 : 0);
    } else {
      state[key] = current;
    }
  }
  return state;
}

function applyTweenState(target, state) {
  if (!target || typeof target !== 'object') return;
  if (isDomTarget(target)) {
    applyDomStyle(target, state);
    for (const [key, value] of Object.entries(state)) {
      if (!isTransformKey(key)) target[key] = value;
    }
    return;
  }
  for (const [key, value] of Object.entries(state)) {
    target[key] = value;
  }
}

function createTweenHandle(target, fromVars, toVars, delayMs = 0) {
  const vars = toVars || {};
  const handle = {
    cancelled: false,
    delayTimer: null,
    frameHandle: null,
    cancel() {
      this.cancelled = true;
      if (this.delayTimer != null) {
        clearTimeout(this.delayTimer);
        this.delayTimer = null;
      }
      cancelScheduledFrame(this.frameHandle);
      this.frameHandle = null;
    },
  };

  const register = () => {
    if (!target || typeof target !== 'object') return;
    let handles = activeTweens.get(target);
    if (!handles) {
      handles = new Set();
      activeTweens.set(target, handles);
    }
    handles.add(handle);
  };

  const cleanup = () => {
    if (!target || typeof target !== 'object') return;
    const handles = activeTweens.get(target);
    if (handles) handles.delete(handle);
  };

  const start = () => {
    if (handle.cancelled) {
      cleanup();
      return;
    }

    if (fromVars) applyVars(target, fromVars);

    if (typeof vars.onStart === 'function') {
      try { vars.onStart(); } catch {}
    }

    const animKeys = collectAnimatableKeys({ ...(fromVars || {}), ...(vars || {}) });
    const startState = cloneStateForKeys(target, animKeys);
    const endState = {};
    for (const key of animKeys) {
      endState[key] = resolveTweenValue(startState[key], vars[key]);
    }

    const durationMs = Math.max(0, Number(vars.duration || 0)) * 1000;
    const ease = parseEase(vars.ease);

    if (durationMs <= 0) {
      applyTweenState(target, endState);
      if (typeof vars.onUpdate === 'function') {
        try { vars.onUpdate(); } catch {}
      }
      if (typeof vars.onComplete === 'function') {
        try { vars.onComplete(); } catch {}
      }
      cleanup();
      return;
    }

    const startedAt = nowMs();
    const tick = (ts) => {
      if (handle.cancelled) {
        cleanup();
        return;
      }
      const elapsed = Math.max(0, ts - startedAt);
      const progress = Math.max(0, Math.min(1, elapsed / durationMs));
      const eased = ease(progress);
      const frameState = {};
      for (const key of animKeys) {
        const startValue = startState[key];
        const endValue = endState[key];
        if (typeof startValue === 'number' && typeof endValue === 'number') {
          frameState[key] = startValue + ((endValue - startValue) * eased);
        } else {
          frameState[key] = progress >= 1 ? endValue : startValue;
        }
      }
      applyTweenState(target, frameState);
      if (typeof vars.onUpdate === 'function') {
        try { vars.onUpdate(); } catch {}
      }
      if (progress >= 1) {
        if (typeof vars.onComplete === 'function') {
          try { vars.onComplete(); } catch {}
        }
        cleanup();
        return;
      }
      handle.frameHandle = scheduleFrame(tick);
    };

    handle.frameHandle = scheduleFrame(tick);
  };

  if (delayMs > 0) {
    handle.delayTimer = setTimeout(start, delayMs);
  } else {
    queueMicrotask(start);
  }
  register();
  return handle;
}

class Timeline {
  constructor(config = {}) {
    this.config = config || {};
    this.steps = [];
    this._killed = false;
    this._handles = [];
    queueMicrotask(() => this._flush());
  }

  _resolvePosition(position, cursor, prevStart) {
    if (typeof position === 'number' && Number.isFinite(position)) {
      return Math.max(0, position);
    }
    if (typeof position === 'string') {
      const trimmed = position.trim();
      if (trimmed === '<') return prevStart;
      if (trimmed === '>' || trimmed === '') return cursor;
      if (/^[+-]=/.test(trimmed)) {
        const delta = Number(trimmed.slice(2));
        if (Number.isFinite(delta)) {
          return Math.max(0, cursor + (trimmed[0] === '-' ? -delta : delta));
        }
      }
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) return Math.max(0, numeric);
    }
    return cursor;
  }

  _flush() {
    if (this._killed) return;
    if (typeof this.config.onStart === 'function') {
      try {
        this.config.onStart();
      } catch {}
    }

    let cursor = 0;
    let prevStart = 0;
    let maxEnd = 0;

    for (const step of this.steps) {
      if (this._killed) return;
      const vars = step.type === 'fromTo' ? (step.toVars || {}) : (step.vars || {});
      const start = this._resolvePosition(step.position, cursor, prevStart);
      const delayMs = Math.max(0, Number(vars.delay || 0) * 1000) + (start * 1000);
      const durationMs = Math.max(0, Number(vars.duration || 0)) * 1000;
      const end = start + (durationMs / 1000);
      prevStart = start;
      cursor = Math.max(cursor, end);
      maxEnd = Math.max(maxEnd, end);

      let handle;
      if (step.type === 'set') {
        handle = createTweenHandle(step.target, null, { ...(step.vars || {}), duration: 0 }, delayMs);
      } else if (step.type === 'fromTo') {
        handle = createTweenHandle(step.target, step.fromVars || {}, step.toVars || {}, delayMs);
      } else {
        handle = createTweenHandle(step.target, null, step.vars || {}, delayMs);
      }
      this._handles.push(handle);
    }

    const completeDelayMs = Math.max(0, maxEnd * 1000);
    const completeTimer = setTimeout(() => {
      if (this._killed) return;
      if (typeof this.config.onComplete === 'function') {
        try {
          this.config.onComplete();
        } catch {}
      }
    }, completeDelayMs);
    this._handles.push({
      cancel() {
        clearTimeout(completeTimer);
      },
    });
  }

  to(target, vars, position) {
    this.steps.push({ type: 'to', target, vars: vars || {}, position });
    return this;
  }

  fromTo(target, fromVars, toVars, position) {
    this.steps.push({
      type: 'fromTo',
      target,
      fromVars: fromVars || {},
      toVars: toVars || {},
      position,
    });
    return this;
  }

  set(target, vars, position) {
    this.steps.push({ type: 'set', target, vars: vars || {}, position });
    return this;
  }

  delay() {
    return this;
  }

  kill() {
    this._killed = true;
    for (const handle of this._handles) {
      if (handle && typeof handle.cancel === 'function') handle.cancel();
    }
    this._handles.length = 0;
  }
}

export const gsap = {
  set(target, vars) {
    applyVars(target, vars || {});
    return target;
  },
  to(target, vars) {
    return createTweenHandle(target, null, vars || {}, Math.max(0, Number((vars || {}).delay || 0)) * 1000);
  },
  fromTo(target, fromVars, toVars) {
    return createTweenHandle(
      target,
      fromVars || {},
      toVars || {},
      Math.max(0, Number((toVars || {}).delay || 0)) * 1000,
    );
  },
  timeline(config = {}) {
    return new Timeline(config);
  },
  killTweensOf(targets) {
    const list = Array.isArray(targets) ? targets : [targets];
    for (const target of list) {
      const tweens = activeTweens.get(target);
      if (!tweens) continue;
      for (const tween of tweens) {
        if (tween && typeof tween.cancel === 'function') tween.cancel();
      }
      tweens.clear();
    }
  },
  parseEase,
};

export default gsap;
