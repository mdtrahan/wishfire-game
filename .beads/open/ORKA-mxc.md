id: ORKA-mxc
title: [UI] Replace Map 'Return Combat' button with Hero-style circle X close control
priority: P1
status: done

## Objective
Use the same Hero-screen circle `X` close control on Map layout and remove the `Return Combat` rectangular button.

## Scope
- Remove Map layout `Return Combat` button render and hit target.
- Add Hero-style circle `X` close control to Map layout.
- Wire close action to return to `combat` layout.

## Acceptance
- Map layout no longer renders `Return Combat` button.
- Map layout renders Hero-style circle `X` close control.
- Clicking/tapping the circle `X` on Map returns to `combat`.
- No regressions to map drag/pan behavior.

## Completion Note (2026-03-08)
- Removed Map layout rectangular `Return Combat` render path and button hit-target usage.
- Added Hero-style circle `X` close control on Map layout using shared close helper and Hero close asset fallback.
- Wired Map close hit (`closeHit`) to return to combat via `map-close-button`.
- Preserved drag/pan behavior for non-close input path.
