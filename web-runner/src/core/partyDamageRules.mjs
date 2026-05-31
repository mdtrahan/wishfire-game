const SIMULATION_CORE_CONTRACT_VERSION = 1;
const SIMULATION_CORE_BASELINE_ID = 'main@5364ede23e3160fadb1a6ac9bf940c57bdd15f87';

function numberOr(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function clonePacketJson(value, fallback) {
  const source = value == null ? fallback : value;
  const json = JSON.stringify(source);
  if (typeof json !== 'string') return fallback;
  return JSON.parse(json);
}

function createFallbackSimulationCoreRequest({
  gameState = {},
  action = {},
  rngState = {},
  context = {},
} = {}) {
  return {
    contractVersion: SIMULATION_CORE_CONTRACT_VERSION,
    baselineId: SIMULATION_CORE_BASELINE_ID,
    gameState: clonePacketJson(gameState, {}),
    action: clonePacketJson(action, { type: 'unknown' }),
    rngState: clonePacketJson(rngState, {}),
    context: clonePacketJson(context, {}),
  };
}

function createFallbackSimulationCoreResponse({
  nextGameState = {},
  events = [],
  rngState = {},
  result = 'continue',
  diagnostics = {},
} = {}) {
  return {
    contractVersion: SIMULATION_CORE_CONTRACT_VERSION,
    nextGameState: clonePacketJson(nextGameState, {}),
    events: Array.isArray(events) ? clonePacketJson(events, []) : [],
    rngState: clonePacketJson(rngState, {}),
    result: String(result || 'continue'),
    diagnostics: clonePacketJson(diagnostics, {}),
  };
}

function normalizeHeroHp(heroHp) {
  const values = Array.isArray(heroHp) ? heroHp : [];
  return [0, 1, 2, 3].map((index) => Math.max(0, numberOr(values[index], 0)));
}

function normalizeHeroCount(value) {
  const normalized = Math.floor(numberOr(value, 0));
  return Math.max(0, Math.min(4, normalized));
}

function normalizePartyDamageInput({
  source = 'unknown',
  incomingDamage = 0,
  shield = 0,
  heroCount = 0,
  heroHp = [],
} = {}) {
  return {
    source: String(source || 'unknown'),
    incomingDamage: Math.max(0, numberOr(incomingDamage, 0)),
    shield: Math.max(0, numberOr(shield, 0)),
    heroCount: normalizeHeroCount(heroCount),
    heroHp: normalizeHeroHp(heroHp),
  };
}

export function partyDamageFromJs(input = {}) {
  const normalized = normalizePartyDamageInput(input);
  const absorbed = Math.min(normalized.shield, normalized.incomingDamage);
  const damageAfterShield = Math.max(0, normalized.incomingDamage - absorbed);
  const shieldAfter = Math.max(0, normalized.shield - absorbed);
  const heroHp = normalized.heroHp.map((hp, index) =>
    index < normalized.heroCount ? Math.max(0, hp - damageAfterShield) : 0
  );
  const partyHp = heroHp
    .slice(0, normalized.heroCount)
    .reduce((total, hp) => total + Number(hp || 0), 0);
  return {
    absorbed,
    damageAfterShield,
    shieldAfter,
    heroHp,
    partyHp,
  };
}

export function resolvePartyDamage({
  ownerHook = null,
  jsAbsorbed = null,
  jsDamageAfterShield = null,
  jsShieldAfter = null,
  jsHeroHp = null,
  jsPartyHp = null,
  ...input
} = {}) {
  const normalized = normalizePartyDamageInput(input);
  const projected = partyDamageFromJs(normalized);
  const jsDecision = {
    absorbed: jsAbsorbed == null ? projected.absorbed : Math.max(0, numberOr(jsAbsorbed, 0)),
    damageAfterShield: jsDamageAfterShield == null
      ? projected.damageAfterShield
      : Math.max(0, numberOr(jsDamageAfterShield, 0)),
    shieldAfter: jsShieldAfter == null ? projected.shieldAfter : Math.max(0, numberOr(jsShieldAfter, 0)),
    heroHp: jsHeroHp == null ? projected.heroHp : normalizeHeroHp(jsHeroHp),
    partyHp: jsPartyHp == null ? projected.partyHp : Math.max(0, numberOr(jsPartyHp, 0)),
  };
  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({
        ...normalized,
        jsAbsorbed: jsDecision.absorbed,
        jsDamageAfterShield: jsDecision.damageAfterShield,
        jsShieldAfter: jsDecision.shieldAfter,
        jsHeroHp: jsDecision.heroHp,
        jsPartyHp: jsDecision.partyHp,
      });
      const ownerDecision = {
        owner: String(result?.owner || 'rust'),
        absorbed: Number(result?.absorbed),
        damageAfterShield: Number(result?.damageAfterShield),
        shieldAfter: Number(result?.shieldAfter),
        heroHp: normalizeHeroHp(result?.heroHp),
        partyHp: Number(result?.partyHp),
        jsDecision,
      };
      if (
        Number.isFinite(ownerDecision.absorbed)
        && Number.isFinite(ownerDecision.damageAfterShield)
        && Number.isFinite(ownerDecision.shieldAfter)
        && Number.isFinite(ownerDecision.partyHp)
        && ownerDecision.heroHp.slice(0, normalized.heroCount).every((hp) => Number.isFinite(hp))
      ) {
        return ownerDecision;
      }
    } catch (_) {
      // Fall back to the local JS projection if the owner hook is unavailable.
    }
  }
  return {
    owner: 'fallback',
    ...jsDecision,
    jsDecision,
  };
}

