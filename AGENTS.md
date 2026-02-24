# AGENTS.md --- Codex-Orka (Always-on Rules)

## 0) Core Philosophy
- Prefer retrieval over memory.
- Read relevant project files before proposing edits.
- Construct 3 artifacts are retired; do not infer or regenerate runtime behavior from C3 sources.

## 1) Canonical Sources
### Runtime (authoritative)
- `Scripts/`
- `web-runner/`
- Netlify deployment behavior is canonical.
- `main` is production branch and branch base.

### Retired Legacy
- Construct 3 conversion artifacts were removed from this repository on 2026-02-24.
- Retirement reference: `docs/construct3-retirement.md`.

## 2) Startup Protocol (required order)
1. Read `ai-memory/context.md`
2. Run `bd ready`
3. Select active work and run `bd show <id>`
4. Read `ai-memory/insights.md`
- If conflict exists, `AGENTS.md` wins.

## 3) Execution Scope
- Work only the active Beads issue selected for this lane.
- No opportunistic refactors or “while here” extras.

### 3.1 Beads Work Gating (mandatory)
- No issue, no work. Always run `bd ready` then `bd show <id>`. Commits require `bd-<id>` in the message.
- Use Beads (`bd`) as the source of truth for active work tracking.
- Before any implementation work:
  1. Run `bd ready`
  2. Select issue and run `bd show <id>`
  3. Mark active issue (`in_progress`) before editing code
- Commit messages must include `bd-<id>` reference tokens to satisfy commit hook policy.
- If hooks fail due missing Beads context, stop and fix issue selection/state before retrying commit.

### Blocker Rule
If there is no ready/selected Beads issue or scope is ambiguous:
- Mark issue blocked in Beads and request explicit clarification on that issue.
- Stop immediately.

## 4) Deterministic Skill Router
Output the invocation line before proceeding.
- Planning/spec/architecture: `$skills/feature-planning`
- Bug/drift/regression: `$skills/debug-javascript`
- Snapshot/JSON parity: `$skills/json-parity-auditor`
- Multi-step orchestration: `$skills/ensemble-orchestrator`

## 5) Retrieval Map
- Consult `ai-memory/PROJECT_INDEX.md` before broad search.
- If missing info discovered, record `Index gap:` in active Beads issue notes/comments.
- Top-level map:
  - `Scripts/`, `web-runner/`, `ai-memory/`, `skills/`, `test-results/`
  - `python-app/`, `node-app/` are tooling-only unless TODO requires edits.

### 5.1 Doc Retrieval Short-Circuit (token control)
- For PM/worker documentation work, read canonical files first and avoid repo-wide scans unless blocked:
  - `ai-memory/context.md`, `ai-memory/insights.md`, `ai-memory/project.md`
  - `governance/planning/milestone-definition.md`, `governance/planning/roadmap.md`
  - Beads issue details (`bd show <id>`) and linked acceptance/evidence artifacts
- Treat root-level legacy duplicates (`context.md`, `todo.md`, `insights.md`) as deprecated non-canonical.
- Completed execution plans should be moved to `governance/execution/dev-directives/archive/YYYY-MM/` to keep active directive scans small.

## 6) Checkpoint Protocol (after each task)
1. Update Beads issue state/notes (`bd update`, `bd comments`, `bd close` as appropriate)
2. Update role artifacts only when needed (for example remediation log, metrics, test artifacts).

### Disk Safety
- Update each ai-memory file at most once per task.
- No loops/repeated writes.
- `insights.md`: decisions log only, not transcript.
- Verbose traces belong in runtime/governance artifacts.
- `insights.md` must contain high-impact process or product decisions only (no sync chatter, no status replay).
- `insights.md` write authority: PM only.
- Workers/Stability must not append to `insights.md`; route operational detail to issue comments and task artifacts.

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

## 10) Agent Operating Model
- Threads-as-agents architecture.
- No hidden cross-thread memory assumptions.
- Repository artifacts are the only communication channel.

### 10.1 Authority Model
- PM orchestrates priorities, dependencies, and acceptance via Beads.
- Any available worker agent may pick ready Beads work under PM orchestration rules.
- Stability runs in parallel for metrics only.
- No fixed worker-count cap; worker pool is elastic.

