# Hero management and Astral Flow equipment migration

Implementation is in the owned ORKA-49k.7 worktree. It is not merged or deployed.

## Runtime behavior

The existing hero screen now has HERO / GEAR / SKILLS views for the same selected hero. Portrait, role, named AF trait, level, HP, ATK, SP and CP remain visible. A compact roster changes the inspected hero without leaving the screen. HERO shows EXP and three upcoming unlocks; full stats expand on demand. SKILLS separates seven actives, six passives and the unique FLOW special, with level locks and SP costs. Basic Attack remains inspectable separately.

GEAR shows six slots around the hero and a filtered/sorted inventory grid. Selecting an item shows its stats and the current item in the matching slot. Equip transfers one owned item instance to that hero; unequip returns it to available inventory. Ownership is shared with the shop. Stats update through the canonical progression calculation and apply to live actors and future battle initialization. Equipment changes preserve KO and do not heal the hero.

The Astral Flow navigation destination now contains four staggered downward equipment tracks. Each offer shows its identity, rarity and Gold price. Inspection leaves all offers moving. A purchase revalidates the live offer, affordability and unique instance before saving Gold and ownership together. Expired offers cannot be bought. Leaving the screen stops its drawing/reconstruction; seed and elapsed wall time determine the offers on return. No hidden collector or resource-claim loop remains.

## Placeholder data

- Slots: Weapon, Head, Armor, Boots, Accessory 1, Accessory 2.
- Sixteen shared equipment definitions with reusable placeholder SVG art.
- Rarities: Common / Uncommon / Rare / Epic / Legendary.
- Relative rarity weights: 60 / 25 / 10 / 4 / 1.
- Gold price multipliers: 1 / 2 / 5 / 12 / 30, on a 30-Gold base.
- Travel duration: 32 seconds for every offer.
- Per-track spawn spacing: 9–13 seconds, independently staggered.
- Victory Gold: 10 per defeated enemy by default; enemy goldValue may override it. Awarded once on victorious settlement and shown in results.

These values live in canonical data/config, rather than rendering code.

## Ownership and persistence

`web-runner/src/core/equipment.mjs` owns items, rarity data, slots and loadout stat sums. `astralMarket.mjs` owns deterministic live offers and purchase validation. `combatPower.mjs` reuses the existing CP formula.

`web-runner/systems/equipmentStorage.mjs` owns the versioned local record containing Gold, item instances, loadouts and market time/seed. It migrates the existing Gold save on first use. Web Locks serialize transactions across tabs; one localStorage write commits the purchase. Failed storage writes leave runtime Gold and inventory unchanged. Cross-tab storage events refresh the shared record. Browsers without Web Locks fail closed for purchases.

The displaced idle collector runtime, renderer, claims, tick call and development loadout restart paths have been removed. The existing navigation ID is retained to preserve routes.

## Preserved behavior and limits

Combat FLOW still comes only from enemy-death orbs and goes to random living heroes. Named AF role traits are displayed from existing hero data; they do not restore retired direct-charge rules. SP spending/regeneration, skill counts, CTB scheduling, targeting and combat outcomes remain under their existing owners.

CP uses the established formula: ATK + DEF + Max HP / 10. It does not currently score MAG, RES, SPD or situational skills. This migration displays that metric without changing its balance formula.

The market uses local device time with a persisted time floor and unique purchased IDs. It is a local save system, not a server-authoritative anti-cheat service. No premium currency, automatic buying, item enhancement or inventory capacity limit was added.

## Verification

- Full Node suite: 873 tests, 800 passed, 0 failed, 73 explicitly historical skips. Log: `/tmp/orka-equipment-complete-suite.txt`.
- App orchestration boundary: 4 passed. `app.js` gained 12 lines and removed 46 lines.
- Final browser gate: 265/265 invariants passed across compact, reference, natural-preview, live-narrow and compact-Retina profiles.
- Rendered receipt: `test-results/ui-lock/2026-09-08T21-51-41-128Z/ui-lock-report.json`. Each profile includes `astral-market.png`, `hero-gear.png`, `hero-overview.png` and combat/settlement captures.
- Inspected final compact marketplace and reference Gear screenshots, plus the natural in-app preview at a 507×903 canvas, DPR 2. Hero summary visibly includes CP, SP and Stoic.
- Natural absence proof: captured offer IDs, left the shop, confirmed hidden card positions stayed unchanged, returned after expiry, and found zero original offers remaining. Gold remained 0 before/after; no browser errors.
- `git diff --check` passes.

Browser purchase fixtures use isolated test wallets; the user's preview wallet is preserved. No merge or deployment was performed.

## Shop presentation revision

Owner correction replaces the initial dark aurora bands with a full, saturated rainbow bridge and gentle pearlescent shimmer. Gold, Resources and Energy now share the existing Quests resource-strip presentation. Back uses the same curved SVG control. Resource purchasing remains future scope.

The authored native WebGL fragment shader follows the time/resolution approach documented in [WebGL Fundamentals](https://webglfundamentals.org/webgl/lessons/webgl-shadertoy.html). It runs from the shop's visible draw path, at most 30 FPS and 360 pixels across, with reduced-motion and static-gradient fallback. No dependency added.

Retrieval: focused rg and full reads of the two small UI owners were used because these uncommitted worktree modules are newer than the indexed repository baseline. Shared chrome extracted from questLadderUI.mjs; app.js only injects the existing resource getter.

Final presentation validation: shop browser test passed at 216x384 DPR2, 360x640 DPR1 and 316x452 DPR1, including moving shader frames, reduced-motion stillness, all balances, developer-control clearance and the shared lower-left Back anchor (86 reference pixels above the bottom). Ten equipment/quest tests and four app-boundary checks passed. Full UI-lock baseline timed out in waitForReady before the shop; this revision does not claim a full gate pass. Natural in-app final screenshot inspected; browser errors empty. Screenshots: test-results/shop-rainbow/. Changes remain uncommitted.

## Drag purchases and upgrade hints

The compact bottom tray accepts equipment dragged from the live stream. Drop performs the existing atomic purchase and places the exact item in shared hero inventory without a confirmation modal. Tap inspection and BUY remain available for keyboard and click use. Offers continue expiring during drag, with the same affordability and expiration checks at commit.

Inventory tiles now use rarity-colored beveled frames, larger art and type badges. Green arrows indicate an unequipped compatible item with at least one stronger stat and no weaker stats; accessories compare against both compatible slots. Equipped slots also show arrows when such an inventory upgrade exists. No new power-score formula was invented.

Validation: seven equipment contracts passed; isolated touch/mouse browser checks passed at compact Retina, reference and natural-preview sizes. Verified exact spending, immediate inventory grant, absent confirmation dialog, lower tray geometry and upgrade markers.

## Pearly background revision

Owner selected Undertones 1 as a visual reference. Its Pro-locked implementation was not accessed or copied. The authored shader now uses luminous diagonal pearl folds, with soft blooms colored by each live item rarity and positioned from its timed stream progress. Drag positions never feed the shader. Layout, purchase behavior and item scheduling remain unchanged. Browser shader/reduced-motion/touch/mouse checks passed in the existing three profiles.
