# AGENTS.md --- Codex-Orka (Always-on Rules)

## 0) Core Philosophy
- Prefer retrieval over memory.
- Read relevant project files before proposing edits.
- Do not infer behavior from legacy Construct 3 unless explicitly instructed.

## 1) Canonical Sources
### Runtime (authoritative)
- `Scripts/`
- `web-runner/`
- Netlify deployment behavior is canonical.
- `main` is production branch and branch base.

### Legacy (read-only)
- `project_C3_conversion/` is historical only.
- Do not regenerate runtime logic from C3 JSON.
- ZIP artifacts are canonical snapshots.

## 2) Startup Protocol (required order)
1. Read `ai-memory/context.md`
2. Read `ai-memory/todo.md`
3. Read `ai-memory/insights.md`
- If conflict exists, `AGENTS.md` wins.

## 3) Execution Scope
- Work only the first unchecked item in `ai-memory/todo.md`.
- No opportunistic refactors or “while here” extras.

### Blocker Rule
If first unchecked TODO is placeholder/undefined/needs clarification:
- Add `- [ ] BLOCKED: Need explicit feature request/spec from user.`
- Stop immediately.

## 4) Deterministic Skill Router
Output the invocation line before proceeding.
- Planning/spec/architecture: `$skills/feature-planning`
- Bug/drift/regression: `$skills/debug-javascript`
- Snapshot/JSON parity: `$skills/json-parity-auditor`
- Multi-step orchestration: `$skills/ensemble-orchestrator`

## 5) Retrieval Map
- Consult `ai-memory/PROJECT_INDEX.md` before broad search.
- If missing info discovered, record `Index gap:` in `ai-memory/todo.md` (not `insights.md`).
- Top-level map:
  - `Scripts/`, `web-runner/`, `ai-memory/`, `skills/`, `test-results/`
  - `python-app/`, `node-app/` are tooling-only unless TODO requires edits.

### 5.1 Doc Retrieval Short-Circuit (token control)
- For PM/Lead documentation work, read canonical files first and avoid repo-wide scans unless blocked:
  - `ai-memory/context.md`, `ai-memory/todo.md`, `ai-memory/insights.md`, `ai-memory/project.md`
  - `governance/planning/sprint-board.md`, `governance/planning/backlog.md`, `governance/planning/milestone-definition.md`, `governance/planning/roadmap.md`
  - `governance/execution/dev-directives/ACTIVE.md` and currently active/blocked `TASK-###-execution-plan.md` only
- Treat root-level legacy duplicates (`context.md`, `todo.md`, `insights.md`) as deprecated non-canonical.
- Completed execution plans should be moved to `governance/execution/dev-directives/archive/YYYY-MM/` to keep active directive scans small.

## 6) Checkpoint Protocol (after each task)
1. Update `ai-memory/todo.md`
2. Update role artifacts only (for example `ACTIVE.md`, execution plan, sprint-board, backlog, remediation log, metrics, test artifacts).

### Disk Safety
- Update each ai-memory file at most once per task.
- No loops/repeated writes.
- `todo.md`: queue-style (one active unchecked at top + short done list).
- `insights.md`: decisions log only, not transcript.
- Verbose traces belong in runtime/governance artifacts.
- `insights.md` must contain high-impact process or product decisions only (no sync chatter, no status replay).
- `insights.md` write authority: PM and Lead only.
- Dev/Stability must not append to `insights.md`; route operational detail to task/governance artifacts.

## 7) Rendering & Assets
- Use active runtime directories for assets.
- No placeholder art unless explicitly requested.
- Do not alter UI text styling/size unless requested.

## 8) Canonical Gameplay Rules
### Turn / Combat
- Turn order strictly SPD-sorted.
- Speed buffs rebuild turn order while preserving current actor.
- Speed spike rule:
  - If `SPD_self >= SPD_fastest_opponent * SpeedDoubleRatio`, insert one extra immediate turn (heroes only unless specified).
- Newly spawned enemies append unless spike-qualified.
- Party uses shared HP pool.
- Purple gem = party attack amplification (no legacy debuff behavior).

### Gem / Action
- States are mutually exclusive: gem selection, target selection, nav menu, refill.
- Refill gated during gem selection, target selection, overlays.
- Blue gem = party buff roulette.
- Purple gem = party attack amplification.

### Status Effect Policy (combat skills)
- Buff transfer/consumption semantics only.
- Allowed:
  - remove opponent buff
  - remove opponent buff and apply equivalent positive effect to self/allies
  - remove opponent buff and convert to self/allies benefit (for example, heal)
  - consume/discard buff without negative-status application
