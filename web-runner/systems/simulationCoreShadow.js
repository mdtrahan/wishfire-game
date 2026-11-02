import { createSeededRngSimulationPacket } from "../src/core/seededRngRules.mjs";
import { getEmbeddedWasmBytes } from "./runtimeAssetUrl.mjs";
const DEFAULT_WASM_URL = "./assets/simulation_core.wasm";
const SHADOW_STATE_KEY = "__ORKA_SIMULATION_CORE_SHADOW__";
const metaState = { status: "idle", mismatches: [], exports: null };
function getShadowState() {
  if (typeof window !== "undefined") window[SHADOW_STATE_KEY] = metaState;
  return metaState;
}
function updateShadowDomMarker(shadow) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.simCoreShadowStatus = shadow.status;
  document.documentElement.dataset.simCoreShadowMismatches = String(shadow.mismatches.length);
}
function hasSeededRngExports(exports) {
  return typeof exports?.seeded_rng_next_state_shadow === "function" && typeof exports?.seeded_rng_next_value_shadow === "function" && typeof exports?.seeded_rng_index_shadow === "function";
}
function initializeSimulationCoreShadow({ wasmUrl = DEFAULT_WASM_URL } = {}) {
  const state = getShadowState();
  if (state.ready) return state.ready;
  state.status = "loading";
  state.ready = (async () => {
    const bytes = getEmbeddedWasmBytes(wasmUrl) || await fetch(wasmUrl).then((response) => {
      if (!response.ok) throw new Error(`Meta WASM HTTP ${response.status}`);
      return response.arrayBuffer();
    });
    const { instance } = await WebAssembly.instantiate(bytes, {});
    if (!hasSeededRngExports(instance.exports) || typeof instance.exports.combat_power_full_shadow !== "function") throw new Error("Missing CP/meta RNG exports");
    state.exports = instance.exports;
    state.status = "ready";
    updateShadowDomMarker(state);
  })().catch((error) => {
    state.status = "failed";
    state.error = String(error);
    updateShadowDomMarker(state);
    console.warn("[meta WASM]", error);
  });
  return state.ready;
}
function createSimulationCoreSeededRng(seed = 1, {
  source = "simulationCore.seededRng",
  exportsOverride = null
} = {}) {
  const normalizedSeed = normalizeSeed(seed);
  const fallback = createSeededRngFallback(normalizedSeed);
  let draws = 0;
  return () => {
    draws += 1;
    const fallbackValue = fallback();
    const shadow = getShadowState();
    const exports = exportsOverride || (shadow.status === "ready" ? shadow.exports : null);
    if (!hasSeededRngExports(exports)) {
      const packet2 = createSeededRngSimulationPacket({
        source,
        seed: normalizedSeed,
        draws,
        size: 1,
        jsValue: fallbackValue,
        ownerHook: () => ({
          owner: "fallback",
          state: 0,
          value: fallbackValue,
          index: 0
        })
      });
      shadow.seededRngOwnerChecks = Number(shadow.seededRngOwnerChecks || 0) + 1;
      shadow.lastSeededRngOwnerCheck = {
        source,
        owner: packet2.owner,
        seed: normalizedSeed,
        draws,
        value: packet2.value,
        simulationCoreRequest: packet2.simulationCoreRequest,
        simulationCoreResponse: packet2.simulationCoreResponse
      };
      shadow.lastSeededRngOwnerPacket = {
        owner: packet2.owner,
        result: packet2.simulationCoreResponse.result,
        actionType: packet2.simulationCoreRequest.action.type,
        source
      };
      updateShadowDomMarker(shadow);
      return fallbackValue;
    }
    const rustState = Number(exports.seeded_rng_next_state_shadow(normalizedSeed, draws));
    const rustValue = Number(exports.seeded_rng_next_value_shadow(normalizedSeed, draws));
    const rustIndex = Number(exports.seeded_rng_index_shadow(normalizedSeed, draws, 1));
    const packet = createSeededRngSimulationPacket({
      source,
      seed: normalizedSeed,
      draws,
      size: 1,
      jsValue: fallbackValue,
      ownerHook: () => ({
        owner: "rust",
        state: rustState,
        value: rustValue,
        index: rustIndex
      })
    });
    shadow.seededRngOwnerChecks = Number(shadow.seededRngOwnerChecks || 0) + 1;
    shadow.lastSeededRngOwnerCheck = {
      source,
      owner: packet.owner,
      seed: normalizedSeed,
      draws,
      fallbackValue,
      rustState: packet.state,
      rustValue: packet.value,
      rustIndex: packet.index,
      simulationCoreRequest: packet.simulationCoreRequest,
      simulationCoreResponse: packet.simulationCoreResponse
    };
    shadow.lastSeededRngOwnerPacket = {
      owner: packet.owner,
      result: packet.simulationCoreResponse.result,
      actionType: packet.simulationCoreRequest.action.type,
      source
    };
    if (Math.abs(packet.value - fallbackValue) > 1e-6 && !exportsOverride) {
      shadow.mismatches.push(shadow.lastSeededRngOwnerCheck);
      if (shadow.mismatches.length > 20) shadow.mismatches.shift();
      console.warn("[SIM_CORE_SHADOW_MISMATCH]", shadow.lastSeededRngOwnerCheck);
    }
    updateShadowDomMarker(shadow);
    return packet.value;
  };
}
function shadowCombatPower({ source = "unknown", actor = null, atk = 0, def = 0, hp = 0, jsValue = 0 } = {}) {
  const shadow = getShadowState();
  if (shadow.status !== "ready" || !shadow.exports) return jsValue;
  const input = actor && typeof actor === "object" ? actor : { atk, mag: 0, def, res: 0, hp, spd: 0, level: 1, expectedDirect: 0, critChance: 0.01, critMultiplier: 1.25, aoeDamage: 0, extraTargets: 0, sustain: 0, control: 0, proc: 0, af: 0, sequence: 1 };
  const full = shadow.exports.combat_power_full_shadow;
  const rustValue = typeof full === "function" ? Number(full(Number(input.atk || 0), Number(input.mag || 0), Number(input.def || 0), Number(input.res || 0), Number(input.hp || 0), Number(input.spd || 0), Number(input.level || 1), Number(input.expectedDirect || 0), Number(input.critChance || 0), Number(input.critMultiplier || 1), Number(input.aoeDamage || 0), Number(input.extraTargets || 0), Number(input.sustain || 0), Number(input.control || 0), Number(input.proc || 0), Number(input.af || 0), Number(input.sequence || 1))) : Number(shadow.exports.combat_power_shadow(Number(atk || 0), Number(def || 0), Number(hp || 0)));
  shadow.lastCheck = {
    source,
    actor: input,
    jsValue,
    rustValue
  };
  if (Math.abs(rustValue - jsValue) > 1e-6) {
    shadow.mismatches.push(shadow.lastCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn("[SIM_CORE_SHADOW_MISMATCH]", shadow.lastCheck);
  }
  updateShadowDomMarker(shadow);
  return jsValue;
}
function shadowSeededRng({
  source = "unknown",
  seed = 1,
  draws = 1,
  size = 1,
  jsState = 0,
  jsValue = 0,
  jsIndex = 0
} = {}) {
  const shadow = getShadowState();
  if (shadow.status !== "ready" || !hasSeededRngExports(shadow.exports)) return jsValue;
  const normalizedSeed = Number(seed || 0);
  const normalizedDraws = Number(draws || 0);
  const normalizedSize = Number(size || 0);
  const rustState = Number(shadow.exports.seeded_rng_next_state_shadow(normalizedSeed, normalizedDraws));
  const rustValue = Number(shadow.exports.seeded_rng_next_value_shadow(normalizedSeed, normalizedDraws));
  const rustIndex = Number(shadow.exports.seeded_rng_index_shadow(
    normalizedSeed,
    normalizedDraws,
    normalizedSize
  ));
  const packet = createSeededRngSimulationPacket({
    source,
    seed: normalizedSeed,
    draws: normalizedDraws,
    size: normalizedSize,
    jsState,
    jsValue,
    jsIndex,
    ownerHook: () => ({
      owner: "rust",
      state: rustState,
      value: rustValue,
      index: rustIndex
    })
  });
  shadow.seededRngChecks = Number(shadow.seededRngChecks || 0) + 1;
  shadow.lastSeededRngCheck = {
    source,
    seed: normalizedSeed,
    draws: normalizedDraws,
    size: normalizedSize,
    jsState: Number(jsState || 0),
    rustState,
    jsValue: Number(jsValue || 0),
    rustValue: packet.value,
    jsIndex: Number(jsIndex || 0),
    rustIndex: packet.index,
    simulationCoreRequest: packet.simulationCoreRequest,
    simulationCoreResponse: packet.simulationCoreResponse
  };
  shadow.lastSeededRngPacket = {
    owner: packet.owner,
    result: packet.simulationCoreResponse.result,
    actionType: packet.simulationCoreRequest.action.type,
    source
  };
  if (Math.abs(rustState - Number(jsState || 0)) > 1e-6 || Math.abs(packet.value - Number(jsValue || 0)) > 1e-6 || Math.abs(packet.index - Number(jsIndex || 0)) > 1e-6) {
    shadow.mismatches.push(shadow.lastSeededRngCheck);
    if (shadow.mismatches.length > 20) shadow.mismatches.shift();
    console.warn("[SIM_CORE_SHADOW_MISMATCH]", shadow.lastSeededRngCheck);
  }
  updateShadowDomMarker(shadow);
  return jsValue;
}
export {
  createSimulationCoreSeededRng,
  initializeSimulationCoreShadow,
  shadowCombatPower,
  shadowSeededRng
};
