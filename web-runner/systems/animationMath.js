export const LUNGE_ANTICIPATION_SEC = 0.14;
export const LUNGE_FORWARD_SEC = 0.75;
export const LUNGE_HOLD_SEC = 0.16;
export const LUNGE_RETREAT_SEC = 0.26;
export const LUNGE_TOTAL_SEC = LUNGE_ANTICIPATION_SEC + LUNGE_FORWARD_SEC + LUNGE_HOLD_SEC + LUNGE_RETREAT_SEC;
export const LUNGE_FORWARD_DIST_PX = 200;
export const HERO_LUNGE_FORWARD_DIST_PX = LUNGE_FORWARD_DIST_PX * 0.85;
export const LUNGE_IMPACT_HANDOFF_SEC = 0.08;

export function evaluateCubicBezier(t, x1, y1, x2, y2) {
  const input = Math.max(0, Math.min(1, Number(t || 0)));
  const cubic = (p0, p1, p2, p3, value) => {
    const inv = 1 - value;
    return (inv ** 3 * p0)
      + (3 * inv * inv * value * p1)
      + (3 * inv * value * value * p2)
      + (value ** 3 * p3);
  };
  const derivative = (p0, p1, p2, p3, value) => {
    const inv = 1 - value;
    return (3 * inv * inv * (p1 - p0))
      + (6 * inv * value * (p2 - p1))
      + (3 * value * value * (p3 - p2));
  };
  let param = input;
  for (let i = 0; i < 6; i += 1) {
    const xError = cubic(0, x1, x2, 1, param) - input;
    const slope = derivative(0, x1, x2, 1, param);
    if (Math.abs(xError) < 1e-6 || Math.abs(slope) < 1e-6) break;
    param = Math.max(0, Math.min(1, param - (xError / slope)));
  }
  return cubic(0, y1, y2, 1, param);
}

export function easeLungeForward(t) {
  return evaluateCubicBezier(t, 1, 0, 0, 1);
}
