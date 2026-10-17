// MODEL stream: a small deterministic shadow model with declared assumptions. It never imports
// Wishfire combat code. Rule values below were transcribed by hand from the cited candidate
// sources so the model can disagree with the game when the game diverges from those statements.

export const MODEL_VERSION = 'orka-7l9-shadow-1';

export const CAP_FRACTION = Object.freeze({ fodder: 0.02, routine: 0.02, hard: 0.08, elite: 0.12, boss: 0.18 });
export const WAVE_HEAL_FRACTION = 0.15;
// Archived shadow-1 assumption. Current Wishfire runtime fixes boss timeouts at 30 game seconds.
export const BOSS_TIME_LIMIT_SEC = 18;

export const ASSUMPTIONS = Object.freeze([
  { id: 'A1', name: 'hostile-hit cap', statement: 'In continuous combat an enemy hit on a Hero applies at most max(1, floor(maxHP × fraction[tier])) HP, with fractions fodder/routine 0.02, hard 0.08, elite 0.12, boss 0.18. Applied HP may be lower than the bound (raw below bound or HP floor).', basis: 'transcribed from candidate web-runner/src/core/routineEnemyScaling.mjs and web-runner/modules/heroCommands.mjs; not imported' },
  { id: 'A2', name: 'cap tier input', statement: 'The cap tier is the EnemyData row tier looked up by enemy name (combatTier, then routineTier, default routine), not the spawned actor tier.', basis: 'code reading of heroCommands.mjs applyDamage; the harness logs both tiers so disagreement stays visible' },
  { id: 'A3', name: 'ordinary wave-clear respite', statement: 'Each living Hero below max HP gains min(maxHP, hp + ceil(0.15 × maxHP)) − hp when an ordinary wave clears.', basis: 'governance/product/player-living-guide.md (15% respite)' },
  { id: 'A4', name: 'defeat recovery', statement: 'Ordinary-defeat and boss-timeout recovery restore every deployed Hero to full max HP.', basis: 'player-living-guide.md recovery rules' },
  { id: 'A5', name: 'boss-clear restore', statement: 'Boss victory restores every Hero to full HP. The runtime does not log this restore, so the model applies it at the observed boss-clear poll and accepts either pre- or post-restore HP for the next Hero event in that poll window.', basis: 'player-living-guide.md; unlogged HP assignment observed by code reading' },
  { id: 'A6', name: 'HP continuity', statement: 'Current HP changes only through logged damage, heal and recovery events, A5, and max-HP decreases that clamp current HP. Max-HP increases (level-up, gear) do not change current HP.', basis: 'player-living-guide.md level-up rule; equipmentStorage clamp' },
  { id: 'A7', name: 'boss timer', statement: 'A boss attempt times out once 18 game seconds elapse with the boss alive; a timeout records elapsed ≥ 18.', basis: 'player-living-guide.md authored 18-second gauge' },
  { id: 'A8', name: 'enemy targeting', statement: 'Enemy target choice reads Hero HP only through living/KO status (provoke, preferred, stable nearest).', basis: 'code reading of selectContinuousEnemyTarget in web-runner/src/core/arenaCombat.mjs' },
  { id: 'A9', name: 'Hero HP guards', statement: 'Unlocked Hero skills whose conditions read Hero HP ratios are listed in HP_GUARDS; other unlocked skills do not read Hero HP.', basis: 'transcribed from heroDefinitions.mjs condition labels and unlock levels' },
  { id: 'A10', name: 'cadence unknown', statement: 'Hits per wave are not modeled from mechanics. The survival envelope sweeps a declared integer range instead of fitting one value.', basis: 'declared ignorance' },
  { id: 'A11', name: 'envelope worst case', statement: 'For the survival envelope every hit applies the A1 bound at opening max HP, and max HP stays constant.', basis: 'declared simplification' },
]);

// A9: Hero-HP guards by canonical hero and unlock level. scope 'self' reads only the owner's ratio.
export const HP_GUARDS = Object.freeze({
  Falie: [
    { skill: 'iron_resolve', level: 5, scope: 'self', threshold: 0.45 },
    { skill: 'brace', level: 10, scope: 'self', threshold: 0.6 },
    { skill: 'crimson_ward', level: 35, scope: 'ally', threshold: 0.7 },
    { skill: 'destiny', level: 50, scope: 'ally', threshold: 0.7 },
    { skill: 'cover', level: 75, scope: 'ally', threshold: 0.35 },
  ],
  Huun: [],
  Runa: [],
  Kojonn: [
    { skill: 'patchwork', level: 15, scope: 'ally', threshold: 0.75 },
    { skill: 'magic_fruit', level: 35, scope: 'ally', threshold: 0.4 },
    { skill: 'grow', level: 50, scope: 'ally', threshold: 0.8 },
    { skill: 'sanctuary', level: 75, scope: 'ally', threshold: 0.4 },
  ],
});

