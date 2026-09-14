# Approved playable baseline and stacked integration manifest

Bead: `ORKA-ymk.6`

Status: checkpointed before runtime or inherited-test-debt edits

## Approved ancestry

- Baseline start: `818cc1fc06338ef6e92af48cd3891a6085de5162`
- Baseline end: `3349a8e852c26727487a669940be13a7b57092a2`
- Verified ORKA-ymk.1 seed: `437b5ab33ce25ada48f44af5e8e4d2da676906e4`
- Approved baseline range: `818cc1f..3349a8e`

The `.1` seed already contains the approved baseline through Git ancestry. Integration preserves that ancestry and will not replay or cherry-pick the baseline commits individually.

## Tranche order

1. `ORKA-ymk.1` verified seed and AF correction
2. `ORKA-ymk.2` fresh-session opening and 100-AF buff queues
3. `ORKA-ymk.3` deterministic configurable session runner
4. `ORKA-ymk.4` player-facing session presentation and shared browser integration
5. `ORKA-ymk.5` independent verification

Each tranche enters this lane only after its own required validation and QA evidence. The originating child retains defect ownership.

## Integration ownership

This lane owns the accepted baseline manifest, sequential tranche ingestion, integration conflict resolution, final rollback checkpoint, Integration Ready evidence, and merge to `main`. It also owns inherited baseline test debt:

- Two obsolete Crimson Ward VM contracts
- Six esbuild or offline-environment failures
- One external-Chrome Astral Shop test, replaced with in-app Browser coverage or explicitly gated with evidence

`ORKA-ymk.4` retains shared `app.js` and render integration ownership until its tranche is accepted. `ORKA-ymk.5` retains independent QA ownership.

## Checkpoint

- Branch: `bead/ORKA-ymk.6-baseline-integration`
- Worktree: `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-ymk.6-baseline-integration`
- Created from: `437b5ab33ce25ada48f44af5e8e4d2da676906e4`
- Runtime edits at checkpoint: none
- Test edits at checkpoint: none
