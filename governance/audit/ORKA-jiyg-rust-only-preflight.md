# ORKA-jiyg Rust-only cutover preflight

Status: STOPPED before combat deletion. Runtime source remains fbaab92fa70b06944772d80bac9e88ae84cfb827.
Branch: bead/ORKA-jiyg-rust-only. No push or merge.

## Blocking supported feature

Live equipment, level and Training changes require an in-place Rust permanent-input revision. The shipped ABI cannot accept one. Removing JS stat/HP writes without a replacement would leave saved progression and displayed CP ahead of combat strength. Recreating the world would reset casts, clocks, effects and RNG, violating the approved revision contract.

- `web-runner/systems/equipmentStorage.mjs:69-81` applies earned EXP and equipment to both saved heroes and deployed actors; its live HP delta currently happens in JS.
- `web-runner/src/core/heroProgression.mjs:22-29` updates live level stats and HP.
- `rust/simulation_core/src/combat_abi.rs:154-160` accepts only end reason, encounter identity and previous step. Its Operation enum at lines 167-195 has no permanent-input revision operation.
- `web-runner/src/core/combatBridge.mjs:45-53` exposes creation, step, chest, clear, end, inspect, spawn and destroy, without revisions.
- Governing TDD-A section 3.3 requires `ReplacePermanentInputs` with atomic revision checks, preserved casts/cooldowns/targets/ward/status/RNG, living HP growth and downed HP unchanged. TDD-B section 3.5 requires coalescing and acknowledged step-boundary projection. RECONCILIATION R1 fixes the HP rule.

## Shipped-WASM repro

Created a continuous one-hero Falie encounter through the real `createCombatBridge` and current `createShadowConfig`, then applied HP gear with the existing `refreshHeroStats` helper. Host max HP grew from 75 to 125; Rust max HP remained 420. At the accepted ratio the new Rust maximum would be 700. Passing `commands` to the current step request returned:

```
invalid_input: unknown field `commands`, expected one of `end_encounter`, `encounter_id`, `expected_previous_step`
```

Exact result: `test-results/ORKA-jiyg/live-equip-api-proof.json`.

## Required next slice

Implement the approved Rust permanent-input revision contract and bridge/driver routing first, with monotonic revisions, atomic validation, HP policy, committed-cast preservation and pause/reload acknowledgement tests. Rewire equipment/level/Training commits to that path before removing their JS live writes. Then resume the full retirement inventory and retained story/dev migration. No world-recreation workaround, delayed-until-next-fight progression or weakened save/economy assertion is accepted by this report.

Hero Lab is excluded by the owner: it belongs to unpushed ORKA-6ury work and does not exist on this baseline. No scenario was added.

## Validation

Installed locked dependencies with `npm ci`; restored the tracked node_modules lock metadata to its original bytes. `npm run build:offline` succeeded. All seven offline artifact contracts ran and passed; they are absent from the failures below because their build prerequisite was satisfied. The initial sandbox-denied server run is discarded; the authoritative run uses permitted loopback/Chromium access.

`cargo test` passed for every crate: simulation_core 31 tests, wf_combat 18, wf_slice_harness 537 (10 ignored). Total 586 passed, 10 ignored.

Full unit baseline: 1472 tests, 1451 passed, 18 failed, 3 skipped.

Exact unit failures:

- hero screen reads every accepted kit skill from shared data
- automatic HERO_SINGLE uses the runtime random target in web-runner/modules/functionBank.js
- Tank HERO_SINGLE targeting follows runtime random in web-runner/modules/functionBank.js
- Fighter HERO_SINGLE targeting follows runtime random in web-runner/modules/functionBank.js
- Controller HERO_SINGLE targeting follows runtime random in web-runner/modules/functionBank.js
- Support HERO_SINGLE targeting follows runtime random in web-runner/modules/functionBank.js
- random targeting excludes dead enemies in web-runner/modules/functionBank.js
- automatic HERO_SINGLE uses the runtime random target in Scripts/functionBank.js
- Tank HERO_SINGLE targeting follows runtime random in Scripts/functionBank.js
- Fighter HERO_SINGLE targeting follows runtime random in Scripts/functionBank.js
- Controller HERO_SINGLE targeting follows runtime random in Scripts/functionBank.js
- Support HERO_SINGLE targeting follows runtime random in Scripts/functionBank.js
- random targeting excludes dead enemies in Scripts/functionBank.js
- leader-target bias spans own-nearest to the legacy shared target
- heroes split across nearby enemies by default and dog-pile under the legacy toggle
- heroes may stack on one target while hero-enemy spacing stays whole
- boss encounters keep full hero spacing along the front edge
- boss defeat is free, retains the full ready milestone, and resumes farming until summoned

Browser baseline: 25 passed, 1 skipped, 1 natural failure and 1 interrupted case. The natural failure is `hero party screen uses saved canonical data and stays contained across portrait viewport profiles` (`tests/heroScreenUILayout.test.mjs:411`): persisted HeroProgress gained `pendingBagKillRewards: {}` relative to the fixture's expected object. The interrupted case is `lamp emitter: full cache and every modal freeze movement, capture and cadence` (`tests/lampPresentation.test.mjs:208`), interrupted at 91.383 seconds after output stopped. Closing its browser caused the reported `Target page, context or browser has been closed`; this is agent-induced interruption evidence, not an independently established product failure. The test process then required SIGKILL to leave teardown. Remaining files completed. The two later cases in that lamp file were attempted separately in `baseline-lamp-remaining.log`; that run produced no completed case in over 180 seconds and was stopped with its owned descendants. Both later cases remain unverified. Process evidence is retained in `remaining-cases-timeout.json`.

After: no runtime changes retained; no post-change suite claimed. No tests were retired and no failure is claimed fixed. All runtime paths remain present, including the flags and JS fallback, because the cutover stopped before deletion.

Logs remain in `test-results/ORKA-jiyg/`: baseline-build.log, baseline-tests.log, cargo-simulation_core.log, cargo-wf_combat.log and cargo-wf_slice_harness.log.

## Delivery state

Documentation checkpoint only. Rust-only default, retirement acceptance gate and no-flag combat review are not delivered. Existing runtime source and mirrors are unchanged. ORKA-jiyg remains in progress for the lead to order the prerequisite and resume.

Baseline review is served at http://localhost:8798/web-runner/index.html without flags. This remains the unchanged JS-default baseline, not Rust-only acceptance. The first sandboxed footprint-close call failed with `Cannot read properties of undefined (reading trim)`. Retrying with permitted process access succeeded, as did the read-only storage audit. Logs, offline bundle, local Cargo build output and the requested review server are intentionally retained in this unmerged lane; footprint baseline is unknown. DEV Chapter 1 was launched from the plain URL in the collaborative preview.
