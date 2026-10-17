// Claim evaluation. OBS evidence decides PASS/FAIL. MODEL output is attached beside it and is
// never counted as an observation. Missing, inadmissible or retrospective-only evidence cannot PASS.
import { loadObservedLog, loadAggregateReport, observedRunSettings, aggregateSampleHit } from './observed.mjs';
import { sessionFacts, consecutiveClearsAfter, hitsPerWave } from './metrics.mjs';
import { replaySession, survivalEnvelope, counterfactual, ASSUMPTIONS, MODEL_VERSION } from './model.mjs';
import { compareGameSource, checkScenarioProvenance, fileEvidence } from './provenance.mjs';

export const VERDICTS = Object.freeze(['PASS', 'FAIL', 'INCONCLUSIVE']);
export const LABELS = Object.freeze({ REQ: 'owner requirement', REF: 'direct StoneAge observation', OBS: 'unchanged-game observation', MODEL: 'shadow-model prediction', UNKNOWN: 'unmeasured value' });
const CLAIM_KINDS = new Set(['starter_farming', 'pressure', 'cap_share', 'kaja_healing', 'first_boss', 'recovery']);

export function validateClaimsDocument(doc) {
  const problems = [];
  if (doc?.schema !== 'orka.combat-claims.v1') problems.push('schema must be orka.combat-claims.v1');
  if (!doc?.declaredAt || Number.isNaN(Date.parse(doc.declaredAt))) problems.push('declaredAt must be an ISO time');
  if (!/^[0-9a-f]{40}$/.test(doc?.candidate?.sha || '')) problems.push('candidate.sha must be a full commit SHA');
  const sources = new Set([...(doc?.sources?.REQ || []), ...(doc?.sources?.REF || [])].map(source => source.id));
  const scenarioIds = new Set();
  for (const scenario of doc?.scenarios || []) {
    if (!scenario.id || scenarioIds.has(scenario.id)) problems.push(`scenario id missing or duplicated: ${scenario.id}`);
    scenarioIds.add(scenario.id);
    if (!['prospective', 'retrospective'].includes(scenario.timing)) problems.push(`${scenario.id}: timing must be prospective or retrospective`);
    if (!scenario.evidence?.eventLog && !scenario.evidence?.report) problems.push(`${scenario.id}: declares no evidence path`);
    if (!['synthetic', 'earned', 'forced', 'observed_fixture'].includes(scenario.fixtureClass)) problems.push(`${scenario.id}: fixtureClass must be synthetic, earned, forced or observed_fixture`);
  }
  for (const claim of doc?.claims || []) {
    if (!CLAIM_KINDS.has(claim.kind)) problems.push(`${claim.id}: unknown kind ${claim.kind}`);
    if (!['rule', 'model_assumption', 'fixture'].includes(claim.tests)) problems.push(`${claim.id}: tests must be rule, model_assumption or fixture`);
    for (const ref of [...(claim.requirements || []), ...(claim.references || [])]) if (!sources.has(ref)) problems.push(`${claim.id}: unknown source ${ref}`);
    for (const role of Object.values(claim.scenarios || {}).flat()) if (!scenarioIds.has(role)) problems.push(`${claim.id}: unknown scenario ${role}`);
  }
  return problems;
}

// Merge sub-results: any FAIL fails, all PASS passes, otherwise inconclusive.
export function combine(results) {
  if (!results.length) return 'INCONCLUSIVE';
  if (results.some(result => result === 'FAIL')) return 'FAIL';
  return results.every(result => result === 'PASS') ? 'PASS' : 'INCONCLUSIVE';
}

// Retrospective evidence was produced before the claim existed: it may contradict, never confirm.
export function capForTiming(verdict, timing) {
  return timing === 'retrospective' && verdict === 'PASS' ? 'INCONCLUSIVE' : verdict;
}

