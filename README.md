# Turn-era VFX archive (2026-10-24)

Owner request: preserve all VFX from the deleted turn-based branches for later pruning. This commit lists every source branch tip as a parent, so the complete history of each is reachable from this one branch: `git diff $(git merge-base main <Tip>) <Tip>` reproduces that branch. `files/` holds the extracted VFX assets and VFX code that are absent from or differ from main.

| Source ref | Tip | Merge-base | VFX-related paths changed |
|---|---|---|---|
| archive/turn-era/backup/ORKA-p3rw-pre-refresh-abe40e0 | abe40e06 | d444b19b |  |
| archive/turn-era/backup/ORKA-rrxj.18-pre-rebase-449541b | 449541b9 | 5a67b692 |  |
| archive/turn-era/backup/ORKA-rrxj.18-pre-rebase-449541b-x | 4520b3dd | d444b19b |  |
| archive/turn-era/backup/ORKA-rrxj.19-pre-metadata-refresh-3f3c7a5 | 3f3c7a52 | d444b19b | web-runner/systems/astralFlowKoOrbPresentation.js web-runner/systems/renderRuntime.js  |
| archive/turn-era/bead/ORKA-4k5-astral-flow-config | 2c9a0360 | 1b309fb1 | web-runner/systems/renderRuntime.js  |
| archive/turn-era/bead/ORKA-4k5-astral-flow-config-x | 5e0a677a | 5e0a677a |  |
| archive/turn-era/bead/ORKA-6fw-deterministic-enemy-behavior | eecec0fb | 20712aa2 | src/core/enemySkillChoiceRules.mjs web-runner/src/core/enemySkillChoiceRules.mjs  |
| archive/turn-era/bead/ORKA-8ww8-destiny-heal-bloom | 208a2ed0 | 604a175b | web-runner/src/core/damageNumberAnimation.mjs web-runner/systems/renderRuntime.js  |
| archive/turn-era/bead/ORKA-8ww8-destiny-heal-bloom-clean | 208a2ed0 | 604a175b | web-runner/src/core/damageNumberAnimation.mjs web-runner/systems/renderRuntime.js  |
| archive/turn-era/bead/ORKA-8ww8-destiny-heal-bloom-clean-x | 88bcce17 | aaa2aa81 | governance/planning/effective-combat-stat-owner.md governance/product/retired-skills/drain.md web-runner/assets/images/generated/falie_ward_84x62.png web-runner/src/core/damageNumberAnimation.mjs web-runner/systems/renderMap.js web-runner/systems/renderRuntime.js web-runner/systems/surfaceRenderRouter.js  |
| archive/turn-era/bead/ORKA-8ww8-destiny-heal-bloom-x | 88bcce17 | aaa2aa81 | governance/planning/effective-combat-stat-owner.md governance/product/retired-skills/drain.md web-runner/assets/images/generated/falie_ward_84x62.png web-runner/src/core/damageNumberAnimation.mjs web-runner/systems/renderMap.js web-runner/systems/renderRuntime.js web-runner/systems/surfaceRenderRouter.js  |
| archive/turn-era/bead/ORKA-99o-autoplay-map-guard | 2071d986 | 5e0a677a | web-runner/src/core/damageNumberAnimation.mjs web-runner/systems/renderHarnessFallback.js web-runner/systems/renderRuntime.js web-runner/systems/surfaceRenderRouter.js  |
| archive/turn-era/bead/ORKA-9c7u-dynamic-speed-turn-system-checkpoint | f772fedb | aaa2aa81 | web-runner/assets/images/generated/falie_ward_84x62.png web-runner/systems/renderMap.js web-runner/systems/surfaceRenderRouter.js  |
| archive/turn-era/bead/ORKA-eht-manual-selector-drift | 6699dba1 | 29c8b397 |  |
| archive/turn-era/bead/ORKA-iqg1-arcane-pulse-split | 4168b35d | c5b843a9 | web-runner/src/core/damageNumberAnimation.mjs web-runner/systems/renderRuntime.js  |
| archive/turn-era/bead/ORKA-k34f-dynamic-initiative-human-gameplay-validation | 97f2559b | aaa2aa81 | web-runner/assets/images/generated/falie_ward_84x62.png web-runner/systems/renderMap.js web-runner/systems/surfaceRenderRouter.js  |
| archive/turn-era/bead/ORKA-n765-dynamic-initiative-live-authority-experiment | 1d7c9361 | aaa2aa81 | web-runner/assets/images/generated/falie_ward_84x62.png web-runner/systems/renderMap.js web-runner/systems/surfaceRenderRouter.js  |
| archive/turn-era/bead/ORKA-nnsg-enemy-selector-sync | d5c69ecc | 36f4e1a7 | web-runner/systems/renderRuntime.js  |
| archive/turn-era/bead/ORKA-nss-active-party-draw-pool | 2319741b | 200d21c2 | governance/product/hero-and-party-skills.md  |
| archive/turn-era/bead/ORKA-rrxj.13-chain-strike-i | 95fc19e0 | 36f4e1a7 | web-runner/assets/images/skill_chain_strike_arc_160x48.png web-runner/systems/renderHUD.js web-runner/systems/renderRuntime.js  |
| archive/turn-era/bead/ORKA-rrxj.18-remove-dead-skill-stubs | 449541b9 | 5a67b692 |  |
| archive/turn-era/bead/ORKA-rrxj.18-remove-dead-skill-stubs-x | 4520b3dd | d444b19b |  |
| archive/turn-era/bead/ORKA-rrxj.20-force-draw-skill-exhaustion | 69d1c82a | b9cd9d42 |  |
| archive/turn-era/bead/ORKA-sdi7-dynamic-initiative-runtime-shadow-adapter | 1a7207e9 | aaa2aa81 | web-runner/assets/images/generated/falie_ward_84x62.png web-runner/systems/renderMap.js web-runner/systems/surfaceRenderRouter.js  |
| archive/turn-era/bead/ORKA-t6s-remove-legacy-combat-backdrop | b9e0aaa2 | 5e0a677a | web-runner/src/core/damageNumberAnimation.mjs web-runner/systems/renderHarnessFallback.js web-runner/systems/renderRuntime.js web-runner/systems/surfaceRenderRouter.js  |
| archive/turn-era/bead/ORKA-t6s-remove-legacy-combat-backdrop-x | dcd214b4 | 5e0a677a | web-runner/src/core/damageNumberAnimation.mjs web-runner/systems/renderHarnessFallback.js web-runner/systems/renderRuntime.js web-runner/systems/surfaceRenderRouter.js  |
| archive/turn-era/bead/ORKA-w4ct-default-speed-based-initiative | 2479c3da | aaa2aa81 | web-runner/assets/images/generated/falie_ward_84x62.png web-runner/systems/renderMap.js web-runner/systems/surfaceRenderRouter.js  |
| archive/turn-era/bead/ORKA-yib8.7-initiative-guards-import | 0a46450e | d444b19b |  |
| archive/turn-era/bead/ORKA-zvq1-power-amp-baseline | e08aa53c | d444b19b |  |
| archive/turn-era/codex-preserve-root-dirt-20260811 | 2c9a0360 | 1b309fb1 | web-runner/systems/renderRuntime.js  |
| archive/turn-era/codex-preserve-root-dirt-20260811-x | 5e0a677a | 5e0a677a |  |
| archive/turn-era/codex/publish-orka-main-sync-20260620 | c77553f2 | 36f4e1a7 | web-runner/assets/images/skill_arcane_pulse_96x96.png web-runner/assets/images/skill_chain_strike_arc_160x48.png web-runner/systems/renderHUD.js web-runner/systems/renderRuntime.js  |
| archive/turn-era/quarantine/ORKA-rrxj.16-magic-fruit-maxhp-stale | 08c1e9c1 | 36f4e1a7 | web-runner/systems/renderRuntime.js  |
| origin/bead/ORKA-rrxj.19-death-orb-order | 83397edb | 83397edb |  |
| origin/bead/ORKA-w4ct-default-speed-based-initiative-clean | 604a175b | 604a175b |  |
| origin/codex/main-authority-20260708 | 65d86288 | 65d86288 |  |
| origin/bead/ORKA-d1k-combat-drift-recovery | e2a3b3c9 | e2a3b3c9 |  |

Lost before archiving: uncommitted Astral Flow KO-orb edits in the force-removed wt-ORKA-4k5 worktree (astralFlowKoOrbPresentation.js changes, astralFlowKoOrbPresentationConfig.js).
- files/Scripts/legacy
- files/web-runner/systems/astralFlowKoOrbPresentation.js
- files/web-runner/systems/renderSkillDraughtOverlay.js
- files/web-runner/assets/images/skill_arcane_pulse_96x96.png
- files/web-runner/assets/images/selector-animation
- files/web-runner/assets/images/heroselect-animation
- files/web-runner/assets/images/skill_chain_strike_arc_160x48.png
- files/web-runner/assets/images/h_selector-animation
- files/web-runner/src/core/damageNumberAnimation.mjs
- files/web-runner/assets/images/generated/falie_ward_84x62.png
