import baseTest, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { projectPartyScenario } from '../tools/combat_lab/party_sustain.mjs';

const source = 'output/orka-7l9-knowledge-lab/sample/observed.ndjson.gz';
// Quarantined where the untracked knowledge-lab observations are absent (clean checkouts, worktrees).
const missing = !fs.existsSync(source) && `missing untracked fixture ${source}`;
const test = (name, fn) => baseTest(name, { skip: missing }, fn);
const rows = missing ? [] : zlib.gunzipSync(fs.readFileSync(source)).toString('utf8').trim().split('\n').map(JSON.parse);
const temp = fs.mkdtempSync('/private/tmp/orka-7l9-party-contract-');
after(() => fs.rmSync(temp, { recursive: true, force: true }));

test('unchanged five-seed farming observations miss the 90% all-Hero floor', () => {
  for (const scenario of ['starter-l1-nokaja', 'kaja-l1-four']) {
    const result = projectPartyScenario(rows, scenario, 0, 0.9);
    assert.equal(result.status, 'FAIL');
    assert.equal(result.runs.length, 5);
    assert.ok(result.runs.every(run => run.waves === 20 && run.firstModelKo === null));
  }
});

test('30% delayed refund alone misses the 90% farming floor', () => {
  const recovery = { damageRefundFraction: 0.3, damageRefundDelaySeconds: 2, healGearMaxHpGrowth: true };
  for (const scenario of ['starter-l1-nokaja', 'kaja-l1-four'])
    assert.equal(projectPartyScenario(rows, scenario, 0, 0.9, recovery).status, 'FAIL');
});

test('fractional 0.11 HP/s plus 30% refund misses the floor after whole-HP payout', () => {
  const recovery = { damageRefundFraction: 0.3, damageRefundDelaySeconds: 2, healGearMaxHpGrowth: true };
  const result = projectPartyScenario(rows, 'starter-l1-nokaja', 0.11, 0.9, recovery);
  assert.equal(result.status, 'FAIL');
  assert.ok(result.runs.every(run => run.waves === 20 && run.firstModelKo === null));
});

test('30% refund and 0.2% max-HP regen pass four farming party fixtures across five seeds', () => {
  const recovery = { damageRefundFraction: 0.3, damageRefundDelaySeconds: 2,
    regenFractionMaxHpPerSecond: 0.002, healGearMaxHpGrowth: true };
  for (const scenario of ['starter-l1-nokaja', 'kaja-l1-four', 'kaja-l15-three', 'kaja-l15-four']) {
    const result = projectPartyScenario(rows, scenario, 0, 0.9, recovery);
    assert.equal(result.status, 'PASS', scenario);
    assert.ok(result.runs.every(run => run.waves === 20 && run.minHpPct >= 90));
  }
  assert.equal(projectPartyScenario(rows, 'starter-l1-nokaja', 0, 0.9,
    { ...recovery, damageRefundFraction: 0 }).status, 'FAIL');
  assert.equal(projectPartyScenario(rows, 'starter-l1-nokaja', 0, 0.9,
    { ...recovery, regenFractionMaxHpPerSecond: 0 }).status, 'FAIL');
});

test('one recovery rule, 0.4% max-HP regen, passes farming with gear HP fill', () => {
  const recovery = { regenFractionMaxHpPerSecond: 0.004, healGearMaxHpGrowth: true };
  for (const scenario of ['starter-l1-nokaja', 'kaja-l1-four', 'kaja-l15-three', 'kaja-l15-four']) {
    const result = projectPartyScenario(rows, scenario, 0, 0.9, recovery);
    assert.equal(result.status, 'PASS', scenario);
    assert.ok(result.runs.every(run => run.firstModelKo === null && run.minHpPct >= 90));
  }
  assert.equal(projectPartyScenario(rows, 'starter-l1-nokaja', 0, 0.9,
    { regenFractionMaxHpPerSecond: 0.00285, healGearMaxHpGrowth: true }).status, 'FAIL');
  assert.equal(projectPartyScenario(rows, 'starter-l1-nokaja', 0, 0.9,
    { regenFractionMaxHpPerSecond: 0.004 }).status, 'FAIL');
});

test('a second whole-HP point per 1-HP fodder hit breaks the 0.4% model floor', () => {
  const recovery = { regenFractionMaxHpPerSecond: 0.004,
    healGearMaxHpGrowth: true, incomingPressureMultiplier: 1.1 };
  for (const scenario of ['starter-l1-nokaja', 'kaja-l1-four']) {
    const result = projectPartyScenario(rows, scenario, 0, 0.9, recovery);
    assert.equal(result.status, 'FAIL', scenario);
    assert.ok(result.runs.every(run => run.firstModelKo === null));
  }
});

