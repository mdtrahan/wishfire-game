export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function now() { return Date.now(); }

export default { clamp, now };
