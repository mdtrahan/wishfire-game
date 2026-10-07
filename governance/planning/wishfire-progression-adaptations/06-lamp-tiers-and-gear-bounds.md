# 06 — Lamp tiers and gear bounds

**Goal:** Essence upgrades the lamp while party progress bounds item power and early rarity access.

## Verified reference

[Shana upgrade evidence](reference-evidence/shana-lamp-upgrades.md) confirms a 6,000-coin tier 1→2 upgrade, five-minute countdown and one tutorial ticket consumed for completion. Rare odds improved 5%→8%, and HR unlocked at 1.5%. Tier 3's preview is visible; its full cost is unknown. No storage benefit appeared in this panel. These prices cannot establish a Wishfire essence price.

## Proposed trial

Retain capacities 20 → 30 → 40 → 50 as the candidate progression. Current essence costs 20, 50 and 100 remain provisional baseline values pending an income trial. Propose one instant essence-funded upgrade action, with capacity and rarity benefits explicitly shown per tier. Countdown stages and acceleration currencies require separate approval. Preserve the current tier rarity weights, then apply party minimum gates: Common/Uncommon Lv1, Rare Lv5, Epic Lv12 and Legendary Lv20. Both lamp tier availability and party eligibility must pass. Renormalize eligible weights to 100%; the upgrade screen shows effective current and next odds.

Roll item level uniformly from max(1, lowest party level − 1) through lowest party level. Preserve its earned level thereafter. This replaces the current chapter-based level proposal only after approval. Define stat scaling once so level is not applied twice.

Every generated equipment type rolls positive HP alongside ATK, DEF, MAG and RES. Exclude SPD. Show level on storage, comparison and other equipment tiles specified by the owner.

## Price calibration and preview

US-36 owns creation of the lamp upgrade modal: current lamp level, current/next rarity percentages and essence consumption to upgrade. Reuse existing tier and resource hooks where available. US-25 calibrates prices. No reward for holding essence or timing a purchase is proposed.

Measure successful draws, quality/item level, equipped versus dismantled counts, essence awarded, essence consumed by upgrades and active time per review batch. Include unlucky batches and upgrade-heavy batches that leave little gear to dismantle. Use earned resources and normal draw cadence. Derive candidate prices from measured essence per batch and an owner-approved number of batches between upgrades; report expected minutes separately.

Show current/next lamp tier, exact total essence cost, balance and shortfall, capacity before/after and effective current/next odds for every rarity. Explain party restrictions. Previewing spends nothing. One confirmation deducts once and applies tier benefits together; insufficient funds change nothing. Preserve existing gear and display MAX at the final tier.

## Acceptance

At party Lv1, show no Epic or Legendary eligibility. Cross a rarity gate and compare displayed effective odds with generation rules. Use deterministic boundary checks to supplement the video for rare events; label any staged rarity fixture as QA evidence. Show an upgrade deducting essence once, increasing capacity and leaving Party EXP unchanged. Check price against deduction, insufficient funds, repeated taps and reload after confirmation. Provide the income ledger and video of preview, confirmation and resulting benefits.

## Dependencies and approval

Approve rarity gates, level band, stat scaling, costs and legacy gear treatment. Keep capacity and rarity improvements visible per tier. Approve the target batches/time between upgrades and resulting prices after the income ledger is available. A timer needs its own design decision covering useful activity while waiting, persistence and acceleration. See the [planned goal](lamp-upgrade-goal-plan.md).
