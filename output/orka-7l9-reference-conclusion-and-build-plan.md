# ORKA-7l9: StoneAge conclusion and Wishfire build plan

2026-10-17. The owner ended the WORLD360 reference playthrough after Lucy's unlock. This document records the combat decision from direct observations and a plan for later Wishfire work. No further StoneAge milestone, including Chapter 4-2, is required for this decision. The current Wishfire candidate remains unmerged and is not Integration Ready.

For a feature-by-feature handoff with source and proof paths, read [the gap analysis](orka-7l9-feature-gap-analysis.md).

## What the game showed

- WORLD360 progressed from Chapter 1-2 into Chapter 3 and unlocked Lucy after the Chapter 3-1 boss. Early chapter bosses repeatedly exhausted their blue gauge while the visible party remained standing. At Chapter 2-20, a 42%-HP failure showed an empty gauge and four green party portraits. Earned levels, equipment, training, and a mount accumulated before a later win. These changes overlap, so the observations establish a progression pattern, not the effect of any one upgrade.
- No Hero KO was seen in the sampled ordinary or chapter-boss frames through the observed Chapter 3 encounters. This is evidence for an early-game survival target, not a measured zero-KO probability or proof through Chapter 6. Optional Capture Ticket Dungeon Tier 3 was different: its high-power boss explicitly wiped the party at 97% boss HP. Keep that special pressure curve separate.
- At level 1, Woody showed HP 1,040, ATK 26, DEF 26 and power 1,636. Lucy showed HP 936, ATK 30, DEF 23 and power 1,721. Lucy gained displayed power despite lower HP and DEF; this is consistent with greater offensive weight but cannot identify the game's CP formula. `Auto-Form` added Lucy without replacing Woody or the three pets. Lucy began with empty gear, and the Catch Bag offered cached pieces for her open slots while Woody kept his five equipped pieces. This observed flow does not establish how a contested same-slot item is assigned.
- Chapter 3-10 unlocked Forge, and Stage 3-13 introduced Auto-Capture. The final observed screen was Chapter 3-13 Mui with both trainers deployed; a Bag disassembly action and Auto-Capture guide interaction occurred. The Bag's final item count, later capture consumption, and Mui outcome were not measured. WORLD360 was not reset or moved to another world.

The full direct record is [WORLD360 observations](orka-7l9-stoneage-world360-direct.md). Earlier short D1 video evidence is indexed in [the D1 capture folder](orka-7l9-stoneage-d1/README.md). These observations do not reveal StoneAge's per-hit equation, target selection, hidden healing source, numeric boss timer, minimum HP across 20 ordinary waves, or a Chapter 4-2 outcome. No exact StoneAge damage or CP formula is claimed.

## Combat rule to carry into Wishfire

Early ordinary combat should keep a reasonably equipped starter party alive without requiring a healer. A chapter boss can still stop progress by exhausting its gauge. In a simplified encounter model, ordinary incoming burst must stay below each exposed Hero's current HP, and damage accumulated between recovery opportunities must remain within the party's sustain budget. For an underprepared boss, `party DPS × active boss time` falls short of boss effective HP while the party survives that interval. Earned progression should raise damage enough to cross the boss clear threshold. These are design inequalities inferred from outcomes; they are not StoneAge's hidden formula.

Wishfire's current candidate uses its own rules: `max(0, attack power − resistance)` before percentage modifiers in `calculateDamageRules.mjs`; fodder and routine single hits are capped at 2% of target max HP in `routineEnemyScaling.mjs`; living Heroes regain 15% of max HP after an ordinary wave in `continuousCombatStage.mjs`; bosses use the authored 18-second gauge. The 15% recovery is a provisional Wishfire rule, not a StoneAge measurement. Retain current HeroProgress identities and active instance-key equipment when evaluating it. Saved canonical gear keys previously failed to equip deployed clones, so older saved-loadout reports cannot demonstrate gear protection.

## Evidence already in the candidate

- Clean current-source level-1 three-Hero and four-Hero fixtures, plus matched level-5 fixtures, each cleared 20 ordinary waves across five seeds with zero Hero KOs or recoveries. The level-5 preset is synthetic Wishfire progression. Reports and exact source hashes are in [the gauntlet ledger](orka-7l9-gauntlet-progress.md).
- In a clean five-seed first-boss pair, ten underprepared attempts reached Wishfire's 18-second gauge limit with all three Heroes alive and boss HP remaining; progressed level-5 attempts won. The reference supports the *shape* of this result, not the exact time or HP band.
- Five forced one-HP Stage 1-2 trials recorded an initial Hero KO, full-party restoration on the same stage and wave, then an enemy KO and one wave clear without event gaps or deadlocks. This proves the route for one post-recovery wave. It does not prove a 20-wave recovery endurance run.
- Rendered Wishfire recovery and boss frames are retained with their reports. Prior full suites passed on exact main and candidate checkpoints. Source changes after those checkpoints still require current-head validation.

## Saved plan for a later build session

1. Freeze the reference at this conclusion. Use the observed survival-versus-boss-DPS pattern as the early-game target. Keep unknown values unknown. Do not resume the StoneAge grind merely to fit a numeric formula.
2. Verify the candidate at its final clean SHA with the same active HeroProgress and instance-key gear inputs. Retain five-seed, 20-wave zero-KO checks for starter and modestly progressed parties, both with and without Kaja. Report per-Hero start/min/end HP, physical and magic incoming hits, burst, effective healing by source, first KO and wave timing. If a case regresses, change the smallest source-owned combat rule supported by the trace, then repeat the matched run.
3. Retain the five-seed living-party boss-timeout versus progressed-win pair. Add a later-stage pair only with a declared Wishfire fixture; label it synthetic rather than borrowing an unseen StoneAge level. Keep special-dungeon pressure out of the ordinary boss target.
4. Extend forced-KO recovery through repeated productive farming. Confirm full restore, same stage/wave progress, no hidden HP debt, no softlock, and an explicit bound on later clears. Preserve the player guide's same-stage rule unless the owner separately changes it.
5. Review the final diff against current `main`, rerun focused and integration validation on the final source, inspect player-facing combat and recovery frames, obtain an independent fresh-context critic, and record a rollback checkpoint. Merge only after the repository's Integration Ready gate passes.

The owner requested documentation and a saved plan only at this checkpoint. No Wishfire code changes or validation runs were made for this conclusion.
