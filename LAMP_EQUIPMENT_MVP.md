# Wishfire Lamp Equipment MVP · ORKA-0ln

Status: implemented in the isolated `codex/ORKA-0ln-lamp` review lane. Owner art and gameplay acceptance remains a human review. The feature replaces the former Gold equipment shop and shared inventory reassignment; it preserves the current continuous combat loop. This approved replacement supersedes shop-preservation instructions in the combat cutover plan.

## Publisher-quality definition of done

| Area | Required evidence |
| --- | --- |
| Art | Original illustrations referenced against the existing character art; coherent outlines, material shading and palette; readable phone silhouettes; no temporary glyphs as equipment art. Guardian is burgundy/brass, scholar teal/ivory, wayfarer moss/tan. |
| Fast decisions | Five visible results with rarity glow. Lamp on the right. Highest-level pending result previews the review action, with pending count. Inspection and collection work before storage fills. |
| Comparison | Four hero portraits and their per-stat changes above the candidate. Candidate graphic, a broad quality-colored banner, name, rarity, level and full ATK/DEF/MAG/RES/HP appear in the middle. Portraits are enlarged; column-heading and empty-equipment labels are omitted. Tapping a portrait enables named confirmation below. Changes use colored magnitude plus a filled up/down arrow on one line. Digits and arrows share a tightly bounded raster at display DPR; the arrow uses the digit’s measured alpha bounds. Actual screenshots verify matching painted pixel rows for both directions. |
| Transactions | A durable save precedes every displayed roll, spend, equip and dismantle. The same result cannot equip twice. Displaced gear remains visible for confirmed dismantling; equipped gear cannot be reassigned. No healing or revival on equip. |
| Progression | Deterministic map-stage rolls, persisted highest tier, all three slots and five qualities, upgradable cache capacity, lamp-only party EXP and no unattended leveling beyond a full cache. |
| Mobile | Reference 360×640, compact 216×384 at DPR 2, narrow 233×452 and natural 316×452. No horizontal overflow; comparison and actions remain contained, with vertical scrolling when needed. Reduced motion and keyboard selection work. |
| Verification | Focused rules/save tests, browser equip/reload/dismantle/Auto flow, layout assertions, screenshot inspection and live combat during inspection. Preserve and identify inherited failures. |

Automated checks certify behavior and geometry. They do not certify market retention, economy balance or publisher approval.

## Player flow

Tap the lamp to produce gear, then inspect any result immediately. Five positions start empty on each game boot and show only results emitted during that session; the pending tray starts at twenty. Auto starts off on each game boot and requires an explicit player toggle after all four heroes reach Lv5. Full storage switches Auto off and pauses production, and the player can review at any count. The storage bubble preview chooses the greatest item level, with higher rarity breaking ties. The five-slot emission strip preserves arrival order without CP replacement. It conveys quality rather than a guaranteed upgrade.

All four heroes can use every piece. Positive and negative comparisons use magnitude with green up or red down arrows; zero is neutral. Choosing a portrait asks “Equip to <name>?” and requires confirmation. Individual stat tradeoffs can be chosen manually. Manual Equip permits a deliberate equal/lower CP override and reports the resulting hero CP change.

A piece can only enter a loadout from a new pending lamp result. Its replaced piece enters visible dismantling storage and cannot move to another hero. Auto Equip processes the top four qualifying items by item CP, assigning at most one to each hero; unused candidates and all other gear enter dismantling storage. The player can finish review and explicitly dismantle remaining/displaced gear after seeing the stored pieces. The essence amount appears after confirmed conversion. Successful dismantling closes the review and shows a centered DISMANTLED strip with one essence orb and the awarded total for three seconds, then fades over 250ms without input. Closing preserves the pending tray. Hero → Gear is read-only.

No separate collector prop is rendered. The existing device atlas has unused collector cells; the runtime reads the lamp cell only.

## Generator and tuning

Only **Hat, Body, Boots**. Each new piece contains **ATK, DEF, MAG, RES, HP**; gear never adds SPD. Hero base HP/SPD and combat timing remain owned by the existing combat system.

Nine archetypes provide Guardian, Scholar and Wayfarer variants for each position. Guardian emphasizes DEF, Scholar MAG/RES, Wayfarer ATK. The highest visited generation context uses the existing continuous-stage region/stage adapter:

`ordinal = min(990, (region - 1) × 10 + stage - 1)`

`stat = max(1, round(archetypeStat × (1 + 0.005 × highestOrdinal) × rarityMultiplier × seededVariance))`

Variance is 0.8–1.2 independently per stat. Rarity multipliers are 1 / 1.18 / 1.42 / 1.7 / 2; active draw weights depend on lamp level (table below). White → green → blue → purple → gold communicates rarity consistently through glow, frames and names. Rarity can lose to a lower rarity piece because of archetype and variance. Seed and draw sequence are persisted, so opening/reloading a comparison never rerolls a piece.

