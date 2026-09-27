---
name: webapp-testing
description: Use for Codex-Orka browser QA with the existing server and test tools.
license: Apache-2.0
metadata:
  source: "anthropics/skills"
---

# Codex-Orka Browser QA

Use the checkout being tested as the authority for commands and acceptance criteria. Read `governance/execution/validation.md` for browser routing and `web-runner/AGENTS.md` when visual or responsive behavior is affected.

- Start or reuse `npm run serve:qa` from that checkout. Its default port is 8000; use `http://localhost:8000/` and verify the served checkout before drawing conclusions. Server startup writes `web-runner/runtime-fingerprint.js`.
- Use the Codex in-app Browser first for manual and visual checks. Use another browser surface when explicitly requested or when a required capability is unavailable.
- Use the existing `npm run balance-harness` for batch gameplay checks. Use `npm run playwright:doctor` or `npm run playwright:launch-matrix` only to investigate browser startup or attachment failures.
- Read the current `package.json` before choosing an automated check. Playwright is already declared; reuse the existing installation and QA tools. Install or initialize tooling only when the requested work requires it and its scope authorizes that change.

Exercise the affected user flow, inspect its final rendered state, and check relevant browser errors. Fix failures caused by the requested change and repeat the affected checks. Report the served checkout, observed result, and any remaining blocker. A successful connection alone does not establish a passing visual result.
