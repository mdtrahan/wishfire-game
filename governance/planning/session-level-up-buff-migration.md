# Session Level-Up Buff Migration

## Purpose

Replace combat-turn action-card draws with per-hero level-up buff choices suited to Wishfire's portrait, turn-based adventure sessions.

This contract records the approved product direction and guides later Beads. It does not authorize runtime edits by itself.

## Authority

- **INTENDED:** Decisions approved by the owner during the September 2026 design review.
- **OBSERVED:** Current or historical behavior found in the repository.
- **REFERENCE:** Capybara Go progression patterns used to understand offer construction. Wishfire keeps its own setting, combat formulas, names, and presentation.
- **UNTESTED:** Exact rarity odds, final card values, and session pacing remain subject to playtesting.

## Rollback Checkpoint

- Branch: `bead/ORKA-49k.9-preserve-bottom-navigation`
- Commit: `7969171`
- Purpose: preserve the current combat card, targeting, navigation, and hero-strip work before migration.
- Status: WIP checkpoint only.
- Known gate result: 27 UI-lock contracts passed, then rendered capture crashed at `tools/ui_presentation_lock_gate.mjs:536` while reading `left` from an undefined value.
- The checkpoint is not QA PASS or Integration Ready.
- Migration epic: `ORKA-yie`, open at P1.
- Beads command: use `/opt/homebrew/bin/bd` while the shell-default `0.56.1` binary remains incompatible with the `0.63.3` database.

## Player Experience

Normal combat no longer pauses each hero turn to show three action cards. A living hero performs the existing basic attack automatically when their CTB turn resolves.

When one or more heroes level up:

1. Pause adventure progression at a safe resolution boundary.
2. Queue every earned hero level-up in deterministic party order.
3. Show the first queued hero performing a short level-up dance.
4. Present that hero with three buff cards from one shared power tier.
5. Apply the selected buff only to that hero.
6. Advance to the next queued level-up.
7. Resume the adventure, continue its transition, or finish the session after the queue empties.

If one hero earns several levels at once, enqueue one choice for each earned level unless a later product decision changes that rule.

## Buff Ownership and Lifetime

- The card pool is universal. Every hero draws from the same definitions.
- A selected buff belongs only to the hero whose level-up produced the choice.
- Buffs remain active until the current adventure session ends.
- Ending, abandoning, or restarting a session clears its buffs.
- Buff cards never enter the CTB turn loop and never consume a combat turn.
- Buff cards have no SP cost, energy cost, Tempo label, manual target, or action selector.
- Hero identity comes from base stats and combat presentation. The shared pool lets the player build each hero freely.

## Offer Construction

Start with 48 cards: 12 cards in each of four power tiers.

Every level-up offer follows this sequence:

1. Roll one power tier using the session's progress toward its final boss.
2. Build the eligible pool for the leveling hero.
3. Select three distinct cards from that tier.
4. Never mix power tiers inside one offer.
5. Remove card stages already owned by that hero.

### Lowest Tier

The lowest tier may offer:

- a new behavioral buff at its granted stage;
- a direct stat increase;
- a clear bargain with one benefit and one penalty.

### Higher Tiers

A higher-tier behavioral card is eligible only when its base effect is already granted to that hero. The offered stage must be the next valid stage in that effect's progression.

Pure stat cards remain eligible without a granted prerequisite. They are the same-tier fallback when fewer than three behavioral upgrades qualify.

If the tier cannot supply three distinct eligible cards after stat fallback, reroll the tier. Do not downgrade individual slots or mix tiers.

## Stage Semantics

An upgraded stage replaces its earlier value. Values do not add together unless a final card explicitly describes a separate stacking behavior.

Examples:

- A 15% trigger chance upgraded to 25% becomes 25%, not 40%.
- One Spectral Orb upgraded to two becomes two, not three.
- ATK +10% upgraded to ATK +18% becomes +18%.

Each stage is selected once. A fully upgraded effect leaves the pool for that hero.

## Phase 1 Product and Data Contract

Phase 1 reserves the data shape and the 48-card capacity. It does not name
final cards, write player-facing copy, or claim the final pool is complete.
Those decisions belong to Phase 5 after the mechanic has passed its QA fixture.

### Stable Card Definition

Each card is a record with these stable fields:

