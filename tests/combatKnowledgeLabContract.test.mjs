import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadObservedLog, validateSession } from '../tools/combat_lab/observed.mjs';
import { sessionFacts, consecutiveClearsAfter } from '../tools/combat_lab/metrics.mjs';
import { replaySession, counterfactual, capBound, survivalEnvelope } from '../tools/combat_lab/model.mjs';
import { combine, capForTiming, evaluateClaims, validateClaimsDocument } from '../tools/combat_lab/claims.mjs';
import { checkScenarioProvenance, compareGameSource, EMPTY_PATCH_SHA256 } from '../tools/combat_lab/provenance.mjs';
import { obsLine, renderTimeline } from '../tools/combat_lab/render.mjs';

const REPO = process.cwd();
const CANDIDATE = 'c43f614714fe07c27b2aad6bc80e727bb485603e';
const MAIN_BASELINE = '1efb593a4871381992181f9283e5b20d3f064fc4';
const SEED = 3235774465;
const COMMITTED = { status: 'committed', committedAt: '2026-01-01T00:00:00Z' };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'combat-lab-test-'));

const heroes = (overrides = {}) => [
  { uid: 1, name: 'Falie', level: 1, hp: 85, maxHp: 85, ...overrides.Falie },
  { uid: 2, name: 'Huun', level: 1, hp: 60, maxHp: 60, ...overrides.Huun },
  { uid: 3, name: 'Runa', level: 1, hp: 69, maxHp: 69, ...overrides.Runa },
];
const hit = (id, t, targetUID, hpBefore, hpAfter, extra = {}) => ({ session: 1, seed: SEED, record: 'combat', id, simTime: t, time: t, pollTime: t, type: 'damage', sourceUID: 50, sourceName: 'Skeleton', sourceKind: 'enemy', sourceCombatTier: 'routine', sourceEnemyDataTier: 'fodder', targetUID, targetName: ['', 'Falie', 'Huun', 'Runa'][targetUID], targetKind: 'hero', damageType: 'physical', amount: hpBefore - hpAfter, hpBefore, hpAfter, targetMaxHpAtPoll: [0, 85, 60, 69][targetUID], wave: 1, ...extra });
const heal = (id, t, targetUID, hpBefore, hpAfter, extra = {}) => ({ session: 1, seed: SEED, record: 'combat', id, simTime: t, time: t, pollTime: t, type: 'heal', reason: 'ordinary_wave_clear', sourceUID: 0, sourceKind: 'system', targetUID, targetName: ['', 'Falie', 'Huun', 'Runa'][targetUID], targetKind: 'hero', amount: hpAfter - hpBefore, hpBefore, hpAfter, wave: 1, ...extra });
const start = (extra = {}) => ({ session: 1, seed: SEED, record: 'session_start', pollTime: 0, simTime: 0, heroSlots: ['Falie', 'Huun', 'Runa', ''], heroes: heroes(), lampFixtureSha256: 'lamp-sha', heroFixtureSha256: 'hero-sha', autoEquip: true, bossPolicy: 'hold', maxWaves: 2, maxBossClears: 0, maxBossTimeouts: 0, startCombatEventId: 0, ...extra });
const clear = (t, count) => ({ session: 1, seed: SEED, record: 'wave_clear', pollTime: t, delta: 1, completedOrdinaryWaves: count, progression: { region: 1, stage: 1, wave: count + 1 }, source: 'runtime_counter' });
const end = (extra = {}) => ({ session: 1, seed: SEED, record: 'session_end', pollTime: 99, endReason: 'max_waves', completedOrdinaryWaves: 2, deadlockCount: 0, missingCombatEvents: 0, ambiguousWaveTransitions: 0, ...extra });
const header = (extra = {}) => ({ record: 'run_start', startedAt: '2026-06-01T00:00:00Z', source: { head: CANDIDATE, patchSha256: EMPTY_PATCH_SHA256, untracked: [] }, harnessSource: { head: CANDIDATE, patchSha256: EMPTY_PATCH_SHA256 }, heroSlots: ['Falie', 'Huun', 'Runa', ''], autoEquip: true, bossPolicy: 'hold', maxWaves: 2, maxBossClears: 0, maxBossTimeouts: 0, statePollMs: 40, ...extra });

