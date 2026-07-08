# Combat Stat Source Map

This map records where combat stats come from, where they are copied at runtime, and which values are derived. It is a source map only; it does not authorize gameplay, balance, or initiative changes.

## Quick Answers

| Question | Current answer |
| --- | --- |
| Where does Huun's Speed come from? | `web-runner/state/heroScreenConfig.js` defines `CANONICAL_HERO_ROSTER`; Huun has `SPD: 20`. |
| Where does Skeleton's Speed come from? | `web-runner/assets/enemies.json` is a column-oriented enemy table; the `SPD` row gives Skeleton `22`. |
| Where are hero stats copied for combat? | `web-runner/systems/combatSessionInitializer.js` copies selected hero roster stats into `state.entities[].stats`. |
| Where are enemy stats copied for combat? | `combatSessionInitializer` passes enemy row stats into `SpawnEnemy`; `web-runner/modules/functionBank.js` stores them on enemy `stats`. |
| Where is effective Speed calculated? | `GetEffectiveStat` in `web-runner/modules/functionBank.js`, with Rust SimulationCore ownership/shadow support. See `governance/planning/effective-combat-stat-owner.md`. |
| What modifies Speed? | Hero party Speed buff via `Party_SPD_UP`; enemy Speed debuff through the enemy debuff system. |
| Which systems consume effective Speed? | Turn roster, turn-order grouping, initiative preview paths, turn logs, and stat/QA readouts that call `GetEffectiveStat`. |

## Source Types

| Type | Owner | Examples | Notes |
| --- | --- | --- | --- |
| Canonical hero data | `web-runner/state/heroScreenConfig.js` | `CANONICAL_HERO_ROSTER`, `HERO_STAT_KEYS` | Base hero stats for selectable combat heroes. |
| Canonical enemy table | `web-runner/assets/enemies.json` | `name`, `HP`, `ATK`, `DEF`, `MAG`, `RES`, `SPD`, `EncounterCP` rows | The table is column-oriented, so human lookup is slower than for hero data. |
| Runtime stat copies | `state.entities` | hero and enemy `stats` objects | Runtime copies are created per combat session and should not be treated as canonical source data. |
| Derived values | `web-runner/modules/functionBank.js`, `rust/simulation_core/` | `GetEffectiveStat`, `effective_stat_value` | Effective stats apply current buffs/debuffs and clamp at zero. Owner boundary: `governance/planning/effective-combat-stat-owner.md`. |
| Legacy/mirror data | `Scripts/` mirrors and archived governance docs | mirrored function bank and older skill notes | Use only when validating parity or historical context. Do not treat as current product truth without live-code confirmation. |
| Test fixtures | `tests/` | scheduler, effective-stat, debuff, party-stat OSD fixtures | Fixtures prove contracts. Fixture stat values may be synthetic and are not canonical tuning data. |

## Stat Flow

1. Hero base stats start in `CANONICAL_HERO_ROSTER`.
2. Enemy base stats start in `web-runner/assets/enemies.json`.
3. Combat session initialization resets `state.entities`.
4. Selected heroes are copied into hero runtime entities with `stats.ATK`, `stats.DEF`, `stats.MAG`, `stats.RES`, and `stats.SPD`.
5. Selected enemies are copied through `SpawnEnemy` into enemy runtime entities with the same stat keys.
6. Effective stat consumers should call `GetEffectiveStat(ctx, actor, stat)`.
7. `GetEffectiveStat` calculates:
   - hero: base stat plus matching `PartyBuff_*`
   - enemy: base stat minus matching `EnemyDebuffs[uid][stat]`
   - all actors: clamp final value at zero
8. Rust SimulationCore mirrors the effective-stat projection through `effective_stat_value` and the `__ORKA_EFFECTIVE_STAT_OWNER__` hook when available.

## Mutation Points

| Mutation | Current owner | Effect |
| --- | --- | --- |
| Hero stat selection/copy | `combatSessionInitializer` and `devToolingRuntime` | Chooses configured heroes and copies canonical stats into runtime entities. |
| Enemy stat selection/copy | `combatSessionInitializer` and `SpawnEnemy` | Chooses encounter rows and copies enemy stats into runtime entities. |
| Hero Speed buff | `Party_SPD_UP` in `web-runner/modules/skillSheet.js` | Adds to `PartyBuff_SPD` up to `PartyBuffCap_SPD`. |
| Enemy Speed debuff | enemy debuff helpers in `functionBank.js` | Stores/decrements `EnemyDebuffs[uid].SPD` and associated turn counters/slots. |
| Effective stat projection | `GetEffectiveStat` and SimulationCore shadow/owner hook | Produces the derived value consumers should read. |

## Consumption Points

Effective Speed is used anywhere combat needs current turn-order input or visible stat reporting. The main current consumers are:

- `getInitiativeRoster` for actor Speed snapshots.
- `BuildRoundGroups` and turn-order projection helpers for current round/turn grouping.
- time-initiative preview and queue helpers when that path is active.
- `ProcessTurn` console turn logs.
- party stat OSD/readout surfaces for player/dev-visible hero stat reporting.

## Known Friction

- Hero stats are easy to inspect; enemy stats require understanding the column-oriented enemy JSON shape.
- Runtime copies look similar to canonical sources, but changing runtime entities is not the same as changing base tuning.
- Effective stat ownership crosses JavaScript runtime, Rust SimulationCore, shadow/owner hooks, and tests; see `governance/planning/effective-combat-stat-owner.md` for the named owner boundary.
- Some current tests use synthetic stat fixtures; do not infer tuning from those fixtures.
- Stale Speed terms are separated from current behavior in `governance/planning/combat-speed-terminology.md`.
- Initiative docs and live runtime path need a separate ownership clarification; see `ORKA-6ejk`.

## Validation

When changing combat stat ownership or documentation, verify the intended surface:

- docs-only map update: `git diff --check`
- effective-stat owner change: focused effective-stat ownership tests
- turn-order consumer change: focused scheduler/turn-order tests
- player-visible QA readout change: focused UI/devtool contract plus browser or local runtime proof
