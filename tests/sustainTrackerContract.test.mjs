import baseTest, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Quarantined where the untracked knowledge-lab model is absent (clean checkouts, worktrees).
const model = 'output/orka-7l9-knowledge-lab/sample/sustain-model.mjs';
const missing = !fs.existsSync(model) && `missing untracked fixture ${model}`;
const test = (name, fn) => baseTest(name, { skip: missing }, fn);
const { runSustainTracker, loadSustainCases } = missing ? {} : await import('../tools/combat_lab/sustain_tracker.mjs');
const { gradeSustainCase } = missing ? {} : await import(`../${model}`);

const tmp = fs.mkdtempSync('/private/tmp/orka-7l9-sustain-contract-');
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const runner = path.resolve('tools/combat_lab/sustain_tracker.mjs');

test('declared sustain cases stay fixed and uniquely assignable', () => {
  const cases = loadSustainCases().spec.cases;
  const ids = cases.map(item => item.id);
  assert.equal(ids.length, 26);
  assert.deepEqual(ids.slice(0, 7), ['S0-baseline', 'S1-high-defense', 'S2-high-evasion', 'S3-hp-drain',
    'S4-high-regen', 'S5-mixed-sustain', 'S6-pressure-break']);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids.slice(19, 26), ['S19-def-regen-low', 'S20-def-regen-floor', 'S21-def-regen-95',
    'S22-def-regen-huun', 'S23-def-regen-fara-wave2', 'S24-def-regen-boss', 'S25-def-regen-boss-pressure']);
  for (const item of cases) {
    assert.equal(item.expectation.maxHeroKOs, 0, `${item.id} must fail on first farming KO`);
    assert.equal(item.expectation.minHeroKOs, undefined);
  }
});

test('any farming Hero KO fails before incomplete-trace or permissive checks', () => {
  const base = { combatContext: 'farming', traceComplete: false, invalidReasons: ['later data missing'],
    heroKoCount: 1, observedOtherHeroKoCount: 0, minHpFraction: 1 };
  assert.equal(gradeSustainCase(base, { minHeroKOs: 1 }).status, 'FAIL');
  assert.equal(gradeSustainCase({ ...base, heroKoCount: 0, observedOtherHeroKoCount: 1 }, {}).status, 'FAIL');
});

test('one-case work creates a graded immutable report and repeated work is skipped', () => {
  const outDir = path.join(tmp, 'one-case');
  const first = runSustainTracker({ caseId: 'S0-baseline', outDir });
  assert.equal(first.lines[0].action, 'CREATED');
  assert.equal(first.index.cases[0].status, 'FAIL');
  assert.equal(first.index.cases[1].status, 'UNKNOWN');
  const report = JSON.parse(fs.readFileSync(path.join(outDir, first.index.cases[0].report), 'utf8'));
  assert.equal(report.status, 'FAIL');
  assert.equal(report.heroKOs, 1);
  assert.equal(report.minHpPct, 0);
  assert.equal(report.digest.length, 64);
  assert.deepEqual(Object.keys(report), ['version', 'caseId', 'digest', 'status', 'minHpPct', 'heroKOs', 'reason']);
  assert.ok(fs.statSync(path.join(outDir, first.index.cases[0].report)).size < 512);
  assert.ok(fs.statSync(path.join(outDir, 'latest.json')).size < 256 * first.index.cases.length + 512);
  const second = runSustainTracker({ caseId: 'S0-baseline', outDir });
  assert.equal(second.lines[0].action, 'SKIPPED');
  assert.equal(second.index.cases[0].report, first.index.cases[0].report);
});

test('separate case conductors share index without duplicate report names', async () => {
  const outDir = path.join(tmp, 'parallel');
  const invoke = id => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runner, '--case', id, '--out', outDir], { cwd: process.cwd() });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('close', code => code === 0 ? resolve(output) : reject(new Error(`${id}: ${output}`)));
  });
  await Promise.all([invoke('S4-high-regen'), invoke('S4-high-regen'), invoke('S6-pressure-break')]);
  const latest = JSON.parse(fs.readFileSync(path.join(outDir, 'latest.json'), 'utf8'));
  assert.equal(latest.cases.find(item => item.id === 'S4-high-regen').status, 'PASS');
  const pressure = latest.cases.find(item => item.id === 'S6-pressure-break');
  assert.equal(pressure.status, 'FAIL');
  assert.equal(pressure.heroKOs, 1);
  assert.equal(fs.readdirSync(outDir).filter(name => name.startsWith('S4-high-regen.')).length, 1);
});