function writeLog(name, records) {
  const file = path.join(tmp, `${name}.ndjson`);
  fs.writeFileSync(file, records.map(record => JSON.stringify(record)).join('\n') + '\n');
  return file;
}

const cleanRun = () => [header(), start(), hit(1, 5, 3, 69, 68), hit(2, 6, 3, 68, 67), heal(3, 10, 3, 67, 69), clear(10, 1), hit(4, 12, 2, 60, 59), heal(5, 20, 2, 59, 60), clear(20, 2), end()];

function claimsDoc(scenarioOverrides = {}, eventLog) {
  return {
    schema: 'orka.combat-claims.v1', declaredAt: '2026-01-01T00:00:00Z', candidate: { sha: CANDIDATE },
    sources: { REQ: [{ id: 'REQ-1', text: 'starter gate', ref: 'test' }], REF: [] },
    scenarios: [{ id: 'starter', timing: 'prospective', fixtureClass: 'synthetic', evidence: { eventLog }, expect: { lampFixtureSha256: 'lamp-sha', heroFixtureSha256: 'hero-sha', heroSlots: ['Falie', 'Huun', 'Runa', ''], seeds: [SEED] }, ...scenarioOverrides }],
    claims: [{ id: 'C1', title: 'starter', kind: 'starter_farming', tests: 'fixture', pillar: 'survival', requirements: ['REQ-1'], expectation: 'two clears', scenarios: { primary: ['starter'] }, rule: { consecutiveClears: 2, maxHeroKOs: 0 } }],
  };
}

test('provenance mismatch makes evidence inadmissible and the claim inconclusive', () => {
  assert.deepEqual(checkScenarioProvenance({ lampFixtureSha256: 'a' }, { lampFixtureSha256: 'a' }), []);
  assert.match(checkScenarioProvenance({ heroFixtureSha256: 'a' }, { heroFixtureSha256: 'b' })[0], /hero fixture SHA-256/);
  assert.match(checkScenarioProvenance({ seeds: [1, 2] }, { seeds: [1] })[0], /seeds missing/);
  const changedRuntime = compareGameSource(REPO, { head: MAIN_BASELINE, patchSha256: EMPTY_PATCH_SHA256 }, CANDIDATE);
  assert.equal(changedRuntime.status, 'mismatch');
  assert.equal(compareGameSource(REPO, { head: CANDIDATE, patchSha256: 'dirty' }, CANDIDATE).status, 'unknown');
  assert.equal(compareGameSource(REPO, { head: CANDIDATE, patchSha256: EMPTY_PATCH_SHA256 }, CANDIDATE).status, 'unchanged');

  const wrongFixture = writeLog('wrong-fixture', cleanRun().map(record => (record.record === 'session_start' ? { ...record, heroFixtureSha256: 'other' } : record)));
  const result = evaluateClaims(claimsDoc({}, wrongFixture), { repo: REPO, declaration: COMMITTED }).results[0];
  assert.equal(result.verdict, 'INCONCLUSIVE');
  assert.match(result.rows[0].reason, /hero fixture SHA-256/);

  const dirtySource = writeLog('dirty-source', cleanRun().map(record => (record.record === 'run_start' ? header({ source: { head: CANDIDATE, patchSha256: 'abc' } }) : record)));
  assert.equal(evaluateClaims(claimsDoc({}, dirtySource), { repo: REPO, declaration: COMMITTED }).results[0].verdict, 'INCONCLUSIVE');
});

test('claims that were not committed before a prospective run cannot pass', () => {
  const file = writeLog('declaration', cleanRun());
  assert.equal(evaluateClaims(claimsDoc({}, file), { repo: REPO, declaration: COMMITTED }).results[0].verdict, 'PASS');
  assert.equal(evaluateClaims(claimsDoc({}, file), { repo: REPO, declaration: { status: 'uncommitted' } }).results[0].verdict, 'INCONCLUSIVE');
  const late = evaluateClaims(claimsDoc({}, file), { repo: REPO, declaration: { status: 'committed', committedAt: '2026-07-01T00:00:00Z' } }).results[0];
  assert.equal(late.verdict, 'INCONCLUSIVE');
  assert.match(late.rows[0].reason, /before claim commit/);
});

