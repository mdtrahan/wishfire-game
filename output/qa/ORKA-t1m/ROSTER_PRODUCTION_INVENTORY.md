# Wishfire roster puppet production inventory

Read-only planning evidence, 2026-10-07. Pilot candidate stays at `817faa08`; this document and the mechanical reference montage do not alter its art, native sources, exports, loader or preview. Independent round-2 motion review and assembled game QA remain pending. Production pose families below are proposed visual treatments, not approved changes to skill effects, timing, targeting or equipment.

## Inspected source evidence

Pixel inspection: `roster-reference-inventory.png` combines all three remaining current chibi heroes and all ten original enemy PNGs. Heroes are 1254×1254 RGBA; enemy references are 394×512 RGBA. Sources: `web-runner/assets/images/{Hondo,Runa,Kaja}.png` and `enemy_sprite-{chimerilass,djinn,gobloc,high gobloc,high orc,lizardo,marid,orc,skeleton,troll}-000.png`. Existing Fara and new Gobloc pilot sources remain the style/assembly reference.

All ten enemy references have two arms and two legs. No quadruped or extra creature is required by the inspected roster. The early anatomy stress test can use Lizardo's tail and clawed feet or Chimerilass's animal ears, tail and feet. High Orc supplies the wide silhouette and a visible weapon. Encounter boss classification must come from runtime content data; body size or a filename does not establish that classification.

## Actor identity and rig requirements

Shared topology means a native root/pelvis, torso/head, two shoulder–elbow–hand chains and two hip–knee chains. It permits source-template reuse with actor-specific dimensions, pivots, layer order, joint coverage and poses. It does not make one painted arm or one animation suitable for every costume. The pilot combines shin and boot, so a character needing visible ankle/claw articulation requires that joint and split art to be added in native authoring.

| Actor | Observed identity/anatomy and attachments | Reusable structure and distinct source needs |
|---|---|---|
| Fara / save Falie | Blue skin, red hair, pointed ears, armored fur shoulders, wrapped forearms, skirt armor and boots; no painted shield or weapon in current chibi | Existing pilot biped. Hair follows head; segmented armor overlaps covered joints. Keep Shield Slam equipment decision separate from its skill name. |
| Hondo / save Huun | Blue skin, dark hair, pointed ears; navy/maroon turban with central jewel and hanging fabric, red top, gold shoulder/arm armor, pale belt/apron panels, dark trousers, boots; no visible held blade | Biped template. Separate turban tails and belt/apron panels for travel; gold cuff overlap needs its own coverage. Weapon or projectile hand art requires an explicit art decision. |
| Runa / save Runa | Blue skin, reddish hair, pointed ears; white hood and mouth scarf, jeweled gold head trim, earrings, white sleeves, ornate navy/purple robe and sash, boots; no visible staff | Biped with separate hood rear, scarf/front robe panels, earrings and sleeve cuffs. Lower-body silhouette is constrained by robe, so leg travel must read below hems. Staff is not implied by mage role. |
| Kaja / save Kojonn | Blue skin, white swept hair and full beard, pointed ears; white/navy coat, turquoise sash and long trailing ties, navy trousers, boots; no visible held implement | Biped, beard follows head while coat and teal ties follow their own secondary motion. Split front coat panels to cover hips during movement. Support release requires readable hands beyond cuffs. |
| Gobloc | Olive skin, sandy spiked hair, maroon jacket/tails, pale sleeves, gloves, belts, baggy slate trousers, boots | Existing chibi pilot. Separate coat back; elbow overlap and low hands preserved. |
| High Gobloc | Pale olive/grey skin, short spiked hair, orange/red scarf or shoulder wrap, bare torso, dark blue oversized hands/forearms, pale baggy trousers, belts and wrapped lower legs | Biped template with actor-specific larger fists, neck scarf and trousers. Distinct torso/arm art; Gobloc palette swap would lose identity. |
| Orc | Broad green/grey muscular biped, swept short hair, maroon shoulder scarf and trousers, bronze bracers, multiple belts, wrapped shins/feet | Broader torso and longer arms; separate scarf and belts. Coverage must hold during a large punch and crouch. |
| High Orc | Very broad pale green/grey muscular biped, dark hair and tusked/horned facial outline, maroon mantle, heavy bronze cuffs, dark baggy trousers; long pale sword held across front | Wide biped variant with distinct head/torso, cape rear/front and a separate sword/grip attachment. Sword arc, near/far layer swaps and true opposite hand policy need review. Preserve long weapon reach within atlas bounds. |
| Troll | Pale green/grey muscular biped, dark swept hair, long pointed ears; bronze arm ornaments, pale waist wraps and layered blue/pale cloth, wrapped shins | Biped with broader hands and torso, hanging cloth split at hips. Ear and cloth silhouettes distinguish it from Orc; no visible weapon. |
| Lizardo | Reptilian head/snout, scaled skin, long rear tail, clawed hands and splayed clawed feet, navy coat/armor, belts and pale trousers | Shared limb graph plus native multi-segment tail chain and foot/claw articulation if stepping needs it. Tail behind legs/body, head profile and three-dimensional foot shape need dedicated opposing-facing policy. |
| Chimerilass | Tawny animal head, prominent ears, reddish mane, long animal tail, furred/clawed hands and feet; dark shoulder/torso cloth, pale trousers and long navy coat/waist drape | Biped plus tail; mane follows head, coat follows pelvis. Native foot/ankle split should preserve paw contact. Repaint animal proportions into compact chibi without losing species cues. |
| Djinn | Dark blue skin, horned/spiked head, pointed ears, bare torso; gold bracelets and bead belt, pale baggy trousers, dark feet, long thin belt cord; glowing sphere by one hand | Slim biped with floating orb as visual attachment/effect, beads and cord separate. Orb ownership and left/right mirroring need explicit metadata. Tail-like cord is clothing, not evidence of animal anatomy. |
| Marid | Dark blue bulky skin, pointed/spiked head, bare broad torso; gold wrist/belt details, red waistband, pale voluminous trousers, pointed dark feet | Broad biped. Large trouser silhouette needs hip/leg coverage, torso/shallow neck differs from slim Djinn. No legless smoke body is present in reference. |
| Skeleton | Exposed skull, rib cage, bony long limbs and fingers; red-orange flowing mantle/scarf, dark/purple smoke-like trouser or leg wraps, pointed foot silhouette | Biped graph with open rib and bone silhouettes. Joint paint must remain anatomically narrow; round flesh caps from pilot would be visible. Separate ragged mantle. Lower-body material should be confirmed in enlarged source art before repaint. |

