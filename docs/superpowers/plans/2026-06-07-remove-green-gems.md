# Remove Green Gems Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete `ORKA-zy2o` by removing regular green gems and green super gems from active gameplay without breaking existing red, blue, yellow, heal, purple, combat, and supergem flows.

**Architecture:** Treat color `0` as a retired legacy color, not as an active gameplay color. Remove it first from generation and supergem formation, then from action routing and active counters, while keeping compatibility paths harmless for old state that may still contain color `0`. Use checkpoint commits after each surface so rollback can stop at the last verified boundary.

**Tech Stack:** JavaScript ES modules and CommonJS, Node `node --test`, Beads, Git worktrees, Codex in-app Browser for local QA.

---

## Bead And Risk Model

Bead: `ORKA-zy2o`

First-principles breakdown:
- A green gem is active only if the board can create or force color `0`.
- A green match is active only if color `0` maps to `HERO_AOE` or another action route.
- A green supergem is active only if 2x2 color `0` squares are detected, rendered, tappable, and accepted by `activateSuperGemEffect`.
- Green tracking is active only if new color `0` matches increment counters or appear in HUD/milestone displays.
- Legacy color `0` state must be safe to ignore or sanitize because old test fixtures, dev tools, saved state, or stale boards may still contain it.

Hard boundaries:
- Do not remove or weaken light-green heal gems, color `4`.
- Do not refactor `web-runner/app.js` beyond the minimum routing/generation changes.
- Do not delete green image assets in the first behavior pass; stop loading/using them first. Asset deletion is a final optional cleanup only after browser QA passes.
- Do not merge without a rollback tag and focused validation on the target branch.

Known conflict:
- `governance/product/player-living-guide.md` currently says green gems trigger AOE and Kojonn can turn green into Faze. This bead should update that guide after runtime behavior is changed, because the user explicitly requested removal.
- `ORKA-zy2o` blocks `ORKA-8hqv`, the existing Kojonn green-supergem redesign bead.

## Current Surface Map

Primary runtime files:
- `web-runner/app.js`: dev color options, board color spawning via `randomGemFrame()`, forced deterministic dev board, tap/spend wiring.
- `web-runner/src/core/superGemRules.mjs`: valid supergem colors and `baseColor` detection.
- `web-runner/src/core/superGemBoardState.mjs`: supergem cell maps, color-clear, spend flow, stale supergem safety.
- `web-runner/systems/superGemRuntime.js`: color-specific supergem activation, pending green/red attack handling.
- `web-runner/src/core/gemActionRules.mjs` and `src/core/gemActionRules.mjs`: gem color to route decisions.
- `web-runner/modules/functionBank.js` and `Scripts/functionBank.js`: fallback gem action routing and hero gem usage tracking mirrors.
- `web-runner/src/core/idleAutoplayPriority.mjs`: dev idle autoplay color priority, including Kojonn green preference.
- `web-runner/systems/gemVisuals.js`: green gem and super-green asset loading.
- `web-runner/systems/renderHUD.js`, `web-runner/modules/state.js`, `Scripts/state.js`: active usage counter defaults and HUD rows.

Primary tests to update or add:
- `tests/superGemRulesContract.test.js`
- `tests/kojonnSuperGemBlightContract.test.js`
- `tests/idleAutoplayPriorityGemContract.test.js`
- `tests/heroGemUsageCounterContract.test.js`
- `tests/gemActionFixtureContract.test.js`
- `tests/fixtures/gem_action_cases.csv`
- `tests/kojonnRoleCorrectionContract.test.js`
- `tests/kojonnAmpAoeContract.test.js`
- `tests/lungeMotionContract.test.js`
- New contract: `tests/greenGemRemovalContract.test.js`

## Rollback Strategy

- Create the implementation in `.worktrees/wt-ORKA-zy2o-remove-green-gems` on `bead/ORKA-zy2o-remove-green-gems`.
- Before marking the bead `in_progress`, tag current `main`:

```bash
git tag "rollback/ORKA-zy2o-before-green-removal-$(date +%Y%m%d-%H%M%S)" main
```

