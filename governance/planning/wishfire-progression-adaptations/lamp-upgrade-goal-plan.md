# Planned goal — Clear lamp benefits and balanced essence prices

Status: owner-review plan. No goal started or gameplay code changed.

## Intended outcome

Create the US-36 lamp upgrade modal with current lamp level, current/next rarity percentages and an essence-funded upgrade action. One confirmed upgrade changes tier immediately, applies its benefits together and preserves hero EXP. Its price is grounded in measured dismantling income. No new essence meter, holding incentive or purchase-timing mechanic is added.

## Sequence after approval

1. Identify the lamp checkout, checkpoint and main integration state. Confirm ownership of tiers, essence, saves and dismantling; preserve stored gear and resolve overlap before editing.
2. Operate the approved draw/equip/dismantle flow with earned resources. Record essence per review batch and active time, including unlucky and upgrade-heavy batches. Agree on target batches/time per upgrade, then calculate candidate prices.
3. Reuse existing tier, essence, odds and capacity rules. Build the exact current/next preview and atomic confirmation, with affordability, duplicate-input and save protections. Keep Party EXP and equipment decisions intact.
4. Record draw → review/equip → Dismantle All → essence banner → upgrade preview → confirmation → new tier. Annotate price, deduction, odds, capacity and unchanged hero EXP. Test insufficient funds, repeated taps, reload and MAX. Correct failed criteria and replay the full flow before handoff.

## Dependencies and scope

This goal follows reliable fresh starts, separated progress displays, approved EXP pacing and equipment flow. Use their approved constants for income measurement. Shared deterministic modules own economy rules; browser modules render and orchestrate them. Keep new economy logic out of app.js.

Capacity progression and party rarity gates remain candidates. Final item-level/stat scaling affects resource income and must be settled for release balancing. Timers, premium currencies and acceleration tickets are outside this initial goal.

## Approval decisions

Approve instant upgrades, whether tiers couple capacity and rarity benefits, and target upgrade frequency. Final essence prices follow the measured ledger. Existing save migration, product-rule conflicts or unclear lane ownership stop affected implementation.

## Completion evidence

Continuous player-facing video, annotated frames, income/price ledger and acceptance matrix. Focused deterministic checks support normalized odds and atomic deductions. Supply a validated checkpoint and rollback route before integration. Silent tests alone cannot close the goal.
