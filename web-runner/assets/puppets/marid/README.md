# marid editable source candidate — ORKA-ah1

Broad dark indigo biped, large spiked head, pointed ears and red eyes, bare muscular torso, gold collar and wrist details, maroon waistband, ivory baggy trousers and pointed dark feet.

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

Near upper-arm and pelvis rectangular crops exclude neighboring cells. Torso and pelvis extraction additionally isolate disconnected foreign atlas paint: threshold 10% alpha identifies separate foreground components, then a 3px dilation preserves original antialiased edges under the isolation mask. Torso foreign component 2 and pelvis foreign components 2/3 are removed; all retained RGBA paint comes from the preserved v2 master. No creative painting is added. Round1 source and evidence remain recoverable at 96eb4f0f8ecca0de5c2918a5073a567047f52d17; qa/rejected-source-r1 preserves the reviewed cards and verbatim verdict. Current source is frozen for a second fresh critique.

## ORKA-4ah motion candidate

Seven-state native clips and runtime frames are authored through the existing exporter using frozen accepted source paint, pivots and neutral SIFs. Djinn/Marid sources come from c6e7d220; Skeleton/Troll/Chimerilass sources come from a04c5bdd. Actor-local pass order and attachment parents are retained. Chimerilass keeps separately articulated shin/paw children and tail base/tip; Djinn carries the original palm-local orb and pelvis-parented cord.

Motion evidence lives in output/qa/ORKA-4ah: fixed-scale 56/220 contact cards, native1024 author frames, recorded 890ms contact/1090ms recovery proof, source preservation and every-frame bounds measurements. KO body-height profiles are measured on expanded native canvases. Rejected native configurations and frames remain recoverable there. Fresh independent full-motion critique and battle integration are pending.