test('missing data stays explicit instead of becoming a pass', () => {
  const missingFile = evaluateClaims(claimsDoc({}, path.join(tmp, 'absent.ndjson')), { repo: REPO, declaration: COMMITTED }).results[0];
  assert.equal(missingFile.verdict, 'INCONCLUSIVE');
  assert.match(missingFile.rows[0].reason, /evidence missing/);
  const truncated = writeLog('truncated', cleanRun().filter(record => record.record !== 'session_end'));
  const log = loadObservedLog(truncated, 'starter');
  assert.ok(log.sessions[0].issues.some(issue => issue.code === 'missing_session_end'));
  const noHeader = writeLog('no-header', cleanRun().filter(record => record.record !== 'run_start'));
  assert.ok(loadObservedLog(noHeader, 'x').issues.some(issue => issue.code === 'missing_run_start'));
  const missingField = validateSession([start(), { ...hit(1, 5, 3, 69, 68), hpBefore: null }, end()]);
  assert.ok(missingField.issues.some(issue => issue.code === 'missing_field'));
  const rendered = obsLine(loadObservedLog(writeLog('line', cleanRun()), 'x').sessions[0].records.find(record => record.kind === 'HIT'));
  assert.equal(rendered, 'OBS t=5 W1 Skeleton → Runa HIT physical HP 69→68 applied=1 raw=? cap=?');
});

test('event ordering faults and gaps are detected and fail the zero-gap gate', () => {
  const outOfOrder = validateSession([start(), hit(2, 5, 3, 69, 68), hit(1, 6, 3, 68, 67), end()]);
  assert.ok(outOfOrder.issues.some(issue => issue.code === 'id_order'));
  const timeBack = validateSession([start(), hit(1, 6, 3, 69, 68), hit(2, 5, 3, 68, 67), end()]);
  assert.ok(timeBack.issues.some(issue => issue.code === 'time_order'));
  const undeclared = validateSession([start(), hit(1, 5, 3, 69, 68), hit(4, 6, 3, 68, 67), end({ missingCombatEvents: 2 })]);
  assert.ok(undeclared.issues.some(issue => issue.code === 'undeclared_gap'));
  assert.equal(undeclared.gapCount, 2);
  const disagree = validateSession([start(), hit(1, 5, 3, 69, 68), { session: 1, record: 'event_gap', afterId: 1, nextId: 3, missing: 1 }, hit(3, 6, 3, 68, 67), end({ missingCombatEvents: 0 })]);
  assert.ok(disagree.issues.some(issue => issue.code === 'gap_count_disagrees'));
  assert.ok(!disagree.issues.some(issue => issue.code === 'undeclared_gap'));
  const amount = validateSession([start(), { ...hit(1, 5, 3, 69, 68), amount: 3 }, end()]);
  assert.ok(amount.issues.some(issue => issue.code === 'amount_mismatch'));

  const records = cleanRun();
  records.splice(5, 0, { session: 1, seed: SEED, record: 'event_gap', pollTime: 10, afterId: 3, nextId: 5, missing: 1 });
  const gapped = writeLog('gapped', records.filter(record => record.id !== 4).map(record => (record.record === 'session_end' ? { ...record, missingCombatEvents: 1 } : record)));
  const result = evaluateClaims(claimsDoc({}, gapped), { repo: REPO, declaration: COMMITTED }).results[0];
  assert.equal(result.verdict, 'FAIL');
  assert.match(result.rows[0].perSeed[0].reasons.join(' '), /missing event/);
  const replay = replaySession(loadObservedLog(gapped, 'x').sessions[0]);
  assert.equal(replay.status, 'stopped');
});