test('two stronger recovery envelopes retain 90% farming floor under quantized pressure', () => {
  const cases = [
    { regenFractionMaxHpPerSecond: 0.015, healGearMaxHpGrowth: true,
      incomingPressureMultiplier: 1.1 },
    { regenFractionMaxHpPerSecond: 0.01, damageRefundFraction: 0.3,
      damageRefundDelaySeconds: 2, healGearMaxHpGrowth: true, incomingPressureMultiplier: 1.1 },
  ];
  for (const recovery of cases) {
    for (const scenario of ['starter-l1-nokaja', 'kaja-l1-four', 'kaja-l15-three', 'kaja-l15-four']) {
      const result = projectPartyScenario(rows, scenario, 0, 0.9, recovery);
      assert.equal(result.status, 'PASS', `${scenario} ${JSON.stringify(recovery)}`);
      assert.ok(result.runs.every(run => run.minHpPct >= 90 && run.firstModelKo === null));
    }
  }
});

test('ordinary HP floor excludes boss hits in a mixed trace', () => {
  const synthetic = [
    { kind: 'SESSION_START', t: 0, seed: 1, heroes: [{ name: 'Huun', hp: 100, maxHp: 100 }] },
    { kind: 'HIT', t: 1, target: { name: 'Huun' }, source: { combatTier: 'routine' },
      applied: 2, wave: 1 },
    { kind: 'BOSS_START', t: 2 },
    { kind: 'HIT', t: 3, target: { name: 'Huun' }, source: { combatTier: 'boss' },
      bossActiveAtPoll: true, applied: 30, wave: 1 },
    { kind: 'BOSS_CLEAR', t: 4 },
    { kind: 'WAVE_CLEAR', t: 5, delta: 20 },
    { kind: 'SESSION_END', t: 6, completedOrdinaryWaves: 20, missingCombatEvents: 0,
      ambiguousWaveTransitions: 0, deadlockCount: 0, defeatRecoveries: 0 },
  ].map(row => ({ ...row, scenario: 'mixed', session: 1 }));
  const run = projectPartyScenario(synthetic, 'mixed', 0, 0.9).runs[0];
  assert.equal(run.status, 'PASS');
  assert.equal(run.minHpPct, 98);
});

test('boss duration cannot grant passive farming regen', () => {
  const synthetic = [
    { kind: 'SESSION_START', t: 0, seed: 1, heroes: [{ name: 'Huun', hp: 100, maxHp: 100 }] },
    { kind: 'HIT', t: 0.5, target: { name: 'Huun' }, source: { combatTier: 'routine' }, applied: 45 },
    { kind: 'BOSS_START', t: 1 },
    { kind: 'BOSS_CLEAR', t: 101 },
    { kind: 'HIT', t: 102, target: { name: 'Huun' }, source: { combatTier: 'routine' }, applied: 60 },
    { kind: 'WAVE_CLEAR', t: 103, delta: 20 },
    { kind: 'SESSION_END', t: 104, completedOrdinaryWaves: 20, missingCombatEvents: 0,
      ambiguousWaveTransitions: 0, deadlockCount: 0, defeatRecoveries: 0 },
  ].map(row => ({ ...row, scenario: 'clock', session: 1 }));
  const run = projectPartyScenario(synthetic, 'clock', 1, 0.1).runs[0];
  assert.equal(run.status, 'FAIL');
  assert.equal(run.firstModelKo.hero, 'Huun');
});

test('the candidate fails without the proposed gear HP fill', () => {
  const recovery = { damageRefundFraction: 0.3, damageRefundDelaySeconds: 2 };
  for (const scenario of ['starter-l1-nokaja', 'kaja-l1-four'])
    assert.equal(projectPartyScenario(rows, scenario, 0.11, 0.9, recovery).status, 'FAIL');
});

test('the 90% formula misses a stricter 95% floor', () => {
  const recovery = { regenFractionMaxHpPerSecond: 0.004, healGearMaxHpGrowth: true };
  for (const scenario of ['starter-l1-nokaja', 'kaja-l1-four'])
    assert.equal(projectPartyScenario(rows, scenario, 0, 0.95, recovery).status, 'FAIL');
});

test('0.7% max-HP/s with gear fill reaches a 95% starter model floor', () => {
  const recovery = { regenFractionMaxHpPerSecond: 0.007, healGearMaxHpGrowth: true };
  for (const scenario of ['starter-l1-nokaja', 'kaja-l1-four'])
    assert.equal(projectPartyScenario(rows, scenario, 0, 0.95, recovery).status, 'PASS');
});

