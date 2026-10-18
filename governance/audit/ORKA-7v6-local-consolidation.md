# Local consolidation, ORKA-7v6

Owner authorized checkpointing all work, indexing older lanes, merging supported candidates, and folding in dialogue before remote push. No branch or checkout deletion is authorized by this report.

## Recovery

Rollback ref: `checkpoint/ORKA-7v6-main-4b2ea70b`.
Checkpoint root: `/Users/Mace/Codex-Orka/output/checkpoints/ORKA-7v6-20261017/`.
The all-ref Git bundle retains committed history. Each numbered worktree archive contains staged/unstaged binary patches and the current changed/untracked nonignored files, with SHA-256 records. Ignored evidence remains in its original checkout. These local archives are excluded from push; this index travels with main.

## Current merge plan

- ORKA-7l9: integrate clean `af83312f`, which records Integration Ready PASS against `4b2ea70b` (baseline 1192 passing; integrated 1284 passing; UI lock 120/120; lamp phone checks 3/3).
- ORKA-cuc: integrate checkpointed 13-file timing candidate on top, then rerun focused and final combined checks.
- ORKA-wr8: current dialogue already contains almost all branch revisions. Import only the remaining line 018 correction, retaining `combatHandoffStepId` and current runtime.
- Root edits: retain attacker-name diagnostics on the newer strict positive-damage event filter. The old localStorage-clear harness assertion is superseded by the integrated per-seed isolated-context contract, which expressly rejects global clearing; retain its original patch in recovery.
- Historical runtime, unsupported turns/SP/FLOW, prototype worlds, authoring experiments and unapproved source-art revisions stay indexed and checkpointed. They require scope-specific acceptance before a gameplay merge.

## Branch dispositions at initial checkpoint

Counts: 191 local branches; 115 tips contained in main; 76 divergent. Ahead counts describe commits, not patch novelty. Every row uses current disposition unknown unless containment or evidence establishes otherwise. Unconfirmed merge intent is held for scoped review; no speculative merge or deletion.

