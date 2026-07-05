# Browser Automation Backend Contract

## Purpose
Route browser automation through the smallest current surface that can prove the behavior, while keeping deprecated browser-driver APIs out of active code and docs.

## Current Routing
- For local `web-runner` visual/manual QA, use the Codex in-app Browser first.
- Use standalone Playwright, Chrome/CDP, or `agent-browser` only when the Browser surface is unavailable, the user asks for that surface, or the check requires unsupported Browser capability.
- Keep batch game automation on the repo-owned `npm run balance-harness` path. Playwright/Chrome helpers support that path; they are not a second batch pipeline.
- Keep `agent-browser` for the existing CLI smoke path and for tasks that specifically need its CLI snapshot/control model.

## Disallowed Paths
- Deprecated JS browser-driver imports/usages are still forbidden.
- Hidden wrappers over deprecated browser-driver APIs are not permitted.
- Do not add a new browser automation dependency or second harness without an explicit bead scope.

## Invocation Policy
- Browser automation commands must be explicit and scoped to the current bead or QA handoff.
- Capture enough command output to classify failures: browser startup, attach/control, page/runtime, or game behavior.
- Treat non-zero command exits as failed validation unless the command is exploratory and the failure is the evidence being collected.
- E2E browser tests should stay opt-in via env gates where server/browser availability is not guaranteed.

## Backend Map
| Surface | Current role |
| --- | --- |
| Codex in-app Browser | First choice for local `web-runner` visual/manual QA. |
| `npm run balance-harness` | Canonical batch game automation path. |
| Playwright + Chrome/CDP helpers | Support tooling for the balance harness, interactive inspection, startup/attach diagnosis, and spot checks. |
| `agent-browser` CLI | Existing opt-in CLI smoke path and CLI snapshot/control support surface. |

## Historical Replacement Mapping
| File | Previous Browser-Automation Usage | Replacement |
|------|-----------------------------------|------------|
| `tests/gemInteractivity.spec.js` | JS-driver test API and page navigation calls | Rewritten as Node test invoking `agent-browser` CLI (`open`, `wait`, `snapshot`, `close`) with hard exit-code checks |
| `AGENTS.md` | Legacy browser-validation wording | Now routes local `web-runner` visual/manual QA to the Codex in-app Browser first, with Playwright, Chrome, or `agent-browser` as scoped fallbacks |
| `web-runner/app.js` | Legacy driver wording in test-hook comment | Updated to non-driver dev browser hook wording |
| `progress.md` | Historical legacy-driver wording | Historical archive only |

## Compliance Check
- Repository scan for banned legacy-driver tokens must return no matches in active code/docs.
- Active browser routing docs should not claim `agent-browser` is the only approved backend or that Playwright is globally hard-denied.
