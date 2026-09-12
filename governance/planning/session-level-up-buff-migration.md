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

## Initial Card Families

The 48-card test pool should cover direct formulas and automatic combat behaviors.

### Direct Stats

- Max HP
- ATK
- MATK
- DEF
- RES
- SPEED

### Automatic Combat Effects

- Spectral Orb: periodic automatic projectile
- Inner Flow: stronger automatic skill cadence or power
- Crimson Ward: battle-start shield
- Destiny: basic attacks may restore HP
- Faze: basic attacks may inflict Venom or the final Wishfire equivalent
- Chain Strike: basic attacks bounce to another enemy
- Arcane Pulse: periodic automatic magic hit
- Split: basic attacks deal splash damage
- Battle-start lightning or another genie-magic strike
- Low-HP power
- Counterattack with bounded recovery
- Stat bargains such as increased ATK with reduced Max HP

Final card text must show exact numeric values. Artifact or account progression may later modify central values without changing the card's behavior.

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

- Define the 48-card pool, four tiers, stage relationships, formulas, and player-facing copy.
- Mark every behavioral card as grant or upgrade.
- Identify pure stat fallback cards in every tier.
- Keep Magic Fruit in the event-reward lane.

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
- Replace temporary reference terminology.
- Add exact values and upgrade stages.
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
