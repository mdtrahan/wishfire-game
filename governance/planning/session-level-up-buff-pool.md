# Wishfire Session Level-Up Buff Pool

## Status and ownership

This is the Phase 5 production reference for the universal adventure-session
buff pool. The runtime source of truth is
[`src/core/sessionLevelBuffCatalog.mjs`](../../src/core/sessionLevelBuffCatalog.mjs).
The offer and replacement rules remain owned by
[`src/core/sessionLevelBuffOffers.mjs`](../../src/core/sessionLevelBuffOffers.mjs).

- **INTENDED:** every level-up presents three cards from one selected tier;
  the selected card belongs to the leveling hero for the current adventure.
- **OBSERVED:** the catalog contains 48 unique cards, twelve in each tier;
  focused runtime tests cover offer health, ownership, replacement, and
  automatic combat resolution.
- **UNTESTED:** long-run pick rates, encounter balance, and player preference
  still need live playtesting.

## Complete card list

The Roman numeral in a name marks a staged upgrade. Behavior upgrades require
the previous stage owned by the same hero and replace that stage. Staged stat
cards can be selected directly at their tier and replace any lower stage when
the hero already owns one. A direct stat or bargain card has no prerequisite.

### Tier 1

| ID | Name | Kind | Player-facing effect | Stage rule |
| --- | --- | --- | --- | --- |
| `spectral_orb_1` | Spectral Orb | behavior | Every 3 completed basics: 4 magic damage | grant |
| `inner_flow_1` | Inner Flow | behavior | 15%: heal 5% Max HP | grant |
| `venom_sigil_1` | Venom Sigil | behavior | 20%: Venom for 3 damage, 2 turns | grant |
| `mirage_chain_1` | Mirage Chain | behavior | 25%: bounce for 50% damage | grant |
| `glass_reprisal_1` | Glass Reprisal | behavior | 20%: counter for 40% ATK, heal 3% Max HP | grant |
| `brass_ward_1` | Brass Ward | behavior | Start battle with a 25% Max HP shield | grant |
| `dune_edge_1` | Dune Edge | stat | ATK +10% | direct stat grant |
| `astral_reservoir_1` | Astral Reservoir | stat | MATK +10% | direct stat grant |
| `sandstone_guard_1` | Sandstone Guard | stat | DEF +10% | direct stat grant |
| `desert_step_1` | Desert Step | stat | Speed +10% | direct stat grant |
| `well_of_life_1` | Well of Life | stat | Max HP +20% | direct stat grant |
| `sun_debt_1` | Sun Debt | bargain | ATK +15%, Max HP -10% | direct bargain |

### Tier 2

| ID | Name | Kind | Player-facing effect | Stage rule |
| --- | --- | --- | --- | --- |
| `spectral_orb_2` | Spectral Orb II | behavior | Every 2 completed basics: 6 magic damage | requires/replaces stage 1 |
| `inner_flow_2` | Inner Flow II | behavior | 25%: heal 6% Max HP | requires/replaces stage 1 |
| `venom_sigil_2` | Venom Sigil II | behavior | 30%: Venom for 4 damage, 2 turns | requires/replaces stage 1 |
| `mirage_chain_2` | Mirage Chain II | behavior | 35%: bounce for 60% damage | requires/replaces stage 1 |
| `glass_reprisal_2` | Glass Reprisal II | behavior | 30%: counter for 50% ATK, heal 4% Max HP | requires/replaces stage 1 |
| `brass_ward_2` | Brass Ward II | behavior | Start battle with a 35% Max HP shield | requires/replaces stage 1 |
| `dune_edge_2` | Dune Edge II | stat | ATK +18% | direct staged stat; replaces lower |
| `astral_reservoir_2` | Astral Reservoir II | stat | MATK +18% | direct staged stat; replaces lower |
| `sandstone_guard_2` | Sandstone Guard II | stat | DEF +18% | direct staged stat; replaces lower |
| `desert_step_2` | Desert Step II | stat | Speed +16% | direct staged stat; replaces lower |
| `oasis_mirror_2` | Oasis Mirror | stat | RES +18% | direct stat grant |
| `glass_debt_2` | Glass Debt | bargain | MATK +24%, RES -14% | direct bargain |

### Tier 3

