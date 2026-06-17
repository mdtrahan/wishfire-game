# JavaScript Orchestration Review Checklist

Last updated: 2026-06-15

Use this checklist before editing `web-runner/app.js` or expanding browser runtime orchestration. This checklist does not authorize runtime edits; Beads scope, hot-file policy, and the applicable AGENTS.md chain still control execution.

## Pre-Edit Gate

- [ ] Active Beads issue exists, unless the work is docs-only minor-exempt.
- [ ] Hot-file scope is prepared before touching `web-runner/app.js`.
- [ ] Current dirty files are understood and not overwritten.
- [ ] Nearest AGENTS.md chain has been read.
- [ ] `governance/planning/app-js-thinning-playbook.md` has been checked.

## Ownership Check

- [ ] Gameplay logic is going to `web-runner/modules/` or shared deterministic core, not `app.js`.
- [ ] Rendering/input/overlay/persistence/dev-tooling behavior is going to `web-runner/systems/`.
- [ ] Small presentation state is going to `web-runner/state/`.
- [ ] Deterministic rules or packet contracts are going to `src/core/`, `web-runner/src/core/`, or Rust-owned SimulationCore surfaces.
- [ ] `app.js` keeps only lifecycle, import, initialization, and composition wiring.

## Bloat Check

- [ ] No new package dependency enters the startup path without explicit justification.
- [ ] No duplicate library category is introduced.
- [ ] No broad `utils`, `common`, or catch-all module is created.
- [ ] No index barrel imports or re-exports an entire feature tree.
- [ ] Optional or heavy behavior is surface-scoped or deferred where practical.
- [ ] Top-level module side effects are avoided unless startup explicitly requires them.

## Behavior Check

- [ ] Existing behavior remains unchanged unless the bead explicitly requires behavior change.
- [ ] The extracted owner has a single clear responsibility.
- [ ] The `app.js` diff is minimal and mostly wiring.
- [ ] Gameplay/product intent is checked against governance docs when behavior could drift.
- [ ] Rust-owned deterministic outcomes are not recomputed in JavaScript.

## Validation Check

- [ ] Docs-only changes use `git diff --check`.
- [ ] Runtime changes use focused `node --test tests/<relevant-contract>.test.js`.
- [ ] Browser/manual QA is used only when visual/runtime behavior needs it.
- [ ] `npm run serve:qa` is not run for docs-only changes because it writes `web-runner/runtime-fingerprint.js`.
- [ ] Test evidence is recorded in the closeout.

## Stop Conditions

Stop and ask before continuing if:

- The work needs broad `app.js` rewiring.
- A new package dependency is needed.
- The change touches combat turn flow, skill execution, persistence compatibility, or SimulationCore shadow behavior.
- Existing dirty files overlap with the intended edit.
- The owner module is unclear.
- The change would combine docs, runtime extraction, and dependency changes in one bead.
