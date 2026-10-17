// OBSERVED stream: normalizes the harness `--eventLog` NDJSON into labeled observation records.
// Values the runtime does not expose stay null with an explicit reason. Nothing here predicts.
import fs from 'node:fs';

export const UNKNOWN_RAW = 'runtime telemetry records applied HP change only; pre-cap damage is not exposed';
export const UNKNOWN_CAP = 'whether the hostile-hit cap bound is not exposed by any read-only surface';
const HIT_FIELDS = ['id', 'simTime', 'targetUID', 'amount', 'hpBefore', 'hpAfter'];

export function readNdjson(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const records = [];
  const issues = [];
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    try {
      records.push({ ...JSON.parse(line), __line: index + 1 });
    } catch (error) {
      issues.push({ code: 'unparseable_line', line: index + 1, detail: error.message });
    }
  });
  return { records, issues };
}

const roundTime = value => (value == null || !Number.isFinite(Number(value)) ? null : Number(Number(value).toFixed(3)));

function base(raw, scenario, file) {
  return { label: 'OBS', scenario, session: raw.session ?? null, seed: raw.seed ?? null, evidence: { file, line: raw.__line } };
}

function bossKind(outcome) {
  return { clear: 'BOSS_CLEAR', timeout: 'BOSS_TIMEOUT', ko_recovery: 'BOSS_KO_RECOVERY' }[outcome] || 'BOSS_EXIT';
}

// Map one raw harness record to zero or more OBS records.
export function normalizeRecord(raw, scenario, file) {
  const common = base(raw, scenario, file);
  switch (raw.record) {
    case 'session_start':
      return [{ ...common, kind: 'SESSION_START', t: 0, timeSource: 'poll', heroes: raw.heroes, heroSlots: raw.heroSlots, loadouts: raw.loadouts, progression: raw.progression, fixtures: { lamp: raw.lampFixtureSha256, hero: raw.heroFixtureSha256 }, autoEquip: raw.autoEquip, bossPolicy: raw.bossPolicy, maxWaves: raw.maxWaves, maxBossClears: raw.maxBossClears, maxBossTimeouts: raw.maxBossTimeouts, wallTime: raw.wallTime }];
    case 'session_end':
      return [{ ...common, kind: 'SESSION_END', t: roundTime(raw.pollTime), timeSource: 'poll', endReason: raw.endReason, completedOrdinaryWaves: raw.completedOrdinaryWaves, deadlockCount: raw.deadlockCount, missingCombatEvents: raw.missingCombatEvents, ambiguousWaveTransitions: raw.ambiguousWaveTransitions, defeatRecoveries: raw.defeatRecoveries, bossesCleared: raw.bossesCleared, bossTimeouts: raw.bossTimeouts, waveClearSource: raw.waveClearSource, heroes: raw.heroes, progression: raw.progression, wallTime: raw.wallTime }];
    case 'hero_state':
      return [{ ...common, kind: 'HERO_STATE', t: roundTime(raw.pollTime), timeSource: 'poll', hero: { uid: raw.uid, name: raw.name, level: raw.level, hp: raw.hp, maxHp: raw.maxHp, stats: raw.stats, combatPower: raw.combatPower } }];
    case 'progression':
      return [{ ...common, kind: 'PROGRESSION', t: roundTime(raw.pollTime), timeSource: 'poll', progression: raw.progression }];
    case 'wave_clear':
    case 'wave_clear_ambiguous':
      return [{ ...common, kind: raw.record === 'wave_clear' ? 'WAVE_CLEAR' : 'WAVE_CLEAR_AMBIGUOUS', t: roundTime(raw.pollTime), timeSource: 'poll', delta: raw.delta, completedOrdinaryWaves: raw.completedOrdinaryWaves, progression: raw.progression, counterSource: raw.source }];
    case 'recovery_transition':
      return [{ ...common, kind: 'RECOVERY_TRANSITION', t: roundTime(raw.pollTime), timeSource: 'poll', transition: raw.transition, before: raw.before, after: raw.after, counterDelta: raw.counterDelta, heroes: raw.heroes }];
    case 'boss_start':
      return [{ ...common, kind: 'BOSS_START', t: roundTime(raw.pollTime), timeSource: 'poll', boss: { uid: raw.bossUID, name: raw.bossName, hp: raw.bossHp, maxHp: raw.bossMaxHp }, gameTimeLimitSec: raw.gameTimeLimitSec, timerStartedAt: raw.timerStartedAtRel, heroes: raw.heroes, loadouts: raw.loadouts, progression: raw.progression }];
    case 'boss_end':
      return [{ ...common, kind: bossKind(raw.outcome), t: roundTime(raw.pollTime), timeSource: 'poll', outcome: raw.outcome, startedAt: raw.startedAt, boss: { uid: raw.bossUID, maxHp: raw.bossMaxHp ?? null, timeoutHp: raw.timeoutBossHp ?? null, lastSampledHp: raw.lastSampledBossHp ?? null }, gameElapsedSec: raw.gameElapsedSec ?? null, gameTimeLimitSec: raw.gameTimeLimitSec ?? null, timeoutHeroes: raw.timeoutHeroes ?? null, heroes: raw.heroes }];
    case 'boss_summon_click':
      return [{ ...common, kind: 'SUMMON', t: roundTime(raw.pollTime), timeSource: 'poll', policy: raw.policy }];
    case 'event_gap':
      return [{ ...common, kind: 'GAP', t: roundTime(raw.pollTime), timeSource: 'poll', afterId: raw.afterId, nextId: raw.nextId, missing: raw.missing }];
    case 'equipment_action':
      return [{ ...common, kind: 'EQUIPMENT', t: roundTime(raw.pollTime), timeSource: 'poll', action: raw.action, bossPause: raw.bossPause ?? null, bossActive: raw.bossActive ?? null }];
    case 'deadlock':
      return [{ ...common, kind: 'DEADLOCK', t: roundTime(raw.pollTime), timeSource: 'poll' }];
    case 'combat':
      return normalizeCombat(raw, common);
    default:
      return [];
  }
}

