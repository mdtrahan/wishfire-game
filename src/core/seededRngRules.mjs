const UINT32_MOD = 4294967296;

function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeSeed(seed = 1) {
  const normalized = Math.floor(toFiniteNumber(seed, 1)) >>> 0;
  return normalized || 1;
}

function normalizeDraws(draws = 0) {
  return Math.max(0, Math.floor(toFiniteNumber(draws, 0)));
}

function normalizeSize(size = 1) {
  return Math.max(1, Math.floor(toFiniteNumber(size, 1)));
}

function normalizeState(state = 0) {
  return Math.floor(toFiniteNumber(state, 0)) >>> 0;
}

function normalizeValue(value = 0) {
  const num = toFiniteNumber(value, 0);
  if (num >= 0 && num < 1) return num;
  return 0;
}

function normalizeIndex(index = 0, size = 1) {
  const safeSize = normalizeSize(size);
  const raw = Math.floor(toFiniteNumber(index, 0));
  return Math.max(0, Math.min(safeSize - 1, raw));
}

function clonePacketJson(value, fallback = {}) {
  if (value == null) return fallback;
  const json = JSON.stringify(value);
  if (typeof json !== 'string') return fallback;
  return JSON.parse(json);
}

function createRequest({
  source,
  seed,
  draws,
  size,
  jsState,
  jsValue,
  jsIndex,
  rngState = {},
}) {
  return {
    version: 1,
    action: {
      type: 'rng.seededNext',
      id: `${source || 'seeded-rng'}:${seed}:${draws}`,
    },
    context: {
      source: String(source || 'unknown'),
      ruleFamily: 'seededRng',
    },
    gameState: {
      rng: {
        seed,
        draws,
        size,
        ...clonePacketJson(rngState, {}),
      },
    },
    payload: {
      seed,
      draws,
      size,
      jsState,
      jsValue,
      jsIndex,
    },
  };
}

export function createSeededRngSimulationPacket({
  source = 'unknown',
  seed = 1,
  draws = 0,
  size = 1,
  jsState = 0,
  jsValue = 0,
  jsIndex = 0,
  rngState = {},
  ownerHook = null,
} = {}) {
  const normalizedSeed = normalizeSeed(seed);
  const normalizedDraws = normalizeDraws(draws);
  const normalizedSize = normalizeSize(size);
  const normalizedJsState = normalizeState(jsState);
  const normalizedJsValue = normalizeValue(jsValue);
  const normalizedJsIndex = normalizeIndex(jsIndex, normalizedSize);
  const request = createRequest({
    source,
    seed: normalizedSeed,
    draws: normalizedDraws,
    size: normalizedSize,
    jsState: normalizedJsState,
    jsValue: normalizedJsValue,
    jsIndex: normalizedJsIndex,
    rngState,
  });
  const hook = typeof ownerHook === 'function' ? ownerHook : null;
  const raw = hook
    ? hook(clonePacketJson(request.payload, {}))
    : {
        owner: 'js',
        state: normalizedJsState,
        value: normalizedJsValue,
        index: normalizedJsIndex,
      };
  const owner = String(raw?.owner || 'rust');
  const state = normalizeState(raw?.state ?? raw?.rustState ?? normalizedJsState);
  const value = normalizeValue(raw?.value ?? raw?.rustValue ?? normalizedJsValue);
  const index = normalizeIndex(
    raw?.index ?? raw?.rustIndex ?? Math.floor(value * normalizedSize),
    normalizedSize,
  );
  const response = {
    version: 1,
    result: 'seeded_rng',
    owner,
    state,
    value,
    index,
    diagnostics: {
      ruleFamily: 'seededRng',
      source: String(source || 'unknown'),
      seed: normalizedSeed,
      draws: normalizedDraws,
      size: normalizedSize,
      jsState: normalizedJsState,
      jsValue: normalizedJsValue,
      jsIndex: normalizedJsIndex,
      state,
      value,
      index,
    },
  };
  return {
    owner,
    seed: normalizedSeed,
    draws: normalizedDraws,
    size: normalizedSize,
    state,
    value,
    index,
    simulationCoreRequest: request,
    simulationCoreResponse: response,
  };
}

export const seededRngConstants = Object.freeze({
  UINT32_MOD,
});
