# Hero ownership repair decision — ORKA-5af.3

Status: proposed; no runtime/persistence changes in this lane. Owner selection is required by sheet01 existing-save treatment and the Implementation Gate persistence/data-model escalation.

## Verified cause

Lamp review, party progress and Auto eligibility select the first four canonical HeroProgress records. Combat constructs primary instance IDs falie#1/huun#1/runa#1/kojonn#1, attaches separate saved progression and projects equipment by those IDs. Hero details exposes every saved record and chooses live actors by exact instance ID; Gear also reads that ID. Primary records therefore duplicate the same player-facing hero, while canonical equipped gear does not reach combat. `output/qa/progression/guidance/source-projection-audit.md` records the failing shared-path and ordinary-play receipts.

Current supported duplicate heroes have independent combat-instance keys/formation positions. A fix must preserve that identity and prevent one item from increasing multiple independent heroes.

## Recommended contract for approval

The four named heroes keep canonical progression/loadout owners Falie/Huun/Runa/Kojonn. A primary combat actor keeps its unique instance/UID and explicitly references its canonical progression owner; additional same-class instances retain independent progression/loadouts. Lamp, party meter, Auto gate, Hero panel and actor stat projection use that owner consistently. Historical primary-instance records leave the ordinary roster after one approved migration; additional supported instances remain owned.

Returning saves preserve the more advanced of canonical and primary-instance progress, comparing total earned EXP across the retained current curve rather than summing duplicated lamp awards. Preserve cumulative lamp claims conservatively so already granted EXP cannot replay. Keep canonical equipped items when both primary records own the same slot; return conflicting instance-slot items to owned inventory. Preserve every item, rarity, roll, level, lamp resource, tier and currency. No migration reward, refund, healing or reset. Preserve current actor HP/KO, capped only by the selected owner's resulting max HP. Save original records for recovery before rewriting ownership. A failed or interrupted save must retain/recover the original state.

Alternative: combat instances own every primary progression/loadout, with explicit once-only canonical-to-instance migration. That changes the durable owner keys and forces pre-combat UI to resolve the supported primary instance identity. It still needs the same earned-state reconciliation and independent-gear guarantees.

## Implementation boundary and proof

Choose one contract before runtime edits. Reuse heroProgression attach/save, equipmentStorage transaction/projection and existing Hero details/Lamp/Gear consumers. Avoid a second inventory or alias compatibility layer. Focused tests must fail on the original projection and cover primary plus independent clone, saved-loadout conflict, earned-progress divergence, duplicate receipts, interrupted migration, KO/HP and reload. Player controls must show matching before/after actor and panel stats/CP. The full ordinary progression film is recorded after this seam passes.

Retrieval receipt: codebase-memory exposes only an unrelated temporary project. jcodemunch indexes current main5f48703; exact attachHeroProgress query returns no symbol because the preserved realtime foundation differs from main. Focused rg and narrow current-lane reads verified every attach/save caller, equipmentStorage, renderHeroScreen/Gear, lampUI, combat initializer and party builder. Large files were read only at matching functions.

Lane starts from guidance receipt ad7f1f918c9c824e5cf0315641535c955f977224. Preserve original root/lamp/upgrade/guidance lanes; no merge/publication. Pending EXP-source, Auto restart and rarity/income decisions remain separate. Current EXP/cadence tuning stays unchanged.

Runnable counter-evidence: `node output/qa/progression/hero-owner/diagnose.mjs` exits1 on the preserved foundation. The saved `before-repair.txt` reports canonicalCPGain12 with unchanged live actor stats and empty actorEquipment; the final assertion requires matching primary gear projection. This is the expected red check for the repair, with no runtime/save files modified.
