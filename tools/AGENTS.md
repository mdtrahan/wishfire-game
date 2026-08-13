# Tools DOX

## Purpose
- Own repo automation for local serving, browser QA support, Rust WASM builds, Beads/Git support, and harness execution.

## Ownership
- `serve_web.js` serves the browser runner and writes `web-runner/runtime-fingerprint.js`.
- `balance_harness.js` is the canonical batch game automation path.
- Playwright doctor, launch matrix, and Chrome CDP helpers diagnose browser startup/control issues.
- `qa_presentation_gate.mjs` owns screenshot-first Canvas/DOM viewport regression proof and staged-source evidence.
- Rust build helper generates the browser WASM artifact.
- Hot-file, cleanup, archive, and Beads/Git visibility helpers support repo workflow.

## Local Contracts
- Do not create a second batch game-test pipeline beside `npm run balance-harness` without explicit scope.
- Treat Playwright/Chrome tools as support tools unless the user asks for that surface.
- `serve_web.js` intentionally writes a runtime fingerprint at server start; account for that generated file in diffs.
- Hot-file commit helpers own `.beads/hot-file-lock` metadata generation; do not hand-author scope files except when debugging the tooling.
- Tooling should not mutate runtime gameplay state except through explicit test/harness interfaces.
- Presentation-owned commits must carry a current automated-pass report, its screenshots, and explicit visual approval bound to the staged presentation source hash.

## Work Guidance
- Keep command output bounded and failure messages classifiable.
- For browser automation failures, distinguish browser startup/attach failure from game behavior failure.
- For Beads/Git helpers, preserve unrelated dirty files and avoid destructive cleanup without explicit approval.

## Verification
- Focused `node --test tests/playwrightSupportContract.test.js` or tool-specific tests.
- `npm run qa:presentation -- --bead <id>`, inspect its contact sheet, then run the `--approve` form before presentation commit preparation.
- `npm run playwright:doctor` / `npm run playwright:launch-matrix` only when diagnosing browser startup/control.
- `npm run balance-harness` for bounded batch game automation.

## Child DOX Index
- None.
