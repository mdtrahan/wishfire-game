# Development Reports

Active handoff file only. Historical implementation reports live in `/agents/archive/dev_reports_archive.md` and should not be read during normal startup unless historical investigation is required.

## Template
- bead id:
- summary of changes:
- files modified:
- test evidence:
- scope confirmation:

## Recent Reports
- bead id: ORKA-3nlw
- summary of changes: Inventoried the dirty worktree and reduced it to three actionable buckets with explicit save/wait guidance. The current tree is dominated by Beads mirror reconciliation plus governance-log cleanup, with one separate runtime/test bundle that should not be mixed into the governance patch.
- files modified: `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `git status --short`
  - `git diff --name-only`
  - `git diff --cached --name-only`
  - `git status --short | awk '{print $2}' | cut -d/ -f1 | sort | uniq -c`
- scope confirmation: Planning/inventory only. No gameplay/runtime behavior changed in this lane.

- cleanup buckets:
  - Bucket A, save now: Beads mirror + governance coordination cleanup
    - `.beads/**` mirror deletions/additions from live-`bd` reconciliation
    - `AGENTS.md`
    - `agents/dev_reports.md`
    - `agents/pm_status.md`
    - `agents/issues.md`
    - `agents/prompts/dev_agent.md`
    - `agents/prompts/pm_agent.md`
    - `governance/**`
    - `agents/archive/**`
  - Bucket B, wait: runtime/test bug-fix bundle
    - `web-runner/src/core/idleFarmRuntime.mjs`
    - `tests/idleFarmForcedEnemyNamesContract.test.js`
    - `ai-memory/insights.md`
    - rationale: this is real runtime/test work and should close under its owning bug bead, not be buried inside governance cleanup
  - Bucket C, save with Bucket A as a rename, not as independent churn
    - `governance/qa/orka-3j6/**` deletions
    - `governance/qa/hero-layout-qa-packet/**` additions
    - rationale: this is one QA packet rename/retitle and should be preserved as a single governance move

- commit order:
  - 1. Commit Bucket A plus Bucket C together as governance/coordination cleanup
  - 2. Re-run `git status --short` and confirm only Bucket B remains
  - 3. Validate/runtime-close the owning bug lane for Bucket B, then commit that runtime/test bundle separately

- what should wait versus save now:
  - Save now: all `.beads`, agent-policy, archive, planning, and QA-packet rename work
  - Wait: `idleFarmRuntime.mjs`, `idleFarmForcedEnemyNamesContract.test.js`, and the related `ai-memory/insights.md` changes until the owning runtime bead is explicitly reviewed/closed

- bead id: ORKA-8w4u
- summary of changes: Split historical coordination history out of the active PM/dev guidance files. Archived the full pre-trim `agents/pm_status.md` and `agents/dev_reports.md` into `/agents/archive/`, rewrote the active files as current-state documents only, and updated repo workflow prompts/rules so future cycles keep the active files concise instead of appending rolling history forever.
- files modified: `agents/archive/pm_status_archive.md`; `agents/archive/dev_reports_archive.md`; `agents/pm_status.md`; `agents/dev_reports.md`; `AGENTS.md`; `agents/prompts/pm_agent.md`; `agents/prompts/dev_agent.md`; `governance/execution/beads-process.md`
- test evidence:
  - `wc -l agents/pm_status.md agents/dev_reports.md agents/archive/pm_status_archive.md agents/archive/dev_reports_archive.md agents/prompts/pm_agent.md agents/prompts/dev_agent.md`
  - `rg -n "archive/pm_status_archive|archive/dev_reports_archive|current snapshot only|current/recent" AGENTS.md agents/prompts/pm_agent.md agents/prompts/dev_agent.md governance/execution/beads-process.md agents/pm_status.md agents/dev_reports.md`
  - `git diff --stat -- agents/pm_status.md agents/dev_reports.md agents/archive/pm_status_archive.md agents/archive/dev_reports_archive.md AGENTS.md agents/prompts/pm_agent.md agents/prompts/dev_agent.md governance/execution/beads-process.md`
- scope confirmation: Confined to coordination/governance file structure only. No gameplay/runtime code or product behavior changed.

- bead id: ORKA-zys
- summary of changes: Reconciled the repo-side `.beads/open` and `.beads/in_progress` mirrors against live `bd` state, removed stale cache entries, added missing live entries, and moved `ORKA-zys`/`ORKA-y5x` into the correct mirrored status directories so local governance artifacts no longer disagree with live queue state.
- files modified: `.beads/open/*.md`; `.beads/in_progress/*.md`; `agents/dev_reports.md`; `agents/pm_status.md`; `agents/issues.md`
- test evidence:
  - `bd list --status open`
  - `bd list --status in_progress`
  - `bd ready`
  - mirror-vs-live `comm` diff for `.beads/open` vs live open ids (empty after reconciliation)
  - mirror-vs-live `comm` diff for `.beads/in_progress` vs live in-progress ids (empty after reconciliation)
- scope confirmation: Confined to mirror/governance reconciliation only. No gameplay/runtime code or product rules were changed.