- Commit after each checkpoint with `bd-ORKA-zy2o` in the message.
- After every checkpoint commit, run the focused tests for the changed surface before moving on.
- If a checkpoint fails for a reason not present in the baseline, stop and revert only the latest checkpoint commit on the bead branch:

```bash
git revert --no-edit HEAD
```

- Before merging, tag `main` again:

```bash
git tag "rollback/ORKA-zy2o-before-merge-$(date +%Y%m%d-%H%M%S)" main
```

- Never stage `game-design-research/` or unrelated worktree dirt.

## Task 1: Start The Isolated Lane And Capture Baseline

**Files:**
- No code files changed.
- Beads state only after `bd update`.

- [ ] **Step 1: Confirm the active repo and Beads state**

Run:

```bash
pwd
git status --short --branch
bd ready
bd list
bd show ORKA-zy2o
git worktree list --porcelain
```

Expected:
- `pwd` is `/Users/Mace/Codex-Orka`.
- `ORKA-zy2o` is open.
- Fewer than five active bead worktrees exist.
- Any unrelated dirt is listed and left untouched.

- [ ] **Step 2: Create the bead worktree**

Run:

```bash
git worktree add .worktrees/wt-ORKA-zy2o-remove-green-gems -b bead/ORKA-zy2o-remove-green-gems
cd .worktrees/wt-ORKA-zy2o-remove-green-gems
git status --short --branch
bd show ORKA-zy2o
```

Expected:
- Branch is `bead/ORKA-zy2o-remove-green-gems`.
- Worktree status is clean.

- [ ] **Step 3: Mark the bead in progress**

Run:

```bash
bd update ORKA-zy2o --status in_progress
bd comments add ORKA-zy2o "Implementation lane opened: bead/ORKA-zy2o-remove-green-gems in .worktrees/wt-ORKA-zy2o-remove-green-gems."
```

Expected:
- `bd show ORKA-zy2o` reports `in_progress`.

- [ ] **Step 4: Create the initial rollback tag**

Run:

```bash
git tag "rollback/ORKA-zy2o-before-green-removal-$(date +%Y%m%d-%H%M%S)" main
```

Expected:
- `git tag --list 'rollback/ORKA-zy2o-before-green-removal-*'` shows the tag.

- [ ] **Step 5: Capture baseline focused tests**

Run:

```bash
node --test \
  tests/superGemRulesContract.test.js \
  tests/kojonnSuperGemBlightContract.test.js \
  tests/idleAutoplayPriorityGemContract.test.js \
  tests/heroGemUsageCounterContract.test.js \
  tests/gemActionFixtureContract.test.js \
  tests/gemActionOwnershipContract.test.js \
  tests/kojonnRoleCorrectionContract.test.js \
  tests/kojonnAmpAoeContract.test.js \
  tests/lungeMotionContract.test.js \
  tests/devToolingBoardOverrideContract.test.js \
  tests/superGemAppContract.test.js \
  tests/pendingSuperGemHandoffContract.test.js \
  tests/superGemInteractionPacingContract.test.js
```

Expected:
- Record pass/fail counts in `bd comments add ORKA-zy2o`.
- If this baseline is red, later validation must not add new failures.

## Task 2: Add Failing Removal Contracts

**Files:**
- Create: `tests/greenGemRemovalContract.test.js`
- Modify: no runtime files.

- [ ] **Step 1: Add a contract for retired active green behavior**

Create `tests/greenGemRemovalContract.test.js`:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('runtime board spawning and dev forced board options do not create active green gems', () => {
  const src = read('web-runner/app.js');
  assert.doesNotMatch(src, /\{\s*value:\s*0,\s*label:\s*'GREEN'\s*\}/);
  assert.match(src, /const GEM_SPAWN_COLORS = Object\.freeze\(\[1, 2, 3, 4, 5\]\);/);
  assert.doesNotMatch(src, /const weights = \[1, 1, 1, 1, 1, PURPLE_WEIGHT\];/);
});

test('green color zero no longer forms or activates a super gem', () => {
  const rulesSrc = read('web-runner/src/core/superGemRules.mjs');
  const runtimeSrc = read('web-runner/systems/superGemRuntime.js');
  assert.doesNotMatch(rulesSrc, /SUPER_GEM_COLORS = new Set\(\[0, 1, 2, 3, 4, 5\]\)/);
  assert.match(rulesSrc, /SUPER_GEM_COLORS = new Set\(\[1, 2, 3, 4, 5\]\)/);
  assert.match(runtimeSrc, /if \(color === 0\) return false;/);
});

