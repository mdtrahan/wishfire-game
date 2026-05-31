# Hero Supergem Bead Ledger

Purpose: keep implemented or active hero-specific supergem behavior tied to Beads so runtime fixes do not drift into unrelated hero skills.

Native hero-skill backlog beads are intentionally out of scope for this ledger unless a supergem bead explicitly depends on them.

| Hero | Bead | Status at inspection | Intended behavior | Runtime ownership |
| --- | --- | --- | --- | --- |
| Falie | `ORKA-f8i1.1`, `ORKA-rrxj.8` | `ORKA-rrxj.8` in progress | Red supergem during Falie's active turn creates party tempHP shield at 18% of `PartyMaxHP`. While the ward is active, Falie's ordinary red single-target attack sustains it by +18% of `PartyMaxHP`; Falie red supergem sustains it by +36%. The ward caps at `PartyMaxHP`. If enemy damage breaks it, ordinary red attacks cannot recreate it; a red supergem must renew it. Enemy damage consumes `PartyTempHPShield` before true party/hero HP. Party HP bar renders a right-edge light-blue `#6CCBEE` shield segment up to the full bar. Non-Falie red supergems keep the normal red single-target cluster attack. | `web-runner/systems/superGemRuntime.js`, mirrored `ExecuteSkill`/`ApplyDamageToTarget`/`ApplyPartyDamage` in `web-runner/modules/functionBank.js` and `Scripts/functionBank.js`, PartyHP bar rendering in `web-runner/systems/renderRuntime.js`, `tests/falieRedSuperGemBufferShieldContract.test.js`. |
| Huun | `ORKA-f8i1.2` | in progress after QA regression reopen | Yellow supergem during Huun's active turn converts current banked gold plus consumed yellow board value into Goldstrike. Rolls 0-50 deal base damage to one enemy, 51-99 deal base x3 to one enemy, exact 100 deals 100 damage to all enemies. Non-Huun yellow supergems keep ordinary gold collection. | `web-runner/systems/superGemRuntime.js`, `tests/huunYellowSuperGemGoldstrikeContract.test.js`. |
| Kojonn | `ORKA-8hqv` | open, paused during Falie stabilization | Green supergem creates Tainted Ground zones under enemy slots instead of clustered green AOE spam. Regular Kojonn green/Faze remains distinct from generic common AOE and keeps Blight semantics independent from supergem field ownership. | `web-runner/systems/superGemRuntime.js`, `web-runner/modules/functionBank.js`, `Scripts/functionBank.js`, Kojonn supergem/Faze contract tests. |
| Runa | none found for hero-specific supergem behavior | no implemented or active hero-specific supergem bead found during this pass | No current Runa-specific supergem behavior should be inferred from Falie/Huun/Kojonn repairs. | none for this surface. |

Checked Beads: `ORKA-f8i1`, `ORKA-f8i1.1`, `ORKA-f8i1.2`, `ORKA-8hqv`, `ORKA-rrxj`, `ORKA-rrxj.6`, `ORKA-rrxj.8`.

Scope note: `ORKA-rrxj.6` is a blocked/mis-scoped Falie Ward Bash native-skill bead. It is not the Falie red-supergem tempHP shield owner.
