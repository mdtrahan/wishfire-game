const { normalizeGameStateEnvelope } = require('./gameStateEnvelopeRules.cjs');

const SIMULATION_CORE_CONTRACT_VERSION = 1;
const SIMULATION_CORE_BASELINE_ID = 'main@5364ede23e3160fadb1a6ac9bf940c57bdd15f87';

const PRESENTATION_CONTEXT_KEYS = new Set([
  'animation',
  'audio',
  'canvas',
  'dom',
  'input',
  'menu',
  'overlay',
  'presentation',
  'rendering',
  'storage',
  'ui',
]);

function clonePacketJson(value, fallback) {
  const source = value == null ? fallback : value;
  const json = JSON.stringify(source);
  if (typeof json !== 'string') return fallback;
  return JSON.parse(json);
}

function numberOrZero(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function normalizeSimulationRngState(rngState = {}) {
  const raw = rngState && typeof rngState === 'object' ? rngState : {};
  return {
    seed: numberOrZero(raw.seed ?? raw.RuntimeRandomSeed),
    draws: numberOrZero(raw.draws ?? raw.RuntimeRandomDraws),
    owner: String(raw.owner ?? raw.RuntimeRandomOwner ?? ''),
    reason: String(raw.reason ?? raw.RuntimeRandomReason ?? ''),
    lastValue: numberOrZero(raw.lastValue ?? raw.RuntimeRandomLastValue),
  };
}

function normalizeSimulationAction(action = {}) {
  const normalized = clonePacketJson(action && typeof action === 'object' ? action : {}, {});
  normalized.type = String(normalized.type || 'unknown');
  return normalized;
}

function normalizeSimulationContext(context = {}) {
  const raw = context && typeof context === 'object' ? context : {};
  const filtered = {};
  for (const [key, value] of Object.entries(raw)) {
    if (PRESENTATION_CONTEXT_KEYS.has(key)) continue;
    filtered[key] = value;
  }
  return clonePacketJson(filtered, {});
}

function normalizeSimulationEvents(events = []) {
  if (!Array.isArray(events)) return [];
  return clonePacketJson(events, []);
}

function createSimulationCoreRequest({
  contractVersion = SIMULATION_CORE_CONTRACT_VERSION,
  baselineId = SIMULATION_CORE_BASELINE_ID,
  gameState = {},
  action = {},
  rngState = {},
  context = {},
} = {}) {
  return {
    contractVersion: numberOrZero(contractVersion) || SIMULATION_CORE_CONTRACT_VERSION,
    baselineId: String(baselineId || SIMULATION_CORE_BASELINE_ID),
    gameState: normalizeGameStateEnvelope(gameState),
    action: normalizeSimulationAction(action),
    rngState: normalizeSimulationRngState(rngState),
    context: normalizeSimulationContext(context),
  };
}

function createSimulationCoreResponse({
  contractVersion = SIMULATION_CORE_CONTRACT_VERSION,
  nextGameState = {},
  events = [],
  rngState = {},
  result = 'continue',
  diagnostics = {},
} = {}) {
  return {
    contractVersion: numberOrZero(contractVersion) || SIMULATION_CORE_CONTRACT_VERSION,
    nextGameState: normalizeGameStateEnvelope(nextGameState),
    events: normalizeSimulationEvents(events),
    rngState: normalizeSimulationRngState(rngState),
    result: String(result || 'continue'),
    diagnostics: clonePacketJson(diagnostics, {}),
  };
}

module.exports = {
  SIMULATION_CORE_BASELINE_ID,
  SIMULATION_CORE_CONTRACT_VERSION,
  createSimulationCoreRequest,
  createSimulationCoreResponse,
  normalizeGameStateEnvelope,
  normalizeSimulationContext,
  normalizeSimulationRngState,
};