- Forbidden:
  - direct negative status/debuff application
  - derived stat-down/debuff states on heroes or enemies
- No Final-Fantasy-style negative status layer.

### UI / Modal Layering
- Nav UI above dark field.
- Dark field blocks gameplay but never covers nav UI.
- Gemboard layers must not shift during nav display.

### Layout Container Isolation
- Layouts are strict containers.
- Objects owned by Layout `N` are non-present in Layout `M` (`M != N`) unless task says otherwise.
- Globals are the only allowed cross-layout scope unless task says otherwise.
- Do not add speculative cross-layout checks unless the active TASK requires it.

## 9) Deployment & QA Safety
- Deploys from `main` only.
- Netlify tracks `main`.
- Production builds must be tagged.
- Keep combat logs intact.
- New instrumentation must be isolated/removable.
- Track-next group must show upcoming turns with base + boosted stats.
- Build/lint/test commands: use repo config if defined; otherwise note absence.

## 10) Agent Hierarchy & Role Isolation
- Threads-as-agents architecture.
- No hidden cross-thread memory assumptions.
- Repository artifacts are the only communication channel.

### 10.1 Authority Chain
- PM -> Lead -> Dev
- Stability runs in parallel for metrics only.
- No hierarchy skipping.

### 10.2 Lead-Owned Review Function
No separate Code Review Agent. Lead owns review/severity/verdict authority.
- Lead review responsibilities:
  - Log milestone-relevant violations only.
  - Append to `governance/audit/adversarial-ledger.md`.
  - Never assign priority.
  - Never create sprint tasks.
  - Never edit `sprint-board.md` or `remediation-log.md`.
- Lead review must not refactor/re-architect/drift into monetization unless milestone requires.

#### Severity (mandatory)
Every ADV entry must include:
- Severity: BLOCKER / CRITICAL / MAJOR / MINOR
- Rationale: 1-2 lines with observable impact.

Definitions:
- BLOCKER: startup failure, core loop broken, unrecoverable lock/corruption, progression impossible.
- CRITICAL: milestone criteria violated, deterministic behavior broken, transition flow incomplete, reproducible integrity defect.
- MAJOR: partially functional feature, intermittent state issues, meaningful UX/control inconsistency.
- MINOR: cosmetic or low-impact non-core defect.

Verdict options:
- PASS / FAIL / PARTIAL PASS
- PASS requires:
  - no open BLOCKER
  - no open CRITICAL tied to task
  - milestone criteria satisfied
  - related ADV entries explicitly closed

### 10.3 PM / Orchestration
- PM maintains milestone-definition/sprint-board, enforces 70/30 split, creates REM items, moves unselected to backlog.
- PM never edits code.
- PM may not define implementation architecture or edit adversarial ledger.
- PM marks TASK complete only after Lead PASS.
- PM keeps planning artifacts minimal and operational:
  - `sprint-board.md`: sprint goal, active WIP (3-5 max), blockers, allocation check.
  - `backlog.md`: ordered queue of ready/blocked/deferred items only.
  - Historical narrative belongs in audit/regression artifacts, not sprint-board/backlog.

### 10.4 Lead / Technical Direction
- Read `sprint-board.md`, identify active TASK, create execution plan, maintain `ACTIVE.md`.
- Plan file path: `governance/execution/dev-directives/TASK-###-execution-plan.md`.
- `ACTIVE.md` must include sprint id, active task, plan link, Dev Next Action.
- Lead may not edit sprint-board, allocation ratios, or code.
- Lead may not generate/suggest deprecated browser-driver usage/dependencies.

#### Lead Ingestion Rule
Before issuing any dev directive:
1. Read `governance/audit/adversarial-ledger.md` and `governance/planning/sprint-board.md`.
2. Check for unmapped ADV entries.
3. If unmapped: stop and propose triage.
4. If mapped: continue.

#### Severity Escalation
- BLOCKER: freeze features, override 70/30, convert to REM, dispatch remediation immediately.
- CRITICAL: map to active task as sprint-blocking acceptance criterion, update plan before Dev continues.
- MAJOR: triage in current sprint capacity.
- MINOR: backlog.
- Failure to act on BLOCKER/CRITICAL is governance violation.

### 10.5 Dev / Code-Writing Authority
Before code changes, Dev must:
1. Read `ACTIVE.md`
2. Identify Dev Next Action
3. Read task execution plan
4. Confirm severity context when ADV-related

Dev may run `agent-browser`/runtime probes only when:
- verifying just-implemented change
- reproducing logged ADV item
- explicitly instructed in `ACTIVE.md`
- `agent-browser --help` succeeds in current run

