# TASK-015 Execution Plan

## Objective
Implement a Layout 1 story-card slot as output-only UI that mirrors the exact latest combat debug/action line as a single live line (no cache/stack), with lightweight placeholder animation.

## Scope Boundaries
- In scope (only):
  - Add/update one story-card slot UI surface in Layout 1.
  - Bind display to the latest combat debug/action line authority.
  - Keep it single-line live output with placeholder animation only.
- Explicit exclusions:
  - no combat math or turn-flow logic changes
  - no transition contract changes
  - no layout registration policy changes
  - no log history stack, queue, cache, or replay implementation

## Phase 1
- Identify canonical runtime source for "latest combat debug/action line".
- Define deterministic output contract:
  - one active line only
  - replacement update semantics (latest line overwrites prior line)
  - Layout 1-only rendering scope

## Phase 2
- Implement story-card slot output wiring per Phase 1 contract.
- Add lightweight placeholder animation on line update.
- Ensure no additional retained history is introduced.

## Phase 3
- Produce deterministic validation artifacts proving:
  - line mirrors latest action/debug output
  - exactly one live line is shown at all times
  - no cache/stack behavior is present
  - no unrelated runtime/gameplay behavior changed

## Verifiable Success Criteria
- Story-card slot in Layout 1 reflects the latest action/debug line in real time.
- Display remains single-line output-only with overwrite behavior.
- Placeholder animation runs on update without affecting gameplay logic.
- Validation artifacts are published with explicit PASS/FAIL recommendation.

## Corrective Packet (QA Reopen)
Status: PARTIAL PASS (reopen required)

Observed gaps from QA:
- location is incorrect
- dimensions are incorrect
- slot/flip animation not visible

Corrective scope (Layout 1 only):
- Re-anchor story-card slot using relational layout logic (no hard-coded drift-prone absolute placement).
- Required placement contract:
  - horizontal alignment: match gemboard/nav content column alignment
  - vertical band: render between buff-slot row and gemboard top edge
  - must not overlap hero/enemy combat field, hp bar, or gemboard cells
- Required dimension contract:
  - width tied to gemboard content width
  - height fixed to story-card band spec for one-line output + animation readability
  - deterministic margins/padding relative to adjacent HUD bands
- Required animation contract:
  - visible placeholder flip/slot animation on line replacement
  - animation must trigger on update and settle cleanly (no persistent jitter)
  - no cached line stack; latest line only

Corrective validation artifacts (required):
- Layout 1 screenshot at idle with slot correctly placed and sized.
- Layout 1 screenshot/frame sequence showing visible flip/slot update animation.
- Deterministic trace proving:
  - latest-line overwrite semantics
  - no stacked/cached prior lines
  - placement bounds remain inside designated band across updates.

## Regression Containment Addendum (QA FAIL)
Status: FAIL (reopen required)

New failures observed:
- Story card renders in wrong position at Layout 1 start.
- Story card later repositions only after blue-gem hero-buff interaction (invalid trigger coupling).
- Corrected placement still under-scaled; required width target not met.
- Yellow refill behavior regressed:
  - lost deterministic left-to-right then top-to-bottom refill order
  - yellow-specific refill animation path not visible (falls back to regular presentation)

Mandatory corrective acceptance (sprint-blocking for TASK-015):
- Trigger contract:
  - Story card placement/size state must initialize when Layout 1 becomes active.
  - Story card placement must not depend on hero/enemy turn phase, gem color match, buff events, or arbitrary combat events.
- Placement/size contract:
  - Card horizontally centered in its designated band.
  - Card width target: approximately 95% of viewport content width for that band.
  - Card must remain in designated band between buff row and gemboard top and never overlap combat field.
- Regression restoration contract (must remain intact after TASK-015 changes):
  - Yellow refill write order remains deterministic row-wise: left-to-right, then top-to-bottom.
  - Yellow gem match uses yellow-sequence animation frames (not regular refill presentation).
  - No new refill leaks or behavior coupling introduced by story-card logic.

Required artifact packet for re-close attempt:
- `layout1-start.png`: confirms correct initial card placement/scale on first Layout 1 frame.
- `layout1-post-blue-match.png`: confirms card does not re-anchor/re-scale based on blue-buff event.
- `storycard-placement-trace.json`: includes trigger source showing Layout 1 activation authority.
- `yellow-refill-order-trace.json`: slot write sequence proving row-wise order.
- `yellow-animation-trace.json` plus frame captures proving yellow-sequence path execution.
- `assertions-regression-guard.json`: PASS/FAIL checks for all above contracts.

## Visual Tuning Addendum (Post-QA Functional PASS)
Status: PARTIAL PASS (visual typography adjustment pending)

Adjustment scope (only):
- Increase story-card line font size to match readability target demonstrated in QA sample.
- Keep copy/content unchanged (no additional descriptive text).
- Keep story-card placement, width, trigger contract, and refill behavior unchanged.

Acceptance contract:
- Story-card text is visibly larger and readable at the target size.
- Text remains single-line latest-output behavior (overwrite semantics unchanged).
- No card re-anchoring, re-scaling, or trigger-coupling regressions reintroduced.
- No yellow refill order/animation regressions reintroduced.

Required closure artifacts:
- `storycard-font-before-after.png` (clear side-by-side/paired evidence).
- `storycard-font-assertions.json` including:
  - font-size value before and after
  - confirmation that card bounds/anchor are unchanged
  - confirmation that output semantics remain latest-line overwrite only.
