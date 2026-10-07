# skeleton native source handoff

Frozen source candidate for ORKA-eib. Independent visual critique is pending. Full motion, shared export mapping and integration remain separate work.

Ivory skull, exposed ribs and spine, bony fingers, ragged orange-red cloak/scarf, purple armor, dark purple trousers, pale front waist cloth, armored knees and pointed feet. Lower anatomy follows the original armored biped. No flesh caps or held weapon.

`source/parts-left-v1.png` is the preserved generated master. `parts.json` owns 14 isolated painted parts, anatomical pivots and parent links. The two neutral SIF files contain native parented bones, bone_link part transforms and an editable skeleton layer. Opposite-facing art uses a semantic horizontal mirror. Rejected initial assembly and its source remain in `qa/rejected-first-neutral/source`.

The native canvas is 256 with semantic foot (128,250). Native linear1024 author renders reduce through Lanczos to 128 with semantic foot (64,125). Every runtime-sized frame decodes to 65,536 RGBA bytes; two neutral facings total 131,072 bytes. Author proofs are separate evidence files. Chimerilass retains separately parented shin/paw and tail parts; its export mapping needs the shared exporter owner.

Rebuild with `python3 source/prepare-neutral.py`, then `python3 qa/joint-stress.py`, `python3 qa/contact-cards.py` and `python3 source/check-source.py` from this directory. These require installed Synfig, ImageMagick and Pillow. The prepare script overwrites generated parts and SIFs. Source checks verify hierarchy, sampling, canvas bounds and two pixel-identical repeat renders.

`qa/comparison-anonymous.png` matches original/candidate at 56 battle and 220 author in both facings. `qa/stress-cards.png` shows actual native endpoints and three intermediate rotations for both facings. `qa/comparison-key.json` is private builder metadata. Static joint evidence does not certify continuous motion. Native GUI editing is unverified.

`qa/provenance.json`, `qa/receipt.json`, `qa/joint-stress-receipt.json`, `qa/repeat-render-receipt.json` and `qa/source-hashes.json` record inputs and proof. Original game sprites remain unchanged. No shared runtime, manifest, motion clips or exporter changes belong to this source handoff.

## ORKA-4ah motion candidate

Seven-state native clips and runtime frames are authored through the existing exporter using frozen accepted source paint, pivots and neutral SIFs. Djinn/Marid sources come from c6e7d220; Skeleton/Troll/Chimerilass sources come from a04c5bdd. Actor-local pass order and attachment parents are retained. Chimerilass keeps separately articulated shin/paw children and tail base/tip; Djinn carries the original palm-local orb and pelvis-parented cord.

Motion evidence lives in output/qa/ORKA-4ah: fixed-scale 56/220 contact cards, native1024 author frames, recorded 890ms contact/1090ms recovery proof, source preservation and every-frame bounds measurements. KO body-height profiles are measured on expanded native canvases. Rejected native configurations and frames remain recoverable there. Fresh independent full-motion critique and battle integration are pending.
