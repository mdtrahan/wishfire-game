# 01 — Fresh adventure

**Goal:** A new player begins with four Lv1 heroes, zero earned EXP and an empty lamp cache.

## Proposed rules

- New Adventure clears arrival, lamp and dismantle caches. It starts Auto OFF and locked under the approved gate.
- An ordinary reload preserves earned progress and stored items. It generates no gear or EXP by itself. Eligible Auto can resume only when the player previously enabled it.
- Keep QA seeds explicit and visibly identified. Audit canonical hero keys and runtime aliases so all four heroes receive each reward exactly once.
- Combat and hero panels use the same level and stat source. Starter equipment, if retained, is separately defined and never masquerades as lamp arrivals.

## Acceptance

Record a fresh launch showing every hero at Lv1 and cache count zero. Leave it untouched for 30 seconds: no arrivals or EXP. One permitted manual draw produces exactly one stored item and one reward for each hero. Reload and show the earned state persists without extra rewards. Verify both fresh and returning saves.

## Dependencies and approval

Coordinate with skill gates and EXP pacing. Owner must approve treatment of existing high-level saves and any starter equipment. This proposal does not silently reset a player's existing adventure.
