# Modularity Refactor Checklist

Last Updated: 2026-03-02 (Shared core and adapter thinning reconciled)
Update Rule: PM updates this file whenever a new modularity/ownership prompt is issued to Don or a modularity lane is accepted/re-scoped.

## Purpose
- Keep a durable, low-noise record of the modularity/ownership refactor program.
- Track completed, active, and upcoming lanes across the refactor.
- Provide a clean reference when regressions, blockers, or scope shifts happen.

## Completed

### Power Amp Modularization
- [x] Inventory Power Amp ownership and direct write sites
- [x] Extract a Power Amp owned-state seam
- [x] Convert Power Amp rendering to read-only projection
- [x] Enforce Power Amp lifecycle conformance
- [x] Extract Power Amp deterministic rules into `src`

### Turn Gate Ownership
- [x] Inventory turn-gate flag write sites
- [x] Introduce a TurnGateController baseline authority seam
- [x] Migrate yellow/refill handoff to TurnGateController
- [x] Migrate deferred recovery arbitration to TurnGateController

### Governance
- [x] Record the Beads ID requirement in `AGENTS.md`

### Queue Mutation Ownership
- [x] Inventory raw queue write sites
- [x] Introduce a scheduler facade for all queue writes
- [x] Route battle-start override through the scheduler mutation API
- [x] Route explicit queue mutations through the scheduler API

### Shared Core Follow-Through
- [x] Thin Power Amp runtime adapters around shared `src` rules
- [x] Thin TurnGate runtime adapters around shared `src` controller
- [x] Extract scheduler deterministic rule logic into `src`
- [x] Convert `web-runner` and `Scripts` into thinner adapters for scheduler logic

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
