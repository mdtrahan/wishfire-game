# Web Runner Assets DOX

## Purpose
- Own runtime data and media consumed by the browser runner.
- Keep generated and hand-authored runtime assets from becoming hidden gameplay-code owners.

## Ownership
- `layouts.json`, `objectTypes.json`, and `enemies.json` are structured runtime data.
- `simulation_core.wasm` is generated from `rust/simulation_core/`.
- `images/`, `gems/`, and `fonts/` are presentation assets referenced by render/runtime code and tests.

## Local Contracts
- `narrative/characters/` contains the existing Hondo, Fara, Kaja, and Runa scene sprites. Content character IDs resolve these filenames through the narrative renderer; the opening uses the existing solo/pair shot contract.
- Do not hand-edit `simulation_core.wasm`; rebuild it with `npm run rust:build-wasm`.
- Treat `layouts.json` as large structured data from the retired Construct surface. Use JSON-aware edits and keep gameplay rules in code/product docs.
- Asset filenames are often referenced directly by render code and tests; rename only with a full reference search.
- Do not store secrets or environment-specific paths in assets.

## Work Guidance
- For enemy/data changes, verify the runtime loader and tests that consume the data.
- For image/font changes, run visual/browser QA if the changed asset is visible in `web-runner`.
- For layout JSON changes, keep diffs as narrow as possible and validate JSON parseability.

## Verification
- `node --test` focused tests for consumers of changed data.
- `npm run rust:build-wasm` after Rust changes that regenerate `simulation_core.wasm`.
- Browser visual QA for visible asset or layout changes.

## Child DOX Index
- None.

- `narrative/chapter-1-map.png` is a terrain-only 360x640 background. `chapter-town-token.png` is a separate transparent token; chapterMapPresentation.mjs owns overlay positions and labels.

- Navigation badges in images/navigation are transparent 128px object-only illustrations designed to read at 40–50px: bold silhouettes, broad color blocks, minimal interior detail; preserve six labels and hide the shared menu during dialogue. Generation prompts accompany the assets.

- Never bake UI into gameplay backgrounds: headings, dividers, chapter labels, map tokens and buttons must be independent rendered layers. Baked UI is allowed only in mockups or simulated screenshots.