function normalizeCombat(raw, common) {
  const event = {
    ...common,
    id: raw.id,
    t: roundTime(raw.time),
    pollTime: roundTime(raw.pollTime),
    timeSource: 'event',
    wave: raw.wave ?? raw.progressionAtPoll?.wave ?? null,
    waveSource: raw.wave != null ? 'event' : raw.progressionAtPoll?.wave != null ? 'poll' : null,
    stage: raw.progressionAtPoll ? `${raw.progressionAtPoll.region}-${raw.progressionAtPoll.stage}` : null,
    bossActiveAtPoll: raw.progressionAtPoll ? !!raw.progressionAtPoll.bossActive : null,
    source: { uid: raw.sourceUID, name: raw.sourceName, kind: raw.sourceKind, combatTier: raw.sourceCombatTier, enemyDataTier: raw.sourceEnemyDataTier },
    target: { uid: raw.targetUID, name: raw.targetName, kind: raw.targetKind },
    hpBefore: raw.hpBefore,
    hpAfter: raw.hpAfter,
    applied: raw.amount,
    maxHp: raw.targetMaxHpAtPoll ?? null,
    maxHpSource: raw.targetMaxHpAtPoll == null ? null : 'poll_after_event',
  };
  if (raw.type === 'damage') {
    const hit = { ...event, kind: 'HIT', damageType: raw.damageType || 'unknown', raw: null, cap: null, unknown: { raw: UNKNOWN_RAW, cap: UNKNOWN_CAP } };
    return raw.hpAfter <= 0 ? [hit, { ...event, kind: 'KO', applied: undefined, cause: { eventId: raw.id } }] : [hit];
  }
  if (raw.type === 'heal') return [{ ...event, kind: 'HEAL', healSource: raw.reason || (raw.sourceUID ? 'skill' : 'unspecified'), healerName: raw.sourceUID ? raw.sourceName : null }];
  if (raw.type === 'recovery') return [{ ...event, kind: 'RECOVER', recoveryIndex: raw.recoveryIndex, reason: raw.reason }];
  if (raw.type === 'enemy_ko') return [{ ...event, kind: 'ENEMY_KO' }];
  return [{ ...event, kind: 'UNKNOWN_EVENT', rawType: raw.type }];
}

