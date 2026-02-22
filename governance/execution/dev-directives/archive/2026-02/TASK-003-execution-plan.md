# TASK-003 Execution Plan

## Objective
Deliver the required deterministic transition flow `0 -> 1 -> 2 -> 1` while executing the current user-priority UI slice: move info radiators off the central viewport into side frames/windows without changing gameplay logic.

## Sprint-Blocking Acceptance Mapping (CRITICAL)
- ADV-2026-009 (CRITICAL) is mapped to TASK-003 and is sprint-blocking.
- Required acceptance:
  - Chain/combat-tracker/turn-order radiators must be isolated to side windows.
  - Layout 1 radiator ownership must remain container-scoped; no Layout 1 radiator payload may render in Layout 1 active playfield coordinates intended for combat entities.
  - Runtime flow and interaction integrity must remain unchanged (`0 -> 1 -> 2 -> 1` valid).

## Current Execution Slice (Sprint-Board Aligned)
- Relocate these UI radiators into side containers/windows:
  - Chain textbox
  - Combat tracker textbox (`What happened?`)
  - Turn order textbox
- Hard constraint:
  - No gameplay logic changes
  - No transition-flow changes
  - No combat math/turn-rule changes
  - Visual placement/container ownership updates only

## Scope Boundaries
- In scope:
  - UI placement/layout/container updates for the three listed text radiators.
  - Preserve readability and non-overlap with active combat viewport.
  - Preserve existing runtime behavior and event flow.
- Out of scope:
  - Turn-model redesign or TASK-004 hardening scope.
  - Deterministic scenario-suite expansion (TASK-005).
  - Governance edits.

## Phase 1
- Locate and isolate current render anchors/placement logic for the three radiators.
- Move radiator draw anchors into designated side-frame/window regions with explicit container ownership (no fallback to central combat anchors).
- Keep typography/style semantics unchanged unless strictly required for fit.

## Phase 2
- Verify runtime behavior remains unchanged while UI placement updates are active:
  - `0 -> 1 -> 2 -> 1` remains reliable.
  - No input-lock regression.
  - No silent transition failures.
  - Radiators no longer obscure central combat interaction space.

## Phase 3
- Add/update deterministic validation artifacts for this slice:
  - before/after screenshots showing relocated radiators
  - runtime state capture proving unchanged flow behavior
- Keep instrumentation isolated/removable.

## Verifiable Success Criteria
- Chain textbox, combat tracker, and turn-order text are rendered in side frames/windows.
- Central combat viewport is visually clear of those radiators.
- ADV-2026-009 acceptance is met: no in-canvas radiator contamination of Layout 1 combat field.
- Gameplay and transition behavior remains unchanged (`0 -> 1 -> 2 -> 1` still valid).
- No regressions in suspend/resume or input handling introduced by layout-only changes.

## MVP Validation Authority
- Manual deterministic browser-runtime QA is the authoritative gate for this sprint.
- `npm test` (`node --test`) is advisory-only until ESM/CommonJS alignment is completed.