| Field | Meaning |
| --- | --- |
| `cardId` | Stable snake-case identifier. QA fixtures use the `qa_` prefix. Phase 5 assigns final production IDs. |
| `tier` | Integer `1` through `4`. An offer contains one tier only. |
| `kind` | `behavior`, `stat`, or `bargain`. |
| `effectId` | Stable effect family. A hero owns stages by this key. |
| `stage` | Positive integer within `effectId`; stage `1` is the grant. |
| `requiresStage` | Prior stage required for this card, or `null` for a grant or independently eligible stat fallback. |
| `replacesStage` | Stage removed when this card applies, or `null` for a first grant. |
| `formula` | Typed numeric payload from the formula surfaces below. |
| `trigger` | Named automatic event, or `passive` for a derived stat. |
| `targetRule` | `self`, `trigger_target`, `next_living_enemy`, or another explicit automatic rule. Buff cards never request manual targeting. |
| `sourceTag` | `session_level_buff`, retained on generated effects for recursion guards and debug proof. |
| `fixture` | `true` only for internal QA cards. Fixtures cannot ship as final player-facing cards. |

`effectId` and `stage` are the replacement key. Applying a later stage sets
that hero's active stage to the selected record. The prior record supplies no
remaining chance, count, cadence, or stat value.

### Reserved Four-Tier Structure

The final pool has exactly 48 records: 12 slots in each tier. Phase 1 reserves
each tier's 12-slot capacity without assigning all final entries. Every tier
reserves at least four independently eligible `stat` or `bargain` fallback
slots, so three distinct same-tier choices remain possible while behavioral
paths are unavailable. Tier 1 may contain behavioral grants. A behavioral
record in tiers 2 through 4 must require the immediately preceding owned
stage. Phase 5 assigns the final slot identities, names, copy, and values.

Direct-stat families reserved for the final pool are `max_hp`, `atk`, `matk`,
`def`, `res`, and `speed`. Behavioral capacity is reserved for periodic damage,
automatic healing, status application, battle-start protection, bounce or
splash damage, counterattack, low-health power, and bargains. This is a
capacity map, not a promise that every listed behavior appears in every tier.

### Formula Surfaces

All percentages are decimal fractions. A record must name one surface and
provide every numeric input it needs.

| Surface | Required formula fields | Resolution |
| --- | --- | --- |
| `stat_percent` | `stat`, `percent` | `derivedStat = round(baseStat * product(1 + percent for active distinct effectIds affecting stat))`. Stages within one `effectId` replace before this product. `max_hp` changes the maximum only; current HP is retained and clamped to the new maximum. |
| `flat_magic_damage` | `amount` | Deal exactly `amount` magic damage to the automatic target. |
| `shield_percent_max_hp` | `percent` | At battle start, grant `round(owner.maxHp * percent)` shield to the owner. |
| `heal_percent_max_hp` | `chance`, `percent` | On the named trigger, a roll below `chance` heals `round(owner.maxHp * percent)`. |
| `status_on_basic` | `chance`, `statusId`, `durationTurns`, `damagePerTurn` | On a completed owner basic attack, a roll below `chance` applies the status to `trigger_target`. |
| `cadence_magic_damage` | `everyCompletedBasics`, `amount` | After each multiple of `everyCompletedBasics` completed owner basic attacks, deal `amount` magic damage to `trigger_target`. |
| `bounce_percent_damage` | `chance`, `damagePercent` | After a completed owner basic attack, a roll below `chance` deals `round(resolvedTriggerDamage * damagePercent)` physical damage to the next distinct living enemy in the established deterministic target order; no living second target means no bounce. |
| `counter_percent_atk` | `chance`, `damagePercent`, `healPercentMaxHp`, `maxPerDamagePackage` | When the owner receives a direct enemy damage package with a source, a roll below `chance` deals `round(owner.atk * damagePercent)` physical damage to its source, then heals the owner for `round(owner.maxHp * healPercentMaxHp)`. A `session_level_buff` counter package cannot trigger another counter. |
| `bargain_percent` | `benefitStat`, `benefitPercent`, `penaltyStat`, `penaltyPercent` | Apply both `stat_percent` modifiers under one effectId; each stage replaces both values together. |