export function loadScenario(scenario, { repo, candidateSha, declaration }) {
  const evidence = { eventLog: fileEvidence(scenario.evidence?.eventLog), report: fileEvidence(scenario.evidence?.report) };
  const out = { scenario, evidence, admissible: false, problems: [], log: null, report: null, facts: [], replays: [] };
  if (evidence.eventLog.status === 'present') {
    out.log = loadObservedLog(scenario.evidence.eventLog, scenario.id);
    out.kind = 'event_log';
  } else if (evidence.report.status === 'present') {
    out.report = loadAggregateReport(scenario.evidence.report);
    out.kind = 'aggregate_only';
  } else {
    out.kind = 'missing';
    out.problems.push(`evidence missing: ${scenario.evidence?.eventLog || scenario.evidence?.report}`);
    return out;
  }
  const runSource = out.log?.header?.source || out.report?.run?.source || null;
  out.gameSource = compareGameSource(repo, runSource, candidateSha);
  if (out.gameSource.status !== 'unchanged') out.problems.push(`game source ${out.gameSource.status}: ${out.gameSource.reason}`);
  out.startedAt = out.log?.header?.startedAt || out.report?.run?.startedAt || null;
  if (scenario.timing === 'prospective') {
    if (declaration.status !== 'committed') out.problems.push(`claims not declared before run: ${declaration.status}`);
    else if (!out.startedAt) out.problems.push('run start time not recorded; cannot show the claim predates it');
    else if (Date.parse(out.startedAt) <= Date.parse(declaration.committedAt)) out.problems.push(`run started ${out.startedAt}, before claim commit ${declaration.committedAt}`);
  }
  if (out.log) {
    const settings = observedRunSettings(out.log);
    out.problems.push(...checkScenarioProvenance(scenario.expect || {}, settings));
    if (settings.sessionFixtureMismatch) out.problems.push('sessions in one log disagree about fixture hashes');
    out.problems.push(...out.log.issues.map(issue => `log issue ${issue.code}${issue.detail ? `: ${issue.detail}` : ''}`));
    out.facts = out.log.sessions.map(session => sessionFacts(session, { statePollMs: out.log.header?.statePollMs }));
    out.replays = out.log.sessions.map(session => replaySession(session, { scenario: scenario.id }));
  } else if (out.report) {
    const first = out.report.sessions[0] || {};
    out.problems.push(...checkScenarioProvenance(scenario.expect || {}, { lampFixtureSha256: first.fixtures?.lamp, heroFixtureSha256: first.fixtures?.hero, heroSlots: out.report.run?.heroSlots, autoEquip: out.report.run?.autoEquip, maxWaves: out.report.run?.maxWaves, maxBossClears: out.report.run?.maxBossClears, maxBossTimeouts: out.report.run?.maxBossTimeouts, seeds: out.report.sessions.map(session => session.seed), bossPolicy: scenario.expect?.bossPolicy === undefined ? undefined : 'auto' }));
  }
  out.admissible = out.problems.length === 0;
  return out;
}

function seedRows(loaded, seeds, rowFor) {
  return (seeds || loaded.facts.map(fact => fact.seed)).map(seed => {
    const facts = loaded.facts.find(fact => fact.seed === seed);
    if (!facts) return { seed, verdict: 'INCONCLUSIVE', reason: 'seed absent from evidence' };
    return { seed, ...rowFor(facts) };
  });
}

function starterRow(facts, rule) {
  const streak = consecutiveClearsAfter(facts, -1);
  const reasons = [];
  let verdict = 'PASS';
  if (facts.issues.some(issue => issue.code.startsWith('missing_session'))) { verdict = 'INCONCLUSIVE'; reasons.push('session log incomplete'); }
  if (facts.heroKOs.length > rule.maxHeroKOs) { verdict = 'FAIL'; reasons.push(`${facts.heroKOs.length} Hero KO(s); first ${facts.heroKOs[0].name} t=${facts.heroKOs[0].t}`); }
  if (facts.gapCount > 0) { verdict = 'FAIL'; reasons.push(`${facts.gapCount} missing event id(s)`); }
  if (facts.deadlockCount > 0) { verdict = 'FAIL'; reasons.push('deadlock'); }
  if (facts.ambiguousClears.length) { verdict = verdict === 'FAIL' ? 'FAIL' : 'INCONCLUSIVE'; reasons.push(`${facts.ambiguousClears.length} ambiguous wave transition(s)`); }
  if (streak.clears < rule.consecutiveClears) {
    if (verdict !== 'FAIL') verdict = facts.endReason === 'timeout' || facts.endReason == null ? 'INCONCLUSIVE' : 'FAIL';
    reasons.push(`${streak.clears} consecutive clears < ${rule.consecutiveClears} (end ${facts.endReason})`);
  }
  return { verdict, clears: streak.clears, stagesCleared: stagesCleared(facts), heroKOs: facts.heroKOs.length, gaps: facts.gapCount, deadlocks: facts.deadlockCount, endReason: facts.endReason, reasons };
}