export function capBound(maxHp, tier) {
  const fraction = CAP_FRACTION[tier];
  if (!Number.isFinite(maxHp) || maxHp <= 0 || fraction == null) return null;
  return Math.max(1, Math.floor(maxHp * fraction));
}

export function waveHealAmount(hp, maxHp, fraction = WAVE_HEAL_FRACTION) {
  if (hp <= 0 || hp >= maxHp) return 0;
  return Math.min(maxHp, hp + Math.ceil(maxHp * fraction)) - hp;
}

const lineOrder = (a, b) => (a.evidence?.line ?? 0) - (b.evidence?.line ?? 0);

function heroState(session) {
  const state = new Map();
  for (const hero of session.start?.heroes || []) state.set(hero.uid, { uid: hero.uid, name: hero.name, level: hero.level, hp: hero.hp, maxHp: hero.maxHp, priorMaxHp: null, maxHpChangedAt: null, pendingRestore: null });
  return state;
}

// Max HP is sampled at polls. A change logged in the same poll that read the event (or within the
// window) may have happened before or after it, so both values stay plausible.
function plausibleMaxHp(hero, t, window, pollTime = null) {
  const values = [hero.maxHp];
  const samePoll = pollTime != null && hero.maxHpChangedAt === pollTime;
  if (hero.priorMaxHp != null && hero.maxHpChangedAt != null && (samePoll || Math.abs(hero.maxHpChangedAt - t) <= window)) values.push(hero.priorMaxHp);
  return [...new Set(values)];
}

