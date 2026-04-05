# Codex-Orka Beads Process

## Purpose
- Define the repo-specific Beads workflow for Codex-Orka.
- Keep bead execution deterministic, auditable, and scoped.
- Prevent drift between live `bd` state, hot-file work, and closeout claims.

## Source Of Truth
- Live `bd` state is authoritative for issue selection and status.
- Use `bd ready`, `bd show <id>`, `bd list`, and `bd query` for workflow decisions.
- Repo-side `.beads/` files may exist as local artifacts, but they are not workflow-authoritative when live `bd` is available.
- If `bd` does not resolve, repair shell `PATH` first:
  - `export PATH="$HOME/.local/bin:$PATH"`

## Git Maintenance Override
- Git maintenance/governance work is not blocked by Beads when the user explicitly asks for the Git operation itself.
- Covered operations:
  - commit
  - tag
  - push
  - branch sync
  - PR preparation
  - rollback/checkpoint refs
- Treat these as repo-maintenance lanes, not product-scope implementation lanes.
- If a Git maintenance lane includes new product code changes, the underlying product work should still have truthful Beads ownership; the Git operation itself does not need to stop on bead mechanics.
- Preferred behavior is hands-off completion by the agent.
- Only fall back to user-run terminal commands when a real technical environment boundary blocks Git execution.

## Standard Loop
1. Run `bd ready`.
2. Select the highest-priority ready bead or the explicitly assigned bead.
3. Run `bd show <id>`.
4. State the bead purpose in one short plain-language sentence.
5. Confirm the bead is executable.
6. Mark `in_progress`.
7. Implement only the scoped change.
8. Run targeted verification.
9. Record closeout artifacts.
10. Confirm `bd` write results.
11. Close the bead.

## Sub-Agent-First Execution Rule
- Use installed project-local sub-agents as the default execution path for bead work.
- Do not default to a generalist lane when one installed sub-agent clearly matches the current phase.
- Installed bench:
  - `product-manager`
  - `game-developer`
  - `javascript-pro`
  - `reviewer`
  - `search-specialist`
  - `debugger`
  - `refactoring-specialist`
- Sub-agents must reinforce Beads; they must not introduce competing ownership or workflow state.
- Beads remains authoritative for scope, sequencing, ownership, and completion criteria.
- Primary routing rule: choose sub-agent by bead phase and task intent, not file type alone.
- Routing order:
  1. Identify active bead or governance lane.
  2. Identify current task phase.
  3. Select best-fit sub-agent for that phase.
  4. Select `javascript-pro` only when JavaScript code reasoning is required.
- Keep delegation narrow and phase-bound; avoid broad multi-agent fan-out.
- Prefer one sub-agent at a time unless a clear handoff is required by phase transition.

### Selection Matrix
- Governance/process/planning/bead framing/acceptance/readiness/sequencing/workflow clarification -> `product-manager`
- Gameplay implementation/game-system changes -> `game-developer`
- JavaScript-level fixes/correctness/cleanup -> `javascript-pro`
- Code path discovery/ownership boundary lookup -> `search-specialist`
- Bug isolation/root-cause narrowing -> `debugger`
- Post-change correctness/regression review -> `reviewer`
- Contained structural cleanup with no behavior change -> `refactoring-specialist`

### Handoff Rules
- Use `search-specialist` before implementation when owning code path is unclear.
- Use `product-manager` before implementation when scope or acceptance is unclear.
- Use `debugger` before proposing fixes when bug cause is not understood.
- Use `reviewer` after implementation for regression/correctness checks.
- Use `refactoring-specialist` only when bead scope explicitly permits cleanup.

### Prohibited Behaviors
- Solving a clearly specialist-fit task via generalist path.
- Treating `javascript-pro` as default fallback for narrow tasks.
- Sending vague requests to multiple sub-agents at once.
- Duplicating the same analysis across agents.
- Expanding beyond current bead scope.
- Allowing refactors to drift outside approved cleanup scope.
- Letting debug/review lanes redefine bead requirements.
- Choosing agents by file extension alone.
- Using `javascript-pro` for governance/policy edits that do not require JavaScript reasoning.

### Required Task Response Contract
- For each task response, include:
  1. active bead or governance lane assumption
  2. task phase
  3. chosen sub-agent
  4. one-sentence best-fit rationale versus other installed agents
  5. execution through that sub-agent path
  6. optional handoff to exactly one next sub-agent with reason