// Stages whose ordinary waves were cleared; a 20-wave pass may loop one ready stage.
export function stagesCleared(facts) {
  return [...new Set(facts.waveClears.map(clear => `${clear.progression?.region ?? '?'}-${clear.progression?.stage ?? '?'}`))];
}

function aggregateStarterRow(session, rule) {
  const reasons = [];
  let verdict = 'PASS';
  if (session.heroCasualties?.length) { verdict = 'FAIL'; reasons.push(`Hero casualties ${session.heroCasualties.join(', ')}`); }
  if (session.defeatRecoveries) { verdict = 'FAIL'; reasons.push(`${session.defeatRecoveries} recoveries`); }
  if (session.missingCombatEvents) { verdict = 'FAIL'; reasons.push(`${session.missingCombatEvents} missing events`); }
  if (session.deadlockCount) { verdict = 'FAIL'; reasons.push('deadlock'); }
  if (session.wavesCompleted < rule.consecutiveClears) { verdict = 'FAIL'; reasons.push(`${session.wavesCompleted} clears`); }
  if (session.waveClearSource !== 'runtime_counter' || !session.orderedCombatEventStreamObserved) { verdict = verdict === 'FAIL' ? 'FAIL' : 'INCONCLUSIVE'; reasons.push('no exact counter or ordered stream'); }
  return { seed: session.seed, verdict, clears: session.wavesCompleted, heroKOs: session.heroCasualties?.length ?? null, gaps: session.missingCombatEvents, deadlocks: session.deadlockCount, endReason: session.endReason, reasons, coverage: 'aggregate_only' };
}

function scenarioVerdict(loaded, rows) {
  if (loaded.kind === 'missing') return { verdict: 'INCONCLUSIVE', reason: loaded.problems.join('; ') };
  if (!loaded.admissible) return { verdict: 'INCONCLUSIVE', reason: `evidence inadmissible: ${loaded.problems.join('; ')}` };
  return { verdict: capForTiming(combine(rows.map(row => row.verdict)), loaded.scenario.timing), reason: loaded.scenario.timing === 'retrospective' ? 'retrospective evidence can contradict but not confirm' : null };
}

function evidenceLink(loaded) {
  return loaded.evidence.eventLog.status === 'present' ? loaded.evidence.eventLog : loaded.evidence.report.status === 'present' ? loaded.evidence.report : loaded.evidence.eventLog.path ? loaded.evidence.eventLog : loaded.evidence.report;
}

function modelSummary(loaded) {
  if (!loaded.replays.length) return { status: 'not_run', reason: loaded.kind === 'aggregate_only' ? 'aggregate report has no event replay' : 'no evidence' };
  const diverged = loaded.replays.filter(replay => replay.status !== 'consistent');
  return {
    status: diverged.length ? 'REJECTED_FOR_SCENARIO' : 'CONSISTENT_WITH_CONTROL',
    checks: loaded.replays.reduce((sum, replay) => sum + replay.checks, 0),
    sessionsDiverged: diverged.map(replay => ({ firstDivergence: replay.firstDivergence, stoppedAt: replay.stoppedAt, divergences: replay.divergences.length })),
  };
}

