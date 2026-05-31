const GAME_STATE_ENVELOPE_VERSION = 1;
const GAME_STATE_ENVELOPE_ACTION_TYPE = 'gamestate.normalize';

function cloneJson(value, fallback) {
  const source = value == null ? fallback : value;
  try {
    const json = JSON.stringify(source);
    if (typeof json !== 'string') return fallback;
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function numberOrZero(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function integerOrZero(value) {
  const normalized = Math.floor(numberOrZero(value));
  return Number.isFinite(normalized) ? normalized : 0;
}

function stringOrEmpty(value) {
  return value == null ? '' : String(value);
}

function boolCode(value) {
  return value === true || value === 1 ? 1 : 0;
}

function compactObject(input = {}) {
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || typeof value === 'function') continue;
    if (value && typeof value === 'object') {
      out[key] = cloneJson(value, Array.isArray(value) ? [] : {});
    } else {
      out[key] = value;
    }
  }
  return out;
}

function normalizeTurnEntry(entry = {}) {
  return compactObject({
    uid: integerOrZero(entry.uid),
    type: integerOrZero(entry.type),
    name: stringOrEmpty(entry.name),
    spd: numberOrZero(entry.spd),
  });
}

function normalizeTurnState(raw = {}) {
  const turnState = raw.turnState && typeof raw.turnState === 'object' ? raw.turnState : {};
  const queueSource = Array.isArray(turnState.turnQueue)
    ? turnState.turnQueue
    : (Array.isArray(raw.turnOrder) ? raw.turnOrder : []);
  const turnQueue = queueSource.map(normalizeTurnEntry);
  const rawIndex = turnState.currentActorIndex;
  let currentActorIndex = Number.isInteger(rawIndex) ? rawIndex : 0;
  if (!Number.isInteger(rawIndex) && raw.turn && raw.turn.uid != null) {
    const byUid = turnQueue.findIndex((entry) => entry.uid === integerOrZero(raw.turn.uid));
    if (byUid >= 0) currentActorIndex = byUid;
  }
  if (turnQueue.length === 0) {
    currentActorIndex = 0;
  } else {
    currentActorIndex = Math.max(0, Math.min(turnQueue.length - 1, currentActorIndex));
  }
  const round = raw.round && typeof raw.round === 'object' ? raw.round : {};
  return {
    turnQueue,
    currentActorIndex,
    capturedAtTick: numberOrZero(turnState.capturedAtTick ?? raw.time),
    round: {
      active: boolCode(turnState.roundActive ?? round.active),
      groupIndex: integerOrZero(turnState.roundGroupIndex ?? round.groupIndex),
      memberIndex: integerOrZero(turnState.roundMemberIndex ?? round.memberIndex),
    },
  };
}

function normalizeTokenWallet(value = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  const wallet = {};
  for (const [key, amount] of Object.entries(raw)) {
    wallet[String(key)] = numberOrZero(amount);
  }
  return wallet;
}

function normalizeResources(raw = {}) {
  const resources = raw.resources && typeof raw.resources === 'object' ? raw.resources : {};
  const party = raw.party && typeof raw.party === 'object' ? raw.party : {};
  return {
    energy: numberOrZero(resources.energy ?? raw.Player_Energy),
    maxEnergy: numberOrZero(resources.maxEnergy ?? raw.Player_maxEnergy),
    partyHp: numberOrZero(party.hp ?? resources.partyHp ?? raw.PartyHP),
    partyMaxHp: numberOrZero(party.maxHp ?? resources.partyMaxHp ?? raw.PartyMaxHP),
    gold: numberOrZero(resources.gold ?? raw.goldTotal),
    astralFlowWallet: numberOrZero(resources.astralFlowWallet ?? raw.AstralFlowWallet),
    tokenWallet: normalizeTokenWallet(resources.tokenWallet ?? raw.TokenWallet),
  };
}

function normalizeActor(actor = {}, type = 'unknown', index = 0) {
  const stats = compactObject({
    atk: numberOrZero(actor.atk ?? actor.ATK),
    def: numberOrZero(actor.def ?? actor.DEF),
    mag: numberOrZero(actor.mag ?? actor.MAG),
    res: numberOrZero(actor.res ?? actor.RES),
    spd: numberOrZero(actor.spd ?? actor.SPD),
  });
  return compactObject({
    uid: integerOrZero(actor.uid),
    type,
    name: stringOrEmpty(actor.name),
    slot: integerOrZero(actor.slot ?? actor.slotIndex ?? index),
    hp: numberOrZero(actor.hp),
    maxHp: numberOrZero(actor.maxHp ?? actor.maxHP),
    combatPower: numberOrZero(actor.combatPower ?? actor.CombatPower),
    stats,
  });
}

function normalizeActors(raw = {}) {
  const entities = Array.isArray(raw.entities) ? raw.entities : [];
  const actorEnvelope = raw.actors && typeof raw.actors === 'object' ? raw.actors : {};
  const heroSource = Array.isArray(raw.heroes)
    ? raw.heroes
    : (Array.isArray(actorEnvelope.heroes)
        ? actorEnvelope.heroes
        : entities.filter((entity) => entity && entity.kind === 'hero'));
  const enemySource = Array.isArray(raw.enemies)
    ? raw.enemies
    : (Array.isArray(actorEnvelope.enemies)
        ? actorEnvelope.enemies
        : entities.filter((entity) => entity && entity.kind === 'enemy'));
  return {
    heroes: heroSource.map((actor, index) => normalizeActor(actor, 'hero', index)),
    enemies: enemySource.map((actor, index) => normalizeActor(actor, 'enemy', index)),
  };
}

function normalizeGem(gem = {}) {
  return compactObject({
    uid: integerOrZero(gem.uid),
    row: integerOrZero(gem.row ?? gem.r ?? gem.cellR),
    col: integerOrZero(gem.col ?? gem.c ?? gem.cellC),
    color: integerOrZero(gem.color ?? gem.elementIndex),
    selected: boolCode(gem.selected ?? gem.Selected),
  });
}

function normalizeBoard(raw = {}) {
  const board = raw.board && typeof raw.board === 'object' ? raw.board : {};
  const gems = Array.isArray(raw.gems)
    ? raw.gems
    : (Array.isArray(board.gems) ? board.gems : []);
  const selectedFromGems = gems.reduce(
    (count, gem) => count + boolCode(gem?.selected ?? gem?.Selected),
    0,
  );
  return {
    gems: gems.map(normalizeGem),
    selectedCount: Number.isFinite(board.selectedCount) ? Number(board.selectedCount) : selectedFromGems,
  };
}

function normalizeFlags(raw = {}) {
  const flags = raw.flags && typeof raw.flags === 'object' ? raw.flags : raw;
  return compactObject({
    canPickGems: boolCode(flags.canPickGems ?? flags.CanPickGems),
    isPlayerBusy: boolCode(flags.isPlayerBusy ?? flags.IsPlayerBusy),
    turnPhase: integerOrZero(flags.turnPhase ?? flags.TurnPhase),
    deferAdvance: boolCode(flags.deferAdvance ?? flags.DeferAdvance),
    actionLockUntil: numberOrZero(flags.actionLockUntil ?? flags.ActionLockUntil),
    pendingSkillId: flags.pendingSkillId ?? flags.PendingSkillID ?? null,
    gamePhase: stringOrEmpty(flags.gamePhase ?? flags.GamePhase),
  });
}

function normalizeGameStateEnvelope(input = {}) {
  const raw = input && typeof input === 'object' ? input : {};
  const actors = normalizeActors(raw);
  return {
    schemaVersion: GAME_STATE_ENVELOPE_VERSION,
    turnState: normalizeTurnState(raw),
    resources: normalizeResources(raw),
    actors,
    board: normalizeBoard(raw),
    flags: normalizeFlags(raw),
  };
}

function getGameStateEnvelopeShape(envelope = {}) {
  const normalized = normalizeGameStateEnvelope(envelope);
  return {
    schemaVersion: normalized.schemaVersion,
    heroCount: normalized.actors.heroes.length,
    enemyCount: normalized.actors.enemies.length,
    gemCount: normalized.board.gems.length,
    selectedGemCount: normalized.board.selectedCount,
    turnQueueLength: normalized.turnState.turnQueue.length,
    currentActorIndex: normalized.turnState.currentActorIndex,
    energy: normalized.resources.energy,
    partyHp: normalized.resources.partyHp,
  };
}

function createGameStateEnvelopeSimulationPacket({
  source = 'unknown',
  state = {},
  action = {},
  rngState = {},
  ownerHook = null,
} = {}) {
  const envelope = normalizeGameStateEnvelope(state);
  const shape = getGameStateEnvelopeShape(envelope);
  const request = {
    version: GAME_STATE_ENVELOPE_VERSION,
    action: {
      id: `${source}:${shape.heroCount}:${shape.enemyCount}:${shape.gemCount}:${shape.turnQueueLength}`,
      ...cloneJson(action, {}),
      type: GAME_STATE_ENVELOPE_ACTION_TYPE,
    },
    context: {
      source: stringOrEmpty(source || 'unknown'),
      ruleFamily: 'gameStateEnvelope',
    },
    gameState: envelope,
    rngState: cloneJson(rngState, {}),
    payload: {
      shape,
    },
  };
  const hook = typeof ownerHook === 'function' ? ownerHook : null;
  const rawResponse = hook ? hook(cloneJson({ envelope, shape }, {})) : null;
  const owner = stringOrEmpty(rawResponse?.owner || 'js');
  const nextGameState = normalizeGameStateEnvelope(rawResponse?.nextGameState || envelope);
  const response = {
    version: GAME_STATE_ENVELOPE_VERSION,
    result: 'game_state_envelope',
    owner,
    nextGameState,
    diagnostics: {
      ruleFamily: 'gameStateEnvelope',
      source: stringOrEmpty(source || 'unknown'),
      shape: getGameStateEnvelopeShape(nextGameState),
    },
  };
  return {
    owner,
    envelope,
    shape,
    simulationCoreRequest: request,
    simulationCoreResponse: response,
  };
}

module.exports = {
  gameStateEnvelopeConstants: Object.freeze({
    GAME_STATE_ENVELOPE_ACTION_TYPE,
    GAME_STATE_ENVELOPE_VERSION,
  }),
  normalizeGameStateEnvelope,
  getGameStateEnvelopeShape,
  createGameStateEnvelopeSimulationPacket,
};
