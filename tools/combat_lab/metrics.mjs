// Facts derived from OBS records only. Every output is still an observation of the unchanged game;
// no rule, cap or model assumption is applied here.

const byOrder = (a, b) => (a.evidence?.line ?? 0) - (b.evidence?.line ?? 0);

// Max HP is sampled at polls. Return the latest known value at or before time t and whether a
// change was observed within the poll window, which makes event-time max HP uncertain.
export function maxHpTimeline(session) {
  const timeline = new Map();
  for (const hero of session.start?.heroes || []) timeline.set(hero.uid, [{ t: 0, maxHp: hero.maxHp }]);
  for (const record of session.records) {
    if (record.kind === 'HERO_STATE') {
      const entries = timeline.get(record.hero.uid) || [];
      if (!entries.length || entries.at(-1).maxHp !== record.hero.maxHp) entries.push({ t: record.t, maxHp: record.hero.maxHp });
      timeline.set(record.hero.uid, entries);
    }
  }
  return {
    at(uid, t, pollWindow = 0.2) {
      const entries = timeline.get(uid) || [];
      let known = null;
      let next = null;
      for (const entry of entries) {
        if (entry.t <= t) known = entry;
        else { next = entry; break; }
      }
      const uncertain = !!next && next.t - t <= pollWindow && next.maxHp !== known?.maxHp;
      return { maxHp: known?.maxHp ?? null, uncertain, alternative: uncertain ? next.maxHp : null };
    },
  };
}

export function sessionFacts(session, { statePollMs = 40 } = {}) {
  const records = session.records.slice().sort(byOrder);
  const pollWindow = Math.max(0.2, (statePollMs / 1000) * 4 * 1.5);
  const maxHp = maxHpTimeline(session);
  const heroes = new Map((session.start?.heroes || []).map(hero => [hero.uid, { uid: hero.uid, name: hero.name, level: hero.level, startHp: hero.hp, startMaxHp: hero.maxHp, minHp: hero.hp, minHpAt: 0, minHpMaxHp: hero.maxHp, minHpMaxHpUncertain: false, lowestRatio: hero.maxHp ? hero.hp / hero.maxHp : null, lowestRatioAt: 0, lowestRatioHp: hero.hp, lowestRatioMaxHp: hero.maxHp, lowestRatioUncertain: false, currentHp: hero.hp, hits: 0, applied: 0, appliedByAmount: {}, healing: {}, kos: 0 }]));
  // Lowest current/max ratio at any HP event or observed max-HP change (max HP rises without healing).
  const noteRatio = (hero, t, hp) => {
    const known = maxHp.at(hero.uid, t, pollWindow);
    if (!known.maxHp) return;
    const ratio = hp / known.maxHp;
    if (hero.lowestRatio == null || ratio < hero.lowestRatio) Object.assign(hero, { lowestRatio: ratio, lowestRatioAt: t, lowestRatioHp: hp, lowestRatioMaxHp: known.maxHp, lowestRatioUncertain: known.uncertain });
  };
  const kos = [];
  const recoveries = new Map();
  const waveClears = [];
  const ambiguousClears = [];
  const gaps = records.filter(record => record.kind === 'GAP');
  const deadlocks = records.filter(record => record.kind === 'DEADLOCK');
  // A boss attempt whose recovery reason is boss_surrender ended by leaving combat (e.g. opening
  // the Lamp), not by KO or timer; it is not a combat outcome.
  const surrenderTimes = records.filter(record => record.kind === 'RECOVER' && record.reason === 'boss_surrender').map(record => record.t);
  const bossEnds = records.filter(record => ['BOSS_CLEAR', 'BOSS_TIMEOUT', 'BOSS_KO_RECOVERY', 'BOSS_EXIT'].includes(record.kind))
    .map(record => (record.kind === 'BOSS_KO_RECOVERY' && surrenderTimes.some(t => t <= record.t + 1e-6 && record.t - t <= 1) ? { ...record, kind: 'BOSS_SURRENDER', surrender: true } : record));
  const equipmentActions = records.filter(record => record.kind === 'EQUIPMENT');
  const bossStarts = records.filter(record => record.kind === 'BOSS_START');
  const hits = [];
  for (const record of records) {
    const hero = heroes.get(record.target?.uid);
    if (record.kind === 'HERO_STATE') {
      const owner = heroes.get(record.hero.uid);
      if (owner && owner.currentHp > 0) noteRatio(owner, record.t, Math.min(owner.currentHp, record.hero.maxHp));
    }
    if (['HIT', 'HEAL', 'RECOVER'].includes(record.kind) && hero) {
      hero.currentHp = record.hpAfter;
      if (record.hpAfter > 0) noteRatio(hero, record.t, record.hpAfter);
    }
    if (record.kind === 'HIT' && hero) {
      hero.hits += 1;
      hero.applied += record.applied;
      hero.appliedByAmount[record.applied] = (hero.appliedByAmount[record.applied] || 0) + 1;
      hits.push(record);
      if (record.hpAfter < hero.minHp) {
        const known = maxHp.at(hero.uid, record.t, pollWindow);
        Object.assign(hero, { minHp: record.hpAfter, minHpAt: record.t, minHpMaxHp: known.maxHp, minHpMaxHpUncertain: known.uncertain, minHpEventId: record.id });
      }
    } else if (record.kind === 'HEAL' && hero) {
      const key = record.healSource === 'ordinary_wave_clear' ? 'ordinary_wave_clear' : `skill:${record.healerName || record.source?.uid}`;
      hero.healing[key] = (hero.healing[key] || 0) + record.applied;
    } else if (record.kind === 'KO' && hero) {
      hero.kos += 1;
      kos.push({ t: record.t, id: record.id, uid: hero.uid, name: hero.name, wave: record.wave, stage: record.stage, bossActive: record.bossActiveAtPoll });
    } else if (record.kind === 'RECOVER') {
      const entry = recoveries.get(record.recoveryIndex) || { index: record.recoveryIndex, t: record.t, firstId: record.id, reason: record.reason, heroes: [] };
      const known = maxHp.at(record.target.uid, record.t, pollWindow);
      entry.heroes.push({ uid: record.target.uid, name: record.target.name, hpBefore: record.hpBefore, hpAfter: record.hpAfter, maxHp: known.maxHp, maxHpUncertain: known.uncertain, full: known.maxHp == null ? null : record.hpAfter === known.maxHp });
      recoveries.set(record.recoveryIndex, entry);
    } else if (record.kind === 'WAVE_CLEAR') {
      waveClears.push(record);
    } else if (record.kind === 'WAVE_CLEAR_AMBIGUOUS') {
      ambiguousClears.push(record);
    }
  }
  const transitions = records.filter(record => record.kind === 'RECOVERY_TRANSITION');
  return {
    session: session.session,
    seed: session.seed,
    endReason: session.end?.endReason ?? null,
    completedOrdinaryWaves: session.end?.completedOrdinaryWaves ?? null,
    waveClears,
    ambiguousClears,
    heroKOs: kos,
    recoveries: [...recoveries.values()],
    recoveryTransitions: transitions,
    gaps,
    gapCount: session.gapCount,
    deadlocks,
    deadlockCount: session.end?.deadlockCount ?? deadlocks.length,
    bossStarts,
    bossEnds,
    equipmentActions,
    hits,
    heroes: [...heroes.values()],
    issues: session.issues,
  };
}