test('shadow replay finds the first divergence from declared rules', () => {
  const consistent = replaySession(loadObservedLog(writeLog('replay-ok', cleanRun()), 'x').sessions[0]);
  assert.equal(consistent.status, 'consistent');
  assert.ok(consistent.records.some(record => record.kind === 'HIT_CHECK' && record.capRelation === 'at_bound' && record.capBound === 1));
  // Unlogged HP change: Runa jumps from 67 to 60 between events.
  const hidden = cleanRun().map(record => (record.id === 3 ? heal(3, 10, 3, 60, 69) : record));
  const diverged = replaySession(loadObservedLog(writeLog('replay-hidden', hidden), 'x').sessions[0]);
  assert.equal(diverged.firstDivergence.code, 'hp_continuity');
  assert.equal(diverged.firstDivergence.refId, 3);
  // A wave heal smaller than ceil(15%) diverges from A3; a hit above the cap bound diverges from A1.
  const smallHeal = replaySession(loadObservedLog(writeLog('replay-heal', cleanRun().map(record => (record.id === 3 ? heal(3, 10, 3, 67, 68) : record))), 'x').sessions[0]);
  assert.equal(smallHeal.firstDivergence.code, 'wave_heal');
  const bigHit = replaySession(loadObservedLog(writeLog('replay-cap', cleanRun().map(record => (record.id === 2 ? hit(2, 6, 3, 68, 65) : record.id === 3 ? heal(3, 10, 3, 65, 69) : record))), 'x').sessions[0]);
  assert.equal(bigHit.firstDivergence.code, 'cap_rule');
  assert.equal(capBound(99, 'routine'), 1);
  assert.equal(capBound(100, 'routine'), 2);
});

function attritionSession(falieLevel = 1) {
  const records = [header(), start({ heroes: heroes({ Falie: { level: falieLevel } }) })];
  let id = 0;
  let hp = 85;
  let t = 1;
  for (let wave = 1; wave <= 12; wave += 1) {
    for (let index = 0; index < 8; index += 1) { records.push(hit(++id, t, 1, hp, hp - 1)); hp -= 1; t += 1; }
    const healed = Math.min(85, hp + 13);
    if (healed > hp) records.push(heal(++id, t, 1, hp, healed));
    hp = healed;
    records.push(clear(t, wave));
    t += 1;
  }
  records.push(end({ completedOrdinaryWaves: 12 }));
  return loadObservedLog(writeLog(`attrition-${falieLevel}`, records), 'x').sessions[0];
}

test('counterfactual stops at the first event where altered state could change later events', () => {
  const noHealL1 = counterfactual(attritionSession(1), { waveHealFraction: 0 });
  assert.equal(noHealL1.cutoff.reason, 'ko_state_differs');
  assert.equal(noHealL1.afterCutoff, 'UNKNOWN');
  // Without healing Falie loses 8 per wave from 85: the 85th hit is the first altered KO.
  assert.equal(noHealL1.cutoff.refId, 85 + Math.floor(84 / 8));
  assert.ok(noHealL1.steps.every(step => step.t <= noHealL1.cutoff.t));

  // At level 5 Iron Resolve reads Falie's own HP below 45%; the replay must stop when only the altered
  // trace crosses that guard, long before any KO.
  const noHealL5 = counterfactual(attritionSession(5), { waveHealFraction: 0 });
  assert.equal(noHealL5.cutoff.reason, 'hp_guard_threshold');
  assert.match(noHealL5.cutoff.detail, /iron_resolve/);
  assert.ok(noHealL5.cutoff.t < noHealL1.cutoff.t);

  const cap = counterfactual(attritionSession(1), { capFractionScale: 2 });
  assert.equal(cap.cutoff.reason, 'raw_damage_unknown');
  assert.equal(cap.cutoff.refId, 1);

  const unchanged = counterfactual(attritionSession(1), {});
  assert.equal(unchanged.complete, true);
  assert.equal(unchanged.cutoff, null);
});