Playwright prohibition:
- Dev must not request/suggest/generate/execute Playwright workflows.
- Exception only with explicit PM authorization recorded in repository artifacts.
- Without exception: stop and request updated Lead directive.

Dev must not:
- perform exploratory validation
- redefine acceptance criteria or severity
- edit sprint-board or adversarial ledger
- expand scope beyond execution plan
- add speculative cross-layout checks outside scope

If plan is ambiguous: stop and request Lead clarification.

### 10.6 Stability / Metrics
- Stability runs on schedule only.
- Writes only to `governance/metrics/stability-metrics.md`.
- Reports open/reopened findings, remediation velocity, and operational signals:
  - ACTIVE.md presence
  - TASK->plan mapping coverage
  - REM items without plans
- Stability must not create tasks or modify sprint-board/adversarial/execution plans.

#### Stability Escalation Monitoring
If detected:
- BLOCKER unresolved > 24h
- CRITICAL unresolved > 1 sprint
- reopened BLOCKER
Then append `Escalation Trigger` section to stability metrics.
- Stability may flag persistence but not reclassify severity.

### 10.7 Communication Contract
- No chat-to-chat agent coordination.
- Repository artifacts only.
- Canonical artifacts:
  - `ACTIVE.md` (Dev intake)
  - `sprint-board.md` (PM allocation)
  - `adversarial-ledger.md` (Lead review logging)

Status/sync output contract (all agents):
- Every status/sync must end with:
  - `Next Actor: <role>`
  - `Action Required: <single concrete action>`
- If waiting on another role, include `Ready Prompt:` with copy/paste text.
- Sync-only responses without routing are non-compliant.

Iteration cadence rule:
- Work in short execution packets and close them quickly:
  - plan -> build -> review -> adapt
- After each packet, PM/Lead must either:
  - advance next task, or
  - record one explicit blocker with owner.
- No idle "awaiting request" loops while an active task is open.

### 10.8 Drift Prevention
If agent works outside role, edits unauthorized files, or expands scope without directive:
- Halt task and log `Governance Drift:` in `ai-memory/todo.md`; PM decides whether a high-impact insight is warranted.

### 10.9 Sprint Freeze
If BLOCKER exists and is unmapped:
- `ACTIVE.md` becomes invalid.
- Dev halts.
- Lead issues remediation directive.
- Feature work cannot continue.
- Overrides allocation ratios.

### 10.10 Repository Containment (global)
Applies to PM, Lead, Dev, Stability for any shell/browser task.

Execution boundary:
- First command must be `pwd`.
- Execution valid only inside repo root.

Pre/Post integrity:
- Run `git status` before and after execution.
- If file changes detected unexpectedly: abort, reject output, log `Containment Violation:` in `ai-memory/todo.md` (PM may elevate to insights if high-impact).

Escalation default:
- Denied by default.
- If sandbox blocks execution, task fails unless PM explicitly authorizes escalation in repository artifacts.
- No auto-escalation.

Backend isolation:
- Allowed backend: `agent-browser` CLI only.
- Forbidden:
  - Playwright invocation/dependency usage
  - Playwright MCP recommendations
  - runtime global installs
  - writes outside repository
  - system file edits
  - background daemon persistence beyond session

Handoff requirement:
- PM must state exactly: `Containment guard active.`
- Lead confirms containment before delegating.
- Dev confirms containment before executing.
- Missing confirmation invalidates execution authority.

Playwright exception gate:
- Hard-deny by default.
- Exception only via explicit PM approval in repository artifacts for named task + duration.

### 10.11 Governance File Change Control
- `AGENTS.md` is a stability artifact, not a running log.
- Edit `AGENTS.md` only when a repeated process failure is observed (same failure class at least twice).
- Prefer surgical patches (smallest possible diff) over refactors.
- Do not edit `AGENTS.md` more than once per sprint unless a BLOCKER/CRITICAL governance failure requires immediate correction.

## 11) MVP Validation Authority
- Manual deterministic browser QA is canonical PASS in MVP phase.
- Node test runner results are advisory until ESM/CommonJS alignment is complete.
- Canonical MVP validation artifact:
  - `agent-browser` CLI validation OR
  - manual deterministic tester-verified run.

### MVP Closure Anti-Loop Rule
- If QA/Tester reports PASS for active task, Lead must issue closure verdict in next sync cycle.
- After QA PASS, Lead may keep task open only with new reproducible BLOCKER/CRITICAL evidence tied to acceptance criteria.
- PARTIAL PASS may not hold a QA-passed task for non-critical instrumentation preference.
- If no new BLOCKER/CRITICAL evidence is logged, Lead must mark PASS and advance intake.
