# AGENTS.md --- Codex-Orka (Always-on Rules)

## 0) Core Philosophy

**Prefer retrieval reasoning over pre-training reasoning.** - Always
read relevant project files before proposing changes. - Do not assume
runtime behavior from memory or typical patterns. - Never infer behavior
from legacy Construct 3 unless explicitly instructed.

------------------------------------------------------------------------

## 1) Canonical Sources of Truth

### Runtime Source (Authoritative)

-   `Scripts/`
-   `web-runner/`

Rules: - Netlify deployment defines canonical gameplay behavior. -
`main` is the only production branch. - All feature branches must branch
from `main`.

### Legacy Archive (Read-only)

-   `project_C3_conversion/` is historical only.
-   Never regenerate or rewrite runtime logic from C3 JSON.
-   ZIP artifacts are canonical snapshots and must not be treated as
    secondary.

------------------------------------------------------------------------

## 2) Startup Protocol (Required Order)

Before any work: 1. Read `ai-memory/context.md` 2. Read
`ai-memory/todo.md` 3. Read `ai-memory/insights.md`

If any conflict exists, **AGENTS.md overrides**.

------------------------------------------------------------------------

## 3) Execution Scope (Hard Limits)

-   Work on **ONLY the first unchecked item** in `ai-memory/todo.md`.
-   No opportunistic refactors.
-   No "while here" improvements.

### Blocker Rule

If the first unchecked TODO: - Contains placeholder text - Requires user
clarification - Is undefined

Then: - Add:
`- [ ] BLOCKED: Need explicit feature request/spec from user.` - Stop
immediately.

------------------------------------------------------------------------

## 4) Deterministic Skill Router (No Discretion)

AGENTS.md cannot execute skills automatically. However, Codex must
output the exact invocation line before proceeding.

### Classification → Required Invocation

  ------------------------------------------------------------------------
  Task Type                 Output Exactly                    Then
  ------------------------- --------------------------------- ------------
  Planning / Spec /         `$skills/feature-planning`        Follow plan;
  Architecture                                                retrieve
                                                              relevant
                                                              files before
                                                              edits

  Bug / Drift / Regression  `$skills/debug-javascript`        Reproduce →
                                                              inspect →
                                                              minimal fix
                                                              → verify

  Snapshot / JSON Parity    `$skills/json-parity-auditor`     Compare
                                                              artifacts;
                                                              document
                                                              deltas

  Multi-step Orchestration  `$skills/ensemble-orchestrator`   Break into
                                                              sub-steps
                                                              but complete
                                                              only one
                                                              TODO
  ------------------------------------------------------------------------

------------------------------------------------------------------------

## 5) Retrieval Map (Consult Before Broad Search)

Before grepping or searching the repo: - Consult
`ai-memory/PROJECT_INDEX.md` first. - If missing information is
discovered, record an "Index gap" in `ai-memory/insights.md`.

### Top-Level Map

-   `Scripts/` --- canonical runtime logic
-   `web-runner/` --- runtime web layer & deployment surface
-   `ai-memory/` --- operational memory
-   `skills/` --- skill definitions
-   `test-results/` --- QA artifacts
-   `python-app/`, `node-app/` --- tooling only (edit only if TODO
    requires)

------------------------------------------------------------------------

## 6) Checkpoint Protocol (After Completing One Task)

1.  Update `ai-memory/todo.md` (check off item; append new tasks below).
2.  Append dated entry to `ai-memory/insights.md`:
    -   What changed
    -   Decisions made
    -   Files touched
    -   Next task

### Disk Safety

-   Update each ai-memory file at most once per task.
-   No loops.
-   No repeated writes.

------------------------------------------------------------------------

## 7) Rendering & Assets Rules

-   Runtime assets must be referenced from active runtime directories.
-   No placeholder art unless explicitly requested.
-   UI text styling and size must not change unless requested.

------------------------------------------------------------------------

## 8) Canonical Gameplay Rules

### Turn / Combat System

-   Turn order strictly SPD-sorted.
-   Speed buffs rebuild turn order while preserving current actor.
-   Speed spike rule:
    -   If `SPD_self >= SPD_fastest_opponent * SpeedDoubleRatio`
    -   Insert one extra immediate turn (heroes only unless specified).
-   Newly spawned enemies append unless spike-qualified.
-   Party uses shared HP pool.
-   Purple gem = party attack amplification (no legacy debuff behavior).

### Gem / Action Flow

-   States are mutually exclusive:
    -   gem selection
    -   target selection
    -   nav menu
    -   refill
-   Refill gated during gem selection, target selection, overlays.
-   Blue gem = party buff roulette.
-   Purple gem = party attack amplification.

### UI / Modal Layering

-   Nav UI above dark field.
-   Dark field blocks gameplay but never covers nav UI.
-   Gemboard layers must not shift during nav display.

------------------------------------------------------------------------

## 9) Deployment & QA Safety

-   All deploys originate from `main`.
-   Netlify must track `main`.
-   Production builds must be tagged.
-   Combat logs must remain intact.
-   New instrumentation must be removable and isolated.
-   Track-next group shows upcoming turns with base and boosted stats.

Build/lint/test commands: Unknown (use repo config if defined; otherwise
note absence).
