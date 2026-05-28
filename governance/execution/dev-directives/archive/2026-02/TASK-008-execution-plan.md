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
  - Enemy skill assignment coverage for QA:
    - Primary casters: `Djinn` and `Marid`.
    - Third caster target: `Chimerilass` (selected as available high-MAG caster).
    - If caster assignment ever drops below three targets, double-assign remaining skill on highest-MAG caster.
  - Enemy action decision model:
    - Randomize regular attack vs special skill using the same chance model/ratio pattern already used by Chimerilass self-heal behavior.
  - Deterministic effect ordering and refill timing compliance.
  - Buff-only status semantics:
    - skills may remove/consume opponent buffs
    - effects may apply positive outcomes to self/allies
    - no negative-status/debuff layer
- Explicit exclusions:
  - no layout transition-flow edits
  - no unrelated UI redesign
  - no unrelated combat-system refactors

## Phase 1
- Introduce/extend enemy skill execution surface so skills resolve through one reusable framework path.
- Bind the three TASK-008 skills to enemy action flow without altering unrelated turn-state contracts.
- Implement assignment as data-driven mapping (enemy -> approved skills) so rollout is limited to approved enemies now, while keeping generic reuse for later enemies.

## Phase 2
- Implement each skill effect with deterministic ordering:
  - board mutation first
  - combat stat/heal effects next
  - refill sequencing consistent with existing end-of-turn refill rules
- Apply QA-targeted assignment set:
  - `Djinn`, `Marid`, `Chimerilass` must collectively cover `Drain Buff`, `X Out`, `Wipe`.
  - Preserve buff-only status semantics.
- Gate enemy action choice with the existing Chimerilass self-heal chance ratio pattern for regular attack vs special skill.
- Ensure no cross-scope mutation outside TASK-008 skill paths.

## Phase 3
- Validate deterministic behavior with repeatable captures:
  - skill trigger trace order
  - enemy-to-skill assignment map used at runtime
  - special-vs-regular action decision traces using the required chance model pattern
  - board before/after state for each skill
  - refill/turn boundary sequencing after skill effects
- Publish closure artifacts under:
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task008/`

## Verifiable Success Criteria
- Enemy skill framework executes all three TASK-008 skills through one reusable path.
- Approved rollout assignments are active and testable on `Djinn`, `Marid`, and `Chimerilass`.
- `Drain Buff` grants `DEF` exactly equal to consumed blue gem count.
- `X Out` removes both diagonal sets only.
- `Wipe` consumes all gems and applies intended ally/self heal effect.
- Regular-attack vs special-skill selection uses the same chance model/ratio pattern as Chimerilass self-heal behavior.
- Skill resolution order and refill timing are deterministic across repeated runs.
- Skill outcomes never apply direct or derived debuff/negative status effects.
- Allowed result shapes are restricted to:
  - opponent buff removed -> self/allies gain positive effect, or
  - opponent buff removed/discarded with no negative-status application.

## Lead Closure Gate (2026-02-20)
- Verdict: PARTIAL PASS (REOPENED)
- Reopen rationale:
  - New QA signal reports initial refill visual state swap/frame jumping contamination, with yellow-gem behavior suspected in non-yellow regular refill path.
  - Closure is reopened pending deterministic proof that regular refill has zero frame/state jump side effects.
- Corrective packet (scope-locked):
  - Step 1: Reproduce and isolate initial-fill state swap path with explicit yellow-vs-non-yellow refill branch traces.
  - Step 2: Apply minimal fix ensuring non-yellow regular refill never causes frame jump/state swap; preserve intended yellow-specific behavior only where explicitly triggered by yellow match logic.
  - Step 3: Publish deterministic artifacts under `/Users/Mace/Wishfire/Codex-Orka/test-results/task008/` proving:
    - no frame/state jump on regular non-yellow refill
    - no yellow-path contamination during regular refill
    - stable before/after slot/frame states across startup and first refill window

## Lead Reopen Closure Gate (2026-02-20)
- Verdict: PASS
- Basis:
  - Reopen corrective artifacts are present and pass:
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task008/reopened-refill-assertions.json`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task008/reopened-refill-trace.json`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task008/reopened-repro-post.json`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task008/reopened-repro-console.log`
    - `/Users/Mace/Wishfire/Codex-Orka/test-results/task008/reopened-repro-frame.png`
  - Assertion checks pass for:
    - non-yellow resolve anchor detection
    - zero yellow-sequence markers after non-yellow anchor
    - board remains populated after action (no wipe contamination)
- Note:
  - Dev message referenced `reopened-repro-start.json`; file is absent at that exact path, but available trace/log/post-state evidence is sufficient for closure.
