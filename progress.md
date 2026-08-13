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
- Replaced combat's independent desktop font floors with one viewport-scaled, measured text contract. Story copy and navigation labels now fit their owned slots and publish overlap/overflow evidence.
- Added a source-bound presentation gate covering untouched startup, town, and combat at 514x289 DPR 2.49, 281x472 DPR 2.49, and 1024x768 reference. All nine final screenshots passed automated bounds checks and visual review.
- Wired presentation verification and `renderRuntime.js` hot-file enforcement into commit preparation. Focused contracts pass 11/11, the hot-file regression pack passes, and the hot-file lock self-test passes.
