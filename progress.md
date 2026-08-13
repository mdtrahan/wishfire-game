Original prompt: Repair the wrecked compact in-app appearance and make the viewport guidance prevent another false QA-ready handoff.

# Moved To Archive

Moved to: `docs/archive/2026-02/progress.md`

Reason: Superseded by Beads issue state and activity history

2026-08-12
- Created ORKA-myz after exact-main QA reproduced Canvas/DEV overlap and fallback text clipping at the natural 281x472 CSS viewport.
- Replaced the full-size 64px compact rail after screenshot review showed it made gameplay too narrow. DEV launchers now scale with the Canvas, and portrait layouts reserve only the scaled rail they need.
- Fitted fallback headline, loading, recovery, and fingerprint text to measured logical Canvas width.
- Focused contracts pass 18/18. Natural startup, town, combat, DEV, and DEV2 checks pass with zero Browser warning/error logs.
- Measured 1024x768 reference retains the original 431x767 portrait Canvas and launcher sizing/placement.
- Reproduced the short 514x289 CSS / 2.49 DPR in-app frame. The Canvas remains 162x289 CSS while DEV and DEV2 shrink to 20x11 and 23x11 CSS, matching their reference proportion; both launchers open successfully.
- Rechecked 281x472 portrait compact: Canvas is 234x416 with a 47px scaled rail, no overlap, and no truncated labels. Focused contracts pass 12/12 with zero Browser warning/error logs.