// Replays one observed session: the model carries its own HP state, applies frozen observed hit
// amounts, and predicts everything the declared rules determine. All divergences are recorded;
// state resyncs to the observation after each one so later checks stay meaningful.
export function replaySession(session, { pollWindow = 0.25, scenario = null } = {}) {
  const heroes = heroState(session);
  const records = session.records.slice().sort(lineOrder);
  const model = [];
  const divergences = [];
  let checks = 0;
  let stoppedAt = null;
  const emit = record => model.push({ label: 'MODEL', model: MODEL_VERSION, scenario, session: session.session, seed: session.seed, ...record });
  const diverge = (record, code, detail, assumptions) => {
    const entry = { code, detail, refId: record.id ?? null, t: record.t, kind: record.kind, target: record.target?.name ?? null, assumptions, evidence: record.evidence };
    divergences.push(entry);
    emit({ kind: 'DIVERGENCE', t: record.t, refId: record.id ?? null, code, detail, assumptions });
  };
  const healGroups = new Map();
  for (const record of records) {
    if (stoppedAt) break;
    if (record.kind === 'GAP') {
      stoppedAt = { t: record.t, reason: `event gap after id ${record.afterId}; model state unknown from here` };
      emit({ kind: 'STOP', t: record.t, reason: stoppedAt.reason });
      break;
    }
    if (record.kind === 'HERO_STATE') {
      const hero = heroes.get(record.hero.uid);
      if (!hero) continue;
      if (record.hero.maxHp !== hero.maxHp) {
        hero.priorMaxHp = hero.maxHp;
        hero.maxHpChangedAt = record.t;
        hero.maxHp = record.hero.maxHp;
        if (hero.hp > hero.maxHp) hero.hp = hero.maxHp;
      }
      hero.level = record.hero.level;
      continue;
    }
    if (record.kind === 'BOSS_CLEAR') {
      for (const hero of heroes.values()) hero.pendingRestore = { t: record.t, before: hero.hp };
      emit({ kind: 'BOSS_CLEAR_RESTORE', t: record.t, assumptions: ['A5'], note: 'unlogged restore applied at poll; next Hero event may precede it' });
      continue;
    }
    if (record.kind === 'BOSS_TIMEOUT') {
      checks += 1;
      const elapsed = record.gameElapsedSec;
      const limit = record.gameTimeLimitSec ?? BOSS_TIME_LIMIT_SEC;
      if (elapsed == null) emit({ kind: 'BOSS_TIMER_CHECK', t: record.t, result: 'unknown', reason: 'runtime elapsed time not recorded', assumptions: ['A7'] });
      else if (elapsed + 1e-6 < BOSS_TIME_LIMIT_SEC || limit !== BOSS_TIME_LIMIT_SEC) diverge(record, 'boss_timer', `timeout at ${elapsed}s with limit ${limit}s; model expects limit ${BOSS_TIME_LIMIT_SEC}s and elapsed ≥ limit`, ['A7']);
      else emit({ kind: 'BOSS_TIMER_CHECK', t: record.t, result: 'consistent', elapsed, limit, assumptions: ['A7'] });
      continue;
    }
    if (!['HIT', 'HEAL', 'RECOVER'].includes(record.kind)) continue;
    const hero = heroes.get(record.target?.uid);
    if (!hero) continue;
    checks += 1;
    let predictedBefore = hero.hp;
    if (hero.pendingRestore) {
      if (record.hpBefore === hero.maxHp && hero.hp !== hero.maxHp) {
        predictedBefore = hero.maxHp;
        hero.pendingRestore = null;
      } else if (record.hpBefore === hero.maxHp) {
        hero.pendingRestore = null;
      }
    }
    if (record.hpBefore !== predictedBefore) {
      diverge(record, 'hp_continuity', `${hero.name} observed HP before ${record.hpBefore}, model ${predictedBefore}`, ['A6', ...(hero.pendingRestore ? ['A5'] : [])]);
    }
    if (record.kind === 'HIT') {
      const tier = record.source?.enemyDataTier ?? null;
      const bounds = tier ? plausibleMaxHp(hero, record.t, pollWindow, record.pollTime).map(value => capBound(value, tier)).filter(value => value != null) : [];
      const bound = bounds.length ? Math.max(...bounds) : null;
      const line = { kind: 'HIT_CHECK', t: record.t, refId: record.id, target: hero.name, source: record.source?.name ?? null, capTier: tier, capBound: bound, capBoundCandidates: bounds, maxHpUsed: plausibleMaxHp(hero, record.t, pollWindow, record.pollTime), predictedHpBefore: predictedBefore, observedHpBefore: record.hpBefore, applied: record.applied, assumptions: ['A1', 'A2', 'A6'] };
      if (bound == null) {
        line.capRelation = 'unknown';
        line.reason = tier ? `no cap fraction declared for tier ${tier}` : 'EnemyData tier not observed for source';
      } else if (record.applied > bound) {
        line.capRelation = 'above_bound';
        diverge(record, 'cap_rule', `applied ${record.applied} exceeds model cap bound ${bound} (${tier})`, ['A1', 'A2']);
      } else if (record.applied === bound) {
        line.capRelation = record.hpAfter === 0 ? 'at_bound_or_hp_floor' : 'at_bound';
      } else {
        line.capRelation = record.hpAfter === 0 ? 'hp_floor' : 'below_bound';
      }
      emit(line);
      hero.hp = Math.max(0, record.hpAfter);
    } else if (record.kind === 'HEAL') {
      if (record.healSource === 'ordinary_wave_clear') {
        const predictions = plausibleMaxHp(hero, record.t, pollWindow, record.pollTime).map(value => waveHealAmount(record.hpBefore, value));
        const ok = predictions.includes(record.applied);
        emit({ kind: 'WAVE_HEAL_CHECK', t: record.t, refId: record.id, target: hero.name, predicted: predictions, observed: record.applied, result: ok ? 'consistent' : 'diverged', assumptions: ['A3'] });
        if (!ok) diverge(record, 'wave_heal', `${hero.name} healed ${record.applied}, model predicts ${predictions.join(' or ')}`, ['A3']);
        const group = healGroups.get(record.t) || new Set();
        group.add(hero.uid);
        healGroups.set(record.t, group);
      } else {
        emit({ kind: 'SKILL_HEAL_SEEN', t: record.t, refId: record.id, target: hero.name, healer: record.healerName, observed: record.applied, assumptions: ['A6'] });
      }
      hero.hp = record.hpAfter;
    } else if (record.kind === 'RECOVER') {
      const full = plausibleMaxHp(hero, record.t, pollWindow, record.pollTime).includes(record.hpAfter);
      emit({ kind: 'RECOVERY_CHECK', t: record.t, refId: record.id, target: hero.name, predictedHpAfter: hero.maxHp, observedHpAfter: record.hpAfter, result: full ? 'consistent' : 'diverged', assumptions: ['A4'] });
      if (!full) diverge(record, 'recovery_not_full', `${hero.name} recovered to ${record.hpAfter}, model expects max HP ${hero.maxHp}`, ['A4']);
      hero.hp = record.hpAfter;
      hero.pendingRestore = null;
    }
  }
  // A3 completeness: every exact ordinary clear must heal each living Hero that was below max.
  const waveHealMisses = [];
  for (const clear of records.filter(record => record.kind === 'WAVE_CLEAR')) {
    const group = [...healGroups.entries()].find(([t]) => t <= clear.t && clear.t - t <= pollWindow * 2);
    if (!group) waveHealMisses.push({ t: clear.t, note: 'no wave-clear heal events near this clear; consistent only if every living Hero was full' });
  }
  return {
    model: MODEL_VERSION,
    checks,
    divergences,
    firstDivergence: divergences[0] || null,
    stoppedAt,
    waveClearsWithoutHeal: waveHealMisses,
    status: stoppedAt ? 'stopped' : divergences.length ? 'diverged' : 'consistent',
    records: model,
  };
}

