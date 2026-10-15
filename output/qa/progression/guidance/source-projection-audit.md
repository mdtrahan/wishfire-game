# Gear projection defect — ORKA-5af.3

Observed on the ORKA-5af.2 preserved foundation, before any identity repair. This is diagnostic evidence only.

`web-runner/app.js` composes equipment storage with the live entities. Lamp review selects the first four saved canonical hero records. `combatSessionInitializer.js` preserves deployed party instance keys, e.g.falie#1. `attachHeroProgress` creates/loads that instance separately. `equipmentStorage.apply` reads loadouts by each record/actor heroInstanceKey.

A real shared-path diagnostic created the default hero store, attached a Falie actor under falie#1, synced equipment storage and equipped one generated item to Falie. Canonical CP gained12; the deployed actor retained ATK7/DEF12/MAG4/RES8/SPD8 and empty equipmentStats. The lamp record owned the item under Falie. Thus a successful UI receipt does not establish deployed stat gain.

Independent ordinary-play evidence: `guidance-events.json` at123.315s records Auto Equip with canonical Falie equipmentStats={ATK:4,DEF:2,MAG:1,RES:1,HP:12}; saved falie#1 equipmentStats={}. The same mismatch persists after reload at221.860s. These are saved deployed records; live actor identity is established by the initializer and shared-path reproducer.

Acceptance01.sources remains FAIL. Repair must preserve earned EXP/levels, existing gear and unique ownership across supported independent instances. Do not broadcast one equipped item across same-class instances or add an alias compatibility layer. Resolve the supported progress/loadout owner and any required save treatment before runtime edits in the separate bead lane.
