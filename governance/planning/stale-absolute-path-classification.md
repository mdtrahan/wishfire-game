# Stale Absolute Path Classification

Bead: `ORKA-yib8.9`

## Scope

This pass classifies active non-archive documentation that still mentions old Wishfire-root absolute paths, stale Codex worktree roots, and local bead worktree paths. It does not rewrite archived evidence, delete docs, update runtime code, or mass-normalize rollback examples.

## Search Receipt

Active-doc search excluded `governance/audit/**`, `governance/planning/beads-github-export/**`, `governance/bead-reviews/**`, and archive folders.

Command shape:

```bash
rg -n --glob '!governance/audit/**' --glob '!governance/planning/beads-github-export/**' --glob '!governance/bead-reviews/**' --glob '!**/archive/**' --glob '!**/archives/**' "<old-root-or-worktree-path-pattern>" docs agents governance
```

Before classification: 45 matches in 8 active files.
After classification: 45 matches in the same 8 files because this PR records disposition only.

`/private/tmp` matches were reviewed separately and left out of cleanup scope because current planning docs use them as scratch rollback/evidence paths.

## Classification

| File | Matches | Classification | Rationale | Follow-up |
|---|---:|---|---|---|
| `governance/product/game-function-reference.md` | 9 | Fix candidate | Active product reference uses old absolute markdown links for current runtime/doc seams. These are misleading for future readers. | Replace with relative repo links in a narrow product-doc PR after reading `governance/product/AGENTS.md`. |
| `governance/execution/jcodemunch-mcp-adoption.md` | 1 | Fix with `ORKA-yib8.10` | The path points to a copy-ready config example under the old root. Retrieval-index hygiene owns this surface and current main has active user edits nearby. | Fold into `ORKA-yib8.10` or a later execution-doc cleanup PR. |
| `governance/metrics/stability-metrics.md` | 1 | Fix candidate | Cron pre-check names a current repo doc but uses the old root. This can misroute future automation. | Replace with repo-relative path or current root after confirming the cron-worktree contract. |
| `governance/execution/dev-directives/ACTIVE.md` | 1 | Historical label candidate | The file points to old-root `AGENTS.md` in an active directive surface. It should not drive current execution without a stale/historical label. | Add a stale/historical header or retire the directive in a narrow execution-doc PR. |
| `governance/execution/dev-directives/TASK-019-execution-plan.md` | 5 | Historical/do-not-normalize | The file already starts with `DEPRECATED: Historical TASK-019 Plan`; old-root target/artifact paths are part of the retained historical spec. | Leave paths intact unless a future archive move retires the file. |
| `docs/asset-usage-audit.md` | 4 | Historical audit label candidate | The audit is dated 2026-02-20 and records how the asset scan was performed. The paths are historical evidence, not current navigation instructions. | Add a short historical-path note if this doc remains active. Do not rewrite evidence lines. |
| `agents/dev_reports.md` | 4 | Historical/do-not-normalize | Entries describe prior MCP index commands and returned repo ids. Rewriting would falsify evidence. | Leave as evidence; consider moving old reports under archive if they keep surfacing in active searches. |
| `docs/superpowers/plans/2026-06-13-repo-cleanup-rollback-plan.md` | 20 | Rollback/do-not-normalize | The paths are commands and rollback handles for a specific cleanup plan, including a stale worktree and restore commands. Rewriting could break the recovery record. | Leave intact unless the rollback plan is explicitly superseded and archived. |

## Explicit Non-Targets

- Archived docs with old paths are historical and were intentionally excluded.
- `governance/audit/**` reports are evidence stores and should not be rewritten for path hygiene.
- `governance/planning/beads-github-export/**` is board/export process material and should stay tied to its original evidence.
- `/private/tmp` rollback examples are scratch/evidence instructions; do not mass-normalize them.

## Recommended Order

1. Update `governance/product/game-function-reference.md` links in a product-doc-only PR.
2. Let `ORKA-yib8.10` own retrieval-doc path cleanup where jcodemunch/codebase-memory routing is already in scope.
3. Add stale/historical labels to `ACTIVE.md`, `docs/asset-usage-audit.md`, and possibly retire old `agents/dev_reports.md` content to archive.
4. Leave rollback and deprecated task-spec paths unchanged unless an archive/retirement bead explicitly owns them.

## Validation

- Focused active-doc search before classification: 45 matches in 8 files.
- Focused `/private/tmp` review confirmed rollback/evidence usage, not broad path-drift cleanup.
- `git diff --check` is the required validation for this docs-only change.