| ID | Name | Kind | Player-facing effect | Stage rule |
| --- | --- | --- | --- | --- |
| `spectral_orb_3` | Spectral Orb III | behavior | Every 2 completed basics: 10 magic damage | requires/replaces stage 2 |
| `inner_flow_3` | Inner Flow III | behavior | 35%: heal 8% Max HP | requires/replaces stage 2 |
| `venom_sigil_3` | Venom Sigil III | behavior | 40%: Venom for 5 damage, 3 turns | requires/replaces stage 2 |
| `mirage_chain_3` | Mirage Chain III | behavior | 45%: bounce for 75% damage | requires/replaces stage 2 |
| `glass_reprisal_3` | Glass Reprisal III | behavior | 40%: counter for 65% ATK, heal 5% Max HP | requires/replaces stage 2 |
| `brass_ward_3` | Brass Ward III | behavior | Start battle with a 50% Max HP shield | requires/replaces stage 2 |
| `dune_edge_3` | Dune Edge III | stat | ATK +28% | direct staged stat; replaces lower |
| `astral_reservoir_3` | Astral Reservoir III | stat | MATK +28% | direct staged stat; replaces lower |
| `sandstone_guard_3` | Sandstone Guard III | stat | DEF +28% | direct staged stat; replaces lower |
| `desert_step_3` | Desert Step III | stat | Speed +24% | direct staged stat; replaces lower |
| `well_of_life_3` | Well of Life: Deep | stat | Max HP +30% | direct stat grant |
| `star_debt_3` | Star Debt | bargain | ATK +36%, Max HP -20% | direct bargain |

### Tier 4

| ID | Name | Kind | Player-facing effect | Stage rule |
| --- | --- | --- | --- | --- |
| `spectral_orb_4` | Spectral Orb IV | behavior | Every completed basic: 12 magic damage | requires/replaces stage 3 |
| `inner_flow_4` | Inner Flow IV | behavior | 45%: heal 10% Max HP | requires/replaces stage 3 |
| `venom_sigil_4` | Venom Sigil IV | behavior | 50%: Venom for 7 damage, 3 turns | requires/replaces stage 3 |
| `mirage_chain_4` | Mirage Chain IV | behavior | 55%: bounce for 90% damage | requires/replaces stage 3 |
| `glass_reprisal_4` | Glass Reprisal IV | behavior | 50%: counter for 80% ATK, heal 6% Max HP | requires/replaces stage 3 |
| `brass_ward_4` | Brass Ward IV | behavior | Start battle with a 65% Max HP shield | requires/replaces stage 3 |
| `dune_edge_4` | Dune Edge IV | stat | ATK +40% | direct staged stat; replaces lower |
| `astral_reservoir_4` | Astral Reservoir IV | stat | MATK +40% | direct staged stat; replaces lower |
| `sandstone_guard_4` | Sandstone Guard IV | stat | DEF +40% | direct staged stat; replaces lower |
| `desert_step_4` | Desert Step IV | stat | Speed +35% | direct staged stat; replaces lower |
| `oasis_mirror_4` | Oasis Mirror: Crown | stat | RES +40% | direct stat grant |
| `last_wish_4` | Last Wish | bargain | MATK +50%, RES -25% | direct bargain |

## Runtime contract

All cards use `lane: shared_card`, `lifetime: session`, and shared session
ownership. The selected hero is the only reader of that hero's active stage
state. A stage replacement leaves one active formula for the effect family.
Stat multipliers combine as a product across distinct active effect families;
`max_hp` changes the maximum and clamps current HP. MATK maps to the existing
MAG combat stat and Speed maps to the existing SPD status surface.

Behavior cards resolve from existing native seams. Spectral Orb emits a fixed
magic packet after its completed-basic cadence. Inner Flow heals its owner.
Venom Sigil applies the existing DOT state with the displayed Venom payload;
it does not require a Mark or Weaken condition. Mirage Chain resolves one
distinct secondary enemy when one exists. Glass Reprisal is one counter package
per incoming damage package and its generated hit cannot trigger session
buffs. Brass Ward applies the established battle-start barrier presentation.

Generated behavior effects carry `allowGenerated: false`,
`excludeSelfGenerated: true`, `procDepthCap: 0`, and no spawned entities.
Counter cards declare `maxPerDamagePackage: 1`. These limits preserve native
hero delivery and keep automatic effects out of a recursive action loop.

Every tier has six behavior or upgrade records and six fallback records. A
fresh hero has at least six eligible stat or bargain fallbacks in each tier;
after a fallback is owned, the remaining same-tier fallbacks still keep a
three-card offer. If a hero has exhausted the tier, the deterministic offer
builder tries the next tier rather than fabricating a card or mixing tiers.

Magic Fruit remains a story or NPC event reward and is absent from this pool.
The pool contains no combat action card, SP or energy cost, Tempo label,
cooldown, new resource, manual target, or legacy draw rule.

## Deterministic validation

`tests/sessionLevelUpBuffPoolContract.test.mjs` verifies the count and tier
shape, universal ownership, stage prerequisites, replacement, direct stat
eligibility, three-card offer health, visible numeric copy, and proc limits.
`tools/export_session_level_up_buff_contract.mjs` maps the canonical catalog
to the documented snake-case card contract. Run it with the validator as:

```bash
node tools/export_session_level_up_buff_contract.mjs /private/tmp/orka-session-level-up-buff-contract.json
python3 /Users/Mace/.codex/skills/validate-card-skills/scripts/validate_card_skills.py /private/tmp/orka-session-level-up-buff-contract.json --format json
```

The deterministic card-contract result for the Phase 5 catalog is `PASS`.
Browser proof of the complete queue and responsive presentation remains in
Phase 6.
