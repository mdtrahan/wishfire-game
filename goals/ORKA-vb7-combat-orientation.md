# ORKA-vb7 Combat Orientation Goal

## Goal
Add an explicit direct-combat orientation with two values: `left-wise` keeps heroes left and enemies right; `right-wise` horizontally reflects actor presentation so enemies are left and heroes are right.

## Bead
- `ORKA-vb7`: Add mirrored left-wise/right-wise direct-combat layouts.

## Direct-Entry Contract
- The supported external direct-entry seam is the `combat_orientation` URL query parameter.
- It accepts only the exact values `left-wise` and `right-wise` after trimming and lowercasing.
- Missing, `null`, empty, whitespace-only, and unrecognized values normalize to `left-wise`.
- A fresh combat normalizes and stores orientation once. Re-entering or resuming that combat session preserves its stored orientation; starting a fresh combat re-reads the direct-entry input.
- Orientation is presentation-only session metadata. It is not written to localStorage, durable save data, encounter generation, deterministic SimulationCore packets, or combat-rule state.

## Developer Panel Control
- The developer panel exposes a `Combat Orientation` selector with `Left-wise` and `Right-wise` values.
- Applying a changed orientation while combat is active starts the existing dev combat-refresh path; it does not flip a live frame or preserve transient combat progress.
- Applying it outside combat stages the value for the next combat entry.
- The selected dev value may use the existing session-scoped dev-tool configuration storage, but never durable game/save storage.

## Formation Projection Invariant
Combat orientation uses logical combat-world bounds `[0, layoutW]`, before `worldToCanvas`, layout scaling, letterboxing, CSS sizing, or DPR conversion. `EnemyAreaRect` is enemy-side geometry and is not the reflection boundary.

For the same logical viewport and combatants, every hero, escort, and enemy standing pivot satisfies:

`rightX = layoutW - leftX - 40`

The `-40` world-unit translation moves both right-wise formations left as equal blocks. Heroes keep their canonical Y. Enemies receive one block Y translation equal to `heroFormationMidY - enemySlotGridMidY`, so formation midpoints align without changing enemy internal spacing. The enemy midpoint comes from the fixed combat slot grid, not the currently living roster: a death releases only that slot, survivors never move, and a replacement occupies the released slot. Right-wise anchors derive from the canonical left-wise baseline, never from already reflected or transient animation positions. Slot/display order, dimensions, scale, origin semantics, roster order, and intra-team spacing remain unchanged. Right-wise actor sprite pixels reflect about each oriented pivot so teams face inward and asymmetric art does not retain its left-wise pixel bias; source assets remain unchanged.

## Session And Respawn Behavior
- Orientation stays stable through combat layout suspend/resume, dev-tool combat refresh, and same-session enemy respawn/repositioning.
- A conflicting orientation input cannot flip an already-active combat session.
- Initial spawn, refresh, and respawn consume the same orientation owner.

## Actor-Attached Presentation
- Actor sprite, pointer hit region, selector, HP bar, damage/heal text, status/debuff/ward visuals, and skill/action anchors derive from the same oriented actor anchor.
- Relative x offsets attached to actors reflect with their actor when required for exact mirrored presentation.
- Hero and enemy action paths derive direction from oriented source/target anchors, not hard-coded team-side assumptions.
- At equal animation times, right-wise actor/action x values use the shared reflected-and-translated projection; hero Y remains equal and enemy-attached visuals receive the same enemy block Y translation. Duration, easing, damage timing, and combat outcomes remain equal.
- Cached projectile and skill endpoints are captured from oriented anchors.

## Passing Means
- Both orientations are directly loadable. Right-wise changes only actor-team presentation coordinates: shared reflected/translated X plus enemy-block midpoint alignment on Y.
- Selectors, hit targets, damage/heal text, status visuals, and action animation anchors stay attached to their actors.
- Existing left-wise output is unchanged by default.
- Initiative, turns, targeting ownership, skills, damage, RNG, encounter generation, save state, and all other combat rules remain unchanged.
- Deterministic geometry tests cover 1v1, full 4v3, and sparse/noncontiguous legal slots. For identical roster, slots, and logical viewport, every paired pivot satisfies `leftX + rightX = layoutW - 40` within a declared world-coordinate epsilon; hero Y is equal, enemy internal spacing is equal, and the right-wise team formation midpoints align.
- Deterministic non-regression proves identical actor identities, stats, HP, slots, encounter summary, initiative queue, RNG state, targeting state, and skill state except explicitly named orientation/presentation-coordinate fields.
- Browser proof uses identical combatants, slots, encounter seed, logical/CSS viewport, DPR, and stable idle phase for both orientations; it includes a canonical viewport and a differently scaled/aspect viewport with console errors checked.
- Annotated screenshots label logical bounds, centerline, every actor pivot, and paired reflection measurements. A machine-readable geometry table keyed by actor UID accompanies them.
- Automated proof covers selector/hit-region and action-anchor mirroring; screenshots alone prove standing geometry only.

## Non-Goals
- No team identity swap.
- No combat rebalance, rule change, AI change, new camera behavior, responsive-layout redesign, or asset mirroring.
- No per-actor or per-slot hand-tuned right-wise coordinates; the approved shared X translation and derived enemy-block Y translation are formation-level transforms.
- No source-asset mutation; right-wise facing is a Canvas presentation transform.
- No in-place orientation flip that preserves an active combat session; the dev panel may start a fresh dev combat session in the selected orientation.

## Validation
- Focused orientation/geometry contract.
- Relevant combat presentation, target-selector, orchestration-boundary, and hot-file gates when their owned surfaces are touched; mirrored `functionBank` geometry must change in parity if touched.
- Exact-branch browser QA for both orientations.
- `git diff --check`.

## Rollback
Return direct combat to implicit `left-wise` and remove the orientation wiring/pure reflection seam. Pre-change checkpoint: `checkpoint/combat-recovery-main-20260728` at `29c8b39`.