### 10.2 PM / Orchestration
- PM never edits code.
- PM uses Beads as the only intake/order/closure system (`bd ready`, `bd show`, dependencies, status transitions).
- PM sets a dynamic cycle WIP target (integer, flexible), based on:
  - truly ready/unblocked issues
  - conflict risk (shared files/systems)
  - QA bandwidth
- PM classifies issues for safe parallelism:
  - `core-mutation` (high coupling)
  - `sidecar-hardening` (medium coupling)
  - `isolated` (low coupling)
- Parallel safety partition:
  - any number of `isolated` issues may run concurrently if QA can absorb.
  - `core-mutation` issues should be serialized per subsystem unless explicitly proven independent.
- PM uses Beads dependencies to enforce safety, not role bottlenecks.

### 10.3 Worker / Execution Authority
Before code changes, worker must:
1. Run `bd ready`
2. Pick one ready issue and run `bd show <id>`
3. Mark issue `in_progress` if not already
4. Execute only the scoped change for that issue

Worker may run `agent-browser`/runtime probes only when:
- verifying just-implemented change
- reproducing logged defect behavior
- `agent-browser --help` succeeds in current run

Playwright prohibition:
- Workers must not request/suggest/generate/execute Playwright workflows.
- Exception only with explicit PM authorization recorded in repository artifacts.

Workers must not:
- perform unscheduled exploratory implementation
- redefine acceptance criteria or severity
- expand scope beyond issue description/acceptance
- add speculative cross-layout checks outside issue scope

### 10.4 Severity & Review
Severity categories:
- BLOCKER / CRITICAL / MAJOR / MINOR

Definitions:
- BLOCKER: startup failure, core loop broken, unrecoverable lock/corruption, progression impossible.
- CRITICAL: milestone criteria violated, deterministic behavior broken, transition flow incomplete, reproducible integrity defect.
- MAJOR: partially functional feature, intermittent state issues, meaningful UX/control inconsistency.
- MINOR: cosmetic or low-impact non-core defect.

PM owns severity triage and closure decisions in Beads.

### 10.5 Stability / Metrics
- Stability runs on schedule only.
- Writes only to `governance/metrics/stability-metrics.md`.
- Reports open/reopened findings, remediation velocity, and operational signals.
- Stability must not create or reprioritize Beads issues.

#### Stability Escalation Monitoring
If detected:
- BLOCKER unresolved > 24h
- CRITICAL unresolved > 1 sprint
- reopened BLOCKER
Then append `Escalation Trigger` section to stability metrics.
- Stability may flag persistence but not reclassify severity.

### 10.6 Communication Contract
- No chat-to-chat agent coordination.
- Repository artifacts only.
- Canonical artifacts:
  - Beads issue database (`bd`)
  - `AGENTS.md`
  - `governance/audit/adversarial-ledger.md` (when adversarial findings are logged)

Iteration cadence rule:
- Work in short execution packets and close them quickly:
  - plan -> build -> review -> adapt
- After each packet, PM must either:
  - advance next task, or
  - record one explicit blocker with owner.
- No idle "awaiting request" loops while an active task is open.

### 10.7 Drift Prevention
If agent works outside role, edits unauthorized files, or expands scope without directive:
- Halt task and log `Governance Drift:` in `ai-memory/todo.md`; PM decides whether a high-impact insight is warranted.

### 10.8 Sprint Freeze
If BLOCKER exists and is unmapped:
- current issue lane becomes invalid.
- worker execution halts on affected lane.
- PM issues remediation directive.
- Feature work cannot continue.
- Overrides allocation ratios.

### 10.9 Repository Containment (global)
Applies to PM, workers, and Stability for any shell/browser task.

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
- Worker must confirm containment checks before execution.

Playwright exception gate:
- Hard-deny by default.
- Exception only via explicit PM approval in repository artifacts for named task + duration.

### 10.10 Governance File Change Control
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
- If QA/Tester reports PASS for active task, PM must issue closure verdict in next sync cycle.
- After QA PASS, PM may keep task open only with new reproducible BLOCKER/CRITICAL evidence tied to acceptance criteria.
- PARTIAL PASS may not hold a QA-passed task for non-critical instrumentation preference.
- If no new BLOCKER/CRITICAL evidence is logged, PM must mark PASS and advance intake.
