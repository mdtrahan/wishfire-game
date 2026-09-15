# Combat VFX Index

Purpose: track every player-visible combat effect from initiation through impact so new work fills gaps without replacing approved presentation.

Reference: the user-supplied G123 combat recording. Its useful grammar is a bold painted silhouette, one dominant color, low interior detail, quick anticipation, readable contact, and residue that clears before the next action.

## Sequence contract

Every damaging action declares these beats:

1. **Origin**: actor rest anchor, target-centered manifestation, overhead cloud, or ground origin.
2. **Delivery**: contact lunge, straight shot, lob, rain, eruption, spectral construct, crescent emission, ground fire, or electric crackle.
3. **Contact**: a color-matched splash on every damaged target.
4. **Residue**: optional field, sparks, flame, mist, or glow lasting less than the next action unless the gameplay effect persists.

Vertical effects reveal in their direction of travel. Eruptions grow from the ground upward; rain, washes, and crackle descend from their origin. Healing stages a ground sigil, rising fountain, and falling motes instead of scaling one complete sprite in and out.

`MAG > ATK` selects ranged magic for a basic attack. Other basic attacks use melee contact. Named skills may override delivery because their gameplay meaning is more specific than the basic classifier.

## Completion values

- `Asset`: final transparent raster exists and is loaded by the shipping runtime.
- `Wire`: the production combat path emits the complete sequence.
- `Live`: observed through the ordinary player URL with visible evidence and a clean console.
- `Done`: `1` only when Asset, Wire, and Live are all `1`.
- `Lock`: `KEEP` means preserve the accepted visual while filling adjacent gaps.

## Active combat inventory

| Action / condition | Origin and delivery | Palette | Contact / residue | Asset | Wire | Live | Done | Lock |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| Fara basic | Rest anchor; melee lunge | Orange-red | Orange-red contact flare | 1 | 1 | 1 | 1 | KEEP |
| Hondo basic and speed multiattack | Rest anchor; melee lunge per hit | Orange-red | Orange-red contact flare per hit | 1 | 1 | 1 | 1 | KEEP |
| Runa basic | Rest anchor; straight blue bolt | Cyan-blue | Blue painted splash | 1 | 1 | 0 | 0 | KEEP |
| Kaja basic | Rest anchor; floating purple orb | Violet-purple | Purple painted splash | 1 | 1 | 0 | 0 | KEEP |
| Physical enemy basic (`MAG <= ATK`) | Enemy rest anchor; contact strike | Orange-red | Orange-red contact flare on hero | 1 | 1 | 1 | 1 | KEEP |
| Djinn basic (`MAG 28 > ATK 6`) | Cloud manifests above hero; violet energy rains down | Violet-blue | Electric crackle and violet splash | 1 | 1 | 0 | 0 | KEEP asset; live proof pending |
| Marid basic (`MAG 22 > ATK 8`) | Enemy rest anchor; aqua crescent emission | Aqua-blue | Aqua splash with brief mist | 1 | 1 | 0 | 0 | KEEP asset; live proof pending |
| Chimerilass basic (`MAG 26 > ATK 8`) | Target-centered rose-gold magical eruption | Rose-gold | Upward burst and falling motes | 1 | 1 | 0 | 0 | KEEP asset; live proof pending |
| Split | Hero rest anchor; broad painted slash across enemy line | Red-orange | Slash covers every damaged enemy | 1 | 1 | 0 | 0 | KEEP |
| Chain Strike I / II | First contact; illustrated ribbon bounces between targets | Cyan-white | Ribbon contact on each bounce | 1 | 1 | 0 | 0 | KEEP |
| Arcane Pulse | Hero rest anchor; illustrated crescent charges then travels straight | Violet-cyan | Matching painted contact burst and short trail | 1 | 1 | 0 | 0 | Legacy procedural arcs disconnected |
| Faze / Blight | Enemy ground origin; tainted field | Purple | Purple damage floats and persistent ground haze | 1 | 1 | 1 | 1 | KEEP |
| Crimson Ward | Hero group origin; shield bloom | Crimson | Ward absorbs damage before HP | 1 | 1 | 1 | 1 | KEEP |
| Grow | Each living hero's ground origin; spectral genie hands lift upward during the initial power increase | Turquoise-gold | Hands fade while the existing session-long scale state remains | 1 | 1 | 0 | 0 | Preserve established hero scaling behavior |
| Magic Fruit | Ground sigil; rising fountain | Green-gold | Falling motes and green value | 1 | 1 | 1 | 1 | KEEP staged family |
| Destiny heal proc | Ground sigil; rising fountain | Green-gold | Falling motes and green value | 1 | 1 | 1 | 1 | KEEP; observed in ordinary autoplay |
| Enemy single heal | Ground sigil; rising fountain | Mint-gold | Falling motes and green value | 1 | 1 | 0 | 0 | Share staged heal family; live proof pending |
| Enemy group heal / Wipe | Progressive cloud rain above enemy group | Mint-gold | Fountain and motes on every restored enemy | 1 | 1 | 0 | 0 | Live proof pending |
| Enemy Scathe | Enemy rest anchor; electric lines crackle around the chosen hero | Violet-white | Target-centered sizzle while the board lock resolves | 1 | 1 | 0 | 0 | Named skill overrides basic Djinn rain |
| Enemy Sweep | Enemy rest anchor; aqua crescent sweeps toward the chosen hero | Aqua-white | Crescent carries its own misty contact while the board lock resolves | 1 | 1 | 0 | 0 | Named skill overrides basic Marid crescent |
| Enemy Wipe purge | Cloud above the living enemy group; downward green-gold wash | Mint-gold | Wash precedes per-target heal blooms | 1 | 1 | 0 | 0 | Named skill overrides Chimerilass eruption |
| Enemy magic AOE | Living hero group ground origin; broad magical brushfire erupts upward | Orange-magenta | Rose contact splash on every damaged hero and brief ground flame | 1 | 1 | 0 | 0 | Shipping `Enemy_MAG_AOE` path |
| Enemy Drain Buff | Enemy self origin; blue-violet ribbons draw inward to an orb | Blue-violet | Brief translucent defensive aura | 1 | 1 | 0 | 0 | Shipping `Enemy_Drain_Buff` path |
| Barrier / defensive status | Target-centered spectral hand or shield presses into place | Skill affinity color | Short glow; persistent status icon/barrier art | 0 | 0 | 0 | 0 | Use only where status is visible |
| Fire AOE or ground effect | Target group ground origin; magical brushfire | Orange-magenta | Flame splash plus momentary brushfire | 0 | 0 | 0 | 0 | Do not replace Faze |
| Heavy magical strike | Cloud or orb manifests overhead; spectral hand smashes downward | Skill affinity color | Comical squash splash | 0 | 0 | 0 | 0 | Reserved family |

## Asset queue

Generate and integrate in this order so each pass closes a visible production gap:

1. Blue and purple contact splashes for Runa and Kaja.
2. Enemy melee impacts on heroes through the shared presentation event.
3. Djinn rain/crackle, Marid crescent/mist, and Chimerilass eruption/motes.
4. Shared single-target heal bloom and group healing rain.
5. Spectral-hand family when an active skill needs it.

## Acceptance

Automated contracts may prove classification, packet fields, asset loading, and sequence timing. Final completion follows `live-production-game-qa`: ordinary player URL, shipping runtime path, visible capture of the transient sequence, and clean browser console. QA fixtures remain diagnostic.
