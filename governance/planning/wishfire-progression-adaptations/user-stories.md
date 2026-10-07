# Proposed additions and changes: user stories

Status: owner review only. This revision contains proposed feature changes and additions. Existing lamp rewards, Auto gate, raw storage, sorting, CP floats, dismantling, HP rolls and helper behavior are prerequisites covered by their specs.

Earlier US identifiers are preserved so review references remain stable. Removed entries described existing requirements or delivery checks. Baseline values below come from the previously inspected lamp lane and must be rechecked before implementation. Approve, revise or defer each remaining story.

## US-05: Raise early level costs

As a player, I want early leveling to require sustained play so each milestone feels earned.

**Proposed change:** Replace the current early EXP curve with trial costs of 500, 750, 1,000 and 1,500 EXP for levels 2–5.

**Acceptance:** At the existing 25 EXP per draw, lamp-only progression takes 150 draws to Lv5. Measure a natural session against the proposed 22–30 minute target.

**Decision:** Approve costs and target; settle battle EXP and a smooth curve after Lv5.

[Related spec](02-exp-and-cadence.md)

## US-06: Change the lamp draw interval

As a player, I want time to read and act between draws so progression rewards decisions.

**Proposed change:** Replace the reported two-second manual minimum and five-second Auto interval with a shared eight-second trial interval.

**Acceptance:** Manual and Auto obey the same interval. Test whether the added waiting overwhelms useful combat or gear decisions before accepting the tuning.

**Decision:** Approve the interval for testing; reject it if waiting dominates play.

[Related spec](02-exp-and-cadence.md)

## US-15: Pause lamp generation during equipment review

As a player, I want the item batch to stay stable while I compare it so the choices do not change underneath me.

**Proposed change:** Suspend lamp emission while the equipment review is open. The existing sorted inventory remains the basis for review.

**Acceptance:** No new draws or draw EXP occur during review. Leaving it follows the approved Auto resume policy.

**Decision:** Approve pausing and whether previously enabled Auto resumes afterward.

[Related spec](05-equipment-decisions.md)


## US-25: Reprice upgrades from essence income

As a player, I want the next lamp upgrade to fit normal resource earnings so it is a useful objective.

**Proposed change:** Replace provisional essence costs of 20/50/100 with prices derived from measured normal-play income and an approved upgrade frequency.

**Acceptance:** Measure equipped and dismantled results across ordinary, unlucky and upgrade-heavy batches; report expected batches and minutes per upgrade before selecting prices.

**Decision:** Approve target upgrade frequency; final prices follow the measurements.

[Related spec](06-lamp-tiers-and-gear-bounds.md)

## US-26: Add party-level rarity gates

As a player, I want stronger rarities to become available as my party develops so early drops preserve progression.

**Proposed change:** Add party gates alongside lamp-tier odds: Rare at Lv5, Epic at Lv12 and Legendary at Lv20.

**Acceptance:** Locked rarities have zero effective chance. Allowed chances normalize to 100% and the upgrade preview explains the gate.

**Decision:** Approve proposed levels and which party-level measure controls eligibility.

[Related spec](06-lamp-tiers-and-gear-bounds.md)

## US-27: Tie gear levels to party levels

As a player, I want new gear levels to track my party so rewards stay relevant to the adventure.

**Proposed change:** Replace chapter-derived gear levels with a random band from lowest party level minus one through lowest party level, bounded at Lv1.

**Acceptance:** New items stay in the approved band. Stat scaling applies once; previously earned items retain their level under an approved migration policy.

**Decision:** Approve the band, scaling and existing-item treatment.

[Related spec](06-lamp-tiers-and-gear-bounds.md)

## US-30: Extend guidance through lamp upgrades

As a player, I want guidance connecting gear review, dismantling and lamp upgrades so I understand the resource loop.

**Proposed change:** Extend the existing helper with state-based steps for reviewing gear, collecting dismantle resources and previewing an affordable lamp upgrade.

**Acceptance:** Steps complete from actual actions, once. The helper points to a useful available action and explains upgrade value before spending.

**Decision:** Approve the added steps and their completion conditions.

[Related spec](07-guidance-and-defeat.md)

## US-35: Separate hero EXP from lamp progression

As a player, I want hero EXP displayed independently of the lamp’s upgrade progress so I know which level my actions advance.

**Proposed change:** Give the party its own numeric EXP display and level-up feedback. The lamp strip badge represents lamp tier; it must not be used to imply a hero level-up.

**Rules:** Successful stored lamp draws award the existing EXP to all four heroes. The proposed cost curve is in US-05. Show each hero’s level, current EXP and next threshold in the hero view; the shared summary discloses which hero it represents if levels differ. Overflow carries forward. Draws blocked by storage grant no EXP. Dismantling grants no hero EXP.

**Acceptance:** Record a draw award and two hero level transitions, with new thresholds and remainder fills. Lamp tier stays unchanged during hero level-ups. Reload preserves both values independently.

**Decision:** Approve the party meter location and summary rule. Battle EXP and manual Spend EXP remain unresolved; the story does not select either policy.

[Related spec](04-progress-feedback.md)

## US-36: Create the lamp upgrade modal

As a player, I want to upgrade my lamp with essence so it produces higher-rarity gear more often.

**Proposed addition:** Create a lamp upgrade modal displaying the current lamp level, current rarity percentages, next-level rarity percentages and the essence cost to upgrade.

**Acceptance:**

- Opening the modal shows the current lamp level and the effective percentage for each gear rarity.
- The next-level preview shows which rarity percentages increase and the required essence amount.
- Confirming an affordable upgrade consumes the stated essence once, increases the lamp level and applies the new percentages to subsequent draws.
- The modal updates to the new level, percentages and next upgrade cost. Insufficient essence prevents the upgrade and displays the shortfall.
- The new level persists after reopening the game. Hero EXP and stored gear stay unchanged.

**Decision:** Review the rarity percentage progression and essence costs. Price calibration remains US-25. Timers and speedup items require separate approval.

[Related spec](06-lamp-tiers-and-gear-bounds.md)

## Research holds and withdrawals

- **US-08/09/10:** Removed from feature approval. Only one skill was exercised. All five slot conditions, skill acquisition through gacha, ally acquisition, information exposure and acquisition versus equipping remain untested. No level milestones or free Unlock action can be presented as an observed adaptation.
- **US-31:** Withdrawn. Actionable defeat advice was an original design suggestion without reference observation.
- **US-23:** Consolidated into US-36 so the lamp modal and its rarity preview are one feature story.
- **US-32:** Withdrawn under owner direction. Wishfire lamp draws remain unlimited over time, bounded by storage and the approved cadence. No combat-earned charge resource.

## Delivery requirement

Every approved change requires the existing [player-facing video proof](09-player-facing-proof.md). Proof is a completion condition rather than another feature story. The [lamp goal plan](lamp-upgrade-goal-plan.md) remains unstarted.