// Validates one session's raw records and returns issues. Gaps and ordering faults are evidence
// problems, not combat outcomes.
export function validateSession(rawRecords) {
  const issues = [];
  const starts = rawRecords.filter(record => record.record === 'session_start');
  const ends = rawRecords.filter(record => record.record === 'session_end');
  if (starts.length !== 1) issues.push({ code: starts.length ? 'duplicate_session_start' : 'missing_session_start' });
  if (ends.length !== 1) issues.push({ code: ends.length ? 'duplicate_session_end' : 'missing_session_end', detail: 'log may be truncated' });
  let lastId = starts[0]?.startCombatEventId ?? null;
  let lastTime = null;
  let gapCount = 0;
  const declaredGaps = rawRecords.filter(record => record.record === 'event_gap');
  for (const record of rawRecords.filter(entry => entry.record === 'combat')) {
    const missingFields = HIT_FIELDS.filter(field => record[field] === undefined || record[field] === null);
    if (missingFields.length) issues.push({ code: 'missing_field', line: record.__line, id: record.id, detail: missingFields.join(', ') });
    if (lastId != null && record.id <= lastId) issues.push({ code: 'id_order', line: record.__line, id: record.id, detail: `id ${record.id} after ${lastId}` });
    if (lastId != null && record.id > lastId + 1) {
      gapCount += record.id - lastId - 1;
      if (!declaredGaps.some(gap => gap.afterId === lastId && gap.nextId === record.id)) issues.push({ code: 'undeclared_gap', line: record.__line, detail: `ids ${lastId + 1}..${record.id - 1} absent` });
    }
    if (lastTime != null && Number(record.simTime) < lastTime) issues.push({ code: 'time_order', line: record.__line, id: record.id, detail: `simTime ${record.simTime} before ${lastTime}` });
    if (record.type === 'damage' || record.type === 'heal' || record.type === 'recovery') {
      const delta = record.type === 'damage' ? record.hpBefore - record.hpAfter : record.hpAfter - record.hpBefore;
      if (Number.isFinite(delta) && delta !== record.amount) issues.push({ code: 'amount_mismatch', line: record.__line, id: record.id, detail: `amount ${record.amount} but HP ${record.hpBefore}->${record.hpAfter}` });
    }
    lastId = record.id;
    lastTime = Number(record.simTime);
  }
  if (gapCount) issues.push({ code: 'event_gap', detail: `${gapCount} combat event id(s) missing` });
  const end = ends[0];
  if (end && Number(end.missingCombatEvents || 0) !== gapCount) issues.push({ code: 'gap_count_disagrees', detail: `harness reported ${end.missingCombatEvents}, log shows ${gapCount}` });
  return { issues, gapCount };
}

export function loadObservedLog(file, scenario) {
  const { records, issues } = readNdjson(file);
  const header = records.find(record => record.record === 'run_start') || null;
  const fileIssues = [...issues];
  if (!header) fileIssues.push({ code: 'missing_run_start', detail: 'source fingerprint and run settings are unavailable' });
  const bySession = new Map();
  for (const record of records) {
    if (record.record === 'run_start') continue;
    if (record.session == null) { fileIssues.push({ code: 'record_without_session', line: record.__line }); continue; }
    if (!bySession.has(record.session)) bySession.set(record.session, []);
    bySession.get(record.session).push(record);
  }
  const sessions = [...bySession.entries()].sort(([a], [b]) => a - b).map(([session, raw]) => {
    const { issues: sessionIssues, gapCount } = validateSession(raw);
    const obs = raw.flatMap(record => normalizeRecord(record, scenario, file));
    const start = obs.find(record => record.kind === 'SESSION_START') || null;
    const end = obs.find(record => record.kind === 'SESSION_END') || null;
    return { session, seed: raw[0]?.seed ?? null, start, end, records: obs, issues: sessionIssues, gapCount };
  });
  return { file, header, sessions, issues: fileIssues };
}

