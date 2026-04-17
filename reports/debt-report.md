# Debt Report

Generated: 2026-04-12

Scope:
- Live repo tree only
- Excluded `.codex-worktrees`
- Prioritized by the requested bloat signals:
  - Unused files
  - Dead exports
  - Duplicate logic
  - Files over 500 lines
  - Dependencies not used in code

## Top 10 Bloat Offenders

| File path | Issue type | Confidence | Suggested action |
|---|---|---:|---|
| `web-runner/app.js` | Files >500 lines; duplicate logic | high | refactor |
| `web-runner/modules/functionBank.js` | Files >500 lines; duplicate logic | high | merge |
| `Scripts/functionBank.js` | Files >500 lines; duplicate logic | high | merge |
| `tools/balance_harness.js` | Files >500 lines | high | refactor |
| `package.json` | Dependencies not used in code (`gsap`) | high | delete |
| `src/core/combatRuntimeGateway.js` | Unused file | high | delete |
| `web-runner/gameLogic.js` | Unused file; dead exports | high | delete |
| `Scripts/legacy but partially working/scripts/main.js` | Unused file; dead legacy entrypoint | high | delete |
| `Scripts/legacy but partially working/scripts/CombatLogic.js` | Unused file | med | delete |
| `Scripts/legacy but partially working/scripts/EventHandlers.js` | Unused file | med | delete |

## Notes

- The strongest duplication cluster is the mirrored `functionBank` pair plus the giant `web-runner/app.js`.
- `gsap` is present in `package.json` but has no source-tree usages in the current repo scan.
- The legacy `Scripts/legacy but partially working/scripts/` subtree appears to be orphaned as a cluster; `main.js` is the best cleanup target.
