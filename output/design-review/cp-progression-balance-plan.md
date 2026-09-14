# Wishfire CP and Progression Balance Plan

Status: **APPROVED FOR IMPLEMENTATION.** The user authorized implementation on 2026-09-13 under parent Bead `ORKA-ymk`; runtime work remains gated by its sequential child Beads and validation requirements.

Candidate audited: `3349a8e852c26727487a669940be13a7b57092a2`

## Approved decisions

1. Use the revised safety-first CP and burst contract below.
2. Runa and Kaja use magic basic attacks so autoplay uses MAG and RES.
3. Use the full-reset session boundary and its initialization order.
4. Use the retention bands and above-boss safety surface as harness targets.
5. Give every starting hero one cached, sequential three-card buff choice before the first scheduler action; dialogue remains independently authored.
6. Use Capybara Go gameplay-loop parity as Wishfire's baseline, with only the documented departures below.

## Review assumptions

- The current hero and enemy numbers are provisional diagnostic data, not protected content.
- Capybara Go's session continuity, event order, story feed, next-step advance, and decision-gate rhythm are the default behavioral baseline. Wishfire retains only the documented departures: four-character autoplay CTB party, per-starting-hero cached offers, role-triggered AF specials, genie-world dialogue/events, and configurable `N`.
- Roles, autoplay CTB flow, one opening offer per starting hero before the first combat turn, session-long buffs, independently authored dialogue/events, and authoritative role-trigger AF remain the approved design constraints.
- The proposed base stats, growth, enemy archetypes, crit rate, CP weights, encounter bands, and budgets are tuning candidates. They may be replaced after the approved harness passes.

## Inspiration ledger

