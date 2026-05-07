# Architecture Snapshot

## Render Modules

- `web-runner/systems/renderHUD.js`
- `web-runner/systems/renderHeroScreen.js`
- `web-runner/systems/renderMap.js`
- `web-runner/systems/renderBoard.js`
- `web-runner/systems/renderCombatRuntime.js`
- `web-runner/systems/renderOverlays.js`
- `web-runner/systems/renderRuntime.js`
- `web-runner/systems/renderSystem.js`
- `web-runner/systems/renderHarnessFallback.js`
- `web-runner/systems/renderTomes.js`
- `web-runner/systems/renderArtifacts.js`
- `web-runner/systems/renderMounts.js`
- `web-runner/systems/renderCollectibles.js`
- `web-runner/systems/renderRelics.js`
- `web-runner/systems/renderPets.js`
- `web-runner/systems/renderIdleFarm.js`
- `web-runner/systems/renderEvolution.js`
- `web-runner/systems/renderHomestead.js`
- `web-runner/systems/renderChests.js`

## State Modules

- `web-runner/state/mapLayoutState.js`
- `web-runner/state/uiState.js`

## Input Modules

- `web-runner/systems/inputHandling.js`

## Runtime Purification Status

- `web-runner/app.js` now delegates the main combat frame work through `renderRuntime.renderRuntime(runtimeScope)`.
- `web-runner/systems/renderRuntime.js` is partially purified.
- `presentationPatches` are returned and applied in `app.js`.
- `visualControlPatches` are returned and applied in `app.js`.
- Recent runtime-scope gaps found during live browser testing were wired back into `runtimeScope`, including yellow-sequence timing constants and enemy turn gate helpers.
- Live in-app browser validation completed for three combat runs to visible `0/150` energy with no console errors after the current fixes.

## Remaining Technical Debt

- `renderRuntime.js` is still a large mixed runtime module and remains only partially purified.
- Combat progression, refill sequencing, and board mutation timing still live inside runtime flow and have not been moved back behind a clean read-only render contract.
- `renderRuntime.js` still depends on a broad `runtimeScope` surface from `app.js`; this contract is functional but fragile.
- `app.js` still carries orchestration load for layout routing, runtime scope assembly, UI patch application, and several gameplay-side handlers.
- A dead-code and duplicate-helper sweep is still pending; no cleanup was done in this checkpoint.