| Branch / bead | Behind / ahead | Current disposition | Recommended disposition | Merge intent | Blocking issue / reason | Next action | Owner decision |
|---|---:|---|---|---|---|---|---|
| backup/ORKA-p3rw-pre-refresh-abe40e0 | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| backup/ORKA-rrxj.18-pre-rebase-449541b | 436/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| backup/ORKA-rrxj.19-pre-metadata-refresh-3f3c7a5 | 434/2 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| backup/ORKA-yib8.1.2-pre-rebase-d7ba52d | 467/15 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| backup/map-integration-premerge-20260703-202359 | 421/8 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-1uo-runa-flow | 190/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-304-low-health-hero-strip | 246/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-49k.8-hero-card-fan | 316/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-49k.9-preserve-bottom-navigation | 313/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-4k5-astral-flow-config | 362/4 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-4o4-dev-panel-actions-top | 345/8 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-52q-last-enemy-scheduler | 251/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-5af.7-sequential-equip | 2/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-5f3-ui-presentation-lock | 345/12 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-5nl-enemy-stream | 172/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-658-hero-durability | 239/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-6ei.1-local-first-governance | 354/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-6ei.6-offline-bundle | 247/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-6ei.7-offline-atomic-build | 195/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-6fw-deterministic-enemy-behavior | 403/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-6mf-ponytail-dead-artifacts | 345/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-7p7-illustrated-combat-vfx | 175/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-7tr2-asset-audit-historical | 421/19 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-8os-storage-retirement | 171/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-8ww8-destiny-heal-bloom | 421/26 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-8ww8-destiny-heal-bloom-clean | 402/2 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-99o-autoplay-map-guard | 345/7 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-9c7u-dynamic-speed-turn-system-checkpoint | 421/20 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-ark-bulk-worktree-consolidation | 168/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-bpkv-open-design-workflow | 421/7 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-dxrq-narrative-framework | 421/9 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-dzp-central-beads-backup | 166/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-eht-manual-selector-drift | 363/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-eih7-browser-policy-routing | 421/25 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-gsa-role-targeting | 245/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-iqg1-arcane-pulse-split | 430/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-iy4-personal-af | 244/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-k34f-dynamic-initiative-human-gameplay-validation | 421/24 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-kgu-autocombat-stage-loop | 173/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-krv-faze-floats | 188/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-lmn-portrait-3d-navigation-mvp | 363/20 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-lmn.1-5x-globe-phase-1 | 363/22 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-lmn.2-dense-temperate-forest | 363/24 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-lmn.3-skyline-camera | 363/24 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-myz-compact-viewport-containment | 345/5 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-n765-dynamic-initiative-live-authority-experiment | 421/27 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-n7r-main-consolidation | 3/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-nnsg-enemy-selector-sync | 467/8 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-nss-active-party-draw-pool | 354/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-p11-realtime-role-combat | 147/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-pl6-storage-hygiene | 172/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-pv4-endless-combat | 240/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-qge-superseded-ancestor | 169/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-rrxj.13-chain-strike-i | 467/9 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-rrxj.18-remove-dead-skill-stubs | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-rrxj.20-force-draw-skill-exhaustion | 412/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-sdi7-dynamic-initiative-runtime-shadow-adapter | 421/21 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-t3r-arcane-pulse-anchor | 187/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-t6s-remove-legacy-combat-backdrop | 345/6 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-w4ct-default-speed-based-initiative | 421/31 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-w4ct-default-speed-based-initiative-clean | 402/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-wr8-four-character-narrative | 421/17 | active | legacy | dialogue delta only | old runtime and unrelated map ancestry | port remaining line; retain history and skill edit | authorized for dialogue |
| bead/ORKA-xnv.25-cot-prototype | 6/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-yib8.1-hotspot-decomposition-plan | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-yib8.1.2-long-string-hotspots | 467/15 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-yib8.1.3-simulation-shadow-audit | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-yib8.10-retrieval-index-hygiene | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-yib8.11-beads-backup-warning | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-yib8.4-legacy-scaffold-review | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-yib8.5-mirror-ownership | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-yib8.6-fallow-entrypoints | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-yib8.7-initiative-guards-import | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-yib8.8-npm-test-baseline-status | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-yib8.9-stale-path-classification | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-yie.1-level-up-buff-contract | 309/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-yie.2-deterministic-buff-offers | 306/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-yie.3-ctb-level-up-queue | 304/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-yie.4-qa-archetype-mechanics | 256/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-yie.5-final-buff-pool | 252/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-ymk.1-cp-combat-foundation | 226/4 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| bead/ORKA-ymk.2-session-buff-queue | 200/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-ymk.6-baseline-integration | 225/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-ymk.7-autocombat-gate-balance | 196/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-ymk.8-destiny-autocombat | 192/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| bead/ORKA-zvq1-power-amp-baseline | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex-preserve-root-dirt-20260811 | 362/4 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/ORKA-0ln-lamp | 146/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-0vd-vfx-reference | 155/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-1dh-small-moat | 26/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-1n4-forward-rock | 38/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-1uv-team-review | 6/2 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/ORKA-21o-enemy-fade | 41/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-27g-cloud-migration | 7/2 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/ORKA-29q-storage-reduction | 156/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-2c2-hero-redesign | 16/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-2ea-attack-study | 155/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-2jf-enemy-motion | 87/4 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/ORKA-3qz-upgrade-review | 18/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-42t-browser-policy | 163/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-42t-canonical-root | 160/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-42t-current-only | 165/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-42t-reference-fix | 164/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-49k.1-combat-party-init | 331/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-49k.2-individual-survival | 330/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-49k.3-hero-hp-authority | 329/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-49k.4-hero-commands | 327/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-49k.5-full-recovery | 326/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-49k.6-actor-healing | 325/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-49k.7-astral-spending | 323/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-4ah-enemy-motion | 87/6 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/ORKA-4my-runa-lizardo | 87/3 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/ORKA-4z6-pack-huddle | 45/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/ORKA-5af.1-lamp-upgrades | 143/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-5af.10-lamp-arrow-tips | 125/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-5af.11-stat-height | 124/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-5af.12-rarity-band | 123/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-5af.13-stat-alignment | 122/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-5af.14-gear-centering | 120/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-5af.15-selection-pulse | 119/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-5af.16-paid-lamp-stages | 117/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-5af.17-settled-gear-midpoint | 115/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-5af.18-progression-loop | 114/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-5af.2-lamp-guidance | 141/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-5af.3-hero-owner | 8/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-5af.4-reference | 138/6 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/ORKA-5af.5-lamp-comparison | 132/2 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/ORKA-5af.6-progression-proof | 136/13 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/ORKA-5af.7-auto-cp | 128/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-5af.8-lamp-presentation | 127/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-5af.9-lamp-cache-redesign | 126/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-5fr-recovery-reroll | 19/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-6mu-nearby-enemy-engagement | 32/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-6vn-lamp-curves | 29/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-764-initial-roam | 23/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-7yv-boss-progress | 48/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/ORKA-aee-pack-count | 45/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-ah1-djinn-marid-source | 87/3 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/ORKA-alk-attack-baselines | 113/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-aoq-story-entry | 337/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-auw-pack-progress | 37/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-bnw-cp-refresh | 14/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-bps-preserve-boss-progress | 34/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-bxd-map-layers | 334/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-cgx-pack-spacing | 25/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-cmd-elemental-vfx | 163/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-co0-combat-assembly | 65/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-cuc-lamp | 0/0 | active | active | yes, after validation | uncommitted timing candidate | validate assembled candidate | authorized |
| codex/ORKA-cvm-speaker-dimming | 333/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-dwa-boss-fallback | 43/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-dwy-checkpoint-audit | 10/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-eib-enemy-sources | 87/2 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/ORKA-fc9-boss-surrender | 20/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-h7t-combat-sprite-composer | 362/4 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/ORKA-hdi-fara-lead | 15/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-hr4-enemy-source-batch | 87/2 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/ORKA-hvq-hero-skill-model | 16/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-ia2-historical-detached | 170/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-k2k-final-motion | 87/6 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/ORKA-kk4-moving-arena | 77/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-kq1-hondo-kaja-puppets | 50/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-ltq-clip-retention | 71/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-lvd-contact-motion | 17/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-m35-lamp-auto-lifecycle | 21/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-m44-highorc-source | 87/4 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/ORKA-mea-lamp-auto-equip | 35/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-n3s-token-efficiency | 174/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-nst-actor-continuity | 0/0 | closed | closed | already integrated | closed bead; evidence files remain | preserve checkout | cleanup deferred |
| codex/ORKA-ood-conditional-skills | 112/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-p3s-boss-reach | 49/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-qt3-storage-guards | 6/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-rff-squad-recovery | 39/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-rro-skill-cues | 68/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-t1m-chibi-puppets | 87/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/ORKA-tff-recovery-spawn-moat | 33/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-tnl-roaming-solos | 30/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-uun-soft-wanderers | 24/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-vns-manual-boss-retry | 28/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-xdd-hondo-kaja-source | 87/11 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/ORKA-xrc-hero-vfx | 42/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-xx0-hero-gear-labels | 27/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-y37-roaming-arena | 51/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-ydo-gauntlet-baseline | 90/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-ydo-root-preserved | 155/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| codex/ORKA-z2o-smashgrow-case-study | 339/2 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| codex/orka-7l9-combat-survivability | 2/106 | active | closed | via integration successor | 84510b5a retained by af83312f | retain source checkout | no |
| codex/orka-7l9-integration | 0/108 | complete | complete | yes | recorded current-main Integration Ready PASS | merge in consolidation | authorized |
| codex/publish-orka-main-sync-20260620 | 467/14 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| main | 0/0 | active | active | target | preserved overlapping edits | reconcile after checkpoint | authorized |
| preserve/ORKA-xnv.26-bag-source | 1042/51 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| quarantine/ORKA-rrxj.16-magic-fruit-maxhp-stale | 467/5 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| quarantine/ORKA-yib8.1.1-appjs-orchestrator-divergent | 487/17 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |

