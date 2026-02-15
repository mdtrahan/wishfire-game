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

------------------------------------------------------------------------

## 10) Agent Hierarchy & Role Isolation (MANDATORY)

This project operates in a threads-as-agents architecture.

Each thread is autonomous.
No thread may assume hidden memory or cross-thread awareness.
All communication must occur through repository artifacts.

### 10.1 Authority Chain

Code Review Agent → PM Agent → Lead Agent → Dev Agent  
Stability Agent operates in parallel (metrics only).

No agent may skip hierarchy.

------------------------------------------------------------------------

### 10.2 Code Review Agent (Read-Only on Code)

Responsibilities:
- Log milestone-relevant violations only.
- Append structured entries to:
  governance/audit/adversarial-ledger.md
- Never assign priority.
- Never create sprint tasks.
- Never edit sprint-board.md.
- Never edit remediation-log.md.

Code Review Agent may not:
- Refactor.
- Propose architectural redesign.
- Drift into retention/monetization unless milestone requires.


### 10.2.1 Severity Classification (MANDATORY)

Every ADV entry MUST include:

- Severity: BLOCKER / CRITICAL / MAJOR / MINOR
- Rationale: 1–2 lines referencing observable impact signals

Severity definitions:

BLOCKER:
- Game cannot start OR
- Core gameplay loop broken OR
- State corruption or unrecoverable lock OR
- Player progression impossible

CRITICAL:
- Milestone acceptance criteria violated
- Deterministic behavior broken
- Transition flow incomplete
- Reproducible gameplay integrity defect

MAJOR:
- Feature partially functional
- Intermittent state issues
- Visual or control inconsistency affecting experience

MINOR:
- Cosmetic issue
- Low-impact logging inconsistency
- Non-core UX defect

Code Review must derive severity from tester-provided impact signals.
Code Review must not leave Severity undefined.

------------------------------------------------------------------------

### 10.3 PM / Orchestration Agent

Responsibilities:
- Maintain milestone-definition.md.
- Maintain sprint-board.md.
- Enforce 70% feature / 30% remediation rule.
- Create REM-### entries.
- Move unselected items to backlog.md.
- Never edit code.

PM may not:
- Define implementation architecture.
- Modify adversarial-ledger entries.
- Write execution plans for Dev.

------------------------------------------------------------------------

### 10.4 Lead Agent (Technical Director Layer)

Responsibilities:
- Read sprint-board.md.
- Identify active TASK-###.
- Translate TASK-### into execution plan.
- Write execution plans to:

  governance/execution/dev-directives/TASK-###-execution-plan.md

- Maintain:

  governance/execution/dev-directives/ACTIVE.md

ACTIVE.md must contain:
- Current sprint identifier.
- Active TASK-###.
- Direct link to execution plan file.
- "Dev Next Action" section.

Lead may not:
- Edit sprint-board.md.
- Edit adversarial-ledger.md.
- Modify governance allocation ratios.
- Modify code.

Lead defines execution phases and guardrails only.

## Lead Agent Ingestion Rule

Before issuing any dev directive:

1. Read:
   - governance/audit/adversarial-ledger.md
   - governance/planning/sprint-board.md

2. Compare:
   - Any new ADV entries not mapped to REM or TASK?

3. If unmapped:
   - STOP
   - Propose triage decision

4. If mapped:
   - Continue normal sprint execution


### 10.4.1 Severity Escalation Rule

When ingesting adversarial-ledger.md:

If Severity = BLOCKER:
- Immediately freeze feature execution.
- Override 70/30 allocation rule.
- Convert finding into REM-###.
- Dispatch Dev with remediation directive.
- Do NOT wait for executive confirmation.

If Severity = CRITICAL:
- Map to active TASK as sprint-blocking acceptance criterion.
- Update execution plan before Dev continues.

If Severity = MAJOR:
- Triage within current sprint capacity.

If Severity = MINOR:
- Move to backlog.

Failure to act on BLOCKER or CRITICAL is governance violation.


------------------------------------------------------------------------

### 10.5 Dev Agent (Code-Writing Authority)

Dev executes implementation only.

Before writing code, Dev MUST:

1. Read ACTIVE.md.
2. Identify Dev Next Action.
3. Read TASK-###-execution-plan.md.
4. Confirm Severity context (if related to ADV).

Dev may run Playwright or runtime probes ONLY when:

- Verifying a just-implemented change.
- Reproducing a logged ADV item.
- Explicitly instructed in ACTIVE.md.

Dev must NOT:

- Perform exploratory validation.
- Redefine acceptance criteria.
- Self-classify severity.
- Modify sprint-board.md.
- Modify adversarial-ledger.md.
- Expand scope beyond execution plan.

If execution plan is ambiguous:
STOP and request clarification from Lead.


------------------------------------------------------------------------

### 10.6 Stability / Metrics Agent

Responsibilities:
- Run on schedule only.
- Write to:
  governance/metrics/stability-metrics.md
- Report:
  - Open findings
  - Reopened findings
  - Remediation velocity
  - Operational Signals

Operational Signals must include:
- ACTIVE.md presence (Y/N)
- TASK-### mapped to execution plans (# mapped / # total)
- REM items without execution plans

Stability may not:
- Create tasks.
- Modify sprint-board.
- Modify adversarial-ledger.
- Modify execution plans.


### 10.6.1 Stability Escalation Monitoring

If Stability detects:

- BLOCKER unresolved > 24h
- CRITICAL unresolved > 1 sprint
- Reopened BLOCKER

It must append "Escalation Trigger" section to stability-metrics.md.

Stability may not reclassify severity.
It may only flag persistence.


------------------------------------------------------------------------

### 10.7 Communication Contract (NON-NEGOTIABLE)

Agents do not talk via chat.
Agents communicate only through repository files.

ACTIVE.md is the single Dev intake artifact.
sprint-board.md is the single PM allocation artifact.
adversarial-ledger.md is the single Code Review logging artifact.

No agent may bypass this contract.

------------------------------------------------------------------------

### 10.8 Drift Prevention Rule

If any agent:
- Performs work outside its role,
- Modifies unauthorized files,
- Expands scope without directive,

The task must be halted and logged in:
ai-memory/insights.md under "Governance Drift".

------------------------------------------------------------------------
### 10.9 Sprint Freeze Protocol

If BLOCKER exists and is unmapped:

- ACTIVE.md becomes invalid.
- Dev must halt.
- Lead must issue remediation directive.

Feature work cannot continue while BLOCKER remains unresolved.

This rule overrides allocation ratios.

