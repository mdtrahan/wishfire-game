# Approved Bag upgrades

Owner-approved 2026-10-18; implemented under ORKA-0gu. This contract supersedes the earlier four-purchase and seven-hour construction flow, including older player-guide wording. The guide itself remains unchanged under its separate edit policy.

## Progress and transactions

Essence earned through existing gameplay fills one smooth progress bar toward the entire next-level cost. Level Up spends that full cost and immediately grants one earned Bag level after the durable save succeeds. Reaching the target, opening a menu, syncing and clock expiry never grant levels automatically. The bar caps visually at 100%; surplus Essence remains available after purchase. No intermediate notches, installment purchases, construction deadline or speed-up control remain. This introduces no new passive income or time-conversion formula.

Preserve current tuning: 100 Bag levels; capacity `20 + round(10 × (level − 1)^1.5)`; next-level cost `round(400 × 1.2^(level − 1))`; existing fractional rarity weights, draw cadence, item rolls and Hero EXP. Capacity and odds apply to future generation without rerolling stored equipment. MAX cannot spend again.

Transactions retain the Web Lock and expected-tier guard. Save failures or stale/concurrent requests cannot spend twice, promote twice or display an unsaved reward. Supported v5 paid-stage saves receive `floor(levelCost × paidStage / 4)` Essence credit once, including fully paid construction. Keep their earned level and other balances intact. Remove imported stage/deadline fields from the next saved record; preserve the original raw record at `wishfire.equipment-economy.v5.before-bag-upgrades`. Reject invalid imported values or unsafe arithmetic without replacing the original.

## Approved presentation

Use the supplied revision layout: centered Bag Upgrade Lv.N header, level-transition medallion strip, five full-width rounded rarity pills, breathing space, a slate progress/action inset with `Bag Capacity X > Y` beside progress, separate probability footer and a detached gray rounded-square X underneath. Retain Common, Uncommon, Rare, Epic and Legendary labels. Menu-only colors follow the supplied gray, green, teal, orange and red pills, with their edging and outlined white text; equipment rarity frames elsewhere retain their own palette. Current and next rates use the actual source values. The pictured 750 / 1000 state is illustrative, not a changed economic cost.

The completion window reuses the original turquoise Bag and the existing gold obtained/fanfare presentation. Show Upgrade Complete, the new Bag level and `Bag Capacity X > Y`. End the frame shortly beneath that reward text. Omit odds, Continue and explanatory notes. One shared CSS rounded-square X floats below either window with a clear background gap; it never touches the panel border or probability footer. Both controls use the same code-drawn shape and close behavior; reference-derived close art is rejected. Preserve keyboard focus and Escape closure.

## Proof and rollback

Rollback code ref: `checkpoint/ORKA-0gu-before-bag-upgrade-20261018`, commit `847a9ad93a06090b3d59fbb12a7af3f5a7d37a4a`. Pre-edit root dirt and the native browser's game saves are preserved under `output/ORKA-0gu/` in the coordination checkout. Restoring saved records is a separate action from reverting code; keep the newer records backed up before any restore.

Focused economy/transition tests cover persistence, supported imports, overflow and the full 100-level curve. `test:lamp-ui` includes isolated production-component geometry and interactions at reference, compact Retina, narrow and natural sizes. Inspect final screenshots and exercise the normal full-app controls through the collaborative preview; component fixtures alone do not certify gameplay or integration readiness.
