# Validation

## Purpose
- Keep validation focused, deterministic, and proportional to risk.
- Separate feature QA from merge readiness.

## Defaults
- Use existing repo test commands.
- Prefer focused deterministic validation over broad suites unless the touched surface requires broad proof.
- Use `git diff --check` for docs-only or markdown-heavy changes.
- Manual browser QA is acceptable for runtime behavior.
- For local visual/manual QA of the Rust app (`tools/build_wf_app.sh`, `tools/serve_wf_app.sh`, 127.0.0.1:8807), use the Codex in-app browser first. Use standalone Playwright, Chrome, or `agent-browser` only if Browser is unavailable, the user asks for another surface, or the check requires unsupported Browser capability.

## Test Tiers
- `npm run test:commit` checks staged whitespace, changed JavaScript syntax, affected deterministic tests and Rust unit tests when `rust/` changes. Direct Node checks ensure source-matched WASM before imports. It follows module/fixture dependencies and direct source references, excludes browser-driven tests, and retains commit compliance, storage and hot-file ownership checks. Target: under two minutes for typical warm commits. Existing lint/format scripts must join this tier when introduced.
- `npm run test:merge -- --base <pinned-main>` runs the retained Node suite and every Rust crate, including the frozen slice harness, after packing the atlas. The Rust cutover retired the JS browser owner routes. One verifier owns this run per final PR head; a changed head or integration base invalidates the receipt.
- `node tools/verify_rust_handoff.mjs --base <pinned-main> --head <pr-head>` builds isolated Git snapshots, runs native workspace/slice tests and the applicable merge tier on both refs, then compares failure names and seeded production-host replays. New failure names, build/command errors, replay crashes, soft locks and missed outcomes fail. Event digest changes and p50/p95 host-step timings are reported for review. `verdict.json` and `summary.txt` include exact refs, check timings and evidence logs.
- `--quick` reuses only the base receipt, keyed by SHA, verifier/replay source and toolchain, with content-checked logs. Head checks always run. `--gif` additionally captures each replay through the shipped renderer at 720x1280, 30 fps, 1x; see `tools/README.md` for dependencies and output/cache controls. Default verification needs neither a browser nor model calls.
- `npm run test:merge -- --staged` and `--all` remain available. `npm test` runs the retained Node tooling contracts. Full baseline-relative verification belongs at handoff, rather than every commit.
- Inspect the fast selection with `npm run test:commit -- --plan`; `--base <ref>` selects a committed range for verification. Report exact base/head, commands, pass counts and failures in the PR verifier receipt. Reuse that receipt across unchanged commits only when the validated final head is identical.

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