// Summarize what the run itself declared, for provenance comparison.
export function observedRunSettings(log) {
  const firstStart = log.sessions[0]?.start;
  return {
    lampFixtureSha256: firstStart?.fixtures?.lamp ?? null,
    heroFixtureSha256: firstStart?.fixtures?.hero ?? null,
    heroSlots: firstStart?.heroSlots ?? log.header?.heroSlots ?? null,
    autoEquip: log.header?.autoEquip,
    bossPolicy: log.header?.bossPolicy,
    maxWaves: log.header?.maxWaves,
    maxBossClears: log.header?.maxBossClears,
    maxBossTimeouts: log.header?.maxBossTimeouts,
    seeds: log.sessions.map(session => session.seed),
    openingHeroes: firstStart?.heroes || [],
    sessionFixtureMismatch: log.sessions.some(session => JSON.stringify(session.start?.fixtures) !== JSON.stringify(firstStart?.fixtures)),
  };
}

// Pinned aggregate reports predate the event log. They provide per-session summaries only.
export function loadAggregateReport(file) {
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    file,
    run: report.run,
    aggregate: report.aggregate,
    sessions: (report.sessions || []).map(session => ({
      session: session.sessionId,
      seed: session.seed,
      wavesCompleted: session.wavesCompleted,
      heroCasualties: session.heroCasualties,
      defeatRecoveries: session.defeatRecoveries,
      deadlockCount: session.deadlockCount,
      endReason: session.endReason,
      missingCombatEvents: session.measurementLimits?.missingCombatEvents ?? null,
      ambiguousWaveTransitions: session.measurementLimits?.ambiguousWaveTransitions ?? null,
      waveClearSource: session.measurementLimits?.waveClearSource ?? null,
      orderedCombatEventStreamObserved: session.measurementLimits?.orderedCombatEventStreamObserved ?? null,
      heroes: session.heroes,
      bossAttempts: session.bossAttempts,
      recoveryRecords: session.recoveryRecords,
      recoveryAttempts: session.recoveryAttempts,
      maximumAppliedDamage: session.recordedHeroDamageEvents?.maximumAppliedDamage ?? null,
      byCombatTier: session.recordedHeroDamageEvents?.byCombatTier ?? null,
      fixtures: { lamp: session.equipment?.fixture?.sha256 ?? null, hero: session.partyFixture?.heroProgress?.sha256 ?? null },
      heroSlots: session.partyFixture?.activeSlots ?? null,
    })),
  };
}

// The only per-hit line a saved aggregate report can render is its retained maximum-hit sample.
export function aggregateSampleHit(session, scenario, file) {
  const hit = session.maximumAppliedDamage;
  if (!hit) return null;
  return {
    label: 'OBS', scenario, session: session.session, seed: session.seed, kind: 'HIT', id: null, t: hit.time, timeSource: 'event', wave: hit.wave, waveSource: 'event',
    source: { uid: hit.sourceUID, name: hit.impactGeometry?.source?.name ?? null, combatTier: hit.impactGeometry?.source?.combatTier ?? null, enemyDataTier: null },
    target: { uid: hit.targetUID, name: hit.target, kind: 'hero' }, damageType: hit.damageType, hpBefore: hit.hpBefore, hpAfter: hit.hpAfter, applied: hit.amount,
    raw: null, cap: null, unknown: { raw: UNKNOWN_RAW, cap: UNKNOWN_CAP }, maxHp: null, evidence: { file, path: `sessions[${session.session - 1}].recordedHeroDamageEvents.maximumAppliedDamage` },
  };
}