## Orphaned Bead Prevention Rule
- PM cycle must not leave avoidable orphaned beads behind.
- If a bead is claimed, set `in_progress`, or otherwise made active during a cycle, that same cycle must do one of the following before ending:
  - execute the bead and continue normal closeout,
  - explicitly hand it off as the active lane with matching coordination-file state, or
  - return it to `open`/ready state with a short reason recorded.
- Inspection-only or proof-of-close review is not enough reason to leave a bead active.
- If a bead was touched only for triage, queue audit, or selection and no real execution started:
  - restore truthful live `bd` status in the same cycle
  - record why it was restored if the temporary activation could confuse the queue
- Proof-or-close lanes follow the same rule:
  - close them on evidence, or
  - return them to `open`/blocked with the missing proof called out
- Avoid carrying forward “placeholder” active beads just to remember what was looked at.

## Purpose Statement Rule
- Before execution, reassignment, or review, state the active bead purpose in one short plain-language sentence.
- The statement must:
  - describe the player-facing or system-facing behavior plainly
  - avoid internal shorthand when a human-readable phrase is available
  - be short enough to make the intended QA mode obvious
- If the bead is not meaningfully player-facing, say that explicitly and bias toward deterministic validation.
- Missing this statement is process non-compliance, not a cosmetic miss.

## Queue Creation vs Execution
- Creating a bead is not the same as starting a lane.
- If a user asks to create/make/add a bead, default behavior is:
  1. create the bead
  2. leave it `open`
  3. do not mark `in_progress` until it is explicitly assigned or selected by the loop
- Execution starts only when one of these is true:
  - the user explicitly says to work that bead now
  - PM explicitly assigns that bead
  - the standard loop selects it as the next executable bead

## Executable Bead Criteria
- A bead is executable only if live `bd` state includes:
  - clear objective
  - acceptance criteria
  - scope boundary
  - test requirement or obvious validation path
- If any of those are missing, do not implement.
- Rewrite, decompose, or block the bead first.
- Ready-head enforcement:
  - if the current ready-head bead is non-executable, do not leave it as ready-head `open` noise after that finding
  - in the same cycle, either rewrite/decompose it into executable children or move it out of ready-head via `blocked`/`deferred` with explicit reason
  - do not repeatedly skip the same non-executable ready-head bead across cycles

## Pre-Execution Scope And Resource Assessment Gate
- Before any implementation edit, record the required assessment level on the active bead lane context (and keep live `bd` authoritative).
- `Scope Assessment` (required):
  - in-scope
  - out-of-scope
  - ownership seam(s)
  - touched files/symbols
  - acceptance/test boundaries
- `Resource Assessment` (required):
  - required sub-agent(s)
  - required MCP/tools (`jcodemunch`, `jdocmunch`, `playwright`, repo harness)
  - expected test levels
  - environment dependencies
  - rollback path
- Sizing rubric (required before start):
  - `S`: single-lane execution, narrow verification depth
  - `M`: single handoff allowed, medium verification depth
  - `L`: phased handoffs required, deepest verification depth with runtime path validation when applicable
- Stop rule:
  - `S` beads may use a one-line scope/resource note if the work is truly narrow
  - `M`/`L` beads, hot-file edits, and browser/runtime work require the fuller blocks above
  - do not start implementation until the required assessment level is recorded and non-ambiguous
  - if ambiguous, rewrite/decompose or return to PM clarification before code edits
- Do not fork process authority:
  - Beads remains source of truth for scope, ownership, status, and completion

## Size And Dependency Discipline
- A bead should be the smallest unit that can be completed and verified in one cycle.
- Prefer beads that are:
  - independently testable
  - short-lived
  - easy to review
- Use explicit Beads dependencies rather than implied order.
- Only start beads with no unresolved blockers.

## Hot-File Discipline
- Treat these as serialized hot files unless a bead explicitly proves isolation:
  - `web-runner/app.js`
  - `web-runner/modules/functionBank.js`
  - `Scripts/functionBank.js`
- For hot-file beads:
  - stage the intended hot-file diff first
  - run `tools/prepare_hot_file_commit.sh <bd-id>` to generate `.beads/hot-file-lock/<bd-id>.scope`
  - treat `.scope` files as generated commit metadata, not hand-authored governance files
  - generated scope may include `__MODULE__` when a reviewed hot-file diff includes top-level imports, constants, or state-shape wiring
  - do not mix unrelated runtime lanes in the same patch
  - stop if unrelated dirty work is already present and cannot be cleanly isolated
