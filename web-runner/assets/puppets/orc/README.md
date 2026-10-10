# orc source handoff — ORKA-hr4

Source candidate for the approved moving-arena roster. Original identity retains pale green skin, two ivory horns, lavender spiky hair, tusks, maroon scarf and trousers, exposed abdomen, bronze bracers, brown ornate belt and bare clawed feet. Both are biped with empty hands. Existing original sprites remain unchanged. Built-in imagegen produced the separated painted parts atlas; ImageMagick crops and trims alpha without creative painting.

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

## Frozen source acceptance

Fresh anonymous critic selected the native source at56/220 in both facings and passed the supplied static coil/release joint coverage. The verbatim receipt is qa/critic-static-accepted.md; qa/acceptance.json records the exact verdict hash and source freeze. Source hashes were verified unchanged before this documentation update. The earlier pending-review statements above describe prior candidate checkpoints. Wider shoulder/elbow rotation, interpolation, complete walk/attack/hit/KO clips and runtime integration remain with the shared4my motion owner. These static sources have no motion QA PASS or Integration Ready claim.
