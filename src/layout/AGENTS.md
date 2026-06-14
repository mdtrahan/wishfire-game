# Source Layout DOX

## Purpose
- Own reusable layout descriptors and registration for runtime layout transitions.

## Ownership
- `registerLayouts.js` and `registerHarnessLayouts.js` register layout descriptors.
- `*Layout.js` files define descriptor ids, allowed transitions, systems, and enter/active/exit behavior.

## Local Contracts
- A layout descriptor must provide `id`, `allowedTransitions`, `onEnter`, `onExit`, and `onActive`.
- Combat layout requires a `CombatRuntimeGateway` and should suspend/resume combat state through that gateway.
- Layout code owns transition behavior and input-domain coordination, not combat rules or rendering implementation details.
- Allowed transitions should be intentional; do not silently broaden routing to bypass a test.

## Work Guidance
- Add or update layout tests when changing descriptor ids, transition rules, snapshot behavior, or registration.
- Keep layout payloads small and explicit.
- If a layout change affects player-facing navigation, also inspect `web-runner/app.js` wiring and render modules.

## Verification
- `node --test tests/layoutState.test.js`
- Focused layout/navigation tests for touched surfaces.

## Child DOX Index
- None.