test('verdict classification never lets missing, retrospective or model evidence pass', () => {
  assert.equal(combine([]), 'INCONCLUSIVE');
  assert.equal(combine(['PASS', 'PASS']), 'PASS');
  assert.equal(combine(['PASS', 'INCONCLUSIVE']), 'INCONCLUSIVE');
  assert.equal(combine(['INCONCLUSIVE', 'FAIL']), 'FAIL');
  assert.equal(capForTiming('PASS', 'retrospective'), 'INCONCLUSIVE');
  assert.equal(capForTiming('FAIL', 'retrospective'), 'FAIL');

  const koRun = cleanRun().map(record => (record.id === 4 ? hit(4, 12, 2, 1, 0) : record.id === 5 ? { ...heal(5, 20, 2, 0, 0), type: 'recovery', reason: 'ordinary_defeat', amount: 0 } : record));
  const evaluation = evaluateClaims(claimsDoc({}, writeLog('ko', koRun)), { repo: REPO, declaration: COMMITTED });
  assert.equal(evaluation.results[0].verdict, 'FAIL');
  assert.equal(evaluation.design.verdict, 'NOT PROVEN');

  const short = cleanRun().filter(record => !(record.record === 'wave_clear' && record.completedOrdinaryWaves === 2)).map(record => (record.record === 'session_end' ? { ...record, endReason: 'timeout' } : record));
  assert.equal(evaluateClaims(claimsDoc({}, writeLog('short', short)), { repo: REPO, declaration: COMMITTED }).results[0].verdict, 'INCONCLUSIVE');

  const facts = sessionFacts(loadObservedLog(writeLog('streak', cleanRun()), 'x').sessions[0]);
  assert.equal(consecutiveClearsAfter(facts, -1).clears, 2);

  // A passing survival claim alone cannot make the design verdict anything but NOT PROVEN.
  const passing = evaluateClaims(claimsDoc({}, writeLog('pass', cleanRun())), { repo: REPO, declaration: COMMITTED });
  assert.equal(passing.results[0].verdict, 'PASS');
  assert.equal(passing.design.verdict, 'NOT PROVEN');
  assert.deepEqual(passing.design.pillars.filter(pillar => pillar.verdict !== 'PASS').map(pillar => pillar.pillar), ['pressure', 'earned_boss', 'recovery']);

  const capDoc = claimsDoc({}, writeLog('cap', cleanRun()));
  capDoc.claims = [{ id: 'C3', title: 'cap', kind: 'cap_share', tests: 'model_assumption', requirements: [], expectation: 'unknown', scenarios: { traces: ['starter'] } }];
  const cap = evaluateClaims(capDoc, { repo: REPO, declaration: COMMITTED }).results[0];
  assert.equal(cap.verdict, 'INCONCLUSIVE');
  assert.equal(cap.observed.cappedHitShare, 'UNKNOWN');
  assert.equal(cap.observed.label, 'OBS');
  assert.equal(cap.model.label, 'MODEL');
  assert.deepEqual(cap.model.cappedShareInterval, [0, 1]);
});

test('claim documents must declare timing, fixture class and known sources', () => {
  const doc = claimsDoc({}, 'x');
  doc.scenarios[0].timing = 'later';
  doc.claims[0].requirements = ['REQ-404'];
  const problems = validateClaimsDocument(doc);
  assert.ok(problems.some(problem => /timing/.test(problem)));
  assert.ok(problems.some(problem => /unknown source REQ-404/.test(problem)));
});

test('survival envelope is a labeled independent forward prediction', () => {
  const envelope = survivalEnvelope({ hp: 69, maxHp: 69 });
  assert.equal(envelope.capBound, 1);
  assert.equal(envelope.maxSurvivableUniformHitsPerWave, 13);
  assert.equal(envelope.maxSurvivableWithoutHeal, 3);
  assert.deepEqual(envelope.assumptions, ['A1', 'A3', 'A10', 'A11']);
  const session = loadObservedLog(writeLog('timeline', cleanRun()), 'x').sessions[0];
  const timeline = renderTimeline(session, replaySession(session));
  assert.ok(timeline.lines.some(line => line.startsWith('MODEL t=5 #1 cap≤1')));
  assert.ok(timeline.lines.every(line => /^(OBS|MODEL) /.test(line)));
});

