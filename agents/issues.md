# Coordination Issues (Ambiguity / Drift)

## Unresolved
- ORKA-4ws | `scope_conflict` repo-side `.beads/` mirrors no longer match live `bd` issue state | Lane selection and closeout review can drift if workers read mirror files instead of live `bd` | Treat `bd` as authoritative, stop using `.beads/` for workflow decisions, and reconcile mirror files in a separate bounded cleanup pass after mixed dirty work is isolated
- ORKA-hvj.5 | Hero-screen progression bindings blocked by missing product definitions (point source/reset policy/skill count/effects) | Blocks clean QA and risks speculative implementation | Clarify product contract before reopening lane
- ORKA-yy0 | Netlify deploy/boot consistency remains tabled by product decision | Deployment confidence risk if release is requested suddenly | Reopen only when deploy hardening is re-prioritized
- ORKA-6n7 / ORKA-900 / ORKA-9yo | `missing_spec` (`null` bead bodies) | Cannot execute mandatory closeout/hot-file-lock lanes safely without defined scope + acceptance | Add explicit objective, file/function scope, and pass/fail criteria to each bead
- ORKA-9ri / ORKA-c4s / ORKA-f0l / ORKA-ksw / ORKA-njg / ORKA-pv3 / ORKA-wuh / ORKA-hvj.4 | `missing_spec` (`null` bead bodies) | PM cycle cannot safely assign these lanes; high queue count but low executable throughput | Rewrite each bead with concrete objective, bounded scope, acceptance, and test requirements

## Resolved
- ORKA-1qo | Node Playwright launch remained blocked in-sandbox, but the bead was recovered by adding CDP attach mode to an already-running Chrome instance and verifying a real smoke run that wrote all four balance-harness artifacts
- ORKA-cxi | Reverted ORKA-jj0 regression commits and restored pre-flyup baseline
- 2026-03-07: Multiple P0 beads in `.beads/open/` are underspecified (`null` body only): ORKA-6xs, ORKA-6mq, ORKA-3m8, ORKA-890, ORKA-9ng, ORKA-z0b. Cannot execute safely under Beads scope rule without acceptance/scope body.
- 2026-03-08: Audit rule added: before reporting blockers, reconcile `.beads/open` against `agents/dev_reports.md` and existing contract tests to avoid false "blocked" claims on already-shipped beads.
# Issues / Blockers

## 2026-03-10
- Balance harness lane: Node Playwright + CDP attach now works and bounded prelim runs complete, so browser automation is no longer the main blocker.
- New blocker for trustworthy CP analysis: combat runtime can overfill the battlefield beyond configured `enemies_per_wave` during respawn/repopulation windows (observed 5 living/registered enemies in a 3-enemy bounded run). This distorts session depth and enemy defeat counts even when the harness itself behaves correctly.
# Issues / Blockers

- ORKA-boj
  - category: environment/tooling
  - blocker: exact home-level MCP setup cannot be completed from this sandbox because writes to `~/.codex/config.json` are denied
  - blocker: npm package names from the task text are not published as written (`jcodemunch-mcp`, `jdocmunch-mcp`, `jcontextmunch-mcp`, `jcodemunch` all return `E404`)
  - working fallback: current session already has `jcodemunch` and `jdocmunch` MCP servers available; repo indexing completed through those servers and `.ai/retrieval_rules.md` was added
