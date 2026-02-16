## Backlog Priority (Post Primary Sprint Goal)
- Priority 1 after `TASK-003`: TASK-004 (turn-state source/snapshot/post-resume validation hardening).
- Priority 2 after `TASK-003`: TASK-005 (deterministic transition scenario suite).
- Priority 3 after `TASK-003`: deferred ADV remediation candidates `ADV-2026-002`, `ADV-2026-003`, `ADV-2026-004` (under remediation cap governance).

## Deferred Adversarial Findings (Sprint X Triage)

### Theme: Transition target mismatch / layout registration integrity
- ADV-2026-002 (High)
  - Rationale: Deferred due to 30% remediation cap; selected Critical ADV-2026-001 for current sprint slot.
  - Milestone Alignment: Pending (milestone-definition.md is currently empty).

### Theme: Turn-model snapshot authority mismatch
- ADV-2026-003 (High)
  - Rationale: Deferred due to 30% remediation cap; selected Critical ADV-2026-001 for current sprint slot.
  - Milestone Alignment: Pending (milestone-definition.md is currently empty).

### Theme: Non-deterministic combat bootstrap
- ADV-2026-004 (Medium)
  - Rationale: Deferred due to cap and lower severity than selected item.
  - Milestone Alignment: Pending (milestone-definition.md is currently empty).

## Deferred Feature Tasks (Sprint Containment)
- TASK-004 Define authoritative turn-state source of truth, suspend/resume snapshot structure, and deterministic post-resume validation checkpoints; instrument validation only, with no transition contract enforcement, no layout registration policy changes, and no atomic transition queue refactors.
- TASK-005 Add deterministic transition scenario suite (fixed-seed bootstrap plus transition/resume assertions) mapped to milestone Definition of Done criteria.
