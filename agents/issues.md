# Coordination Issues (Ambiguity / Drift)

## Unresolved
- ORKA-ao8 | `stale_parent` umbrella delivery-hardening bead has already been absorbed by later concrete guardrail lanes (`ORKA-9yo`, `ORKA-6n7`, `ORKA-njg`, `ORKA-pv3`) and should not remain in the executable queue | Queue noise risk: title sounds important but current body is too vague to validate | Keep stale/blocked unless a new concrete hardening gap appears that justifies rewriting it
- ORKA-5wj1 | `missing_spec` Astral Flow amp-bar lane has direction but still lacks executable acceptance/test contract for player prompt vs passive-chance branch and effect-end reset verification | Unsafe to implement because trigger UX, random bonus behavior, and reset timing can drift across turn-ownership seams without pass/fail checks | Rewrite bead with explicit acceptance criteria, non-goals, and deterministic/runtime validation requirements before re-selection; acceptance should state that the wild meter / amp bar reaches 100% at 5 matches
- ORKA-n0g | `future_stub` relic scaffold bead is intentionally non-executable until rewritten around remaining exclusive-slot/combat-accessory hook work | Ready-head churn risk if left open without rewrite | Keep deferred until rewritten/decomposed into executable scope
- ORKA-7w7q follow-up | `qa_gap` browser discovery proved the core `storyMock -> town -> combat -> mapLayout -> combat` loop is sustainable, but `Hero` and `Astral Flow` bottom-nav hit targets were not reliably click-verified under the same CDP QA path | Risk: broader layout-health claims would be overstated, and future UI regressions could hide in non-map nav hit-box ownership | Run a focused browser bead that classifies non-map bottom-nav hit boxes and records whether the issue is click geometry, transition gating, or layout-state ownership
- ORKA-6opp | `missing_spec` hero-specific red single-target presentation variants lack explicit acceptance, test requirements, and scope boundaries beyond a short description | Unsafe to implement because timing/cluster/impact differences can easily drift into combat readability or harness behavior changes without a pass/fail contract | Rewrite bead with per-hero presentation expectations, explicit non-goals, required test coverage, and whether existing Incinerate/Double Attack harness seams are in or out of scope
- ORKA-39i0 | `repeated_failure` fresh runtime proof shows the initiative turn-loop bug still exists on the red single-target path: after `HERO_SINGLE` executes, Huun can return to an immediately actionable same-turn state with `TurnSerial` still `0`, while blue/yellow initiative actions advance correctly | High player-facing combat risk and now a real executable bug lane, not stale queue noise | Fix the red attack handoff/ownership release seam, then rerun `output/playwright/orka-39i0-runtime-proof-complete.json` or equivalent end-to-end proof before closing
- ORKA-yy0 | `blocked` Netlify deploy/boot consistency remains tabled by product decision | Deployment confidence risk if release is requested suddenly | Reopen only when deploy hardening is re-prioritized
- ORKA-6n7 | `missing_spec` closeout-contract lane is still too abstract to execute safely against the shipped hot-file prepare/enforce workflow | High queue noise: it reads like ready P1 hardening even though it still needs a rewrite | Rewrite with concrete pass/fail behavior and explicit relationship to current repo-owned closeout tooling
- ORKA-njg | `missing_spec` regression-gate lane is still too abstract to sit at the ready head now that later beads already shipped several focused regression contracts | High queue noise and likely drift if implemented from the current text | Rewrite into a concrete remaining-gap bead before selection
- ORKA-f0l / ORKA-ksw / ORKA-pv3 / ORKA-hvj.4 | `missing_spec` (`null` bead bodies) | PM cycle cannot safely assign these lanes; high queue count but low executable throughput | Rewrite each bead with concrete objective, bounded scope, acceptance, and test requirements

## Current Blockers
- ORKA-macy
  - category: environment/tooling
  - blocker: 20-valid-pass evidence could not be completed because the harness/runtime stalled at the launch boundary

- ORKA-boj
  - category: environment/tooling
  - blocker: exact home-level MCP setup cannot be completed from this sandbox because writes to `~/.codex/config.json` are denied
  - blocker: npm package names from the task text are not published as written (`jcodemunch-mcp`, `jdocmunch-mcp`, `jcontextmunch-mcp`, `jcodemunch` all return `E404`)
  - working fallback: current session already has `jcodemunch` and `jdocmunch` MCP servers available; repo indexing completed through those servers and `.ai/retrieval_rules.md` was added

- 2026-03-21 | main | runtime syntax regression after collapse/merge: browser load currently fails before UI validation with `Uncaught SyntaxError: Unexpected token 'export'`; this is outside ORKA-cc9q scope and should be queued as a separate stabilization bug before broader runtime QA.