// Consecutive ordinary clears after a given time with no intervening Hero KO.
export function consecutiveClearsAfter(facts, t) {
  const laterKO = facts.heroKOs.find(ko => ko.t > t);
  const clears = facts.waveClears.filter(clear => clear.t > t && (!laterKO || clear.t < laterKO.t));
  const ambiguous = facts.ambiguousClears.filter(clear => clear.t > t && (!laterKO || clear.t < laterKO.t));
  return { clears: clears.length + ambiguous.reduce((sum, clear) => sum + Math.max(0, Number(clear.delta) || 0), 0), exactClears: clears.length, ambiguous: ambiguous.length, interruptedBy: laterKO || null };
}

// Segment hits by ordinary wave-clear polls. Boundaries are poll-bounded, never exact.
export function hitsPerWave(facts) {
  const bounds = facts.waveClears.map(clear => clear.t);
  const perHero = new Map();
  for (const hit of facts.hits) {
    const segment = bounds.filter(boundary => boundary < hit.t).length;
    const key = hit.target.uid;
    if (!perHero.has(key)) perHero.set(key, new Map());
    const segments = perHero.get(key);
    segments.set(segment, (segments.get(segment) || 0) + 1);
  }
  const segmentCount = bounds.length + 1;
  return Object.fromEntries([...facts.heroes].map(hero => {
    const segments = perHero.get(hero.uid) || new Map();
    const counts = Array.from({ length: segmentCount }, (_, index) => segments.get(index) || 0);
    const completed = counts.slice(0, bounds.length);
    return [hero.name, { completedWaves: completed.length, maxHitsInWave: completed.length ? Math.max(...completed) : 0, meanHitsPerWave: completed.length ? Number((completed.reduce((a, b) => a + b, 0) / completed.length).toFixed(2)) : 0, counts }];
  }));
}