## Registered worktrees at initial checkpoint

26 worktrees: 4 clean, 22 dirty. Consolidation checkout added after initial inventory. No removals.

| Branch | Worktree | Dirty status entries | Checkpoint |
|---|---|---:|---|
| main | `/Users/Mace/Codex-Orka` | 18 | `00` |
| bead/ORKA-n7r-main-consolidation | `/private/tmp/bead-ORKA-n7r-main-consolidation` | 3 | `01` |
| detached | `/private/tmp/orka-7l9-unchanged-baseline` | 0 | `02` |
| codex/ORKA-nst-actor-continuity | `/private/tmp/wishfire-ORKA-nst` | 4 | `03` |
| detached | `/private/tmp/wishfire-ORKA-nst-integration-main` | 0 | `04` |
| codex/orka-7l9-integration | `/Users/Mace/.codex/worktrees/orka-7l9-integration/Codex-Orka` | 0 | `05` |
| codex/orka-7l9-combat-survivability | `/Users/Mace/.codex/worktrees/orka-7l9-survivability/Codex-Orka` | 0 | `06` |
| codex/ORKA-cmd-elemental-vfx | `/Users/Mace/.codex/worktrees/orka-cmd-elemental-vfx/Codex-Orka` | 1 | `07` |
| codex/ORKA-1uv-team-review | `/Users/Mace/.codex/worktrees/orka-combat-team-ORKA-1uv/ORKA-1uv-sol` | 1 | `08` |
| bead/ORKA-xnv.25-cot-prototype | `/Users/Mace/.codex/worktrees/orka-combat-team-ORKA-1uv/ORKA-xnv.25-cot-prototype` | 1 | `09` |
| codex/ORKA-h7t-combat-sprite-composer | `/Users/Mace/.codex/worktrees/orka-h7t-combat-sprite-composer/Codex-Orka` | 8 | `10` |
| bead/ORKA-5af.7-sequential-equip | `/Users/Mace/.t3/worktrees/Codex-Orka/bead-ORKA-5af.7-sequential-equip` | 2 | `11` |
| codex/ORKA-0ln-lamp | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-0ln-lamp` | 78 | `12` |
| codex/ORKA-0vd-vfx-reference | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-0vd-vfx-reference` | 2 | `13` |
| codex/ORKA-2ea-attack-study | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-2ea-attack-study` | 2 | `14` |
| codex/ORKA-49k.7-astral-spending | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-49k.7-astral-spending` | 60 | `15` |
| bead/ORKA-49k.8-hero-card-fan | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-49k.8-hero-card-fan` | 30 | `16` |
| bead/ORKA-4k5-astral-flow-config | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-4k5-astral-flow-config` | 3 | `17` |
| codex/ORKA-5af.18-progression-loop | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-5af.18-progression-loop` | 5 | `18` |
| codex/ORKA-cuc-lamp | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-cuc-lamp` | 13 | `19` |
| codex/ORKA-cvm-speaker-dimming | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-cvm-speaker-dimming` | 7 | `20` |
| codex/ORKA-k2k-final-motion | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-k2k-final-motion` | 486 | `21` |
| codex/ORKA-m44-highorc-source | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-m44-highorc-source` | 100 | `22` |
| bead/ORKA-p11-realtime-role-combat | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-p11-realtime-role-combat` | 154 | `23` |
| bead/ORKA-wr8-four-character-narrative | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-wr8-four-character-narrative` | 1 | `24` |
| codex/ORKA-xdd-hondo-kaja-source | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-xdd-hondo-kaja-source` | 166 | `25` |

## Validation and final state

Pending final combined validation, checkpoint verification and local main fast-forward. Remote push pending.

## Integration debt limits

One recorded Integration Ready successor. The 76 divergent refs have not all been retested or evaluated for semantic/patch equivalence. Mechanical/semantic conflict totals and age averages remain unknown. Contained tips with dirty checkouts are protected.
