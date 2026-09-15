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
| Runa basic | Rest anchor; straight blue bolt | Cyan-blue | Blue painted splash | 1 | 1 | 1 | 1 | KEEP; ordinary-session capture |
| Kaja basic | Rest anchor; floating purple orb | Violet-purple | Purple painted splash | 1 | 1 | 1 | 1 | KEEP; ordinary-session capture |
| Physical enemy basic (`MAG <= ATK`) | Enemy rest anchor; contact strike | Orange-red | Orange-red contact flare on hero | 1 | 1 | 1 | 1 | KEEP |
| Djinn basic (`MAG 28 > ATK 6`) | Cloud manifests above hero; violet energy rains down | Violet-blue | Electric crackle and violet splash | 1 | 1 | 0 | 0 | KEEP asset; live proof pending |
| Marid basic (`MAG 22 > ATK 8`) | Enemy rest anchor; aqua crescent emission | Aqua-blue | Aqua splash with brief mist | 1 | 1 | 0 | 0 | KEEP asset; live proof pending |
| Chimerilass basic (`MAG 26 > ATK 8`) | Target-centered rose-gold magical eruption | Rose-gold | Upward burst and falling motes | 1 | 1 | 0 | 0 | KEEP asset; live proof pending |
| Split | Hero rest anchor; broad painted slash across enemy line | Red-orange | Slash covers every damaged enemy | 1 | 1 | 0 | 0 | KEEP |
| Party and session Chain Strike tiers | First contact; illustrated ribbon bounces between targets | Cyan-white | Ribbon contact on each bounce | 1 | 1 | 1 | 1 | KEEP; AF card reveal and ordinary-session capture verified |
| Arcane Pulse / Spectral Orb tiers | Hero rest anchor; illustrated crescent charges then travels straight | Blue-cyan | Directional contact flare splashes back from the target; short trail | 1 | 1 | 1 | 1 | Human-approved isolated production-path QA; shared `ArcanePulseVisuals`; legacy procedural arcs disconnected |
| Venom Sigil tiers | Enemy ground origin; poison sigil reveals upward | Purple-magenta | Rising venom wisps; subsequent DOT numbers retain their status palette | 1 | 1 | 0 | 0 | Session behavior proc |
| Glass Reprisal tiers | Countering hero rest anchor; glass-shard crescent travels to attacker | Cyan-white | Blue-white contact splash plus shared staged self-heal | 1 | 1 | 0 | 0 | One sequence per resolved counter package |
| Dawn Chorus tiers | Every defeated hero's ground origin; shared revival fountain | Green-gold | Sigil, rising light, falling motes and restored HP text | 1 | 1 | 0 | 0 | Session defeat intercept; opening draw excludes it |
| Faze / Blight | Enemy ground origin; tainted field | Purple | Purple damage floats and persistent ground haze | 1 | 1 | 1 | 1 | KEEP |
| Crimson Ward | Hero group origin; shield bloom | Crimson | Ward absorbs damage before HP | 1 | 1 | 1 | 1 | KEEP |
| Grow | Each living hero's ground origin; spectral genie hands lift upward during the initial power increase | Turquoise-gold | Hands fade while the existing session-long scale state remains | 1 | 1 | 0 | 0 | Preserve established hero scaling behavior |
| Magic Fruit | Ground sigil; rising fountain | Green-gold | Falling motes and green value | 1 | 1 | 0 | 0 | Human review rejected violent motion and incorrect anchor; isolated revision next |
| Destiny heal proc | Ground sigil; rising fountain | Green-gold | Falling motes and green value | 1 | 1 | 0 | 0 | Shares the rejected heal family; isolated revision pending |
| Enemy single heal | Ground sigil; rising fountain | Mint-gold | Falling motes and green value | 1 | 1 | 0 | 0 | Share staged heal family; live proof pending |
| Enemy group heal / Wipe | Progressive cloud rain above enemy group | Mint-gold | Fountain and motes on every restored enemy | 1 | 1 | 0 | 0 | Live proof pending |
| Enemy Scathe | Enemy rest anchor; electric lines crackle around the chosen hero | Violet-white | Target-centered sizzle while the board lock resolves | 1 | 1 | 0 | 0 | Named skill overrides basic Djinn rain |
| Enemy Sweep | Enemy rest anchor; aqua crescent sweeps toward the chosen hero | Aqua-white | Crescent carries its own misty contact while the board lock resolves | 1 | 1 | 0 | 0 | Named skill overrides basic Marid crescent |
| Enemy Wipe purge | Cloud above the living enemy group; downward green-gold wash | Mint-gold | Wash precedes per-target heal blooms | 1 | 1 | 0 | 0 | Named skill overrides Chimerilass eruption |
| Enemy magic AOE | Living hero group ground origin; broad magical brushfire erupts upward | Orange-magenta | Rose contact splash on every damaged hero and brief ground flame | 1 | 1 | 0 | 0 | Shipping `Enemy_MAG_AOE` path |
| Enemy Drain Buff | Enemy self origin; blue-violet ribbons draw inward to an orb | Blue-violet | Brief translucent defensive aura | 1 | 1 | 0 | 0 | Shipping `Enemy_Drain_Buff` path |
| Heavy magical strike | Cloud or orb manifests overhead; spectral hand smashes downward | Skill affinity color | Comical squash splash | 0 | 0 | 0 | 0 | Reserved family |

## Asset queue

No unassigned production asset remains. The live-proof queue is every row with `Wire=1` and `Live=0`; the reserved heavy-strike family waits for a shipping skill.

## Acceptance

Automated contracts may prove classification, packet fields, asset loading, and sequence timing. Final completion follows `live-production-game-qa`: ordinary player URL, shipping runtime path, visible capture of the transient sequence, and clean browser console. QA fixtures remain diagnostic.

`Inner Flow` remains outside the production offer allowlist. Existing saved session state that activates it resolves through the shared staged healing family.
