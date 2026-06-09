# Web Runner Assets DOX

## Purpose
- Own runtime data and media consumed by the browser runner.
- Keep generated and hand-authored runtime assets from becoming hidden gameplay-code owners.

## Ownership
- `layouts.json`, `objectTypes.json`, and `enemies.json` are structured runtime data.
- `simulation_core.wasm` is generated from `rust/simulation_core/`.
- `images/`, `gems/`, and `fonts/` are presentation assets referenced by render/runtime code and tests.

## Local Contracts
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