## Full 33-skill visual mapping

Skill effects were read from `governance/planning/conditional-skill-catalog.md` sections Tank, Damage, Mage and Support, with identity IDs/unlock ownership from its Coder direction. Eight Fara, eight Hondo, eight Runa and nine Kaja entries total 33. Shared pose families reduce authoring work; effect signatures keep actions recognizable. All markers are visual metadata. Simulation continues to own application, targeting, displacement, cooldowns and effect duration.

| Actor / skill | Proposed pose family | Signature that requires separate art or effect treatment |
|---|---|---|
| Fara Challenge Bolt | Directed hand release | Target bolt and Provoke cue; release aimed toward current target. |
| Fara Iron Resolve | Self brace/recover | Self healing pulse; hand-to-chest or closed guard. |
| Fara Brace | Firm guard | Held covered stance; visible protection/charge cue belongs to effect state. |
| Fara Retaliation Burst | Recoil-to-counter release | Reactive counter burst centered on attacker and nearby area; must coexist with hurt presentation. |
| Fara Shield Slam | Forward body/forearm strike | Impact ring and push direction. Current hero has no shield; preserve identity pending equipment decision. |
| Fara Cover | Broad protective release | Party cover connections/guard aura with Fara as source; awakening silhouette. |
| Fara Crimson Ward | Broad protective release | Shared red ward visualization; distinguish from Cover links. |
| Fara Destiny | Upward blessing | Party regeneration aura; timed ticks are effect-owned. |
| Hondo Ambush | Short directed lunge/strike | Single-target sharp contact, no unapproved teleport/dash movement. |
| Hondo Cheap Shot | Directed strike | Distinct delay/status cue on recipient. |
| Hondo Razor Sweep | Lateral sweep | Rectangular attack footprint and arc; confirm weapon art before implying a blade. |
| Hondo Piercing Throw | Directional throw release | Explicit projectile/corridor signature, hand release separate from basic punch. |
| Hondo Finish the Job | Compressed heavy strike | Finisher contact with conditional death splash; splash only when simulation reports it. |
| Hondo Overrun | Heavy sweep/awakening | Large target-centered burst with readable recovery. |
| Hondo Split | Multi-target fan release | Divided effect paths per actual recipient; no clone actors implied. |
| Hondo Arcane Pulse | Forward palm/sweep release | Cone outline/pulse; distinguish from horizontal throw. |
| Runa Frost Reversal | Two-hand outward release | Frost ring plus reported retreat direction. |
| Runa Hex Beacon | Point/mark release | Target marks/beacon visual, resist debuff cue. |
| Runa Burn Sigil | Downward place gesture | Fixed ground rune/zone; caster pose does not track or relocate zone. |
| Runa Null Field | Broad outward release | Silence/magic suppression field signature. |
| Runa Return Gate | Point/open gesture | Recipient gate entry/exit flashes at actual displaced coordinates. |
| Runa Cataclysm | Upward gather then broad release | Awakening-scale elemental wave and retreat cue. Current instant resolution constrains any added anticipation. |
| Runa Faze | Point/mark release | Blight mark distinct from Hex; timed damage effect. |
| Runa Chain Strike | Basic-hit follow-through | Sequential energy links to two recipients; event-driven presentation can overlap basic recovery. |
| Kaja Wishgrant | Upward blessing | Party attack/magic blessing signature. |
| Kaja Quickload | Focused hand release | Single recipient tempo/speed cue. |
| Kaja Shared Tempo | Broad blessing | Party pulse with tempo signature distinct from Quickload. |
| Kaja Patchwork | Open-hand heal | Immediate party healing spark/ring. |
| Kaja Fortune's Blessing | Upward blessing | Shared selected-stat icon/color, driven by actual random result. |
| Kaja Sanctuary | Broad awakening blessing | Heal plus revival rise effect on actual selected KO hero; revived actor returns through simulation-owned state. |
| Kaja Magic Fruit | Offer/open-hand release | Fruit visual and recipient heal/max-HP cue. No held fruit exists in reference; separate effect art or new attachment required. |
| Kaja Grow | Upward party release | Tier-specific party amplification cue; effect description does not authorize changing hero body scale. |
| Kaja Shrink | Directed point release | Target scales to 70% around the fixed foot origin, with debuff cue. Simulation effect state owns size and duration. |

