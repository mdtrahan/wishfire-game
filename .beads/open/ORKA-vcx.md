id: ORKA-vcx
title: [UI] Reuse Hero-screen X-circle close control across Vault family layouts
priority: P1
status: done

## Objective
Standardize Vault-family layout close controls by reusing the Hero screen close button design (same circle + X visual and placement behavior).

## Scope
- Identify Vault-family layouts that currently use non-hero close controls.
- Replace those close controls with the Hero-screen close control asset/style.
- Keep existing close behavior/routing unchanged per layout.

## Acceptance
- Vault-family layouts use the same close control visual as Hero screen.
- Close hit-target remains reliable on portrait gameplay scale.
- No behavior regressions in close routing (returns to intended parent layout).

## Completion Note (2026-03-08)
- Replaced `Back To Vault` button visuals in Vault child layouts with Hero-style circle `X` close control.
- Reused Hero close geometry scaling and close asset fallback drawing for Tomes, Artifacts, Mounts, Collectibles, and Homestead layouts.
- Preserved close behavior to return to `chestsLayout` (Vault home) and kept combat-back buttons unchanged.
- Updated vault navigation contract tests to enforce close-control usage and routing.

## Reopen + Completion Note (2026-03-08)
- Fixed runtime regression `ReferenceError: closeWinOvalImage is not defined` by passing the close image into the close-control helper (`drawHeroStyleCloseControl`) instead of reading an out-of-scope variable.
- Applied the same Hero-style circle `X` close control to base Vault (`chestsLayout`) and wired it to close back to combat.
- Updated Vault header text from `Chests (Scaffold)` to `Vault`.
- Extended contract coverage for chests close control wiring and helper image injection semantics.

## Final Closure (2026-03-08)
- User QA PASS confirmed.