Rounding uses the runtime's existing combat rounding helper. Phase 2 must call
that helper rather than introduce another rounding rule.

### Tier and Progress Inputs

Tier selection receives a deterministic random source and this session input:

```text
progress = {
  completedMilestones: non-negative integer,
  totalMilestonesToFinalBoss: positive integer,
  finalBossReached: boolean,
}
normalizedProgress = clamp(completedMilestones / totalMilestonesToFinalBoss, 0, 1)
```

`tierWeights(normalizedProgress, finalBossReached)` is an injected table. Its
values and rarity curve are intentionally uncommitted until playtesting. The
selector must record the rolled tier and use only that tier for one offer.

```text
deterministicTierAttempts(progress, rng):
  remaining = [1, 2, 3, 4]
  while remaining is not empty:
    weights = nonNegative(tierWeights(normalizedProgress, finalBossReached)) restricted to remaining
    if sum(weights) > 0:
      tier = weightedSample(remaining, weights, rng)
    else:
      tier = lowest(remaining)
    yield tier
    remove tier from remaining
```

The first yielded tier is the weighted sample. When that tier cannot form an
offer, remove it and deterministically weighted-resample only among untried
tiers. If every remaining weight is zero, use ascending-tier fallback. After
four distinct failed tiers, return `offerUnavailable`.

### Per-Hero State and Eligibility

Session state is keyed by hero instance identity, never party-wide identity:

```text
heroSessionBuffs[heroInstanceId] = {
  activeStageByEffectId: { [effectId]: stage },
  completedEffectIds: set<effectId>,
  triggerCountersByEffectId: { [effectId]: non-negative integer },
}
```

```text
buildOffer(hero, progress, rng):
  for tier in deterministicTierAttempts(progress, rng):
    behavioral = shuffle(eligibleBehavioral(hero, tier), rng)
    chosen = takeFirstDistinct(behavioral, 3)
    if chosen.length < 3:
      fallback = shuffle(eligibleStatsOrBargains(hero, tier), rng)
      chosen += takeFirstDistinct(excluding chosen, fallback, 3 - chosen.length)
    if chosen.length == 3:
      return { tier, cards: chosen }
  return offerUnavailable

eligibleBehavioral(hero, card):
  owned = heroSessionBuffs[hero.id].activeStageByEffectId[card.effectId] ?? 0
  required = card.requiresStage ?? 0
  return card.kind == behavior
     and required == owned
     and card.stage == owned + 1

eligibleStatsOrBargains(hero, card):
  owned = heroSessionBuffs[hero.id].activeStageByEffectId[card.effectId] ?? 0
  required = card.requiresStage ?? 0
  return card.kind in {stat, bargain}
     and card.effectId not in heroSessionBuffs[hero.id].completedEffectIds
     and ((card.requiresStage == null and owned == 0 and card.stage == 1)
       or (card.requiresStage != null
         and required == owned
         and card.stage == owned + 1))

apply(hero, card):
  remove card.replacesStage for card.effectId from hero state
  set activeStageByEffectId[card.effectId] = card.stage
  if card is the highest defined stage for effectId:
    add card.effectId to completedEffectIds
```

The implementation may use equivalent data structures. It must preserve these
results: a hero never sees an owned stage, a behavioral upgrade requires that
same hero's prior stage, stat fallback is independent, no offer mixes tiers,
and a failed tier rerolls as a whole. If all four tier attempts are
unavailable, return `offerUnavailable`; never downgrade one slot or fabricate
a duplicate.

Pure stat-or-bargain cards with `requiresStage: null` are independently
eligible fallbacks at any tier. A staged stat-or-bargain card uses the same
next-stage rule as a behavioral upgrade, so `qa_atk_focus` stage 2 is eligible
only for the hero who owns its stage 1. That constraint never gates the pure
same-tier fallbacks.

### Neutral QA Fixtures

These internal records prove formula surfaces. They are not final names, copy,
or the completed 48-card pool.

