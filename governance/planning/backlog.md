## Sprint Next Up
- TASK-009 Map button route to overworld layout.

## Spike Priority Queue
- TASK-011 Agile Spike: Non-destructive gem refill slot assignment safety.
  - Status: CLOSED (PM override PASS from QA signal; no new BLOCKER/CRITICAL evidence).

## Blocked Feature Backlog
- TASK-006 Deterministic transition scenario suite (`0 -> 1 -> 2 -> 1`) with suspend/resume assertions.
  - Status: BLOCKED (de-scoped from active sprint).
  - Blocker:
    - Current route depth is insufficient for passable transition-depth suspend/resume validation.
    - Available routes are effectively one-outcome transitions (`0 -> 1`, `2 -> 1`) with tick-critical runtime concentrated in Layout 1.
  - Re-entry Condition:
    - Add additional layout routes/depth enabling meaningful multi-branch transition/timer-resume verification.

## Design Input Policy
- The user/CEO will provide visual mockups when a sprint task requires UI/UX design guidance.
- On task activation, Lead must ingest provided mockups before finalizing execution packet details for layout/UI behavior.

## Feature Backlog (Rewritten)
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
