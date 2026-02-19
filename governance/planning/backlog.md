## Sprint Next Up
- TASK-005 Remove speed buff from Blue Gem buff system
  - Objective: Remove SPD buff effect path to stabilize turn-based integrity and simplify growth/IAP balance surface.
  - Scope:
    - Remove Blue-gem speed buff outcome from buff roulette logic.
    - Remove speed buff icon usage.
    - Collapse buff slots from 5 to 4 (`ATK`, `DEF`, `MAG`, `RES` only).
  - Constraints:
    - No other gameplay logic changes.
    - No unrelated visual redesign.
    - No transition-flow edits.
  - Acceptance:
    - Blue gem no longer produces SPD buff.
    - No SPD buff icon appears.
    - Buff display/slot system shows exactly 4 party buff slots (`ATK/DEF/MAG/RES`).

## Next Feature Candidates
- TASK-006 Deterministic transition scenario suite (`0 -> 1 -> 2 -> 1`) with suspend/resume assertions.

## Deferred Remediation Candidates
- ADV-2026-002 (High) - deferred under remediation cap.
- ADV-2026-003 (High) - deferred under remediation cap.
- ADV-2026-004 (Medium) - deferred under remediation cap.
