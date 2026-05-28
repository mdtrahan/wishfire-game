export const HP_TEXT_ROLL_DURATION_SEC = 0.34;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function normalizeHp(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function easeOutCubic(t) {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

export function formatHpRollText(currentHp, maxHp) {
  return `${normalizeHp(currentHp)} / ${normalizeHp(maxHp)}`;
}

export function updateHpTextRollState(state, options = {}) {
  const roll = state && typeof state === 'object' ? state : {};
  const targetHp = normalizeHp(options.currentHp);
  const maxHp = normalizeHp(options.maxHp);
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : 0;
  const durationSec = Math.max(0.001, Number(options.durationSec || HP_TEXT_ROLL_DURATION_SEC));
  const targetChanged = roll.targetHp !== targetHp || roll.maxHp !== maxHp;

  if (targetChanged) {
    const previousDisplay = Number.isFinite(Number(roll.displayHp))
      ? normalizeHp(roll.displayHp)
      : (Number.isFinite(Number(roll.targetHp)) ? normalizeHp(roll.targetHp) : targetHp);
    const startHp = roll.initialized ? previousDisplay : targetHp;
    roll.initialized = true;
    roll.fromHp = startHp;
    roll.targetHp = targetHp;
    roll.maxHp = maxHp;
    roll.startedAt = now;
    roll.durationSec = durationSec;
    roll.displayHp = startHp;
  }

  const fromHp = normalizeHp(roll.fromHp ?? targetHp);
  const elapsed = Math.max(0, now - Number(roll.startedAt || 0));
  const activeDurationSec = Math.max(0.001, Number(roll.durationSec || durationSec));
  const progress = elapsed >= activeDurationSec - 0.000001
    ? 1
    : clamp01(elapsed / activeDurationSec);
  const active = progress < 1 && fromHp !== targetHp;
  const displayHp = active
    ? normalizeHp(fromHp + (targetHp - fromHp) * easeOutCubic(progress))
    : targetHp;

  roll.displayHp = displayHp;
  if (!active) {
    roll.fromHp = targetHp;
    roll.startedAt = now;
  }

  return {
    displayHp,
    targetHp,
    maxHp,
    active,
    text: formatHpRollText(displayHp, maxHp),
  };
}
