# Browser Automation Backend Contract

## Purpose
Standardize browser automation on `agent-browser` CLI and prohibit legacy browser-automation runtime/test code paths.

## Backend
- Approved backend: `agent-browser` CLI only.
- Disallowed backend: deprecated JS browser-driver API usage.

## Invocation Policy
- All automation must run through explicit CLI commands.
- Each command execution must capture:
  - `stdout`
  - `stderr`
  - exit code
- Any non-zero exit code is a hard failure.

## Required Command Pattern
```bash
agent-browser open <url>
agent-browser wait <selector|ms>
agent-browser snapshot -i
agent-browser close
```

## Test Integration Contract
- Node tests may orchestrate browser steps only by shelling out to `agent-browser`.
- Hidden wrappers over deprecated browser-driver APIs are not permitted.
- E2E browser tests should be opt-in via env gates where server/browser availability is not guaranteed.

## Replacement Mapping (Implemented)
| File | Previous Browser-Automation Usage | Replacement |
|------|-----------------------------------|------------|
| `tests/gemInteractivity.spec.js` | JS-driver test API and page navigation calls | Rewritten as Node test invoking `agent-browser` CLI (`open`, `wait`, `snapshot`, `close`) with hard exit-code checks |
| `AGENTS.md` | Legacy browser-validation wording | Updated policy text to `agent-browser CLI` |
| `web-runner/app.js` | Legacy driver wording in test-hook comment | Updated to `agent-browser CLI` wording |
| `progress.md` | Historical legacy-driver wording | Updated wording to `agent-browser CLI` |

## Compliance Check
- Repository scan for banned legacy-driver tokens must return no matches in active code/docs.