Current MVP tuning: each free lamp draw grants 25 EXP to each of the four heroes through the existing per-hero level curve. Manual and Auto draws use the same durable grant and saved two-second minimum interval. The lamp disables during cooldown; rapid clicks and reloads produce no extra gear or EXP. All four heroes reaching Lv5 unlocks Auto, which produces one foreground item every five seconds. Cache capacity starts at 20; reaching capacity switches Auto off and awards no further EXP. Clearing space and explicitly switching Auto on resumes it. Backgrounding or pausing produces no offline catch-up burst.

Dismantling returns 1–5 essence per rarity and grants no EXP. The bank has no automatic level effect. Each lamp promotion requires four paid stages, then the player's Lv.UP action. Only promotion applies the next odds and capacity; it grants no EXP and never resumes Auto. Gold has no role in this loop. The strip shows actual lamp level and purchased stages, independently of party EXP.

The lamp now spans 100 levels. With `p = (level - 1) / 99`, the weight percentages are Uncommon `25 + 10p`, Rare `30p`, Epic `14p`, Legendary `p`, each rounded to three decimals; Common is the remaining percentage. This retains 75/25/0/0/0 at Lv1 and reaches 20/35/30/14/1 at Lv100. Capacity is 20, 30, 40, then 50 from Lv4 onward, preserving existing earned storage.

The full next-level cost is `round(20 × 1.082^(level - 1))`. For purchased stage `s` in 0–3, the next installment is `floor(total × (s + 1) / 4) - floor(total × s / 4)`. Four installments total the full cost exactly. Lv.UP requires all four saved receipts and charges no additional essence. The tier/stage preview protects concurrent purchases; promotion checks the previewed tier. Existing v5 records without stage receipts begin at zero purchased stages, retaining earned level, essence and exact gear.

New gear uses 0.5% linear map growth per ordinal, replacing 8%; saved pieces retain their rolls. Enemy scaling remains independently owned by combat, so slower gear growth requires encounter-balance playtesting alongside hero EXP, skills and defenses. The ordinal ceiling bounds unvalidated content rather than asserting 991 authored stages exist. [Pacing assumptions and the proposed quality ladder](goals/wishfire-lamp-progression.md) separate this delivered tuning from future owner decisions.

## Saves and migration

`wishfire.equipment-economy.v5` atomically owns cumulative party EXP, essence, capacity tier, purchased upgrade stages, exact rolls, assignments, pending collection, seed, sequence, Auto timing and salvage. Web Locks serialize writers. A failed equipment write grants no EXP and leaves runtime stats unchanged. Each hero saves `lampEXPClaimed` beside existing progression, so a reload between the lamp receipt and hero-save write replays the missing grant once. Live actors and saved heroes receive the same grant. Existing Gold balances and historical outbox receipts remain preserved for recovery; Gold is no longer the lamp fuel or a new enemy reward.

v4 migrates to v5 with zero new EXP/essence and the starting capacity. The v3 four-stat save migrates with HP zero; its existing rolls, assignments, currency and pending results remain unchanged. Earlier v2 saves preserve supported values including HP, fill missing ATK/DEF/MAG/RES from the original deterministic roll, and discard SPD. Original records remain for recovery.

Supported pre-lamp v1 Head/Armor/Boots migrate to Hat/Body/Boots; existing four combat stats remain, absent ones display zero. Retired weapon/accessory pieces and unequipped surplus convert to Gold once. Retired SPD is removed. Original v1 save data remains untouched. Malformed saves report an error and remain recoverable instead of being reset. Hero progression stays in its existing save.

## Validation and review boundaries

Run `node --test tests/lampEquipment.test.mjs tests/idleFarmLayoutScaffoldContract.test.js` and `npm run test:lamp-ui`. The phone gate starts its own temporary server unless `LAMP_QA_URL` is supplied. It writes `test-results/lamp/report.json` and per-viewport screenshots. The hot-file regression gate invokes lamp rules and phone checks for changed lamp presentation owners.

The inherited ORKA-p11 baseline fails the existing damage-text-scale UI lock at compact/natural/narrow/retina sizes. Lamp work does not alter that renderer. Baseline report: `../wt-ORKA-p11-realtime-role-combat/test-results/ui-lock/2026-09-30T03-54-41-395Z/ui-lock-report.json`.

Enemy deaths, victory, defeat and retry grant no new hero EXP or Gold. The existing hero level curve and cap remain; the lamp owns EXP delivery. Map unlock curves and long-term balance remain tuning work. No merge or publication is part of this review build.

Final automated evidence: 18 focused equipment/navigation checks, four app-boundary checks, 44 combat hot-file regressions, four-view phone UI gate and portable file:// lamp smoke. Asset provenance is stored in `web-runner/assets/images/lamp/ART.md`; it is documentation rather than an extra runtime JSON payload.

Checkpoint status: the local commit hook reproduces the inherited damage-text-scale failures in `test-results/ui-lock/2026-09-30T04-40-59-149Z/ui-lock-report.json`. The implementation remains staged, with a binary recovery patch under `output/qa/lamp-mvp-checkpoint.patch`. The hook has not been bypassed.

Painted-height evidence: `test-results/lamp/pixel-proof.json` and `*-stat-up.png` / `*-stat-down.png` record exact visible row bounds across all four phone sizes.