const evaluators = {
  starter_farming(claim, ctx) {
    const rule = { consecutiveClears: 20, maxHeroKOs: 0, ...claim.rule };
    const scenarios = (claim.scenarios.primary || []).concat(claim.scenarios.retrospective || []).map(id => ctx.loaded.get(id));
    const rows = scenarios.map(loaded => {
      const seeds = loaded.scenario.expect?.seeds;
      const perSeed = loaded.kind === 'event_log' ? seedRows(loaded, seeds, facts => starterRow(facts, rule)) : loaded.kind === 'aggregate_only' ? loaded.report.sessions.map(session => aggregateStarterRow(session, rule)) : [];
      return { scenario: loaded.scenario.id, timing: loaded.scenario.timing, ...scenarioVerdict(loaded, perSeed), perSeed, evidence: evidenceLink(loaded), model: modelSummary(loaded) };
    });
    const primary = rows.filter(row => (claim.scenarios.primary || []).includes(row.scenario));
    const verdict = rows.some(row => row.verdict === 'FAIL') ? 'FAIL' : primary.length && primary.every(row => row.verdict === 'PASS') ? 'PASS' : 'INCONCLUSIVE';
    return { verdict, rows };
  },

  pressure(claim, ctx) {
    const margins = (claim.scenarios.margins || []).map(id => ctx.loaded.get(id)).map(loaded => ({
      scenario: loaded.scenario.id,
      evidence: evidenceLink(loaded),
      admissible: loaded.admissible,
      problems: loaded.problems,
      sessions: loaded.facts.map((facts, index) => {
        const perWave = hitsPerWave(facts);
        return {
          seed: facts.seed,
          heroes: facts.heroes.map(hero => {
            const envelope = survivalEnvelope({ hp: hero.startHp, maxHp: hero.startMaxHp, tier: 'routine', waves: claim.rule?.waves || 20 });
            return { name: hero.name, startHp: hero.startHp, startMaxHp: hero.startMaxHp, lowestRatio: hero.lowestRatio == null ? null : Number(hero.lowestRatio.toFixed(3)), lowestRatioAt: hero.lowestRatioAt, lowestRatioHp: hero.lowestRatioHp, lowestRatioMaxHp: hero.lowestRatioMaxHp, lowestRatioUncertain: hero.lowestRatioUncertain, minEventHp: hero.minHp, maxHpAtMin: hero.minHpMaxHp, maxHpAtMinUncertain: hero.minHpMaxHpUncertain, minHpRatio: hero.minHpMaxHp ? Number((hero.minHp / hero.minHpMaxHp).toFixed(3)) : null, hits: hero.hits, appliedDamage: hero.applied, appliedByAmount: hero.appliedByAmount, healing: hero.healing, hitsPerWave: perWave[hero.name], model: { label: 'MODEL', envelope, observedMaxHitsPerWave: perWave[hero.name]?.maxHitsInWave ?? null } };
          }),
          noHealCounterfactual: counterfactual(ctx.loaded.get(loaded.scenario.id).log.sessions[index], { waveHealFraction: 0 }, { scenario: loaded.scenario.id }),
        };
      }),
    }));
    const gear = (claim.scenarios.gear || []).map(id => ctx.loaded.get(id));
    const base = gear.find(loaded => loaded.scenario.variant === 'base');
    const variants = gear.filter(loaded => loaded.scenario.variant !== 'base');
    const sensitivity = variants.map(variant => {
      const usable = base && base.admissible && variant.admissible && base.facts.length && variant.facts.length;
      if (!usable) return { variant: variant.scenario.id, outcome: 'INCONCLUSIVE', margin: 'INCONCLUSIVE', reason: [base ? null : 'base scenario missing', ...(base?.problems || []), ...variant.problems].filter(Boolean).join('; ') || 'evidence missing' };
      const seeds = (claim.rule?.seeds || base.facts.map(fact => fact.seed));
      const pairs = seeds.map(seed => {
        const left = base.facts.find(fact => fact.seed === seed), right = variant.facts.find(fact => fact.seed === seed);
        if (!left || !right) return { seed, status: 'missing' };
        const outcome = facts => ({ heroKOs: facts.heroKOs.length, recoveries: facts.recoveries.length, clears: consecutiveClearsAfter(facts, -1).clears, endReason: facts.endReason, bossClears: facts.bossEnds.filter(end => end.kind === 'BOSS_CLEAR').length });
        const margin = facts => ({ hits: facts.heroes.reduce((sum, hero) => sum + hero.hits, 0), applied: facts.heroes.reduce((sum, hero) => sum + hero.applied, 0), minRatio: Object.fromEntries(facts.heroes.map(hero => [hero.name, hero.lowestRatio == null ? null : Number(hero.lowestRatio.toFixed(3))])), appliedByAmount: Object.fromEntries(facts.heroes.map(hero => [hero.name, hero.appliedByAmount])) });
        const a = outcome(left), b = outcome(right);
        return { seed, base: { outcome: a, margin: margin(left) }, variant: { outcome: b, margin: margin(right) }, outcomeChanged: JSON.stringify(a) !== JSON.stringify(b), marginChanged: JSON.stringify(margin(left)) !== JSON.stringify(margin(right)) };
      });
      const complete = pairs.filter(pair => pair.status !== 'missing');
      return {
        variant: variant.scenario.id,
        change: variant.scenario.change,
        outcome: complete.length < seeds.length ? 'INCONCLUSIVE' : complete.some(pair => pair.outcomeChanged) ? 'PASS' : 'FAIL',
        margin: complete.length < seeds.length ? 'INCONCLUSIVE' : complete.some(pair => pair.marginChanged) ? 'PASS' : 'FAIL',
        pairs,
        evidence: [evidenceLink(base), evidenceLink(variant)],
      };
    });
    return {
      verdict: 'INCONCLUSIVE',
      reason: 'No owner-approved pressure threshold exists; measurements and sensitivity are reported without a danger band.',
      margins,
      sensitivity,
      subResults: { defensiveUpgradeChangesOutcome: combine(sensitivity.map(entry => entry.outcome)), defensiveUpgradeChangesMargin: combine(sensitivity.map(entry => entry.margin)) },
    };
  },

  cap_share(claim, ctx) {
    const scenarios = (claim.scenarios.traces || []).map(id => ctx.loaded.get(id));
    const relations = {};
    const tierPairs = {};
    let preCapObserved = 0;
    let hits = 0;
    const sampleLines = [];
    for (const loaded of scenarios) {
      for (const facts of loaded.facts) for (const hit of facts.hits) {
        hits += 1;
        if (hit.raw != null) preCapObserved += 1;
        const key = `${hit.source?.combatTier ?? '?'}→${hit.source?.enemyDataTier ?? '?'}`;
        tierPairs[key] = (tierPairs[key] || 0) + 1;
      }
      for (const replay of loaded.replays) for (const record of replay.records.filter(entry => entry.kind === 'HIT_CHECK')) relations[record.capRelation] = (relations[record.capRelation] || 0) + 1;
      if (loaded.kind === 'aggregate_only') for (const session of loaded.report.sessions) {
        const line = aggregateSampleHit(session, loaded.scenario.id, loaded.scenario.evidence.report);
        if (line) sampleLines.push(line);
      }
    }
    const modelTotal = Object.values(relations).reduce((a, b) => a + b, 0);
    const atBound = (relations.at_bound || 0) + (relations.at_bound_or_hp_floor || 0);
    return {
      verdict: 'INCONCLUSIVE',
      observed: { label: 'OBS', hits, preCapValuesObserved: preCapObserved, cappedHitShare: preCapObserved === hits && hits > 0 ? 'computable' : 'UNKNOWN', reason: 'no read-only surface exposes pre-cap damage; an applied one-damage hit does not show the cap bound', actorTierToCapTier: tierPairs },
      model: { label: 'MODEL', assumptions: ['A1', 'A2'], hitsChecked: modelTotal, relations, cappedShareInterval: modelTotal ? [0, Number((atBound / modelTotal).toFixed(4))] : null, definitelyUncappedShare: modelTotal ? Number(((relations.below_bound || 0) / modelTotal).toFixed(4)) : null, note: 'Hits at the model bound may be capped or may have raw damage equal to the bound; hits below the bound were not capped if A1/A2 and the poll max HP hold.' },
      sampleLines,
      evidence: scenarios.map(evidenceLink),
    };
  },

  kaja_healing(claim, ctx) {
    const healerName = claim.rule?.healer || 'Kojonn';
    const summarize = id => {
      const loaded = id ? ctx.loaded.get(id) : null;
      if (!loaded) return null;
      const sessions = loaded.facts.map((facts, index) => {
        const skill = facts.heroes.reduce((sum, hero) => sum + Object.entries(hero.healing).filter(([key]) => key === `skill:${healerName}`).reduce((a, [, value]) => a + value, 0), 0);
        const wave = facts.heroes.reduce((sum, hero) => sum + (hero.healing.ordinary_wave_clear || 0), 0);
        const cf = skill > 0 ? counterfactual(loaded.log.sessions[index], { removeHealer: healerName }, { scenario: id }) : null;
        return { seed: facts.seed, healerSkillHealing: skill, waveClearHealing: wave, heroKOs: facts.heroKOs.length, clears: consecutiveClearsAfter(facts, -1).clears, endReason: facts.endReason, removeHealerCounterfactual: cf && { label: 'MODEL', cutoff: cf.cutoff, complete: cf.complete, heroes: cf.heroes } };
      });
      return { scenario: id, admissible: loaded.admissible, problems: loaded.problems, evidence: evidenceLink(loaded), level: loaded.scenario.expect?.levels?.[healerName] ?? null, sessions };
    };
    const l1 = summarize(claim.scenarios.level1Healer?.[0]);
    const l1Control = summarize(claim.scenarios.level1Control?.[0]);
    const l15 = summarize(claim.scenarios.level15Healer?.[0]);
    const l15Control = summarize(claim.scenarios.level15Control?.[0]);
    const decide = (entry, test) => !entry || !entry.admissible || !entry.sessions.length ? 'INCONCLUSIVE' : test(entry);
    const level1Zero = decide(l1, entry => entry.sessions.every(session => session.healerSkillHealing === 0) ? 'PASS' : 'FAIL');
    const level15Occurs = decide(l15, entry => entry.sessions.some(session => session.healerSkillHealing > 0) ? 'PASS' : 'INCONCLUSIVE');
    const outcomeChange = (healer, control) => {
      if (!healer?.admissible || !control?.admissible || !healer.sessions.length || !control.sessions.length) return { result: 'UNKNOWN', reason: 'matched evidence missing or inadmissible' };
      const pairs = healer.sessions.map(session => ({ seed: session.seed, healer: { heroKOs: session.heroKOs, clears: session.clears }, control: control.sessions.find(entry => entry.seed === session.seed) }));
      const changed = pairs.some(pair => pair.control && (pair.control.heroKOs !== pair.healer.heroKOs || pair.control.clears !== pair.healer.clears));
      return { result: changed ? 'OUTCOME_DIFFERS' : 'NO_OUTCOME_DIFFERENCE', confound: 'party size and action economy differ; a difference is not attributable to healing alone', pairs };
    };
    return {
      verdict: combine([level1Zero, level15Occurs]),
      subResults: { level1SkillHealingZero: level1Zero, level15SkillHealingOccurs: level15Occurs },
      outcomeChange: { level1: outcomeChange(l1, l1Control), level15: outcomeChange(l15, l15Control) },
      scenarios: { l1, l1Control, l15, l15Control },
    };
  },

  first_boss(claim, ctx) {
    const attempts = loaded => loaded.facts.flatMap(facts => facts.bossEnds.map(end => ({ seed: facts.seed, outcome: end.kind, elapsed: end.gameElapsedSec, timeoutBossHp: end.boss?.timeoutHp ?? null, bossMaxHp: end.boss?.maxHp ?? null, livingAtTimeout: end.timeoutHeroes ? end.timeoutHeroes.filter(hero => hero.hp > 0).length : null, heroesAtEnd: end.heroes?.map(hero => ({ name: hero.name, level: hero.level, hp: hero.hp, maxHp: hero.maxHp })) })));
    const aggregateAttempts = loaded => loaded.report.sessions.flatMap(session => (session.bossAttempts?.records || []).map(record => ({ seed: session.seed, outcome: { clear: 'BOSS_CLEAR', timeout: 'BOSS_TIMEOUT', ko_recovery: 'BOSS_KO_RECOVERY' }[record.outcome] || 'BOSS_EXIT', elapsed: record.gameElapsedSec ?? null, timeoutBossHp: record.outcome === 'timeout' ? record.hpAtEnd : null, bossMaxHp: record.bossMaxHp ?? null, livingAtTimeout: record.livingHeroesAtEnd ?? null })));
    const sweep = (claim.scenarios.sweep || []).map(id => ctx.loaded.get(id)).map(loaded => {
      const list = loaded.kind === 'event_log' ? attempts(loaded) : loaded.kind === 'aggregate_only' ? aggregateAttempts(loaded) : [];
      const bySeed = (loaded.scenario.expect?.seeds || []).map(seed => ({ seed, first: list.find(entry => entry.seed === seed)?.outcome ?? 'MISSING' }));
      return { scenario: loaded.scenario.id, level: loaded.scenario.level, fixtureClass: loaded.scenario.fixtureClass, timing: loaded.scenario.timing, admissible: loaded.admissible, problems: loaded.problems, evidence: evidenceLink(loaded), attempts: list, firstAttemptBySeed: bySeed, clears: bySeed.filter(entry => entry.first === 'BOSS_CLEAR').length, timeouts: bySeed.filter(entry => entry.first === 'BOSS_TIMEOUT').length, seeds: bySeed.length };
    });
    const admissibleSweep = sweep.filter(entry => entry.admissible && entry.timing === 'prospective').sort((a, b) => a.level - b.level);
    const threshold = {
      label: 'OBS',
      fixtureClass: 'synthetic',
      lowestLevelWithAnyClear: admissibleSweep.find(entry => entry.clears > 0)?.level ?? null,
      lowestLevelAllSeedsClear: admissibleSweep.find(entry => entry.seeds > 0 && entry.clears === entry.seeds)?.level ?? null,
      levelsMeasured: admissibleSweep.map(entry => entry.level),
    };
    const level = n => admissibleSweep.find(entry => entry.level === n);
    const low = level(claim.rule?.underpreparedLevel ?? 1);
    const high = level(claim.rule?.progressedLevel ?? 5);
    const underprepared = !low ? 'INCONCLUSIVE' : (() => {
      const living = low.attempts.filter(entry => entry.outcome === 'BOSS_TIMEOUT' && entry.livingAtTimeout > 0).length;
      return living * 2 > low.attempts.length ? 'PASS' : 'FAIL';
    })();
    const progressed = !high ? 'INCONCLUSIVE' : high.clears === high.seeds && high.seeds > 0 ? 'PASS' : 'FAIL';
    const earnedLoaded = claim.scenarios.earned?.[0] ? ctx.loaded.get(claim.scenarios.earned[0]) : null;
    let earned = { verdict: 'INCONCLUSIVE', reason: 'earned-arrival scenario not declared' };
    if (earnedLoaded) {
      if (!earnedLoaded.admissible) earned = { verdict: 'INCONCLUSIVE', reason: earnedLoaded.problems.join('; ') || 'evidence missing', evidence: evidenceLink(earnedLoaded) };
      else {
        const budget = claim.rule?.earnedTimeoutBudget ?? 3;
        const sessions = earnedLoaded.facts.map(facts => {
          const arrival = facts.bossStarts[0];
          const allOutcomes = facts.bossEnds.map(end => end.kind);
          const outcomes = allOutcomes.filter(kind => kind !== 'BOSS_SURRENDER');
          const clearIndex = outcomes.indexOf('BOSS_CLEAR');
          const timeoutsBeforeClear = (clearIndex < 0 ? outcomes : outcomes.slice(0, clearIndex)).filter(kind => kind === 'BOSS_TIMEOUT').length;
          const verdict = clearIndex >= 0 && timeoutsBeforeClear < budget ? 'PASS' : timeoutsBeforeClear >= budget ? 'FAIL' : 'INCONCLUSIVE';
          return { seed: facts.seed, verdict, surrenders: allOutcomes.filter(kind => kind === 'BOSS_SURRENDER').length, lampActionsDuringBoss: facts.equipmentActions.filter(action => action.bossActive).length, arrival: arrival ? { t: arrival.t, heroes: arrival.heroes, boss: arrival.boss, loadouts: arrival.loadouts } : null, outcomes, timeoutsBeforeClear, endReason: facts.endReason, ordinaryClearsBeforeFirstBoss: facts.waveClears.filter(clear => !arrival || clear.t <= arrival.t).length };
        });
        earned = { verdict: combine(sessions.map(session => session.verdict)), budget, sessions, evidence: evidenceLink(earnedLoaded) };
      }
    }
    return {
      verdict: combine([underprepared, progressed, earned.verdict]),
      subResults: { underpreparedTimeoutsWithLivingParty: underprepared, progressedWins: progressed, earnedArrivalClears: earned.verdict },
      threshold,
      sweep,
      earned,
    };
  },

  recovery(claim, ctx) {
    const rule = { consecutiveClears: 20, ...claim.rule };
    const rows = (claim.scenarios.primary || []).map(id => ctx.loaded.get(id)).map(loaded => {
      const perSeed = loaded.kind === 'event_log' ? seedRows(loaded, loaded.scenario.expect?.seeds, facts => {
        const reasons = [];
        const firstKO = facts.heroKOs[0];
        if (!firstKO) return { verdict: 'INCONCLUSIVE', reasons: ['no initial forced Hero KO observed'] };
        const recovery = facts.recoveries.find(entry => entry.t >= firstKO.t);
        if (!recovery) return { verdict: facts.endReason === 'timeout' ? 'INCONCLUSIVE' : 'FAIL', reasons: ['no recovery after initial KO'] };
        const partySize = (facts.heroes || []).length;
        const full = recovery.heroes.length === partySize && recovery.heroes.every(hero => hero.full === true);
        const transition = facts.recoveryTransitions.find(entry => entry.t >= firstKO.t);
        const sameStage = transition ? transition.before?.region === transition.after?.region && transition.before?.stage === transition.after?.stage && transition.before?.wave === transition.after?.wave : null;
        const later = consecutiveClearsAfter(facts, recovery.t);
        const laterKOs = facts.heroKOs.filter(ko => ko.t > recovery.t);
        let verdict = 'PASS';
        if (!full) { verdict = 'FAIL'; reasons.push(`restore not full: ${recovery.heroes.map(hero => `${hero.name} ${hero.hpAfter}/${hero.maxHp}`).join(', ')}`); }
        if (sameStage === false) { verdict = 'FAIL'; reasons.push(`stage/wave changed ${JSON.stringify(transition.before)} -> ${JSON.stringify(transition.after)}`); }
        if (sameStage === null) { verdict = verdict === 'FAIL' ? 'FAIL' : 'INCONCLUSIVE'; reasons.push('recovery transition not observed'); }
        if (laterKOs.length) { verdict = 'FAIL'; reasons.push(`${laterKOs.length} additional Hero KO(s)`); }
        if (facts.gapCount) { verdict = 'FAIL'; reasons.push(`${facts.gapCount} missing events`); }
        if (facts.deadlockCount) { verdict = 'FAIL'; reasons.push('deadlock'); }
        if (later.ambiguous) { verdict = verdict === 'FAIL' ? 'FAIL' : 'INCONCLUSIVE'; reasons.push(`${later.ambiguous} ambiguous transition(s)`); }
        if (later.clears < rule.consecutiveClears && verdict !== 'FAIL') { verdict = facts.endReason === 'timeout' ? 'INCONCLUSIVE' : 'FAIL'; reasons.push(`${later.clears} post-recovery clears < ${rule.consecutiveClears} (end ${facts.endReason})`); }
        return { verdict, initialKO: firstKO, recoveryT: recovery.t, stagesCleared: stagesCleared(facts), laterKOs: laterKOs.map(ko => `${ko.name} t=${ko.t} ${ko.stage} W${ko.wave}`), restored: recovery.heroes, sameStageWave: sameStage, postRecoveryClears: later.clears, additionalKOs: laterKOs.length, bossAttempts: facts.bossEnds.map(end => end.kind), endReason: facts.endReason, reasons };
      }) : [];
      return { scenario: loaded.scenario.id, timing: loaded.scenario.timing, ...scenarioVerdict(loaded, perSeed), perSeed, evidence: evidenceLink(loaded), model: modelSummary(loaded) };
    });
    return { verdict: combine(rows.map(row => row.verdict)), rows };
  },
};

