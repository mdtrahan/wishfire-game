# Combat Speed Terminology

This glossary separates current Speed terms from legacy or compatibility names. It preserves gameplay behavior and does not authorize initiative, balance, or stat formula changes.

## Current Terms

| Term | Meaning |
| --- | --- |
| `SPD` / Speed | Base combat Speed on hero and enemy stat records. |
| effective Speed | Runtime Speed after current buffs/debuffs, read through `GetEffectiveStat(ctx, actor, 'SPD')`. |
| party Speed buff | Hero-side modifier stored in `PartyBuff_SPD`, applied by `Party_SPD_UP`. |
| enemy Speed debuff | Enemy-side modifier stored in `EnemyDebuffs[uid].SPD`. |
| visible turn order | QA-facing order shown from round groups, `TurnOrderArray`, or living actors. |

## Legacy Or Compatibility Terms

| Term | Current status |
| --- | --- |
| `SpeedDoubleRatio` | Legacy state field. Current double-attack and extra-turn logic must not read it. |
| `TryGrantSpeedExtraTurn` | Compatibility alias for `TryGrantConfiguredExtraTurn`; current configured follow-up behavior is skill-driven, not an automatic Speed-ratio system. |
| Drain Speed slow rationale | Historical retirement rationale only. Current normal combat uses effective Speed interleaving; Drain remains retired as a product decision, not as current team-turn evidence. |
| fixture `SPD` values | Test data unless the fixture explicitly references canonical tuning data. Do not infer balance values from synthetic fixtures. |

## Usage Rule

Use "Speed" or `SPD` for stat data, "effective Speed" for derived runtime values, and "configured extra turn" or "follow-up attack" for the current extra-turn harness.

Avoid using old "speed double" language for current combat behavior.

## Validation

Terminology cleanup should keep behavior unchanged and can be verified with:

- `node --test tests/combatSpeedTerminologyContract.test.js`
- `node --test tests/drainSkillDraughtContract.test.js tests/extraTurnHarnessContract.test.js`
- `git diff --check`
