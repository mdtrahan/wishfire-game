# Gambit-style skill conditions

**Retired 2026-10-23 (bd-ORKA-jyz): the 33-skill kit below was deleted from runtime. The accepted four-skill kits live in `web-runner/src/core/heroDefinitions.mjs`.**

**Approved kits: 33 skills, including the original 24, 8 restored legacy skills and Shrink; each hero retains 1 role-defining awakening; the candidate runtime implements this catalog; human QA and integration remain pending.**

No skill requires another skill to activate or generates a named follow-up skill; each effect belongs to its own cast.

Foes are living and in attack range; CDs use integer seconds with every pair more than 20% apart relative to the shorter CD.

## Owner review

V1 is implemented locally in `codex/ORKA-ood-conditional-skills` (ORKA-ood): all 33 skills use the conditions below, with shared overlap limits, integer cooldowns and explicit unlocks. Skill names remain editable. Listed tuning values are the implementation defaults; weather and biomes remain future proposals. See the [implementation goal](../../goals/wishfire-conditional-skills.md) for validation and checkpoint receipts.

Read the hero cards below for skill behavior; [coder direction](#coder-direction) defines how to build them. Names are editable display labels; changing a name will not change its saved/internal ID. All 33 skills stay in the proposal.

| Change to review | Player-facing result | Status |
|---|---|---|
| Skill access | Keep levels 1/5/10/15/25 for the first five skills; add later skills at 35/50, Kaja's Shrink at 60, and awakenings at 75. | Proposed unlocks for the expanded kits |
| Stat limits | Temporary effects can take ATK/DEF/MAG/RES from 50% to 175% of normal; HP/SPD from 50% to 150%; damage reduction stops at 60%. | Proposed safety limits, adjustable in one tuning table |
| Overlap | The strongest buff and strongest debuff affect each stat; weaker effects stay suppressed until the stronger one ends. | Requested guard behavior |
| Already affected targets | Most buffs/debuffs skip recipients who already have that same effect; Faze explicitly refreshes Blight when its group trigger qualifies. | Clarifies mixed-target casts |
| Combat boundaries | Effects persist through ordinary waves; boss replacement clears enemy effects; boss victory, defeat or leaving/reloading resets temporary battle state. | Proposed lifecycle rule |
| Grow | Retain its three legacy effect strengths, 8/14/20%, for review; this adds no upgrade tiers to other conditional skills. | Provisional effect progression |

These values are a concrete V1 proposal for review. The candidate implements this catalog and preserves earned levels, EXP, gear and canonical save identities. The 33 linked cards remain the readable skill-design section.

## Skill navigation

| Hero | Skills |
|---|---|
| Fara | [🔹Challenge Bolt](#fara-challenge-bolt) · [🔹Iron Resolve](#fara-iron-resolve) · [🔹Brace](#fara-brace) · [🔹Retaliation Burst](#fara-retaliation-burst) · [🔹Shield Slam](#fara-shield-slam) · [🔶Cover: Awakening](#fara-cover-awakening) · [🔹Crimson Ward](#fara-crimson-ward) · [🔹Destiny](#fara-destiny) |
| Hondo | [🔹Ambush](#hondo-ambush) · [🔹Cheap Shot](#hondo-cheap-shot) · [🔹Razor Sweep](#hondo-razor-sweep) · [🔹Piercing Throw](#hondo-piercing-throw) · [🔹Finish the Job](#hondo-finish-the-job) · [🔶Overrun: Awakening](#hondo-overrun-awakening) · [🔹Split](#hondo-split) · [🔹Arcane Pulse](#hondo-arcane-pulse) |
| Runa | [🔹Frost Reversal](#runa-frost-reversal) · [🔹Hex Beacon](#runa-hex-beacon) · [🔹Burn Sigil](#runa-burn-sigil) · [🔹Null Field](#runa-null-field) · [🔹Return Gate](#runa-return-gate) · [🔶Cataclysm: Awakening](#runa-cataclysm-awakening) · [🔹Faze](#runa-faze) · [🔹Chain Strike](#runa-chain-strike) |
| Kaja | [🔹Wishgrant](#kaja-wishgrant) · [🔹Quickload](#kaja-quickload) · [🔹Shared Tempo](#kaja-shared-tempo) · [🔹Patchwork](#kaja-patchwork) · [🔹Fortune's Blessing](#kaja-fortunes-blessing) · [🔶Sanctuary: Awakening](#kaja-sanctuary-awakening) · [🔹Magic Fruit](#kaja-magic-fruit) · [🔹Grow](#kaja-grow) · [🔹Shrink](#kaja-shrink) |

## Tank: Fara

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Challenge Bolt](#fara-challenge-bolt) | Foe lacks Provoke (`provoke`) | First matching foe | 7 |

#### Fara: Challenge Bolt

**Effect:** Deal 80% attack damage and apply Provoke for 4 seconds, redirecting its eligible single-target attacks to living Fara.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Iron Resolve](#fara-iron-resolve) | Foes ≥ 1; self HP < 45% | Self | 12 |

#### Fara: Iron Resolve

**Effect:** Immediately restore 12% of Fara's max HP.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Brace](#fara-brace) | Foes ≥ 1; self HP < 60% AND lacks Brace | Self | 15 |

#### Fara: Brace

**Effect:** Halve damage from Fara's next two hostile hits for up to 5 seconds.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Retaliation Burst](#fara-retaliation-burst) | On enemy HP damage to Fara; both survive; attacker in range | Attacker and foes within radius 75 | 19 |

#### Fara: Retaliation Burst

**Effect:** Deal 80% attack damage to the attacker and nearby foes.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Shield Slam](#fara-shield-slam) | Boss in range OR any circle of radius 65 contains ≥ 2 foes | Boss-centered circle, otherwise best matching foe-centered circle | 23 |

#### Fara: Shield Slam

**Effect:** Deal 100% attack damage and push movable non-boss foes right by up to 55 distance units, capped at the attack line.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| **[🔶Cover: Awakening](#fara-cover-awakening)** | Foes ≥ 1; any living hero HP < 35% | Fara and all other living heroes | 40 |

#### Fara: Cover: Awakening

**Effect:** For 6 seconds, redirect other heroes' eligible single-target hits to Fara and reduce all damage she takes by 40%.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Crimson Ward](#fara-crimson-ward) | Foes ≥ 1; any living hero HP < 70%; shared ward HP = 0 | All living heroes through one shared ward pool | 50 |

#### Fara: Crimson Ward

**Effect:** Create a shared ward equal to 18% of summed living-hero max HP, absorbing incoming party damage before hero HP until depleted.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Destiny](#fara-destiny) | Foes ≥ 1; any living hero HP < 70% AND lacks Destiny | All eligible living heroes | 80 |

#### Fara: Destiny

**Effect:** Restore 8% of each recipient's max HP every 2 seconds for 6 seconds.

## Damage: Hondo

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Ambush](#hondo-ambush) | Foe HP ≥ 75% | First matching foe | 7 |

#### Hondo: Ambush

**Effect:** Deal 160% attack damage to the foe.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Cheap Shot](#hondo-cheap-shot) | Foes ≥ 1 | Highest-base-ATK foe | 9 |

#### Hondo: Cheap Shot

**Effect:** Deal 150% attack damage and delay its next attack by 1 second.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Razor Sweep](#hondo-razor-sweep) | Any foe-centered 80×110 rectangle contains ≥ 2 foes | Foes in the best matching rectangle | 11 |

#### Hondo: Razor Sweep

**Effect:** Deal 70% attack damage to every foe in the rectangle.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Piercing Throw](#hondo-piercing-throw) | At least 1 foe intersects the horizontal path | Foes in a 28-distance-unit-wide horizontal path from Hondo to the attack line at x = 290 | 14 |

#### Hondo: Piercing Throw

**Effect:** Throw horizontally right from Hondo, dealing 130% attack damage to every foe intersecting its 28-distance-unit-wide path.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Finish the Job](#hondo-finish-the-job) | Foe HP < 35% | Lowest-HP matching foe | 17 |

#### Hondo: Finish the Job

**Effect:** Deal 220% attack damage, splashing 80% within radius 50 if the target dies.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| **[🔶Overrun: Awakening](#hondo-overrun-awakening)** | Boss in range HP < 50% OR any circle of radius 90 contains ≥ 2 foes | Eligible boss-centered circle, otherwise best matching foe-centered circle | 36 |

#### Hondo: Overrun: Awakening

**Effect:** Deal 260% attack damage to the target and surrounding foes.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Split](#hondo-split) | Foes ≥ 2 | All foes in range | 22 |

#### Hondo: Split

**Effect:** Divide one 100% attack-damage budget equally among all targets.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Arcane Pulse](#hondo-arcane-pulse) | At least 1 foe in the forward cone | Foes within Hondo's 120-distance-unit-long, 60° forward cone | 27 |

#### Hondo: Arcane Pulse

**Effect:** Sweep the cone for 130% attack damage to every foe caught in it.

## Mage: Runa

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Frost Reversal](#runa-frost-reversal) | Boss in range OR any circle of radius 75 contains ≥ 2 foes | Boss-centered circle, otherwise best matching foe-centered circle | 9 |

#### Runa: Frost Reversal

**Effect:** Deal 80% magic attack damage and force movable non-boss foes into a 1.25-second retreat.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Hex Beacon](#runa-hex-beacon) | A foe within radius 110 of first foe lacks Hex Beacon | Eligible foes within that radius | 12 |

#### Runa: Hex Beacon

**Effect:** Reduce their RES by 25% for 6 seconds, leaving later arrivals unaffected.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Burn Sigil](#runa-burn-sigil) | No active Burn Sigil zone AND (boss in range OR any circle of radius 90 contains ≥ 2 foes) | Fixed circle at boss, otherwise best matching foe-centered circle | 18 |

#### Runa: Burn Sigil

**Effect:** Deal 25% magic attack damage each second to attackable occupants for 6 seconds.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Null Field](#runa-null-field) | Foe qualifies as Magic threat (defined below) AND lacks Null Field | Eligible foes within radius 90 of first matching foe | 22 |

#### Runa: Null Field

**Effect:** Prevent affected foes from starting standard magic attacks for 3 seconds.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Return Gate](#runa-return-gate) | Non-boss foe with rightward room ≥ 40 distance units, capped at 100 | Furthest-advanced matching foe | 27 |

#### Runa: Return Gate

**Effect:** Teleport the eligible non-boss foe right by up to 100 distance units, capped at the attack line.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| **[🔶Cataclysm: Awakening](#runa-cataclysm-awakening)** | Boss in range OR foes ≥ 3 | All foes in range | 45 |

#### Runa: Cataclysm: Awakening

**Effect:** Deal 200% magic attack damage to all targets and force non-bosses into a 2-second retreat where movement is valid.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Faze](#runa-faze) | (Foes ≥ 2 AND at least 1 lacks Blight) OR boss in range lacks Blight | All foes in range | 34 |

#### Runa: Faze

**Effect:** Apply Blight to every target, dealing 1 magic damage each second for 3 seconds; reapplication refreshes the duration without stacking.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Chain Strike](#runa-chain-strike) | On Runa's basic hit dealing HP damage; ≥ 2 other foes in range | First two other living foes in encounter order | 56 |

#### Runa: Chain Strike

**Effect:** Bounce magical energy to two other foes in sequence, each taking 66% of the triggering basic hit's pre-mitigation damage through magic mitigation.

## Support: Kaja

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Wishgrant](#kaja-wishgrant) | Foes ≥ 1 AND (living heroes ≥ 2 OR boss in range) AND any living hero lacks Wishgrant | All eligible living heroes | 33 |

#### Kaja: Wishgrant

**Effect:** Raise ATK and MAG by 35% for 6 seconds.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Quickload](#kaja-quickload) | Foes ≥ 1; living hero lacks Quickload | Slowest-firing matching hero, including Kaja | 22 |

#### Kaja: Quickload

**Effect:** Set their basic interval to 0.4 seconds for 4 seconds and bring the next shot due within 0.4 seconds.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Shared Tempo](#kaja-shared-tempo) | Foes ≥ 2 AND any living hero lacks Shared Tempo | All eligible living heroes | 27 |

#### Kaja: Shared Tempo

**Effect:** Reduce each hero's basic attack interval by 25% for 6 seconds.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Patchwork](#kaja-patchwork) | Foes ≥ 1; any living hero HP < 75% | All living heroes | 18 |

#### Kaja: Patchwork

**Effect:** Immediately restore 8% of each hero's max HP.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Fortune's Blessing](#kaja-fortunes-blessing) | (Boss in range OR foes ≥ 3) AND any living hero lacks Fortune's Blessing | All eligible living heroes | 40 |

#### Kaja: Fortune's Blessing

**Effect:** Raise one shared random ATK/DEF/MAG/RES stat by 25% for 5 seconds.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| **[🔶Sanctuary: Awakening](#kaja-sanctuary-awakening)** | Foes ≥ 1 AND (≥ 2 living heroes HP < 40% OR any deployed hero KO) | All living heroes and first KO hero in party order | 65 |

#### Kaja: Sanctuary: Awakening

**Effect:** Restore 20% max HP to living heroes and revive the first KO hero at 30% max HP.

Awakening roles: **Fara takes damage for allies; Hondo bursts down a packed frontline; Runa clears and displaces waves; Kaja heals and revives.**

Persistent buffs and debuffs are effects of their owning skill, not additional skill entries.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Magic Fruit](#kaja-magic-fruit) | Foes ≥ 1; living hero HP < 40%; not used this battle | Lowest-HP matching living hero; all living heroes receive the max-HP increase | 100 |

#### Kaja: Magic Fruit

**Effect:** Raise each living hero's battle max HP by 15% of their pre-Fruit max HP, then heal the selected hero for 32% of their resulting max HP.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Grow](#kaja-grow) | Boss in range; all living heroes HP > 80%; Grow tier < 3 | All living heroes | 125 |

#### Kaja: Grow

**Effect:** Advance the battle's Grow tier to +8%, +14% or +20% damage amplification with an equal max-HP reduction, replacing the previous tier.

| Skill | Condition | Target | Proposed CD |
|---|---|---|---|
| [🔹Shrink](#kaja-shrink) | Ordinary foe DEF ≥ highest living hero DEF AND lacks Shrink AND Shrink can improve its debuffs | Highest-current-DEF matching ordinary foe; excludes sub-bosses and bosses | 50 |

#### Kaja: Shrink

**Effect:** Shrink the foe to 70% visual size and reduce its ATK and DEF by 35% for 6 seconds.

### Legacy additions: source and adaptation

All 24 original skill cards and conditions are preserved. Owner assignments: Fara/Crimson Ward–Destiny, Hondo/Split–Arcane Pulse, Runa/Faze–Chain Strike and Kaja/Magic Fruit–Grow–Shrink. Chain Strike uses the former II effect as one standalone skill; no tier-I version or prerequisite remains. Shrink is a new proposal.

Historical effect provenance: legacy definitions described during the earlier inventory; they do not select implementation owners or APIs. Use the active-worktree entry points in [coder direction](#coder-direction). Realtime adaptations replace red-board/turn gates; Arcane Pulse is now Hondo's physical conical swipe, Faze refreshes without stacks, and Magic Fruit is capped once per battle. Listed magnitudes, seconds and CDs are proposals. Conditional-skill progression tiers remain undecided; the V1 review proposal retains Grow's legacy 8/14/20 effect stages without introducing skill-tier prerequisites.

Chain Strike resolves only from Runa's ordinary basic hit, with target mitigation applied independently to each bounce; bonus and skill hits cannot trigger it. No every-second-hit counter remains. Arcane Pulse's forward cone points along +x: include an in-range foe when `dx ≥ 0`, distance from Hondo is ≤ 120 and `abs(dy) ≤ dx × tan(30°)`; exact boundaries count.

Magic Fruit needs a battle-use flag and max-HP modifier; Grow needs a battle tier and max-HP modifier; Crimson Ward needs a shared damage-absorption pool. Current realtime ownership and new state records are specified in [coder direction](#coder-direction). Grow recomputes its penalty if Fruit later changes underlying max HP; both reset at battle end, and later revival receives current battle modifiers. These are design proposals.

## Named effects and exact meanings

These are owned effects, not extra skills; IDs below are the only named effects/zones accepted by this proposal.

| Name / ID | Owner / applying skill | Exact effect |
|---|---|---|
| Provoke / `provoke` | Fara / Challenge Bolt | For 4 seconds, redirect the affected enemy's eligible single-target attacks to the casting Fara while she is alive. |
| Brace / `brace` | Fara / Brace | Halve Fara's next two hostile incoming hits, including redirected hits, for up to 5 seconds. |
| Cover / `cover` | Fara / Cover awakening | For 6 seconds, redirect other living heroes' eligible single-target hits to Fara and reduce all damage she takes by 40%. |
| Hex Beacon / `hex_beacon` | Runa / Hex Beacon | Reduce affected enemies' RES by 25% for 6 seconds. |
| Burn Sigil zone / `burn_sigil` | Runa / Burn Sigil | Fixed radius-90 zone dealing 25% magic attack damage each combat second for 6 seconds; uniqueness checks include every source's active zone. |
| Null Field / `null_field` | Runa / Null Field | For 3 seconds, block affected enemies from starting actions whose IDs begin `Enemy_MAG_`, without cancelling actions already underway or affecting later arrivals. |
| Wishgrant / `wishgrant` | Kaja / Wishgrant | Raise living recipients' ATK and MAG by 35% for 6 seconds. |
| Quickload / `quickload` | Kaja / Quickload | Set the recipient's basic interval to 0.4 seconds for 4 seconds and bring its next shot due within 0.4 seconds. |
| Shared Tempo / `shared_tempo` | Kaja / Shared Tempo | Multiply living recipients' ordinary basic interval by 0.75 for 6 seconds. |
| Fortune's Blessing / `fortunes_blessing` | Kaja / Fortune's Blessing | Choose ATK/DEF/MAG/RES once using combat RNG and raise that same stat by 25% for all living recipients for 5 seconds. |
| Crimson Ward / `crimson_ward` | Fara / Crimson Ward | Shared pool set at 18% of summed living-hero max HP on cast; hostile damage consumes it before hero HP, after personal mitigation; ends on depletion or battle end. |
| Blight / `blight` | Runa / Faze | Each affected foe takes 1 magic damage at cast +1/+2/+3 seconds; refresh replaces the tick schedule, without stacking or spreading to later arrivals. |
| Destiny / `destiny` | Fara / Destiny | Each living recipient heals 8% of its current max HP at cast +2/+4/+6 seconds, capped at max HP; refresh replaces remaining ticks; KO removes the effect. |
| Magic Fruit / `magic_fruit` | Kaja / Magic Fruit | Once per battle: each living hero gains 15% of its pre-Fruit max HP, then the selected hero heals 32% of resulting max HP; max-HP bonus ends at battle end. |
| Grow / `grow` | Kaja / Grow | Battle tiers are 8/14/20% damage amplification and max-HP reduction, replacing prior tiers; penalties use max HP before Grow, including any Fruit bonus; clamp HP to the new maximum, with minimum max HP of 1. |
| Shrink / `shrink` | Kaja / Shrink | For 6 seconds, multiply the affected foe's ATK and DEF by 0.65 and visual scale by 0.70; refresh without stacking; targeting, hitbox, position and movement remain unchanged; sub-bosses and bosses are ineligible. |

### Condition and resolution definitions

- **Stat comparison key:** `actor.stat_compare` expresses `[subject].[stat] [operator] [aggregate]([reference group].[stat])`; Shrink uses `foe.DEF >= max(livingHeroes.DEF)` with current effective combat stats, including buffs/debuffs, checked at selection and cast. Parameters are subject, stat, operator, reference group and aggregate; no hero name is embedded. Empty reference groups fail the condition; ties use encounter order.
- **Shrink eligibility:** ordinary enemies only; boss/sub-boss exclusion requires explicit authored enemy rank, and sub-boss support must be verified before runtime integration rather than inferred from HP or DEF.

- **Magic threat:** `attackType === 'magic' OR (streamDelivery === 'ranged' AND base MAG > base ATK)`, using the current enemy classifier; this does not imply every action is magic.
- **Living / KO:** deployed actor HP > 0 / HP ≤ 0; saved undeployed heroes are excluded, and all-living-hero targets include the caster.
- **Attack range:** the shared `isHeroBasicTargetInRange` rule, including its life, position and approach-state checks; **boss in range** adds the enemy's boss role.
- **First / ties:** use stable encounter order for foes and party order for heroes; highest ATK uses base ATK, lowest HP uses HP/max HP, slowest firing uses the ordinary unbuffed interval.
- **Shapes:** numbers labelled distance units are logical coordinates, never actor counts; circle counts include the anchor and rectangle dimensions are full width/height.
- **Best matching area:** for Shield Slam, Razor Sweep, Frost Reversal, Burn Sigil and Overrun, test every in-range foe as an anchor, require the stated count inside that shape, choose greatest occupancy and break ties by encounter order; use an eligible boss anchor first when the condition provides that alternative.
- **Piercing Throw line:** start at Hondo’s `(x, y)` and end at `(290, Hondo.y)` with full width 28; hit every in-range foe whose center is between those x endpoints and within 14 distance units of Hondo’s y, without aiming toward another actor.
- **Movement bounds:** push/teleport endpoints never exceed x = 290; bosses stay at their fixed home, and retreat uses the existing movement helper.
- **Conditions:** semicolons mean AND; parentheses control OR grouping; filters match the same candidate unless separate party-wide checks are stated.
- **Active / lacks:** an effect is active while its combat-clock expiry is strictly greater than now, or until charges are exhausted; lacks means no such active effect.
- **Single-target redirection:** resolve Provoke first and Cover afterward at most once; area attacks bypass redirection, and no hit redirects to a KO Fara.
- **Stat overlap:** for each stat, only the strongest active buff and strongest active debuff contribute; separate stats can change together. Same-effect reapplication refreshes duration without stacking strength only when the skill permits refresh. Quickload overrides Shared Tempo; simultaneous damage reductions use the strongest reduction only.
- **Brace charges:** a hostile hit reaching Fara consumes a charge even if final HP loss is zero; a miss consumes none.
- **HP-damage event:** positive resolved HP loss after mitigation/redirection, with the actual recipient and attacker recorded; calculated damage and fully absorbed hits do not qualify.
- **Historical conditions:** V2 remains unavailable until event coverage and scope resets are specified; do not infer history from current HP or logs.

Undefined names/IDs must fail authoring validation; developers must not infer aliases or substitute an effect.

## Stat-modifier guards

These proposed guards apply to both heroes and foes, in addition to each skill's conditions.

| Guard | Rule |
|---|---|
| `actor.effect_active` | Respect each skill's has/lacks check; a recipient-level lacks gate cannot refresh that recipient; group qualification and recipient policy are separate, with Faze explicitly allowing refresh. |
| `modifier.can_improve` | Simulate the candidate effect against active modifiers and limits; allow it only if at least one affected stat changes beneficially for the caster's side. A weaker or equal effect on every affected stat fails. |
| Per-stat overlap | Keep the strongest buff and strongest debuff per stat; never compound repeated percentages. For Shrink, existing stronger DEF Down can block its DEF component while ATK Down still applies if it improves ATK reduction. |
| Final limits | Clamp every effective stat and derived modifier to authored minimum/maximum multipliers relative to the unmodified combat-load baseline; floor damage amplification, attack interval and mitigation through their own authored bounds too. Use the explicit proposed V1 limits in [coder direction](#coder-direction); owner review distinguishes these tuning proposals from confirmed decisions. |
| Baseline / expiry | Calculate from level/gear stats plus registered active modifiers, never from a previously modified result; Fruit and Grow remain battle modifiers, and removing/expiring an effect recomputes from the baseline. |
| Revalidation | Recheck current stats, effect eligibility and projected benefit immediately before action commitment; resolve modifiers in stable action order and recompute before the next action. Failed guards consume neither cast nor cooldown. |

`modifier.can_improve` parameters: target, proposed effect ID and modifier policy. It requires an effect registry and modifier resolver; this is new integration work, not an existing runtime predicate. Multi-target stat effects filter out recipients with no benefit and require at least one remaining recipient; direct damage/healing follows its separately defined target rules. Same-stat buffs/debuffs can coexist within final bounds, and weaker suppressed effects may resume when stronger effects expire.

## Combat-bounds corrections

Current pack code emits **3–5 enemies** per ordinary pack and **1 boss**; overlapping packs are possible, so no rule requires more than three simultaneous foes.

| Isolated mismatch | Correction preserving the skill's shape |
|---|---|
| Piercing Throw previously aimed through another actor | Use a horizontal, x-parallel path from Hondo to x = 290, hitting every foe in the 28-distance-unit-wide corridor. |
| Shield Slam, Razor Sweep, Frost Reversal and Burn Sigil can miss useful clusters by testing only the first foe | Keep their circles/rectangle and two-foe thresholds, searching valid anchors instead. |
| Overrun's four-foe local cluster is restrictive for three-enemy packs | Keep radius 90 and the wounded-boss alternative, lowering the cluster threshold to two. |
| Cataclysm's four-foe gate excludes three-enemy packs | Require three in-range foes or a boss. |
| Shared Tempo's spatial pair test is unrelated to its party-wide speed buff | Require two in-range foes without a proximity test. |
| Push/teleport wording implies movement beyond the attack line or of stationary bosses | State the movement cap and non-boss eligibility explicitly. |

Geometry probe: 16 settled-pack fixtures using production spawn/shape helpers found the old four-foe cluster false in 14 cases, useful clusters away from the first anchor in 3, and the old piercing line missing its primary target in 12; these are fixture results, not measured live activation rates.

## Availability

V1 reads existing HP, effects, roles, actors, geometry and movement space. State checks run during selection and again at cast; resolved-event checks need adapters. Unlocks/cooldowns remain engine guards.

Optional **Battle: boss active** / **Battle: wave ≥ N** read stage state. Wave means emitted pack; packs can overlap. Burn Sigil is a zone, so “Foe: has BURN” is unavailable. Live combat has no playable SP/turn conditions.

## Later, if a skill needs memory

| Selectable condition / ID | Editable parameters | Required tracking / possible use |
|---|---|---|
| **Self: hit N times this wave** · `history.event_count` | Participant, event, count, scope | Scoped counters; remembered damage/KO prerequisites |
| **Self: damaged within last N seconds** · `history.elapsed_since` | Participant, event, seconds | Combat timestamps; recent-damage defense gates |

V1 is the current-state/event menu. V2 adds these remembered checks only when needed, with explicit resets and event coverage.

Sources: [selection](../../web-runner/src/core/realtimeHeroTargeting.mjs), [effects/events](../../web-runner/src/core/realtimeHeroSkills.mjs), [range](../../src/core/heroAttackTargetingRules.mjs), [waves/movement](../../web-runner/src/core/continuousCombatStage.mjs), [damage](../../web-runner/modules/functionBank.js). Audit covers the preview's 20 hero actives and enemy handlers at checkpoint `0a24c72`.

Machine IDs: `modifier.can_improve`, `actor.stat_compare`, `actor.hp_ratio`, `actor.effect_active`, `actor.trait`, `actors.count`, `enemy.attackable`, `zone.active`, `target.displacement_room`, `event.matches`; optional battle context: `encounter.context`. HP/effect/type/range inputs exist; counts/zones/room are derivable; event adapters require wiring.

## Generic flat list

- Unit: [effect] can improve [buff / debuff] under overlap rules and stat limits

- Unit: [stat] [comparison] [highest / lowest / average] [reference group] [same stat]

- Self: HP [comparison] [percentage]
- Ally: HP [comparison] [percentage]
- Foe: HP [comparison] [percentage]
- Self: [has / lacks] [effect]
- Ally: [has / lacks] [effect]
- Foe: [has / lacks] [effect]
- Unit: [alive / KO]
- Foe: is a boss
- Foe: is a magic threat
- Foe: in attack range
- Party: living heroes [comparison] [count]
- Party: heroes matching [conditions] [comparison] [count]
- Foes: in attack range [comparison] [count]
- Foes: matching [conditions] [comparison] [count]
- Foes: within [shape / dimensions] of [anchor] [comparison] [count]
- Battlefield: [has / lacks] active [zone]
- Foe: available movement space [comparison] [distance], capped at [maximum]
- Battle: boss active
- Battle: wave [comparison] [number]
- On: [recipient] takes HP damage from [source]
- On: [source]'s basic attack deals HP damage to [recipient]
- On: [skill] KOs [target]
- V2: [event] involving [unit] occurred [comparison] [count] times during [scope]
- V2: [event] involving [unit] occurred within the last [seconds] of combat time


## Light and biome affinities: lore check

Source: [authored opening scene](../../web-runner/src/core/wishfireWarpCrossingContent.mjs), dialogue 007, 013, 025–033. Earlier role-based light/biome suggestions are withdrawn; the available scene establishes these connections:

| Hero | Lore evidence | Environmental proposal |
|---|---|---|
| Fara | Recognizes Goldrin Wilds, knows the nearby town and directs the party | Field experience suggests grassy terrain familiarity; grassy classification and bonus remain proposals. |
| Hondo | Recalls an ancient magic-crystallization experiment | Mystical terrain is a thematic candidate; the scene gives no stealth or gloomy-ruins affinity. |
| Runa | Travels with Kaja to investigate ruins and examines the orbs' magic | Ruined terrain is the strongest candidate; mystical is a secondary proposal. |
| Kaja | Begins an expedition with Runa and makes his own map | Ruined terrain shares an expedition connection; cartography supports exploration rather than a specific grass/wetland affinity. |

**Proposed examples:** In ruined terrain, Runa's Hex Beacon lasts 7 seconds instead of 6; Kaja's Fortune's Blessing lasts 6 seconds instead of 5. These are unapproved tuning suggestions, grounded in their shared ruins expedition.

Light predicates: `Environment: light is [brilliant / clear / dim / gloomy]`. Biome predicates: `Environment: biome is [grassy / desert / frozen tundra / wetlands / mystical / ruined]`. Both require future authored battle context; neither exists in the inspected runtime.

The available dialogue establishes no light affinity or biome weakness. Brilliant-light boosts, gloomy-ruins boosts and dim-grassland penalties need fuller character lore or an explicit new lore decision. Character biographies were not found in the inspected repository design/narrative files.


## Coder direction

**Target checkout:** `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-5af.18-progression-loop`, audited at `0a24c72`. This section is the proposed V1 integration contract. Readable cards govern conditions/effects; the following tables govern IDs, availability, overlap and lifecycle. Old files matching display labels are historical provenance. No SP/FLOW, playable turns or skill-tier prerequisites are introduced.

### IDs and availability

Save/identity keys remain `Falie`, `Huun`, `Runa`, `Kojonn`; runtime actor state is keyed by instance UID. Give every active an explicit `unlockLevel` and stable ID; remove the positional five-entry assignment in `kit()`. Cards keep their listed cooldowns. Scheduler priority follows increasing unlock level, then ID. Level changes only refresh availability, without recasting active effects or resetting cooldowns.

| Hero key | Stable skill ID → proposed unlock level |
|---|---|
| Falie | `challenge_bolt` → 1; `iron_resolve` → 5; `brace` → 10; `retaliation_burst` → 15; `shield_slam` → 25; `crimson_ward` → 35; `destiny` → 50; `cover` → 75 |
| Huun | `ambush` → 1; `cheap_shot` → 5; `razor_sweep` → 10; `piercing_throw` → 15; `finish_the_job` → 25; `split` → 35; `arcane_pulse` → 50; `overrun` → 75 |
| Runa | `frost_reversal` → 1; `hex_beacon` → 5; `burn_sigil` → 10; `null_field` → 15; `return_gate` → 25; `faze` → 35; `chain_strike` → 50; `cataclysm` → 75 |
| Kojonn | `wishgrant` → 1; `quickload` → 5; `shared_tempo` → 10; `patchwork` → 15; `fortunes_blessing` → 25; `magic_fruit` → 35; `grow` → 50; `shrink` → 60; `sanctuary` → 75 |

Retain the 18 live IDs represented above and update their behavior to the cards. Retire live `shield_relay` and `split_feed`; their intended replacements are Iron Resolve/Cover and Shared Tempo, respectively, without aliases or legacy follow-up effects. Remove Ambush's old marked-hit bonus, Wishgrant's charged-hit amplification, Split Feed's basic splash and Patchwork's heal-on-basic hooks from this realtime path. Newly added IDs are the remaining 15 entries above. Source changes must update skill UI/progression consumers alongside definitions; changing display names later never changes IDs.

### Data and evaluation

Extend the existing active definition with `trigger`, `conditions`, `targetRule`, `effectSpec`, `recipientPolicy`, `unlockLevel`; retain `skillId`, `displayName`, `cooldownSeconds`, `durationSeconds`, `targetType` and existing numeric effect parameters. Conditions are pure structured data: `{all:[...]}`, `{any:[...]}`, `{not:...}` or a parameterized leaf `{key,...args}`. No executable strings or parsing the Markdown. Unknown IDs, missing parameters, unsupported rank and missing bounds fail authoring validation.

Predicate payloads use these fixed fields; comparisons use `lt`, `lte`, `eq`, `gte`, `gt`, HP thresholds are fractions in [0,1], times are active-combat seconds and distances use logical coordinates:

| Key | Parameters / result |
|---|---|
| `actor.hp_ratio` | `subject`, `operator`, `value`; read current HP/current max HP |
| `actor.effect_active` | `subject`, `effectId`; boolean from the named record's active duration/charges |
| `actor.trait` | `subject`, `field` (`combatRank`, `magicThreat` or `lifeState`), `in`; magicThreat uses the catalog classifier, lifeState is `alive`/`ko` |
| `actor.stat_compare` | `subject`, `stat`, `operator`, `referenceGroup`, `aggregate` (`max`, `min` or `mean`); compare the same current stat |
| `actors.count` | `group` (`attackableEnemies`, `livingHeroes` or `deployedHeroes`), optional `filter` node, `operator`, integer `value` |
| `enemy.attackable` | `subject`; shared live range/life/approach rule |
| `zone.active` | `effectId`, `scope:attempt`; any active matching zone |
| `target.displacement_room` | `subject`, `maxDistance`, `operator`, `value`; cap at attack line, reject bosses |
| `event.matches` | `actionKind` (`basic`/`skill`), `source` (`self`/`enemy`), `recipient` (`self`/`foe`), `isPrimary`, `minHpDamage`; missing event fails |
| `modifier.can_improve` | `subject`, `effectId`; project that effect under the single modifier policy |
| `geometry.count` | `shape`, `anchorRule` (`first`, `bestCluster`, `self` or `eventTarget`), `filter`, `operator`, integer `value`; shape uses card dimensions |
| `battle.flag` | `name` (`magicFruitUsed` or `growTier`), `operator`, `value`; attempt-scoped state |
| `battle.resource` | `name:wardHP`, `operator`, numeric `value`; reads the live `PartyTempHPShield` pool |

Group/self references are resolved relative to the casting hero's team; enemy polarity reverses for a foe casting these rules. Shapes are `circle(radius)`, `rectangle(width,height)`, `horizontalLine(width,toX)` or `cone(length,angleDegrees)`; no distances encode actor counts. `geometry.count` is a derivation over existing position/range data. Weather/biome and optional encounter context remain disabled until authored runtime data exists.

Example Shrink condition data:

```json
{"all":[
  {"key":"actor.trait","subject":"candidate","field":"combatRank","in":["ordinary"]},
  {"key":"actor.stat_compare","subject":"candidate","stat":"DEF","operator":"gte","referenceGroup":"livingHeroes","aggregate":"max"},
  {"not":{"key":"actor.effect_active","subject":"candidate","effectId":"shrink"}},
  {"key":"modifier.can_improve","subject":"candidate","effectId":"shrink"}
]}
```

`candidate` is the selected foe/ally; `self` is the casting instance. References use deployed actor UIDs, current HP and current effective stats. Reuse the catalog's predicates for thresholds, actor counts, zones, geometry, displacement and events; count/shape predicates carry their filter and anchor rule as parameters. Empty aggregate groups fail. Snapshot candidates at selection, reselect/revalidate at commitment, then resolve against current living actors at impact. Enemy spawn definitions must supply `combatRank: ordinary|subboss|boss`; map the existing boss role explicitly, author other ranks in spawn data, and never derive rank from stats. Unknown rank is ineligible for Shrink.

Selections use the existing `{targetUID, targetUIDs, point}` result plus optional `shape`, `event` and `effectChoice`. Conditions evaluate before commitment, at no RNG/cooldown cost. Preserve the live scheduler's ordinary basic/skill arbitration and deterministic ordering. All missing skill clocks start ready at current combat time; a failed check waits ready. Successful commitment starts cooldown once; subsequent impact failure does not refund it. Pause/background freezes combat time. Event-only skills are excluded from ordinary polling.

Retaliation Burst uses the existing positive enemy-HP-damage callback; Chain Strike uses the primary successful Runa basic-impact callback. Normalize events to `{eventId, at, sourceUID, targetUID, actionKind, damageType, hpDamage, rawDamage, isPrimary}`. Evaluate once when the event resolves; events are not stored for later cooldown expiry. Retaliation requires both actors alive; Chain requires two other attackable foes and uses the triggering primary's pre-mitigation raw damage. Derived hits have `actionKind:skill`, `isPrimary:false` and cannot trigger Chain/Retaliation again. Gate event casts with alive/unlocked/cooldown checks, preserving the existing immediate reaction path.

### Current integration owners

| Owner | Responsibility |
|---|---|
| [heroDefinitions.mjs](../../web-runner/src/core/heroDefinitions.mjs) | Stable IDs, explicit unlocks, card parameters and structured rules. |
| New `src/core/skillConditionRules.mjs` | Pure predicate/combinator evaluation over a supplied combat snapshot; no state writes or RNG. |
| [realtimeHeroTargeting.mjs](../../web-runner/src/core/realtimeHeroTargeting.mjs) | Candidate filtering, shapes, target ordering and selection-time evaluation. |
| [realtimeHeroSkills.mjs](../../web-runner/src/core/realtimeHeroSkills.mjs) | Cast validation, effect registry/records, damage/healing adapters, ticks, expiry and reactions. |
| [effectiveStatRules.mjs](../../src/core/effectiveStatRules.mjs) + new `src/core/combatModifierRules.mjs` | One pure stat projection, overlap/clamps and projected-benefit checks; existing optional Rust owner must return the same bounded result. |
| [functionBank.js](../../web-runner/modules/functionBank.js) | Thin wiring at `TickRealtimeHeroBasics`, `GetEffectiveStat`, `ApplyDamageToTarget` and `ResolveRealtimeHeroBasicImpact`; retain established damage/reward/KO consumers. |
| [realtimeCooldown.mjs](../../web-runner/src/core/realtimeCooldown.mjs) | Existing clocks and scheduling; feed evaluated eligibility and explicit priority. |
| [combatSessionReset.mjs](../../web-runner/systems/combatSessionReset.mjs), [continuousCombatStage.mjs](../../web-runner/src/core/continuousCombatStage.mjs) | Clear/retain runtime records at the specified boundaries; do not persist combat effects into hero saves. |

Detailed logic stays in the indicated rules/effect modules; `app.js` remains orchestration. Additions must extend the live realtime path, not revive legacy `ExecuteAstralFlowSpecial`, turn skill dispatch, party-card draw or old state hooks. Healing goes through a UID-targeted adapter with HP/UI/party-total updates and the current resolved-heal event; revive checks KO before writing HP and uses the existing actor so gear/progression/reward identity survive. Skill damage continues through `CalculateDamage`/`ApplyDamageToTarget`; explicit physical/magic mode comes from the card rather than the caster's name. Chain's raw amount and Blight's flat amount require a bounded raw-magic damage adapter, applying target RES exactly once.

### State records and reset

Use `RealtimeSkillEffects[uid][effectId] = {sourceUID, appliedAt, expiresAt, charges?, modifiers?, nextTickAt?, ticksRemaining?, data?}`. Modifier entries are `{channel, direction, magnitude}` with nonnegative magnitude and directions `up|down`; registry defines refresh and source-death policy. Use `RealtimeSkillZones` for Burn Sigil `{kind, sourceUID, point, radius, appliedAt, expiresAt, nextTickAt, damagePct}`. Store combat-only `RealtimeSkillBattleState = {attemptId, baselinesByUID, magicFruitUsed, growTier}`; clocks remain `RealtimeHeroBasicClocks[uid].skillReadyAt[id]`. Keep the live `PartyTempHPShield` absorption pool as the sole ward-HP owner, with `PartyTempHPShieldSourceUID`; cast/reset/KO handlers write that pool, and existing damage resolution consumes it. Do not add a parallel ward pool or mirror a second effect store.

An attempt comprises a stage's ordinary waves and boss. Ordinary packs/waves retain hero effects, ward, Fruit/Grow and cooldowns. Boss replacement removes old-enemy records, zones and obsolete pending hits while retaining hero-side state. Boss victory, defeat/retry, leaving combat and reload clear battle modifiers/effects/clocks/flags and capture clean level/gear baselines for the next attempt. Active-combat level/gear changes refresh those unmodified baselines and reproject effects; clamp living HP to changed max HP, preserving the existing level-up HP increase and KO status.

Target KO removes its timed effects and pending regeneration; source KO removes source-dependent Provoke, Cover and Burn Sigil. Other already-granted buffs/debuffs complete their duration; battle-owned Fruit/Grow persist until attempt reset and apply on revival. Ward ends when exhausted, attempt resets or its Fara source KOs. Remove stale enemy UIDs on despawn. Timer effects tick at authored combat times including the final tick at expiry, then expire; freeze while paused, and do not catch up for wall-clock absence.

### Modifier formula and proposed limits

Capture baseline `B` from unmodified level/gear/traits. Normalize supported flat stat changes to baseline-relative magnitudes (`flat/B`, only when B > 0), so every supported modifier uses the same overlap policy. For each stat, choose maximum active increase `u` and maximum active decrease `d`; `effective = B × clamp(1 + u - d, minMultiplier, maxMultiplier)`. Recompute, never multiply the last effective value. If B = 0, keep zero unless a separately authored flat-add rule exists. Update `GetEffectiveStat` and its existing JS/Rust projection contract together; remove the extra old realtime multiplier pass to prevent double application. All comparisons, damage and timing consumers read the same projected value.

| Channel | Proposed V1 limits / resolution |
|---|---|
| ATK / DEF / MAG / RES | 0.50–1.75 × baseline |
| Max HP / SPD | 0.50–1.50 × baseline; max HP at least 1 |
| Damage amplification | 0.50–1.50 × baseline damage; skill potency is separate and retains its authored value |
| Incoming damage reduction | Strongest active reduction only, capped at 60%; Brace 50% supersedes Cover 40% while its charges last |
| Basic interval | Quickload overrides Shared Tempo; otherwise apply the strongest interval reduction; clamp to `max(0.4, 0.25 × ordinaryInterval)` through `max(thatFloor, 2 × ordinaryInterval)` seconds |
| Shrink visual scale | 0.70 of original visual scale; repeated Shrink never compounds; no hitbox or movement change |

Fruit contributes +15% max HP; Grow contributes its current 8/14/20% damage amplification and equal max-HP penalty, under these bounds. Recalculate Grow after Fruit; preserve HP except the documented healing/clamp. `modifier.can_improve` compares the before/after projected result for each component, ignoring duration extension; at least one component must change beneficially for the caster's team. Stronger effects suppress weaker active records rather than deleting them. Define bounds in one authored tuning object, shared by checks and final application.

### Recipient policy

| Skills | Commitment behavior |
|---|---|
| Wishgrant, Fortune's Blessing, Shared Tempo, Destiny, Hex Beacon, Null Field, Shrink | `skip_active`: filter recipients with the same active effect; stat effects also require projected benefit. Cast only if at least one eligible recipient remains. Condition wording qualifying a group does not override this filter. |
| Faze | `refresh`: once its group/boss gate qualifies, apply Blight to all attackable recipients and replace existing Blight's remaining schedule; no potency stacks. |
| Quickload, Brace, Challenge Bolt | The selected recipient must lack its named effect; otherwise reselect or fail without starting cooldown. |
| Cover, Crimson Ward | Cover refreshes its party protection when its HP gate qualifies; Ward requires an empty pool. Neither stacks strength. |
| Patchwork, Iron Resolve, Sanctuary, Magic Fruit | Clamp healing per living recipient; Sanctuary may also revive its selected KO recipient. Require at least one positive heal/revive or, for Fruit, new max-HP benefit; never heal a KO recipient through a normal heal. |
| Grow | Replace the prior effect stage with the next one, capped at stage 3; no multiplicative reapplication. |

Fortune's Blessing previews one seeded uniform ATK/DEF/MAG/RES choice from a copy of combat RNG state, then applies recipient/benefit guards for that same choice; commit the RNG advancement only on successful cast. Selection retries never reroll to hunt for a favorable stat. A race that changes RNG state requires fresh selection before commitment. Pure conditions never mutate RNG.

### Focused implementation proof

Verify all 33 IDs/owner/unlock mappings; unknown rules fail validation; cooldown spacing and skill-name links survive display-name changes. Test current-stat comparisons after buff/expiry/KO, stronger/weaker overlaps and all clamp edges, mixed recipients/Faze refresh, final-tick expiry, boss entry and attempt reset, failed-cast cooldown refund and event non-recursion. Trace one full live selection→commit→impact for Shrink, Chain, Cover, Fruit and Sanctuary, including a small pack/boss and actor-instance identity. Use existing realtime targeting/skill/cooldown and progression contracts, then browser proof of those changed seams. Runtime implementation still requires its scoped Beads lane.
