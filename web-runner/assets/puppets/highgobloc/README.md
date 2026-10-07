# highgobloc source handoff — ORKA-hr4

Source candidate for the approved moving-arena roster. Original identity retains pale grey-green skin, pointed goblin ears, white spiky hair, orange mantle, bare abdomen, blue gauntlets, cream trousers, brown hip pouch, wrapped lower legs and open sandals. Both are biped with empty hands. Existing original sprites remain unchanged. Built-in imagegen produced the separated painted parts atlas; ImageMagick crops and trims alpha without creative painting.

Fourteen independent parts and native bone links form both neutral SIFs. Source256² foot(128,250), body origin(128,112), authored reference origin(128,144). Source faces left; opposite facing explicitly mirrors all costume handedness about semantic X128. Composition and parent-first ordering are in source/parts.json; forearms inherit shoulders and hands inherit forearms, shins inherit thighs. Head and clothing inherit body. The full painted torso remains beneath rest limbs when shoulders move.

Run from this actor directory:
```sh
python3 source/prepare-neutral.py
python3 source/check-source.py
python3 qa/joint-stress.py
python3 qa/contact-cards.py
```
prepare-neutral.py rebuilds isolated parts and native sources, replacing hand-edited neutral files. It applies native linear import c=1, renders1024² with installed Synfig and downsamples with Lanczos to128² PNG32. Native author images support220px proof. Decoded battleRGBA remains65536bytes per frame,131072bytes for two neutrals. No shared exporter or manifest changes.

Anonymous A/B cards in qa/comparison-anonymous.png compare originals and candidate at visible56/220px, both facings. Battle comparison traverses128² for both sources; author comparison uses native source artwork. The anonymous key is separate. source/check-source.py proves dimensions, parent order,14 native links, linear imports and alpha containment; its meaningful bounds use alpha>=16 to exclude faint Lanczos ringing.

qa/stress-cards.png and qa/joint-stress-receipt.json record actual native shoulder(-32/+24 and+24/-28), elbow(+40/-32 and-30/+38), head±10, wrist±18, thigh±8 and opposing shin poses. All body/root origins stay fixed. Painted overlaps cover neck, shoulder, elbow and leg connections on builder-inspected final cards. Stress snapshots are attachment diagnostics; walk, attack, hit and KO motion remain separate acceptance.

Current state: source candidate frozen for fresh anonymous neutral/joint critique. Full-motion certification, runtime integration, merge and bead closure remain pending. Native CLI rendering is verified; Synfig GUI editing is untested. Disjoint shared export owner4my receives this source after critique.

Art masters: parts-left-v1.png is preserved unchanged. Built-in imagegen v2 repainted dark hidden joint caps to matching skin/cloth while preserving all atlas cells. The active recipe uses parts-left-v2.png. Early attachment gaps came from assigning baked arm orientations to the wrong side; source geometry now places each arm on its corresponding side.

## Revision after fresh articulation critique

The critic selected this neutral design but rejected the outward upper-arm connection: an isolated green oval led into a pinched blue cuff root. The rejected source, renders, cards and hashes are preserved in qa/rejected-source-v1.

Built-in imagegen painted four replacement arm segments in source/arms-left-v3.png and two mantle coverage patches in source/mantle-coverage-v3.png. Upper arms now have continuous tapered anatomy and extended orange sleeves; forearms carry broad painted elbow overlap. Shoulder pivots use normalizedX0.76/0.24,Y0.20, while forearms hinge on the painted elbow centre atX0.5,Y0.17. Arm and hand placements follow those native joint centres. Forearm paint draws above its inherited upper-arm end, preserving cuff-root overlap when their angles differ.

The mantle patches cover the old exposed torso sockets. prepare-neutral.py mechanically isolates/resizes the generated cloth, preserves original torso pixels in torso-base.png, writes the independent transparent torso-coverage.png master and composites its paint into torso.png. This keeps the existing14-part shared4my recipe usable without a new coverage-render contract. The original head, torso base, pelvis, drape, thighs, shins and feet remain pixel-identical; their accepted geometry stays fixed. source/check-source.py enforces these invariants.

Builder inspected fresh neutral and actual coil/release facings at56/220 after the last art/geometry edit. Structural checks pass. The revised candidate is frozen for a new independent critic; its articulation acceptance and full-motion continuity remain pending. Orc's complete frozen file hashes remain unchanged, recorded in qa/orc-frozen-hashes.json.

## Frozen source acceptance

Fresh anonymous critic selected the native source at56/220 in both facings and passed the supplied static coil/release joint coverage. The verbatim receipt is qa/critic-static-accepted.md; qa/acceptance.json records the exact verdict hash and source freeze. Source hashes were verified unchanged before this documentation update. The earlier pending-review statements above describe prior candidate checkpoints. Wider shoulder/elbow rotation, interpolation, complete walk/attack/hit/KO clips and runtime integration remain with the shared4my motion owner. These static sources have no motion QA PASS or Integration Ready claim.