- If active Beads state is not aligned to the commit lane:
  - run `tools/prepare_hot_file_commit.sh <bd-id> --align-active`
  - use the printed restore commands after commit to return live `bd` to the truthful queue state
- If staged hot-file diffs change after preparation:
  - rerun `tools/prepare_hot_file_commit.sh <bd-id>`
- Hot-file enforcement now expects prepared metadata and should fail once with:
  - one actionable prepare command when preparation is missing
  - one batched error list when top-level or undeclared-function violations exist

## Closeout Rules
- A bead is not ready to close unless all of the following are true:
  - acceptance criteria are satisfied
  - tests or validation were actually run
  - `/agents/dev_reports.md` contains a scoped report
  - `/agents/pm_status.md` reflects the result
  - Wishfire Notion tracker reflects the updated bead state for human parallel review
  - bug/regression beads update `/ai-memory/insights.md`
- Archive historical PM/dev entries into `/agents/archive/` so active coordination files stay concise for startup and review.
- If unrelated dirty changes remain in touched hot files, do not treat the lane as cleanly reviewable without explicitly calling out that risk.

### Notion Sync Rule (PM Cycle)
- PM cycle must keep the Wishfire Notion tracker (`https://www.notion.so/3347e3368a6781a1acead98f06b9e173`) synchronized with live `bd` state for beads closed in that cycle.
- Notion usage map:
  - `Wishfire Product Backlog`: active planning queue of bead-backed work.
  - `Wishfire Log`: completion-only ledger of closed beads.
  - `Wishfire Specs`: requirement and acceptance source.
  - `Wishfire Architecture`: decisions/constraints/rules and enforcement.
  - `Wishfire Knowledge`: reusable lessons from completed work.
- Closed-bead sync requirements (enforced):
  - Backlog row for the closed bead reflects truthful final state.
  - Specs capture requirement/acceptance updates tied to that closed bead, if changed.
  - Architecture captures new constraints/rules introduced by that closed bead, if any.
  - Knowledge captures reusable lessons from completed bug/regression lanes.
  - Wishfire Log appends the closed bead entry.
- Non-closed cycles:
  - Notion updates are optional and should be skipped unless they remove drift or are explicitly requested.
- Backlog row completeness is mandatory for each created/updated backlog bead:
  - `Backlog Item` = Bead ID
  - `Bead State` set explicitly as one of `Backlog`, `Active`, `Blocked`, `Done`
  - `Description`, `Features Created`, and `Human Notes` populated for human-scannable context
  - `Priority` and `Owner` set explicitly
- Visibility verification is mandatory:
  - confirm bead is queryable in backlog data source search
  - confirm bead is visible in `Backlog Board` under the intended state column
  - if visibility fails due to row property mismatch, correct row properties in the same cycle
- Log hygiene is mandatory:
  - keep only completed beads (`done`/`closed`) in `Wishfire Log`
  - remove non-completed rows from `Wishfire Log` in the same PM cycle when detected
  - keep one operational view for Log (`Default view`) sorted by `Last Run` descending
- If Notion tools are unavailable, record a `dependency_block` in `/agents/issues.md` and keep PM status explicit about the gap.

## `bd` Write Confirmation Rule
- Treat `bd` writes as unconfirmed until a second read succeeds.
- Acceptable confirmation patterns:
  - `bd show <id>` twice in separate invocations
  - `bd show <id>` plus `bd list` or `bd query`
- If reads disagree after a write:
  - stop stateful lane transitions
  - record the inconsistency in coordination artifacts if it affects execution
  - do not assume the first follow-up read is canonical

## PM / Dev / Review Contract
- PM:
  - shapes executable beads
  - states the bead purpose plainly before assigning, rewriting, or reviewing
  - must restore a bead to truthful queue state if it was only inspected and not actually handed off for work
  - rejects vague work
  - closes only with evidence
- Dev:
  - implements one bead at a time
  - restates the bead purpose plainly before claiming and implementing
  - must not keep a claimed bead active if execution never actually starts
  - stays inside scope
  - reports exact tests and touched files
- Review:
  - checks that the bead purpose was stated plainly
  - checks that PM cycle did not leave an avoidable orphaned active bead
  - checks acceptance, evidence, and scope compliance
  - rejects mixed-scope closeouts

## Anti-Patterns
- Starting work from stale `.beads/` mirrors instead of live `bd`
- Treating a null/underspecified bead as executable
- Mixing multiple hot-file lanes in one dirty worktree without isolation
- Closing a bead based on code presence alone without targeted validation
- Trusting a single immediate `bd` read after a write when the tool has shown inconsistency
