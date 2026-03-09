id: ORKA-lpb
title: [UI] Add Layout 0 loading/progress bar for startup asset readiness
priority: P1
status: done

## Objective
Provide explicit startup loading feedback on Layout 0 while runtime assets initialize.

## Scope
- Add a visible loading/progress bar on Layout 0.
- Reflect staged boot progress (critical assets first, deferred follows).
- Keep combat/runtime behavior unchanged.

## Acceptance
- Player sees loading/progress feedback immediately on startup.
- Progress updates during boot and reaches completion before combat transition.
- No regressions to current startup flow.

## Completion Note (2026-03-08)
- Added startup loading/progress bar rendering on pre-bootstrap Layout 0 canvas path.
- Wired staged startup progress updates through layout/object/enemy/critical/core/finalization phases.
- Finalized progress to 100% and disabled loading overlay at runtime readiness.
