// A trace-locked design sandbox. Changed HP never changes recorded attacks or targeting.
export const SUSTAIN_MODEL_VERSION = '2';

const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
const round = value => Math.round(value * 1000) / 1000;
const sameTime = (a, b) => Math.abs(a - b) < 0.001;

function evadeRoll(eventId, seed) {
  let value = ((Number(eventId) || 0) ^ (Number(seed) || 0)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 0x100000000;
}

function sourceWindow(records, trace, invalidReasons) {
  const selected = records.filter(row => row.scenario === trace.scenario && row.session === trace.session);
  const start = finite(trace.startTime);
  const end = finite(trace.endTime);
  if (!selected.some(row => row.kind === 'SESSION_START')) invalidReasons.push('session start missing');
  if (start == null || end == null || end <= start) invalidReasons.push('invalid trace window');
  const target = String(trace.targetHero || '');
  const before = selected.filter(row => row.t <= start).flatMap(row => {
    if (row.target?.name === target && Number.isFinite(row.hpAfter)) return [{ hp: row.hpAfter, maxHp: row.maxHp }];
    if (row.kind === 'HERO_STATE' && row.hero?.name === target) return [{ hp: row.hero.hp, maxHp: row.hero.maxHp }];
    if (['SESSION_START', 'BOSS_START', 'RECOVERY_TRANSITION'].includes(row.kind)) {
      const hero = row.heroes?.find(item => item.name === target);
      if (hero) return [{ hp: hero.hp, maxHp: hero.maxHp }];
    }
    return [];
  });
  const last = before.at(-1);
  const observedStartHp = last?.hp ?? null;
  if (observedStartHp !== trace.initialHp) invalidReasons.push(`opening HP ${observedStartHp ?? '?'} differs from pinned ${trace.initialHp}`);
  if (Number.isFinite(last?.maxHp) && last.maxHp !== trace.maxHp) invalidReasons.push(`opening max HP ${last.maxHp} differs from pinned ${trace.maxHp}`);
  const window = selected.filter(row => row.t > start && row.t <= end);
  if (!window.some(row => row.kind === 'HIT' && row.target?.name === target)) invalidReasons.push('target has no incoming hits in window');
  if (window.some(row => row.kind === 'GAP')) invalidReasons.push('observed event gap in window');
  if (window.some(row => row.kind === 'HERO_STATE' && row.hero?.name === target && row.hero.maxHp !== trace.maxHp)) invalidReasons.push('target max HP changed in window');
  const seed = selected.find(row => row.kind === 'SESSION_START')?.seed ?? null;
  return { window, seed, start, end, target };
}

export function evaluateSustainCase(observedRecords, caseSpec) {
  const invalidReasons = [];
  const trace = caseSpec.trace || {};
  const model = caseSpec.model || {};
  const maxHp = finite(trace.maxHp);
  const initialHp = finite(trace.initialHp);
  const mitigation = finite(model.mitigationFraction ?? 0);
  const evasion = finite(model.evasionFraction ?? 0);
  const regen = finite(model.regenHpPerSecond ?? 0);
  const drain = finite(model.drainHpPerStrike ?? 0);
  const interval = model.attackIntervalSeconds == null ? null : finite(model.attackIntervalSeconds);
  const pressure = finite(model.pressureMultiplier ?? 1);
  if (maxHp == null || maxHp <= 0 || initialHp == null || initialHp < 0 || initialHp > maxHp) invalidReasons.push('invalid opening HP');
  if (mitigation == null || mitigation < 0 || mitigation > 1) invalidReasons.push('mitigationFraction must be 0..1');
  if (evasion == null || evasion < 0 || evasion > 1) invalidReasons.push('evasionFraction must be 0..1');
  if (regen == null || regen < 0 || drain == null || drain < 0) invalidReasons.push('healing rates must be nonnegative');
  if (pressure == null || pressure <= 0) invalidReasons.push('pressureMultiplier must be positive');
  if (drain > 0 && (interval == null || interval <= 0)) invalidReasons.push('drain requires a positive assumed attack interval');
  const source = sourceWindow(observedRecords, trace, invalidReasons);
  const incoming = source.window.filter(row => row.kind === 'HIT' && row.target?.name === source.target);
  const kills = source.window.filter(row => row.kind === 'ENEMY_KO');
  const observedOtherHeroKos = source.window.filter(row => row.kind === 'KO' && row.target?.name !== source.target);
  const summary = {
    modelVersion: SUSTAIN_MODEL_VERSION, combatContext: trace.combatContext || (String(trace.scenario).startsWith('boss') ? 'boss' : 'farming'),
    initialHp, maxHp, minHp: initialHp,
    minHpFraction: maxHp > 0 ? initialHp / maxHp : null, finalHp: initialHp,
    heroKoCount: 0, observedOtherHeroKoCount: observedOtherHeroKos.length,
    firstKoTime: null, incomingHitCount: 0,
    sourceIncomingHitCount: incoming.length, enemyKoCount: kills.length,
    incomingDamageObserved: round(incoming.reduce((sum, row) => sum + (finite(row.applied) || 0), 0)),
    incomingDamageModeled: 0, preventedByDefense: 0, evadedHits: 0,
    regenHealing: 0, drainHealing: 0, waveHealing: 0, traceComplete: invalidReasons.length === 0,
    invalidReasons, stoppedAtModelKo: false,
  };
  const result = {
    caseId: caseSpec.id,
    source: { scenario: trace.scenario, session: trace.session, seed: source.seed,
      hero: trace.displayHero || trace.targetHero, startTime: source.start, endTime: source.end,
      wave: trace.wave ?? null, type: 'OBS incoming hit schedule with frozen targeting' },
    summary, steps: [],
  };
  if (invalidReasons.length) return result;

  const heals = source.window.filter(row => row.kind === 'HEAL' && row.target?.name === source.target);
  const unknownHeals = heals.filter(row => row.healSource !== 'ordinary_wave_clear');
  if (unknownHeals.length) {
    invalidReasons.push('non-wave healing in frozen window has unknown altered-state amount');
    summary.traceComplete = false;
    return result;
  }
  const events = incoming.map(row => ({ t: row.t, kind: 'INCOMING', row }))
    .concat(kills.map(row => ({ t: row.t, kind: 'ENEMY_KO', row })),
      heals.map(row => ({ t: row.t, kind: 'WAVE_HEAL', row })));
  if (drain > 0) {
    for (let t = source.start + interval; t <= source.end + 0.000001; t += interval)
      events.push({ t: round(t), kind: 'ASSUMED_STRIKE' });
  }
  if (regen > 0) {
    for (let t = Math.floor(source.start) + 1; t <= source.end; t += 1)
      if (t > source.start) events.push({ t, kind: 'REGEN_TICK' });
  }
  const priority = { REGEN_TICK: 0, ASSUMED_STRIKE: 1, ENEMY_KO: 2, INCOMING: 3, WAVE_HEAL: 4 };
  events.sort((a, b) => a.t - b.t || priority[a.kind] - priority[b.kind] || (a.row?.id || 0) - (b.row?.id || 0));

  let hp = initialHp;
  let priorTime = source.start;
  const push = (event, kind, before, after, detail, amount = 0) => result.steps.push({
    label: kind === 'ENEMY_KO' ? 'OBS' : 'MODEL', kind, t: round(event.t),
    elapsed: round(event.t - source.start), hpBefore: round(before), hpAfter: round(after),
    amount: round(amount), detail, refId: event.row?.id ?? null,
  });
  for (const event of events) {
    const delta = Math.max(0, event.t - priorTime);
    if (regen > 0 && delta > 0 && hp > 0) {
      const gained = Math.min(maxHp - hp, regen * delta);
      if (gained > 0.000001) {
        const before = hp;
        hp += gained;
        summary.regenHealing += gained;
        push(event, 'REGEN', before, hp, `passive +${round(gained)} HP over ${round(delta)}s`, gained);
      }
    }
    priorTime = event.t;
    if (event.kind === 'REGEN_TICK') continue;
    if (event.kind === 'ENEMY_KO') {
      push(event, 'ENEMY_KO', hp, hp, `${event.row.source?.name || 'Hero'} KO ${event.row.target?.name || 'enemy'} (observed)`);
      continue;
    }
    if (event.kind === 'ASSUMED_STRIKE') {
      const gained = Math.min(maxHp - hp, drain);
      const before = hp;
      hp += gained;
      summary.drainHealing += gained;
      push(event, 'DRAIN', before, hp, `assumed successful strike +${round(gained)} HP`, gained);
      continue;
    }
    if (event.kind === 'WAVE_HEAL') {
      const gained = hp > 0 ? Math.min(maxHp - hp, Math.ceil(maxHp * 0.15)) : 0;
      const before = hp;
      hp += gained;
      summary.waveHealing += gained;
      push(event, 'WAVE_HEAL', before, hp, `ordinary wave-clear rule +${round(gained)} HP`, gained);
      continue;
    }
    const observed = finite(event.row.applied);
    if (observed == null || observed < 0) {
      invalidReasons.push(`invalid applied damage at event ${event.row.id ?? '?'}`);
      summary.traceComplete = false;
      break;
    }
    summary.incomingHitCount += 1;
    const scaled = Math.ceil(observed * pressure);
    const dodged = evadeRoll(event.row.id ?? summary.incomingHitCount, model.evadeSeed ?? source.seed) < evasion;
    // OBS is already post-DEF, post-cap integer HP loss. This is only a
    // hypothetical post-hit shield; it cannot recover the hidden DEF input.
    const damage = dodged ? 0 : Math.ceil(scaled * (1 - mitigation));
    const blocked = dodged ? 0 : scaled - damage;
    summary.evadedHits += Number(dodged);
    summary.preventedByDefense += blocked;
    summary.incomingDamageModeled += damage;
    const before = hp;
    hp = Math.max(0, hp - damage);
    summary.minHp = Math.min(summary.minHp, hp);
    push(event, dodged ? 'EVADE' : 'HIT', before, hp,
      `${event.row.source?.name || 'enemy'} → ${trace.displayHero || source.target}: OBS ${observed} HP, MODEL ${round(damage)} HP` +
      (blocked ? `, post-hit shield ${round(blocked)}` : ''), damage);
    if (hp <= 0) {
      summary.heroKoCount = 1;
      summary.firstKoTime = round(event.t);
      summary.stoppedAtModelKo = true;
      push(event, 'MODEL_KO', hp, hp, 'model HP reached zero; later frozen-trace events are not simulated');
      break;
    }
  }
  summary.finalHp = round(hp);
  summary.minHp = round(summary.minHp);
  summary.minHpFraction = maxHp > 0 ? round(summary.minHp / maxHp) : null;
  for (const field of ['incomingDamageModeled', 'preventedByDefense', 'regenHealing', 'drainHealing', 'waveHealing']) summary[field] = round(summary[field]);
  return result;
}

export function gradeSustainCase(summary, expectation = {}) {
  if (summary.combatContext === 'farming' && (summary.heroKoCount > 0 || summary.observedOtherHeroKoCount > 0))
    return { status: 'FAIL', reasons: ['any Hero KO during farming is immediate failure'] };
  if (!summary.traceComplete || summary.invalidReasons?.length) return { status: 'UNKNOWN', reasons: summary.invalidReasons?.length ? summary.invalidReasons : ['trace incomplete'] };
  const reasons = [];
  const checks = [];
  if (Number.isFinite(expectation.maxHeroKOs)) {
    const ok = summary.heroKoCount <= expectation.maxHeroKOs;
    checks.push(ok);
    if (!ok) reasons.push(`${summary.heroKoCount} Hero KO exceeds ${expectation.maxHeroKOs}`);
  }
  if (Number.isFinite(expectation.minHeroKOs)) {
    const ok = summary.heroKoCount >= expectation.minHeroKOs;
    checks.push(ok);
    if (!ok) reasons.push(`${summary.heroKoCount} Hero KO below ${expectation.minHeroKOs}`);
  }
  if (Number.isFinite(expectation.minHpFractionAtLeast)) {
    const ok = summary.minHpFraction + 0.0000001 >= expectation.minHpFractionAtLeast;
    checks.push(ok);
    if (!ok) reasons.push(`minimum HP ${round(summary.minHpFraction * 100)}% below ${round(expectation.minHpFractionAtLeast * 100)}%`);
  }
  if (!checks.length) return { status: 'UNKNOWN', reasons: ['case has no success rule'] };
  return { status: checks.every(Boolean) ? 'PASS' : 'FAIL', reasons: reasons.length ? reasons : ['all declared model checks met'] };
}
