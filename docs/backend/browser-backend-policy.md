# Browser Backend Policy

## Backend
- Browser automation backend is `agent-browser` CLI only.

## Explicit Ban
- Playwright is deprecated and forbidden for new or existing browser automation paths.
- Forbidden categories:
  - Legacy JS browser-driver imports/usages.
  - Legacy browser MCP recommendations.
  - Legacy browser-driver dependency additions.

## Validation Requirement
- Before browser automation is used in a run, execute:
  - `agent-browser --help`
- If the command fails or returns non-zero exit code:
  - Stop execution.
  - Report error.
  - Do not proceed with browser automation tasks.

## Execution Standard
- Use explicit CLI commands only.
- Capture stdout and exit code for each command.
- Treat non-zero exit codes as hard failures.

## Non-Compliance Handling
- If Lead or any agent reintroduces deprecated browser-driver tokens/usages:
  - Reject the patch.
  - Require correction before handoff approval.
  - Log the violation in `ai-memory/insights.md`.
