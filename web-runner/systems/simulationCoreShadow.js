const DEFAULT_WASM_URL = './assets/simulation_core.wasm';
const SHADOW_STATE_KEY = '__ORKA_SIMULATION_CORE_SHADOW__';

function getShadowState() {
  if (typeof window === 'undefined') {
    return {
      status: 'unavailable',
      mismatches: [],
      singleHitChecks: 0,
      singleHitOwnerChecks: 0,
      partyDamageOwnerChecks: 0,
      turnSummaryChecks: 0,
      turnSummaryOwnerChecks: 0,
      enemyDotPacketOwnerChecks: 0,
      enemyDotTickChecks: 0,
      enemyDotTickOwnerChecks: 0,
      enemyDotLifecycleOwnerChecks: 0,
      enemyDebuffDecayOwnerChecks: 0,
      enemyDebuffApplyOwnerChecks: 0,
      enemyDebuffSlotOwnerChecks: 0,
      seededRngChecks: 0,
      seededRngOwnerChecks: 0,
      singleHitOwnerSmokeRan: false,
      partyDamageOwnerSmokeRan: false,
      turnSummaryOwnerSmokeRan: false,
      enemyDotPacketOwnerSmokeRan: false,
      enemyDotTickOwnerSmokeRan: false,
      enemyDotLifecycleOwnerSmokeRan: false,
      enemyDebuffDecayOwnerSmokeRan: false,
      enemyDebuffApplyOwnerSmokeRan: false,
      enemyDebuffSlotOwnerSmokeRan: false,
    };
  }
  if (!window[SHADOW_STATE_KEY]) {
    window.__ORKA_SIMULATION_CORE_SHADOW__ = {
      status: 'idle',
      mismatches: [],
      singleHitChecks: 0,
      singleHitOwnerChecks: 0,
      partyDamageOwnerChecks: 0,
      turnSummaryChecks: 0,
      turnSummaryOwnerChecks: 0,
      enemyDotPacketOwnerChecks: 0,
      enemyDotTickChecks: 0,
      enemyDotTickOwnerChecks: 0,
      enemyDotLifecycleOwnerChecks: 0,
      enemyDebuffDecayOwnerChecks: 0,
      enemyDebuffApplyOwnerChecks: 0,
      enemyDebuffSlotOwnerChecks: 0,
      seededRngChecks: 0,
      seededRngOwnerChecks: 0,
      singleHitOwnerSmokeRan: false,
      partyDamageOwnerSmokeRan: false,
      turnSummaryOwnerSmokeRan: false,
      enemyDotPacketOwnerSmokeRan: false,
      enemyDotTickOwnerSmokeRan: false,
      enemyDotLifecycleOwnerSmokeRan: false,
      enemyDebuffDecayOwnerSmokeRan: false,
      enemyDebuffApplyOwnerSmokeRan: false,
      enemyDebuffSlotOwnerSmokeRan: false,
      lastCheck: null,
      lastSingleHitCheck: null,
      lastSingleHitOwnerCheck: null,
      lastPartyDamageOwnerCheck: null,
      lastTurnSummaryCheck: null,
      lastTurnSummaryOwnerCheck: null,
      lastEnemyDotPacketOwnerCheck: null,
      lastEnemyDotTickCheck: null,
      lastEnemyDotTickOwnerCheck: null,
      lastEnemyDotLifecycleOwnerCheck: null,
      lastEnemyDebuffDecayOwnerCheck: null,
      lastEnemyDebuffApplyOwnerCheck: null,
      lastEnemyDebuffSlotOwnerCheck: null,
      lastSeededRngCheck: null,
      lastSeededRngOwnerCheck: null,
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
  document.documentElement.dataset.simCoreShadowSingleHitOwnerChecks = String(
    Number(shadow?.singleHitOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowSingleHitOwner = String(
    shadow?.lastSingleHitOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowPartyDamageOwnerChecks = String(
    Number(shadow?.partyDamageOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowPartyDamageOwner = String(
    shadow?.lastPartyDamageOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowTurnSummaryChecks = String(
    Number(shadow?.turnSummaryChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowTurnSummaryOwnerChecks = String(
    Number(shadow?.turnSummaryOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowTurnSummaryOwner = String(
    shadow?.lastTurnSummaryOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowEnemyDotPacketOwnerChecks = String(
    Number(shadow?.enemyDotPacketOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEnemyDotPacketOwner = String(
    shadow?.lastEnemyDotPacketOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowEnemyDotTickChecks = String(
    Number(shadow?.enemyDotTickChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEnemyDotTickOwnerChecks = String(
    Number(shadow?.enemyDotTickOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEnemyDotTickOwner = String(
    shadow?.lastEnemyDotTickOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowEnemyDotLifecycleOwnerChecks = String(
    Number(shadow?.enemyDotLifecycleOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEnemyDotLifecycleOwner = String(
    shadow?.lastEnemyDotLifecycleOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowEnemyDebuffDecayOwnerChecks = String(
    Number(shadow?.enemyDebuffDecayOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEnemyDebuffDecayOwner = String(
    shadow?.lastEnemyDebuffDecayOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowEnemyDebuffApplyOwnerChecks = String(
    Number(shadow?.enemyDebuffApplyOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEnemyDebuffApplyOwner = String(
    shadow?.lastEnemyDebuffApplyOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowEnemyDebuffSlotOwnerChecks = String(
    Number(shadow?.enemyDebuffSlotOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowEnemyDebuffSlotOwner = String(
    shadow?.lastEnemyDebuffSlotOwnerCheck?.owner || '',
  );
  document.documentElement.dataset.simCoreShadowSeededRngChecks = String(
    Number(shadow?.seededRngChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowSeededRngOwnerChecks = String(
    Number(shadow?.seededRngOwnerChecks || 0),
  );
  document.documentElement.dataset.simCoreShadowSeededRngOwner = String(
    shadow?.lastSeededRngOwnerCheck?.owner || '',
  );
}

function hasSeededRngExports(exports) {
  return typeof exports?.seeded_rng_next_state_shadow === 'function'
    && typeof exports?.seeded_rng_next_value_shadow === 'function'
    && typeof exports?.seeded_rng_index_shadow === 'function';
}

function hasSingleHitExports(exports) {
  return typeof exports?.single_hit_damage_shadow === 'function'
    && typeof exports?.single_hit_applied_damage_shadow === 'function'
    && typeof exports?.single_hit_after_hp_shadow === 'function';
}

function hasPartyDamageExports(exports) {
  return typeof exports?.party_damage_absorbed_shadow === 'function'
    && typeof exports?.party_damage_after_shield_shadow === 'function'
    && typeof exports?.party_damage_shield_after_shadow === 'function'
    && typeof exports?.party_damage_hero_after_hp_shadow === 'function'
    && typeof exports?.party_damage_party_hp_after_shadow === 'function';
}

function hasEnemyDotTickExports(exports) {
  return typeof exports?.enemy_dot_tick_damage_shadow === 'function'
    && typeof exports?.enemy_dot_tick_total_remaining_shadow === 'function'
    && typeof exports?.enemy_dot_tick_remaining_fires_shadow === 'function'
    && typeof exports?.enemy_dot_tick_next_turn_shadow === 'function';
}

function hasEnemyDotPacketExports(exports) {
  return typeof exports?.enemy_dot_packet_target_uid_shadow === 'function'
    && typeof exports?.enemy_dot_packet_source_uid_shadow === 'function'
    && typeof exports?.enemy_dot_packet_remaining_fires_shadow === 'function'
    && typeof exports?.enemy_dot_packet_total_damage_remaining_shadow === 'function'
    && typeof exports?.enemy_dot_packet_fires_every_ticks_shadow === 'function'
    && typeof exports?.enemy_dot_packet_next_fire_tick_shadow === 'function'
    && typeof exports?.enemy_dot_packet_fires_every_turns_shadow === 'function'
    && typeof exports?.enemy_dot_packet_next_fire_turn_serial_shadow === 'function'
    && typeof exports?.enemy_dot_packet_last_processed_turn_serial_shadow === 'function';
}

function hasEnemyDotLifecycleExports(exports) {
  return typeof exports?.enemy_dot_lifecycle_action_shadow === 'function';
}

function hasEnemyDebuffDecayExports(exports) {
  return typeof exports?.enemy_debuff_turns_after_tick_shadow === 'function'
    && typeof exports?.enemy_debuff_amount_after_tick_shadow === 'function'
    && typeof exports?.enemy_debuff_active_after_tick_shadow === 'function';
}

function hasEnemyDebuffApplyExports(exports) {
  return typeof exports?.enemy_debuff_apply_amount_after_shadow === 'function'
    && typeof exports?.enemy_debuff_apply_turns_after_shadow === 'function'
    && typeof exports?.enemy_debuff_apply_active_shadow === 'function';
}

function hasEnemyDebuffSlotExports(exports) {
  return typeof exports?.enemy_debuff_slot_transition_action_shadow === 'function'
    && typeof exports?.enemy_debuff_slot_transition_drop_slot_index_shadow === 'function'
    && typeof exports?.enemy_debuff_slot_transition_append_slot_index_shadow === 'function';
}

function hasTurnSummaryExports(exports) {
  return typeof exports?.turn_summary_code_shadow === 'function';
}

function hasRequiredExports(exports) {
  return typeof exports?.combat_power_shadow === 'function'
    && hasSeededRngExports(exports)
    && hasSingleHitExports(exports)
    && hasPartyDamageExports(exports)
    && hasTurnSummaryExports(exports)
    && hasEnemyDotPacketExports(exports)
    && hasEnemyDotTickExports(exports)
    && hasEnemyDotLifecycleExports(exports)
    && hasEnemyDebuffDecayExports(exports)
    && hasEnemyDebuffApplyExports(exports)
    && hasEnemyDebuffSlotExports(exports);
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

function runSingleHitOwnerStartupCheck(shadow) {
  if (!shadow || shadow.singleHitOwnerSmokeRan) return;
  shadow.singleHitOwnerSmokeRan = true;
  createSimulationCoreSingleHitResolution({
    source: 'simulationCore.startup.singleHitOwner',
    power: 18,
    resist: 12,
    roll01: 0.5,
    critRoll01: 0.9,
    sourceIsHero: 1,
    heroAoe: 0,
    chainActive: 0,
    chainMultiplier: 1,
    targetHp: 40,
    shield: 0,
    jsDamage: 14,
    jsAppliedDamage: 14,
    jsAfterHp: 26,
  });
}

function runPartyDamageOwnerStartupCheck(shadow) {
  if (!shadow || shadow.partyDamageOwnerSmokeRan) return;
  shadow.partyDamageOwnerSmokeRan = true;
  createSimulationCorePartyDamageResolution({
    source: 'simulationCore.startup.partyDamageOwner',
    incomingDamage: 12,
    shield: 5,
    heroCount: 4,
    heroHp: [20, 16, 12, 8],
    jsAbsorbed: 5,
    jsDamageAfterShield: 7,
    jsShieldAfter: 0,
    jsHeroHp: [13, 9, 5, 1],
    jsPartyHp: 28,
  });
}

function runEnemyDotTickOwnerStartupCheck(shadow) {
  if (!shadow || shadow.enemyDotTickOwnerSmokeRan) return;
  shadow.enemyDotTickOwnerSmokeRan = true;
  createSimulationCoreEnemyDotTickResolution({
    source: 'simulationCore.startup.enemyDotTickOwner',
    totalDamageRemaining: 30,
    remainingFires: 3,
    damagePerFire: 0,
    hasTotalDamageRemaining: 1,
    nextFireTurnSerial: 10,
    firesEveryTurns: 2,
    jsDamage: 10,
    jsTotalDamageRemaining: 20,
    jsRemainingFires: 2,
    jsNextFireTurnSerial: 12,
  });
}

function runEnemyDotPacketOwnerStartupCheck(shadow) {
  if (!shadow || shadow.enemyDotPacketOwnerSmokeRan) return;
  shadow.enemyDotPacketOwnerSmokeRan = true;
  createSimulationCoreEnemyDotPacketResolution({
    source: 'simulationCore.startup.enemyDotPacketOwner',
    actorUID: 100,
    enemyUID: 200,
    totalDamage: 25,
    totalTicks: 3,
    nowTick: 4,
    nowTurnSerial: 20,
    firesEveryTicks: 1,
    startAfterTicks: 1,
    firesEveryTurns: 2,
    startAfterTurns: 3,
    cadence: 'turn',
    effectName: 'Blight',
    taintedGroundZoneId: '',
    jsTargetUID: 200,
    jsSourceUID: 100,
    jsRemainingFires: 3,
    jsTotalDamageRemaining: 25,
    jsFiresEveryTicks: 1,
    jsNextFireTick: 5,
    jsFiresEveryTurns: 2,
    jsNextFireTurnSerial: 23,
    jsLastProcessedTurnSerial: 20,
  });
}

function runEnemyDotLifecycleOwnerStartupCheck(shadow) {
  if (!shadow || shadow.enemyDotLifecycleOwnerSmokeRan) return;
  shadow.enemyDotLifecycleOwnerSmokeRan = true;
  createSimulationCoreEnemyDotLifecycleResolution({
    source: 'simulationCore.startup.enemyDotLifecycleOwner',
    cadenceIsTurn: 1,
    dotTargetUID: 200,
    targetUID: 200,
    remainingFires: 3,
    hasTotalDamageRemaining: 1,
    totalDamageRemaining: 30,
    targetAlive: 1,
    currentTurnSerial: 10,
    nextFireTurnSerial: 10,
    lastProcessedTurnSerial: 9,
    jsAction: 2,
  });
}

function runEnemyDebuffDecayOwnerStartupCheck(shadow) {
  if (!shadow || shadow.enemyDebuffDecayOwnerSmokeRan) return;
  shadow.enemyDebuffDecayOwnerSmokeRan = true;
  createSimulationCoreEnemyDebuffDecayResolution({
    source: 'simulationCore.startup.enemyDebuffDecayOwner',
    stat: 'ATK',
    amountBefore: 4,
    turnsBefore: 3,
    jsAmountAfter: 4,
    jsTurnsAfter: 2,
    jsActive: 1,
  });
}

function runEnemyDebuffApplyOwnerStartupCheck(shadow) {
  if (!shadow || shadow.enemyDebuffApplyOwnerSmokeRan) return;
  shadow.enemyDebuffApplyOwnerSmokeRan = true;
  createSimulationCoreEnemyDebuffApplyResolution({
    source: 'simulationCore.startup.enemyDebuffApplyOwner',
    stat: 'ATK',
    amountBefore: 4,
    turnsBefore: 1,
    addAmount: 2,
    durationTurns: 3,
    jsAmountAfter: 6,
    jsTurnsAfter: 3,
    jsActive: 1,
  });
}

function runEnemyDebuffSlotOwnerStartupCheck(shadow) {
  if (!shadow || shadow.enemyDebuffSlotOwnerSmokeRan) return;
  shadow.enemyDebuffSlotOwnerSmokeRan = true;
  createSimulationCoreEnemyDebuffSlotTransition({
    source: 'simulationCore.startup.enemyDebuffSlotOwner',
    stat: 'SPD',
    statIndex: 4,
    active: 1,
    slotCount: 3,
    slot0Index: 0,
    slot1Index: 1,
    slot2Index: 2,
    jsAction: 2,
    jsDropSlotIndex: 0,
    jsAppendSlotIndex: 4,
  });
}

function runTurnSummaryOwnerStartupCheck(shadow) {
  if (!shadow || shadow.turnSummaryOwnerSmokeRan) return;
  shadow.turnSummaryOwnerSmokeRan = true;
  createSimulationCoreTurnSummaryResolution({
    source: 'simulationCore.startup.turnSummaryOwner',
    heroCount: 4,
    heroHp: [10, 12, 8, 6],
    enemyCount: 3,
    enemyHp: [0, 0, 0, 0],
    jsCode: 400301,
  });
}

export function initializeSimulationCoreShadow({ wasmUrl = DEFAULT_WASM_URL } = {}) {
  const shadow = getShadowState();
  if (typeof window !== 'undefined') {
    window.__ORKA_SINGLE_HIT_SHADOW__ = shadowSingleHitResolution;
    window.__ORKA_SINGLE_HIT_OWNER__ = createSimulationCoreSingleHitResolution;
    window.__ORKA_PARTY_DAMAGE_OWNER__ = createSimulationCorePartyDamageResolution;
    window.__ORKA_TURN_SUMMARY_SHADOW__ = shadowTurnSummary;
    window.__ORKA_TURN_SUMMARY_OWNER__ = createSimulationCoreTurnSummaryResolution;
    window.__ORKA_ENEMY_DOT_PACKET_OWNER__ = createSimulationCoreEnemyDotPacketResolution;
    window.__ORKA_ENEMY_DOT_TICK_SHADOW__ = shadowEnemyDotTick;
    window.__ORKA_ENEMY_DOT_TICK_OWNER__ = createSimulationCoreEnemyDotTickResolution;
    window.__ORKA_ENEMY_DOT_LIFECYCLE_OWNER__ = createSimulationCoreEnemyDotLifecycleResolution;
    window.__ORKA_ENEMY_DEBUFF_DECAY_OWNER__ = createSimulationCoreEnemyDebuffDecayResolution;
    window.__ORKA_ENEMY_DEBUFF_APPLY_OWNER__ = createSimulationCoreEnemyDebuffApplyResolution;
    window.__ORKA_ENEMY_DEBUFF_SLOT_OWNER__ = createSimulationCoreEnemyDebuffSlotTransition;
    window.__ORKA_SEEDED_RNG_SHADOW__ = shadowSeededRng;
    window.__ORKA_SEEDED_RNG_OWNER__ = createSimulationCoreSeededRng;
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
      if (shadow.status === 'ready') {
        runSingleHitOwnerStartupCheck(shadow);
        runPartyDamageOwnerStartupCheck(shadow);
        runTurnSummaryOwnerStartupCheck(shadow);
        runEnemyDotPacketOwnerStartupCheck(shadow);
        runEnemyDotTickOwnerStartupCheck(shadow);
        runEnemyDotLifecycleOwnerStartupCheck(shadow);
        runEnemyDebuffDecayOwnerStartupCheck(shadow);
        runEnemyDebuffApplyOwnerStartupCheck(shadow);
        runEnemyDebuffSlotOwnerStartupCheck(shadow);
      }
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

function normalizeSeed(seed = 1) {
  const normalized = Number(seed || 1) >>> 0;
  return normalized || 1;
}

function createSeededRngFallback(seed = 1) {
  let state = normalizeSeed(seed);
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function createSimulationCoreSeededRng(seed = 1, {
  source = 'simulationCore.seededRng',
  exportsOverride = null,
} = {}) {
  const normalizedSeed = normalizeSeed(seed);
  const fallback = createSeededRngFallback(normalizedSeed);
  let draws = 0;
  return () => {
    draws += 1;
    const fallbackValue = fallback();
    const shadow = getShadowState();
    const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
    if (!hasSeededRngExports(exports)) {
      shadow.seededRngOwnerChecks = Number(shadow.seededRngOwnerChecks || 0) + 1;
      shadow.lastSeededRngOwnerCheck = {
        source,
        owner: 'fallback',
        seed: normalizedSeed,
        draws,
        value: fallbackValue,
      };
      updateShadowDomMarker(shadow);
      return fallbackValue;
    }

    const rustState = Number(exports.seeded_rng_next_state_shadow(normalizedSeed, draws));
    const rustValue = Number(exports.seeded_rng_next_value_shadow(normalizedSeed, draws));
    shadow.seededRngOwnerChecks = Number(shadow.seededRngOwnerChecks || 0) + 1;
    shadow.lastSeededRngOwnerCheck = {
      source,
      owner: 'rust',
      seed: normalizedSeed,
      draws,
      fallbackValue,
      rustState,
      rustValue,
    };
    if (Math.abs(rustValue - fallbackValue) > 0.000001 && !exportsOverride) {
      shadow.mismatches.push(shadow.lastSeededRngOwnerCheck);
      if (shadow.mismatches.length > 20) shadow.mismatches.shift();
      console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastSeededRngOwnerCheck);
    }
    updateShadowDomMarker(shadow);
    return rustValue;
  };
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
  if (shadow.status !== 'ready' || !hasSeededRngExports(shadow.exports)) return jsValue;
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

export function createSimulationCorePartyDamageResolution({
  source = 'unknown',
  incomingDamage = 0,
  shield = 0,
  heroCount = 0,
  heroHp = [],
  jsAbsorbed = 0,
  jsDamageAfterShield = 0,
  jsShieldAfter = 0,
  jsHeroHp = [],
  jsPartyHp = 0,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const heroes = Array.isArray(heroHp) ? heroHp : [];
  const jsHeroes = Array.isArray(jsHeroHp) ? jsHeroHp : [];
  const normalized = {
    source,
    incomingDamage: Number(incomingDamage || 0),
    shield: Number(shield || 0),
    heroCount: Number(heroCount || 0),
    heroHp: [0, 1, 2, 3].map((index) => Number(heroes[index] || 0)),
    jsAbsorbed: Number(jsAbsorbed || 0),
    jsDamageAfterShield: Number(jsDamageAfterShield || 0),
    jsShieldAfter: Number(jsShieldAfter || 0),
    jsHeroHp: [0, 1, 2, 3].map((index) => Number(jsHeroes[index] || 0)),
    jsPartyHp: Number(jsPartyHp || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasPartyDamageExports(exports)) {
    shadow.partyDamageOwnerChecks = Number(shadow.partyDamageOwnerChecks || 0) + 1;
    shadow.lastPartyDamageOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      absorbed: normalized.jsAbsorbed,
      damageAfterShield: normalized.jsDamageAfterShield,
      shieldAfter: normalized.jsShieldAfter,
      heroHp: normalized.jsHeroHp,
      partyHp: normalized.jsPartyHp,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      absorbed: normalized.jsAbsorbed,
      damageAfterShield: normalized.jsDamageAfterShield,
      shieldAfter: normalized.jsShieldAfter,
      heroHp: normalized.jsHeroHp,
      partyHp: normalized.jsPartyHp,
    };
  }

  const rustAbsorbed = Number(exports.party_damage_absorbed_shadow(
    normalized.incomingDamage,
    normalized.shield,
  ));
  const rustDamageAfterShield = Number(exports.party_damage_after_shield_shadow(
    normalized.incomingDamage,
    normalized.shield,
  ));
  const rustShieldAfter = Number(exports.party_damage_shield_after_shadow(
    normalized.incomingDamage,
    normalized.shield,
  ));
  const rustHeroHp = normalized.heroHp.map((hp) => Number(exports.party_damage_hero_after_hp_shadow(
    hp,
    rustDamageAfterShield,
  )));
  const rustPartyHp = Number(exports.party_damage_party_hp_after_shadow(
    normalized.heroCount,
    normalized.heroHp[0],
    normalized.heroHp[1],
    normalized.heroHp[2],
    normalized.heroHp[3],
    rustDamageAfterShield,
  ));
  shadow.partyDamageOwnerChecks = Number(shadow.partyDamageOwnerChecks || 0) + 1;
  shadow.lastPartyDamageOwnerCheck = {
    ...normalized,
    owner: 'rust',
    absorbed: rustAbsorbed,
    damageAfterShield: rustDamageAfterShield,
    shieldAfter: rustShieldAfter,
    heroHp: rustHeroHp,
    partyHp: rustPartyHp,
  };
  const heroHpMismatch = rustHeroHp.some((hp, index) =>
    Math.abs(hp - Number(normalized.jsHeroHp[index] || 0)) > 0.000001
  );
  if (
    !exportsOverride
    && (
      Math.abs(rustAbsorbed - normalized.jsAbsorbed) > 0.000001
      || Math.abs(rustDamageAfterShield - normalized.jsDamageAfterShield) > 0.000001
      || Math.abs(rustShieldAfter - normalized.jsShieldAfter) > 0.000001
      || heroHpMismatch
      || Math.abs(rustPartyHp - normalized.jsPartyHp) > 0.000001
    )
  ) {
    shadow.mismatches.push(shadow.lastPartyDamageOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastPartyDamageOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return {
    owner: 'rust',
    absorbed: rustAbsorbed,
    damageAfterShield: rustDamageAfterShield,
    shieldAfter: rustShieldAfter,
    heroHp: rustHeroHp,
    partyHp: rustPartyHp,
  };
}

export function createSimulationCoreTurnSummaryResolution({
  source = 'unknown',
  heroCount = 0,
  heroHp = [],
  enemyCount = 0,
  enemyHp = [],
  jsCode = 0,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const heroes = Array.isArray(heroHp) ? heroHp : [];
  const enemies = Array.isArray(enemyHp) ? enemyHp : [];
  const normalized = {
    source,
    heroCount: Number(heroCount || 0),
    heroHp: [0, 1, 2, 3].map((index) => Number(heroes[index] || 0)),
    enemyCount: Number(enemyCount || 0),
    enemyHp: [0, 1, 2, 3].map((index) => Number(enemies[index] || 0)),
    jsCode: Number(jsCode || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasTurnSummaryExports(exports)) {
    shadow.turnSummaryOwnerChecks = Number(shadow.turnSummaryOwnerChecks || 0) + 1;
    shadow.lastTurnSummaryOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      code: normalized.jsCode,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      code: normalized.jsCode,
    };
  }

  const rustCode = Number(exports.turn_summary_code_shadow(
    normalized.heroCount,
    normalized.heroHp[0],
    normalized.heroHp[1],
    normalized.heroHp[2],
    normalized.heroHp[3],
    normalized.enemyCount,
    normalized.enemyHp[0],
    normalized.enemyHp[1],
    normalized.enemyHp[2],
    normalized.enemyHp[3],
  ));
  shadow.turnSummaryOwnerChecks = Number(shadow.turnSummaryOwnerChecks || 0) + 1;
  shadow.lastTurnSummaryOwnerCheck = {
    ...normalized,
    owner: 'rust',
    code: rustCode,
  };
  if (!exportsOverride && Math.abs(rustCode - normalized.jsCode) > 0.000001) {
    shadow.mismatches.push(shadow.lastTurnSummaryOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastTurnSummaryOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return {
    owner: 'rust',
    code: rustCode,
  };
}

export function createSimulationCoreSingleHitResolution({
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
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const normalized = {
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
    jsDamage: Number(jsDamage || 0),
    jsAppliedDamage: Number(jsAppliedDamage || 0),
    jsAfterHp: Number(jsAfterHp || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasSingleHitExports(exports)) {
    shadow.singleHitOwnerChecks = Number(shadow.singleHitOwnerChecks || 0) + 1;
    shadow.lastSingleHitOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      damage: normalized.jsDamage,
      appliedDamage: normalized.jsAppliedDamage,
      afterHp: normalized.jsAfterHp,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      damage: normalized.jsDamage,
      appliedDamage: normalized.jsAppliedDamage,
      afterHp: normalized.jsAfterHp,
    };
  }

  const rustDamage = Number(exports.single_hit_damage_shadow(
    normalized.power,
    normalized.resist,
    normalized.roll01,
    normalized.critRoll01,
    normalized.sourceIsHero,
    normalized.heroAoe,
    normalized.chainActive,
    normalized.chainMultiplier,
  ));
  const rustAppliedDamage = Number(exports.single_hit_applied_damage_shadow(
    normalized.targetHp,
    rustDamage,
    normalized.shield,
  ));
  const rustAfterHp = Number(exports.single_hit_after_hp_shadow(
    normalized.targetHp,
    rustDamage,
    normalized.shield,
  ));
  shadow.singleHitOwnerChecks = Number(shadow.singleHitOwnerChecks || 0) + 1;
  shadow.lastSingleHitOwnerCheck = {
    ...normalized,
    owner: 'rust',
    damage: rustDamage,
    appliedDamage: rustAppliedDamage,
    afterHp: rustAfterHp,
  };
  if (
    !exportsOverride
    && (
      Math.abs(rustDamage - normalized.jsDamage) > 0.000001
      || Math.abs(rustAppliedDamage - normalized.jsAppliedDamage) > 0.000001
      || Math.abs(rustAfterHp - normalized.jsAfterHp) > 0.000001
    )
  ) {
    shadow.mismatches.push(shadow.lastSingleHitOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastSingleHitOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return {
    owner: 'rust',
    damage: rustDamage,
    appliedDamage: rustAppliedDamage,
    afterHp: rustAfterHp,
  };
}

export function createSimulationCoreEnemyDotPacketResolution({
  source = 'unknown',
  actorUID = 0,
  enemyUID = 0,
  totalDamage = 0,
  totalTicks = 1,
  nowTick = 0,
  nowTurnSerial = 0,
  firesEveryTicks = 1,
  startAfterTicks = 1,
  firesEveryTurns = 1,
  startAfterTurns = 1,
  cadence = '',
  effectName = '',
  taintedGroundZoneId = '',
  jsTargetUID = 0,
  jsSourceUID = 0,
  jsRemainingFires = 0,
  jsTotalDamageRemaining = 0,
  jsFiresEveryTicks = 0,
  jsNextFireTick = 0,
  jsFiresEveryTurns = 0,
  jsNextFireTurnSerial = 0,
  jsLastProcessedTurnSerial = 0,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    actorUID: Number(actorUID || 0),
    enemyUID: Number(enemyUID || 0),
    totalDamage: Number(totalDamage || 0),
    totalTicks: Number(totalTicks || 0),
    nowTick: Number(nowTick || 0),
    nowTurnSerial: Number(nowTurnSerial || 0),
    firesEveryTicks: Number(firesEveryTicks || 0),
    startAfterTicks: Number(startAfterTicks || 0),
    firesEveryTurns: Number(firesEveryTurns || 0),
    startAfterTurns: Number(startAfterTurns || 0),
    cadence: String(cadence || ''),
    effectName: String(effectName || ''),
    taintedGroundZoneId: String(taintedGroundZoneId || ''),
    jsTargetUID: Number(jsTargetUID || 0),
    jsSourceUID: Number(jsSourceUID || 0),
    jsRemainingFires: Number(jsRemainingFires || 0),
    jsTotalDamageRemaining: Number(jsTotalDamageRemaining || 0),
    jsFiresEveryTicks: Number(jsFiresEveryTicks || 0),
    jsNextFireTick: Number(jsNextFireTick || 0),
    jsFiresEveryTurns: Number(jsFiresEveryTurns || 0),
    jsNextFireTurnSerial: Number(jsNextFireTurnSerial || 0),
    jsLastProcessedTurnSerial: Number(jsLastProcessedTurnSerial || 0),
  };
  const fallback = {
    owner: 'fallback',
    targetUID: normalized.jsTargetUID,
    sourceUID: normalized.jsSourceUID,
    remainingFires: normalized.jsRemainingFires,
    totalDamageRemaining: normalized.jsTotalDamageRemaining,
    firesEveryTicks: normalized.jsFiresEveryTicks,
    nextFireTick: normalized.jsNextFireTick,
    firesEveryTurns: normalized.jsFiresEveryTurns,
    nextFireTurnSerial: normalized.jsNextFireTurnSerial,
    lastProcessedTurnSerial: normalized.jsLastProcessedTurnSerial,
    cadence: normalized.cadence,
    effectName: normalized.effectName,
    taintedGroundZoneId: normalized.taintedGroundZoneId,
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasEnemyDotPacketExports(exports)) {
    shadow.enemyDotPacketOwnerChecks = Number(shadow.enemyDotPacketOwnerChecks || 0) + 1;
    shadow.lastEnemyDotPacketOwnerCheck = {
      ...normalized,
      ...fallback,
    };
    updateShadowDomMarker(shadow);
    return fallback;
  }

  const rustPacket = {
    owner: 'rust',
    targetUID: Number(exports.enemy_dot_packet_target_uid_shadow(normalized.enemyUID)),
    sourceUID: Number(exports.enemy_dot_packet_source_uid_shadow(normalized.actorUID)),
    remainingFires: Number(exports.enemy_dot_packet_remaining_fires_shadow(normalized.totalTicks)),
    totalDamageRemaining: Number(exports.enemy_dot_packet_total_damage_remaining_shadow(normalized.totalDamage)),
    firesEveryTicks: Number(exports.enemy_dot_packet_fires_every_ticks_shadow(normalized.firesEveryTicks)),
    nextFireTick: Number(exports.enemy_dot_packet_next_fire_tick_shadow(
      normalized.nowTick,
      normalized.startAfterTicks,
    )),
    firesEveryTurns: Number(exports.enemy_dot_packet_fires_every_turns_shadow(normalized.firesEveryTurns)),
    nextFireTurnSerial: Number(exports.enemy_dot_packet_next_fire_turn_serial_shadow(
      normalized.nowTurnSerial,
      normalized.startAfterTurns,
    )),
    lastProcessedTurnSerial: Number(
      exports.enemy_dot_packet_last_processed_turn_serial_shadow(normalized.nowTurnSerial),
    ),
    cadence: normalized.cadence,
    effectName: normalized.effectName,
    taintedGroundZoneId: normalized.taintedGroundZoneId,
  };
  shadow.enemyDotPacketOwnerChecks = Number(shadow.enemyDotPacketOwnerChecks || 0) + 1;
  shadow.lastEnemyDotPacketOwnerCheck = {
    ...normalized,
    ...rustPacket,
  };
  if (
    !exportsOverride
    && (
      Math.abs(rustPacket.targetUID - normalized.jsTargetUID) > 0.000001
      || Math.abs(rustPacket.sourceUID - normalized.jsSourceUID) > 0.000001
      || Math.abs(rustPacket.remainingFires - normalized.jsRemainingFires) > 0.000001
      || Math.abs(rustPacket.totalDamageRemaining - normalized.jsTotalDamageRemaining) > 0.000001
      || Math.abs(rustPacket.firesEveryTicks - normalized.jsFiresEveryTicks) > 0.000001
      || Math.abs(rustPacket.nextFireTick - normalized.jsNextFireTick) > 0.000001
      || Math.abs(rustPacket.firesEveryTurns - normalized.jsFiresEveryTurns) > 0.000001
      || Math.abs(rustPacket.nextFireTurnSerial - normalized.jsNextFireTurnSerial) > 0.000001
      || Math.abs(rustPacket.lastProcessedTurnSerial - normalized.jsLastProcessedTurnSerial) > 0.000001
    )
  ) {
    shadow.mismatches.push(shadow.lastEnemyDotPacketOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastEnemyDotPacketOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return rustPacket;
}

export function createSimulationCoreEnemyDotTickResolution({
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
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    totalDamageRemaining: Number(totalDamageRemaining || 0),
    remainingFires: Number(remainingFires || 0),
    damagePerFire: Number(damagePerFire || 0),
    hasTotalDamageRemaining: Number(hasTotalDamageRemaining || 0),
    nextFireTurnSerial: Number(nextFireTurnSerial || 0),
    firesEveryTurns: Number(firesEveryTurns || 1),
    jsDamage: Number(jsDamage || 0),
    jsTotalDamageRemaining: Number(jsTotalDamageRemaining || 0),
    jsRemainingFires: Number(jsRemainingFires || 0),
    jsNextFireTurnSerial: Number(jsNextFireTurnSerial || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasEnemyDotTickExports(exports)) {
    shadow.enemyDotTickOwnerChecks = Number(shadow.enemyDotTickOwnerChecks || 0) + 1;
    shadow.lastEnemyDotTickOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      damage: normalized.jsDamage,
      totalDamageRemaining: normalized.jsTotalDamageRemaining,
      remainingFires: normalized.jsRemainingFires,
      nextFireTurnSerial: normalized.jsNextFireTurnSerial,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      damage: normalized.jsDamage,
      totalDamageRemaining: normalized.jsTotalDamageRemaining,
      remainingFires: normalized.jsRemainingFires,
      nextFireTurnSerial: normalized.jsNextFireTurnSerial,
    };
  }

  const rustDamage = Number(exports.enemy_dot_tick_damage_shadow(
    normalized.totalDamageRemaining,
    normalized.remainingFires,
    normalized.damagePerFire,
    normalized.hasTotalDamageRemaining,
  ));
  const rustTotalDamageRemaining = Number(exports.enemy_dot_tick_total_remaining_shadow(
    normalized.totalDamageRemaining,
    normalized.remainingFires,
    normalized.damagePerFire,
    normalized.hasTotalDamageRemaining,
  ));
  const rustRemainingFires = Number(exports.enemy_dot_tick_remaining_fires_shadow(
    normalized.remainingFires,
  ));
  const rustNextFireTurnSerial = Number(exports.enemy_dot_tick_next_turn_shadow(
    normalized.nextFireTurnSerial,
    normalized.firesEveryTurns,
  ));
  shadow.enemyDotTickOwnerChecks = Number(shadow.enemyDotTickOwnerChecks || 0) + 1;
  shadow.lastEnemyDotTickOwnerCheck = {
    ...normalized,
    owner: 'rust',
    damage: rustDamage,
    totalDamageRemaining: rustTotalDamageRemaining,
    remainingFires: rustRemainingFires,
    nextFireTurnSerial: rustNextFireTurnSerial,
  };
  if (
    !exportsOverride
    && (
      Math.abs(rustDamage - normalized.jsDamage) > 0.000001
      || Math.abs(rustTotalDamageRemaining - normalized.jsTotalDamageRemaining) > 0.000001
      || Math.abs(rustRemainingFires - normalized.jsRemainingFires) > 0.000001
      || Math.abs(rustNextFireTurnSerial - normalized.jsNextFireTurnSerial) > 0.000001
    )
  ) {
    shadow.mismatches.push(shadow.lastEnemyDotTickOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastEnemyDotTickOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return {
    owner: 'rust',
    damage: rustDamage,
    totalDamageRemaining: rustTotalDamageRemaining,
    remainingFires: rustRemainingFires,
    nextFireTurnSerial: rustNextFireTurnSerial,
  };
}

export function createSimulationCoreEnemyDotLifecycleResolution({
  source = 'unknown',
  cadenceIsTurn = 0,
  dotTargetUID = 0,
  targetUID = 0,
  remainingFires = 0,
  hasTotalDamageRemaining = 0,
  totalDamageRemaining = 0,
  targetAlive = 0,
  currentTurnSerial = 0,
  nextFireTurnSerial = 0,
  lastProcessedTurnSerial = 0,
  jsAction = 0,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    cadenceIsTurn: Number(cadenceIsTurn || 0),
    dotTargetUID: Number(dotTargetUID || 0),
    targetUID: Number(targetUID || 0),
    remainingFires: Number(remainingFires || 0),
    hasTotalDamageRemaining: Number(hasTotalDamageRemaining || 0),
    totalDamageRemaining: Number(totalDamageRemaining || 0),
    targetAlive: Number(targetAlive || 0),
    currentTurnSerial: Number(currentTurnSerial || 0),
    nextFireTurnSerial: Number(nextFireTurnSerial || 0),
    lastProcessedTurnSerial: Number(lastProcessedTurnSerial || 0),
    jsAction: Number(jsAction || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasEnemyDotLifecycleExports(exports)) {
    shadow.enemyDotLifecycleOwnerChecks = Number(shadow.enemyDotLifecycleOwnerChecks || 0) + 1;
    shadow.lastEnemyDotLifecycleOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      action: normalized.jsAction,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      action: normalized.jsAction,
    };
  }

  const rustAction = Number(exports.enemy_dot_lifecycle_action_shadow(
    normalized.cadenceIsTurn,
    normalized.dotTargetUID,
    normalized.targetUID,
    normalized.remainingFires,
    normalized.hasTotalDamageRemaining,
    normalized.totalDamageRemaining,
    normalized.targetAlive,
    normalized.currentTurnSerial,
    normalized.nextFireTurnSerial,
    normalized.lastProcessedTurnSerial,
  ));
  shadow.enemyDotLifecycleOwnerChecks = Number(shadow.enemyDotLifecycleOwnerChecks || 0) + 1;
  shadow.lastEnemyDotLifecycleOwnerCheck = {
    ...normalized,
    owner: 'rust',
    action: rustAction,
  };
  if (!exportsOverride && Math.abs(rustAction - normalized.jsAction) > 0.000001) {
    shadow.mismatches.push(shadow.lastEnemyDotLifecycleOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastEnemyDotLifecycleOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return {
    owner: 'rust',
    action: rustAction,
  };
}

export function createSimulationCoreEnemyDebuffApplyResolution({
  source = 'unknown',
  stat = '',
  amountBefore = 0,
  turnsBefore = 0,
  addAmount = 2,
  durationTurns = 3,
  jsAmountAfter = 0,
  jsTurnsAfter = 0,
  jsActive = 0,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    stat: String(stat || '').toUpperCase(),
    amountBefore: Number(amountBefore || 0),
    turnsBefore: Number(turnsBefore || 0),
    addAmount: Number(addAmount || 0),
    durationTurns: Number(durationTurns || 0),
    jsAmountAfter: Number(jsAmountAfter || 0),
    jsTurnsAfter: Number(jsTurnsAfter || 0),
    jsActive: Number(jsActive || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasEnemyDebuffApplyExports(exports)) {
    shadow.enemyDebuffApplyOwnerChecks = Number(shadow.enemyDebuffApplyOwnerChecks || 0) + 1;
    shadow.lastEnemyDebuffApplyOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      amountAfter: normalized.jsAmountAfter,
      turnsAfter: normalized.jsTurnsAfter,
      active: normalized.jsActive,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      amountAfter: normalized.jsAmountAfter,
      turnsAfter: normalized.jsTurnsAfter,
      active: normalized.jsActive,
    };
  }

  const rustAmountAfter = Number(exports.enemy_debuff_apply_amount_after_shadow(
    normalized.amountBefore,
    normalized.addAmount,
  ));
  const rustTurnsAfter = Number(exports.enemy_debuff_apply_turns_after_shadow(
    normalized.durationTurns,
  ));
  const rustActive = Number(exports.enemy_debuff_apply_active_shadow(
    rustAmountAfter,
    rustTurnsAfter,
  ));
  shadow.enemyDebuffApplyOwnerChecks = Number(shadow.enemyDebuffApplyOwnerChecks || 0) + 1;
  shadow.lastEnemyDebuffApplyOwnerCheck = {
    ...normalized,
    owner: 'rust',
    amountAfter: rustAmountAfter,
    turnsAfter: rustTurnsAfter,
    active: rustActive,
  };
  if (
    !exportsOverride
    && (
      Math.abs(rustAmountAfter - normalized.jsAmountAfter) > 0.000001
      || Math.abs(rustTurnsAfter - normalized.jsTurnsAfter) > 0.000001
      || Math.abs(rustActive - normalized.jsActive) > 0.000001
    )
  ) {
    shadow.mismatches.push(shadow.lastEnemyDebuffApplyOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastEnemyDebuffApplyOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return {
    owner: 'rust',
    amountAfter: rustAmountAfter,
    turnsAfter: rustTurnsAfter,
    active: rustActive,
  };
}

export function createSimulationCoreEnemyDebuffSlotTransition({
  source = 'unknown',
  stat = '',
  statIndex = -1,
  active = 0,
  slotCount = 0,
  slot0Index = -1,
  slot1Index = -1,
  slot2Index = -1,
  jsAction = 0,
  jsDropSlotIndex = -1,
  jsAppendSlotIndex = -1,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    stat: String(stat || '').toUpperCase(),
    statIndex: Number(statIndex ?? -1),
    active: Number(active || 0),
    slotCount: Number(slotCount || 0),
    slot0Index: Number(slot0Index ?? -1),
    slot1Index: Number(slot1Index ?? -1),
    slot2Index: Number(slot2Index ?? -1),
    jsAction: Number(jsAction || 0),
    jsDropSlotIndex: Number(jsDropSlotIndex ?? -1),
    jsAppendSlotIndex: Number(jsAppendSlotIndex ?? -1),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasEnemyDebuffSlotExports(exports)) {
    shadow.enemyDebuffSlotOwnerChecks = Number(shadow.enemyDebuffSlotOwnerChecks || 0) + 1;
    shadow.lastEnemyDebuffSlotOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      action: normalized.jsAction,
      dropSlotIndex: normalized.jsDropSlotIndex,
      appendSlotIndex: normalized.jsAppendSlotIndex,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      action: normalized.jsAction,
      dropSlotIndex: normalized.jsDropSlotIndex,
      appendSlotIndex: normalized.jsAppendSlotIndex,
    };
  }

  const args = [
    normalized.slotCount,
    normalized.slot0Index,
    normalized.slot1Index,
    normalized.slot2Index,
    normalized.statIndex,
    normalized.active,
  ];
  const rustAction = Number(exports.enemy_debuff_slot_transition_action_shadow(...args));
  const rustDropSlotIndex = Number(exports.enemy_debuff_slot_transition_drop_slot_index_shadow(...args));
  const rustAppendSlotIndex = Number(exports.enemy_debuff_slot_transition_append_slot_index_shadow(...args));
  shadow.enemyDebuffSlotOwnerChecks = Number(shadow.enemyDebuffSlotOwnerChecks || 0) + 1;
  shadow.lastEnemyDebuffSlotOwnerCheck = {
    ...normalized,
    owner: 'rust',
    action: rustAction,
    dropSlotIndex: rustDropSlotIndex,
    appendSlotIndex: rustAppendSlotIndex,
  };
  if (
    !exportsOverride
    && (
      Math.abs(rustAction - normalized.jsAction) > 0.000001
      || Math.abs(rustDropSlotIndex - normalized.jsDropSlotIndex) > 0.000001
      || Math.abs(rustAppendSlotIndex - normalized.jsAppendSlotIndex) > 0.000001
    )
  ) {
    shadow.mismatches.push(shadow.lastEnemyDebuffSlotOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastEnemyDebuffSlotOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return {
    owner: 'rust',
    action: rustAction,
    dropSlotIndex: rustDropSlotIndex,
    appendSlotIndex: rustAppendSlotIndex,
  };
}

export function createSimulationCoreEnemyDebuffDecayResolution({
  source = 'unknown',
  stat = '',
  amountBefore = 0,
  turnsBefore = 0,
  jsAmountAfter = 0,
  jsTurnsAfter = 0,
  jsActive = 0,
} = {}, { exportsOverride = null } = {}) {
  const shadow = getShadowState();
  const normalized = {
    source,
    stat: String(stat || '').toUpperCase(),
    amountBefore: Number(amountBefore || 0),
    turnsBefore: Number(turnsBefore || 0),
    jsAmountAfter: Number(jsAmountAfter || 0),
    jsTurnsAfter: Number(jsTurnsAfter || 0),
    jsActive: Number(jsActive || 0),
  };
  const exports = exportsOverride || (shadow.status === 'ready' ? shadow.exports : null);
  if (!hasEnemyDebuffDecayExports(exports)) {
    shadow.enemyDebuffDecayOwnerChecks = Number(shadow.enemyDebuffDecayOwnerChecks || 0) + 1;
    shadow.lastEnemyDebuffDecayOwnerCheck = {
      ...normalized,
      owner: 'fallback',
      amountAfter: normalized.jsAmountAfter,
      turnsAfter: normalized.jsTurnsAfter,
      active: normalized.jsActive,
    };
    updateShadowDomMarker(shadow);
    return {
      owner: 'fallback',
      amountAfter: normalized.jsAmountAfter,
      turnsAfter: normalized.jsTurnsAfter,
      active: normalized.jsActive,
    };
  }

  const rustTurnsAfter = Number(exports.enemy_debuff_turns_after_tick_shadow(
    normalized.turnsBefore,
  ));
  const rustAmountAfter = Number(exports.enemy_debuff_amount_after_tick_shadow(
    normalized.amountBefore,
    rustTurnsAfter,
  ));
  const rustActive = Number(exports.enemy_debuff_active_after_tick_shadow(
    rustAmountAfter,
    rustTurnsAfter,
  ));
  shadow.enemyDebuffDecayOwnerChecks = Number(shadow.enemyDebuffDecayOwnerChecks || 0) + 1;
  shadow.lastEnemyDebuffDecayOwnerCheck = {
    ...normalized,
    owner: 'rust',
    amountAfter: rustAmountAfter,
    turnsAfter: rustTurnsAfter,
    active: rustActive,
  };
  if (
    !exportsOverride
    && (
      Math.abs(rustAmountAfter - normalized.jsAmountAfter) > 0.000001
      || Math.abs(rustTurnsAfter - normalized.jsTurnsAfter) > 0.000001
      || Math.abs(rustActive - normalized.jsActive) > 0.000001
    )
  ) {
    shadow.mismatches.push(shadow.lastEnemyDebuffDecayOwnerCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn('[SIM_CORE_SHADOW_MISMATCH]', shadow.lastEnemyDebuffDecayOwnerCheck);
  }
  updateShadowDomMarker(shadow);
  return {
    owner: 'rust',
    amountAfter: rustAmountAfter,
    turnsAfter: rustTurnsAfter,
    active: rustActive,
  };
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
  if (shadow.status !== 'ready' || !hasSingleHitExports(shadow.exports)) return jsValue;
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
  if (shadow.status !== 'ready' || !hasEnemyDotTickExports(shadow.exports)) return jsValue;
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
