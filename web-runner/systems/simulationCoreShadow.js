const DEFAULT_WASM_URL = './assets/simulation_core.wasm';
const SHADOW_STATE_KEY = '__ORKA_SIMULATION_CORE_SHADOW__';

function getShadowState() {
  if (typeof window === 'undefined') {
    return {
      status: 'unavailable',
      mismatches: [],
      singleHitChecks: 0,
    };
  }
  if (!window[SHADOW_STATE_KEY]) {
    window.__ORKA_SIMULATION_CORE_SHADOW__ = {
      status: 'idle',
      mismatches: [],
      singleHitChecks: 0,
      lastCheck: null,
      lastSingleHitCheck: null,
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
}

function hasRequiredExports(exports) {
  return typeof exports?.combat_power_shadow === 'function'
    && typeof exports?.single_hit_damage_shadow === 'function'
    && typeof exports?.single_hit_applied_damage_shadow === 'function'
    && typeof exports?.single_hit_after_hp_shadow === 'function';
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
