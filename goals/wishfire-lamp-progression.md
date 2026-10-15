# Lamp progression and quality ladder · ORKA-5af.16

## Delivered review-lane behavior

Essence remains available until the player purchases an upgrade stage. Four purchases fill four blue sockets; each saves its own receipt. The button then becomes Lv.UP. Only that action advances the earned lamp level, resets the sockets, and applies the new drop odds and storage capacity. Bank changes, collection, opening the menu and reloads grant no stages or levels. The strip and menu use the same earned level and purchased-stage record. No notification bubble or timer is added.

Existing lamp levels, essence, exact item rolls, hero EXP and loadouts remain saved. Old v5 records without a stage field begin at zero purchased stages. Stale tier/stage clicks and failed writes preserve currency. Draw cadence and EXP amounts retain current tuning.

The five current qualities remain runtime keys. Their starting/final odds are now distributed across 100 earned lamp levels, with at most 0.558 percentage-point change in one quality per promotion. Capacity remains 20/30/40/50 at levels 1/2/3/4 onward. Each level costs `round(20 × 1.082^(level − 1))` essence, divided into four integer installments that total the full cost. The manual promotion has no additional charge. Total cost from Lv1 to Lv100 is 596,397 essence.

Future gear's map factor changes from `1 + 0.08 × ordinal` to `1 + 0.005 × ordinal`. This is additive scaling against archetype base, with integer stat rounding and the existing rarity/variance factors. A single low-level step can therefore leave a displayed stat unchanged. At the ordinal ceiling of 990, the map factor is 5.95×. Saved gear is never rerolled. Combat's separate enemy curve remains a balance-testing dependency; the slower equipment curve alone cannot certify map clearability.

## Two-year pacing hypothesis

The model assumes a constant daily draw count, 90% of gear dismantled, current 1–5 essence salvage values, zero starting essence, and all essence spent on lamp stages. For each lamp level, expected essence per draw comes from that level's actual rounded rarity weights. Expected days equal the sum of `levelCost / (dailyDraws × 0.9 × expectedEssencePerDraw)`.

| Draws per day | Auto emission time per day | Expected days to Lv100 |
| --- | --- | --- |
| 150 | 12.50 minutes | 1,968 |
| 250 | 20.83 minutes | 1,181 |
| 400 | 33.33 minutes | 738 |

Emission time excludes cache/equip interactions. These estimates describe the lamp track under stated behavior, rather than measured retention or overall game lifespan. Existing banks shorten the track. More play, future salvage rewards, economy events and additional qualities will change the estimate. Live draw counts, dismantle share and essence receipts should determine later tuning. The reproducible numeric result is stored locally in `test-results/lamp/paid-stages/pacing-model.json`.

## Proposed qualities, awaiting owner decision

Recommend twelve qualities: **Common → Uncommon → Fine → Rare → Superior → Epic → Heroic → Legendary → Mythic → Ancient → Celestial → Divine**.

Use roughly 5% power steps between qualities as a starting hypothesis, about 1.71× across eleven intervals. Gate the higher tiers behind earned lamp milestones, then shift drop probability gradually with purchased promotions. Preserve clear color bands and full names in detail views; continue omitting corner initials. The names, multipliers, unlock milestones, colors and probability rows remain proposals.

Adoption requires a save-safe quality mapping, revised essence yields and a fresh pacing model. Existing item stats should remain exact when keys are mapped. The current five-quality runtime and saved items stay supported until that migration is approved and validated.
