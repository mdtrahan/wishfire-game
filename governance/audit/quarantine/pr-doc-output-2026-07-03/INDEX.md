# PR Documentation Output Quarantine

Date: 2026-07-03
Bead: `ORKA-yib8.3`

This folder preserves documentation-like artifacts from the last 30 days of PR and Beads cleanup/export work that looked active but were generated, stale, one-time, or redundant with live Beads/GitHub/tooling state.

Nothing here was deleted. Files were moved out of active paths to reduce context drift.

## Audit Scope

- PRs updated since 2026-06-03 from GitHub metadata.
- Markdown additions in git history since 2026-06-03.
- Current-tree generated/export/report surfaces that were repeatedly read as current guidance.
- Origin-only recent docs were inspected from `origin/main` when the cleanup branch could not merge `origin/main` because `.beads/interactions.jsonl` conflicted.

## Quarantine Criteria

Quarantine when a file is:

- explicitly generated and says Beads or GitHub remains source of truth
- a one-time publish/export mapping, dry run, manifest, or review packet
- a stale agent coordination log or prompt that forces completion reports
- a generic raw report or rollback plan that is useful only as historical evidence
- root-level or near-active guidance that encourages broad context loading

Keep active when a file is:

- a durable AGENTS/DOX contract
- current product truth
- a stable process/routing rule
- a reusable QA/eval command reference
- raw evidence in an audit folder that should be searched by date/topic, not read by default

## Quarantined Buckets

| Original path | Disposition | Reason |
| --- | --- | --- |
| `agents/` | Quarantined | Legacy PM/dev prompt files explicitly required `agents/dev_reports.md`, `agents/pm_status.md`, and `agents/issues.md`, creating completion-log churn outside live Beads. |
| `governance/bead-reviews/` | Quarantined | Generated public-safe Beads review packets from 2026-06-08; Beads and GitHub now provide current state. |
| `governance/planning/beads-github-export/bead-github-mapping.json` | Quarantined | Generated visibility mapping snapshot; stale and too large for routine context. |
| `governance/planning/beads-github-export/github-publish-manifest.json` | Quarantined | Generated publish manifest snapshot; stale and too large for routine context. |
| `governance/planning/beads-github-export/dry-run-report.md` | Quarantined | One-time export dry run report. |
| `governance/planning/beads-github-export/project-v2-apply-plan.md` | Quarantined | One-time Project V2 apply plan superseded by the export safety checklist and live tooling. |
| `governance/planning/beads-github-export/project-v2-readiness-audit.md` | Quarantined | One-time Project V2 apply evidence. |
| `governance/planning/beads-github-export/publish-plan.md` | Quarantined | One-time Beads-to-GitHub publication plan with stale review-packet paths. |
| `governance/planning/beads-github-export/published-*.md` | Quarantined | One-time publication ledgers for issue, draft PR, and first-batch mapping. |
| `docs/superpowers/plans/` | Quarantined | Agentic rollback/implementation plans from completed or superseded lanes; useful as history, unsafe as current execution guidance. |
| `reports/` | Quarantined | Generic generated tech-debt report/actions and raw command-output markdown. |

## Deferred Origin-Only Docs

These files exist on `origin/main` but not on this cleanup branch's base. They were audited, but not moved here because the branch could not merge `origin/main` without a `.beads/interactions.jsonl` conflict, and deleting files that are absent from this branch would not remove them from the final merge result.

| Origin path | Disposition | Reason |
| --- | --- | --- |
| `driftwood.md` | Defer quarantine to an origin-based cleanup pass | Useful token-drift audit, but root-level placement increases context clutter. |
| `governance/execution/jcodemunch-token-savings-diagnosis.md` | Defer quarantine to an origin-based cleanup pass | One-time diagnosis evidence; durable retrieval routing remains in active docs. |

## Kept Active

| Path | Reason |
| --- | --- |
| `AGENTS.md` and child `AGENTS.md` files | Binding DOX/workflow contracts. |
| `REPOSITORY_ARCHITECTURE.md` and `DOX_RESEARCH.md` | Durable architecture and DOX reference. |
| `governance/execution/repo-context-retrieval.md` | Durable retrieval routing on `origin/main`; not a completion report. |
| `governance/execution/jcodemunch-mcp-adoption.md` | Durable tool-routing guidance. |
| `governance/planning/beads-github-export/safety-checklist.md` | Durable guardrail for future exports. |
| `governance/planning/beads-github-export/pr-body-template.md` | Reusable template. |
| `governance/planning/generated-artifact-triage.md` | Active `ORKA-yib8.3` triage output and index pointer. |
| `goals/ORKA-bnny-hero-target-selector-sync-eval.md` | Low-noise eval command reference; corresponding npm script exists. |
| `goals/ORKA-293n-yellow-coin-accounting-eval.md` | Low-noise eval command reference on `origin/main`; corresponding npm script exists. |
| `game-design-research/*.md` | Product research/reference, not completion reporting. |
| `governance/audit/reports/fallow-raw-report-2026-06-04.md` | Historical raw evidence already under audit/reports; use search-first by date/topic. |
| `governance/planning/fallow-tech-debt-backlog-2026-06-04.md` | Planning backlog evidence, not generated closeout noise. |
| `governance/product/retired-skills/drain.md` | Product truth for retired skill behavior. |

## Restore Or Regenerate

- Restore a quarantined file only if a bead or PR explicitly needs that exact historical artifact.
- Regenerate Beads review packets from live Beads/GitHub state instead of reusing the quarantined 2026-06-08 packet set.
- Regenerate export manifests before any Beads GitHub publication pass.
- Generated export/review tools require `--allow-generated-doc-output` plus explicit source/output paths; active-path writes require `--allow-active-doc-output`.
- Publish commands require an explicit reviewed `--manifest`; no active generated manifest path is assumed.
- Do not recreate `agents/dev_reports.md`, `agents/pm_status.md`, or `agents/issues.md`; use live Beads state, PR body, and focused audit docs instead.
