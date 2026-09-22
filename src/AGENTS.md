# Source DOX

## Purpose
- Own shared JavaScript contracts for deterministic rules and layout behavior outside the browser shell.
- Provide reusable logic that tests and runtime mirrors can depend on.

## Ownership
- `core/` owns deterministic rules, packet contracts, layout/input primitives, and CommonJS exports.
- `layout/` owns layout descriptors and registration helpers.

## Local Contracts
- Prefer shared deterministic logic here before adding new browser-shell behavior.
- Keep shared code free of DOM, Canvas, localStorage, deployment, and browser-global dependencies unless a child AGENTS.md explicitly permits it.
- `core/combatOrientation.mjs` owns the 360-wide combat arena contract: hero back-column center X 40, hero visible right edge 106, melee enemy home X 130, ranged/boss home X 225-283, hero attack range X 330, and shared spawn/home visible Y 71-276. Action animation may leave the Y band.
- The same owner derives the 10-pixel reference grid and 50-pixel major lines used by runtime placement QA.
- When shared behavior is mirrored into `web-runner/src/core/`, keep tests aligned and update both surfaces in one bead unless scoped otherwise.

## Work Guidance
- Add small pure functions with focused tests.
- Preserve CommonJS/ESM compatibility where existing tests or runtime imports require it.
- Avoid broad abstractions that do not reduce real duplication or clarify an ownership boundary.

## Verification
- Focused `node --test tests/<relevant-contract>.test.js`.
- Fixture tests when changing deterministic rule semantics.

## Child DOX Index
- `src/core/AGENTS.md` - deterministic rules, packet contracts, layout/input primitives.
- `src/layout/AGENTS.md` - layout descriptors and registration.
