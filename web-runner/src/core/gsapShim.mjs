const activeTimers = new WeakMap();

function isDomTarget(target) {
  return !!target && typeof target === 'object' && 'style' in target;
}

function normalizeValue(value) {
  return Number.isFinite(Number(value)) ? Number(value) : value;
}

function applyTransformStyles(target, vars) {
  if (!isDomTarget(target)) return;
  const style = target.style;
  if ('opacity' in vars) style.opacity = String(vars.opacity);
  if ('transformOrigin' in vars) style.transformOrigin = String(vars.transformOrigin);

  const transforms = [];
  if ('x' in vars) transforms.push(`translateX(${normalizeValue(vars.x)}px)`);
  if ('y' in vars) transforms.push(`translateY(${normalizeValue(vars.y)}px)`);
  if ('scaleX' in vars || 'scaleY' in vars) {
    const sx = 'scaleX' in vars ? normalizeValue(vars.scaleX) : 1;
    const sy = 'scaleY' in vars ? normalizeValue(vars.scaleY) : 1;
    transforms.push(`scale(${sx}, ${sy})`);
  } else if ('scale' in vars) {
    transforms.push(`scale(${normalizeValue(vars.scale)})`);
  }
  if ('rotation' in vars) transforms.push(`rotate(${normalizeValue(vars.rotation)}deg)`);
  if (transforms.length) style.transform = transforms.join(' ');
}

function applyVars(target, vars = {}) {
  if (!target || typeof target !== 'object') return;
  for (const [key, value] of Object.entries(vars)) {
    if ([
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
    ].includes(key)) continue;

    if (isDomTarget(target) && ['x', 'y', 'scale', 'scaleX', 'scaleY', 'rotation', 'opacity', 'transformOrigin'].includes(key)) {
      applyTransformStyles(target, { [key]: value });
    } else {
      target[key] = value;
    }
  }
}

function runTween(target, fromVars, toVars) {
  if (fromVars) applyVars(target, fromVars);
  const vars = toVars || {};
  const delayMs = Math.max(0, Number(vars.delay || 0)) * 1000;
  const timer = setTimeout(() => {
    try {
      if (typeof vars.onStart === 'function') vars.onStart();
      applyVars(target, vars);
      if (typeof vars.onUpdate === 'function') vars.onUpdate();
      if (typeof vars.onComplete === 'function') vars.onComplete();
    } finally {
      const timers = activeTimers.get(target);
      if (timers) timers.delete(timer);
    }
  }, delayMs);

  if (target && typeof target === 'object') {
    let timers = activeTimers.get(target);
    if (!timers) {
      timers = new Set();
      activeTimers.set(target, timers);
    }
    timers.add(timer);
  }
  return {
    kill() {
      clearTimeout(timer);
      const timers = activeTimers.get(target);
      if (timers) timers.delete(timer);
    },
  };
}

class Timeline {
  constructor(config = {}) {
    this.config = config || {};
    this.steps = [];
    this._killed = false;
    queueMicrotask(() => this._flush());
  }

  _flush() {
    if (this._killed) return;
    if (typeof this.config.onStart === 'function') {
      try {
        this.config.onStart();
      } catch {}
    }
    for (const step of this.steps) {
      if (this._killed) return;
      if (step.type === 'set') {
        applyVars(step.target, step.vars);
      } else if (step.type === 'fromTo') {
        applyVars(step.target, step.fromVars);
        applyVars(step.target, step.toVars);
        if (typeof step.toVars?.onStart === 'function') {
          try { step.toVars.onStart(); } catch {}
        }
        if (typeof step.toVars?.onUpdate === 'function') {
          try { step.toVars.onUpdate(); } catch {}
        }
        if (typeof step.toVars?.onComplete === 'function') {
          try { step.toVars.onComplete(); } catch {}
        }
      } else {
        const vars = step.vars || {};
        applyVars(step.target, vars);
        if (typeof vars.onStart === 'function') {
          try { vars.onStart(); } catch {}
        }
        if (typeof vars.onUpdate === 'function') {
          try { vars.onUpdate(); } catch {}
        }
        if (typeof vars.onComplete === 'function') {
          try { vars.onComplete(); } catch {}
        }
      }
    }
    if (typeof this.config.onComplete === 'function') {
      try {
        this.config.onComplete();
      } catch {}
    }
  }

  to(target, vars) {
    this.steps.push({ type: 'to', target, vars: vars || {} });
    return this;
  }

  fromTo(target, fromVars, toVars) {
    this.steps.push({ type: 'fromTo', target, fromVars: fromVars || {}, toVars: toVars || {} });
    return this;
  }

  set(target, vars) {
    this.steps.push({ type: 'set', target, vars: vars || {} });
    return this;
  }

  delay() {
    return this;
  }

  kill() {
    this._killed = true;
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

export const gsap = {
  set(target, vars) {
    applyVars(target, vars || {});
    return target;
  },
  to(target, vars) {
    return runTween(target, null, vars || {});
  },
  fromTo(target, fromVars, toVars) {
    return runTween(target, fromVars || {}, toVars || {});
  },
  timeline(config = {}) {
    return new Timeline(config);
  },
  killTweensOf(targets) {
    const list = Array.isArray(targets) ? targets : [targets];
    for (const target of list) {
      const timers = activeTimers.get(target);
      if (!timers) continue;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    }
  },
  parseEase,
};

export default gsap;
