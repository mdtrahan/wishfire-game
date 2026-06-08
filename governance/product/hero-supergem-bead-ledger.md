# Hero Supergem Bead Ledger

Purpose: keep implemented or active hero-specific supergem behavior tied to Beads so runtime fixes do not drift into unrelated hero skills.

Native hero-skill backlog beads are intentionally out of scope for this ledger unless a supergem bead explicitly depends on them.

| Hero | Bead | Status at inspection | Intended behavior | Runtime ownership |
| --- | --- | --- | --- | --- |
| Falie | `ORKA-f8i1.1`, `ORKA-rrxj.8` | `ORKA-rrxj.8` in progress | Red supergem during Falie's active turn creates party tempHP shield at 18% of `PartyMaxHP`. While the ward is active, Falie's ordinary red single-target attack sustains it by +18% of `PartyMaxHP`; Falie red supergem sustains it by +36%. The ward caps at `PartyMaxHP`. If enemy damage breaks it, ordinary red attacks cannot recreate it; a red supergem must renew it. Enemy damage consumes `PartyTempHPShield` before true party/hero HP. Party HP bar renders a right-edge light-blue `#6CCBEE` shield segment up to the full bar. Non-Falie red supergems keep the normal red single-target cluster attack. | `web-runner/systems/superGemRuntime.js`, mirrored `ExecuteSkill`/`ApplyDamageToTarget`/`ApplyPartyDamage` in `web-runner/modules/functionBank.js` and `Scripts/functionBank.js`, PartyHP bar rendering in `web-runner/systems/renderRuntime.js`, `tests/falieRedSuperGemBufferShieldContract.test.js`. |
| Huun | `ORKA-f8i1.2` | in progress after QA regression reopen | Yellow supergem during Huun's active turn converts current banked gold plus consumed yellow board value into Goldstrike. Rolls 0-50 deal base damage to one enemy, 51-99 deal base x3 to one enemy, exact 100 deals 100 damage to all enemies. Non-Huun yellow supergems keep ordinary gold collection. | `web-runner/systems/superGemRuntime.js`, `tests/huunYellowSuperGemGoldstrikeContract.test.js`. |
| Kojonn | `ORKA-8hqv`, `ORKA-zy2o` | green supergem route retired by `ORKA-zy2o`; `ORKA-8hqv` should not infer active green-supergem behavior | Green supergems no longer spawn or activate. Stale green supergem state fails closed without arming AOE or Faze. Kojonn's Faze remains a skill path, not a green gem or green supergem trigger. | `web-runner/src/core/superGemRules.mjs`, `web-runner/systems/superGemRuntime.js`, `tests/kojonnSuperGemBlightContract.test.js`, `tests/greenGemRemovalContract.test.js`. |
| Runa | none found for hero-specific supergem behavior | no implemented or active hero-specific supergem bead found during this pass | No current Runa-specific supergem behavior should be inferred from Falie/Huun/Kojonn repairs. | none for this surface. |

Checked Beads: `ORKA-f8i1`, `ORKA-f8i1.1`, `ORKA-f8i1.2`, `ORKA-8hqv`, `ORKA-zy2o`, `ORKA-rrxj`, `ORKA-rrxj.6`, `ORKA-rrxj.8`.

Scope note: `ORKA-rrxj.6` is a blocked/mis-scoped Falie Ward Bash native-skill bead. It is not the Falie red-supergem tempHP shield owner.
