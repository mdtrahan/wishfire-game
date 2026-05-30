export const RUNA_MAGIC_RESIST_TRIGGER_CHANCE = 0.6;
export const RUNA_MAGIC_RESIST_NULLIFY_CHANCE = 0.35;
export const RUNA_MAGIC_RESIST_REDUCE_FACTOR = 0.2;

export const RUNA_MAGIC_RESIST_MODE_CODES = Object.freeze({
  not_runa: 0,
  no_proc: 1,
  nullify: 2,
  heavy_resist: 3,
});

export const RUNA_MAGIC_RESIST_MODE_IDS = Object.freeze([
  'not_runa',
  'no_proc',
  'nullify',
  'heavy_resist',
]);

function numberOr(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function readRoll(rollSource = Math.random, fallback = 0) {
  const value = Number(typeof rollSource === 'function' ? rollSource() : fallback);
  return Number.isFinite(value) ? value : fallback;
}

export function runaMagicResistModeFromCode(code = 0) {
  return RUNA_MAGIC_RESIST_MODE_IDS[Math.max(0, Math.trunc(numberOr(code, 0)))] || 'not_runa';
}

export function runaMagicResistModeCodeFromId(mode = '') {
  return RUNA_MAGIC_RESIST_MODE_CODES[String(mode || '')] ?? RUNA_MAGIC_RESIST_MODE_CODES.not_runa;
}

export function runaMagicResistFromJs({
  targetIsRuna = 0,
  incomingDamage = 0,
  triggerRoll = null,
  nullifyRoll = null,
  rollSource = Math.random,
} = {}) {
  const baseDamage = Math.max(0, numberOr(incomingDamage, 0));
  if (Number(targetIsRuna || 0) !== 1) {
    return {
      owner: 'fallback',
      mode: 'not_runa',
      modeCode: RUNA_MAGIC_RESIST_MODE_CODES.not_runa,
      finalDamage: baseDamage,
      incomingDamage: baseDamage,
    };
  }

  const trigger = triggerRoll == null ? readRoll(rollSource, 0) : numberOr(triggerRoll, 0);
  if (trigger >= RUNA_MAGIC_RESIST_TRIGGER_CHANCE) {
    return {
      owner: 'fallback',
      mode: 'no_proc',
      modeCode: RUNA_MAGIC_RESIST_MODE_CODES.no_proc,
      finalDamage: baseDamage,
      incomingDamage: baseDamage,
      triggerRoll: trigger,
    };
  }

  const nullify = nullifyRoll == null ? readRoll(rollSource, 0) : numberOr(nullifyRoll, 0);
  const didNullify = nullify < RUNA_MAGIC_RESIST_NULLIFY_CHANCE;
  const finalDamage = didNullify ? 0 : Math.max(1, Math.floor(baseDamage * RUNA_MAGIC_RESIST_REDUCE_FACTOR));
  const mode = didNullify ? 'nullify' : 'heavy_resist';
  return {
    owner: 'fallback',
    mode,
    modeCode: runaMagicResistModeCodeFromId(mode),
    finalDamage,
    incomingDamage: baseDamage,
    triggerRoll: trigger,
    nullifyRoll: nullify,
  };
}

export function resolveRunaMagicResist({
  targetIsRuna = 0,
  incomingDamage = 0,
  rollSource = Math.random,
  ownerHook = null,
} = {}) {
  const jsDecision = runaMagicResistFromJs({
    targetIsRuna,
    incomingDamage,
    rollSource,
  });

  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({
        targetIsRuna: Number(targetIsRuna || 0) === 1 ? 1 : 0,
        incomingDamage: jsDecision.incomingDamage,
        triggerRoll: numberOr(jsDecision.triggerRoll, 0),
        nullifyRoll: numberOr(jsDecision.nullifyRoll, 0),
        jsFinalDamage: jsDecision.finalDamage,
        jsModeCode: jsDecision.modeCode,
      });
      const finalDamage = Number(result?.finalDamage);
      const modeCode = Number(result?.modeCode);
      if (Number.isFinite(finalDamage) && Number.isFinite(modeCode)) {
        const mode = runaMagicResistModeFromCode(modeCode);
        return {
          owner: String(result?.owner || 'rust'),
          mode,
          modeCode,
          finalDamage,
          incomingDamage: jsDecision.incomingDamage,
          triggerRoll: jsDecision.triggerRoll,
          nullifyRoll: jsDecision.nullifyRoll,
          jsDecision,
        };
      }
    } catch (_) {
      // Fall back to the local JS projection if the owner hook is unavailable or unhealthy.
    }
  }

  return {
    ...jsDecision,
    jsDecision,
  };
}