test('source KO and incomplete runs cannot certify a five-seed endurance formula', () => {
  assert.equal(projectPartyScenario(rows, 'gear-def10', 0.11, 0.9).status, 'FAIL');
  const run = projectPartyScenario(rows, 'gear-def10', 0.11, 0.9).runs;
  assert.ok(run.some(item => item.status === 'UNKNOWN'));
  assert.ok(run.some(item => item.status === 'FAIL' || item.reason.includes('source ko')));
});

test('HP-truncated source lethal hits cannot prove a counterfactual rescue', () => {
  const recovery = { damageRefundFraction: 0.3, damageRefundDelaySeconds: 2,
    regenFractionMaxHpPerSecond: 0.002, healGearMaxHpGrowth: true };
  const result = projectPartyScenario(rows, 'gear-base', 0, 0.9, recovery);
  const boundary = result.runs.find(run => run.sourceKoBoundary?.hero === 'Falie');
  assert.ok(boundary);
  assert.equal(boundary.status, 'UNKNOWN');
  assert.ok(boundary.sourceKoBoundary.modeledHpBeforePct > 0);
  assert.ok(boundary.sourceKoBoundary.appliedLowerBoundHp > 0);
  assert.match(boundary.reason, /HP-truncated/);
});

test('a lethal burst fails before its delayed refund can heal', () => {
  const synthetic = [
    { kind: 'SESSION_START', t: 0, seed: 1, heroes: [{ name: 'Falie', hp: 10, maxHp: 10 }] },
    { kind: 'HIT', t: 1, target: { name: 'Falie' }, applied: 10, wave: 1 },
    { kind: 'WAVE_CLEAR', t: 3, delta: 20 },
    { kind: 'SESSION_END', t: 4, completedOrdinaryWaves: 20, missingCombatEvents: 0,
      ambiguousWaveTransitions: 0, deadlockCount: 0, defeatRecoveries: 0 },
  ];
  const result = projectPartyScenario(synthetic.map(row => ({ ...row, scenario: 'burst', session: 1 })),
    'burst', 0, 0.9, { damageRefundFraction: 0.3, damageRefundDelaySeconds: 2 });
  assert.equal(result.runs[0].status, 'FAIL');
  assert.equal(result.runs[0].firstModelKo.hero, 'Falie');
});

test('gear HP fill and passive regen cannot erase a lethal post-growth burst', () => {
  const synthetic = [
    { kind: 'SESSION_START', t: 0, seed: 1, heroes: [{ name: 'Huun', hp: 60, maxHp: 60, level: 1 }] },
    { kind: 'HERO_STATE', t: 1, hero: { name: 'Huun', hp: 60, maxHp: 70, level: 1 } },
    { kind: 'HIT', t: 1, target: { name: 'Huun' }, source: { combatTier: 'routine' },
      applied: 70, maxHp: 70 },
    { kind: 'WAVE_CLEAR', t: 3, delta: 20 },
    { kind: 'SESSION_END', t: 4, completedOrdinaryWaves: 20, missingCombatEvents: 0,
      ambiguousWaveTransitions: 0, deadlockCount: 0, defeatRecoveries: 0 },
  ].map(row => ({ ...row, scenario: 'growth-burst', session: 1 }));
  const run = projectPartyScenario(synthetic, 'growth-burst', 0, 0.1,
    { regenFractionMaxHpPerSecond: 0.004, healGearMaxHpGrowth: true }).runs[0];
  assert.equal(run.status, 'FAIL');
  assert.equal(run.firstModelKo.hero, 'Huun');
});

test('five repeated copies of one seed cannot certify endurance', () => {
  const one = [
    { kind: 'SESSION_START', t: 0, heroes: [{ name: 'Huun', hp: 60, maxHp: 60 }] },
    { kind: 'WAVE_CLEAR', t: 1, delta: 20 },
    { kind: 'SESSION_END', t: 2, completedOrdinaryWaves: 20, missingCombatEvents: 0,
      ambiguousWaveTransitions: 0, deadlockCount: 0, defeatRecoveries: 0 },
  ];
  const copies = Array.from({ length: 5 }, (_, index) => one.map(row =>
    ({ ...row, scenario: 'duplicate', session: index, seed: 7 }))).flat();
  assert.equal(projectPartyScenario(copies, 'duplicate', 0, 0.9).status, 'UNKNOWN');
  assert.equal(projectPartyScenario(copies.map(row => ({ ...row, seed: 7 + row.session })),
    'duplicate', 0, 0.9).status, 'PASS');
});

