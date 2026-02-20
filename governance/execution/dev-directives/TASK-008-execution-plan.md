# TASK-008 Execution Plan

## Objective
Implement a reusable enemy job-skill framework and deliver the initial deterministic skill set for board manipulation and combat effects.

## Scope Boundaries
- In scope (only):
  - Reusable enemy job-skill execution framework.
  - Initial skill implementations:
    - `Drain Buff`: consume all blue gems and grant `DEF` equal to consumed count.
    - `X Out`: destroy gems in both corner-to-corner diagonals.
    - `Wipe`: consume all gems and heal self/allies.
  - Deterministic effect ordering and refill timing compliance.
- Explicit exclusions:
  - no layout transition-flow edits
  - no unrelated UI redesign
  - no unrelated combat-system refactors

## Phase 1
- Introduce/extend enemy skill execution surface so skills resolve through one reusable framework path.
- Bind the three TASK-008 skills to enemy action flow without altering unrelated turn-state contracts.

## Phase 2
- Implement each skill effect with deterministic ordering:
  - board mutation first
  - combat stat/heal effects next
  - refill sequencing consistent with existing end-of-turn refill rules
- Ensure no cross-scope mutation outside TASK-008 skill paths.

## Phase 3
- Validate deterministic behavior with repeatable captures:
  - skill trigger trace order
  - board before/after state for each skill
  - refill/turn boundary sequencing after skill effects
- Publish closure artifacts under:
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task008/`

## Verifiable Success Criteria
- Enemy skill framework executes all three TASK-008 skills through one reusable path.
- `Drain Buff` grants `DEF` exactly equal to consumed blue gem count.
- `X Out` removes both diagonal sets only.
- `Wipe` consumes all gems and applies intended ally/self heal effect.
- Skill resolution order and refill timing are deterministic across repeated runs.
