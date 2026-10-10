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
- `core/combatOrientation.mjs` owns the 360x640 logical presentation frame, three-screen world bounds, fresh-entry formation center, and camera projection. At 0.5 battlefield zoom the camera presents 720 world units across a 360-unit logical viewport; fresh continuous combat starts centered in the middle 720-unit sector and HUD geometry remains in the original layout space. `core/arenaCombatRules.mjs` owns actor foot-point reach, delivery-specific range, facing and bounded travel. The continuous stage initializes those semantic fields; renderers consume them without advancing combat.
- The same owner derives the 10-unit reference grid and 50-unit major lines used by runtime placement QA. Hero formation Y and enemy actor Y denote the rendered sprite center; the renderer derives hero feet from that center.
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
