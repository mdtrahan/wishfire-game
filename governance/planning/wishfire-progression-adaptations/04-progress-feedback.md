# 04 — Progress feedback

**Goal:** Players can distinguish hero progression from lamp upgrading and witness every rollover.

## Proposed presentation

Show Party level with numeric current EXP and the next threshold. If heroes differ, the shared summary represents the lowest hero level and its progress; individual hero panels disclose their own values. A successful draw shows the actual EXP awarded. Level-up feedback identifies the party/hero progression that changed.

Lamp tier uses essence toward its next upgrade cost. Label this separately from Party EXP. After an upgrade, display the new tier and next cost; the maximum tier has a clear MAX state. Spending essence never changes hero EXP. US-36 creates the lamp upgrade modal with current level, rarity percentages and essence consumption. Shana confirms device tier changes independently of hero level.

The hero EXP meter computes its settled fill from the current remainder. Overflow survives a hero level transition. Preserve the approved strip geometry, puff-before-item reveal, scale/bounce arrival and selected inventory halo.

## Two progression tracks

Hero EXP: successful stored lamp draws award all four heroes; level costs govern hero advancement and overflow. Dismantling awards no hero EXP. A separate party display identifies this progression. Battle EXP/Spend EXP policy is unresolved and must be settled before implementation.

Lamp progression: US-36 creates the essence-consuming upgrade modal and exposes the current level and rarity improvements. Hero level-ups cannot change lamp tier. There is no separate earned lamp EXP currency or strategic essence-holding mechanic.

See [US-35](user-stories.md) for the proposed hero EXP display change.

## Acceptance

Capture before, crossing and settled states for two consecutive hero level-ups. Show a partially filled meter after reload. Upgrade the lamp and prove its tier/essence display changes while Party EXP stays constant. Compare annotations at the same viewport for label sizes and positions.

## Dependencies and approval

Requires the final EXP and lamp tier models. Owner must choose where the Party meter lives; the redesigned lamp badge can remain lamp tier with essence progress. Existing UI that labels party progression as lamp progression must be reconciled before proof is accepted.
