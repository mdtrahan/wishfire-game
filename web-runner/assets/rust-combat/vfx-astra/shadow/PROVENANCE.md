# Hondo Shadow VFX

Date: 2026-10-25. Artist task: Astra 3. Art director: Claude.

Six painted source images were generated with the built-in image_gen tool, transparent_background=true. Hondo idle-right-000.png was supplied as reference only for the afterimage. Source outputs remain in the image tool auto-save folder.

## Post-processing
Pillow and NumPy: crop source cells, soften clipped cell edges, resize with Lanczos, pack horizontal strips, add transparent padding, bake decay into impact and dissipate, neutralize afterimage RGB for tint multiplication, soften its edge 0.28 px, clear alpha values below 4. No vector strokes or procedural shapes were used for final VFX. Preview labels are ordinary typography. All final PNGs retain full RGBA color; palette quantization was rejected because it dulled small character colors.

## Read-only compositing references
/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-6jh1-rust-combat-mvp/experiments/rust-combat-mvp/art/arena/oasis-corridor.png
/Users/Mace/Codex-Orka/web-runner/assets/puppets/hondo/frames/idle-right-000.png
/Users/Mace/Codex-Orka/web-runner/assets/puppets/gobloc/frames/idle-left-000.png

## Prompts and source hashes

### coil
Use case: stylized-concept. Production game VFX sprite sheet, transparent RGBA, no background, no checkerboard, no text. Exactly FOUR square animation cells in ONE horizontal row, evenly spaced, each isolated with clear margins. Painted Japanese RPG / Capcom impact-effect quality, bold shapes. Shadow ability charging around a small ninja: abstract BLACK energy coils, razor crescent flickers, indigo inner planes and thin vivid violet rim highlights. Empty transparent center where character goes. Sequence left to right: tiny low hook; two crescent wisps curl up; dense inward twisting black energy coil; compressed sharp black-violet ignition crescent. Identical center and scale, no character, no symbols, no circles or runes. Predominantly opaque near-black ink mass, restrained saturated violet edges. Final cells will be 96x96 displayed at 48px. Sparse confident painted silhouette. Wide horizontal sheet.

Source: /Users/Mace/.codex/generated_images/01a17242-4e67-7de3-a798-f5a8f5dd3757/exec-ef03c9e4-5085-40a5-809e-7c893907ecd4.png
SHA-256: d4a52d836d871a26ff5219efb86f622d937df14370fa736298d68fba30c87672

### streak
Use case: stylized-concept. Single transparent RGBA game VFX texture. A horizontal extremely fast directional BLACK shadow blade dash. Head points RIGHT, long tail fades to LEFT. Aspect ratio roughly 5.33:1, full composition isolated with transparent margin. Bold solid near-black central spear silhouette, sharp wedge-shaped right tip, two subordinate black ribbons pulled leftward, angular thin saturated violet / indigo rim light. Point at far right, greatest weight in right third; progressively fragmenting thinning tail on left. Hand-painted high-end Japanese RPG action effect, Capcom bold readability. No character, no weapon object, no text, no background, no checkerboard, no dust floor. Stretched along dash path; must still read clearly as rightward movement at only 30 pixels long. Minimal sparse sparks, strong black body, no broad luminous fog. Final texture 256x48.

Source: /Users/Mace/.codex/generated_images/01a17242-4e67-7de3-a798-f5a8f5dd3757/exec-e4a756e4-90e4-42bc-a799-be5caceb9ce6.png
SHA-256: 4c667e7fe1dd2740fc50702f5679c9e731cd84e392f359b8619a1ab10c469904

### impact
Use case: stylized-concept. Production transparent RGBA game VFX animation sheet, EIGHT frames in exactly a FOUR column TWO row grid of equally sized square cells, no lines or labels. Each sprite centered in its own cell with transparent 12% safety margins and consistent impact origin. Reading order left to right then second row. Painted premium Japanese RPG / Capcom heavy critical-hit effect: brilliant WHITE-VIOLET compact core, brutally sharp diagonal radiating slash spikes and opaque BLACK energy shards with saturated violet and indigo rims. BLACK energy family, NOT fire. Animation: 1 tiny bright diagonal incision, 2 explosive compact white core with two large black blade wings, 3 maximum massive jagged black starburst and white-violet slash core, 4 core contracts and black shards fly outward, 5 broken blade wings and receding violet streaks, 6 scattered black shards with faint violet tips, 7 small sparse distant fragments, 8 two or three dying dark motes. Distinct evolution, not repeated scaled icons. No character, no target, no text, no ground, no checkerboard or background. Final cells 192x192, on-screen maximum 96x96. Favor large confident painted blade shapes over fine noisy sparks.

