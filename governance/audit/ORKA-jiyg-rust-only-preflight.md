# ORKA-jiyg Rust-only cutover preflight

Status: STOP under the owner's step 5, before combat deletion. Runtime source is unchanged from `origin/main@0aad6419`.
Branch: `bead/ORKA-jiyg-rust-only`. No push or merge.

## Rebase and resolved prerequisite

Fetched origin and rebased the earlier preflight onto `0aad6419`. PR #229 supplies permanent-input revisions; equipment, level, Training and SPD are no longer the reported prerequisite. Formation/Leader removal and the handoff verifier are present. The worktree was clean before this investigation.

## Retained feature requiring reconciliation

The retained story defeat control spends 30 resources on Continue and resumes the encounter. `web-runner/systems/storyEntryFlow.mjs:202-209` invokes `resurrect` before spending resources. `questCombatSession.mjs:113-132` restores every hero while retaining enemy progress and the encounter's buffs/skills. The explicit regression contract is `tests/questCombatSessionContract.test.js:85-105`; the resource/navigation contract is `tests/storyEntryFlowContract.test.js:120-132`.

This control has no equivalent in the shipped Rust lifecycle:

- A Rust-bound actor causes central HP restoration to throw before mutation (`questCombatSession.mjs:11-12`).
- Rust makes `all_down` terminal; subsequent combat steps and permanent-input revisions return `terminal` (`rust/simulation_core/src/combat_abi.rs:484-489`).
- The ABI exposes describe/create/step/inspect/spawn/wave_chest/ordinary_clear/destroy, without a recovery operation (`combat_abi.rs:210-238`). R1 explicitly keeps downed heroes at zero during permanent revisions.
- Governing TDD-A §3.3 forbids a public arbitrary HP/revive command and describes checkpoint restart. Creation accepts initial HP, but cannot restore an existing world's statuses, committed actions, clocks and RNG. A replacement world can implement a restart; it cannot establish parity with the retained in-place Continue contract.

Current player Start enters continuous progression. This gap concerns the retained story/QA defeat flow explicitly included in the owner's every-encounter scope and TDD-B §6 story/dev migration. No claim is made that ordinary Chapter 1 reaches this menu organically. D17 replaces any-KO pausing and supplies slice revival; it does not specify how this retained resource Continue changes after terminal all-down.

The cutover must obtain a reconciled story recovery contract: preserve supported Continue state through an approved Rust lifecycle boundary, or explicitly authorize checkpoint-restart semantics and update the retained story contract. Adding an arbitrary revive command or silently dropping Continue is outside this deletion's approved API. Keep the current engine until that choice and its Rust proof exist.

## Shipped-WASM proof

Ran `/tmp/jiyg-stop/story-continue-proof.mjs` against the checked-in WASM. JSON evidence: `/tmp/jiyg-stop/story-continue-proof.json`.

Created a finite one-hero encounter with a downed hero and an enemy at 7 HP. Creation returned `all_down`. Both the next step and a valid permanent-input revision returned `terminal: encounter is terminal`. A proposed `recover` operation returned `invalid_input: unknown variant recover`. Bound `session.resurrect()` threw `HP restoration not supported in Rust encounters; stop the encounter first`, retaining HP `[0,7]`. The unbound control restored `[1000,7]` and preserved the buff record. Teardown left zero worlds/responses; one input was the describe call itself.

Focused validation: 39 cases, 38 passed, one inherited failure, `boss defeat is free, retains the full ready milestone, and resumes farming until summoned`. Story resource Continue, retained-state resurrection and terminal-WASM contracts passed. No assertion was weakened and no test retired.

## Validation and delivery

Cargo passed: simulation_core 34, wf_combat 37, wf_slice_harness 537; 608 passed and 10 ignored. `npm run build:offline` passed. The standalone unit run had 1,497 tests: 1,476 passed, 18 failed and 3 skipped. Browser TAP reports 30 cases: 27 passed, two Bag failures and one skipped. The agent interrupted the lamp worker after an erroneous stall classification despite output having resumed 22 seconds earlier. Both assertion failures were emitted before the intervention; the standalone result does not certify natural teardown. `/tmp/jiyg-stop/browser-interruption.json` records the intervention; `/tmp/jiyg-stop/npm-test.log` retains all output. The verifier suites completed naturally; its outer run was interrupted later during probes.

Frozen slice/hash inputs and runtime source remain unchanged: harness tree `c781cad4b9f3cf2ad11165177a22261c955f5bad` and VFX tree `e7f600b9b3990882df318130a7625b4f9aeda717` match the base. Storage guard passed; read-only storage audit completed. The branch adds documentation bytes versus main. The required runtime shrink is not delivered. This is a documentation checkpoint, not Rust-only acceptance: flags, shadow path, JS fallback, legacy combat and scalar exports remain present. No feature has been rewired. The static retirement gate and runtime-spy gate have not been delivered.

The review URL is `http://localhost:8798/web-runner/index.html` without flags; DEV → Chapter 1 shows the unchanged JS-default baseline. Keep its status explicit during review. ORKA-jiyg remains in progress for the lead's recovery-contract decision and implementation ordering.

Commit preparation uses `tools/prepare_commit_check.sh ORKA-jiyg`; no hot runtime files were edited. Generated preparation metadata is retained in `/tmp/jiyg-stop/`. Existing parent Child DOX indexes still match the unchanged directory structure. Retrieval used the assigned checkout and focused `rg`; jcodemunch was unavailable.

## Handoff verifier receipt

Ran `node tools/verify_handoff.mjs --base 0aad6419 --head dd0f68db --out /tmp/jiyg-handoff`. Status: INCOMPLETE after the turn interruption; the original verifier process no longer exists, and no official aggregate verdict was written. Do not infer a product hang from the unfinished second baseline probe. Receipt: `/tmp/jiyg-handoff/interrupted-receipt.json`; complete suite logs and the first browser trace pair remain alongside it. Temporary comparison checkouts were removed after preserving their test evidence and rebuilt WASM.

The exact observed failure-set diff is one newly observed failure, `tests/combatDpsOverlay.test.mjs::DPS and current CP: normal combat, toggle continuity and four contained viewport sizes`, and one absent failure, `tests/taskFootprintContract.test.mjs::start before allocation survives automatic lane linking, resume and finalization`; 22 failures are shared. The DPS case timed out after 30 seconds waiting for `#combat-dps-overlay` at test line 32. No runtime/test-source change establishes a causal fix or regression. Base browser output: 29 passed, zero failed, one skipped. Head browser output: 28 passed, one failed, one skipped.

Partial head performance: mean frame 23.775 ms, 30.81% of frames above 16.7 ms, ABI step mean 0.145 ms. Browser figures use the first completed trace; step figures use a fresh replay through the existing `sampleSteps` helper and that trace's exact config/rebuilt WASM. These are not the required three-run aggregate; retained-heap comparison is unavailable. The browser probe used the existing opt-in Rust fallback, so these figures do not certify no-flag routing.

Recommended next actions: reconcile retained resource Continue with D17/TDD-A checkpoint recovery before deleting its consumer; rerun the interrupted full verifier after implementation. This checkpoint does not grant QA PASS or Integration Ready.
