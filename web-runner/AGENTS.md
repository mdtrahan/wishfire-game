# Web Runner DOX

## Purpose
- Own the browser-playable runtime: HTML shell, app orchestration, shipped assets, rendering/input systems, runtime modules, and browser-local core helpers.
- Keep browser integration separate from deterministic rule ownership.

## Ownership
- `app.js` is orchestration and composition wiring.
- `modules/` owns Construct-style runtime state and gameplay functions.
- `systems/` owns rendering, input, supergem runtime, persistence wrappers, dev tooling, and SimulationCore shadow wiring.
- `state/` owns small UI/layout state holders for browser presentation surfaces.
- `src/core/` owns browser-shipped ESM rule modules and runtime helpers.
- `assets/` owns runtime JSON, media, fonts, gems, and the shipped SimulationCore WASM artifact.

## Local Contracts
- Keep `app.js` thin. Add business logic to contextual modules or shared core files, then wire minimally through `app.js`.
- Before expanding `app.js`, read `governance/planning/app-js-thinning-playbook.md` and apply `governance/planning/js-orchestration-review-checklist.md`.
- Changes touching `app.js` must pass `npm run test:appjs-boundary`; update `governance/planning/app-js-ownership-contract.json` only when ownership policy changes, not to dodge extraction.
- JavaScript owns browser integration: Canvas rendering, input, menus, overlays, audio, save/load wrappers, deployment, and presentation timing.
- Rust SimulationCore owns deterministic simulation rule families that have owner markers and fixture contracts.
- Browser runtime code may apply returned state and render presentation events; it must not recompute Rust-owned outcomes.
- Do not store durable gameplay rules in render modules, asset JSON, or `app.js` when a module/core owner exists.

## Work Guidance
- Before editing, read the child AGENTS.md for the touched subfolder.
- Treat `app.js`, `modules/functionBank.js`, `systems/renderRuntime.js`, and `systems/simulationCoreShadow.js` as hot files.
- For gameplay behavior, start from `web-runner/modules/` plus shared `src/core/` or `web-runner/src/core/` rules.
- For visual behavior, start from `web-runner/systems/render*.js` and keep deterministic state changes outside render code.

## Verification
- Use focused `node --test tests/<relevant-contract>.test.js` first.
- For runtime/manual QA, start `npm run serve:qa` and use the Codex in-app Browser when a visual check is needed.
- For batch game automation, prefer the repo-owned `npm run balance-harness` path.

## Viewport QA Contract
- Read this file from the exact checkout being served before release QA. Guidance in another branch or worktree does not certify the current checkout.
- Treat the in-app Browser's natural CSS viewport as variable across Codex and Browser-plugin releases. Measure each visual pass; screenshot pixel dimensions are not viewport dimensions.
- Before changing layout code, inventory every app-owned presentation layer: Canvas drawing, Canvas hit zones, HTML launchers, HTML modals, and CSS overlays. Name the failing layer in the QA record.
- Record `document.documentElement.clientWidth/clientHeight`, `window.devicePixelRatio`, the canvas `getBoundingClientRect()`, the canvas backing `width/height`, and each visible app-owned DOM overlay rectangle with the QA evidence.
- Wishfire's reference layout is `360x640` logical pixels. Also validate a compact contained stage at `216x384` CSS pixels and the approved natural-preview `316x452` CSS viewport, which centers a contained `254x452` stage.
- Render from CSS-logical canvas dimensions (`canvas.width / dpr`, `canvas.height / dpr`). Scale type, portraits, panels, spacing, and hit zones from the same layout scale. Cap hard minimums so sibling widths plus gaps fit inside the logical viewport.
- Canvas-adjacent HTML overlays do not inherit the Canvas transform. Compare each overlay's width-to-canvas-width ratio and edge offsets between reference and compact captures. Keep ratio drift within 20% unless the user approves a design change; keep gutter controls fully outside the canvas.
- Scale viewport-fixed DEV launchers from the measured Canvas layout scale below the `360x640` reference size. They reserve zero rail width and use the available right gutter whenever the contained Canvas is narrower than the viewport.
- Fix only the failing layer and property. Preserve opacity, placement, scale, and interaction behavior unless the request or reference evidence changes them.
- Visual QA requires readable text, distinct controls, in-bounds hit zones, and no overlap, clipping, or truncated labels at both reference and compact sizes.
- Run the natural in-app Browser size first. When it is below `360x640`, classify that evidence as the compact pass and run a reference-size external-browser pass too. External-browser evidence alone does not clear a compact-layout regression.
- After the final visual change, reload and display the exact live page to the user. Earlier screenshots, source inspection, and green tests do not prove the currently displayed frame.
- A Browser viewport override is diagnostic evidence only. It counts only after measured CSS dimensions confirm it took effect, and it cannot clear a failure at the natural in-app size. Browser implementations may interpret override arguments as device pixels, so never infer CSS size from the request. Reset temporary overrides after QA.
- Before calling a release candidate QA-ready, visually inspect its final screenshot after the last reload. Any clipped text, truncated label, Canvas/DOM overlap, or material reference mismatch blocks push and deployment even when tests and console checks pass.

## Child DOX Index
- `web-runner/modules/AGENTS.md` - gameplay state, function registry, combat, skills, progression bridges.
- `web-runner/systems/AGENTS.md` - rendering, input, local persistence, supergem runtime, dev tooling, SimulationCore shadow.
- `web-runner/src/core/AGENTS.md` - browser-shipped deterministic rules and runtime helpers.
- `web-runner/assets/AGENTS.md` - runtime data, images, fonts, gems, and WASM artifact.
