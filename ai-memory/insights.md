# Insights / Decisions Log

## 2026-02-14
- Initialized memory system files.
- Next: Inventory repo structure and key gameplay loop files.
- Repo structure inventory:
  - Runtime roots: `web-runner/`, `Scripts/`, `src/core/`, `src/layout/`, `tests/`.
  - Legacy/archive roots present but non-runtime: `_archive/`, `project_C3_conversion/` (per guardrails).
- Key gameplay loop files and anchors:
  - `web-runner/app.js`: layout registration (`registerLayout`), initial activation (`activateInitialLayout('combat')`), input/match handling (`handleGemMatch`), main tick loop (`tick` + `requestAnimationFrame`), debug state export (`window.render_game_to_text`).
  - `src/core/combatRuntimeGateway.js`: combat authority boundary (`runCombatStep`, `suspend/resume`, `isInAtomicSection`).
  - `src/core/layoutState.js`: layout transition/atomic guard integration.

CHECKPOINT
- processed: Inventory repo structure and key gameplay loop files
- added: runtime directory map + key gameplay loop file anchors
- next: Add a deterministic debug snapshot output for testing

- Deterministic debug snapshot is already implemented in runtime:
  - `web-runner/app.js` exports `window.render_game_to_text` with stable JSON payload (turn, order, resources, entities, gems, flags).
  - `web-runner/app.js` exports `window.advanceTime(ms)` stepping frames deterministically via fixed `1/60` step.
  - `window.__codexGame` helper object exists for targeted test control hooks.

CHECKPOINT
- processed: Add a deterministic debug snapshot output for testing
- added: verified existing deterministic snapshot + time-step hooks; no code changes needed
- next: Implement <next feature you want>

- Placeholder todo item was not actionable without a concrete feature spec; closed to keep queue deterministic.
- Follow-up expectation: next run should replace placeholder with one explicit feature request before coding.

CHECKPOINT
- processed: Implement <next feature you want> (placeholder)
- added: marked placeholder closed + documented requirement for explicit feature spec
- next: Wait for concrete feature request

## 2026-02-15
- Created governance scaffold exactly as requested under `governance/` with `audit/`, `planning/`, `execution/`, and `metrics/` subdirectories.
- Decision: created empty markdown files only; no templated contents were added to avoid scope expansion.
- Files touched:
  - `governance/audit/adversarial-ledger.md`
  - `governance/audit/regression-history.md`
  - `governance/planning/roadmap.md`
  - `governance/planning/milestone-definition.md`
  - `governance/planning/sprint-board.md`
  - `governance/planning/backlog.md`
  - `governance/execution/remediation-log.md`
  - `governance/execution/task-queue.md`
  - `governance/execution/done-log.md`
  - `governance/metrics/stability-metrics.md`
  - `governance/metrics/delivery-velocity.md`
- Next task: Await next explicit user request.
- Added `governance/product/` with the requested markdown docs.
- Decision: kept files empty and matched exact names and location from user request.
- Files touched:
  - `governance/product/retention-hypotheses.md`
  - `governance/product/monetization-architecture.md`
  - `governance/product/liveops-readiness.md`
- Next task: Await next explicit user request.
- Created audit report placeholder file at `governance/audit/reports/2026-Layout-Harness-Conformance-Report.md`.
- Decision: created an empty markdown file only, matching exact user path/name.
- Files touched:
  - `governance/audit/reports/2026-Layout-Harness-Conformance-Report.md`
- Next task: Await next explicit user request.

- Executed Sprint Triage on new adversarial findings in `governance/audit/adversarial-ledger.md`.
- Decisions made:
  - Clustered findings by root-cause theme.
  - Selected only `ADV-2026-001` for next sprint remediation to enforce 30% cap (1 of 4 findings = 25%).
  - Deferred `ADV-2026-002`, `ADV-2026-003`, and `ADV-2026-004` to backlog due to cap/severity prioritization.
  - Created `REM-2026-001` with explicit regression guard and closure conditions.
  - Index gap: `ai-memory/PROJECT_INDEX.md` is missing.
