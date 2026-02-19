# TASK-005 Execution Plan

## Objective
Remove speed buff from the Blue Gem buff system while preserving all non-speed buff behavior and avoiding unrelated runtime changes.

Observed validation failure to clear in this plan:
- Post-transition Layout 1 still shows a 5th buff visual slot (grey backer + shield icon) before any blue-buff trigger.
- New FAIL (Layout 1): blue-trigger path still yields SPD behavior (wings icon + `BUFF SPD=2/20` + turn-order `(+2)`), proving residual SPD execution path remains active.

## Scope Boundaries
- In scope (only):
  - Establish canonical Layout 1 buff icon-label parity mapping (icon asset/frame to `ATK/DEF/MAG/RES`) and validate against runtime text labels.
  - Remove Blue-gem SPD buff outcome from buff roulette logic.
  - Remove residual `SPD_UP` blue-buff execution paths in both runtime trees: `Scripts/` and `web-runner/modules/`.
  - Remove SPD buff icon/text usage from runtime/UI paths.
  - Collapse party buff slots from 5 to 4 for `ATK/DEF/MAG/RES` only.
  - Enforce zero-active-buff visual baseline at startup (no pre-trigger buff icon/text display).
  - Remove slot-5 buff visual artifact(s) entirely (icon and backer).
- Acceptance-validation scope is Layout 1 only.
- Explicit exclusions:
  - no other gameplay logic changes
  - no unrelated visual redesign
  - no transition-flow edits
  - no layout registration or transition-contract edits
  - no TASK-005 failure triage on Layout 0/2

## Phase 1
- Build parity table for Layout 1 buff visuals:
  - icon container id
  - rendered frame index/asset source
  - resolved label text (`BUFF XXX=*`)
  - expected stat mapping
- Flag and correct any icon-label mismatch before declaring SPD removal complete.
- Remove SPD selection path from Blue-gem buff roll outcome generation in both `Scripts/` and `web-runner/modules/`.
- Ensure Blue-gem buff roll can emit only `ATK/DEF/MAG/RES`.
- Remove/disable residual `ExecuteSkill(... 'SPD_UP' ...)` blue-buff reachability in both runtime trees.

## Phase 2
- Remove SPD buff icon/text rendering/selection usage in runtime drawing and state-backed mapping for all slots on Layout 1.
- Normalize party buff slot/state structures to 4-slot behavior (`ATK/DEF/MAG/RES`) with no 5th-slot fallback.
- Ensure slot 5 cannot render in any startup or runtime path (no icon and no grey backer square).
- Remove residual `buffIcon5` runtime object/type/layout artifact sources so only four buff-icon containers can exist in rendered output.
- Enforce startup render gating so buff visuals require active buff state (not default frame fallbacks).
- Ensure Layout 1 turn-order/debug text no longer reflects party SPD buff deltas introduced by blue-buff flow.

## Phase 3
- Validate deterministic acceptance:
  - Icon-label parity is consistent on Layout 1 (`ATK/DEF/MAG/RES` icons match corresponding `BUFF` labels).
  - Blue gem never emits SPD buff.
  - No SPD buff icon/text appears.
  - No `BUFF SPD=*` text appears after blue trigger.
  - No party speed-buff delta (e.g. `(+2)`) appears in Layout 1 turn-order output due to blue buff.
  - No buff icon/text appears at startup before any valid blue-buff trigger.
  - Slot 5 visual/backer is absent at all times.
  - Buff display/slot system shows exactly 4 party buff slots (`ATK/DEF/MAG/RES`).
- Required artifacts:
  - Layout 1 icon-label parity artifact (table or trace) covering all four buff outcomes.
  - Startup screenshot after entering Layout 1 with zero valid blue triggers (PASS baseline retained).
  - Post-blue-trigger screenshot on Layout 1 proving no SPD icon/text.
  - Runtime trace proving rendered buff-slot container count = 4, no `buffIcon5` draw path, and no `SPD_UP` blue route invocation.
- Capture validation artifacts for closure review.

## Execution Packet (Current Dispatch)
- Packet Step 1:
  - Generate Layout 1 icon-label parity evidence and correct mismatches.
- Packet Step 2:
  - Remove Blue-gem SPD outcome/execution path and SPD icon/text/effect usage on Layout 1; enforce 4-slot party buff structures and eliminate slot-5 icon/backer artifacts.
- Packet Step 3:
  - Run deterministic Layout 1 acceptance validation only and record required parity/startup/post-trigger/runtime-trace artifacts.

## Verifiable Success Criteria
- Blue gem no longer produces SPD buff.
- Blue-trigger path cannot invoke `SPD_UP` in either `Scripts/` or `web-runner/modules/`.
- Layout 1 icon-label parity is verified and documented (`ATK/DEF/MAG/RES`).
- SPD buff icon/text is absent from runtime behavior across all buff slots.
- Layout 1 shows no speed-buff side effects (`BUFF SPD=*`, turn-order `(+SPD)` deltas) from blue buffs.
- Party buff display/state exposes exactly 4 slots: `ATK`, `DEF`, `MAG`, `RES`.
- Startup presents no active buff icon/text until a valid blue-buff trigger occurs.
- Slot 5 buff visual/backer does not exist in runtime behavior.
- No unrelated gameplay, visual, or transition-flow behavior is modified.
