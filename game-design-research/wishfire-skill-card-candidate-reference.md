# Wishfire Skill-Card Candidate Reference

Purpose: shortlist skill patterns from the research references that fit Wishfire's gem-pick, party-HP, Astral Flow, and skill-card draw combat.

This is an assessment reference, not a balance spec or implementation plan. Source values below are preserved as source values only. Any Wishfire adaptation still needs its own canonical ID, trigger, draw class, proof cue, and tuning pass.

## Source Inputs

- Archero 2: `game-design-research/archero-2-skill-card-draw-reference.md`
- Final Fantasy Dimensions: `game-design-research/final-fantasy-dimensions-skill-reference.md`
- Final Fantasy V: `game-design-research/final-fantasy-v-skill-reference.md`
- Bravely Default: `game-design-research/bravely-default-skill-reference.md`
- Wishfire local context: `governance/product/player-living-guide.md`, `governance/product/hero-and-party-skills.md`, `governance/product/hero-and-party-skill-pseudocode.md`

## Current Party Skill Baseline

Use these as overlap filters before adding a new candidate.

| Live skill | Current behavior | Overlap filter |
| --- | --- | --- |
| Crimson Ward | Repeatable selection effect: grants a temporary party ward before true HP is damaged. | Remove direct shield, block-one-hit, or generic barrier candidates unless they add a distinct triggered behavior. |
| Magic Fruit | Repeatable selection effect: heals party for 40% of max HP. | Remove direct heal candidates unless they are revive, cleanse, board rescue, or a clearly different session rule. |
| Faze | Repeatable selection effect: blights the field and poisons enemies through field pressure. | Remove poison/blight/DoT variants unless they change the Faze rules instead of merely adding another poison payload. |
| Destiny | One-off session behavior: hero hits have a proc chance to restore 2.5% health on impact. | Remove drain, lifesteal, or heal-on-hit variants unless they trigger from a different combat seam. |

## Fit Filter

Good Wishfire skill-card candidates should do at least one of these:

- Rescue a bad board, low HP state, party wipe, heavy hit, or harmful status.
- Turn enemy pressure into player value through counter, reflect, absorb, or conversion.
- Scale with combat difficulty through enemy stats, damage taken, HP thresholds, status setup, or chain state.
- Create a visible tactical swing without becoming a routine "cast damage spell" or basic attack wrapper.
- Fit card-draw classes: `one_off` for emergency effects, `tiered` for bounded stacking, `repeatable` for clear single-payload effects.
- Answer this card-draw question clearly: after selection, what behavior changes, who owns it, when does it trigger, how long does it last, and how does it avoid duplicating the live party skills?

Filtered-out patterns: plain elemental spell casts, basic melee attacks, one-off role-fantasy commands, equipment permissions, passive stat bumps without a trigger, movement or positioning skills, speed buffs/debuffs, broad turn acceleration, repeated turn denial, extra-action loops, direct heal duplicates, direct shield duplicates, poison-field duplicates, and drain/lifesteal duplicates.

## Emergency Survival / Death Prevention

| Source skill | Source | Source mechanic | Wishfire fit | Likely draw shape |
| --- | --- | --- | --- | --- |
| Revive | Archero 2 | Revives once with 100% HP | Cleanest get-out-of-jail card for party-wipe prevention; high emotional value when combat gets harder | `one_off` |
| Stand Ground | Bravely Default / Freelancer | 75% chance to survive lethal damage with 1 HP; fails at 1 HP | Strong dire-state survival without fully erasing danger | `tiered` chance or `one_off` |
| Time Slip | Bravely Default / Time Mage | Restarts battle on party wipe | Very powerful run-saver; best as rare, explicit, once-per-session safety | `one_off` |
| Auto Phoenix | Bravely Default / Salve-Maker | Auto-uses Phoenix Feather when an ally is KO'd | Maps well to automatic party recovery after a KO-like threshold | `one_off` or `tiered` chance |
| Resurrect | Bravely Default / Salve-Maker | Revives all KO'd allies at 25% Max HP | Strong comeback card if Wishfire later tracks individual hero down states | `one_off` |
| Mega Raise | Final Fantasy Dimensions / Seer + Summoner | Multi-target revive at 1/2 max HP | Stronger revive pattern than Resurrect; should be rarer if adapted | `one_off` |
| Rise from Dead | Bravely Default / Vampire | 50% chance to recover from KO at end of turn | Good scaling survival if tied to party wipe, hero down, or last-stand windows | `tiered` chance |

