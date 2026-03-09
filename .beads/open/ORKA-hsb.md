id: ORKA-hsb
title: [FEAT] Wire hero screen +/- buttons to skill point spend actions
priority: P0
status: done

## Objective
Make hero screen skill +/- controls functional instead of visual-only.

## Scope
- Wire + button to `AttemptHeroSkillUpgrade` for the selected hero/skill row.
- Add downgrade handler and wire - button for selected hero/skill row.
- Keep existing hero screen layout/visuals unchanged.

## Acceptance
- Clicking + spends points and upgrades skill rank when valid.
- Clicking - downgrades one rank and refunds last spent cost when valid.
- Hero screen values update immediately after click.

## Completion Note (2026-03-08)
- Hero layout hit zones now include per-row +/- controls.
- + invokes `AttemptHeroSkillUpgrade`; - invokes `AttemptHeroSkillDowngrade`.
- Added downgrade/refund path in both runtime and Scripts function banks.