export function createPartyDamageSimulationPacket({
  ownerHook = null,
  requestFactory = null,
  responseApplier = null,
  rngState = {},
  gameState = {},
  context = {},
  ...input
} = {}) {
  const normalized = normalizePartyDamageInput(input);
  const action = {
    type: 'combat.partyDamage',
    ...normalized,
    jsAbsorbed: numberOr(input.jsAbsorbed, 0),
    jsDamageAfterShield: numberOr(input.jsDamageAfterShield, 0),
    jsShieldAfter: numberOr(input.jsShieldAfter, 0),
    jsHeroHp: normalizeHeroHp(input.jsHeroHp),
    jsPartyHp: numberOr(input.jsPartyHp, 0),
  };
  const requestContext = {
    ruleFamily: 'partyDamage',
    owner: 'rust',
    ...context,
  };
  const request = typeof requestFactory === 'function'
    ? requestFactory(action, requestContext)
    : createFallbackSimulationCoreRequest({
      gameState,
      action,
      rngState,
      context: requestContext,
    });
  const decision = resolvePartyDamage({
    ...normalized,
    jsAbsorbed: input.jsAbsorbed,
    jsDamageAfterShield: input.jsDamageAfterShield,
    jsShieldAfter: input.jsShieldAfter,
    jsHeroHp: input.jsHeroHp,
    jsPartyHp: input.jsPartyHp,
    ownerHook,
  });
  const sourceGameState = request && request.gameState ? request.gameState : gameState;
  const nextGameState = {
    ...clonePacketJson(sourceGameState, {}),
    combat: {
      ...clonePacketJson(sourceGameState?.combat, {}),
      lastPartyDamage: {
        owner: String(decision.owner || 'fallback'),
        absorbed: Number(decision.absorbed || 0),
        damageAfterShield: Number(decision.damageAfterShield || 0),
        shieldAfter: Number(decision.shieldAfter || 0),
        heroHp: normalizeHeroHp(decision.heroHp),
        partyHp: Number(decision.partyHp || 0),
      },
    },
  };
  const response = createFallbackSimulationCoreResponse({
    nextGameState,
    events: [],
    rngState: request && request.rngState ? request.rngState : rngState,
    result: 'party_damage',
    diagnostics: {
      ruleFamily: 'partyDamage',
      owner: decision.owner,
      ...normalized,
      absorbed: Number(decision.absorbed || 0),
      damageAfterShield: Number(decision.damageAfterShield || 0),
      shieldAfter: Number(decision.shieldAfter || 0),
      heroHp: normalizeHeroHp(decision.heroHp),
      partyHp: Number(decision.partyHp || 0),
      jsAbsorbed: Number(decision.jsDecision?.absorbed ?? 0),
      jsDamageAfterShield: Number(decision.jsDecision?.damageAfterShield ?? 0),
      jsShieldAfter: Number(decision.jsDecision?.shieldAfter ?? 0),
      jsHeroHp: normalizeHeroHp(decision.jsDecision?.heroHp),
      jsPartyHp: Number(decision.jsDecision?.partyHp ?? 0),
    },
  });
  const appliedResponse = typeof responseApplier === 'function'
    ? responseApplier(response)
    : response;
  return {
    ...decision,
    simulationCoreRequest: request,
    simulationCoreResponse: appliedResponse,
  };
}