// Independent forward prediction from opening state only: the largest uniform hits-per-wave
// count that never KOs the Hero across N waves when each hit applies the A1 bound.
export function survivalEnvelope({ hp, maxHp, tier = 'routine', waves = 20, healFraction = WAVE_HEAL_FRACTION, maxHitsPerWave = 200 }) {
  const bound = capBound(maxHp, tier);
  if (bound == null) return { status: 'unknown', reason: `no cap bound for tier ${tier}` };
  const survives = (hitsPerWave, fraction) => {
    let current = hp;
    for (let wave = 1; wave <= waves; wave += 1) {
      current -= hitsPerWave * bound;
      if (current <= 0) return false;
      current += waveHealAmount(current, maxHp, fraction);
    }
    return true;
  };
  const largest = fraction => {
    let best = -1;
    for (let k = 0; k <= maxHitsPerWave && survives(k, fraction); k += 1) best = k;
    return best;
  };
  return { status: 'computed', capBound: bound, tier, healPerWaveAtFloor: Math.ceil(maxHp * healFraction), waves, maxSurvivableUniformHitsPerWave: largest(healFraction), maxSurvivableWithoutHeal: largest(0), singleWaveHitsToKO: Math.ceil(hp / bound), assumptions: ['A1', 'A3', 'A10', 'A11'] };
}

function activeGuards(name, level) {
  return (HP_GUARDS[name] || []).filter(guard => level >= guard.level);
}

