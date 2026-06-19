#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const read = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');
const exists = (relativePath) => existsSync(resolve(repoRoot, relativePath));
const readNormalizedSource = (relativePath) => read(relativePath)
  .replace(/\\n/g, '\n')
  .replace(/\\t/g, '\t');

const checks = [];
const testRuns = [];

function recordCheck(name, ok, severity, detail = '') {
  checks.push({ name, ok: !!ok, severity, detail });
}

function hasRegex(relativePath, pattern, name, severity = 'way off') {
  const source = readNormalizedSource(relativePath);
  recordCheck(name, pattern.test(source), severity, `${relativePath} must match ${pattern}`);
}

function lacksRegex(relativePath, pattern, name, severity = 'way off') {
  const source = readNormalizedSource(relativePath);
  recordCheck(name, !pattern.test(source), severity, `${relativePath} must not match ${pattern}`);
}

function runNodeTest(relativePath) {
  const result = spawnSync(process.execPath, ['--test', relativePath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  testRuns.push({
    name: relativePath,
    ok: result.status === 0,
    status: result.status,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
  });
}

const requiredTests = [
  'tests/heroTargetRandomizationContract.test.js',
  'tests/idleAutoplaySelectionBypassContract.test.js',
  'tests/enemySelectorTargetSyncContract.test.js',
  'tests/pendingSuperGemHandoffContract.test.js',
  'tests/superGemAppContract.test.js',
];

for (const testPath of requiredTests) {
  recordCheck(`${testPath} exists`, exists(testPath), 'slightly off', 'Required focused coverage is missing.');
}

for (const bankPath of ['web-runner/modules/functionBank.js', 'Scripts/functionBank.js']) {
  hasRegex(
    bankPath,
    /const pendingManualTarget = String\(g\.PendingSkillID \|\| ''\) === 'HERO_SINGLE'\s*&& Number\(g\.PendingActor \|\| 0\) === Number\(actorUID \|\| 0\);/,
    `${bankPath} scopes SelectedEnemyUID to the actor's pending manual HERO_SINGLE handoff`,
  );
  hasRegex(
    bankPath,
    /const target = preferred && preferred\.kind === 'enemy' && \(preferred\.hp \?\? 0\) > 0\s*\? preferred\s*: randomPick\(ctx, enemies\);/,
    `${bankPath} uses fresh runtime RNG when no live pending manual target owns selection`,
  );
  lacksRegex(
    bankPath,
    /const target = preferred && preferred\.kind === 'enemy' \? preferred : enemies\[0\];/,
    `${bankPath} rejects stale selected enemy plus first-enemy fallback`,
  );
}

hasRegex(
  'web-runner/app.js',
  /const roll = typeof state\.globals\.RuntimeRandom === 'function'\s*\? Number\(state\.globals\.RuntimeRandom\(\)\)\s*: 0;/,
  'dev autoplay pending selection consumes RuntimeRandom',
);
hasRegex(
  'web-runner/app.js',
  /const targetIndex = Math\.max\(0, Math\.min\(livingEnemies\.length - 1, Math\.floor\(safeRoll \* livingEnemies\.length\)\)\);/,
  'dev autoplay maps RNG roll across all living enemies',
);
hasRegex(
  'web-runner/app.js',
  /const targetUID = Number\(livingEnemies\[targetIndex\]\.uid \|\| 0\);\s*state\.globals\.SelectedEnemyUID = targetUID;/,
  'dev autoplay writes the randomized target UID for pending handoff',
);
lacksRegex(
  'web-runner/app.js',
  /state\.globals\.SelectedEnemyUID = Number\(livingEnemies\[0\]\.uid \|\| 0\);/,
  'dev autoplay rejects first-living-enemy sticky targeting',
);

hasRegex(
  'web-runner/systems/renderRuntime.js',
  /const pendingHitTargetUID = Array\.isArray\(state\.globals\.PendingHeroHits\)\s*\? Number\(\(state\.globals\.PendingHeroHits\.find\(hit => hit && Number\(hit\.targetUID \|\| 0\) > 0\) \|\| \{\}\)\.targetUID \|\| 0\)\s*: 0;/,
  'renderer derives selector target from queued PendingHeroHits first',
);
hasRegex(
  'web-runner/systems/renderRuntime.js',
  /const resolvedSelectedUid = pendingHitTargetUID \|\| selectedUid;/,
  'renderer falls back to SelectedEnemyUID only after queued hit target',
);
hasRegex(
  'web-runner/systems/renderRuntime.js',
  /resolvedSelectedUid \? aliveEnemies\.filter\(e => Number\(e\.uid \|\| 0\) === resolvedSelectedUid\) : aliveEnemies\.slice\(0, 1\)/,
  'renderer compares target UIDs numerically when drawing the selector',
);
lacksRegex(
  'web-runner/systems/renderRuntime.js',
  /selectedUid \? aliveEnemies\.filter\(e => e\.uid === selectedUid\) : aliveEnemies\.slice\(0, 1\)/,
  'renderer rejects stale SelectedEnemyUID-only selector routing',
);

const packageJson = JSON.parse(read('package.json'));
recordCheck(
  'package.json exposes npm run eval:target-selector-sync',
  packageJson.scripts?.['eval:target-selector-sync'] === 'node tools/eval_target_selector_sync.mjs',
  'slightly off',
  'The eval should be easy to run without remembering the tool path.',
);

for (const testPath of requiredTests.filter(exists)) {
  runNodeTest(testPath);
}

const failedStatic = checks.filter((check) => !check.ok);
const failedTests = testRuns.filter((run) => !run.ok);
const wayOff = failedStatic.filter((check) => check.severity === 'way off');
const slight = failedStatic.filter((check) => check.severity !== 'way off');

console.log('Hero target/selector sync eval');
console.log(`Static checks: ${checks.length - failedStatic.length}/${checks.length} passed`);
console.log(`Focused tests: ${testRuns.length - failedTests.length}/${testRuns.length} passed`);

if (wayOff.length) {
  console.log('\nWAY OFF failures');
  for (const failure of wayOff) {
    console.log(`- ${failure.name}`);
    console.log(`  ${failure.detail}`);
  }
}

if (slight.length) {
  console.log('\nSLIGHTLY OFF failures');
  for (const failure of slight) {
    console.log(`- ${failure.name}`);
    console.log(`  ${failure.detail}`);
  }
}

if (failedTests.length) {
  console.log('\nFocused test failures');
  for (const failure of failedTests) {
    console.log(`- ${failure.name} exited ${failure.status}`);
    const output = [failure.stderr, failure.stdout].filter(Boolean).join('\n').split('\n').slice(-12).join('\n');
    if (output) console.log(output);
  }
}

if (failedStatic.length || failedTests.length) {
  process.exitCode = 1;
} else {
  console.log('\nPASS: target choice, queued hit target, and rendered selector are covered together.');
}
