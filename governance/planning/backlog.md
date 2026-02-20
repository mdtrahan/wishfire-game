## Sprint Next Up
- TASK-006 Deterministic transition scenario suite (`0 -> 1 -> 2 -> 1`) with suspend/resume assertions.

## Design Input Policy
- The user/CEO will provide visual mockups when a sprint task requires UI/UX design guidance.
- On task activation, Lead must ingest provided mockups before finalizing execution packet details for layout/UI behavior.

## Feature Backlog (Rewritten)
- TASK-007 End-of-turn gem refill reliability
  - Objective: Gem autofill must execute at end-of-turn immediately, never delayed to a later turn.
  - Rules:
    - Exactly one action cycle triggers one refill cycle.
    - Refill skips only when there are zero valid empty slots.
  - Acceptance:
    - No turn can end with pending refill work that rolls into the next turn.
    - Refill behavior is deterministic across repeated runs.

- TASK-008 Job-skill framework + enemy board-manipulation skills
  - Objective: Add a reusable job-skill system that supports enemy skills interacting with gems, buffs, and combat outcomes.
  - Initial skill set:
    - `Drain Buff`: consume all blue gems; gain `DEF` equal to consumed count; if zero consumed then zero gained; refill at end of that enemy turn.
    - `X Out`: destroy gems in both corner-to-corner diagonals (X pattern); refill afterwards.
    - `Wipe`: consume all gems; heal self and allies; refill afterwards.
  - Acceptance:
    - Skill effects resolve in deterministic order.
    - Gem destruction and refill timing follow end-of-turn refill rules.

- TASK-009 Map button route to overworld layout
  - Objective: `Map` text button opens a dedicated map layout (not modal behavior).
  - Scope:
    - Pannable/swipe-draggable overworld map.
    - Landmarks/milestones as progression nodes.
    - Top-center red-vs-blue balance-of-power meter.
  - Acceptance:
    - Map opens as a layout transition, not a modal overlay.
    - Player can pan to inspect full map area on desktop and mobile.

- TASK-010 Tower war-beacon system (weekly war-cycle)
  - Objective: Implement faction-war tower loop tied to story progression and resource economy.
  - Core behavior:
    - Towers have faction ownership progress bars.
    - Enemy generals can occupy towers; hero interruption triggers tower battle (minions + occupying general).
    - Capturing towers grants war points and occupation-window rewards (gold/energy/etc) if uninterrupted.
    - Claiming all towers unlocks final campaign landmark (win/loss outcome).
    - War scenario resets weekly with randomized general-to-tower assaults.
  - Acceptance:
    - Tower control, interruption battles, rewards, and weekly reset run deterministically.
    - War meter reflects aggregate faction dominance throughout the cycle.

## Deferred Remediation Candidates
- ADV-2026-002 (High) - deferred under remediation cap.
- ADV-2026-003 (High) - deferred under remediation cap.
- ADV-2026-004 (Medium) - deferred under remediation cap.
