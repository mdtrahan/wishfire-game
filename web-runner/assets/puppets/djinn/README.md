# djinn editable source candidate — ORKA-ah1

Slim dark indigo biped, ivory horn, spiked head, pointed ears, red eyes, bare torso, gold neck jewelry and bracelets, gold bead belt, pale baggy trousers, dark bare feet, long thin belt cord and floating silver-blue orb. Orb inherits hand_near; belt_cord inherits pelvis.

Built-in imagegen painted a separated atlas using the original enemy PNG, Fara and the blue genie pointer as references. Initial atlas v1 remains preserved; v2 corrected torso shoulder paint and removed duplicate head jewelry. ImageMagick performs rectangular isolation and alpha trim only. Native Synfig 1.5.5 bones and parented bone_link transforms own the editable neutral and stress sources. No creative raster painting occurs in the preparation or QA scripts.

Source canvas 256×256, semantic foot (128,250), body origin (128,112). Native linear import c=1 renders at 1024×1024, then Lanczos produces stripped PNG32 128×128 with semantic foot (64,125). Fourteen base names remain compatible with the shared exporter. Parent order and actor-specific geometry are in source/parts.json. Forearms inherit upper arms, hands inherit forearms, lower legs inherit thighs. Right facing explicitly mirrors left about X128, including costume and attachment handedness.

Run from this actor directory:
```sh
python3 source/prepare-neutral.py
python3 qa/joint-stress.py
python3 source/check-source.py
python3 qa/contact-cards.py
```
The preparation script overwrites generated part PNGs and neutral SIFs. Preserve hand-authored changes by editing its geometry or paint master first. Native SIF files remain directly editable in Synfig; GUI authoring has not been tested in this lane.

qa/comparison-anonymous.png compares originals and candidate at visible 56/220px in both facings. qa/equal-texture-anonymous.png compares equal 128/1024 rasters. qa/stress-cards.png uses identical canvas scales and fixed foot origin rather than refitting each pose. Stress SIFs rotate shoulders, elbows, wrists, head, hips and lower legs in actual native rendering. These static attachment diagnostics certify no gameplay motion or interpolation.

Source frozen for fresh anonymous critic. Structural checks and repeat-render evidence are in qa/structural-check.json and qa/repeat-render.json. sha256.json covers preserved masters, painted parts, native sources and evidence. The anonymous key resides under qa/private/ and must stay outside critic context. The fresh critic has not yet judged source quality. Wider joint excursions, seven-state motion, runtime integration, exporter changes, merge and bead closure remain outside this source batch.

## Source revision after fresh critique

Near hand mirrors mechanically to open outward; orb remains parented to hand_near with palm-local offset and hand-over-orb stacking. Belt cord remains pelvis-owned, with a 76px native length and narrow 24px width; its root stays at the visible belt edge. Round1 source and evidence remain recoverable at 96eb4f0f8ecca0de5c2918a5073a567047f52d17; qa/rejected-source-r1 preserves the reviewed cards and verbatim verdict. Current source is frozen for a second fresh critique.


ORKA-nst runtime recovery: RECOVERY.json pins the owner-supplied rig-guide source and unchanged neutral/paint hashes. Complete seven-state runtime clips are in manifest.json. Newly generated motion retains actor-local attachment origins; existing High Orc sword/walk actions stay unchanged. Review videos and frame audits are under output/wishfire-motion-review-ORKA-nst/. This is a motion candidate for owner review.
