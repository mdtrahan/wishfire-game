id: ORKA-bar
title: [UI] Fix enemy HP bar distortion in combat (orange gradient)
priority: P1
status: done

## Objective
Remove visual distortion/stretch artifacts on enemy HP bars in combat.

## Scope
- Audit enemy bar draw math and scaling.
- Ensure stable dimensions/rounding and sprite sampling quality for bar layers.
- Keep current HP/yellow lag behavior unchanged.

## Acceptance
- Enemy HP bars render cleanly with no visible distortion in combat.
- Orange/yellow gradient banding and stretch artifacts are eliminated.
- No gameplay logic changes.

## Completion Note (2026-03-08)
- Enemy HP bar render path now snaps coordinates/sizes to integer pixels.
- Bar sprite layers disable image smoothing to avoid orange gradient stretch artifacts.
- Fill/yellow lag behavior is unchanged; only visual stability/sampling changed.