Source: /Users/Mace/.codex/generated_images/01a17242-4e67-7de3-a798-f5a8f5dd3757/exec-da82ab13-a066-44b8-b97c-d5d7ae4c03c4.png
SHA-256: 36602555849172695a47a3456e71745b2170e273d5921f7fadf0341cc72140c4

### crack
Use case: stylized-concept. One transparent RGBA ground impact decal for painted sandy oasis RPG arena. Horizontal roughly 2:1. A small violent sword strike scuff, jagged charcoal-black central fractured seam with 4 tapered radiating cracks, a few irregular dark angular chips, soft sand-brown disturbed dust edges. Slight indigo bruising near center, very restrained violet glints. Top-down with ground foreshortening, flat decal with transparent gaps and edges. Hand-painted compact Japanese RPG visual effect, no perfect circle, no crater bowl, no big rock pile. Heavy hit residue. No background, no text, no checkerboard, no frame. Final 128x64 shown 64x32.

Source: /Users/Mace/.codex/generated_images/01a17242-4e67-7de3-a798-f5a8f5dd3757/exec-ab8b860a-8142-44c1-89b1-28bfc8501409.png
SHA-256: 8ecc589b0897e943aebe521b7bbea22241081c0e62b17413ff0e7bf2a571e898

### dissipate
Use case: stylized-concept. Transparent RGBA game VFX sprite sheet, exactly FIVE equally spaced square cells in ONE horizontal row, clear transparent margins. Hand-painted shadow-energy landing residue for premium chibi Japanese RPG. Near-black ink wisps and shard-like motes with narrow violet-indigo rim light, no characters. Consistent centered origin. Frame 1 two bold curling black wisps and six angular flakes; frame 2 wisps shear into drifting black shards; frame 3 separated smaller motes rise and spread; frame 4 just four very small faint dark fragments; frame 5 two almost invisible tiny motes. Decreasing opacity and amount over sequence, no large smoky cloud, no bloom ball, no symbols, no text or background or checkerboard. Final each cell 96x96 shown 48x48.

Source: /Users/Mace/.codex/generated_images/01a17242-4e67-7de3-a798-f5a8f5dd3757/exec-1fa001aa-0906-4e39-89d9-d5af88bce93e.png
SHA-256: 19231e8f9ba3b42bad6973bfcc59dfdb8e95bbc6e3867e27243e57851e9aa39c

### afterimage
Use case: stylized-concept. Reference image shows Hondo, a chibi agile ninja striker. Create ONE transparent RGBA shadow afterimage sprite based on his recognisable silhouette: large scarf-wrapped head with spiky ponytail/scarf tips, small armored body, two short legs, headband tails and a short sword. Abstract silhouette only, very dark black-indigo, NO face details or costume colors, thin restrained violet right rim. Hondo leans and dashes toward RIGHT; soft painted trailing smears stream to LEFT. Opaque recognizable body with slightly soft edges, 60% of image height, clear transparent margins. Hand-painted Japanese RPG effect; readable at 32 pixels high, tint-multiplied in engine. No scenery, no floor, no text, no checkerboard.

Source: /Users/Mace/.codex/generated_images/01a17242-4e67-7de3-a798-f5a8f5dd3757/exec-f8970902-f8f9-488e-9471-31324ad299ef.png
SHA-256: cdced44d0798a5dd0ed47e313900b662afb2aa92fcedeb56c2f527ee3404fd47

## Review limits
Preview is a static 1:1 phone-scale mockup. Runtime animation, telegraph overlap and exact blend pipeline require art-director integration review. Source impact frames 4–5 remain slash-dominant, so baked opacity decay reduces their second-hit appearance. Source cell edge cutoffs were softened and padded; no missing painted detail was reconstructed. Afterimage is an abstract generated interpretation of Hondo, rather than an exact puppet mask. The family follows the supplied black/violet brief; sibling task files were not opened or changed.

## Reproduction
Run art/_work/astra-shadow/assemble.py with Pillow and NumPy available. It reads sources.json and original tool auto-saves. Both scratch files are scoped to this task.

## 2026-10-25 owner family edit: red exterior rim
Owner direction: keep the exact same Shadow assets, but give every component a soft red
gradient along its exterior edge so the outline reads against other dark assets.
`scripts/shadow_red_rim.py` processes each frame independently: an opacity-weighted,
Gaussian-softened rim (RGB 235,36,48) painted outside the silhouette only; interiors are
untouched, rims fade with each frame's own opacity, and the halo stays 3 px inside frame
borders so linear filtering never bleeds into neighbouring frames. Frame sizes, counts,
pivots and timings are unchanged.