| Fixture effectId | Tier and stages | Exact payload |
| --- | --- | --- |
| `qa_atk_focus` | T1 stage 1; T2 stage 2 requires 1, replaces 1 | `stat_percent(atk, 0.10)` then `stat_percent(atk, 0.18)` |
| `qa_max_vitality` | T1 stage 1 | `stat_percent(max_hp, 0.20)` |
| `qa_opening_shield` | T1 stage 1 | `shield_percent_max_hp(0.25)` at battle start |
| `qa_heal_on_basic` | T1 stage 1 | `heal_percent_max_hp(chance: 0.15, percent: 0.05)` on completed owner basic attack |
| `qa_status_on_basic` | T1 stage 1 | `status_on_basic(chance: 0.20, statusId: qa_venom, durationTurns: 2, damagePerTurn: 3)` |
| `qa_pulse` | T1 stage 1 | `cadence_magic_damage(everyCompletedBasics: 2, amount: 6)` |
| `qa_bounce` | T1 stage 1 | `bounce_percent_damage(chance: 0.25, damagePercent: 0.50)` |
| `qa_counter` | T1 stage 1 | `counter_percent_atk(chance: 0.20, damagePercent: 0.40, healPercentMaxHp: 0.03, maxPerDamagePackage: 1)` |
| `qa_power_bargain` | T1 stage 1 | `bargain_percent(benefitStat: atk, benefitPercent: 0.15, penaltyStat: max_hp, penaltyPercent: -0.10)` |
| `qa_orb_cadence` | T1 stage 1; T2 stage 2 requires 1, replaces 1 | `cadence_magic_damage(everyCompletedBasics: 3, amount: 4)` then `cadence_magic_damage(everyCompletedBasics: 2, amount: 6)` |

### Ownership, Lifetime, and Cleanup

Only the hero that selects a record receives it. Effects read that hero's
state and automatic trigger context; they never alter another hero's buff
state. Buffs expire when the current adventure session ends, is abandoned, or
restarts. Battle end preserves them only when the adventure continues. Magic
Fruit is an encounter reward with existing healing behavior and does not enter
this state, offer builder, tier roll, or level-up queue. That event-only rule
applies to Magic Fruit acquisition only; level-up buffs may heal or restore
health through their own automatic formulas.

## Historical Wishfire Reuse

Reuse existing runtime behavior and visual assets where they fit. Do not inherit retired draw rules, action-card interactions, hero-specific ownership, or manual targeting.

| Historical skill | Preserve | Replace |
| --- | --- | --- |
| Crimson Ward | Ward calculation and visible shield presentation | Selection-fired repeatability becomes a staged session buff |
| Destiny | Heal proc and heal bloom | Old shared-party ownership becomes per-hero ownership |
| Faze | Persistent field/status presentation where suitable | Old poison wording and repeatable selection trigger |
| Grow | Power-for-Max-HP bargain | Old party-wide application |
| Chain Strike I/II | Bounce behavior and visual arc | Old one-off draw classes become staged grant and upgrade |
| Arcane Pulse | Automatic magic hit and burst | Old selected-target dependency |
| Split | Multi-enemy damage presentation | Retired red-attack dependency |

`Fresh Start`, `Guard Rail`, `Weaken`, and other historical stubs may donate names or simple ideas. They are not implemented foundations.

## Magic Fruit

Magic Fruit stays outside the level-up pool. A sprite, pixie, merchant, rescued traveler, or another story encounter may grant it freely for helping or speaking with them.

Preserve its healing logic and presentation when compatible. It consumes no level-up choice.

## Reference Firewall and Reskin Order

Capybara Go supplies mechanical test patterns only:

- grant an effect;
- improve its current chance, count, cadence, or power;
- build vertically after a path begins;
- offer three choices from one power tier;
- allow special encounters to grant exceptional rewards.

QA definitions may use plain functional names while mechanics are under test. Borrowed fantasy nouns, card copy, characters, visual identity, and setting language must not ship.

After a mechanic passes deterministic and live verification, give it a Wishfire identity based on genie magic, brass vessels, spectral energy, bargains, desert winds, sealed ruins, and Astral Flow imagery. Examples include Spectral Orb in place of a dagger-like projectile and Inner Flow in place of a rage-like meter.

References:

- <https://capybara-go.game-vault.net/wiki/Skills>
- <https://capybara-go.game-vault.net/wiki/Adventurers>
- <https://capybara-go.game-vault.net/wiki/Guide%3ASkills_Tier_List>

## QA Archetype Set

Before authoring all 48 final cards, implement a small internal test set that proves each reusable effect path:

