# Document Lifecycle Policy

## Overwrite-Only Canonical Files
- `ai-memory/context.md`
- `ai-memory/todo.md`
- `ai-memory/insights.md`
- `ai-memory/project.md`
- `governance/planning/sprint-board.md`
- `governance/planning/backlog.md`
- `governance/planning/milestone-definition.md`
- `governance/planning/roadmap.md`
- `governance/execution/dev-directives/ACTIVE.md`

Rule:
- One file per purpose. Update the canonical file in place.
- Do not create versioned duplicates (`v2`, `final-final`, date-stamped clones) when a canonical file exists.

## Append-Only Logs
- `governance/audit/adversarial-ledger.md`
- `governance/audit/regression-history.md`
- `governance/metrics/stability-metrics.md`

## Immutable/Frozen
- `AGENTS.md`
- `governance/audit/reports/*`
- Explicitly marked read-only legacy archives.

## Directive Plan Retention
- Keep only active/blocked plan files in `governance/execution/dev-directives/`.
- Move completed `TASK-###-execution-plan.md` files to `governance/execution/dev-directives/archive/YYYY-MM/`.
