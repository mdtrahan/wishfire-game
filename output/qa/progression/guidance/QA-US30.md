# Lamp guidance proof — ORKA-5af.2

Scope: sheet07/US30 on the preserved lamp foundation. Current EXP curve, manual2s and Auto5s remain selected by the owner. No merge/publication.

## Implemented behavior

The original blue hand/rings use the existing15-second idle timer through draw, collection, Hondo comparison, Auto Equip, dismantle and upgrade preview. Unaffordable/MAX previews point to Close; affordable previews point to Confirm. Durable optional v5 bits record actual storage/comparison/preview actions once. Existing earned records identify draw/equip/dismantle/tier milestones. Banners, transactions and background state suppress guidance. Completed upgrade loops stop strip prompts; item review remains usable.

## Validation

- `node --test tests/lampEquipment.test.mjs`:31/31 PASS; failed save, concurrent duplicate receipt, corrupt bits, reload and unchanged resources/gear/hero EXP covered.
- `LAMP_QA_URL=http://localhost:8032/web-runner/index.html npm run test:lamp-ui`: PASS on360×640 DPR1,216×384 DPR2,233×452 DPR2 and316×452 DPR2 after decorative containment fix. Final added banner/wheel assertions await the checkpoint hook; its outcome is recorded in Beads and the final receipt.
- Before fix the new animated containment assertion failed at lamp-upgrades. After fix12 animation-frame samples per target stay within the viewport±0.5px with zero horizontal overflow. The control/modal layout remains unchanged. The existing commit hook routes staged lampUI/CSS/presentation-test owners through this command.
- Native in-app final reload:1280×720 CSS,DPR2,body zoom1/transform none; Canvas405×720 at437.5,0 with810×1440 backing. Lamp draw control92.336×82.578, font12.375px; no horizontal overflow. `native-guide-generate.jpg` was visually reviewed. A later final native capture measured the same1280×720 and405×720 geometry atDPR1/backing405×720, draw92.328×82.578; `native-guide-generate-final.jpg` was reviewed with no console errors.

## Ordinary-play recording

`lamp-guidance-earned-flow.webm` and `guidance-events.json` use fresh local storage, actual inputs, normal2.1s waits and actual15.5s idle waits. No resource/EXP/gear/seed or clock injection. Playwright recording fills a capability absent from the in-app Browser. This is guidance/first-upgrade proof; the complete all-four-Lv5/Auto film remains required.

| Event clock seconds | Observed action |
|---|---|
|16.356 /30.903|Generate idle prompt;30 seconds untouched with zero items/EXP and Lv1 saved heroes|
|30.968–72.133|20 normal permitted draws; cumulative EXP500|
|89.745 /105.370 /121.011|Collect, Hondo and Auto Equip prompts|
|123.315 /138.825 /138.945|Four equip receipts; dismantle prompt;16 pieces yield19 essence|
|158.177 /173.687|Free preview leaves earned balances/gear/EXP intact; Close prompt at19/20|
|179.705|One extra draw/dismantle earns remaining essence; cumulative EXP525|
|195.307 /212.870 /214.471|Affordable benefits, Confirm prompt and repeated confirmation spending20 once|
|221.860|Reload:guide bits7,tier1,essence0,earned gear and EXP retained|

Film frames inspected at17,32,90,92,106,108,122,124,139,141,175,214,215 and223 seconds. Event clock and film timestamps differ; the frame index is the inspected visual evidence. Frames90/122/139/175/214 show collect/Auto/dismantle/Close/Confirm prompts. Frame106 follows comparison selection; the separate `guide-Huun.png` preserves that prompt. Reward strip frame141 shows19;215 shows the upgraded tier and next cost50. No page errors in the recorded run.

Preserved rejected captures: the first driver wrongly assumed20 draws would leave a shortfall, but that batch earned20 essence. The second assumed exactly four saved records, while this foundation stores four canonical and four deployed-instance records. Both attempts remain untracked and labeled failed. No product pass derives from those attempts.

## Known full-goal limits

`source-projection-audit.md` proves ORKA-5af.3: canonical gear changes do not reach deployed hero instances. This guidance feature does not resolve combat/hero-panel agreement. Pending owner choices cover battle EXP, Auto restart, rarity/gear bands, meter and income calibration. All-five actual reference skill unlock transitions remain unobserved. The inherited foundation has not passed Integration Ready against current main. Rollback is the pre-guidance checkpoint da20e24; preserve earned saves before switching code.
