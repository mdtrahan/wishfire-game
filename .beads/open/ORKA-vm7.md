id: ORKA-vm7
title: [UI] Simplify combat text colors to fixed flat colors
priority: P2
status: done

## Objective
Remove gradient-based color scaling from floating combat text and replace it with fixed approved colors.

## Scope
- Update floating combat text color selection in the combat text renderer only.
- Use fixed colors:
  - damage_taken: `#FF4040`
  - healing: `#66CCFF`
  - Kojonn DoT / blight damage: `#AA66FF`
- Remove gradient/heat mapping logic for damage and heal text.
- Keep sizing, timing, rise, fade, and shadow behavior unchanged unless required by the fixed-color swap.

## Non-Goals
- No combat formula changes.
- No damage/heal amount changes.
- No DoT lifecycle or power-amp logic changes.
- No new gradient palette tuning; this bead removes scaling gradients instead of rebalancing them.

## Acceptance
- Damage-taken text uses flat `#FF4040`.
- Healing text uses flat `#66CCFF`.
- Kojonn DoT text uses flat `#AA66FF` and does not fall back to the generic damage color.
- Floating text no longer uses gradient interpolation or amount-based heat ramps.
- Existing damage/heal text timing and placement remain intact.
