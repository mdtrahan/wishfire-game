export const COMBAT_OUTCOME_CONTINUE = 0;
export const COMBAT_OUTCOME_ENERGY_DEPLETED = 1;
export const COMBAT_OUTCOME_PARTY_DEFEATED = 2;
export const COMBAT_OUTCOME_NO_LIVING_HEROES = 3;

export function combatOutcomeCodeFromJs({ energy = 0, partyHp = 0, livingHeroes = 0 } = {}) {
  if (Number(energy || 0) <= 0) return COMBAT_OUTCOME_ENERGY_DEPLETED;
  if (Number(partyHp || 0) <= 0) return COMBAT_OUTCOME_PARTY_DEFEATED;
  if (Number(livingHeroes || 0) <= 0) return COMBAT_OUTCOME_NO_LIVING_HEROES;
  return COMBAT_OUTCOME_CONTINUE;
}

export function combatOutcomeReasonFromCode(code = COMBAT_OUTCOME_CONTINUE) {
  if (Number(code || 0) === COMBAT_OUTCOME_ENERGY_DEPLETED) return 'energy_depleted';
  if (Number(code || 0) === COMBAT_OUTCOME_PARTY_DEFEATED) return 'party_defeated';
  if (Number(code || 0) === COMBAT_OUTCOME_NO_LIVING_HEROES) return 'no_living_heroes';
  return '';
}

export function resolveCombatOutcome({
  source = 'unknown',
  energy = 0,
  partyHp = 0,
  livingHeroes = 0,
  ownerHook = null,
} = {}) {
  const normalized = {
    source: String(source || 'unknown'),
    energy: Number(energy || 0),
    partyHp: Number(partyHp || 0),
    livingHeroes: Number(livingHeroes || 0),
  };
  const jsCode = combatOutcomeCodeFromJs(normalized);
  if (typeof ownerHook === 'function') {
    try {
      const result = ownerHook({ ...normalized, jsCode });
      const code = Number(result?.code);
      if (Number.isFinite(code)) {
        return {
          owner: String(result?.owner || 'rust'),
          code,
          reason: combatOutcomeReasonFromCode(code),
          jsCode,
        };
      }
    } catch (_) {
      // Fall back to the local JS projection if the owner hook is unavailable or unhealthy.
    }
  }
  return {
    owner: 'fallback',
    code: jsCode,
    reason: combatOutcomeReasonFromCode(jsCode),
    jsCode,
  };
}
