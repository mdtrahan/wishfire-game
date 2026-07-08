# Validation

## Purpose
- Keep validation focused, deterministic, and proportional to risk.
- Separate feature QA from merge readiness.

## Defaults
- Use existing repo test commands.
- Prefer focused deterministic validation over broad suites unless the touched surface requires broad proof.
- Use `git diff --check` for docs-only or markdown-heavy changes.
- Manual browser QA is acceptable for runtime behavior.
- For local `web-runner` visual/manual QA, use the Codex in-app browser first. Use standalone Playwright, Chrome, or `agent-browser` only if Browser is unavailable, the user asks for another surface, or the check requires unsupported Browser capability.

## Runtime And Regression Work
- Bug/regression beads must update `ai-memory/insights.md` with reusable heuristics, not event logs.
- Hot-file work must run the narrowest relevant hot-file or boundary validation.
- Rust/WASM ownership changes need Rust, WASM, and JS boundary checks appropriate to the touched seam.

## Merge Readiness
- Use `governance/execution/integration.md` for QA PASS boundaries, baseline-relative validation, conflict classification, merge readiness, and integration debt reporting.