| Source | Observed pattern | Wishfire borrows | Wishfire changes | Why it fits autoplay CTB |
|---|---|---|---|---|
| [Dragon Quest I, original Famicom attack analysis](https://wikiwiki.jp/dqdic3rd/%E3%80%90%E3%81%93%E3%81%86%E3%81%92%E3%81%8D%E3%80%91) | DQ I physical attack compares offense and defence with bounded randomness; its documented critical pattern is rare. | Numeric feel only: small early numbers, readable offense-versus-defense, bounded randomness, and rare critical identity. | Wishfire copies no DQ I formula, party model, role growth, magic balance, recovery loop, targeting, encounter curve, or CP. | Small readable exchanges support autoplay without routine spikes deciding a session. |
| [Dragon Quest III system overview](https://www.dragonquest.jp/roto-trilogy/dq3/system/index.html) | Square Enix describes a party of up to four adventurers. Its distinct physical, magical, defensive, and support identities are a structural reference; broader original-Famicom mechanical conclusions remain design inference. | A four-member party needs legible, unequal role identities. | Wishfire copies no DQ III formula, grind curve, inventory pressure, vocation/class system, or authored party composition. | The party shape informs readable role contrast while Wishfire supplies its own autoplay and session model. |
| [Final Fantasy X CTB system](https://www.jp.square-enix.com/ffx_x-2HD/sp/system/) and [Overdrive mode reference](https://strategywiki.org/wiki/Final_Fantasy_X/Overdrive_Modes) | The next action depends on Speed and action delay; Stoic, Warrior, Tactician, and Comrade identify behavior-based charge families. | Visible CTB/action-rate reasoning and AF's role-trigger families. | Keeps autoplay, applies action rate inside Wishfire CP, and uses the project's locked blue-gem event attribution. | Speed and behavior-based special buildup create visible value in an automated party. |
| [Fire Emblem: Shadow Dragon manual](https://www.nintendo.com/eu/media/downloads/games_8/emanuals/nintendo_ds_21/Manual_NintendoDS_FireEmblemShadowDragon_EN.pdf) | The combat forecast shows damage, HP, and whether a unit can strike twice before commitment. | Damage-minus-guard readability and danger forecasting as a balance-review discipline. | Uses a continuous guard formula and CP bands rather than Fire Emblem's grid, weapon, and counterattack model. | The same expected-damage reasoning lets the simulator reject encounter packs that produce opaque or unfair autoplay deaths. |
| [Capybara Go skills reference](https://capybara-go.game-vault.net/wiki/Skills) | Adventure level-ups offer one of three skills; event and elite offers can change the reward tier; many skills have a base-plus-upgrade path. | Continuous-session pacing, favorable player margin, opening/session power choices, recovery through events, step progression, exploration gates, and behavioral parity baseline. | Every starting hero chooses once before the first scheduler action; cards are universal genie-magic buffs, while dialogue remains an independently authored session interruption. | The player establishes a build, receives recovery through story/events, and continues through an authored adventure session. |

| [Capybara Go encounters reference](https://capybara-go.game-vault.net/wiki/Encounters) | Community-documented Chapter Adventure encounters include camps, huts, spirits, elite choices, demons, wheels, treasure-adjacent fortune events, and explicit rest-or-search branches. Encounters appear during the chapter, rather than only at its bookends. | A session path may interleave combat with authored exploration events, some with an ordinary choice and some with a clear cost. | Wishfire keeps power as the card/event prize and reserves healing/recovery for story events. It does not import Capybara Go's currencies, precise values, or gambling wheels. | Automated fights need authored breathing room, recognizable landmarks, and meaningful build moments. |
| [Capybara Go skills reference](https://capybara-go.game-vault.net/wiki/Skills) | The community reference says level-up offers, Forest Sprite sacrifices, elite Golden Chests, Demon pacts, Angel recovery-or-skill choices, and some wheel encounters occur in Adventure mode. | Three-card power offers can happen at level-up and event gates; elite/bargain events can have a stronger tier. | Wishfire keeps per-hero opening offers and session-persistent buffs, then uses its own genie-magic names and numerical balance. | The build keeps changing across a journey without every step being combat. |
| [Archero 2 official Google Play listing](https://play.google.com/store/apps/details?hl=en-US&id=com.xq.archeroii) and [Campaign reference](https://archero-2.game-vault.net/wiki/Campaign) | The official listing advertises rarer skill choices. The community Campaign reference records a 50-room campaign format with a boss every tenth room. | No active design ownership. | Capybara Go, not Archero 2, governs Wishfire's step progression and exploration gates; Wishfire uses configurable `N`. | Historical contrast only. |

### Reference ownership matrix

| Source | Owns | Explicit exclusions |
|---|---|---|
| Dragon Quest I original Famicom | Early numeric feel only: small damage, legible offense/defense, bounded randomness, rare crit identity. | Party balance, roles, encounter difficulty, recovery, magic, targeting, CP, and formulas. |
| Dragon Quest II | Historical exclusion only: its early small-party model is too shallow for Wishfire. | Formulas, pacing, party structure, and balance basis. |
| Dragon Quest III original Famicom | Four-member role-party structural reference, supported by the official four-adventurer overview. | Formulas, grind, inventory pressure, class/vocation system, and party composition. |
| Final Fantasy X | Visible CTB/action-rate reasoning and Stoic/Warrior/Tactician/Comrade AF trigger families. | Wishfire CP, session pace, targeting, card pool, and recovery system. |
| Capybara Go | Continuous-session pace, favorable margin, power choices, event recovery, step progression, exploration gates, behavioral parity. | Genie-world fiction, four-hero combat roles, CTB mechanics, and Wishfire formulas. |
| Wishfire | CP, burst ceilings, target philosophies, autoplay tuning, Speed-based multiattack and its CTB/attack-count contract, genie reskin, dialogue, and validation harness. | No external formula is copied. |

### Capybara Go parity baseline

For gameplay-loop behavior, Wishfire follows Capybara Go as its primary baseline. The session keeps one continuous adventure state: a current day/step resolves, its story result or choice is shown, a combat or side activity may occur, the result changes the same session, the player sees a next-step control, and route progress advances. This document specifies behavior and state only. It does not authorize copied Capybara Go art, UI, currencies, text, or numerical tables.

Wishfire departures are deliberately narrow:

- Four heroes operate as one party instead of one capybara.
- Autoplay CTB resolves combat while the player makes journey and buff choices.
- Every starting hero completes one cached sequential three-card power-buff choice before the first scheduler action.
- Fara, Hondo, Runa, and Kaja build role-specific Astral Flow toward special releases.
- Dialogue, NPCs, spirits, and locations use the Wishfire genie-world setting.
- Positive integer `N` defines session length; it is not presumed to copy any fixed Capybara Go chapter count.

### User-supplied screenshot evidence

| Evidence | Observed gameplay-loop behavior | Wishfire parity rule |
|---|---|---|
| [`Screenshot 2026-09-13 at 11.27.47.png`](/Users/Mace/Downloads/Screenshot%202026-09-13%20at%2011.27.47.png) | Adventure begins with visible Day/step progress and opening story text. | Begin one session feed with opening dialogue available before the first combat action. |
| [`Screenshot 2026-09-13 at 11.28.31.png`](/Users/Mace/Downloads/Screenshot%202026-09-13%20at%2011.28.31.png) | Opening same-tier three-skill power selection. | Every starting hero receives one cached sequential three-card power choice. |
| [`Screenshot 2026-09-13 at 11.29.19.png`](/Users/Mace/Downloads/Screenshot%202026-09-13%20at%2011.29.19.png) | Persistent story-progress feed and explicit Next Day/step advance. | Keep the session feed and show explicit next-step advance before route progress changes. |
| [`Screenshot 2026-09-13 at 11.30.06.png`](/Users/Mace/Downloads/Screenshot%202026-09-13%20at%2011.30.06.png) | Combat appears as a leave-or-battle decision gate. | An authored combat step may offer selectable combat, mandatory combat, or no combat. |
| [`Screenshot 2026-09-13 at 11.30.34.png`](/Users/Mace/Downloads/Screenshot%202026-09-13%20at%2011.30.34.png) | Combat executes inside the same adventure/day flow, then returns to the journey. | Combat resolves one step and returns to the same feed/state. |
| [`Screenshot 2026-09-13 at 11.31.22.png`](/Users/Mace/Downloads/Screenshot%202026-09-13%20at%2011.31.22.png) | Side activity insertion, represented by treasure digging. | A side activity occupies an authored step and returns through the same result/advance path. |
| [`Screenshot 2026-09-13 at 11.33.17.png`](/Users/Mace/Downloads/Screenshot%202026-09-13%20at%2011.33.17.png) | NPC bargain states a power, cost, and accept/refuse decision. | A bargain must disclose benefit and cost before Accept/Refuse mutates session state. |

These screenshots are behavior evidence only. They do not authorize copied art, UI, names, text, or assets.

### Invented for Wishfire

This proposal is a synthesis, not a copied formula. Wishfire owns its symmetric physical/magic resolver, CP from expected threat, full-sequence burst, effective HP, CTB action rate, and Speed-based multiattack, encounter bands, four-hero target philosophies, autoplay tuning, genie-world reskin, dialogue, validation harness, and per-hero opening-buff queue before the first scheduler action. Dialogue and events are independently authored interruptions.

## Implementation authorization

**Status: APPROVED FOR IMPLEMENTATION on 2026-09-13.** The original proposal was rejected because it permitted unsafe early enemy burst, treated pre-buff boss loss as an acceptable player-facing result, described a carryover-shaped opening boundary, and cited Dragon Quest without a precise version. The revised safety-first contract replaces that proposal.

Implementation must use the revised encounter ratios and win bands, routine and hard burst ceilings, above-boss safety surface, and recovery-event cadence as harness targets. Candidate tuning values remain replaceable when measured evidence requires adjustment without weakening those player-safety contracts.

## Current implementation audit

### Source ownership

| Concern | Observed owner and evidence |
|---|---|
| Hero definitions | `web-runner/src/core/heroDefinitions.mjs:2,10-63` |
| Hero level stats | `web-runner/src/core/heroProgression.mjs:3-23,37-47` |
| Older roster values | `web-runner/state/heroScreenConfig.js:1-5`; `attachHeroProgress` overwrites these runtime stats |
| JS damage rule | `src/core/calculateDamageRules.mjs:58-100` and browser mirror |
| Runtime dispatch | `web-runner/modules/functionBank.js:5395-5437,5445-5512,6110-6180` |
| Rust damage owner | `rust/simulation_core/src/lib.rs:2332-2374` |
| Status resolution | `web-runner/src/core/combatRules.mjs:20-109` |
| Initiative | `src/core/dynamicInitiativeRules.mjs:185-255` and browser mirror |
| CP | `web-runner/src/core/combatPower.mjs:1-6`; initializer fallback at `web-runner/systems/combatSessionInitializer.js:19-30` |
| Enemy data and overrides | `web-runner/assets/enemies.json:1`; mapping at `combatSessionInitializer.js:270-285` |
| Encounter budget | `combatSessionInitializer.js:142-249,388-420`; default target is 120 at line 400 |
| Level-up queue | `src/core/sessionLevelUpQueue.mjs:16-66` and browser mirror |
| Tiered offers | `src/core/sessionLevelBuffOffers.mjs:22-46,87-98,139-195,198-227` |
| Buff presentation/application | `web-runner/modules/sessionLevelUpBuffPresentation.mjs:33-47,93-127`; `heroCommands.mjs:61-101,140-148` |
| Combat entry | `web-runner/app.js:2041-2098,2113-2117`; scheduler release at `combatSessionReset.mjs:51-60` |

### Current level-one heroes

These are provisional diagnostic values derived from the automatic level-one passive and the two-times HP scale. They are evidence of the current mismatch, not tuning constraints.

| Hero | Role | Basic mode | HP | ATK | MAG | DEF | RES | SPD | Crit |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Fara (`Falie`) | Tank | Physical | 92 | 10 | 4 | 8 | 6 | 8 | 10% |
| Hondo (`Huun`) | DPS / Fighter | Physical | 70 | 15 | 4 | 5 | 4 | 12 | 10% |
| Runa | Controller | **Physical** | 60 | 5 | 15 | 4 | 9 | 10 | 10% |
| Kaja (`Kojonn`) | Support / Guardian | **Physical** | 80 | 6 | 10 | 6 | 11 | 11 | 10% |

The shared `basic_attack` is tagged physical at `heroDefinitions.mjs:14`. Runa and Kaja therefore ignore their primary MAG stat during autoplay.

### Current progression

`EXP to next = ceil(100 × level^1.5)`. The table is a provisional diagnostic of current derived stats: `floor(base + growth × (level - 1))`, then unconditional passive multipliers, equipment, and finally `HP × 2` (`heroProgression.mjs:3-11`).

| Level | Fara HP/ATK/DEF | Hondo HP/ATK/DEF | Runa HP/MAG/RES | Kaja HP/MAG/RES |
|---:|---:|---:|---:|---:|
| 1 | 92 / 10 / 8 | 70 / 15 / 5 | 60 / 15 / 9 | 80 / 10 / 11 |
| 5 | 162 / 14 / 16 | 118 / 24 / 9 | 100 / 24 / 15 | 128 / 16 / 18 |
| 10 | 250 / 20 / 28 | 195 / 36 / 14 | 150 / 36 / 24 | 206 / 24 / 28 |
| 20 | 426 / 32 / 50 | 327 / 60 / 24 | 250 / 60 / 40 | 338 / 40 / 48 |

### Current enemy data and CP

All provisional enemy rows enter the same opening pool; no enemy level scaling is applied in the audited path.

| Enemy | HP | ATK | MAG | DEF | RES | SPD | Explicit CP | Formula CP if override removed |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Gobloc | 40 | 10 | 5 | 8 | 6 | 17 | 47 | 22 |
| High Gobloc | 70 | 14 | 8 | 14 | 12 | 15 | 29.5 | 35 |
| Lizardo | 65 | 18 | 4 | 10 | 6 | 10 | 41 | 34.5 |
| Orc | 60 | 15 | 6 | 12 | 8 | 8 | 38 | 33 |
| High Orc | 95 | 18 | 10 | 20 | 16 | 7 | 55 | 47.5 |
| Chimerilass | 80 | 8 | 26 | 10 | 16 | 8 | 34 | 26 |
| Troll | 105 | 20 | 6 | 22 | 18 | 5 | 17 | 52.5 |
| Skeleton | 35 | 8 | 4 | 5 | 4 | 22 | 47 | 16.5 |
| Djinn | 55 | 6 | 28 | 6 | 14 | 11 | 32 | 17.5 |
| Marid | 60 | 8 | 22 | 10 | 18 | 9 | 21 | 24 |

The active CP formula is `ATK + DEF + HP / 10`. It omits MAG, RES, SPD, crit, attack mode, healing, and control. Explicit overrides produce inversions: Troll is 17 while Skeleton is 47. Initiative adds each actor's SPD to its progress after every action (`dynamicInitiativeRules.mjs:185-201`), so Skeleton's SPD 22 carries major threat that CP cannot see.

### Current damage formula

For a hero single target attack:

`ceil(max(1, (power - 0.35 × resist) × random[0.8, 1.2]))`

For enemies and hero area attacks:

`ceil(max(1, (power - 0.50 × resist) × random[0.8, 1.2]))`

Crit chance is 10%. Hero crit multiplier is `min(1 + power / 10, 3)`. Enemy crit multiplier compresses that to `1 + (heroMultiplier - 1) × 0.1`. This makes crit strength depend on offense and gives the two sides different mitigation and crit rules.

Status observations: ordinary stat statuses multiply the base stat; barriers store `floor(maxHP × magnitude)`; damage-over-time snapshots MAG and bypasses DEF/RES and variance (`combatRules.mjs:8-11,20-46,50-67`).

### Current level-one damage matrix

Cells are `normal minimum / typical / maximum | typical-roll crit`. Current hero basics are physical for all four heroes.

| Hero basic → enemy | Gobloc | Troll | Skeleton | Djinn |
|---|---:|---:|---:|---:|
| Fara | 6 / 8 / 9 \| 16 | 2 / 3 / 3 \| 6 | 7 / 9 / 10 \| 18 | 7 / 8 / 10 \| 16 |
| Hondo | 10 / 13 / 15 \| 33 | 6 / 8 / 9 \| 20 | 11 / 14 / 16 \| 35 | 11 / 13 / 16 \| 33 |
| Runa | 2 / 3 / 3 \| 5 | 1 / 1 / 1 \| 2 | 3 / 4 / 4 \| 6 | 3 / 3 / 4 \| 5 |
| Kaja | 3 / 4 / 4 \| 7 | 1 / 1 / 1 \| 2 | 4 / 5 / 6 \| 8 | 4 / 4 / 5 \| 7 |

| Enemy basic → hero | Fara | Hondo | Runa | Kaja |
|---|---:|---:|---:|---:|
| Gobloc physical | 5 / 6 / 8 \| 7 | 6 / 8 / 9 \| 9 | 7 / 8 / 10 \| 9 | 6 / 7 / 9 \| 8 |
| Troll physical | 13 / 16 / 20 \| 20 | 14 / 18 / 21 \| 22 | 15 / 18 / 22 \| 22 | 14 / 17 / 21 \| 21 |
| Skeleton physical | 4 / 4 / 5 \| 5 | 5 / 6 / 7 \| 7 | 5 / 6 / 8 \| 7 | 4 / 5 / 6 \| 6 |
| Djinn magic | 20 / 25 / 30 \| 30 | 21 / 26 / 32 \| 32 | 19 / 24 / 29 \| 29 | 18 / 23 / 27 \| 28 |

### Diagnosis

Formula defects:

- Runa and Kaja basic attacks use ATK and enemy DEF despite being magic-led roles.
- Hero and enemy attacks use different mitigation coefficients.
- Hero and enemy crit multipliers follow different rules; offense also determines crit strength.
- CP ignores half the combat stats and action frequency.
- DOT bypasses the ordinary defense path and needs an explicit separate budget.

Stat-budget defects:

- Level-one enemy offense spans 8 to 28 while hero basic offense spans 5 to 15.
- Djinn's 28 MAG creates 18–32 normal damage against the party.
- Defensive outliers reduce Runa and Kaja to one damage because their physical basics use 5–6 ATK.
- A static target CP of 120 exceeds the current party's simple formula CP of 89.2 after the HP patch; before the patch it was about 74.1.
- Hand-authored CP values are disconnected from the underlying stats.

### What the two-times HP patch changed

Commit `3349a8e` added `heroHPScale: 2` and multiplied only derived hero HP. It did not change attack, defense, enemy data, initiative, damage, targeting, or encounter budgets.

| Harness result, six fixed seeds | Baseline | 2× HP |
|---|---:|---:|
| Average enemies defeated | 1.33 | 2.67 |
| Median enemies defeated | 1.5 | 2.5 |
| Minimum enemies defeated | 0 | 2 |
| Average turns survived | 30.5 | 61.5 |
| Median turns survived | 27.5 | 57.5 |
| Party defeats | 6 / 6 | 6 / 6 |
| Deadlocks | 0 | 0 |

Evidence: `output/balance-baseline-fixed/balance_metrics.json:1-47` and `output/balance-candidate-2x/balance_metrics.json:1-47`. The patch doubled fight length and improved enemy defeats. It left every run ending in party defeat and preserved the mismatched damage feel.

## Proposed Wishfire balance model

### Symmetric direct damage

For physical attacks use ATK against DEF. For magic attacks use MAG against RES.

```
guardScale = 20 + 1.25 × (attackerLevel - 1)
base = 1 + 0.34 × offense
mitigated = base × guardScale / (guardScale + defense)
normalDamage = max(1, round(mitigated × potency × element × variance))
variance = 0.95 + 0.10 × seededRoll
critDamage = max(1, round(normalDamage × 1.25))
```

- Candidate base crit chance: 1% for both sides. It is a CP-declared kit property, never an offense-derived multiplier.
- Element is 1.00 normally and 1.50 for a weakness.
- Ordinary basic potency is 1.00.
- Extra hits repeat the same resolver with their stated potency.
- Fixed card effects remain fixed and must state their number.
- Burn and Venom use a card-defined fixed stage value at turn start, cannot crit, and do not roll variance.
- Shock, Frost, shields, evade, and stat changes retain their own explicit effects.

Every hostile kit also declares `maxSingleActionDamage` and `maxTargetHPFraction`, measured after crit, variance, multi-hit aggregation, proc, status-on-action damage, and every strike in an uninterruptible sequence. The resolver rejects an action that exceeds its encounter-surface ceiling. Low-CP enemies cannot hide a lethal spike behind a harmless average.

The level term supplies controlled penetration against lower-level opponents while preserving same-level mitigation. One formula can be implemented identically in shared JS, the browser mirror, and Rust.

This formula is Wishfire-owned. DQ I supplies only the desired small-number readability; it supplies no coefficient, progression, magic rule, party model, encounter curve, or recovery assumption.

### Recovered Speed multiattack contract

**Recovered historical rule.** In `Scripts/functionBank.js` and `web-runner/modules/functionBank.js` before commit `5944eba`, `TryGrantSpeedExtraTurn` granted a living hero one explicit scheduler insertion when `effectiveSPD >= 2.0 × highestLivingEnemyEffectiveSPD`. `SpeedDoubleRatio` supplied the default `2.0`; `ExtraTurnGranted[heroUID]` prevented another grant until the current hero turn advanced. This was a second scheduled hero action, not extra hits inside one action. The insertion used the hero's effective Speed and placed the action directly after the current action.

**Current status.** Commit `d84fe6c` labeled `SpeedDoubleRatio` legacy. The current `TryGrantSpeedExtraTurn` is a compatibility alias to skill-driven `TryGrantConfiguredExtraTurn`; a configured `DOUBLE_ATTACK` queues one immediate follow-up lunge after `HERO_SINGLE`, while non-`DOUBLE_ATTACK` skills insert an explicit turn. Current active logic must not be described as an automatic Speed-ratio system.

**Locked retention target.** Restore the recovered hero-only threshold exactly: a living hero with effective Speed at least twice the highest living enemy effective Speed receives one linked extra scheduled action after its normal action. The latch blocks a bonus from generating another bonus. The two actions remain separately resolved for scheduler and AF semantics, then form one uninterruptible player-visible multiattack sequence. The rule is Wishfire-owned; it is not inherited from any reference game.

Speed has two measured contributions. `ctbActionRate` measures ordinary scheduler actions per time from Speed. `speedSequenceCount` is `2` only when the recovered threshold passes, otherwise `1`. CP uses `ctbActionRate × (perStrikeKitValue × speedSequenceCount)` and does not add a second standalone Speed bonus. It counts the full linked sequence in `maxSingleActionDamage` and `maxTargetHPFraction`, including every crit, proc, status-on-action effect, and retargeted bonus strike. Enemy records cannot use this rule unless a future approved kit explicitly grants it; current target design reserves it for heroes. Any such future enemy access must clear the encounter surface burst caps.

Each strike is a separately scheduled resolved action. Multi-hit effects inside either strike award one role AF gain at most once. The bonus strike can award its own one role AF gain under the recovered scheduling rule, while the latch makes the maximum two qualifying role gains per linked sequence and blocks recursive gain chains. Misses, prevented damage, periodic ticks, and non-new statuses still earn none. Combat feedback must show `2 HITS` or an equivalent sequence badge, two distinct lunge/impact/damage-text beats, and one grouped sequence indicator so the player can verify the extra action occurred.

### Withdrawn candidate hero base and growth table

The following numeric base/growth table is retained only as audit context and is **withdrawn**. It must be regenerated after the safety bands below are approved; it is not an implementation target.

Use `round(base + growth × (level - 1))`. Keep the existing EXP curve. Remove automatic legacy passive multipliers from this calculation; role identity comes from the base and growth table. Session buffs apply afterward.

| Hero | Basic | Stat | HP | ATK | MAG | DEF | RES | SPD |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Fara | Physical | Base | 48 | 10 | 5 | 12 | 9 | 8 |
|  |  | Growth | 4.0 | 1.0 | 0.4 | 1.2 | 0.9 | 0.10 |
| Hondo | Physical | Base | 38 | 14 | 5 | 7 | 6 | 12 |
|  |  | Growth | 3.2 | 1.4 | 0.4 | 0.7 | 0.6 | 0.20 |
| Runa | Magic | Base | 34 | 6 | 14 | 6 | 10 | 10 |
|  |  | Growth | 2.8 | 0.5 | 1.4 | 0.6 | 1.0 | 0.15 |
| Kaja | Magic | Base | 42 | 7 | 11 | 8 | 12 | 10 |
|  |  | Growth | 3.5 | 0.7 | 1.1 | 0.8 | 1.2 | 0.15 |

### Role-sculpting contract

These provisional bases and growth values deliberately produce different realized power. They are not equal-stat templates and they must not converge to equal same-level CP.

The four-role requirement takes its structural cue from DQ III's supported four-adventurer party, then becomes Wishfire's tank, physical damage, magic/control, and support identities. Stat growth, target philosophy, kit value, CTB rate, AF, and balance are Wishfire-owned design inference; no DQ III class system or numeric progression transfers.

| Role | Stat identity | CP identity | Required validation |
|---|---|---|---|
| Fara, Tank | Highest DEF and durable HP; restrained ATK and MAG. | Effective HP, Cover/Shield sustain, and mitigation carry value; direct damage stays secondary. | Survives physical pressure materially longer than damage roles without becoming a zero-damage actor. |
| Hondo, Physical damage | Highest ATK and strong ATK growth; low-to-medium HP and DEF. | Direct damage, crit, and offensive proc value dominate. | Wins the direct-damage comparison while accepting greater physical risk than Fara. |
| Runa, Magic control | Highest MAG and MAG growth; low-to-medium HP with useful RES and Speed. | Magic direct damage, status prevention, and delay value dominate. | Uses MAG/RES, earns value from successful control, and remains less durable than Fara. |
| Kaja, Support | Restrained direct offense; defensible HP/RES/DEF and support growth. | Healing, shields, ally protection, and AF-special contribution carry value. | Keeps the party alive without matching Hondo or Runa's direct damage. |

### Astral Flow role-trigger review

The archived FFX-inspired mapping is clear: Stoic charges when the owner takes hostile damage, Warrior when the owner deals damage, Tactician on a successful status, and Comrade when an ally takes damage. [StrategyWiki's FFX Overdrive reference](https://strategywiki.org/wiki/Final_Fantasy_X/Overdrive_Modes) records those trigger families. The project checkpoint explicitly confirms Fara/Stoic's hostile-damage and Cover attribution, with Hondo/Warrior, Runa/Tactician, and Kaja/Comrade assigned alongside her.

The prior random living-hero enemy-death orb assignment is superseded for this target design. Combat AF uses the FFX-inspired role mapping below. The existing blue AF gem remains visual feedback only: it begins at the qualifying combat event, flies to the earning hero, and applies AF on arrival. AF never becomes a generic damage-dealt meter.

AF trigger attribution is:

| Hero | FFX-inspired trigger | One qualifying resolved action | Exclusions |
|---|---|---|
| Fara / Stoic | Takes hostile HP damage, including valid Cover interception. | One gain after the complete hostile action, even if it has many hits. | Fully prevented damage, periodic ticks, AF-special self-refill. |
| Hondo / Warrior | Deals positive damage to an enemy. | One gain after the complete action, even if it hits many targets. | Misses, zero damage, periodic ticks, AF-special self-refill. |
| Runa / Tactician | Successfully applies an eligible enemy status. | One gain if the action applies at least one new eligible status. | Failed/resisted status, refresh with no change, periodic ticks, AF-special self-refill. |
| Kaja / Comrade | A living ally takes hostile HP damage. | One gain if at least one other living ally loses HP in the action. | Kaja's own HP loss, fully prevented damage, periodic ticks, AF-special self-refill. |

Each qualifying resolved action awards a configurable role rate, initially `10 AF`. Multi-hit, AoE, and multiple simultaneous status results aggregate into their owning action and cannot award more than once. A separately resolved counter or follow-up is its own action and may qualify once. AF clamps at 100; no further gem spawns when the recipient is full. A Cover hit can charge Fara as Stoic and Kaja as Comrade because Fara is Kaja's ally.

AF changes CP only through expected special-release contribution, never as direct damage credit:

```
afContribution = expectedAFGainPerAction / 100 × expectedSpecialNetValue
kitValue += afContribution
```

`expectedSpecialNetValue` is the special's expected value above the action it replaces. If an encounter horizon cannot plausibly reach a special, the contribution is zero. AF source, event rate, recipient rule, gain amount, and special net value must be declared in the kit schema. The blue gem animation is part of the event attribution boundary: no unrelated death-orb assignment remains.

### Level checkpoints

| Level | Fara HP/ATK/DEF | Hondo HP/ATK/DEF | Runa HP/MAG/RES | Kaja HP/MAG/RES | Party CP |
|---:|---:|---:|---:|---:|---:|
| 1 | 48 / 10 / 12 | 38 / 14 / 7 | 34 / 14 / 10 | 42 / 11 / 12 | 178.5 |
| 5 | 64 / 14 / 17 | 51 / 20 / 10 | 45 / 20 / 14 | 56 / 15 / 17 | 240.1 |
| 10 | 84 / 19 / 23 | 67 / 27 / 13 | 59 / 27 / 19 | 74 / 21 / 23 | 319.4 |
| 20 | 124 / 29 / 35 | 99 / 41 / 20 | 87 / 41 / 29 | 109 / 32 / 35 | 504.4 |

### Withdrawn candidate enemy archetype table

The following archetype numbers are also **withdrawn**. Enemy attack, kit burst, and durability must be authored from their target BaseCP and the surface ceilings below, then derived and reported by the CP catalog.

| Archetype | HP | Main offense | DEF | RES | SPD | L1 CP | Use |
|---|---:|---:|---:|---:|---:|---:|---|
| Fodder | 28 | 8 | 6 | 6 | 10 | 31.1 | Low pressure |
| Balanced | 40 | 10 | 8 | 7 | 10 | 39.3 | Routine baseline |
| Striker | 34 | 12 | 6 | 5 | 12 | 45.8 | Fast damage |
| Wall | 54 | 8 | 12 | 9 | 7 | 36.0 | Durable target |
| Caster | 34 | 12 MAG | 5 | 9 | 10 | 40.6 | Magic pressure |
| Commander | 72 | 14 | 12 | 12 | 9 | 58.3 | Narrow boss baseline |

Scale enemies by level:

```
HP = round(baseHP × (1 + 0.11 × (level - 1)))
ATK/MAG/DEF/RES = round(baseStat × (1 + 0.07 × (level - 1)))
SPD = round(baseSPD + 0.12 × (level - 1))
```

Named enemies should select an archetype plus small, documented deltas. Existing level-one values such as 28 MAG must not enter the opening pool unchanged.

### Revised safety acceptance targets

These replace the withdrawn sample matrices. They are approval targets for the harness, not precomputed gameplay results. Capybara Go is the behavioral parity reference for continuous-session pace, player advantage, event recovery, and session power choices. At level one, ordinary routine enemy basics deal 1–4 damage and must not exceed 5% of the target hero's maximum HP after every modifier. Double digits require an appropriate high-CP elite/boss action and its declared telegraph.

| Surface | EncounterCP / starting-party BaseCP | Player-facing fixed-seed win rate with opening buffs | Enemy basic typical damage at L1 | Maximum single hostile action | Hero margin and recovery reading |
|---|---:|---:|---:|---:|---|
| Routine | 0.25–0.35 | 97–100% | 1–3 | 5% target max HP | Party reaches event recovery with three or more heroes alive in 95% of seeds. |
| Hard | 0.61–0.75 | 85–95% | 2–4 | 8% target max HP | Attrition is visible; story/event recovery repairs it before a failure spiral. |
| Elite | 0.76–0.90 | 70–85% | 3–5 | 12% target max HP | Defeat is possible after poor build choices or sustained pressure. |
| Boss | 0.91–1.05 | 60–75% | 3–6 | 18% target max HP, telegraphed above 12% | The intended session peak; no untelegraphed burst removes a healthy fragile hero. |
| Above-boss, opt-in/catalog-only | 1.06–1.12 | 55–70% | 4–7 | 25% target max HP, telegraphed above 12% | Player edge remains favorable; this surface does not enter routine progression. |

Routine and hard normal attacks use low single digits at level one. Crits may add at most one point at routine and hard surfaces under the candidate 1% / 1.25× rule. A low-CP enemy has neither a high burst ceiling nor a boss-style exception.

| L1 target | Hero actions to defeat | Enemy damaging actions to defeat the hero | Purpose |
|---|---:|---:|---|
| Fodder | 4–7 | 18+ | Fast, readable progress. |
| Balanced | 6–9 | 16+ | Routine baseline under actual role targeting. |
| Routine target Hondo check | n/a | 20+ from one routine attacker | A 10-action sequence cannot remove half his HP through routine hits. |
| Hard target Hondo check | n/a | 13+ from one hard attacker | Attrition remains recoverable through events. |

### Same-level relation target

At levels 1–9, hero attacks against an equal-level Balanced enemy take 6–9 hero actions. A Balanced enemy requires at least 16 hostile damaging actions to defeat the fragile hero and at least 22 to defeat Fara. At levels 91–99, the harness preserves these TTK and damage-to-HP relationships instead of absolute single-digit values.

Simulation uses the actual role-targeting policy. A routine opposing pack should lose its first enemy within roughly two to four party CTB cycles under that policy even when a single hero needs six to twelve hits.

### Combat Power

CP is the absolute content-authoring measure. A content designer assigns a target BaseCP and receives the derived value from level, stats, and kit. Manual CP overrides are prohibited. Boss 13 can therefore be authored above Boss 12 and below Boss 47 without guessing from HP alone.

BaseCP measures permanent authored power before session buffs. CurrentCP recalculates the same model after earned buffs. EncounterCP combines the current actors in one enemy group. Content placement uses BaseCP; live encounter selection and simulations record both BaseCP and CurrentCP.

Level is progression depth from EXP. CP is realized combat prowess or threat. Level selects the expected stat band and neutral benchmark; CP orders the actual combatants within and across those bands. A same-level mage and tank should therefore have different CP when their HP, offense, mitigation, Speed, control, healing, AoE, or proc value differs. Equal level never requires equal CP.

```
guardScale = directDamage.guardScale = 20 + 1.25 × (level - 1)
benchmarkDefense = round(7 + 0.9 × (level - 1))
neutralHit = directDamage resolver(mainOffense, benchmarkDefense, level, normal potency, normal element, neutral variance)
ctbActionRate = clamp(SPD / 10, 0.60, 1.80)
speedSequenceCount = 2 when the recovered hero threshold passes; otherwise 1
effectiveHP = HP × (1 + ((DEF + RES) / 2) / guardScale)
critBonus = expectedDirectDamage × critChance × (critMultiplier - 1)
aoeBonus = expectedAoEDamage × (expectedTargets - 1)
sustain = 0.60 × (expectedHeal + expectedShieldAbsorb)
control = expectedDelayedEnemyActions × neutralEnemyThreat
statusProc = expectedDotDamage + expectedDebuffPrevention + expectedProcDamage
afContribution = expectedAFGainPerAction / 100 × expectedSpecialNetValue
perStrikeKitValue = expectedDirectDamage + critBonus + aoeBonus + sustain + control + statusProc + afContribution
sequenceKitValue = perStrikeKitValue × speedSequenceCount
maxSingleActionDamage = worst full uninterruptible sequence damage
BaseCP = roundToTenth(5 × ctbActionRate × (sequenceKitValue + 0.35 × maxSingleActionDamage) + effectiveHP / 4)
CurrentCP = recalculate(BaseCP inputs after session buffs)
EncounterCP = sum(enemy CurrentCP) × (1 + 0.05 × (enemyCount - 1))
```

Each kit declares its expected per-strike inputs, its derived `speedSequenceCount`, `maxSingleActionDamage`, and `maxTargetHPFraction` against the neutral defender. `maxSingleActionDamage` and the fraction aggregate the entire uninterruptible Speed sequence. AoE uses the intended average enemy count, healing and shields become avoided damage at 60% efficiency, control becomes delayed enemy actions times neutral enemy threat, statuses and procs use expected damage or prevention, and crit contributes only its expected bonus. The full-sequence ceiling makes burst visible to CP alongside average output. The validator rejects a low-CP actor whose ceiling breaches its surface. This prevents a boss with a powerful heal, stun, proc, multi-target action, or Speed sequence from looking weak because its base ATK is low.

Every authored kit uses this required CP schema. The simulation measures these values against the actual role-targeting policy; data entry records the policy's target distribution.

```json
{
  "actionMix": [{"id":"basic", "weight":1, "path":"physical|magic"}],
  "expectedDirectDamage": 0,
  "critChance": 0,
  "critMultiplier": 1,
  "expectedAoEDamage": 0,
  "expectedTargets": 1,
  "expectedHeal": 0,
  "expectedShieldAbsorb": 0,
  "expectedDelayedEnemyActions": 0,
  "neutralEnemyThreat": 0,
  "expectedDotDamage": 0,
  "expectedDebuffPrevention": 0,
  "expectedProcDamage": 0,
  "speedSequenceCount": "derived 1 or 2 from the recovered hero rule",
  "afSource": "one of Stoic, Warrior, Tactician, or Comrade",
  "expectedAFGainPerAction": 0,
  "expectedSpecialNetValue": 0,
  "maxSingleActionDamage": 0,
  "maxTargetHPFraction": 0
}
```

`actionMix.weight` sums to one. Zero is valid for an unused effect; missing fields fail validation. The target policy and action mix provide the reproducible context for every expected value. AF fields add value only when the special can be released within the simulated horizon. A Speed sequence multiplies per-strike expected output once through `speedSequenceCount`; `ctbActionRate` remains the only ordinary Speed-throughput factor.

Session buffs are earned advantage. They update CurrentCP for simulation and telemetry, but do not raise the authored BaseCP target for an enemy placed in the session.

#### Worked level-one role example

This uses the proposed level-one bases and an ordinary single-target basic kit. It demonstrates measurement, not a requirement that heroes be equal.

| Hero | Level | Direct + crit kit value | CTB action rate | Offense CP | Effective HP / 4 | BaseCP | Reading |
|---|---:|---:|---:|---:|---:|---:|---|
| Fara, Tank | 1 | 5.11 | 0.80 | 20.45 | 18.30 | 38.8 | Defence and HP carry almost half of her CP. |
| Runa, Controller Mage | 1 | 6.56 | 1.00 | 32.78 | 11.90 | 44.7 | Magic offense and speed create higher threat despite lower durability. |

The extra gap from Runa's future control or status kit is added through `control` or `statusProc`; Fara's shields through `sustain`. Those values must be declared instead of forcing their level-one CPs to match.

### CP catalog and monotonicity contract

- Every hero, enemy, elite, and boss has a target BaseCP, derived BaseCP, kit breakdown, and CurrentCP field in the generated catalog.
- The build emits `output/balance/cp-report.json` and `output/balance/cp-report.csv`, sorted by BaseCP with the immediately weaker and stronger catalog neighbors.
- A `cp:validate` command fails on a missing kit input, an explicit CP override, a derived value outside its authored target tolerance of ±3%, a surface-burst breach, a mismatch between BaseCP and expected damage/burst/durability ordering, or a non-increasing BaseCP in an ordered content lane such as bosses.
- Boss insertion uses the report: set a target strictly between two neighboring BaseCP values, tune stats or kit inputs until the derived BaseCP is within tolerance, then rerun fixed-seed calibration.
- Adjacent bosses require a BaseCP gap of at least 5%, then pass simulation bands for win rate, turns-to-defeat, party casualties, and no deadlocks.

| Encounter label | EncounterCP / starting party BaseCP |
|---|---:|
| Routine | 0.25–0.35 |
| Hard | 0.61–0.75 |
| Elite | 0.76–0.90 |
| Boss | 0.91–1.05 |
| Above-boss, opt-in/catalog-only | 1.06–1.12 |

Ratios are a content placement guide. The player-facing win and burst bands remain the authority; the generated catalog must show that CP, expected damage, burst ceiling, durability, and simulated outcome rise together.

### Acceptance bands

- Level-one routine and hard ordinary enemy basics: 1–4 for at least 95% of non-crit samples.
- Level-one player basics: 1–9 for at least 95% of non-crit samples.
- Level-one double-digit hostile damage: only eligible elite/boss actions; actions above 12% target max HP must be telegraphed.
- Level-one Fodder KO: 4–7 hero damaging actions under actual role targeting.
- Level-one Balanced KO: 6–9 hero damaging actions under actual role targeting.
- Level-one routine first fragile-hero KO: never before 16 enemy damaging actions; Fara never before 22.
- Balanced same-level enemy: 6–9 hero hits; actual-role-target simulation defeats the first routine enemy within 2–4 party CTB cycles.
- Routine encounter: 97–100% player-facing win rate across at least 30 fixed seeds.
- Hard encounter: 85–95%; elite: 70–85%; boss: 60–75%; above-boss opt-in/catalog-only: 55–70%.
- Pre-buff boss evaluation remains diagnostic only and cannot supply a player-facing loss band.
- Three or more heroes survive the median routine run; recovery-event availability and use are recorded.
- Zero deadlocks, no actor takes an unaccounted extra action, and a qualified Speed sequence records exactly one linked explicit scheduler insertion. JS/Rust fixtures are exact for seeded inputs.

### Bidirectional scaling validation

This is the approved runtime gate. The provisional numbers may change; the validation contract does not.

Validation follows the ownership matrix: Capybara Go defines behavioral parity for the continuous player-advantaged session; FFX checks CTB/action-rate and role-trigger AF; DQ I contributes only small-number readability; DQ III contributes only four-role structural contrast. Wishfire's harness owns every numeric formula, target policy, burst ceiling, win band, recovery-event result, and parity test.

| Sample set | Required cases | Required checks |
|---|---|---|
| Every level 1–9 | Each hero role and representative fodder, balanced, striker, wall, caster, commander, elite, and boss archetype attacks and defends through physical and magic paths. | Damage/HP ratio, same-level hits-to-KO, crit bands, mitigation, CTB action rate, Speed-sequence breakpoint/count/throughput, AF trigger attribution and rate, BaseCP/CurrentCP, EncounterCP ratio, integer rounding, overflow, casualties, and win rate. |
| Every level 91–99 | The identical bidirectional matrix at high progression. | Preserve bounded same-level TTK and CP relationships; verify Speed-sequence breakpoints, full-sequence burst, CTB throughput, each role trigger, rate, cap, and gem attribution; do not force single-digit damage. |
| Cross-level edges | L1 attacks/defends against L9 and L9 against L1; L91 attacks/defends against L99 and L99 against L91. Run both physical and magic paths. | Make level advantage visible without defence becoming irrelevant or damage collapsing to one. |
| Offer policies | Repeat every encounter band in no-buff diagnostic mode, fixed Common opening-offer mode, and seeded real-offer mode under offensive, defensive, and neutral selection policies. | Separate base tuning from player-facing build variance. |

`BaseCP(level + 1)` must exceed `BaseCP(level)` for each combatant's own progression. Same-level roles may have different BaseCP and CurrentCP. CurrentCP must move in the expected direction after an applied session buff, while leaving BaseCP unchanged.

The harness emits `output/balance/scaling-drift-report.json` and `.md`, with this generated comparison table:

| Band | Damage/HP ratio | Same-level TTK | CTB rate / sequence count | Crit and sequence burst | CP ordering | Result |
|---|---|---|---|---|---|---|
| L1–9 | measured | measured | measured | measured | measured | pass/fail |
| L91–99 | measured | measured | measured | measured | measured | pass/fail |

The report fails if defence mitigation falls below its approved floor, ordinary damage is pinned to minimum, Speed clamps most actors, a recovered threshold has the wrong attack count, CTB throughput double-counts a Speed sequence, normal crits become routine one-shots, a low-CP actor breaches its full-sequence or target-HP-fraction ceiling, expected damage/burst/durability/CP fail monotonic lane checks, an ordered content lane has a CP neighbor inversion, integer math overflows, or the casualty/win-rate bands fail. The approved low-level absolute target is 1–4 routine/hard enemy damage and 1–9 player basic damage; high-level review uses ratios, TTK, CP ordering, and burst ceilings instead.

AF boundary suite at every sampled level: Fara hostile damage and Cover each award exactly once; Hondo multi-hit/AoE positive damage awards once; Runa awards once only for a new successful status; Kaja awards once when an ally loses HP. Each separately scheduled strike in a qualified Speed sequence may award once, while multi-hit inside a strike still awards once; therefore the linked sequence awards at most twice. Misses, zero/prevented damage, resisted or unchanged statuses, periodic ticks, AF-special self-refill, full-meter recipients, and randomized death-orb assignment award none. Verify the blue gem's origin and recipient match the credited hero.

### Numerical review issues to resolve before implementation

1. The current data lacks kit CP schema inputs and an authoritative role-target policy binding for the harness.
2. The routine win-rate suite must record no-buff, fixed Common, and seeded real-offer modes with offensive, defensive, and neutral choice policies.
3. Pre-buff boss evaluation is diagnostic only. It never changes the player-facing opening queue.
4. The initial 10-AF role rate needs seed calibration against each role's trigger frequency and special horizon.
5. Recovery-event cadence must preserve the approved retention bands because cards, inventory, and emergency healing are excluded from the retention model.
6. User review must decide whether above-boss content ships now or remains catalog-only.

## Opening per-hero buff draw

### Locked fresh-session initialization order

Every new mobile roguelite session starts with every roster hero alive and fully restored. No combat or session state carries across. The initializer must run in this order: (1) load permanent progression, roster, equipment, and unlocked catalog only; (2) derive fresh level stats and set HP to max; (3) clear `lastHP`, all statuses, Burn/Venom ticks, shields, AF, pending actions, CTB entries, target memory, combat logs, session buffs, cached offers, queue state, and every session RNG value; (4) create and seed a new session RNG state; (5) create the encounter/session shell; (6) enable independently authored opening dialogue/event insertion immediately; (7) build one cached sequential three-card power-buff offer for every starting hero in display order; (8) apply each choice; (9) apply battle-start surfaces; (10) release the CTB scheduler only when the opening queue is complete and no active dialogue/event interruption holds the session.

Dialogue is not an opening-queue step. Content may launch it at session opening, at one or many arbitrary combat milestones, or at session end. A mid-combat dialogue/event stores the exact combat/session snapshot through the existing interruption model, pauses CTB, then resumes that snapshot. Opening dialogue may happen before, during, or after offer selection; only the first scheduler action waits for the complete opening queue and for any active interruption to close.

Pause/resume preserves this new session after it begins. Abandon destroys it. A subsequent start repeats the full initialization order. There is no dead-at-session-start branch.

### Required state machine

| State | Entry and behavior | Exit |
|---|---|---|
| `session_init` | Restore permanent data only, then fully restore every starting hero and clear all combat/session state. Create a fresh seeded RNG and enable session content insertion. Do not release scheduler. | Opening dialogue/event or build opening queue. |
| `opening_offer` | Queue one entry per starting hero in display order. Build one same-tier three-card power-buff offer through existing eligibility and prerequisite rules. Cache by queue index. | Player chooses one card. |
| `opening_apply` | Apply the chosen session-long buff to that hero, acknowledge entry, retain the cached audit token. | Next hero or complete. |
| `opening_complete` | Apply all choices and battle-start stat/shield surfaces once. | Release `BattleStartActive` only if no dialogue/event interruption is active, then call `ProcessTurn` once. |
| `content_interrupt` | An authored opening, milestone, vendor, mysterious-spirit, story, or end-session event may enter independently. Mid-combat entry snapshots exact state and pauses CTB. | Resume the exact snapshot, or continue opening gating if it has not begun. |
| `paused` | Suspend combat snapshot, pause queue, preserve current index, cached offer, RNG state, and chosen buffs. | Resume returns to identical offer. |
| `abandoned` | Clear queue, cached offers, opening choices, session buffs, snapshot, and battle state. | Return to map with no rewards or penalty. |

Implementation seam: create the fresh session and opening queue after permanent progression restore and before the first scheduler release (`app.js:2071-2079,2113-2117`). The content router may launch dialogue/events once the reset completes. Reuse the queue shape, offer builder, fan renderer, selection handler, and turn gate. Use an entry reason such as `session-opening`; do not create fake EXP results or an EXP settlement. The existing fan already opens without a settlement (`sessionLevelUpBuffPresentation.mjs:93-116`).

The current battle-start buff guard marks the session on first actor turn (`heroCommands.mjs:61-87,140-148`). Opening completion must apply buffs before that first turn or leave the guard unset until completion.

Determinism rules:

- Seed the offer path from the new session seed and consume `RuntimeRandom` only when an uncached offer is created.
- Same new-session seed, permanent roster, and catalog must produce identical hero order, tiers, card IDs, and offer tokens.
- Pause/resume and rerender must not consume RNG or replace a cached offer.
- A rejected card ID leaves queue index, offer, buffs, and scheduler gate unchanged.
- Every starting hero is present in the opening queue. A hero defeated after combat begins does not affect the completed opening queue.

## Configurable session path and exploration gates

### Locked session-path contract

A session has a positive integer `N` content-step count. `5`, `10`, `20`, and `60` are presets, not modes or balance ceilings. A session is an authored-or-seeded path of `N` discrete steps. Combat is one possible step, never the whole session.

### Canonical Capybara-style step loop

1. Resolve the current day/step event from its cached content.
2. Show its narrative result or player choice in the persistent session feed.
3. Enter combat, a side activity, or neither, according to the authored event.
4. Apply the result to the same session state.
5. Show the next-step control and updated route progress.
6. Advance exactly once to the next day/step.

Combat may be selectable, mandatory, or absent as authored. After combat, its result returns to the same session feed and route state. A side activity such as treasure digging uses the same return path. Later visual work may present this loop differently; this artifact owns state and behavior, not copied UI.

Each step has one primary type: `combat`, `elite`, `boss`, `npc`, `dialogue`, `treasure`, `boon`, `fated_gift`, `dire_bargain`, `vendor`, `spirit`, or `end_milestone`. An `end_milestone` is the final step and may contain dialogue, a reward, or a boss resolution, but it does not silently add a hidden extra step.

The observed NPC bargain is an explicit accept/refuse trade, not a literal Hobson's choice. Keep `fated_gift` only for a genuinely one-option grant if content needs one. `dire_bargain` remains provisional player-facing naming for an explicit power-with-cost offer; it shows benefit and cost together and supports Accept/Refuse.

### Step data and state boundary

The minimum data shape is:

```json
{
  "sessionId": "seed-derived-id",
  "seed": 12345,
  "stepCount": 20,
  "stepIndex": 7,
  "milestones": [{"step": 6, "kind": "question"}, {"step": 7, "kind": "combat"}, {"step": 15, "kind": "boss"}],
  "steps": [{
    "id": "seed-or-content-id",
    "type": "combat",
    "status": "pending",
    "stepSeed": "seed-derived",
    "encounterId": "optional",
    "eventId": "optional",
    "choices": "optional cached choice ids",
    "next": "next step id"
  }],
  "sessionState": "opening_offer | step_ready | combat_active | event_active | paused | complete | abandoned"
}
```

Session-persistent state: seed, step skeleton, declared milestone schedule, permanent-derived roster, session buffs, earned EXP/rewards, selected event outcomes, AF, and the opening-offer audit tokens. Encounter-only state: enemy roster, CTB queue, target memory, statuses and their ticks, shields, pending actions, combat log, and any exact interruption snapshot. Entering a later combat step creates fresh encounter-only state while retaining session-persistent state. A combat interruption preserves the encounter-only snapshot until that same combat resumes.

### Small session runner

| State | Behavior | Exit |
|---|---|---|
| `step_ready` | Read the current completed-or-pending session step without spending RNG. | Start combat, open event, or finish session. |
| `combat_active` | Build the step's encounter, release CTB, and resolve only this combat step. | Victory enters `step_complete`; an authored interruption snapshots combat and enters `event_active`. |
| `event_active` | Present cached dialogue, NPC, chest, boon, fated gift, dire bargain, vendor, or spirit content. | Record choice/result, then resume the snapshot without advancing, or enter `step_complete` for a standalone event step. |
| `step_complete` | Record the immutable result and advance exactly once to the linked next step. | `step_ready`, or `complete` after `end_milestone`. |
| `paused` | Freeze the current session runner and, if present, the exact combat snapshot. | Resume the same state or abandon. |
| `complete` | Finalize the authored session outcome once. | Return to map. |

Dialogue may be attached to any step, including a combat step. It uses `event_active`; the session runner returns to the exact saved CTB state and does not increment `stepIndex`. A standalone event step replaces a combat step in the path, resolves through `step_complete`, and increments `stepIndex` once. These are separate authoring choices.

### Deterministic construction and safety rules

- A session seed resolves only the full step skeleton, each step type, and a deterministic `stepSeed` at initialization. On first entry to a step, evaluate current eligibility from the current session build, prior choices, HP, and milestone state using that `stepSeed`; select once and cache the exact event/offer before presentation.
- A combat-family slot uses a seeded same-family fallback, then basic combat if none exists. A required exploration/event slot uses a seeded same-family fallback, then a guaranteed baseline `boon` or `treasure` event. A required exploration slot never converts into combat. Rerender and resume reuse cached content.
- The final step is always `end_milestone`. Each authored or seeded session template declares its visible milestone schedule, such as question/combat/boss positions on a Day 1/6/7/15 route. `N` controls session length only. The validator enforces declared milestone positions and the final end milestone; it invents no boss cadence from `N`.
- A session may not contain more than three combat-family steps (`combat`, `elite`, `boss`) consecutively. The guaranteed baseline `boon` or `treasure` event makes this unconditional and prevents event starvation.
- A session may not contain more than two non-combat event steps consecutively before a combat-family step, unless an authored branch explicitly marks a narrative chain.
- Elite and boss steps use encounter CP bands. Vendors, NPCs, chests, boons, spirits, fated gifts, and dire bargains use eligibility only; they do not silently create combat.
- Progress UI shows `stepIndex / stepCount`, the current landmark/type, and the next locked milestone. It does not promise a fixed room count or expose hidden RNG.

### Proof matrix

| Case | Required proof |
|---|---|
| `N=5` | Opening offers, one event gate, one combat-family step, and end milestone complete in seed order. |
| `N=10` | Declared milestone/end constraint, no combat starvation breach, one attached mid-combat dialogue pause/resume. |
| `N=15` | Screenshot-parity route validates declared Day 1/6/7/15 milestones, explicit advance, combat return, and end milestone. |
| `N=20` | Seeded branch/event selection is stable through rerender, pause, and resume. |
| `N=60` | Declared milestone schedule, no duplicate completion, no unbounded state growth, and final completion after step 60. |
| Arbitrary `N=13` | Positive-integer validation, deterministic skeleton, safe fallbacks, and no off-by-one final step. |

No gameplay result is claimed by this document. These are implementation and QA acceptance cases after review approval.

### Unresolved product decisions

1. Which named NPC, chest, spirit, vendor, boon, and bargain content ships in the first authored catalog?
2. May every `dire_bargain` be declined, or may an authored story branch require its cost?
3. Which visible milestone schedules should the first session templates declare?
4. Which rewards persist after completion or abandonment beyond the currently approved progression model?
5. Are `fated_gift` and `dire_bargain` the final player-facing names, or should the genie-world narrative supply replacements?

### Capybara-loop parity checklist

- One continuous session feed persists across story, combat, and side activities.
- Every resolved step exposes an explicit next-step advance before route progress changes.
- Combat can be a selectable gate, a mandatory event result, or absent.
- Combat and side activities return to the same session state rather than a separate quest ladder.
- NPC bargains show their benefit, cost, and Accept/Refuse outcome before mutation.
- Opening buff choices and AF specials use the approved Wishfire departures.

## Exact implementation scope

Phase 1, shared math and parity:

- `src/core/calculateDamageRules.mjs`
- `web-runner/src/core/calculateDamageRules.mjs`
- `rust/simulation_core/src/lib.rs`
- `web-runner/modules/functionBank.js`
- `Scripts/functionBank.js`
- Speed-threshold scheduler and multiattack presentation callers/mirrors
- `web-runner/src/core/combatPower.mjs`
- CP mirrors/call sites in `web-runner/systems/combatSessionInitializer.js`
- damage and CP fixture/ownership tests

Phase 2, data and progression:

- `web-runner/src/core/heroDefinitions.mjs`
- `web-runner/src/core/heroProgression.mjs`
- `web-runner/state/heroScreenConfig.js` or its retirement as a stat source
- `web-runner/assets/enemies.json`
- progression, roster, encounter, and balance-harness tests

Phase 3, opening draw integration:

- `src/core/sessionLevelUpQueue.mjs`
- `web-runner/src/core/sessionLevelUpQueue.mjs`
- `web-runner/modules/sessionLevelUpBuffPresentation.mjs`
- `web-runner/modules/heroCommands.mjs`
- `web-runner/systems/combatSessionReset.mjs`
- `web-runner/systems/storyEntryFlow.mjs`
- `web-runner/app.js`
- focused queue, dialogue/event interruption, transition, pause/resume/abandon, and browser interaction tests

Phase 4, session path integration:

- a single seeded session-step data owner and browser mirror
- `web-runner/systems/storyEntryFlow.mjs`
- `web-runner/systems/combatSessionReset.mjs`
- existing interruption/pause ownership only where needed to preserve exact combat snapshots
- deterministic path, event eligibility/fallback, step-completion, and in-app Browser session-path proof

Shared files need one integration owner. No UI redesign, ordinary-turn cards, attack cards, relief/healing cards, new menu, quest-ladder expansion, or art work belongs in this change.

## Phased Definition of Done

1. Formula fixture tables pass identically in shared JS, browser JS, runtime fallback, Construct mirror, and Rust.
2. One canonical hero stat source produces the documented level 1/5/10/20 values; Runa and Kaja basics use magic.
3. All enemy rows derive CP from stats; encounter bands select seeded compositions within tolerance.
4. CP, expected damage, burst ceiling, durability, and encounter outcomes rise monotonically in their authored lanes.
5. Fixed-seed damage sampling meets the level-one range, burst, and crit acceptance bands.
6. Bidirectional harnesses cover every level 1–9 and 91–99, plus L1↔9 and L91↔99 edges; they meet damage, TTK, CTB throughput, Speed-sequence breakpoint/count, full-sequence burst, CP, casualty, overflow, and deadlock bands.
7. A qualified living hero receives exactly one linked extra scheduled action at the recovered two-times-Speed threshold; the latch prevents recursion, each strike follows AF boundaries, and grouped visual feedback proves both strikes.
8. A full session reset completes before every starting-hero opening choice; the first scheduler action stays blocked until choices complete, while dialogue/event content can begin independently.
9. Opening and mid-combat dialogue/event interruptions preserve and resume exact combat/session state; pause/resume restores the exact hero, offer, queue index, selected buffs, and RNG state; abandon clears all opening state.
10. Browser proof uses the production entry path and demonstrates opening dialogue, opening draw, first combat action, a qualified Speed sequence, a mid-combat interruption/resume, pause/resume, and abandon.
11. Generated CP catalog and scaling-drift reports show monotonic BaseCP, CurrentCP behavior, neighbor ranges, Speed-sequence burst ceilings, and failed-check output where applicable.
12. A completed change report names every changed file, formula delta, Speed-sequence evidence, test result, variance from this plan, and rollback point.
13. Configurable sessions pass the `N=5,10,15,20,60,13` proof matrix; declared milestones, combat, exploration events, cached choices, interruption/resume, end constraint, fallbacks, and step progress behave deterministically.

## Risks and rollback

- CP is a predictor. Validate its bands under the final role-target rules; any target-policy change requires rerunning the harness.
- Removing hidden passive multipliers changes saved heroes. Recalculate from level and equipment rather than persisting derived stats.
- Opening offers consume seeded randomness. Cached offers prevent rerenders from changing combat outcomes.
- Changing all formula mirrors in one owned lane prevents silent JS/Rust drift.
- Roll back by reverting the formula/data commit and the opening-flow commit separately; keep pre-change fixed-seed outputs for comparison.
- Session paths need enough authored eligible events for their cadence. Required exploration positions use the baseline boon/treasure fallback, preserving session variety while catalog breadth determines authored richness.

## Required change report template

```
Candidate commit:
Rollback commit/tag:
Scope implemented:
Files changed:
Formula before:
Formula after:
Hero stat table observed (L1/L5/L10/L20):
Enemy archetype and CP table observed:
Role-stat/CP and AF-trigger evidence observed:
Speed threshold, linked-action count, full-sequence burst, AF gain count, and feedback evidence observed:
Encounter CP ratios observed:
Opening draw state transitions observed:
Fresh-session reset ordering and cleared-state evidence:
Tests added or changed:
Tests run and exact results:
Balance harness seeds and aggregate results:
Per-surface hero advantage, win rate, burst ceiling, and recovery-event result:
Bidirectional scale matrix and L1↔9/L91↔99 edge results:
Scaling-drift report path and result:
CP catalog path, neighbor insertion range, and monotonicity result:
Browser production-path evidence:
JS/Rust parity evidence:
Differences from approved plan:
Known risks or unresolved defects:
Definition of Done status by item:
Session step count, skeleton, event choices, interruption/resume, and fallback evidence:
```
