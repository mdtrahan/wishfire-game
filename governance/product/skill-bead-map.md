# Skill Bead Map

Parent epic: `ORKA-rrxj`

Doc sources:
- `/Users/Mace/Codex-Orka/governance/product/hero-and-party-skills.md`
- `/Users/Mace/Codex-Orka/governance/product/vault-progression.md`
- `/Users/Mace/Codex-Orka/governance/product/hero-and-party-skill-pseudocode.md`

Purpose: map existing visible skill beads to the new canonical hero, party, and Vault/relic skill IDs before creating individual implementation beads.

## Skill Bead Acceptance

Every hero or party skill implementation bead must start from a clear skill definition before runtime edits:

- canonical skill ID and owner
- trigger and eligibility rules
- roll chance, if chance-based
- payload result
- debug counters and side-panel readout
- Browser/AutoPlay proof path

Each bead should add or update focused contracts at the activation, eligibility, roll, and payload seams before implementation. Dev-panel controls may assign, activate, clear, or configure QA state; side-panel readouts should remain informational and must not mutate skill state.

## Existing Bead Mapping

| Bead | Existing title | Canonical target | Recommendation |
| --- | --- | --- | --- |
| `ORKA-ivcq` | `[SKILL] KOJONN - Lock` | `kojonn_lock` | Keep as the Kojonn Lock implementation bead, but update acceptance to depend on session draw/proc helpers and require dev-panel QA. |
| `ORKA-elqq` | `[SKILL] KOJONN - Lift` | `kojonn_lift` | Keep as the Kojonn Lift implementation bead, with session-only activation and dev-panel proc test coverage. |
| `ORKA-h5k4` | `[SKILL] KOJONN - Step` | `kojonn_step` | Keep, but treat as high-risk turn-order work and sequence after simpler payloads. |
| `ORKA-uo0j` | `[SKILL] KOJONN - Elevate` | `kojonn_elevate` | Keep, but sequence late because amp escalation compounds with Astral Flow and power-amp state. |
| `ORKA-8jr6` | `[SKILL] KOJONN - Weaken` | `party_weaken` | Rename or replace. Canon now defines Weaken as a party skill, not a Kojonn live draw skill. |
| `ORKA-2anc` | `[SKILL] KOJONN - Scrolls` | `vault_scrolls` | Move out of live hero-skill fanout. Canon maps Scrolls to Vault/relic passive progression. |
| `ORKA-nwyi` | `[SKILL] KOJONN - Exchange` | `vault_exchange` | Move out of live hero-skill fanout. Canon maps Exchange to Vault/relic passive progression. |
| `ORKA-rrxj.4` | `[FEAT] Vault relic passive state foundation` | Vault/relic foundation | Keep as the required foundation before individual Vault/relic passive beads. |

No existing visible bead should be reused for Falie, Huun, or Runa live draw payloads without renaming and scope correction.

## Missing Hero Skill Beads

Create one QA-controlled bead each for:

| Hero | Canonical skill IDs |
| --- | --- |
| Falie | `falie_ward_bash`, `falie_cover_block`, `falie_reprisal_bounce`, `falie_phalanx` |
| Huun | `huun_bell`, `huun_glare`, `huun_trinity`, `huun_growth` |
| Runa | `runa_aura_totem_blast`, `runa_aura_totem_burn`, `runa_invert`, `runa_intensify` |
| Kojonn | Existing beads cover `kojonn_lock`, `kojonn_lift`, `kojonn_step`, `kojonn_elevate` after scope correction. |

Recommended first payload bead: `falie_ward_bash`.

Reason: it is low risk, has a simple on-defend/counterattack shape, and is a good end-to-end proof for session-selected skill activation plus proc tracing before higher-risk turn, amp, totem, or resource loops.

## Missing Party Skill Beads

Create one QA-controlled bead each for:

`party_fresh_start`, `party_second_chance`, `party_momentum`, `party_guard_rail`, `party_blue_spark`, `party_destiny`, `party_hot_streak`, `party_last_push`, `party_chain_pop`.

`party_weaken` can reuse `ORKA-8jr6` only if that bead is renamed and rewritten away from Kojonn ownership.

## Vault And Relic Beads

Do not implement Vault/relic passives as live draw skill cards. Use `ORKA-rrxj.4` first, then create one bead per passive or tightly coupled passive family.

Global Vault skills needing future beads:

`vault_crusade`, `vault_protect`, `vault_shell`, `vault_formless`, `vault_rabbithole`, `vault_consume`, `vault_inspire`, `vault_scrolls`, `vault_scout`, `vault_steal`, `vault_ignore`, `vault_insight`, `vault_lucky`, `vault_exchange`, `vault_lucky_break`, `vault_clean_slate`.

Runa totem progression lanes needing future relic beads:

`totem_damage_up`, `totem_duration_up`, `totem_hp_up`, `detonation_charge_gain_up`, `detonation_burst_up`, `totem_summon_chance_up`, `totem_expiry_burst_up`, `totem_death_burst_retention_up`.

## Rename And Duplicate Notes

- Use canonical `Ward Bash`; do not create or keep a separate `Shield Bash` implementation bead unless it is explicitly retired as an alias.
- Use canonical `Rabbithole`; do not create `RabbityHole`.
- Existing legacy runtime traits such as Falie enmity targeting, Runa magic resistance mitigation, and Huun execution loot bonus are class/trait behavior, not canonical live-draw skill payloads.
- Every new hero skill, party skill, Vault skill, or relic passive still needs its own bead for QA control unless it is explicitly scoped as a shared foundation bead.
