# HighOrc repaired source handoff — ORKA-m44

The previous c4c8b97d source was accepted for relative neutral style, then failed the complete-limb gate during ffefee48 motion review. Hollow flat arm ends were part of that paint; limited wrist-only motion failed strong basic/cast readability. The original source, neutral, atlas and handoff remain under `qa/accepted-c4c8b97d-source/`. The ffefee48 native sources/failed motions remain frozen in the ORKA-2jf lane.

This repair repaints the vest torso, both upper arms, bracers/forearms and fists with solid grey-green anatomy and covered joints. Generated masters `repair-parts-v2.png` and `repair-hands-v3.png` remain intact. The early cuff-bearing hand variants stay preserved alongside them. Head, pelvis, coat-back, legs/boots and the actual long pale sword keep their original PNG bytes.

`source/parts.json` is the corrected per-part composition/pivot/parent contract. Fifteen bitmap layers plus16 native bones form the editable source. NativeSourceModes identifies corrected neutral and movement SIFs and shared parts metadata; `movement-controls.json` supplies explicit source pose angles, rest controls and actual near-hand weapon lead. These native sources use existing Synfig parented bones and imported paint. No browser skeleton or gameplay timing was introduced.

Run from this actor directory:

```sh
python3 source/isolate-repair-parts.py
python3 source/prepare-repaired-source.py
python3 qa/export-repaired-source.py
python3 source/check-source.py
python3 qa/check-repaired-envelope.py
```

Isolation is deterministic mechanical cropping/transparent trimming from the preserved generated masters. Stripped PNG32 output reproduces identical bytes and decoded paint. Native preparation overwrites manual SIF edits. Export writes actor-local QA snapshots, never runtime frames or a shared manifest.

Source256 foot(128,250) maps to128 foot(64,125). Native1024 linear import sampling reduces through explicit offline Lanczos to128. Authoring proof and battle proof retain fixed pose scale; body bone origin stays(128,112). Right coverage mirrors left and reverses costume/weapon handedness. The native1024 reflection comparison has fractional AE0.562211, under one author pixel; reducing the native sampler's one-pixel reflection offset gives subpixel128 rounding. A raw128 flop-and-one-pixel-roll comparison applies to the earlier native128 path and cannot certify this pipeline.

Source basic contact uses near shoulder85°, elbow10°, wrist−35°, giving a global60° diagonal blade. Pullback folds the real arm across the chest. Cast release uses shoulder85°, elbow−10°, wrist45°, producing a global120° lower outward blade. Source controls keep the sword local angle0 and inherited grip. Cast recovery holds the arm extended while the blade unwinds, then folds; a simultaneous fold crossed the right canvas edge and is preserved in `qa/rejected-cast-recovery-v2/` with source/config/frames/hashes. Pose controls are authoring directions for later motion adoption; they grant no damage, range, or effects.

Front-to-back order remains head, hand_near, forearm_near, sword, upper_arm_near, upper_arm_far, torso, pelvis, shin_boot_near, thigh_near, hand_far, forearm_far, shin_boot_far, thigh_far, coat_back. Emit native layers in reverse. Part-parent GUIDs remain defined first. The full flesh wrist relocates hand bones from y192 to186; sword composition remains(73,202), so its child offset changes to preserve the actual grip. Do not substitute the former hollow arm paint or generic rest-angle/pivot defaults.

`qa/repaired-sequence.json` lists94native snapshots: complete basic/cast/arm-swing envelopes, a combined action-source sweep and neutrals, both facings. All128 meaningful-alpha bounds stay inside the fixed canvas. Additional recovery probes include562.5/625ms. Arm-swing proof covers shoulder continuity with fixed feet; complete locomotion and seven-state acceptance belong to the later motion owner.

Review http://localhost:8145/web-runner/assets/puppets/highorc/qa/repair.html at56px visible neutral height and220px author inspection height. The full source view and separate recorded890/1090ms enemy view are QA-only. Browser screenshots include neutral, full contact strips, source release and recorded windup/contact. Child hidden in-app browser returned `Browser is not available: iab`; documented agent-browser fallback shows1280×720/DPR1 with no horizontal overflow. Independent source anatomy/envelope acceptance remains pending. GUI authoring has not been tested; native editable SIF composition/rendering is proven.

Large author sequence/probe snapshots remain locally protected with exact hashes/paths in `qa/repair-frozen-receipt.json`. Preserve them through independent source review and later motion adoption until the owner approves a hashed archive. This lane changes only the HighOrc actor directory.


ORKA-nst runtime recovery: RECOVERY.json pins the owner-supplied rig-guide source and unchanged neutral/paint hashes. Complete seven-state runtime clips are in manifest.json. Newly generated motion retains actor-local attachment origins; existing High Orc sword/walk actions stay unchanged. Review videos and frame audits are under output/wishfire-motion-review-ORKA-nst/. This is a motion candidate for owner review.
