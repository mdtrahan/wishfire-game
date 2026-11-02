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

Full cargo/build/test and verifier results are recorded below after completion. Frozen slice/hash inputs and runtime source remain unchanged. This is a documentation checkpoint, not Rust-only acceptance: flags, shadow path, JS fallback, legacy combat and scalar exports remain present. No feature has been rewired. The static retirement gate and runtime-spy gate have not been delivered.

The review URL is `http://localhost:8798/web-runner/index.html` without flags; DEV → Chapter 1 shows the unchanged JS-default baseline. Keep its status explicit during review. ORKA-jiyg remains in progress for the lead's recovery-contract decision and implementation ordering.
