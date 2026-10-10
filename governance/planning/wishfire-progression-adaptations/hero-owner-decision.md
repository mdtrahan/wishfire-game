# Return after merge: hero ownership repair — ORKA-5af.3

Direction recorded from the owner on 2026-10-09. Resume this repair after the pending game work is safely integrated.

## What went wrong

Combat gives Fara a temporary actor ID. The progression helper treats that ID as a permanent save key and creates another hero record. The menu equips the original record; combat reads the duplicate. The defect already exists on main at `2429777f`.

## Required repair

Each hero has one permanent progression and equipment owner, identified separately from their display name. Combat actors are explicit, disposable copies that reference that owner. Creating or discarding an actor cannot create a saved hero or loadout. Permanent-state changes pass through the owning progression/inventory APIs; temporary combat stats and effects stay with the actor.

Use Fara, Hondo, Runa and Kaja in current documentation and UI. Retired names belong only in the one-time migration input map. Remove the earlier proposal that temporary copies should own independent saved progression.

## Existing-save reconciliation

Preserve the original hero records, inventory and loadouts together before migration. Keep the greatest earned progression across duplicate records without summing duplicated EXP. Retain claimed-reward watermarks. Keep the menu's equipped item when slots conflict and return displaced items to inventory. Preserve currencies/resources and current HP/KO. An interrupted migration must recover the original state or finish once on reload. Ambiguous ownership stops that save's migration with its original data intact.

## Proof before the repair merges

Entering, leaving and repeating combat, including disposable copies, must keep saved hero count and IDs unchanged. Equip/unequip/reload must project the intended gear once and make menu and unbuffed combat base stats/CP agree. Verify divergent old saves, conflicting items, duplicate rewards, interrupted writes and HP/KO. Reuse shared progression and existing inventory transactions; update current consumers and required mirrors. Keep app.js orchestration-only.

## Order of work

Record this note, resolve the pending branch's separate integration regressions, validate and merge that game work, then implement ORKA-5af.3 from the resulting main. The inherited ownership defect does not itself block that merge. Check ownership before assessing balance tuning; retain the current EXP curve, lamp cadence and authored combat values during this repair.

Integration checkpoint: the committed current game stack and this follow-up are on local main at `bd3c81d7`. Resume ORKA-5af.3 from that main; see the [integration report](../../../goals/current-stack-integration-report.md). Full recovery remains in the private cloud-preparation checkpoint. This merge did not implement the ownership repair or rewrite player saves.
