# Browser Backend Policy

## Current Backend Routing
- Use the Codex in-app Browser first for local `web-runner` visual/manual QA.
- Use standalone Playwright, Chrome/CDP, or `agent-browser` only when the Browser surface is unavailable, the user asks for that surface, or the check requires unsupported Browser capability.
- Use `npm run balance-harness` as the canonical batch game automation path.
- Treat Playwright/Chrome tools as support tooling for the balance harness, interactive inspection, startup/attach diagnosis, and spot checks.
- Treat `agent-browser` as the existing opt-in CLI smoke and snapshot/control surface, not the only approved backend.

## Explicit Ban
- Deprecated JS browser-driver imports/usages are forbidden.
- Legacy browser-driver dependency additions are forbidden.
- New browser automation pipelines are forbidden unless a bead explicitly scopes them.

## Validation Requirement
- Before browser automation is used in a run, execute:
  - `pwd` (must resolve inside repository root)
  - `git status` (pre-check)
  - the selected backend's lightweight availability check when relevant, such as `agent-browser --help`, `npm run playwright:doctor`, or a CDP `/json/version` probe
- If the selected backend cannot start or attach:
  - classify the failure as startup, attach/control, page/runtime, or game behavior
  - report the selected backend and failure class
  - do not treat one backend failure as proof that the game behavior failed

## Execution Standard
- Use explicit commands or the Codex in-app Browser surface.
- Capture enough output to classify failures.
- Treat non-zero validation exits as failures unless the command is diagnostic and the failure is the expected evidence.
- Run `git status` after automation that can write generated artifacts; unexpected file changes are a containment failure.

## Escalation Default
- Prefer the in-app Browser when it avoids local GUI or sandbox escalation.
- If sandbox blocks a required standalone browser command, request explicit approval and state which backend is being used and why.
- Do not route around the repo-owned harness or user-specified browser surface silently.

## Handoff Gate
- Browser QA handoffs must name the selected surface, test URL, steps, expected result, and any startup/attach preflight required.
- Missing backend or preflight evidence invalidates browser-automation claims.

## Exception Policy
- Playwright is not globally hard-denied; it is scoped support tooling.
- Use Playwright through the documented repo paths unless the user or bead explicitly requests another Playwright surface.
- Keep the Codex Playwright skill and Playwright MCP as inspection/debugging aids around repo-owned flows, not replacements for the balance harness.

## Non-Compliance Handling
- If Lead or any agent reintroduces deprecated browser-driver tokens/usages:
  - reject the patch
  - require correction before handoff approval
  - log the violation in `ai-memory/insights.md` when it is a bug/regression bead