test('zero-delay refund arrives before a second same-time hit', () => {
  const synthetic = [
    { kind: 'SESSION_START', t: 0, seed: 1, heroes: [{ name: 'Huun', hp: 10, maxHp: 10 }] },
    { kind: 'HIT', t: 1, target: { name: 'Huun' }, applied: 5 },
    { kind: 'HIT', t: 1, target: { name: 'Huun' }, applied: 5 },
    { kind: 'WAVE_CLEAR', t: 2, delta: 20 },
    { kind: 'SESSION_END', t: 3, completedOrdinaryWaves: 20, missingCombatEvents: 0,
      ambiguousWaveTransitions: 0, deadlockCount: 0, defeatRecoveries: 0 },
  ].map(row => ({ ...row, scenario: 'instant-refund', session: 1 }));
  const run = projectPartyScenario(synthetic, 'instant-refund', 0, 0.1,
    { damageRefundFraction: 1, damageRefundDelaySeconds: 0 }).runs[0];
  assert.equal(run.status, 'PASS');
  assert.equal(run.minHpPct, 50);
});

test('passive regeneration banks fractions and restores only whole HP', () => {
  const synthetic = [
    { kind: 'SESSION_START', t: 0, seed: 1, heroes: [{ name: 'Huun', hp: 10, maxHp: 10 }] },
    { kind: 'HIT', t: 0, target: { name: 'Huun' }, applied: 1 },
    { kind: 'HIT', t: 1, target: { name: 'Huun' }, applied: 1 },
    { kind: 'WAVE_CLEAR', t: 2, delta: 20 },
    { kind: 'SESSION_END', t: 3, completedOrdinaryWaves: 20, missingCombatEvents: 0,
      ambiguousWaveTransitions: 0, deadlockCount: 0, defeatRecoveries: 0 },
  ].map(row => ({ ...row, scenario: 'whole-regen', session: 1 }));
  const run = projectPartyScenario(synthetic, 'whole-regen', 0.6, 0.85).runs[0];
  assert.equal(run.status, 'FAIL');
  assert.equal(run.minHpPct, 80);

  const banked = [
    { kind: 'SESSION_START', t: 0, seed: 2, heroes: [{ name: 'Huun', hp: 2, maxHp: 2 }] },
    { kind: 'HIT', t: 0, target: { name: 'Huun' }, applied: 1 },
    { kind: 'HERO_STATE', t: 1, hero: { name: 'Huun', maxHp: 2 } },
    { kind: 'HIT', t: 2, target: { name: 'Huun' }, applied: 1 },
    { kind: 'WAVE_CLEAR', t: 3, delta: 20 },
    { kind: 'SESSION_END', t: 4, completedOrdinaryWaves: 20, missingCombatEvents: 0,
      ambiguousWaveTransitions: 0, deadlockCount: 0, defeatRecoveries: 0 },
  ].map(row => ({ ...row, scenario: 'banked-regen', session: 1 }));
  const withCredit = projectPartyScenario(banked, 'banked-regen', 0.6, 0.5).runs[0];
  assert.equal(withCredit.status, 'PASS');
  assert.equal(withCredit.minHpPct, 50);
});

test('a full wave heal discards fractional refund credit', () => {
  const synthetic = [
    { kind: 'SESSION_START', t: 0, seed: 3, heroes: [{ name: 'Huun', hp: 20, maxHp: 20 }] },
    { kind: 'HIT', t: 0, target: { name: 'Huun' }, applied: 1 },
    { kind: 'HIT', t: 0.1, target: { name: 'Huun' }, applied: 1 },
    { kind: 'WAVE_CLEAR', t: 1, delta: 1 },
    { kind: 'HIT', t: 2, target: { name: 'Huun' }, applied: 1 },
    { kind: 'HIT', t: 2.1, target: { name: 'Huun' }, applied: 1 },
    { kind: 'HIT', t: 2.2, target: { name: 'Huun' }, applied: 1 },
    { kind: 'WAVE_CLEAR', t: 3, delta: 19 },
    { kind: 'SESSION_END', t: 4, completedOrdinaryWaves: 20, missingCombatEvents: 0,
      ambiguousWaveTransitions: 0, deadlockCount: 0, defeatRecoveries: 0 },
  ].map(row => ({ ...row, scenario: 'refund-cap', session: 1 }));
  const run = projectPartyScenario(synthetic, 'refund-cap', 0, 0.9,
    { damageRefundFraction: 0.45, damageRefundDelaySeconds: 0 }).runs[0];
  assert.equal(run.status, 'FAIL');
  assert.equal(run.minHpPct, 85);
});

