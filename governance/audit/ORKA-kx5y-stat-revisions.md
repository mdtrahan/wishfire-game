# ORKA-kx5y permanent-input revisions

Branch: `bead/ORKA-kx5y-stat-revisions`. Remediation starts at `141231b553527575a0e0941a63e3ac493afa5e51`; baseline `fbaab92fa70b06944772d80bac9e88ae84cfb827`. Independent FAIL report: `/tmp/verify-kx5y/report.md`. No push or merge. Work stayed in the assigned worktree; local Beads reads required sandbox escalation.

## Verifier remediation

F1: Phoenix captures its recipient maximum when a channel begins. Actor revival consumes `action_target_max_hp`; both cap healing at the current maximum and emit the actual healed amount. Arcane Pulse and Faze construction use committed Elevate. The additional commitment audit found Shadow landing reading live reach; it now uses committed reach. Boss basic and Mirewing release paths now use the shared committed-stat reader, and WFM action damage/healing uses committed MAG/ATK. Enemy revisions remain unsupported, so those enemy substitutions currently preserve behavior. Incoming mitigation, positions tracked by the existing targeting policy, passive aura/Mend and regeneration ticks remain live by design. No additional supported hero commitment leak was found in the source audit.

F2: native stats and the create/spawn/marker/revision payloads retain independent ATK, DEF, MAG and RES. Physical actions use ATK/DEF; magic actions use MAG/RES. Shadow remains physical with Arcane impact art; Bubble Pop/Pulse/Faze use magic. Djinn and Chimerilass select the channel per physical/magic action. Projectiles retain their launch channel. Supported schema-1.0 requests without the added fields retain their established equal-channel defaults; the production host emits every channel. The former `wfm_magic` actor stat is removed; the four ported WFM definitions retain their authored MAG/RES bases (Djinn 28/14, Chimerilass 26/16, High Gobloc 8/12, Skeleton 4/4). MATK/RES Training changes payload signatures and accepted Rust stats. Creation now computes the permanent projection once, retaining entry HP's host ratio (review F5).

F3: `attachHeroProgress` routes the entire operation through detached meta while bound. The shared session reset refuses to reset bound actors; developer presets preserve the active Rust encounter and queue revisions. Watched real-host tests cover HP, maxHP, stats and statuses; accepted snapshots own live changes.

F4: the ABI gameplay hash includes host maxima in actor order, command sequence, encounter mode/state, identity reservations and ordinary-clear receipts. Current/captured independent stats, active Phoenix maximum, pending spawn stats and projectile launch channels also enter the appropriate production hash. The frozen harness retains its established host hash stream and equal stat pairs.

## Regression evidence

Tracked adaptations of verifier probes: `tests/combatRevisionVerifier.test.mjs` from `probes.mjs`; `tests/combatRevisionVerifier.before.json` preserves `wasm-host-probe.json`; the Phoenix test in `tests/combatPermanentInputs.test.mjs` derives from `phoenix.mjs`; native Pulse/Faze checks in `permanent.rs` derive from `native/src/bin/elevate.rs`.

Native tests cover actor/Phoenix revival after HP growth and shrink, the current healing cap, exactly one heal, committed Pulse/Faze Elevate and MAG, Shadow reach, independent incoming mitigation, next-action replacement, physical Shadow art and per-action Djinn channels. Real WASM covers Phoenix maxima 420/840/210/100, atomic rejection, coalescing, lost/stale ack rules, reload before ack, equipment/EXP/ticket/Training/developer commits, creation/spawn/marker channels and equal-HP hash divergence. The existing 13-result native/WASM fixture compares every event, snapshot and gameplay hash.

The initial focused run passed 65 tests. A follow-up preserves authored WFM MAG/RES bases after removing the separate magic field; final-state counts and full-suite evidence follow below.

## Full validation

Runtime source: `9fa3b887718c1feefc3fd7cf06099e59f7bc1bda` (with `2aaf038599deb5e1f68e0a5692e739905b836411`). All three Cargo crates pass: SimulationCore 34 (33 library + 1 contract), wf_combat 35, frozen harness 537; **606 passed, 10 ignored**. The harness’s unchanged `baseline-trace.tsv` matches every-step hash folds and ordered events for seeds 1/7/42, spotlight off/on, through 27,000 steps. Bound-diagnostics compilation also passes. The last full harness took 265.84 seconds under load; it completed.

The final focused JS/WASM/boundary suite passes **66 tests**. The shipped WASM and source/binary provenance were rebuilt. `npm run build:offline` passes on the clean runtime commit.

Final `npm test -- --test-concurrency=4 --test-timeout=120000`: unit phase **1482 tests, 1461 passed, 18 failed, 3 skipped**. Exact failure names match the supplied verifier’s clean baseline: **added 0, removed 0**. That baseline was not rerun in another checkout. The earlier 2aaf0385 unit phase also matched all 18 names (1481/1460/18/3), before the final WFM base-stat test was added; its browser phase was deliberately interrupted for that correction. Both attempts are retained.

Final browser batch: **27 reported tests, 23 passed, 3 failed, 1 skipped**. The natural Hero-screen failure is the supplied baseline’s exact `pendingBagKillRewards: {}` save-shape mismatch at `heroScreenUILayout.test.mjs:411`. DPS timed out waiting for `#combat-dps-overlay` at `combatDpsOverlay.test.mjs:32`; one isolated retry also timed out. The test uses the flag-off URL. This remains an unresolved browser check, with no broad browser PASS or assertion change claimed.

All six Auto-Equip gameplay cases passed on the final runtime. `lampPresentation` completed its first actual-CP invariant across four phones, then its owned process tree was stopped at the **180-second file time box** with no cleanup errors. The remaining four cases are **unverified**: continuous equipment lifecycle; emitter pause/cadence; trash-only dismantling; Auto-Equip empty disposal/legacy salvage. Their interrupted remainder is not a product-failure verdict. The final npm run completed in 535.22 seconds with exit 1.

The initial implementation commit’s required gameplay/roster hook passed all 10 tests. Both runtime commits used `tools/prepare_commit_check.sh ORKA-kx5y` and normal hooks; neither bypassed verification. The first rejected UI-lock attempt is retained separately below. Final Boss HUD, formation, cooldown strip and the other completed browser cases retain their individual outcomes in the batch log.

Evidence: `test-results/ORKA-kx5y/final-verifier-fixes/summary.json`, `failure-set.json`, `kx5y-final-{simulation_core,wf_combat,wf_slice_harness}.log`, `kx5y-focused-full.log`, `kx5y-npm-test.log`, `kx5y-dps-retry.log`, build/commit logs and the first-attempt logs. The DPS retry’s bounded failure needs a separate startup/START-readiness investigation; that follow-up was not folded into this stat-revision bead.

## Exact inherited unit failure set

The 18 baseline failure names are:

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


## Limits and retained evidence

The first commit attempt stopped at the broad UI lock’s nearest-target invariant. Its unchanged assertions and report are retained in `test-results/ui-lock/2026-11-01T20-42-21-767Z/`. The final reset guard lives in the shared combat session owner; developer UI source is unchanged. No visual review or release acceptance is claimed. Native and WASM evidence covers the named fixtures rather than every possible state. Full-suite failures and browser time boxes are reported above. Temporary Cargo caches and logs use `/tmp/kx5y-*` and `/tmp/ORKA-kx5y-*`; offline outputs and ignored test artifacts remain in this worktree for review. Integration Ready against newer main is outside this commit-only delivery.