export function evaluateClaims(doc, { repo, declaration }) {
  const problems = validateClaimsDocument(doc);
  if (problems.length) throw new Error(`Invalid claims document:\n- ${problems.join('\n- ')}`);
  const loaded = new Map(doc.scenarios.map(scenario => [scenario.id, loadScenario(scenario, { repo, candidateSha: doc.candidate.sha, declaration })]));
  const ctx = { loaded, doc };
  const results = doc.claims.map(claim => ({ id: claim.id, title: claim.title, kind: claim.kind, tests: claim.tests, pillar: claim.pillar || null, requirements: claim.requirements || [], references: claim.references || [], expectation: claim.expectation, unknowns: claim.unknowns || [], ...evaluators[claim.kind](claim, ctx) }));
  const pillars = ['survival', 'pressure', 'earned_boss', 'recovery'].map(pillar => {
    const claim = results.find(result => result.pillar === pillar);
    const verdict = pillar === 'earned_boss' ? claim?.subResults?.earnedArrivalClears : claim?.verdict;
    return { pillar, claim: claim?.id ?? null, verdict: verdict ?? 'INCONCLUSIVE' };
  });
  return {
    design: { verdict: pillars.every(pillar => pillar.verdict === 'PASS') ? 'PILLARS MET (fixture-scoped; not a design approval)' : 'NOT PROVEN', pillars },
    results,
    loaded,
    model: { version: MODEL_VERSION, assumptions: ASSUMPTIONS },
  };
}
