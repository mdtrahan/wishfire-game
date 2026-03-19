id: ORKA-3m8
title: [BUG] Yellow match completion can grant an improper extra hero turn
priority: P0
status: done

## Objective
Stop yellow match completion from producing an extra hero turn or duplicate turn advance after the yellow sequence finishes.

## Scope
- Fix the yellow completion handoff and deferred advance gating only.
- Keep yellow fill order, gold award, and refill behavior intact.
- Preserve normal hero turn ownership and selector behavior after yellow completion.

## Owner Seam
- Primary: `web-runner/app.js`
- Specifically:
  - yellow sequence completion / handoff
  - deferred advance resolution
  - turn-gate intent application around yellow completion

## Non-Goals
- No yellow animation retune.
- No gold reward rebalance.
- No refill color-target rule changes.
- No initiative system redesign.
- No dev-panel or manual turn-selection behavior changes.

## Acceptance
- Resolving a yellow match causes at most one valid turn handoff.
- Yellow completion does not create an extra hero action, duplicate selector handoff, or repeated `AdvanceTurn` sequence.
- Turn ownership after yellow completion matches the same expected actor order as a non-yellow completion.
- Gold award / merge flow still resolves correctly.

## Testing
- Add a focused deterministic contract for yellow completion + turn handoff.
- Cover at least:
  - yellow completion with deferred advance pending
  - yellow completion with gold merge flow present
  - no duplicate `AdvanceTurn` / no extra hero action after resolution
- Run the focused contract plus the existing yellow regression pack.

## Notes
- This bead is about post-yellow turn gating, not the yellow refill target table in `src/core/yellowRefillRules.mjs`.