## Shields / Heavy-Hit Prevention

| Source skill | Source | Source mechanic | Wishfire fit | Likely draw shape |
| --- | --- | --- | --- | --- |
| Cover / Protect Ally / Full Cover | FFV Knight; Bravely Default Knight | Covers critical or selected allies; Full Cover takes physical hits for half damage | Already aligned with Falie's role; scales naturally as enemies focus-fire | `tiered` chance or `repeatable` |
| Mighty Wall | Final Fantasy Dimensions / Warrior + Paladin | Multi-target Protect, Shell, and Bravery | Good broad party-stabilizer if kept short-duration and visible | `one_off` |
| Angelic Ward | Bravely Default / White Mage | 50% chance to halve damage | Simple defensive proc, but should be bounded to avoid invisible smoothing | `tiered` chance |

## Low-HP / Dire-State Payoffs

| Source skill | Source | Source mechanic | Wishfire fit | Likely draw shape |
| --- | --- | --- | --- | --- |
| Adversity | Bravely Default / Dark Knight | After each 25% Max HP damage taken, P.Attack, M.Attack, P.Def, M.Def +10% for three turns | Scales with incoming pressure; good comeback loop if capped | `tiered` bounded stacks |
| The Worm Turns | Bravely Default / Swordmaster | Below 20% HP, counters with 7.5x damage | Excellent panic counter pattern; strong Falie/Huun candidate | `one_off` trigger or `tiered` chance |
| Adrenaline Rush | Bravely Default / Pirate | Below 20% HP: P.Attack and P.Def +50% for five turns | Strong but legible low-HP power spike | `one_off` per fight |

## Board Rescue / Harm Cleanup

| Source skill | Source | Source mechanic | Wishfire fit | Likely draw shape |
| --- | --- | --- | --- | --- |
| Lucky Band-Aid | Archero 2 | Luck up; deals 2x Attack Power to most on-screen enemies and clears enemy projectiles | Best external analog for clearing enemy pressure; translate to clearing harmful board state, queued enemy effects, or hazard gems | `one_off` |
| Dispelga | Final Fantasy Dimensions / Seer + Summoner | Multi-target Dispel | Good answer to enemy buffs or field conditions | `repeatable` |
| !Recover | Final Fantasy V / Chemist | Cures all allies' negative status, equivalent to Esuna or Remedy | Clean status-control card for harder enemy disruption | `repeatable` |
| Inoculate | Bravely Default / Salve-Maker | Grants status immunity for six turns | Scales well as status enemies appear; avoid full permanent immunity | `one_off` or `tiered` duration |

## Counter / Reaction Skills

| Source skill | Source | Source mechanic | Wishfire fit | Likely draw shape |
| --- | --- | --- | --- | --- |
| Counter | Final Fantasy V / Monk; Bravely Default / Swordmaster | Counterattacks physical attacks; Bravely lists 60% chance | Already ideal for Falie-style reactive cards | `tiered` chance |
| Bone Crusher | Final Fantasy Dimensions / Monk + Dark Knight | Invincibility or counterattack while taking extra damage | Good high-risk counter stance if the incoming-damage tradeoff stays visible | `one_off` stance |
| Before Swine | Bravely Default / Swordmaster | Halves magic damage and counters with 3x damage | Excellent anti-mage answer as enemy spell pressure rises | `repeatable` or `one_off` |
| Nothing Ventured | Bravely Default / Swordmaster | Defensive counter stance | Good readable counter card even without exact source value | `repeatable` |
| Reprisal-style reflect | Final Fantasy Dimensions / Paladin/Dark Knight analogs; local Falie lane | Reflects or returns damage after being hit | Scales with enemy damage and creates visible retaliation | `tiered` reflected percent |
| Absorb P. Damage | Bravely Default / Vampire | Recover HP equal to 30% of physical damage taken unless KO'd | Strong sustain-via-pressure pattern | `tiered` chance or percent |
| Absorb M. Damage | Bravely Default / Arcanist | Recover HP equal to 25% of magic damage taken | Strong answer to magic-heavy enemy sets | `tiered` chance or percent |

## Status / Debuff Payoffs