test('gem action routing treats green color zero as retired legacy input', () => {
  const srcCore = read('src/core/gemActionRules.mjs');
  const runnerCore = read('web-runner/src/core/gemActionRules.mjs');
  const runtimeBank = read('web-runner/modules/functionBank.js');
  const scriptsBank = read('Scripts/functionBank.js');
  for (const src of [srcCore, runnerCore, runtimeBank, scriptsBank]) {
    assert.doesNotMatch(src, /GEM_ACTION_GREEN_ATTACK/);
    assert.doesNotMatch(src, /HERO_AOE[^;\n]*GREEN/);
  }
});

test('active hero gem usage no longer increments or renders green counters', () => {
  const runtimeBank = read('web-runner/modules/functionBank.js');
  const scriptsBank = read('Scripts/functionBank.js');
  const hudSrc = read('web-runner/systems/renderHUD.js');
  for (const src of [runtimeBank, scriptsBank]) {
    assert.doesNotMatch(src, /if \(gemColor === 0\) return 'GREEN';/);
  }
  assert.doesNotMatch(hudSrc, /`GREEN:\$\{Number\(/);
});
```

- [ ] **Step 2: Run the new contract and confirm it fails**

Run:

```bash
node --test tests/greenGemRemovalContract.test.js
```

Expected:
- Fails on the current code because green is still active.

- [ ] **Step 3: Commit the failing contract**

Run:

```bash
git add tests/greenGemRemovalContract.test.js
git commit -m "test: define green gem removal contract bd-ORKA-zy2o"
```

Expected:
- One test-only checkpoint commit.

## Task 3: Remove Green From Board Generation And Dev Board Forcing

**Files:**
- Modify: `web-runner/app.js`
- Test: `tests/greenGemRemovalContract.test.js`

- [ ] **Step 1: Remove green from dev color options**

In `web-runner/app.js`, change `DEV_TOOL_GEM_OPTIONS` from:

```js
const DEV_TOOL_GEM_OPTIONS = Object.freeze([
  { value: DEV_TOOL_GEM_RANDOM, label: 'Random' },
  { value: 0, label: 'GREEN' },
  { value: 1, label: 'RED' },
  { value: 2, label: 'BLUE' },
  { value: 3, label: 'YELLOW' },
  { value: 4, label: 'HEAL' },
  { value: 5, label: 'PURPLE' },
]);
```

to:

```js
const DEV_TOOL_GEM_OPTIONS = Object.freeze([
  { value: DEV_TOOL_GEM_RANDOM, label: 'Random' },
  { value: 1, label: 'RED' },
  { value: 2, label: 'BLUE' },
  { value: 3, label: 'YELLOW' },
  { value: 4, label: 'HEAL' },
  { value: 5, label: 'PURPLE' },
]);
const GEM_SPAWN_COLORS = Object.freeze([1, 2, 3, 4, 5]);
```

- [ ] **Step 2: Change random board spawning so color zero cannot be picked**

In `randomGemFrame()`, replace the array-index weighted picker with a color-returning picker:

```js
  const pickByWeightedColors = (entries) => {
    let total = 0;
    for (const entry of entries) total += entry.weight;
    let r = getGemSpawnRandom() * total;
    for (const entry of entries) {
      r -= entry.weight;
      if (r <= 0) return entry.color;
    }
    return entries[0] ? entries[0].color : 1;
  };
  const spawnWeights = GEM_SPAWN_COLORS.map((color) => ({
    color,
    weight: color === 5 ? PURPLE_WEIGHT : 1,
  }));
  let frame = pickByWeightedColors(spawnWeights);
  if (frame === 5 && countPurple() >= MAX_PURPLE_ON_BOARD) {
    frame = pickByWeightedColors(
      GEM_SPAWN_COLORS
        .filter((color) => color !== 5)
        .map((color) => ({ color, weight: 1 })),
    );
  }
  return frame;
```

- [ ] **Step 3: Remove color zero from deterministic dev boards**

In `forceDeterministicBoard()`, replace the alternating green/red assignment:

```js
        let forcedColor = (gem.cellR + gem.cellC) % 2 === 0 ? 0 : 1;
```

with:

```js
        let forcedColor = (gem.cellR + gem.cellC) % 2 === 0 ? 1 : 2;
```

Keep the existing yellow row override intact.

- [ ] **Step 4: Run the board-generation contract**

Run:

```bash
node --test tests/greenGemRemovalContract.test.js tests/devToolingBoardOverrideContract.test.js
```

Expected:
- The board-generation assertions pass.
- Any remaining failure is limited to supergem/action/tracking assertions not changed yet.

- [ ] **Step 5: Commit checkpoint**

Run:

```bash
git add web-runner/app.js tests/greenGemRemovalContract.test.js
git commit -m "fix: retire green gem board generation bd-ORKA-zy2o"
```

## Task 4: Remove Green From Supergem Detection And Activation

**Files:**
- Modify: `web-runner/src/core/superGemRules.mjs`
- Modify: `web-runner/systems/superGemRuntime.js`
- Modify: `web-runner/systems/gemVisuals.js`
- Modify: `tests/superGemRulesContract.test.js`
- Modify: `tests/kojonnSuperGemBlightContract.test.js`
- Test: `tests/greenGemRemovalContract.test.js`

- [ ] **Step 1: Exclude color zero from supergem family colors**

In `web-runner/src/core/superGemRules.mjs`, change:

```js
const SUPER_GEM_COLORS = new Set([0, 1, 2, 3, 4, 5]);
```

to:

```js
const SUPER_GEM_COLORS = new Set([1, 2, 3, 4, 5]);
```

Also change rainbow fallback palette from:

```js
  const palette = [0, 1, 2, 3, 4, 5];
```

to:

```js
  const palette = [1, 2, 3, 4, 5];
```

- [ ] **Step 2: Make stale green supergems fail closed**

In `web-runner/systems/superGemRuntime.js`, make `activateSuperGemEffect()` reject color `0` before any state mutation:

```js
  const color = Number(superGem.baseColor);
  if (color === 0) return false;
```

Then keep red pending attack behavior only:

```js
  if (color === 1) {
    return armPendingSuperGemAttack({ superGem, actorUID, state });
  }
```

Do not route color `0` to `HERO_AOE`.

- [ ] **Step 3: Stop loading the super-green asset**

In `web-runner/systems/gemVisuals.js`, remove only this entry from `SUPER_GEM_ASSET_BY_COLOR`:

```js
  0: 'gems/super_green.png',
```

Keep `gems/green_gem.png` untouched until the final asset audit because old state may still contain color `0` during rollback testing.

- [ ] **Step 4: Update supergem tests**

In `tests/superGemRulesContract.test.js`, change:

```js
test('red green blue yellow heal and purple 2x2 squares become super gems', async () => {
  const mod = await loadRules();
  const allowedColors = [0, 1, 2, 3, 4, 5];
```

to:

```js
test('red blue yellow heal and purple 2x2 squares become super gems', async () => {
  const mod = await loadRules();
  const allowedColors = [1, 2, 3, 4, 5];
```

Add this test after it:

```js
test('retired green 2x2 squares do not become super gems', async () => {
  const mod = await loadRules();
  const gems = [
    makeGem(0, 0, 0),
    makeGem(0, 1, 0),
    makeGem(1, 0, 0),
    makeGem(1, 1, 0),
  ];
  const grid = mod.buildColorGrid(gems, 2, 2);
  const clusters = mod.detectSuperGemClusters(grid, 2, 2);
  assert.equal(clusters.length, 0);
});
```

In `tests/kojonnSuperGemBlightContract.test.js`, replace the green activation test with a stale-state safety test:

```js
test('retired green super-gem stale state fails closed without arming pending AOE', () => {
  const { activateSuperGemEffect } = loadSuperGemRuntime();
  const state = { globals: { time: 10, RuntimeRandom: () => 0 } };
  const calls = [];
  const activated = activateSuperGemEffect({
    superGem: { baseColor: 0 },
    actorUID: 4,
    selectedEnemyUID: 0,
    state,
    callFunctionWithContext: (ctx, name, ...args) => {
      calls.push({ name, args });
      return 0;
    },
    fnContext: {},
    sourceItems: [{ id: 'green-sg' }],
    startGemMergeFx: () => { throw new Error('retired green super-gem must not start merge FX'); },
    getGoldLabelTargetWorld: () => null,
  });
  assert.equal(activated, false);
  assert.equal(state.globals.PendingSkillID || '', '');
  assert.equal(state.globals.PendingSuperGemAction || null, null);
  assert.deepEqual(calls, []);
});
```

- [ ] **Step 5: Run supergem validation**

Run:

```bash
node --test \
  tests/greenGemRemovalContract.test.js \
  tests/superGemRulesContract.test.js \
  tests/kojonnSuperGemBlightContract.test.js \
  tests/superGemAppContract.test.js \
  tests/pendingSuperGemHandoffContract.test.js \
  tests/superGemInteractionPacingContract.test.js
```

Expected:
- Green supergem formation and stale activation tests pass.
- Red, blue, yellow, heal, and purple supergem contracts still pass.

- [ ] **Step 6: Commit checkpoint**

Run:

```bash
git add web-runner/src/core/superGemRules.mjs web-runner/systems/superGemRuntime.js web-runner/systems/gemVisuals.js tests/superGemRulesContract.test.js tests/kojonnSuperGemBlightContract.test.js tests/greenGemRemovalContract.test.js
git commit -m "fix: retire green supergem path bd-ORKA-zy2o"
```

## Task 5: Retire Green Gem Action Routing And Fixture Expectations

**Files:**
- Modify: `src/core/gemActionRules.mjs`
- Modify: `web-runner/src/core/gemActionRules.mjs`
- Modify: `web-runner/modules/functionBank.js`
- Modify: `Scripts/functionBank.js`
- Modify: `tests/fixtures/gem_action_cases.csv`
- Modify: green AOE tests that now describe retired behavior.
- Test: `tests/greenGemRemovalContract.test.js`

- [ ] **Step 1: Remove green route constants from both core rule files**

In both `src/core/gemActionRules.mjs` and `web-runner/src/core/gemActionRules.mjs`, remove the green attack export:

```js
export const GEM_ACTION_GREEN_ATTACK = 0;
```

Then make `gemActionRouteCode(0)` return unknown by leaving no color-zero route. Red remains the first active attack route.

- [ ] **Step 2: Remove green AOE decisions from rule outputs**

In both core rule files:
- `gemActionPendingSkillCode(0)` must return `GEM_ACTION_PENDING_NONE`.
- `gemActionIntentMeta(0)` must return the empty default.
- `buildGemActionDecision({ gemColor: 0 })` must not set `isAoe`, `showAttackUi`, or `pendingSkillId`.

- [ ] **Step 3: Mirror the fallback route changes**

In `web-runner/modules/functionBank.js` and `Scripts/functionBank.js`, remove:

```js
const GEM_ACTION_GREEN_ATTACK = 0;
```

Remove fallback branches that route color `0` to `GREEN`, `HERO_AOE`, `pendingSkillCode = 1`, `isAoe = 1`, or `showAttackUi = 1`.

- [ ] **Step 4: Update fixture CSV**

In `tests/fixtures/gem_action_cases.csv`, replace the existing `green_attack` row with this retired-color row:

```csv
retired_green,0,4,7,5,18,0,10,0,0,0.5,-1,0,0,0,0,0,0,7,5,0,0,0,0
```

- [ ] **Step 5: Replace green AOE tests with retired-route tests**

In `tests/kojonnRoleCorrectionContract.test.js`, remove tests that require green AOE to use the shared generic AOE path. Replace with a source contract that color `0` is not routed to `HERO_AOE`.

In `tests/kojonnAmpAoeContract.test.js`, remove the green AOE damage packet test. Replace with a test that `ResolveGemAction(ctx, 0, actorUID, consumedCount)` does not call `Hero_AOE`.

In `tests/lungeMotionContract.test.js`, remove assertions that green AOE gets special lunge profile. Keep lunge assertions for red single-target and any remaining active AOE route if one exists outside green.

- [ ] **Step 6: Run action-route validation**

Run:

```bash
node --test \
  tests/greenGemRemovalContract.test.js \
  tests/gemActionFixtureContract.test.js \
  tests/gemActionOwnershipContract.test.js \
  tests/kojonnRoleCorrectionContract.test.js \
  tests/kojonnAmpAoeContract.test.js \
  tests/lungeMotionContract.test.js
```

Expected:
- Color `0` is retired.
- Red attack, blue Astral, yellow, heal, and purple expectations remain unchanged.

- [ ] **Step 7: Commit checkpoint**

Run:

```bash
git add src/core/gemActionRules.mjs web-runner/src/core/gemActionRules.mjs web-runner/modules/functionBank.js Scripts/functionBank.js tests/fixtures/gem_action_cases.csv tests/greenGemRemovalContract.test.js tests/kojonnRoleCorrectionContract.test.js tests/kojonnAmpAoeContract.test.js tests/lungeMotionContract.test.js
git commit -m "fix: retire green gem action routing bd-ORKA-zy2o"
```

## Task 6: Retire Green From Active Tracking, HUD, And Autoplay

**Files:**
- Modify: `web-runner/modules/functionBank.js`
- Modify: `Scripts/functionBank.js`
- Modify: `web-runner/modules/state.js`
- Modify: `Scripts/state.js`
- Modify: `web-runner/systems/renderHUD.js`
- Modify: `web-runner/src/core/idleAutoplayPriority.mjs`
- Modify: `tests/heroGemUsageCounterContract.test.js`
- Modify: `tests/idleAutoplayPriorityGemContract.test.js`
- Test: `tests/greenGemRemovalContract.test.js`

- [ ] **Step 1: Stop new green usage increments**

In both function-bank mirrors, make `resolveGemUsageColorKey(0)` return `''` by removing:

```js
  if (gemColor === 0) return 'GREEN';
```

Keep legacy `GREEN` data readable only if the existing migration helpers need it. Do not increment it.

- [ ] **Step 2: Remove green from active usage defaults and HUD rows**

Change active usage rows from:

```js
{ RED: 0, GREEN: 0, BLUE: 0, HEAL: 0, YELLOW: 0 }
```

to:

```js
{ RED: 0, BLUE: 0, HEAL: 0, YELLOW: 0 }
```

Apply this to:
- `web-runner/modules/functionBank.js`
- `Scripts/functionBank.js`
- `web-runner/modules/state.js`
- `Scripts/state.js`
- `web-runner/systems/renderHUD.js`

If legacy `GREEN` totals exist in saved state, leave them ignored rather than deleted.

- [ ] **Step 3: Remove green from dev idle autoplay priorities**

In `web-runner/src/core/idleAutoplayPriority.mjs`, change:

```js
const NON_HEAL_COLORS = Object.freeze([
  COLOR_GREEN,
  COLOR_RED,
  COLOR_BLUE,
  COLOR_GOLD,
  COLOR_PURPLE,
]);
```

to:

```js
const NON_HEAL_COLORS = Object.freeze([
  COLOR_RED,
  COLOR_BLUE,
  COLOR_GOLD,
  COLOR_PURPLE,
]);
```

Remove Kojonn's green preferred color:

```js
  kojonn: COLOR_GREEN,
```

Kojonn should then fall back to the shared non-heal priority until a future product bead assigns a new color identity.

- [ ] **Step 4: Update tracking and autoplay tests**

In `tests/heroGemUsageCounterContract.test.js`, update the default row assertion to expect:

```js
party:\s*\{\s*RED:\s*0,\s*BLUE:\s*0,\s*HEAL:\s*0,\s*YELLOW:\s*0\s*\}
```

Add an assertion that the function-bank source no longer maps `gemColor === 0` to `GREEN`.

In `tests/idleAutoplayPriorityGemContract.test.js`, remove expectations that Runa or Kojonn can pick green supergems. Use red/blue/yellow/heal/purple examples only.

- [ ] **Step 5: Run tracking and autoplay validation**

Run:

```bash
node --test \
  tests/greenGemRemovalContract.test.js \
  tests/heroGemUsageCounterContract.test.js \
  tests/heroGemUsagePersistenceContract.test.js \
  tests/idleAutoplayPriorityGemContract.test.js
```

Expected:
- No active green counter display or increments.
- Legacy persistence tests still pass or are updated to preserve read compatibility without active green display.

- [ ] **Step 6: Commit checkpoint**

Run:

```bash
git add web-runner/modules/functionBank.js Scripts/functionBank.js web-runner/modules/state.js Scripts/state.js web-runner/systems/renderHUD.js web-runner/src/core/idleAutoplayPriority.mjs tests/greenGemRemovalContract.test.js tests/heroGemUsageCounterContract.test.js tests/idleAutoplayPriorityGemContract.test.js
git commit -m "fix: retire active green gem tracking bd-ORKA-zy2o"
```

## Task 7: Update Player-Facing Drift And Keep Legacy Notes Honest

**Files:**
- Modify: `governance/product/player-living-guide.md`
- Review only unless directly stale: `governance/product/faze-green-gem-separation.md`, `governance/product/hero-and-party-skills.md`, `governance/product/game-function-reference.md`, `governance/product/hero-supergem-bead-ledger.md`

- [ ] **Step 1: Update the player guide**

In `governance/product/player-living-guide.md`, remove this active gameplay bullet:

```md
- Green gems trigger an attack that hits all enemies in combat.
```

Change this sentence:

```md
Supergems can unlock special hero skills. Falie can turn red into Temporary Shield. Huun can turn yellow into Goldstrike. Kojonn can turn green into Faze.
```

to:

```md
Supergems can unlock special hero skills. Falie can turn red into Temporary Shield. Huun can turn yellow into Goldstrike.
```

Do not remove light-green healing text.

- [ ] **Step 2: Review deeper product docs for direct active-green claims**

Run:

```bash
rg -n "green|GREEN|green super|Kojonn.*green|green.*Faze" governance/product
```

Expected:
- Active player-facing claims are either updated in this bead or left as clearly historical/reference material.
- Do not broaden into redesigning Kojonn or Faze.

- [ ] **Step 3: Commit documentation checkpoint**

Run:

```bash
git add governance/product/player-living-guide.md
git commit -m "docs: update guide for retired green gems bd-ORKA-zy2o"
```

## Task 8: Full Validation And Browser QA

**Files:**
- No planned code changes.

- [ ] **Step 1: Run focused regression suite**

Run:

```bash
node --test \
  tests/greenGemRemovalContract.test.js \
  tests/superGemRulesContract.test.js \
  tests/kojonnSuperGemBlightContract.test.js \
  tests/superGemAppContract.test.js \
  tests/pendingSuperGemHandoffContract.test.js \
  tests/superGemInteractionPacingContract.test.js \
  tests/idleAutoplayPriorityGemContract.test.js \
  tests/gemActionFixtureContract.test.js \
  tests/gemActionOwnershipContract.test.js \
  tests/heroGemUsageCounterContract.test.js \
  tests/heroGemUsagePersistenceContract.test.js \
  tests/devToolingBoardOverrideContract.test.js \
  tests/purpleEnergyPathContract.test.js \
  tests/falieRedSuperGemBufferShieldContract.test.js \
  tests/superGemCriticalHealContract.test.js \
  tests/huunYellowSuperGemGoldstrikeContract.test.js
```

Expected:
- All focused tests pass.

- [ ] **Step 2: Run full suite as a comparison check**

Run:

```bash
npm test
```

Expected:
- If the baseline was green, full suite is green.
- If the baseline was already red, no new failures appear in green/supergem/action/tracking surfaces.

- [ ] **Step 3: Run diff hygiene**

Run:

```bash
git diff --check
git status --short --branch
```

Expected:
- No whitespace errors.
- Only scoped files are dirty.

- [ ] **Step 4: Run local browser QA**

Run:

```bash
npm run serve:qa
```

Use the Codex in-app Browser at `http://127.0.0.1:8000/web-runner/`.

Manual checks:
- Start combat and confirm the board contains red, blue, yellow, heal, and purple, but no regular green.
- Use dev board color options and confirm `GREEN` is absent.
- Confirm light-green heal gems still heal.
- Force or observe 2x2 red, blue, yellow, heal, and purple squares and confirm supergem behavior still works.
- Confirm no green supergem can form or be tapped.
- Confirm idle autoplay does not select a green gem or green supergem.

- [ ] **Step 5: Record validation evidence**

Run:

```bash
bd comments add ORKA-zy2o "Validation: focused node --test passed; npm test result recorded; browser QA at http://127.0.0.1:8000/web-runner/ confirmed no active green regular gems or green supergems, with heal/red/blue/yellow/purple still working."
```

## Task 9: Final Checkpoint, Merge, And Cleanup

**Files:**
- Beads state after close.

- [ ] **Step 1: Final scoped commit if any validation-only docs changed**

Run:

```bash
git status --short
```

Expected:
- If dirty, only scoped files are dirty; commit with `bd-ORKA-zy2o`.
- If clean, continue.

- [ ] **Step 2: Close the bead after validation passes**

Run:

```bash
bd close ORKA-zy2o --reason "Removed active regular green gems and green supergems; validated focused contracts, full-suite comparison, and browser QA."
```

- [ ] **Step 3: Commit Beads close artifacts if present**

Run:

```bash
git status --short
git add .beads
git commit -m "chore: close green gem removal bead bd-ORKA-zy2o"
```

If `.beads` has no tracked changes, skip this commit.

- [ ] **Step 4: Tag main before merge**

From `/Users/Mace/Codex-Orka` on `main`, run:

```bash
git status --short --branch
git tag "rollback/ORKA-zy2o-before-merge-$(date +%Y%m%d-%H%M%S)" main
```

- [ ] **Step 5: Merge safely**

Run:

```bash
git merge --ff-only bead/ORKA-zy2o-remove-green-gems
```

Expected:
- Fast-forward merge succeeds.
- If it does not fast-forward, stop and inspect before any merge commit.

- [ ] **Step 6: Re-run focused validation on main**

Run:

```bash
node --test tests/greenGemRemovalContract.test.js tests/superGemRulesContract.test.js tests/gemActionFixtureContract.test.js tests/heroGemUsageCounterContract.test.js
git diff --check
```

Expected:
- Focused tests pass on `main`.
- No diff hygiene errors.

- [ ] **Step 7: Remove the worktree and branch only after merge verification**

Run:

```bash
git worktree remove .worktrees/wt-ORKA-zy2o-remove-green-gems
git branch --merged main | rg "bead/ORKA-zy2o-remove-green-gems"
git branch -d bead/ORKA-zy2o-remove-green-gems
```

Expected:
- Worktree is removed.
- Branch deletion succeeds because the branch tip is reachable from `main`.

## Stop Conditions

Stop and ask before continuing if any of these happen:
- Baseline focused tests fail in a way that makes later comparison impossible.
- `main` or the bead worktree has unexpected tracked dirt in runtime files.
- More than four active bead worktrees exist before opening this lane.
- Removing color `0` requires a broader redesign of Kojonn, Faze, AOE identity, or skill-card progression.
- Light-green heal behavior changes.
- Any red, blue, yellow, heal, or purple supergem contract starts failing.
- `npm test` shows new failures outside the baseline snapshot.
- Browser QA shows blank canvas, stuck turns, or disabled gem picking after a non-green move.

## Retrieval Receipt

- Tool used first for code-location retrieval: `jcodemunch-mcp`.
- Repo/query used: `local/Codex-Orka-904e2bad`, health and dependency graph checks for supergem/action files.
- Result: `web-runner/systems/superGemRuntime.js` was indexed and imported by `web-runner/app.js`; several newer `web-runner/src/core/*.mjs` files were not found in the jcodemunch index.
- Fallback tools used because the index was incomplete: Serena pattern search, then focused `rg` and `sed`.
- Files/symbols retrieved: `randomGemFrame`, `DEV_TOOL_GEM_OPTIONS`, `forceDeterministicBoard`, `SUPER_GEM_COLORS`, `activateSuperGemEffect`, `gemActionRules`, function-bank fallback routing, hero gem usage tracking, `idleAutoplayPriority`, `player-living-guide.md`.
- Full-file reads avoided: yes for source code; focused snippets and indexed pattern results were used.