- Files touched:
  - `governance/planning/sprint-board.md`
  - `governance/execution/remediation-log.md`
  - `governance/planning/backlog.md`
- Next task: Await next explicit user request.

- Re-ran sprint triage execution against current `ADV-2026-*` set in `governance/audit/adversarial-ledger.md`.
- Decisions made:
  - Kept `REM-2026-001` (linked `ADV-2026-001`, Critical) as sole remediation item for next sprint.
  - Kept `ADV-2026-002`, `ADV-2026-003`, `ADV-2026-004` in backlog due to 30% cap.
  - Confirmed remediation allocation remains 25% (1 selected of 4 open findings), within cap.
  - Index gap persists: `ai-memory/PROJECT_INDEX.md` missing.
- Files touched:
  - `ai-memory/todo.md`
  - `ai-memory/insights.md`
- Next task: Await next explicit user request.

- Added requested milestone extension and Definition of Done additions to milestone definition.
- Decision: inserted user text verbatim to preserve policy intent without reinterpretation.
- Files touched:
  - `governance/planning/milestone-definition.md`
- Next task: Await next explicit user request.

- Evaluated milestone progress coverage against current sprint/remediation/audit artifacts.
- Decisions made:
  - Current feature tasks (`TASK-001`, `TASK-002`) are placeholder-level and do not explicitly cover milestone criteria.
  - Only explicit criterion coverage in active sprint is from remediation `REM-2026-001` (pointer/tick lifecycle continuity).
  - Milestone progression is incomplete and at risk without criterion-mapped feature tasks.
  - Proposed next feature tasks to cover uncovered criteria while preserving 70/30 allocation.
- Files touched:
  - `ai-memory/todo.md`
  - `ai-memory/insights.md`
- Next task: Await next explicit user request.

- Applied sprint containment directive for 7-day sprint.
- Decisions made:
  - Selected only `TASK-004` as the single active feature task because it unblocks the milestone extension plus turn-order and snapshot/resume criteria with highest centrality.
  - Preserved sprint allocation at Feature 70% / Remediation 30%.
  - Moved remaining proposed feature tasks (`TASK-003`, `TASK-005`) into backlog.
- Files touched:
  - `governance/planning/sprint-board.md`
  - `governance/planning/backlog.md`
- Next task: Await next explicit user request.

- Refined `TASK-004` scope to strict deterministic turn-state/snapshot validation work.
- Decisions made:
  - Explicitly excluded transition contract enforcement, layout registration policy changes, and atomic transition queue refactors from `TASK-004`.
  - Kept overlap cleanly split, with transition-contract scope remaining in backlog `TASK-003`.
- Files touched:
  - `governance/planning/sprint-board.md`
- Next task: Await next explicit user request.

- Created pre-execution invariant specification for `TASK-004`.
- Decisions made:
  - Defined explicit invariant IDs (I-001..I-006) for authoritative queue, index constraints, pre-suspend validity, post-resume guarantees, forbidden intermediate states, and tick interaction contract.
  - Kept scope strictly to invariant definition and deterministic validation predicates; no transition routing or registration policy changes included.
- Files touched:
  - `governance/planning/turn-state-invariants.md`
- Next task: Await next explicit user request.

- Executed Phase 1 for `TASK-004` from `governance/execution/dev-directives/ACTIVE.md`.
- Decisions made:
  - Formalized a single authoritative turn-state contract in runtime core with legacy fallback compatibility.
  - Implemented deterministic invariant predicates (I-001..I-006) and deterministic failure IDs for suspend/resume validation output.
  - Expanded suspend snapshot payload with required fields (`snapshotVersion`, `capturedAtTick`, `turnState`, `resumeToken`) while preserving backward-compatible snapshot keys.
  - Kept scope to Phase 1 only; no transition contract enforcement or layout policy changes.
  - Index gap: `ai-memory/PROJECT_INDEX.md` is missing.
- Files touched:
  - `src/core/combatRuntimeGateway.js`
  - `ai-memory/todo.md`
  - `ai-memory/insights.md`
- Next task: Await next explicit user request.
