# TASK-003 Execution Plan

## Objective
Deliver the required deterministic transition flow `0 -> 1 -> 2 -> 1`, with Layout 0 as startup anchor, while preserving combat integrity and suspend/resume correctness.

## Scope Boundaries
- In scope:
  - Normal runtime startup into Layout 0.
  - Stable transition sequence: Story (0) -> Combat (1) -> Astral Overlay (2) -> Combat (1).
  - Suspend/resume correctness and input/visual stability across that sequence.
  - ADV-2026-005 (CRITICAL) mapped criterion: `0 -> 1` must not produce malformed/obstructive Layout 1 presentation.
  - ADV-2026-007 (CRITICAL) mapped criterion: `1 -> 2` Astral Flow pathway must remain reachable under intended combat interaction states (no silent nav-gate denial).
  - ADV-2026-008 (HIGH) mapped criterion: first `0 -> 1` entry must render full required Layout 1 combat composition (no partial/incomplete combat UI state).
- Out of scope:
  - Turn-model redesign or TASK-004 hardening scope.
  - Deterministic scenario-suite expansion (TASK-005).
  - Governance edits.

## Phase 1
- Set and keep normal runtime initial activation on Layout 0 startup path.
- Keep transition entry guards explicit for:
  - `0 -> 1` story blue click
  - `1 -> 2` Astral Flow click
  - `2 -> 1` overlay red click
- Confirm transition targets are registered and allowed in normal runtime.

## Phase 2
- Harden `0 -> 1` combat bootstrap path to guarantee initialized, non-obstructive Layout 1 render/gameplay state on first entry.
- Resolve nav-gate pathway denial so intended Astral Flow interaction can reliably reach `1 -> 2` when transition should be allowed.
- Validate one deterministic `0 -> 1 -> 2 -> 1` loop with:
  - suspend on `1 -> 2`
  - resume on `2 -> 1`
  - no stuck input lock
  - no silent transition rejection
  - no visual layer drift
  - no malformed/oversized obstructive Layout 1 overlays
  - no partial/incomplete Layout 1 combat composition after first `0 -> 1`

## Phase 3
- Add/update regression checks proving repeatable `0 -> 1 -> 2 -> 1` reliability.
- Include targeted coverage for:
  - first-entry `0 -> 1` layout integrity (ADV-2026-005)
  - Astral Flow route reachability `1 -> 2` under intended interaction preconditions (ADV-2026-007)
  - full first-entry Layout 1 combat composition (ADV-2026-008)
- Keep instrumentation isolated/removable.

## Verifiable Success Criteria
- Normal runtime starts in Layout 0.
- First `0 -> 1` transition produces initialized and non-obstructive Layout 1 presentation.
- First `0 -> 1` transition produces fully composed Layout 1 combat UI/surfaces (no partial render state).
- `1 -> 2` Astral Flow transition is deterministically reachable when intended by interaction state.
- `0 -> 1 -> 2 -> 1` executes reliably across repeated runs.
- Suspend/resume preserves combat integrity on return to Layout 1.
- No input lock persistence, no silent failures, no layer drift/state corruption.

## MVP Validation Authority
- Manual deterministic browser-runtime QA is the authoritative gate for this sprint.
- `npm test` (`node --test`) is advisory-only until ESM/CommonJS alignment is completed.