| Source skill | Source | Source mechanic | Wishfire fit | Likely draw shape |
| --- | --- | --- | --- | --- |
| Moogle Dance / Frailty Polka | Final Fantasy Dimensions / Summoner + Dancer | Multi-target DEF/RES reduction | Strong support card for party-wide damage windows | `repeatable` |
| Steal Hearts | Final Fantasy Dimensions / Thief + Ranger | Multi-target Confuse or self Berserk | High-swing control card; risky but memorable | `one_off` or low-rate `repeatable` |

## Resource Conversion / Economy Swing

| Source skill | Source | Source mechanic | Wishfire fit | Likely draw shape |
| --- | --- | --- | --- | --- |
| Convert MP | Bravely Default / Summoner | Restores MP equal to 1% of damage sustained | Strong analog for damage-taken into Astral Flow or Energy | `tiered` conversion |
| Hedge Risk | Bravely Default / Merchant | Halves damage by spending money for five turns | Excellent Huun/gold survival conversion if gold remains combat-relevant | `one_off` field |

## Persistent External Effects

| Source skill | Source | Source mechanic | Wishfire fit | Likely draw shape |
| --- | --- | --- | --- | --- |
| Sprite King / Bomb Sprite | Archero 2 | Companion attacks automatically with tracking beams or bomb volleys | Good Runa/Kojonn external-effect pattern if companions are temporary and readable | `one_off` summon |
| Beam Strike | Archero 2 | Summons 1 strike every 2.5 seconds; beams hit 4 times | Strong analog for match- or round-timed totems and external effects | `tiered` count or `one_off` |
| Meteor Pursuit / Chain Meteors | Archero 2 | Chance to cast meteors on attack; Chain Meteors can cast 2 instead of 1 | Good "proc on match/attack" external payload if visual noise is controlled | `tiered` chance/count |
| Summon Substitute | Bravely Default / Summoner | Random learned summon when KO'd | Good death-triggered external effect instead of direct revive | `one_off` |
| Summon in Pinch | Bravely Default / Summoner | Random learned summon below 20% HP | Strong low-HP panic external effect | `one_off` |
| Summon Surge | Bravely Default / Summoner | Summon damage +10% each use | Good bounded tiered scaling for Runa totems or summon-style skills | `tiered` |

## Enemy-Scaling / Boss-Scaling Payoffs

| Source skill | Source | Source mechanic | Wishfire fit | Likely draw shape |
| --- | --- | --- | --- | --- |
| Exchange | Wishfire Vault lane, RPG-compatible steal-power pattern | Steal power from a stronger enemy and turn it against them | Excellent boss-scaling support card; source value is local design, not external tuning | `one_off` or `tiered` |
| Absorb Stats | Bravely Default / Vampire | Absorbs selected stat | Strong enemy-stat leverage if temporary and clearly tagged | `one_off` |
| Invert | Wishfire Runa lane, similar to stat-swap RPG effects | Swaps enemy ATK and RES in local design | Strong because it changes matchup rules rather than adding routine damage | `one_off` |
| Insight | Wishfire Vault lane, RPG-compatible enemy-stat borrowing | Add enemy magic attack into player value | Good scaling fantasy; high-risk against magic-heavy bosses | `tiered` bounded scalar |

## 🧪 Original Wishfire Candidate Skills

These are invented candidates for discussion. Each row is marked with `🧪` so it can be credited and separated from source-derived references.

