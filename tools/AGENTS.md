# Tools DOX

## Purpose
- Own repo automation for local serving, browser QA support, Rust WASM builds, Beads/Git support, and harness execution.

## Ownership
- `serve_web.js` serves the browser runner and writes `web-runner/runtime-fingerprint.js`.
- `balance_harness.js` is the canonical batch game automation path.
- `ui_presentation_lock_gate.mjs` is the canonical fail-closed rendered presentation gate for approved responsive UI seams.
- Playwright doctor, launch matrix, and Chrome CDP helpers diagnose browser startup/control issues.
- Rust build helper generates the browser WASM artifact.
- Hot-file, cleanup, archive, and Beads/Git visibility helpers support repo workflow.

## Local Contracts
- Do not create a second batch game-test pipeline beside `npm run balance-harness` without explicit scope.
- Keep `npm run test:ui-lock` presentation-only. It may arrange deterministic test state through `window.__codexGame`; it must not become a balance or gameplay simulation harness.
- UI lock failures must name the viewport, invariant, measured value, allowed range, and JSON report path.
- The UI lock runs reference, compact, approved natural-preview, and compact-Retina viewports; it records requested and actual viewport/zoom/DPR metrics, covers stage containment, developer controls, transient combat controls, damage density, progress-bar height, skill-draught draw/hit routing, and can prove rejection through `--prove-rejection`.
- Treat Playwright/Chrome tools as support tools unless the user asks for that surface.
- `serve_web.js` intentionally writes a runtime fingerprint at server start; account for that generated file in diffs.
- Hot-file commit helpers own `.beads/hot-file-lock` metadata generation; do not hand-author scope files except when debugging the tooling.
- Tooling should not mutate runtime gameplay state except through explicit test/harness interfaces.

## Work Guidance
- Keep command output bounded and failure messages classifiable.
- For browser automation failures, distinguish browser startup/attach failure from game behavior failure.
- For Beads/Git helpers, preserve unrelated dirty files and avoid destructive cleanup without explicit approval.

## Verification
- Focused `node --test tests/playwrightSupportContract.test.js` or tool-specific tests.
- `npm run playwright:doctor` / `npm run playwright:launch-matrix` only when diagnosing browser startup/control.
- `npm run balance-harness` for bounded batch game automation.
- `npm run test:ui-lock` after changes to a listed UI presentation owner; inspect its compact, reference, natural-preview, and Retina screenshots before accepting new bounds.

## Child DOX Index
- None.
