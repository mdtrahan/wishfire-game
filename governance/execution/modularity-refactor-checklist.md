# Modularity Refactor Checklist

Last Updated: 2026-03-02 (Shared core and adapter thinning reconciled)
Update Rule: PM updates this file whenever a new modularity/ownership prompt is issued to Don or a modularity lane is accepted/re-scoped.

## Purpose
- Keep a durable, low-noise record of the modularity/ownership refactor program.
- Track completed, active, and upcoming lanes across the refactor.
- Provide a clean reference when regressions, blockers, or scope shifts happen.

## Completed

### Power Amp Modularization
- [x] `ORKA-l0t` `[TASK] Inventory Power Amp ownership and direct write sites`
- [x] `ORKA-50g` `[FEAT] Extract Power Amp owned state seam`
- [x] `ORKA-6os` `[FEAT] Convert Power Amp render to read-only projection`
- [x] `ORKA-kdq` `[BUG] Enforce Power Amp lifecycle conformance`
- [x] `ORKA-mqr` `[TASK] Extract Power Amp deterministic rules into src`

### Turn Gate Ownership
- [x] `ORKA-7rk` `[TASK] Inventory turn gate flag write sites`
- [x] `ORKA-jvx` `[FEAT] Introduce TurnGateController baseline authority`
- [x] `ORKA-54x` `[BUG] Migrate yellow/refill handoff to TurnGateController`
- [x] `ORKA-sao` `[BUG] Migrate deferred recovery arbiter to TurnGateController`

### Governance
- [x] `ORKA-9zc` `[CHORE] Record Beads ID requirement in AGENTS.md`

### Queue Mutation Ownership
- [x] `ORKA-6w2` `[TASK] Inventory raw queue write sites`
- [x] `ORKA-0ls` `[FEAT] Introduce scheduler facade for all queue writes`
- [x] `ORKA-y7j` `[BUG] Route battle-start override through scheduler mutation API`
- [x] `ORKA-86x` `[BUG] Route explicit queue mutations through scheduler API`

### Shared Core Follow-Through
- [x] `ORKA-d1a` `[TASK] Thin Power Amp runtime adapters around shared src rules`
- [x] `ORKA-gqq` `[TASK] Thin TurnGate runtime adapters around shared src controller`
- [x] `ORKA-0m2` `[TASK] Extract scheduler deterministic rule logic into src`
- [x] `ORKA-8yi` `[TASK] Convert web-runner and Scripts into thinner adapters for scheduler logic`

## Next Up
- [ ] No active modularity lane. Refactor stream is paused unless a new hotspot justifies another ownership seam.

## Current Program Status
- Power Amp pilot modularization: materially complete
- Turn Gate control seam: materially complete
- Queue mutation ownership: materially complete
- Shared scheduler core extraction: materially complete for current scope
- Current active lane: none (modularity stream paused)

## Notes
- Power Amp was the pilot feature, not the whole refactor.
- The same seam pattern is now being carried into the rest of the project:
  - inventory
  - establish owner seam
  - migrate highest-risk writes behind the seam
  - extract deterministic logic to `src`
- Completed current-scope lanes:
  - Power Amp modularization
  - Turn Gate Ownership
  - Queue Mutation Ownership
  - Shared scheduler extraction and adapter thinning
- Human QA remains for player-facing lanes only.
- Infra/modularity lanes should continue to use artifact-based `validation handoff`.