1. direct ATK increase;
2. direct HP increase;
3. battle-start shield;
4. automatic heal proc;
5. automatic status proc;
6. periodic automatic magic attack;
7. bounce or splash attack;
8. counterattack;
9. positive and negative bargain;
10. base grant followed by a replacement upgrade.

The QA set must verify visible material change. Shields display the established ward presentation. Healing displays the established bloom. Status effects show a readable icon or marker. Automatic attacks show their source and target.

QA cards are internal fixtures. Remove their temporary copy or convert them into final Wishfire cards after their mechanics pass.

## Migration Phases

### Phase 1: Product and Data Contract

- Define stable card fields, four 12-slot tier capacities, stage relationships,
  formula surfaces, progress inputs, and neutral QA fixture values.
- Reserve behavioral grant/upgrade capacity and four independently eligible
  stat-or-bargain fallback slots in every tier.
- Keep Magic Fruit in the event-reward lane.
- Defer final Wishfire names, player-facing copy, exact production values, and
  the completed 48-card pool to Phase 5.

### Phase 2: Deterministic Draw Rules

- Add per-hero session buff state.
- Implement progress-weighted tier selection.
- Implement same-tier three-card offers.
- Enforce grant prerequisites and replacement stages.
- Handle exhausted pools deterministically.

### Phase 3: Combat Transition

- Remove hero-turn card-draw gating.
- Route living hero CTB turns through the existing native basic attack.
- Queue simultaneous and multi-level hero rewards.
- Pause and resume combat safely around the level-up queue.

### Phase 4: QA Archetypes

- Wire the minimal test set through existing combat seams.
- Reuse current healing, ward, status, attack, and targeting presentation.
- Prove each archetype individually before expanding the pool.

### Phase 5: Wishfire Card Pool

- Convert passing mechanics into final genie-magic cards.
- Assign the completed 48-card pool: final IDs, names, player-facing copy,
  exact values, tier placement, and upgrade stages.
- Replace temporary QA terminology and reject any borrowed reference language.
- Check that every tier can always form a valid three-card offer.

### Phase 6: Live Verification

- Verify every level-up queue shape in the in-app Browser.
- Verify one through six heroes, KO heroes, simultaneous level-ups, multi-level gains, battle end, session end, quit, and restart.
- Verify cards never replace themselves during enemy turns or idle reading time.
- Verify each chosen buff affects only its owning hero.
- Verify stage replacement and session cleanup.

## Adventure Direction

This buff migration supports a larger session structure:

- The player taps a map location to begin an adventure.
- Heroes remain inside one continuous story, dialogue, and combat session.
- Dialogue remains part of the adventure presentation.
- The overworld shows milestone locations rather than an animated traveling party.
- Completing a milestone updates the party's map location.
- The current quest-ladder menu direction will be retired through separately scoped work.

Map travel, quest-ladder removal, and complete session routing require their own Beads. They must not expand the first buff-system implementation lane.

## Required Evidence

- Focused deterministic tests for tier selection, eligibility, replacement stages, per-hero ownership, and queue order.
- Integration tests for CTB pause/resume and native basic attacks.
- In-app Browser proof for every QA archetype and the level-up sequence.
- A clean comparison showing unchanged combat outside the requested migration.
- Use the external-browser fallback only after three in-app Browser failures. Keep one fallback session and close it after proof.
- At most two active agents, including the orchestrator.

## Stop Conditions

Stop the affected implementation lane when:

- a buff cannot map to an existing combat formula or explicit new formula;
- a higher-tier offer cannot produce three eligible same-tier cards;
- stage replacement would silently stack with the prior stage;
- a runtime edit would inherit retired card-draw, skill, targeting, or interaction rules;
- visual changes extend beyond the level-up cards and their required combat feedback;
- another lane owns a dirty file required by the migration;
- a human-facing visual design needs approval and no annotated pre-implementation proof has been reviewed.

## Explicit Exclusions

- No hero-specific card pools.
- No combat-turn card choices.
- No card SP, energy, or Tempo costs.
- No manual targeting from buff cards.
- No revival of the legacy hero skill menu.
- No inheritance of legacy three-card draw guarantees or interaction rules.
- No final use of Capybara Go names, copy, art, characters, or setting.
- No quest-ladder rewrite inside the first buff-system Bead.
