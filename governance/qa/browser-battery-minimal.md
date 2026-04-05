# Minimal Browser Battery

## Goal
- Give the repo one cheap, repeatable browser battery that separates startup problems, runtime handshake problems, and visual-artifact capture problems.
- Avoid creating a second browser pipeline.
- Keep the battery small enough to run often.

## When To Use
- Use when a bead touches browser-visible behavior and we need a quick repeatable QA baseline.
- Use when Playwright or `agent-browser` results are flaky and we need to know which layer failed first.
- Use when a visual change needs a screenshot artifact but does not justify a full session sweep.

## Not For
- Do not use as a replacement for bead acceptance.
- Do not use for non-browser work.
- Do not turn this into a second long-running automation system.

## Inputs
- Local game URL.
- Optional scenario-specific interaction step for the current bead.
- Optional CDP URL when the environment already has an attached external browser.

## Setup
### Services
- `agent-browser` CLI is the default browser backend for this battery.
- `npm run playwright:doctor` remains the startup/attach classifier when browser startup itself is suspect.

### Parameters
- `BROWSER_BATTERY_URL`
- `BROWSER_BATTERY_E2E=1`
- `BROWSER_BATTERY_CDP_URL`
- `BROWSER_BATTERY_DIRECT=1`
- `GAME_URL`

### Environment
- Run from the repo root.
- Save artifacts under `output/playwright/browser-battery/`.

## Steps
1. Verify the browser backend is reachable with `agent-browser --help`.
2. Open the game URL.
3. Wait for the app shell to appear.
4. Probe `window.render_game_to_text` and save the returned state.
5. Capture an interactive snapshot.
6. Save a screenshot artifact.
7. Collect page console output and page errors as diagnostics.

## Failures Overcome
- Browser startup denial.
- Browser control denial.
- Game boot without a usable render-state hook.
- Visual changes that need artifact review rather than a human memory check.

## Validation
- `agent-browser --help`
- `BROWSER_BATTERY_CDP_URL=http://127.0.0.1:9222 npm run browser:battery`
- `BROWSER_BATTERY_DIRECT=1 npm run browser:battery`
- For startup classification only, `npm run playwright:doctor`

## Outputs
- `output/playwright/browser-battery/render-probe.json`
- `output/playwright/browser-battery/render-state.json`
- `output/playwright/browser-battery/snapshot.txt`
- `output/playwright/browser-battery/browser-battery.png`
- `output/playwright/browser-battery/console.txt`
- `output/playwright/browser-battery/errors.txt`

## Constraints
- One scenario at a time.
- No new browser backend.
- No scenario-specific assertions without a bead that names the scenario.

## Safety Notes
- The battery is artifact-first, not pixel-diff authoritative.
- If the render hook fails, fix startup or the runtime seam before adding more probes.
