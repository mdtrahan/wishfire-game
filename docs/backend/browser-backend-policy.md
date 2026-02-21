# Browser Backend Policy

## Backend
- Browser automation backend is `agent-browser` CLI only.

## Explicit Ban
- Playwright is deprecated and forbidden for new or existing browser automation paths.
- Forbidden categories:
  - Legacy JS browser-driver imports/usages.
  - Legacy browser MCP recommendations.
  - Legacy browser-driver dependency additions.
  - Agent requests to run Playwright without explicit PM exception recorded in repository artifacts.

## Validation Requirement
- Before browser automation is used in a run, execute:
  - `pwd` (must resolve inside repository root)
  - `git status` (pre-check)
  - `agent-browser --help`
- If the command fails or returns non-zero exit code:
  - Stop execution.
  - Report error.
  - Do not proceed with browser automation tasks.

## Execution Standard
- Use explicit CLI commands only.
- Capture stdout and exit code for each command.
- Treat non-zero exit codes as hard failures.
- Run `git status` after execution; any file change is a containment failure.

## Escalation Default
- Escalation is denied by default.
- If sandbox blocks execution, task fails unless PM explicitly authorizes escalation in repository artifacts.
- Do not auto-escalate.

## Handoff Gate
- PM must publish: `Containment guard active.`
- Lead must confirm containment before delegating.
- Dev must confirm containment before executing.
- Missing confirmation invalidates execution authority.

## Exception Policy
- Playwright remains hard-denied by default.
- Any temporary exception must be explicitly authorized by PM in repository artifacts, scoped to a named task, and time-bounded.
- No recorded PM exception means no Playwright usage.

## Non-Compliance Handling
- If Lead or any agent reintroduces deprecated browser-driver tokens/usages:
  - Reject the patch.
  - Require correction before handoff approval.
  - Log the violation in `ai-memory/insights.md`.
