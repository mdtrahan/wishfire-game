# Source record

Source atlas images were produced with the built-in imagegen tool for this approved puppet transition. They are new transparent images; existing game sprites remain unchanged. Mechanical cropping used the already-installed ImageMagick CLI after native `sips` crop offsets failed verification. Crop boxes are recorded in each `source/parts.json`.

Fara reference: `../images/Fara.png`. Requested exact costume/color identity, right-facing three-quarter oversized head, separate back hair, torso, pelvis, upper arms, forearms, fists, thighs and combined shin/boots. Hidden shoulder/elbow/hip/knee ends received overlap paint. Accessory cells from the atlas are preserved but unused, so the torso necklace is not duplicated in the assembly.

Gobloc references: `../images/enemy_sprite-gobloc-000.png` for identity and Fara for style. Requested oversized left-facing goblin head with sandy grey hair, green skin, maroon jacket and tails, white sleeves, brown gloves/belts and baggy slate-blue trousers. Parts follow the same articulated layout. Original taller enemy artwork is preserved.

The generated atlases provide one view per actor. Opposite facing is an explicit source mirror. This reverses Fara's asymmetric bracer/pauldron arrangement, which remains visible source coverage debt; the runtime never invents an unseen view.

Native Synfig bones and bitmap-group bindings drive exported animation. Shoulder pauldrons on both torso/upper-arm parts overlap in the assembly. Fara's capped blue wrist surfaces and Gobloc's costume overlap need motion review. These are cutout sources with combined shin/boot layers, so ankle articulation needs an additional source split if future choreography requires it.

Gobloc head/coat crops initially included detached pixels from neighboring atlas cells. Extraction now retains their intended foreground alpha component (ID 2 at the recorded crop/1% alpha threshold), merges other components into background ID 0, dilates the extraction mask by one pixel and intersects it with the original RGBA alpha. This removes the foreign fragment while retaining the original paint and edge transparency; `parts.json` records `alphaComponent`. The atlas remains intact. ImageMagick's official connected-component reference describes this mechanical extraction: https://imagemagick.org/connected-components/.