Auto Equip uses canonical permanent CP, compares slot replacement, and immediately commits through the existing saved equip transaction. Equal and negative CP gains are excluded; if nobody gains CP, the piece belongs in the dismantling return. Skip and manual portrait confirmation remain available.

Readability correction: comparison panel supports up to 560 CSS pixels, with larger portraits and more row spacing. Candidate stats span its full width; fixed label tracks give ATK/MAG and DEF/RES matching left edges. The phone gate checks six-digit values without shifting those edges or overflowing.

Auto Equip tie-break: equal projected CP gains choose the hero with the lowest current max HP. Current remaining HP does not affect this choice. Equal max HP falls back to displayed party order.

Rarity readability: gear illustrations show C (Common), U (Uncommon), R (Rare), E (Epic), L (Legendary) over their top-left corner; quality colors remain white/green/blue/purple/gold. Party-bounded item levels and rarity unlock thresholds remain tuning proposals, not delivered rules.


Pending gear fills five equal square columns across the review frame. Its scrolling viewport exposes one-and-a-half rows at each phone width; incoming rolls and recipient selection preserve frame height and scroll position.

Owner correction: actions are Skip, Equip, Auto-Equip. Skip preserves the current piece and advances review. Successful equip floats only the saved signed CP change for 1.8 seconds, anchored at the recipient portrait. Hero art stays in place; the accessible announcement names the recipient. HP is rolled on every new piece: base 5 for Hat/Boots and 10 for Body, using the existing rarity, progression and variance factors. Adding max HP never grants a heal or revival. These HP bases are initial MVP tuning.

Pending inventory uses filled rarity backgrounds (white, green, blue, purple, gold), with a separate gold halo on the currently compared item. Five columns fill the width; square art has a compact CP footer. Equip review shows one-and-a-half rows, while Dismantle All shows three-and-a-half rows.

The comparison is titled HERO GEAR UPGRADE, with Skip / Equip / Auto-Equip. After 15 seconds without input, a blue genie pointer bobs above cyan focus rings on Hondo. Selecting a hero starts a fresh 15-second window before guidance points to Auto-Equip. Any document click dismisses it; keyboard and wheel input also reset idle time. Guidance only appears during an available item comparison and does not intercept taps.

The combat strip contains the five recent gear results, a lamp centered vertically on their array, and a rarity-filled collection bubble with counter above Auto. Each gear graphic shows `Lv.<number>`. Strip rarity letters are doubled; the complete storage preview group is scaled to 65% while its button retains the original touch area. Strip text headings, Gold amount/cost and full-cache prose are removed. Auto displays a lock until all four heroes reach Lv5. The strip is hidden on quest/start/story menus and appears during combat.

Emission reuses the current lamp illustration with a tilt only. New gear pops upward, overshoots briefly and settles at full opacity and size. Emission clears after completion; reduced-motion presentation remains static.

- Raw lamp emissions append every roll without CP filtering. lamp.recent preserves the last five emission snapshots independently of equip/collection routing. Equip review sorts descending lampGearCP, derived from the shared CP evaluator using gear stats at neutral level 1; item level already scales those stats. Auto silently selects the top four slot-CP upgrades, greedily assigns at most one per hero, and also requires positive actual hero CP gain. Ties use lowest max HP then party order. Manual equip permits lower-CP overrides. Auto completion or finishing review moves all remaining pending pieces permanently into lamp.discarded. Dismantle All has an inert item grid, no rescue/review/equip controls and no resource amount before confirmation. Confirmed conversion grants essence only and shows its receipt. Later raw arrivals remain separate from the confirmed pile. Capacity includes pending, discarded and historical aggregate credits; full storage stops Auto/EXP. Optional recent/discarded fields preserve supported older v5 saves.

- Equip keeps its comparison frame and busy guard until the 1.8-second CP float finishes. The float belongs to the modal; remove it before advancing review or automatically closing, so it cannot bleed into combat.

- Confirmed dismantling closes the item modal and shows a passive essence reward strip with one original orb and the saved awarded total. Hold three seconds, fade over 250ms, remove automatically. No Close/Continue control; pointer events pass through to combat. Failed saves never show rewards.

- Arrival illustrations display only session emissions still in pending or discarded storage. Equipped and confirmed-dismantled pieces disappear from the strip; a zero cache leaves all five positions empty. Historical emission snapshots remain saved independently.

- Strip presentation uses supplied transparent lamp/puff rasters. Manual and Auto share one puff-before-bounce emission path. Larger five-position gear art retains quality glow and item level; AUTO is upper-right with on/off/locked pills. Controls and strip remain anchored to the existing 360×640 Canvas frame.

### Timed upgrades (2026-10-02 owner correction)

Purchasing the final of four essence installments records upgradeEndsAt for7hours later. Capacity, lamp level and drop odds remain current during construction; durable sync grants the upgrade automatically when due. Optional v5 deadline/ticket fields preserve existing saves. Legacy paid4/4 progress uses LEVEL UP to start the timer. The construction card centers a live countdown and changes its control to blue SPD UP ALL. Each saved ticket skips5minutes; spend only tickets required, preserve leftovers, and never grant tickets automatically.