## Production sequence and measurable scope

1. Finish the two-actor motion gate and assembled stage gate. Archive failed candidate evidence and preserve authored sources. Resolve remaining basic/cast/recoil criticism before propagating the template.
2. Produce Runa or Kaja as the drapery/hair test and Lizardo as the anatomy/attachment test. Establish hood/coat overlap, tail contact avoidance and fixed feet in both facings. High Orc then exercises weapon reach and wide silhouettes. These come from the existing roster.
3. Create per-actor reference cards and part manifests for the remaining three heroes and nine enemies. Preserve all original PNGs. Generate chibi part art with covered joints and hidden paint; inspect neutral assemblies at 56px and enlarged scale before exporting every clip.
4. Author the seven required presentation states for each actor. Share topology, marker conventions and exporter; customize dimensions and poses. Each actor's basic must communicate its attack mechanism. Generic cast is a fallback production category until its signature family is authored and reviewed.
5. Add pose families and separate effect art for the 33 entries. Start with each hero's distinctive release and awakening; reuse a reviewed family for compatible skills. Keep zero-time instant releases aligned with current effects. A new windup or damage delay needs separate gameplay authorization.
6. Freeze actor batches and run native repeat export, alpha/bounds/foot checks, pause-time playback and independent small-scale silhouette review. Integrate only approved batches under the parent gauntlet/lifecycle process.

At the pilot frame density, fourteen actors × seven states × two facings gives 196 clips and 2016 PNG frames. The existing two-actor set decodes to 18MiB; an eager whole-roster load would decode to 126MiB before effects, backgrounds and other runtime art. A single 12-frame 128² clip is 0.75MiB; fourteen simultaneously loaded idle clips cost 10.5MiB. The loader is lazy but currently caches without eviction, so roster expansion requires a measured active-encounter cache limit and cleanup policy before production acceptance. Mirroring halves unique source art only when asymmetric equipment remains acceptable; the current exporter still stores both faced PNG sets.

There are twelve remaining actors to paint/assemble, not thirteen. Budget review must include unique source art, seven-state animation, specialty attachments, pose family variants, combat effect art and independent review time. No duration estimate is supplied without observing the second actor batch. Native renderer export is proven; interactive authoring UI, roster-wide reuse and real encounter peak memory still require evidence.