test('the lab does not import Wishfire combat modules as its model oracle', () => {
  for (const file of ['model.mjs', 'claims.mjs', 'metrics.mjs', 'observed.mjs', 'render.mjs', 'provenance.mjs']) {
    const source = fs.readFileSync(path.join(REPO, 'tools/combat_lab', file), 'utf8');
    assert.doesNotMatch(source, /from ['"][^'"]*(web-runner|src\/core|Scripts)\//, `${file} imports runtime code`);
  }
  const status = execFileSync('git', ['status', '--porcelain', '--', 'web-runner', 'src', 'Scripts', 'rust'], { cwd: REPO, encoding: 'utf8' });
  assert.equal(status.trim(), '', 'runtime paths must stay unchanged in this lane');
});

test('harness boss policy and event log are explicit, optional and default-off', async () => {
  const { createRequire } = await import('node:module');
  const harness = createRequire(import.meta.url)('../tools/balance_harness.js');
  const defaults = harness.buildConfig([]);
  assert.equal(defaults.eventLog, '');
  assert.equal(defaults.bossPolicy, 'auto');
  assert.equal(harness.shouldSummonReadyBoss({ bossPolicy: 'auto', maxBossClears: 0 }), false);
  assert.equal(harness.shouldSummonReadyBoss({ bossPolicy: 'auto', maxBossClears: 1 }), true);
  assert.equal(harness.shouldSummonReadyBoss({ bossPolicy: 'hold', maxBossClears: 0 }), false);
  assert.equal(harness.shouldSummonReadyBoss({ bossPolicy: 'summon', maxBossClears: 0 }), true);
  assert.equal(harness.shouldSummonReadyBoss({ bossPolicy: 'farm:4' }, 3), false);
  assert.equal(harness.shouldSummonReadyBoss({ bossPolicy: 'farm:4' }, 4), true);
  assert.throws(() => harness.buildConfig(['--bossPolicy', 'sometimes']), /bossPolicy/);
  assert.throws(() => harness.buildConfig(['--bossPolicy', 'hold', '--maxBossClears', '1']), /hold cannot target boss clears/);
  const config = harness.buildConfig(['--eventLog', 'true', '--outputDir', tmp]);
  assert.equal(config.eventLog, path.join(tmp, 'observed_events.ndjson'));
  const log = harness.createEventLog(config.eventLog, { startedAt: 'now', source: { head: CANDIDATE } });
  log.append([{ session: 1, record: 'session_start' }]);
  const lines = fs.readFileSync(config.eventLog, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(lines.map(line => line.record), ['run_start', 'session_start']);
});

test('boss surrender is not a combat outcome and max-HP growth lowers the event-time ratio', async () => {
  const records = [header(), start(),
    { session: 1, seed: SEED, record: 'hero_state', pollTime: 3, uid: 2, name: 'Huun', level: 1, hp: 60, maxHp: 80 },
    { session: 1, seed: SEED, record: 'boss_start', pollTime: 4, bossUID: 9, bossName: 'Troll', bossHp: 231, bossMaxHp: 231, gameTimeLimitSec: 18, heroes: heroes() },
    { session: 1, seed: SEED, record: 'equipment_action', pollTime: 6, action: 'collect', bossActive: true },
    { session: 1, seed: SEED, record: 'boss_end', pollTime: 8, outcome: 'ko_recovery', startedAt: 4, gameTimeLimitSec: 18 },
    ...[1, 2, 3].map((uid, index) => ({ ...heal(index + 1, 8, uid, [0, 85, 60, 69][uid], [0, 85, 80, 69][uid]), type: 'recovery', reason: 'boss_surrender', recoveryIndex: 1 })),
    end()];
  const facts = sessionFacts(loadObservedLog(writeLog('surrender', records), 'x').sessions[0]);
  assert.deepEqual(facts.bossEnds.map(endRecord => endRecord.kind), ['BOSS_SURRENDER']);
  assert.equal(facts.equipmentActions.length, 1);
  const huun = facts.heroes.find(hero => hero.name === 'Huun');
  assert.equal(huun.minHp, 60);
  assert.equal(huun.lowestRatio, 0.75);
  const { createRequire } = await import('node:module');
  const harness = createRequire(import.meta.url)('../tools/balance_harness.js');
  assert.equal(harness.bossLampPause({ bossActive: true }), true);
  assert.equal(harness.bossLampPause({ bossAvailable: true, bossSummonRequired: false }), true);
  assert.equal(harness.bossLampPause({ bossAvailable: true, bossSummonRequired: true }), false);
  assert.equal(harness.bossLampPause({ bossTransitionEndsAtMs: Date.now() + 5000 }), true);
});

test('long combat silence is measured and flagged without changing the predeclared verdict rule', () => {
  const records = cleanRun().filter(record => !(record.record === 'wave_clear' && record.completedOrdinaryWaves === 2)).map(record => (record.record === 'session_end' ? { ...record, pollTime: 900, endReason: 'timeout' } : record));
  const facts = sessionFacts(loadObservedLog(writeLog('silence', records), 'x').sessions[0]);
  assert.equal(facts.longestSilence.seconds, 880);
  const result = evaluateClaims(claimsDoc({}, writeLog('silence2', records)), { repo: REPO, declaration: COMMITTED }).results[0];
  assert.equal(result.verdict, 'INCONCLUSIVE');
  assert.match(result.rows[0].perSeed[0].reasons.join(' '), /candidate softlock/);
});
