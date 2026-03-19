id: ORKA-6mq
title: [BUG] Entity update fault swallowing can continue invalid runtime state
priority: P0
status: done

## Objective
Stop repeated entity-update faults from silently continuing invalid runtime state by quarantining consistently failing entities and recording stable diagnostics.

## Scope
- Track consecutive update failures in the entity owner seam.
- Quarantine entities after repeated failures instead of retrying them forever.
- Record stable diagnostic keys and trace entries for failing entities.

## Non-Goals
- No gameplay retuning.
- No broad runtime exception framework.
- No automatic entity healing/recovery beyond resetting the failure streak after a successful update.

## Acceptance
- Repeated entity update faults stop after the quarantine threshold.
- Diagnostics record a stable entity key and quarantine record.
- A successful update clears the previous consecutive-failure streak.

## Testing
- Deterministic owner-seam contract coverage.

## Validation
- `npm test -- tests/entityUpdateQuarantineContract.test.js` (2/2 pass)
- `Scripts/entities.js` already quarantines entities after `ENTITY_UPDATE_MAX_FAILURES`, records stable keys into `EntityUpdateTrace` / `EntityQuarantineByKey`, and resets failure streaks after successful updates.
