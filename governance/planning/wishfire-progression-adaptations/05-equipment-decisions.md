# 05 — Equipment decisions and dismantling

**Goal:** Give the player a complete comparison batch and a quick, predictable Auto Equip option.

## Rules

Raw draws enter storage without filtering. The arrival strip keeps chronological arrivals; a stronger item never replaces an earlier arrival merely because of CP. Opening storage renders the complete batch together, sorted by descending item CP from top to bottom. Proposed batch stability: pause emission while reviewing equipment.

Use one selected hero with directional navigation and current equipment visible. Compare matching hat/body/boots slots. Show item level, rarity background, signed total hero CP change and HP, ATK, DEF, MAG, RES in that order. Keep numeric columns left-aligned. Manual Equip may accept a downgrade.

Auto Equip selects at most four items, one per hero. Every replacement must increase that hero's total CP and match its slot. Resolve equal gain using lowest current maxHP, then stable party order. This deliberately trades optimal allocation for speed.

Float the actual CP delta while the portrait stays still. Keep subsequent selections responsive. Only the final departure from the equip modal waits for its CP floats to finish.

Finishing or skipping transfers leftovers into visible, irreversible dismantle storage. They cannot return to equipment. Dismantle All converts once, grants essence without EXP and clears stale strip/cache references. Show a centered DISMANTLED banner with one essence asset and the total awarded for about three seconds, followed by a fast fade. It requires no close action.

## Acceptance

Use a batch larger than five containing upgrades, equal CP and downgrades. Verify simultaneous inventory rendering, descending order, manual downgrade and Auto's four-hero limit. Rapidly equip multiple items and inspect CP floats. Finish with count zero and an empty arrival strip after conversion. Reload/double-tap must not duplicate resources. Capture the asset, amount and timed disappearance of the banner.

## Dependencies and approval

The storage, comparison and dismantling rules are owner decisions already given. Approve review-time emission pausing and the wording/action that finishes manual review if these are new behavior. Preserve the existing helper hand and selected-item halo.
