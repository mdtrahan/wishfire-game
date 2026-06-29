#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const read = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');
const exists = (relativePath) => existsSync(resolve(repoRoot, relativePath));
const readNormalizedSource = (relativePath) => read(relativePath)
  .replace(/\\n/g, '\n')
  .replace(/\\t/g, '\t');

const checks = [];
const testRuns = [];
let multipassRows = [];

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

function runManualTargetMultipass() {
  const appSource = read('web-runner/app.js');
  const bankSource = read('web-runner/modules/functionBank.js');
  const renderSource = read('web-runner/systems/renderRuntime.js');
  const manualClickSetsOwner = /const hit = getEnemyHit\(mx, my\);\s*if \(hit\) \{\s*state\.globals\.SelectedEnemyUID = hit\.uid;\s*state\.globals\.SelectedEnemyUIDOwner = Number\(state\.globals\.PendingActor \|\| 0\);/s.test(appSource);
  const selectorUsesOwnedSelectedFirst =
    /const resolvedSelectedUid = ownerMatchedSelectedUid \|\| pendingHitTargetUID;/.test(renderSource);
  const selectorUsesQueuedFirst =
    !selectorUsesOwnedSelectedFirst &&
    /const resolvedSelectedUid = pendingHitTargetUID \|\| selectedUid;/.test(renderSource);

  const transformedBank = `${bankSource
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\n/gm, '')
    .replace(/\bexport\s+/g, '')}

module.exports = { ExecuteSkill };`;

  const context = {
    console: { log() {}, warn() {}, error() {} },
    Math,
    Number,
    String,
    Array,
    Object,
    module: { exports: {} },
    exports: {},
    state: { globals: {}, entities: [] },
  };
  vm.createContext(context);
  new vm.Script(transformedBank, { filename: 'web-runner/modules/functionBank.js' }).runInContext(context);
  const { ExecuteSkill } = context.module.exports;

  function makeContext({ selectedUID, selectedOwnerUID = null, randomRoll }) {
    const hero = {
      uid: 100,
      kind: 'hero',
      name: 'Falie',
      baseHeroName: 'Falie',
      heroIndex: 0,
      attackType: 'melee',
      hp: 100,
      maxHP: 100,
      stats: { ATK: 10, DEF: 0, MAG: 3, RES: 0, SPD: 1 },
    };
    const enemies = [201, 202, 203].map((uid, slotIndex) => ({
      uid,
      kind: 'enemy',
      name: `Target ${slotIndex + 1}`,
      slotIndex,
      hp: 80,
      maxHP: 80,
      stats: { ATK: 4, DEF: 0, MAG: 2, RES: 0, SPD: 1 },
    }));
    const ownerUID = selectedOwnerUID == null
      ? (manualClickSetsOwner && selectedUID ? hero.uid : 0)
      : Number(selectedOwnerUID || 0);
    return {
      state: {
        globals: {
          time: 1,
          RuntimeRandom: () => randomRoll,
          CombatLog: [],
          CombatActionLines: ['', '', '', ''],
          CurrentTurnIndex: 0,
          TurnOrderArray: [{ uid: hero.uid, type: 0, spd: 1 }, ...enemies.map(enemy => ({ uid: enemy.uid, type: 1, spd: 1 }))],
          PendingActor: hero.uid,
          PendingSkillID: 'HERO_SINGLE',
          SelectedEnemyUID: selectedUID,
          SelectedEnemyUIDOwner: ownerUID,
          SkillDraughtTrace: [],
          SkillDraughtTraceSeq: 0,
          SessionSkillsByHeroUID: {},
          PowerAmpByUID: {},
        },
        entities: [hero, ...enemies],
      },
      callFunction() {
        return undefined;
      },
    };
  }

  function resolveVisualSelectorUID({ selectedUID, selectedOwnerUID = null, staleQueuedTargetUID }) {
    const ownerUID = selectedOwnerUID == null
      ? (manualClickSetsOwner && selectedUID ? 100 : 0)
      : Number(selectedOwnerUID || 0);
    const ownerMatchedSelectedUID = ownerUID === 100 ? selectedUID : 0;
    if (selectorUsesOwnedSelectedFirst) return ownerMatchedSelectedUID || staleQueuedTargetUID;
    if (selectorUsesQueuedFirst) return staleQueuedTargetUID || selectedUID;
    return 0;
  }

  const passes = [
    { label: 'top selected, stale queued middle', selectedUID: 201, staleQueuedTargetUID: 202, randomRoll: 0.0 },
    { label: 'middle selected, stale queued top', selectedUID: 202, staleQueuedTargetUID: 201, randomRoll: 0.0 },
    { label: 'bottom selected, stale queued top', selectedUID: 203, staleQueuedTargetUID: 201, randomRoll: 0.0 },
    { label: 'top selected, stale queued bottom', selectedUID: 201, staleQueuedTargetUID: 203, randomRoll: 0.99 },
    { label: 'middle selected, stale queued bottom', selectedUID: 202, staleQueuedTargetUID: 203, randomRoll: 0.99 },
    { label: 'middle selected by stale owner, random top', selectedUID: 202, selectedOwnerUID: 999, staleQueuedTargetUID: 0, randomRoll: 0.0, expectedVisualSelectorUID: 0, expectedQueuedAttackTargetUID: 201 },
    { label: 'no selected target, queued fallback kept', selectedUID: 0, staleQueuedTargetUID: 203, randomRoll: 0.0, expectedVisualSelectorUID: 203 },
  ];

  multipassRows = passes.map((pass, index) => {
    const ctx = makeContext(pass);
    ExecuteSkill(ctx, 'HERO_SINGLE', 100);
    const firstHit = Array.isArray(ctx.state.globals.PendingHeroHits)
      ? ctx.state.globals.PendingHeroHits.find(hit => hit && Number(hit.targetUID || 0) > 0)
      : null;
    const queuedAttackTargetUID = Number(firstHit?.targetUID || 0);
    const visualSelectorUID = resolveVisualSelectorUID(pass);
    const expectedVisualSelectorUID = pass.expectedVisualSelectorUID ?? pass.selectedUID;
    const expectedQueuedAttackTargetUID = pass.expectedQueuedAttackTargetUID ?? pass.selectedUID;
    return {
      pass: index + 1,
      label: pass.label,
      actorUID: 100,
      selectedUID: pass.selectedUID,
      selectedOwnerUID: Number(ctx.state.globals.SelectedEnemyUIDOwner || 0),
      staleQueuedTargetUID: pass.staleQueuedTargetUID,
      visualSelectorUID,
      randomRoll: pass.randomRoll,
      queuedAttackTargetUID,
      visualDrift: visualSelectorUID !== expectedVisualSelectorUID,
      queuedDrift: expectedQueuedAttackTargetUID ? queuedAttackTargetUID !== expectedQueuedAttackTargetUID : false,
    };
  });

  const driftRows = multipassRows.filter(row => row.visualDrift || row.queuedDrift);
  recordCheck(
    'multipass actor/selected/queued/render target rows stay aligned',
    driftRows.length === 0,
    'way off',
    `${driftRows.length} drift rows found while comparing selectedUID, visualSelectorUID, and queuedAttackTargetUID.`,
  );
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
    /const pendingManualTarget = String\(g\.PendingSkillID \|\| ''\) === 'HERO_SINGLE'\s*&& Number\(g\.PendingActor \|\| 0\) === Number\(actorUID \|\| 0\)\s*&& Number\(g\.SelectedEnemyUIDOwner \|\| 0\) === Number\(actorUID \|\| 0\);/,
    `${bankPath} scopes SelectedEnemyUID to the actor-owned pending manual HERO_SINGLE handoff`,
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
  'web-runner/app.js',
  /state\.globals\.SelectedEnemyUIDOwner = Number\(state\.globals\.PendingActor \|\| 0\);/,
  'manual enemy clicks stamp selected target owner with PendingActor',
);

hasRegex(
  'web-runner/systems/renderRuntime.js',
  /const pendingHitTargetUID = Array\.isArray\(state\.globals\.PendingHeroHits\)\s*\? Number\(\(state\.globals\.PendingHeroHits\.find\(hit => hit && Number\(hit\.targetUID \|\| 0\) > 0\) \|\| \{\}\)\.targetUID \|\| 0\)\s*: 0;/,
  'renderer keeps queued PendingHeroHits target available as fallback',
);
hasRegex(
  'web-runner/systems/renderRuntime.js',
  /const ownerMatchedSelectedUid = selectedOwnerUID === pendingActorUID \? selectedUid : 0;\n\s*const resolvedSelectedUid = ownerMatchedSelectedUid \|\| pendingHitTargetUID;/,
  'renderer uses SelectedEnemyUID only when it is owned by the pending actor',
);
hasRegex(
  'web-runner/systems/renderRuntime.js',
  /resolvedSelectedUid \? aliveEnemies\.filter\(e => Number\(e\.uid \|\| 0\) === resolvedSelectedUid\) : aliveEnemies\.slice\(0, 1\)/,
  'renderer compares target UIDs numerically when drawing the selector',
);
runManualTargetMultipass();

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
console.log('\nMultipass actor/target rows');
for (const row of multipassRows) {
  console.log(JSON.stringify(row));
}

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
