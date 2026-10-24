# Approved Bag upgrades

Owner-approved 2026-10-18; implemented under ORKA-0gu. Cost curve and kill-point progress approved 2026-10-24 under ORKA-9ln. This contract supersedes the earlier four-purchase and seven-hour construction flow, including older player-guide wording. The guide itself remains unchanged under its separate edit policy.

## Progress and transactions

Enemy kills and Essence earned through existing gameplay fill one smooth progress bar toward the entire next-level cost. Ordinary, pack and lone enemy deaths grant 1 Bag kill point each; boss deaths grant 5. Kill points add no Essence, never convert to Essence and cannot fund other purchases. The versioned equipment economy saves non-negative safe-integer `lamp.killPoints`; missing or corrupt values load as zero. Per-kill durable receipts prevent replay across duplicate settlement and reload. MAX accrues no points. Level Up spends kill points first, then Essence for the remaining cost, carries surplus kill points forward, and immediately grants one earned Bag level after the durable save succeeds. Reaching the target, opening a menu, syncing and clock expiry never grant levels automatically. The bar caps visually at 100%; surplus Essence remains available after purchase. No intermediate notches, installment purchases, construction deadline or speed-up control remain. This introduces no new passive income or time-conversion formula.

Preserve current tuning: 100 Bag levels; capacity `20 + round(10 × (level − 1)^1.5)`; next-level cost `round(100 × exp(b*n − K*(1 − cos(2*pi*n/P))))` for `n = level − 1`, `b = ln(1.07)`, `a = 0.8`, `P = 10`, `K = a*b*P/(2*pi)`; existing fractional rarity weights, draw cadence, item rolls and Hero EXP. Capacity and odds apply to future generation without rerolling stored equipment. MAX cannot spend again.

Cost stays flat within each level and rises across all 99 payable levels, with a minimum integer step of 1. References: L1 100, L2 105, L5 112, L10 181, L11 197, L15 221, L20 356, L21 387, L31 761, L51 2946, L71 11399, L91 44110, L99 71410. The first 20 costs total 3759; tier 99 (level 100) has null cost. Existing saves keep their earned level and balances without refund; the next upgrade uses the new cost.

Tuning constants are owner-adjustable at any time without re-approval.

Transactions retain the Web Lock and expected-tier guard. Save failures or stale/concurrent requests cannot spend twice, promote twice or display an unsaved reward. Supported v5 paid-stage saves receive `floor(levelCost × paidStage / 4)` Essence credit once, including fully paid construction. Keep their earned level and other balances intact. Remove imported stage/deadline fields from the next saved record; preserve the original raw record at `wishfire.equipment-economy.v5.before-bag-upgrades`. Reject invalid imported values or unsafe arithmetic without replacing the original.

## Approved presentation

Use the supplied revision layout: centered Bag Upgrade Lv.N header, level-transition medallion strip, five full-width rounded rarity pills, breathing space, a slate progress/action inset with `Bag Capacity X > Y` beside progress, separate probability footer and a detached gray rounded-square X underneath. Retain Common, Uncommon, Rare, Epic and Legendary labels. Menu-only colors follow the supplied gray, green, teal, orange and red pills, with their edging and outlined white text; equipment rarity frames elsewhere retain their own palette. Current and next rates use the actual source values. The pictured 750 / 1000 state is illustrative, not a changed economic cost.

The completion window reuses the original turquoise Bag and the existing gold obtained/fanfare presentation. Show Upgrade Complete, the new Bag level and `Bag Capacity X > Y`. End the frame shortly beneath that reward text. Omit odds, Continue and explanatory notes. One shared CSS rounded-square X floats below either window with a clear background gap; it never touches the panel border or probability footer. Both controls use the same code-drawn shape and close behavior; reference-derived close art is rejected. Preserve keyboard focus and Escape closure.

## Proof and rollback

Rollback code ref: `checkpoint/ORKA-0gu-before-bag-upgrade-20261018`, commit `847a9ad93a06090b3d59fbb12a7af3f5a7d37a4a`. Pre-edit root dirt and the native browser's game saves are preserved under `output/ORKA-0gu/` in the coordination checkout. Restoring saved records is a separate action from reverting code; keep the newer records backed up before any restore.

Focused economy/transition tests cover persistence, supported imports, overflow and the full 100-level curve. `test:lamp-ui` includes isolated production-component geometry and interactions at reference, compact Retina, narrow and natural sizes. Inspect final screenshots and exercise the normal full-app controls through the collaborative preview; component fixtures alone do not certify gameplay or integration readiness.