| Candidate skill | Trigger / eligibility | Payload | Why it suits Wishfire | Likely draw shape |
| --- | --- | --- | --- | --- |
| 🧪 Panic Bloom | Party HP is below a low threshold and the board has few heal gems | Convert a small random gem subset into light green heal gems | Turns a dire state into a board choice instead of an automatic heal | `one_off` or `repeatable` with cooldown |
| 🧪 Last Lantern | Low party HP after a valid match | The next light green heal also clears one harmful party effect | Combines attrition recovery with status cleanup while still requiring a player match | `tiered` chance |
| 🧪 Pressure Valve | Party takes a heavy hit | Store part of the damage, then release it as a green all-enemy pulse on the next valid green match | Lets enemy pressure become player value; fits green AoE identity | `tiered` stored percent |
| 🧪 Mirror Ward | First enemy debuff or drain would land on the party | Cancel it and apply a weaker copy to the source enemy | Makes enemy disruption feel dangerous but answerable | `one_off` |
| 🧪 Astral Rebate | Player selects a skill card while behind on HP or Energy | Refund a small amount of Astral Flow or Energy after the next valid match | Helps players recover momentum without giving free damage | `tiered` amount |
| 🧪 Overdraw | Astral Flow reaches a draw threshold while party HP is low | Draw a bonus temporary card; unpicked temporary card expires after the choice | Card-draw drama that feels like a comeback moment rather than passive smoothing | `one_off` |
| 🧪 Totem Fuse | Runa totem is destroyed before expiry | Detonate for reduced stored value and reroll a small gem subset toward blue or green | Makes enemy interruption less punishing while preserving counterplay | `tiered` retention |
| 🧪 Apex Tax | Target enemy has a higher key stat than the party average | Temporarily borrow a bounded percent of that enemy's highest offensive stat | Boss-scaling support pattern that gets better against scary enemies | `one_off` or `tiered` scalar |
| 🧪 Clean Draw | Party is afflicted by a harmful effect when a skill-card draw opens | Add one cleanse-leaning card to the offer set for that draw only | Uses card offers as the rescue surface instead of hidden passive cleanup | `one_off` offer modifier |
| 🧪 Bad Board Insurance | Board has no strong tactical color distribution after refill | Upgrade one random gem into a supergem or recolor a small subset toward the active hero's color | Directly addresses puzzle-combat frustration without guaranteeing a perfect board | `tiered` chance |
| 🧪 Wound Interest | Party takes repeated hits before the next hero action | Add a bounded damage or heal bonus to the next valid match based on hit count | Scales with enemy pressure and rewards surviving bad sequences | `tiered` capped stacks |
| 🧪 Oathbreaker | Enemy heals, drains, or buffs while party HP is low | Invert part of that gain into party heal, shield, or enemy debuff | Strong answer to late-game sustain enemies; cousin to Consume but more dramatic | `one_off` or `repeatable` with cooldown |

## Best Native Alignment

These existing Wishfire lanes are already pointed in the right direction and should be treated as first-class references when adapting outside skills:

| Wishfire lane | Why it remains well suited |
| --- | --- |
| Falie: `Ward Bash`, `Cover / Block`, `Reprisal / Bounce`, `Phalanx` | Directly matches counter, cover, reflect, and heavy-hit prevention patterns. |
| Huun: `Bell`, `Growth`, `Goldstrike` | Uses finite burst, damage-to-resource conversion, and gold-as-combat-cost without relying on turn-locking. |
| Runa: `Aura Totem`, `Invert`, `Intensify` | Keeps magic identity in persistent effects, stat bending, and payoff doubling instead of routine spell casts. |
| Kojonn: `Lock`, `Elevate` | Best support cards because they alter cost or effect tier instead of just adding a buff. |
| Party: `Second Chance`, `Guard Rail`, `Destiny`, `Last Push`, `Chain Pop` | Strongest shared-card shapes because they rescue weak board, heavy hit, attrition, low HP, or match-chain states. |
| Vault: `Consume`, `Lucky`, `Exchange`, `Clean Slate` | Strong passive/relic candidates because they convert enemy healing, board color, enemy strength, or harmful statuses into strategic answers. |

## Legend

This legend covers game-specific or source-specific terms used in this reference. Common abbreviations such as HP, MP, and EXP are intentionally omitted.

| Term | Meaning |
| --- | --- |
| Astral Flow | Wishfire party-skill draw meter built by blue gem matches. |
| P.Attack / M.Attack | Bravely Default stat labels for physical attack and magic attack. |
| P.Def / M.Def | Bravely Default stat labels for physical defense and magic defense. |
| RES | Resistance. In Wishfire and the reference notes, this usually means magic or effect resistance rather than raw defense. |
| Protect / Shell / Bravery | Final Fantasy-style buff terms: physical mitigation, magical mitigation, and attack/power-up. |
| Esuna | Final Fantasy status-cleanse spell family. |
| Dispel / Dispelga | Final Fantasy buff-removal spell family; `Dispelga` is the multi-target version in the source reference. |
| proc | A triggered effect activation, usually chance-based or condition-based. |
| `one_off` | Wishfire draw class for a card that should leave the session draw pool after exposure or selection. |
| `tiered` | Wishfire draw class for a card that can appear again because each pick increases a bounded rank, chance, stack, duration, or value. |
| `repeatable` | Wishfire draw class for a card that can appear again because each pick fires a clear payload without adding persistent duplicate power. |
| supergem | Wishfire special gem variant that can unlock or trigger hero-specific special skills. |
| Faze / blight | Wishfire Kojonn-aligned field or enemy damage-over-time pressure pattern. |