test('gear HP growth needs an explicit fill rule; earned level growth heals by its delta', () => {
  const makeRows = level => [
    { kind: 'SESSION_START', t: 0, seed: 1, heroes: [{ name: 'Huun', hp: 60, maxHp: 60, level: 1 }] },
    { kind: 'HERO_STATE', t: 1, hero: { name: 'Huun', hp: 60, maxHp: 70, level } },
    { kind: 'HIT', t: 2, target: { name: 'Huun' }, applied: 1, maxHp: 70, wave: 1 },
    { kind: 'WAVE_CLEAR', t: 3, delta: 20 },
    { kind: 'SESSION_END', t: 4, completedOrdinaryWaves: 20, missingCombatEvents: 0,
      ambiguousWaveTransitions: 0, deadlockCount: 0, defeatRecoveries: 0 },
  ].map(row => ({ ...row, scenario: 'growth', session: 1 }));
  const gear = makeRows(1);
  assert.equal(projectPartyScenario(gear, 'growth', 0, 0.9).runs[0].status, 'FAIL');
  assert.equal(projectPartyScenario(gear, 'growth', 0, 0.9,
    { healGearMaxHpGrowth: true }).runs[0].status, 'PASS');
  assert.equal(projectPartyScenario(makeRows(2), 'growth', 0, 0.9).runs[0].status, 'PASS');
});

test('boss survival leaves the recorded DPS timeout intact; synthetic burst can KO', () => {
  const recovery = { encounter: 'boss', damageRefundFraction: 0.3, damageRefundDelaySeconds: 2 };
  const ordinaryPressure = projectPartyScenario(rows, 'boss-sweep-l1', 0.11, 0.01, recovery);
  assert.equal(ordinaryPressure.status, 'PASS');
  assert.ok(ordinaryPressure.runs.every(run => run.bossHpAtTimeout > 0 && run.firstModelKo === null));
  const burst = projectPartyScenario(rows, 'boss-sweep-l1', 0.11, 0.01,
    { ...recovery, incomingPressureMultiplier: 4 });
  assert.equal(burst.status, 'FAIL');
  assert.ok(burst.runs.every(run => run.firstModelKo !== null));
});

test('regen-only farming candidate keeps boss DPS timeout and burst vulnerability', () => {
  const recovery = { encounter: 'boss', regenFractionMaxHpPerSecond: 0.004 };
  const normal = projectPartyScenario(rows, 'boss-sweep-l1', 0, 0.01, recovery);
  assert.equal(normal.status, 'PASS');
  assert.ok(normal.runs.every(run => run.bossHpAtTimeout > 0 && run.firstModelKo === null));
  const burst = projectPartyScenario(rows, 'boss-sweep-l1', 0, 0.01,
    { ...recovery, incomingPressureMultiplier: 4 });
  assert.ok(burst.runs.every(run => run.firstModelKo !== null));
});

test('stronger farming sustain still cannot beat boss timer or fourfold burst', () => {
  for (const recovery of [
    { encounter: 'boss', regenFractionMaxHpPerSecond: 0.015 },
    { encounter: 'boss', regenFractionMaxHpPerSecond: 0.01,
      damageRefundFraction: 0.3, damageRefundDelaySeconds: 2 },
  ]) {
    const normal = projectPartyScenario(rows, 'boss-sweep-l1', 0, 0.01, recovery);
    assert.equal(normal.status, 'PASS');
    assert.ok(normal.runs.every(run => run.bossHpAtTimeout > 0));
    const burst = projectPartyScenario(rows, 'boss-sweep-l1', 0, 0.01,
      { ...recovery, incomingPressureMultiplier: 4 });
    assert.ok(burst.runs.every(run => run.firstModelKo !== null));
  }
});

test('parallel conductors save one compact result for the same formula', async () => {
  const runner = path.resolve('tools/combat_lab/party_sustain.mjs');
  const args = [runner, 'starter-l1-nokaja,kaja-l1-four', '0', '0.9',
    '--regen-fraction', '0.004', '--heal-gear-growth', '--save', '--out', temp];
  const invoke = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: process.cwd() });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('close', code => code === 0 ? resolve(JSON.parse(output)) : reject(new Error(output)));
  });
  const results = await Promise.all([invoke(), invoke()]);
  assert.deepEqual(results.map(item => item.action).sort(), ['CREATED', 'SKIPPED']);
  const trackerFile = path.join(temp, 'party-tracker.json');
  const tracker = JSON.parse(fs.readFileSync(trackerFile, 'utf8'));
  assert.equal(tracker.cases.length, 1);
  assert.equal(tracker.cases[0].status, 'PASS');
  assert.ok(fs.statSync(trackerFile).size < 2000);
});
