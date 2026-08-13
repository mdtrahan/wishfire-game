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

## Visual Layer Gate
- Inventory Canvas, DOM, and CSS overlay layers before diagnosing a visual mismatch. Identify which layer owns each visible element.
- Capture the same app state at reference and compact sizes. Record viewport, Canvas, and visible overlay rectangles; compare overlay-to-canvas ratios and edge offsets.
- Treat the natural in-app CSS viewport as the acceptance surface. A viewport override may isolate a cause, but it cannot turn a broken natural frame into a passing frame.
- When an override is used, record both the requested dimensions and the resulting `window.innerWidth`, `window.innerHeight`, and `devicePixelRatio`. Trust the measured CSS viewport rather than the override arguments.
- Preserve properties outside the reported defect. A scale fix does not authorize placement, opacity, styling, or interaction changes.
- Reload after the last edit, inspect the resulting frame, exercise affected controls, check console errors, and leave the verified page visible when the user is performing QA.
- Visual release and handoff are hard gates. URL reachability, a correct fingerprint, DOM presence, green tests, and a clean console do not replace inspection of the final screenshot.
- If the final natural-size frame has Canvas/overlay overlap, clipped text, truncated labels, or a material mismatch from the approved reference, mark the release unsafe and stop before push or deployment.

## Merge Readiness
- Use `governance/execution/integration.md` for QA PASS boundaries, baseline-relative validation, conflict classification, merge readiness, and integration debt reporting.
