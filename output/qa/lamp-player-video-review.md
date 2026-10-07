# Lamp equip and dismantle: player video review

Reviewed 2026-09-30 against the owner instructions for the equip cache, separate dismantle screen and passive reward strip. The final recording operates the served game at localhost:8024 from a fresh browser save through START, lamp emissions and visible buttons. It injects no gear, EXP, reward or loadout state. The installed matching Chromium records the same served files after native in-app operation exposed the defects. Native in-app capture could not reliably capture the short animations.

[Continuous player video](lamp-player-flow.webm) · [Recording driver](lamp-record-player-flow.cjs) · [Wall-clock event log](lamp-player-flow-events.json)

Video timestamps below come from inspecting extracted video frames, rather than treating script event times as exact video positions. Capture is 360 × 640 at DPR 1. The browser shell displays its existing DEV controls and combat grid in the recording.

## Visual acceptance against the requested flow

| Owner criterion | Video evidence | Result |
|---|---|---|
| Lamp belongs to combat; manual generation appends raw pieces without filtering. | 00:01 quest menu has no strip; 00:05–00:23 successive emissions update the five arrival positions and storage counter. | Observed |
| Equip cache remains the decision screen; show descending CP, five columns and 1.5 rows. | 00:25 shows eight pending pieces, CP 10.3, 10.3, 10.2, 9.3, 7.9 across the first row, with the partial second row. | Observed |
| Quality comes from item background; active item has a separate halo and level badge. | 00:25 green/white tiles, C/U letters, Lv.1 and gold active halo. | Observed for the qualities emitted in this run |
| Portraits and comparison stats precede the new item; order HP, ATK, DEF, MAG, RES. | 00:42 shows all four portraits, those five rows, then the complete item artwork and stats. HP is nonzero; arrows sit beside numbers. | Observed |
| Idle points at Hondo; selecting a hero dismisses it and later points at Auto-Equip. | 00:42 Hondo guidance; 00:60 Auto-Equip guidance after Fara was chosen. | Observed |
| Manual selection asks which named hero receives the item; Skip, Equip and Auto-Equip remain available. | 00:60 says “Equip to Fara?” above the three controls. | Observed |
| Equip shows the actual saved hero CP gain with stationary portrait art. | 00:62–00:63 Fara receives CP +5.2; only the label moves. The portrait row returns when Equip is clicked from the lower part of the dialog. | Observed |
| Auto equips at most one qualifying item per hero and grants positive total hero CP. | 00:65–00:66 three separate gains: Hondo +7, Runa +5.2, Kaja +5.4. Fara receives no second upgrade in this Auto action. | Observed for this batch |
| CP finishes inside the equip screen before moving to dismantle. | 00:66 gains are still inside the comparison; 00:67 shows the separate dismantle screen after they finish. | Observed |
| Dismantle holds the remaining items; no rescue or essence award appears before confirmation. | 00:67 shows four inert pieces and Dismantle All. There are no Equip controls or resource amount in this view. | Observed |
| Confirming Dismantle All replaces that dialog with a minimal passive reward banner. | 00:70 centered DISMANTLED, one original essence orb, total 5; no close button. Visible quality values are three Common pieces plus one Uncommon, yielding 1+1+1+2 = 5 essence. | Observed |
| Banner holds about three seconds, fades quickly and requires no extra tap. | Visible at 00:70 and 00:72; removed by 00:73–00:75 while combat continues. | Observed; exact 3s + 250ms timing also checked by browser regression |
| Dismantling provides resources only; it gives no EXP reward. | Reward strip shows essence only. The later Party EXP receipt follows a new lamp emission, rather than dismantling. | Visually consistent; save totals checked separately |
| Empty cache stays closed and a new piece opens equip review again. | 00:75 empty-cache tap leaves combat visible. 00:80 shows HERO GEAR UPGRADE, portraits, comparisons and a new Scholar Turban. | Observed |

## Repairs found through operating the game

1. The empty cache could open the old empty “DISMANTLE ALL / Ready for another wish” dialog. A shared storage-count guard now closes that review path; upgrade access remains independent.
2. Clicking Equip near the bottom left hero portraits outside the viewport when feedback anchors were measured. Equip and Auto restore the portrait row before measuring anchors.
3. Simultaneous Auto gains ran together at 360px. Each gain keeps the 18px font and wraps within at most 48px of its portrait column.

## Verification scope

This video certifies the repaired equip → dismantle → reward → new equip sequence and the criteria above. It does not visually certify every progression scenario from the longer lamp MVP: full-capacity Auto stopping, all lamp upgrades, rare/epic/legendary rolls, save failure, lower-CP manual override, or maxHP ties. Those require separate scenarios; do not describe this clip as a complete publisher release certification.

Core checks: 28 passed. Offline bundle checks: 7 passed. Four-phone browser regression passed before the final width adjustment; a subsequent run timed out at the initial START click with the 500ms startup wait. The recording successfully used a two-second startup wait. The final four-phone rerun uses that same wait and passed on the final files: 360 × 640 DPR1, 216 × 384 DPR2, 233 × 452 DPR2, and 316 × 452 DPR2. It checks saved reward totals, no dismantling EXP, modal closure, automatic banner dismissal, CP feedback containment and empty-cache behavior. These checks supplement the recorded player flow.

No runtime state or public branch was merged. The owned lane is codex/ORKA-0ln-lamp. Presentation changes remain in that lane for review.

Video SHA-256: `f34a0ba8a3d55a80debdeb7776fc9c58f0343420c12b038dbbd8193d7d269f6f`.