// Counterfactual over a frozen observed trace. Damage amounts and event order are copied from the
// observation; the alteration changes healing (or a cap) and the replay stops at the first event
// where the altered state could change targeting, skill conditions, KO or wave flow.
export function counterfactual(session, alteration, { scenario = null } = {}) {
  const records = session.records.slice().sort(lineOrder);
  const heroes = new Map((session.start?.heroes || []).map(hero => [hero.uid, { uid: hero.uid, name: hero.name, level: hero.level, maxHp: hero.maxHp, observedHp: hero.hp, alteredHp: hero.hp, alteredMin: hero.hp, observedMin: hero.hp }]));
  const steps = [];
  let cutoff = null;
  let lastT = 0;
  const guardsInPlay = () => [...heroes.values()].flatMap(hero => activeGuards(hero.name, hero.level).map(guard => ({ owner: hero.name, ...guard })));
  const checkGuards = (record) => {
    const guards = guardsInPlay();
    for (const guard of guards) {
      const subjects = guard.scope === 'self' ? [...heroes.values()].filter(hero => hero.name === guard.owner) : [...heroes.values()];
      for (const hero of subjects) {
        const observedBelow = hero.observedHp / hero.maxHp < guard.threshold;
        const alteredBelow = hero.alteredHp / hero.maxHp < guard.threshold;
        if (observedBelow !== alteredBelow) return `${guard.owner} ${guard.skill} guard (${guard.scope} HP < ${guard.threshold}) differs for ${hero.name}: observed ${hero.observedHp}/${hero.maxHp}, altered ${hero.alteredHp}/${hero.maxHp}`;
      }
    }
    return null;
  };
  for (const record of records) {
    if (record.kind === 'GAP') { cutoff = { t: record.t, refId: null, reason: 'event_gap', detail: 'observed trace incomplete' }; break; }
    if (record.kind === 'HERO_STATE') {
      const hero = heroes.get(record.hero.uid);
      if (hero) {
        hero.level = record.hero.level;
        hero.maxHp = record.hero.maxHp;
        hero.observedHp = Math.min(hero.observedHp, hero.maxHp);
        hero.alteredHp = Math.min(hero.alteredHp, hero.maxHp);
      }
      continue;
    }
    if (record.kind === 'BOSS_CLEAR') {
      for (const hero of heroes.values()) { hero.observedHp = hero.maxHp; hero.alteredHp = hero.maxHp; }
      continue;
    }
    if (!['HIT', 'HEAL', 'RECOVER'].includes(record.kind)) continue;
    const hero = heroes.get(record.target?.uid);
    if (!hero) continue;
    lastT = record.t;
    if (record.kind === 'RECOVER') {
      if (hero.alteredHp > 0) { cutoff = { t: record.t, refId: record.id, reason: 'recovery_not_reached', detail: `observed recovery follows a KO the altered state may not contain (${hero.name} altered HP ${hero.alteredHp})` }; break; }
      hero.observedHp = record.hpAfter; hero.alteredHp = record.hpAfter;
      continue;
    }
    if (record.kind === 'HIT') {
      let applied = record.applied;
      if (alteration.capFractionScale != null) {
        const bound = capBound(hero.maxHp, record.source?.enemyDataTier);
        if (bound == null || record.applied >= bound || record.hpAfter === 0) { cutoff = { t: record.t, refId: record.id, reason: 'raw_damage_unknown', detail: `hit of ${record.applied} may have been capped or HP-floored; raw damage is not observed` }; break; }
        applied = Math.min(record.applied, Math.max(1, Math.floor(hero.maxHp * CAP_FRACTION[record.source.enemyDataTier] * alteration.capFractionScale)));
      }
      hero.observedHp = record.hpAfter;
      hero.alteredHp = Math.max(0, hero.alteredHp - applied);
    } else if (record.kind === 'HEAL') {
      hero.observedHp = record.hpAfter;
      let healed = record.applied;
      if (record.healSource === 'ordinary_wave_clear' && alteration.waveHealFraction != null) healed = waveHealAmount(hero.alteredHp, hero.maxHp, alteration.waveHealFraction);
      else if (record.healSource !== 'ordinary_wave_clear' && alteration.removeHealer && record.healerName === alteration.removeHealer) healed = 0;
      else if (record.healSource === 'ordinary_wave_clear') healed = waveHealAmount(hero.alteredHp, hero.maxHp);
      else if (record.hpAfter === hero.maxHp && hero.alteredHp < record.hpBefore) { cutoff = { t: record.t, refId: record.id, reason: 'heal_amount_unknown', detail: `${record.healerName || 'skill'} heal on ${hero.name} was clamped at max HP; its unclamped amount is not observed` }; break; }
      else healed = Math.min(hero.maxHp, hero.alteredHp + record.applied) - hero.alteredHp;
      hero.alteredHp = hero.alteredHp > 0 ? hero.alteredHp + healed : 0;
    }
    hero.alteredMin = Math.min(hero.alteredMin, hero.alteredHp);
    hero.observedMin = Math.min(hero.observedMin, hero.observedHp);
    steps.push({ label: 'MODEL', kind: 'CF_STEP', scenario, session: session.session, t: record.t, refId: record.id, target: hero.name, observedHp: hero.observedHp, alteredHp: hero.alteredHp });
    if ((hero.alteredHp <= 0) !== (hero.observedHp <= 0)) {
      cutoff = { t: record.t, refId: record.id, reason: 'ko_state_differs', detail: `${hero.name} observed ${hero.observedHp}, altered ${hero.alteredHp}; KO changes targeting, actions and wave flow (A8)` };
      break;
    }
    const guard = checkGuards(record);
    if (guard) { cutoff = { t: record.t, refId: record.id, reason: 'hp_guard_threshold', detail: `${guard} (A9)` }; break; }
  }
  return {
    label: 'MODEL',
    alteration,
    assumptions: ['A3', 'A5', 'A6', 'A8', 'A9', ...(alteration.capFractionScale != null ? ['A1', 'A2'] : [])],
    cutoff,
    validThrough: cutoff ? cutoff.t : lastT,
    complete: !cutoff,
    heroes: [...heroes.values()].map(hero => ({ name: hero.name, observedMinHp: hero.observedMin, alteredMinHpBeforeCutoff: hero.alteredMin })),
    afterCutoff: cutoff ? 'UNKNOWN' : null,
    steps,
  };
}
