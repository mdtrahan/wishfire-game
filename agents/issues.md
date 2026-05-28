# Coordination Issues (Ambiguity / Drift)

## Unresolved
- ORKA-6opp | `missing_spec` hero-specific red single-target presentation variants lack explicit acceptance, test requirements, and scope boundaries beyond a short description | Unsafe to implement because timing/cluster/impact differences can easily drift into combat readability or harness behavior changes without a pass/fail contract | Rewrite bead with per-hero presentation expectations, explicit non-goals, required test coverage, and whether existing Incinerate/Double Attack harness seams are in or out of scope
- ORKA-hvj.5 | Hero-screen progression bindings blocked by missing product definitions (point source/reset policy/skill count/effects) | Blocks clean QA and risks speculative implementation | Clarify product contract before reopening lane
- ORKA-yy0 | Netlify deploy/boot consistency remains tabled by product decision | Deployment confidence risk if release is requested suddenly | Reopen only when deploy hardening is re-prioritized
- ORKA-6n7 / ORKA-900 / ORKA-9yo | `missing_spec` (`null` bead bodies) | Cannot execute mandatory closeout/hot-file-lock lanes safely without defined scope + acceptance | Add explicit objective, file/function scope, and pass/fail criteria to each bead
- ORKA-f0l / ORKA-ksw / ORKA-njg / ORKA-pv3 / ORKA-hvj.4 | `missing_spec` (`null` bead bodies) | Unsafe to execute; high queue count but low executable throughput | Rewrite each bead with concrete objective, bounded scope, acceptance, and test requirements

## Resolved
- ORKA-zys | Repo-side `.beads/open` and `.beads/in_progress` mirrors were reconciled to live `bd` state, removing stale entries and adding the missing live open/in-progress cache files so local governance artifacts match the authoritative queue again.
- ORKA-daa4 | Double Attack had been implemented as an extra-turn scheduler proc, so QA could see proc counts without an immediate visible second attack. The runtime now treats Double Attack as a same-action free follow-up strike and retargets the follow-up if the original target dies before it lands.
- ORKA-qr88 | Duplicate heroes/enemies were still allowed in the underlying builders, but dev-tool slot edits only staged globals and idle layout still hardcoded its roster. Loadout edits now trigger the sensible active-layout rebuild path and idle layout consumes the dev-tool overrides, so duplicate slot changes visibly apply again.
- ORKA-u4h | Dev idle autoplay was leaving free frame-6 energy pickups on the board and could deadlock on an all-6 dev board; the idle autoplay seam now clicks frame-6 first and the fallback triplet picker follows the approved priority order instead of random color choice
- ORKA-6mq | Stale open mirror reconciled after verifying the current entity owner seam; repeated entity update faults already quarantine after the threshold and write stable diagnostics instead of silently continuing invalid runtime state
- ORKA-daa4 | QA needed a way to toggle the new explicit extra-turn harness without mutating combat state; dev tooling now stages Double Attack directly in the owner seam, and the missing Gem Counter Radiator DOM mount has been restored so holder/chance/proc count are visibly rendered
- ORKA-ju42 | Dev idle/autoplay could stall on pending manual target selection; the bypass now lives only inside the dev autoplay loop so idle runs continue without weakening normal manual targeting
- ORKA-mwl | Speed-only repeat-turn seam is now fenced behind explicit extra-turn skill configuration; live browser verification showed zero no-config grants and long-run 5% proc calibration stayed centered when the harness moved from Falie to Huun
- ORKA-c4s | Stale open mirror reconciled after restoring the persistence contract pack; current runtime still persists hero gem progress snapshots and milestone threshold/state seams, and the browser reload/restore path has been re-verified
- ORKA-fp9 | Stale open mirror reconciled after re-running the debuff lifecycle contract pack; current mirrored function-bank seams already satisfy the shipped debuff hardening lane
- ORKA-wuh | Core trait runtime/proc framework is already present in both function-bank mirrors and validated by `tests/traitHookFrameworkContract.test.js`; bead should be treated as completed queue reconciliation, not future implementation work
- ORKA-3m8 | Rewritten from `null` into an implementation-ready P0 bug bead targeting yellow completion handoff and deferred turn-advance gating in `web-runner/app.js`, then closed by restoring `tests/yellowTurnHandoffContract.test.js` and verifying the current seam still enforces a single gameplay handoff path
- ORKA-mwl | Reframed from a pure speed-based extra-turn bug into an implementation-ready extra-turn chance harness bead; repeated turns now require explicit provenance instead of deterministic speed-only scheduling
- ORKA-1qo | Node Playwright launch remained blocked in-sandbox, but the bead was recovered by adding CDP attach mode to an already-running Chrome instance and verifying a real smoke run that wrote all four balance-harness artifacts
- ORKA-cxi | Reverted ORKA-jj0 regression commits and restored pre-flyup baseline
- 2026-03-07: Multiple P0 beads in `.beads/open/` are underspecified (`null` body only): ORKA-6xs, ORKA-6mq, ORKA-3m8, ORKA-890, ORKA-9ng, ORKA-z0b. Cannot execute safely under Beads scope rule without acceptance/scope body.
- 2026-03-08: Audit rule added: before reporting blockers, reconcile `.beads/open` against existing contract tests and live repo state to avoid false "blocked" claims on already-shipped beads.
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
