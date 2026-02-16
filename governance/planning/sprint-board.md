# Sprint X

## Primary Sprint Goal
- Layout 0 startup is the sprint anchor.
- Explicit required flow: `0 -> 1 -> 2 -> 1`.

## Feature Allocation (70%)
- TASK-003 Implement stable combat-layout transition flow with deterministic suspend/resume safety:
  - Layout 0 (Story FTUE) -> click blue -> Layout 1
  - Layout 1 (Puzzle combat) -> click Astral Flow -> Layout 2
  - Layout 2 (red overlay) -> click red -> Layout 1
  - Sprint-blocking acceptance criterion (mapped ADV-2026-005): first `0 -> 1` transition must bootstrap a fully initialized combat render state (no `0 loaded objects` malformed state, nav/combat surfaces present, gameplay interactive).
  - Sprint-blocking acceptance criterion (mapped ADV-2026-007): `1 -> 2` Astral Flow pathway remains reachable under intended combat input states (no silent nav-event gate denial).
  - In-sprint MAJOR quality criterion (mapped ADV-2026-006): Layout 0 displays required full-screen blue takeover contract in normal runtime before `0 -> 1`.
  - Definition of done: `0 -> 1 -> 2 -> 1` reliable, returning to Layout 1 preserves combat integrity, timers suspend/resume correctly, and no input lock, visual layer drift, or state corruption.

## Remediation Allocation (30%)
- REM-2026-001 (Linked ADV-2026-001) - Harness boot sequence reaches runtime loop, input bindings, and tick start in harness mode.

Capacity Rule:
Remediation must not exceed 30% unless Critical.

Allocation Check:
- Planned sprint split: Feature 70% / Remediation 30%
- Cap status: Remediation at 30% (within cap; no override required)
