const DEFAULT_WASM_URL = './assets/simulation_core.wasm';
const SHADOW_STATE_KEY = '__ORKA_SIMULATION_CORE_SHADOW__';

function getShadowState() {
  if (typeof window === 'undefined') {
    return {
      status: 'unavailable',
      mismatches: [],
      singleHitChecks: 0,
      turnSummaryChecks: 0,
      enemyDotTickChecks: 0,
      seededRngChecks: 0,
    };
  }
  if (!window[SHADOW_STATE_KEY]) {
    window.__ORKA_SIMULATION_CORE_SHADOW__ = {
      status: 'idle',
      mismatches: [],
      singleHitChecks: 0,
      turnSummaryChecks: 0,
      enemyDotTickChecks: 0,
      seededRngChecks: 0,
      lastCheck: null,
      lastSingleHitCheck: null,
      lastTurnSummaryCheck: null,
      lastEnemyDotTickCheck: null,
      lastSeededRngCheck: null,
      exports: null,
    };
  }
  return window[SHADOW_STATE_KEY];
}

function updateShadowDomMarker(shadow) {
  if (typeof document === 'undefined' || !document.documentElement) return;
  document.documentElement.dataset.simCoreShadowStatus = String(shadow?.status || 'unknown');
  document.documentElement.dataset.simCoreShadowMismatches = String(
    Array.isArray(shadow?.mismatches) ? shadow.mismatches.length : 0,
  );
  document.documentElement.dataset.simCoreShadowSingleHitChecks = String(
    Number(shadow?.singleHitChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowTurnSummaryChecks = String(
    Number(shadow?.turnSummaryChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEnemyDotTickChecks = String(
    Number(shadow?.enemyDotTickChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowSeededRngChecks = String(
    Number(shadow?.seededRngChecks || 0),
  );
}

function hasRequiredExports(exports) {
  return typeof exports?.combat_power_shadow === 'function'
    && typeof exports?.seeded_rng_next_state_shadow === 'function'
    && typeof exports?.seeded_rng_next_value_shadow === 'function'
    && typeof exports?.seeded_rng_index_shadow === 'function'
    && typeof exports?.single_hit_damage_shadow === 'function'
    && typeof exports?.single_hit_applied_damage_shadow === 'function'
    && typeof exports?.single_hit_after_hp_shadow === 'function'
    && typeof exports?.turn_summary_code_shadow === 'function'
    && typeof exports?.enemy_dot_tick_damage_shadow === 'function'
    && typeof exports?.enemy_dot_tick_total_remaining_shadow === 'function'
    && typeof exports?.enemy_dot_tick_remaining_fires_shadow === 'function'
    && typeof exports?.enemy_dot_tick_next_turn_shadow === 'function';
}

async function instantiateWasm(wasmUrl) {
  if (WebAssembly.instantiateStreaming) {
    try {
      const result = await WebAssembly.instantiateStreaming(fetch(wasmUrl), {});
      return result.instance;
    } catch (_) {
      // Some local servers or browsers reject streaming when MIME checks are strict.
    }
  }
  const response = await fetch(wasmUrl);
  const bytes = await response.arrayBuffer();
  const result = await WebAssembly.instantiate(bytes, {});
  return result.instance;
}

export function initializeSimulationCoreShadow({ wasmUrl = DEFAULT_WASM_URL } = {}) {
  const shadow = getShadowState();
  if (typeof window !== 'undefined') {
    window.__ORKA_SINGLE_HIT_SHADOW__ = shadowSingleHitResolution;
    window.__ORKA_TURN_SUMMARY_SHADOW__ = shadowTurnSummary;
    window.__ORKA_ENEMY_DOT_TICK_SHADOW__ = shadowEnemyDotTick;
    window.__ORKA_SEEDED_RNG_SHADOW__ = shadowSeededRng;
  }
  if (shadow.status === 'ready' || shadow.status === 'loading') return shadow.readyPromise || null;
  if (typeof window === 'undefined' || typeof WebAssembly === 'undefined' || typeof fetch !== 'function') {
    shadow.status = 'unavailable';
    updateShadowDomMarker(shadow);
    return null;
  }
  shadow.status = 'loading';
  updateShadowDomMarker(shadow);
  shadow.readyPromise = instantiateWasm(wasmUrl)
    .then((instance) => {
      shadow.exports = instance.exports;
      shadow.status = hasRequiredExports(shadow.exports) ? 'ready' : 'missing-export';
      updateShadowDomMarker(shadow);
      return shadow;
    })
    .catch((error) => {
      shadow.status = 'error';
      shadow.error = String(error?.message || error || 'unknown');
      updateShadowDomMarker(shadow);
      return shadow;
    });
  return shadow.readyPromise;
}

export function shadowCombatPower({ source = 'unknown', atk = 0, def = 0, hp = 0, jsValue = 0 } = {}) {
  const shadow = getShadowState();
  if (shadow.status !== 'ready' || !shadow.exports) return jsValue;
  const rustValue = Number(shadow.exports.combat_power_shadow(Number(atk || 0), Number(def || 0), Number(hp || 0)));
  shadow.lastCheck = {
    source,
    atk: Number(atk || 0),
    def: Number(def || 0),
    hp: Number(hp || 0),
    jsValue,
    rustValue,
  };
  if (Math.abs(rustValue - jsValue) > 0.000001) {
    shadow.mismatches.push(shadow.lastCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastCheck);
  }
  updateShadowDomMarker(shadow);
  return jsValue;
}

export function shadowSeededRng({
  source = 'unknown',
  seed = 1,
  draws = 1,
  size = 1,
  jsState = 0,
  jsValue = 0,
  jsIndex = 0,
} = {}) {
  const shadow = getShadowState();
  if (shadow.status !== 'ready' || !hasRequiredExports(shadow.exports)) return jsValue;
  const normalizedSeed = Number(seed || 0);
  const normalizedDraws = Number(draws || 0);
  const normalizedSize = Number(size || 0);
  const rustState = Number(shadow.exports.seeded_rng_next_state_shadow(normalizedSeed, normalizedDraws));
  const rustValue = Number(shadow.exports.seeded_rng_next_value_shadow(normalizedSeed, normalizedDraws));
  const rustIndex = Number(shadow.exports.seeded_rng_index_shadow(
    normalizedSeed,
    normalizedDraws,
    normalizedSize,
  ));
  shadow.seededRngChecks = Number(shadow.seededRngChecks || 0) + 1;
  shadow.lastSeededRngCheck = {
    source,
    seed: normalizedSeed,
    draws: normalizedDraws,
    size: normalizedSize,
    jsState: Number(jsState || 0),
    rustState,
    jsValue: Number(jsValue || 0),
    rustValue,
    jsIndex: Number(jsIndex || 0),
    rustIndex,
  };
  if (
    Math.abs(rustState - Number(jsState || 0)) > 0.000001
    || Math.abs(rustValue - Number(jsValue || 0)) > 0.000001
    || Math.abs(rustIndex - Number(jsIndex || 0)) > 0.000001
  ) {
    shadow.mismatches.push(shadow.lastSeededRngCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastSeededRngCheck);
  }
  updateShadowDomMarker(shadow);
  return jsValue;
}

export function shadowTurnSummary({
  source = 'unknown',
  heroCount = 0,
  heroHp = [],
  enemyCount = 0,
  enemyHp = [],
  jsCode = 0,
  jsValue = 0,
} = {}) {
  const shadow = getShadowState();
  if (shadow.status !== 'ready' || !hasRequiredExports(shadow.exports)) return jsValue;
  const heroes = Array.isArray(heroHp) ? heroHp : [];
  const enemies = Array.isArray(enemyHp) ? enemyHp : [];
  const heroValues = [0, 1, 2, 3].map((index) => Number(heroes[index] || 0));
  const enemyValues = [0, 1, 2, 3].map((index) => Number(enemies[index] || 0));
  const rustCode = Number(shadow.exports.turn_summary_code_shadow(
    Number(heroCount || 0),
    heroValues[0],
    heroValues[1],
    heroValues[2],
    heroValues[3],
    Number(enemyCount || 0),
    enemyValues[0],
    enemyValues[1],
    enemyValues[2],
    enemyValues[3],
  ));
  shadow.turnSummaryChecks = Number(shadow.turnSummaryChecks || 0) + 1;
  shadow.lastTurnSummaryCheck = {
    source,
    heroCount: Number(heroCount || 0),
    heroHp: heroValues,
    enemyCount: Number(enemyCount || 0),
    enemyHp: enemyValues,
    jsCode: Number(jsCode || 0),
    rustCode,
  };
  if (Math.abs(rustCode - Number(jsCode || 0)) > 0.000001) {
    shadow.mismatches.push(shadow.lastTurnSummaryCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastTurnSummaryCheck);
  }
  updateShadowDomMarker(shadow);
  return jsValue;
}

export function shadowSingleHitResolution({
  source = 'unknown',
  power = 0,
  resist = 0,
  roll01 = 0,
  critRoll01 = 0,
  sourceIsHero = 0,
  heroAoe = 0,
  chainActive = 0,
  chainMultiplier = 1,
  targetHp = 0,
  shield = 0,
  jsDamage = 0,
  jsAppliedDamage = 0,
  jsAfterHp = 0,
  jsValue = 0,
} = {}) {
  const shadow = getShadowState();
  if (shadow.status !== 'ready' || !hasRequiredExports(shadow.exports)) return jsValue;
  const rustDamage = Number(shadow.exports.single_hit_damage_shadow(
    Number(power || 0),
    Number(resist || 0),
    Number(roll01 || 0),
    Number(critRoll01 || 0),
    Number(sourceIsHero || 0),
    Number(heroAoe || 0),
    Number(chainActive || 0),
    Number(chainMultiplier || 1),
  ));
  const rustAppliedDamage = Number(shadow.exports.single_hit_applied_damage_shadow(
    Number(targetHp || 0),
    rustDamage,
    Number(shield || 0),
  ));
  const rustAfterHp = Number(shadow.exports.single_hit_after_hp_shadow(
    Number(targetHp || 0),
    rustDamage,
    Number(shield || 0),
  ));
  shadow.singleHitChecks = Number(shadow.singleHitChecks || 0) + 1;
  shadow.lastSingleHitCheck = {
    source,
    power: Number(power || 0),
    resist: Number(resist || 0),
    roll01: Number(roll01 || 0),
    critRoll01: Number(critRoll01 || 0),
    sourceIsHero: Number(sourceIsHero || 0),
    heroAoe: Number(heroAoe || 0),
    chainActive: Number(chainActive || 0),
    chainMultiplier: Number(chainMultiplier || 1),
    targetHp: Number(targetHp || 0),
    shield: Number(shield || 0),
    jsDamage,
    rustDamage,
    jsAppliedDamage,
    rustAppliedDamage,
    jsAfterHp,
    rustAfterHp,
  };
  if (
    Math.abs(rustDamage - jsDamage) > 0.000001
    || Math.abs(rustAppliedDamage - jsAppliedDamage) > 0.000001
    || Math.abs(rustAfterHp - jsAfterHp) > 0.000001
  ) {
    shadow.mismatches.push(shadow.lastSingleHitCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastSingleHitCheck);
  }
  updateShadowDomMarker(shadow);
  return jsValue;
}

export function shadowEnemyDotTick({
  source = 'unknown',
  totalDamageRemaining = 0,
  remainingFires = 0,
  damagePerFire = 0,
  hasTotalDamageRemaining = 0,
  nextFireTurnSerial = 0,
  firesEveryTurns = 1,
  jsDamage = 0,
  jsTotalDamageRemaining = 0,
  jsRemainingFires = 0,
  jsNextFireTurnSerial = 0,
  jsValue = 0,
} = {}) {
  const shadow = getShadowState();
  if (shadow.status !== 'ready' || !hasRequiredExports(shadow.exports)) return jsValue;
  const rustDamage = Number(shadow.exports.enemy_dot_tick_damage_shadow(
    Number(totalDamageRemaining || 0),
    Number(remainingFires || 0),
    Number(damagePerFire || 0),
    Number(hasTotalDamageRemaining || 0),
  ));
  const rustTotalDamageRemaining = Number(shadow.exports.enemy_dot_tick_total_remaining_shadow(
    Number(totalDamageRemaining || 0),
    Number(remainingFires || 0),
    Number(damagePerFire || 0),
    Number(hasTotalDamageRemaining || 0),
  ));
  const rustRemainingFires = Number(shadow.exports.enemy_dot_tick_remaining_fires_shadow(
    Number(remainingFires || 0),
  ));
  const rustNextFireTurnSerial = Number(shadow.exports.enemy_dot_tick_next_turn_shadow(
    Number(nextFireTurnSerial || 0),
    Number(firesEveryTurns || 1),
  ));
  shadow.enemyDotTickChecks = Number(shadow.enemyDotTickChecks || 0) + 1;
  shadow.lastEnemyDotTickCheck = {
    source,
    totalDamageRemaining: Number(totalDamageRemaining || 0),
    remainingFires: Number(remainingFires || 0),
    damagePerFire: Number(damagePerFire || 0),
    hasTotalDamageRemaining: Number(hasTotalDamageRemaining || 0),
    nextFireTurnSerial: Number(nextFireTurnSerial || 0),
    firesEveryTurns: Number(firesEveryTurns || 1),
    jsDamage: Number(jsDamage || 0),
    rustDamage,
    jsTotalDamageRemaining: Number(jsTotalDamageRemaining || 0),
    rustTotalDamageRemaining,
    jsRemainingFires: Number(jsRemainingFires || 0),
    rustRemainingFires,
    jsNextFireTurnSerial: Number(jsNextFireTurnSerial || 0),
    rustNextFireTurnSerial,
  };
  if (
    Math.abs(rustDamage - Number(jsDamage || 0)) > 0.000001
    || Math.abs(rustTotalDamageRemaining - Number(jsTotalDamageRemaining || 0)) > 0.000001
    || Math.abs(rustRemainingFires - Number(jsRemainingFires || 0)) > 0.000001
    || Math.abs(rustNextFireTurnSerial - Number(jsNextFireTurnSerial || 0)) > 0.000001
  ) {
    shadow.mismatches.push(shadow.lastEnemyDotTickCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastEnemyDotTickCheck);
  }
  updateShadowDomMarker(shadow);
  return jsValue;
}
