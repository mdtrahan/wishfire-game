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
| `backup/ORKA-p3rw-pre-refresh-abe40e0` @ `abe40e061a` | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `backup/ORKA-rrxj.18-pre-rebase-449541b` @ `449541b91d` | 436/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `backup/ORKA-rrxj.19-pre-metadata-refresh-3f3c7a5` @ `3f3c7a5232` | 434/2 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `backup/ORKA-yib8.1.2-pre-rebase-d7ba52d` @ `d7ba52dbff` | 467/15 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `backup/map-integration-premerge-20260703-202359` @ `ef1f146812` | 421/8 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-1uo-runa-flow` @ `0956777b73` | 190/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-304-low-health-hero-strip` @ `339ac08fe8` | 246/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-49k.8-hero-card-fan` @ `503417961c` | 316/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-49k.9-preserve-bottom-navigation` @ `5aa346efb4` | 313/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-4k5-astral-flow-config` @ `2c9a03605c` | 362/4 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-4o4-dev-panel-actions-top` @ `8fb2a92d95` | 345/8 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-52q-last-enemy-scheduler` @ `da023965d8` | 251/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-5af.7-sequential-equip` @ `1efb593a48` | 2/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-5f3-ui-presentation-lock` @ `0d8acb48a8` | 345/12 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-5nl-enemy-stream` @ `2ea43bc3e2` | 172/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-658-hero-durability` @ `3349a8e852` | 239/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-6ei.1-local-first-governance` @ `0769e5b8f5` | 354/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-6ei.6-offline-bundle` @ `2c58751eec` | 247/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-6ei.7-offline-atomic-build` @ `a290eb7181` | 195/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-6fw-deterministic-enemy-behavior` @ `eecec0fbc5` | 403/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-6mf-ponytail-dead-artifacts` @ `b6083328a2` | 345/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-7p7-illustrated-combat-vfx` @ `9085933f70` | 175/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-7tr2-asset-audit-historical` @ `515b9ca7df` | 421/19 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-8os-storage-retirement` @ `468bfa3de9` | 171/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-8ww8-destiny-heal-bloom` @ `88bcce1714` | 421/26 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-8ww8-destiny-heal-bloom-clean` @ `208a2ed058` | 402/2 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-99o-autoplay-map-guard` @ `2071d986d2` | 345/7 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-9c7u-dynamic-speed-turn-system-checkpoint` @ `f772fedbcd` | 421/20 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-ark-bulk-worktree-consolidation` @ `08baeef3ce` | 168/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-bpkv-open-design-workflow` @ `99bcdbc050` | 421/7 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-dxrq-narrative-framework` @ `e95873eefe` | 421/9 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-dzp-central-beads-backup` @ `9746e19790` | 166/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-eht-manual-selector-drift` @ `6699dba152` | 363/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-eih7-browser-policy-routing` @ `410c46acf5` | 421/25 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-gsa-role-targeting` @ `dd044c3719` | 245/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-iqg1-arcane-pulse-split` @ `4168b35d11` | 430/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-iy4-personal-af` @ `77a8d1fe02` | 244/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-k34f-dynamic-initiative-human-gameplay-validation` @ `97f2559ba9` | 421/24 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-kgu-autocombat-stage-loop` @ `10d12cb719` | 173/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-krv-faze-floats` @ `5e4192a62e` | 188/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-lmn-portrait-3d-navigation-mvp` @ `969f6285fd` | 363/20 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-lmn.1-5x-globe-phase-1` @ `d6af6d2ed8` | 363/22 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-lmn.2-dense-temperate-forest` @ `cd50f8625a` | 363/24 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-lmn.3-skyline-camera` @ `cd50f8625a` | 363/24 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-myz-compact-viewport-containment` @ `630ab6224a` | 345/5 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-n765-dynamic-initiative-live-authority-experiment` @ `1d7c9361c2` | 421/27 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-n7r-main-consolidation` @ `7f13bf82a6` | 3/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-nnsg-enemy-selector-sync` @ `d5c69ecc90` | 467/8 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-nss-active-party-draw-pool` @ `2319741b1a` | 354/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-p11-realtime-role-combat` @ `4ab4953423` | 147/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-pl6-storage-hygiene` @ `989de03a40` | 172/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-pv4-endless-combat` @ `bb698c17ac` | 240/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-qge-superseded-ancestor` @ `2801cf6b94` | 169/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-rrxj.13-chain-strike-i` @ `95fc19e0c1` | 467/9 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-rrxj.18-remove-dead-skill-stubs` @ `4520b3dde5` | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-rrxj.20-force-draw-skill-exhaustion` @ `69d1c82ad7` | 412/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-sdi7-dynamic-initiative-runtime-shadow-adapter` @ `1a7207e942` | 421/21 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-t3r-arcane-pulse-anchor` @ `732aa33009` | 187/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-t6s-remove-legacy-combat-backdrop` @ `dcd214b4ef` | 345/6 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-w4ct-default-speed-based-initiative` @ `2479c3dad3` | 421/31 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-w4ct-default-speed-based-initiative-clean` @ `604a175be1` | 402/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-wr8-four-character-narrative` @ `4e031ca180` | 421/17 | active | legacy | dialogue delta only | old runtime and unrelated map ancestry | port remaining line; retain history and skill edit | authorized for dialogue |
| `bead/ORKA-xnv.25-cot-prototype` @ `c178de9ed0` | 6/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-yib8.1-hotspot-decomposition-plan` @ `3ff1cd6bd9` | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-yib8.1.2-long-string-hotspots` @ `d7ba52dbff` | 467/15 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-yib8.1.3-simulation-shadow-audit` @ `4a56f65a64` | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-yib8.10-retrieval-index-hygiene` @ `821872354c` | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-yib8.11-beads-backup-warning` @ `7036f0f8ce` | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-yib8.4-legacy-scaffold-review` @ `db7ef65129` | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-yib8.5-mirror-ownership` @ `f87389bc03` | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-yib8.6-fallow-entrypoints` @ `1e4e2730e3` | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-yib8.7-initiative-guards-import` @ `0a46450ee4` | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-yib8.8-npm-test-baseline-status` @ `ad557353b6` | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-yib8.9-stale-path-classification` @ `ca2d781ffc` | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-yie.1-level-up-buff-contract` @ `a16fe70897` | 309/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-yie.2-deterministic-buff-offers` @ `d3cf43bc52` | 306/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-yie.3-ctb-level-up-queue` @ `d8a0340871` | 304/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-yie.4-qa-archetype-mechanics` @ `e7a948175b` | 256/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-yie.5-final-buff-pool` @ `f2d0d60945` | 252/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-ymk.1-cp-combat-foundation` @ `0972ac2c07` | 226/4 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `bead/ORKA-ymk.2-session-buff-queue` @ `43ea539a77` | 200/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-ymk.6-baseline-integration` @ `7023cba1a3` | 225/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-ymk.7-autocombat-gate-balance` @ `a2f30fec92` | 196/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-ymk.8-destiny-autocombat` @ `9f445b640f` | 192/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `bead/ORKA-zvq1-power-amp-baseline` @ `e08aa53c8a` | 434/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex-preserve-root-dirt-20260811` @ `2c9a03605c` | 362/4 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/ORKA-0ln-lamp` @ `2b127fb2eb` | 146/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-0vd-vfx-reference` @ `5f48703b0e` | 155/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-1dh-small-moat` @ `44b65df21f` | 26/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-1n4-forward-rock` @ `61916c1122` | 38/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-1uv-team-review` @ `c663719f18` | 6/2 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/ORKA-21o-enemy-fade` @ `d668045316` | 41/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-27g-cloud-migration` @ `5e930d10b1` | 7/2 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/ORKA-29q-storage-reduction` @ `30dc1724b9` | 156/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-2c2-hero-redesign` @ `fa96540534` | 16/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-2ea-attack-study` @ `5f48703b0e` | 155/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-2jf-enemy-motion` @ `ffefee4803` | 87/4 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/ORKA-3qz-upgrade-review` @ `2e52015049` | 18/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-42t-browser-policy` @ `9fbb7e9889` | 163/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-42t-canonical-root` @ `9839e0d08e` | 160/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-42t-current-only` @ `c4595f40c2` | 165/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-42t-reference-fix` @ `bcf0a90af6` | 164/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-49k.1-combat-party-init` @ `5a4ed8498b` | 331/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-49k.2-individual-survival` @ `b852cf3973` | 330/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-49k.3-hero-hp-authority` @ `bff8da252f` | 329/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-49k.4-hero-commands` @ `7578dbb6cb` | 327/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-49k.5-full-recovery` @ `bae2ac3413` | 326/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-49k.6-actor-healing` @ `d17fec6be3` | 325/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-49k.7-astral-spending` @ `8d2293c634` | 323/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-4ah-enemy-motion` @ `3eed07d112` | 87/6 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/ORKA-4my-runa-lizardo` @ `8c45439092` | 87/3 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/ORKA-4z6-pack-huddle` @ `e444ce0246` | 45/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/ORKA-5af.1-lamp-upgrades` @ `da20e242fb` | 143/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-5af.10-lamp-arrow-tips` @ `d3a5bdc622` | 125/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-5af.11-stat-height` @ `80e609822d` | 124/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-5af.12-rarity-band` @ `94a8a5f7bf` | 123/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-5af.13-stat-alignment` @ `1ecf915cf6` | 122/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-5af.14-gear-centering` @ `aeb7ec9c33` | 120/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-5af.15-selection-pulse` @ `d4a5365d21` | 119/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-5af.16-paid-lamp-stages` @ `b36d301a42` | 117/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-5af.17-settled-gear-midpoint` @ `8ef6ac7964` | 115/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-5af.18-progression-loop` @ `0a24c72974` | 114/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-5af.2-lamp-guidance` @ `ad7f1f918c` | 141/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-5af.3-hero-owner` @ `fff2322cd9` | 8/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-5af.4-reference` @ `2cca836fc6` | 138/6 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/ORKA-5af.5-lamp-comparison` @ `68398f7ae8` | 132/2 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/ORKA-5af.6-progression-proof` @ `6939781773` | 136/13 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/ORKA-5af.7-auto-cp` @ `6108f09202` | 128/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-5af.8-lamp-presentation` @ `b718960187` | 127/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-5af.9-lamp-cache-redesign` @ `a11d5b7327` | 126/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-5fr-recovery-reroll` @ `2ff2123d24` | 19/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-6mu-nearby-enemy-engagement` @ `11ef3b89c3` | 32/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-6vn-lamp-curves` @ `63c1603e25` | 29/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-764-initial-roam` @ `625c404f72` | 23/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-7yv-boss-progress` @ `404cdc4502` | 48/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/ORKA-aee-pack-count` @ `678d5211f5` | 45/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-ah1-djinn-marid-source` @ `c6e7d22097` | 87/3 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/ORKA-alk-attack-baselines` @ `9031b41b2b` | 113/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-aoq-story-entry` @ `b17a6fdd36` | 337/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-auw-pack-progress` @ `57002cbe2b` | 37/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-bnw-cp-refresh` @ `4338182db5` | 14/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-bps-preserve-boss-progress` @ `b3c33c7ba5` | 34/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-bxd-map-layers` @ `5d5a51c139` | 334/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-cgx-pack-spacing` @ `63ee421695` | 25/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-cmd-elemental-vfx` @ `9fbb7e9889` | 163/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-co0-combat-assembly` @ `c725d9edc4` | 65/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-cuc-lamp` @ `4b2ea70b36` | 0/0 | active | active | yes, after validation | uncommitted timing candidate | validate assembled candidate | authorized |
| `codex/ORKA-cvm-speaker-dimming` @ `818cc1fc06` | 333/0 | needs-owner-decision | legacy | committed tip already integrated | preserved residual changes | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-dwa-boss-fallback` @ `84db8abf0b` | 43/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-dwy-checkpoint-audit` @ `bd3c81d70e` | 10/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-eib-enemy-sources` @ `a04c5bdd89` | 87/2 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/ORKA-fc9-boss-surrender` @ `e045d527c6` | 20/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-h7t-combat-sprite-composer` @ `2c9a03605c` | 362/4 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/ORKA-hdi-fara-lead` @ `141f28ff2f` | 15/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-hr4-enemy-source-batch` @ `2ad525f6c9` | 87/2 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/ORKA-hvq-hero-skill-model` @ `fa96540534` | 16/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-ia2-historical-detached` @ `de306fb267` | 170/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-k2k-final-motion` @ `3eed07d112` | 87/6 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/ORKA-kk4-moving-arena` @ `5d674b0c76` | 77/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-kq1-hondo-kaja-puppets` @ `f229c70465` | 50/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-ltq-clip-retention` @ `a2489adf11` | 71/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-lvd-contact-motion` @ `38f355d147` | 17/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-m35-lamp-auto-lifecycle` @ `cbdbcf7982` | 21/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-m44-highorc-source` @ `c5db10092e` | 87/4 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/ORKA-mea-lamp-auto-equip` @ `74c40651fb` | 35/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-n3s-token-efficiency` @ `d5c1fa3725` | 174/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-nst-actor-continuity` @ `4b2ea70b36` | 0/0 | closed | closed | already integrated | closed bead; evidence files remain | preserve checkout | cleanup deferred |
| `codex/ORKA-ood-conditional-skills` @ `c3c48ce2b8` | 112/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-p3s-boss-reach` @ `99cc58a564` | 49/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-qt3-storage-guards` @ `c178de9ed0` | 6/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-rff-squad-recovery` @ `71093453db` | 39/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-rro-skill-cues` @ `523a312317` | 68/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-t1m-chibi-puppets` @ `670236ab7b` | 87/1 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/ORKA-tff-recovery-spawn-moat` @ `cdca03bd78` | 33/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-tnl-roaming-solos` @ `7d2ef42edd` | 30/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-uun-soft-wanderers` @ `d3ee66300e` | 24/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-vns-manual-boss-retry` @ `8c3c45535e` | 28/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-xdd-hondo-kaja-source` @ `0a86d73b76` | 87/11 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/ORKA-xrc-hero-vfx` @ `4cde45aec0` | 42/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-xx0-hero-gear-labels` @ `166e0ed791` | 27/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-y37-roaming-arena` @ `aa2fde930b` | 51/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-ydo-gauntlet-baseline` @ `2429777f55` | 90/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-ydo-root-preserved` @ `5f48703b0e` | 155/0 | closed | delete-candidate | committed tip already integrated | tip reachable from main | retain indexed source/evidence | only for reactivation or cleanup |
| `codex/ORKA-z2o-smashgrow-case-study` @ `98b8ff1078` | 339/2 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `codex/orka-7l9-combat-survivability` @ `84510b5ae6` | 2/106 | active | closed | via integration successor | 84510b5a retained by af83312f | retain source checkout | no |
| `codex/orka-7l9-integration` @ `af83312fd1` | 0/108 | complete | complete | yes | recorded current-main Integration Ready PASS | merge in consolidation | authorized |
| `codex/publish-orka-main-sync-20260620` @ `c77553f2bc` | 467/14 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `main` @ `4b2ea70b36` | 0/0 | active | active | target | preserved overlapping edits | reconcile after checkpoint | authorized |
| `preserve/ORKA-xnv.26-bag-source` @ `d66df02089` | 1042/51 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `quarantine/ORKA-rrxj.16-magic-fruit-maxhp-stale` @ `08c1e9c160` | 467/5 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |
| `quarantine/ORKA-yib8.1.1-appjs-orchestrator-divergent` @ `b65301f37f` | 487/17 | unknown | legacy | unconfirmed | divergent historical or authoring lane; current acceptance unverified | retain checkpoint and ref; scoped review before reactivation | required before gameplay merge |

## Registered worktrees at initial checkpoint

26 worktrees: 4 clean, 22 dirty. Consolidation checkout added after initial inventory. No removals.

| Branch | Worktree | Dirty status entries | Checkpoint |
|---|---|---:|---|
| `main` @ `4b2ea70b36` | `/Users/Mace/Codex-Orka` | 18 | `00` |
| `bead/ORKA-n7r-main-consolidation` @ `7f13bf82a6` | `/private/tmp/bead-ORKA-n7r-main-consolidation` | 3 | `01` |
| detached | `/private/tmp/orka-7l9-unchanged-baseline` | 0 | `02` |
| `codex/ORKA-nst-actor-continuity` @ `4b2ea70b36` | `/private/tmp/wishfire-ORKA-nst` | 4 | `03` |
| detached | `/private/tmp/wishfire-ORKA-nst-integration-main` | 0 | `04` |
| `codex/orka-7l9-integration` @ `af83312fd1` | `/Users/Mace/.codex/worktrees/orka-7l9-integration/Codex-Orka` | 0 | `05` |
| `codex/orka-7l9-combat-survivability` @ `84510b5ae6` | `/Users/Mace/.codex/worktrees/orka-7l9-survivability/Codex-Orka` | 0 | `06` |
| `codex/ORKA-cmd-elemental-vfx` @ `9fbb7e9889` | `/Users/Mace/.codex/worktrees/orka-cmd-elemental-vfx/Codex-Orka` | 1 | `07` |
| `codex/ORKA-1uv-team-review` @ `c663719f18` | `/Users/Mace/.codex/worktrees/orka-combat-team-ORKA-1uv/ORKA-1uv-sol` | 1 | `08` |
| `bead/ORKA-xnv.25-cot-prototype` @ `c178de9ed0` | `/Users/Mace/.codex/worktrees/orka-combat-team-ORKA-1uv/ORKA-xnv.25-cot-prototype` | 1 | `09` |
| `codex/ORKA-h7t-combat-sprite-composer` @ `2c9a03605c` | `/Users/Mace/.codex/worktrees/orka-h7t-combat-sprite-composer/Codex-Orka` | 8 | `10` |
| `bead/ORKA-5af.7-sequential-equip` @ `1efb593a48` | `/Users/Mace/.t3/worktrees/Codex-Orka/bead-ORKA-5af.7-sequential-equip` | 2 | `11` |
| `codex/ORKA-0ln-lamp` @ `2b127fb2eb` | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-0ln-lamp` | 78 | `12` |
| `codex/ORKA-0vd-vfx-reference` @ `5f48703b0e` | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-0vd-vfx-reference` | 2 | `13` |
| `codex/ORKA-2ea-attack-study` @ `5f48703b0e` | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-2ea-attack-study` | 2 | `14` |
| `codex/ORKA-49k.7-astral-spending` @ `8d2293c634` | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-49k.7-astral-spending` | 60 | `15` |
| `bead/ORKA-49k.8-hero-card-fan` @ `503417961c` | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-49k.8-hero-card-fan` | 30 | `16` |
| `bead/ORKA-4k5-astral-flow-config` @ `2c9a03605c` | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-4k5-astral-flow-config` | 3 | `17` |
| `codex/ORKA-5af.18-progression-loop` @ `0a24c72974` | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-5af.18-progression-loop` | 5 | `18` |
| `codex/ORKA-cuc-lamp` @ `4b2ea70b36` | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-cuc-lamp` | 13 | `19` |
| `codex/ORKA-cvm-speaker-dimming` @ `818cc1fc06` | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-cvm-speaker-dimming` | 7 | `20` |
| `codex/ORKA-k2k-final-motion` @ `3eed07d112` | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-k2k-final-motion` | 486 | `21` |
| `codex/ORKA-m44-highorc-source` @ `c5db10092e` | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-m44-highorc-source` | 100 | `22` |
| `bead/ORKA-p11-realtime-role-combat` @ `4ab4953423` | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-p11-realtime-role-combat` | 154 | `23` |
| `bead/ORKA-wr8-four-character-narrative` @ `4e031ca180` | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-wr8-four-character-narrative` | 1 | `24` |
| `codex/ORKA-xdd-hondo-kaja-source` @ `0a86d73b76` | `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-xdd-hondo-kaja-source` | 166 | `25` |

## Validation and final state

Local main contains code checkpoint `3c2364db`, including validated combat successor `af83312f`, the lamp timing candidate and the remaining dialogue correction. Integration used a clean checkout and a fast-forward. Root returned to main; its original local Beads metadata was restored. No branches/worktrees were removed and no remote push or deployment occurred.

Recovery verified: 26 worktrees, 37,520 archived entries; all regular-file SHA-256 values and link targets checked. Git bundle verification confirms complete history. Original root tracked work is also reachable through `checkpoint/ORKA-7v6-root-dirty`; base rollback is `checkpoint/ORKA-7v6-main-4b2ea70b`.

Validation on code checkpoint `3c2364db`:

- Required lamp hook: 3/3 scenarios passed, including four-phone lifecycle and pause/reload checks. Log `output/qa/ORKA-7v6/orka-7v6-commit-retry.log`; detailed browser artifacts remain in the consolidation checkout under `test-results/orka-7v6-hook/`.
- Complete remaining sweep: 1,253 passed; nine setup failures were seven offline tests lacking an available esbuild path and two file-level imports lacking sparse-excluded committed fixtures. The three already-passed lamp scenarios were deliberately skipped in this sweep.
- Offline follow-up: all seven tests passed using existing root esbuild. The two fixture-dependent files then passed all 29 actual cases after their committed sample data was materialized. No game source changed for these follow-ups. Combined coverage: 1,292 passing tests; no unresolved failure. Logs `orka-7v6-committed-suite.log`, `orka-7v6-environment-rerun.log`, `orka-7v6-fixtures-rerun.log` under `output/qa/ORKA-7v6/`.
- Post-merge root smoke: 64/64 passed. `git diff 3c2364db main -- web-runner src Scripts rust tools tests` is empty, so final audit wording does not alter tested source.
- Natural in-app preview: entered through START, observed combat, opened the cache, explicitly activated Auto-Equip, observed disposal review, and returned to combat. No warning/error console entries. Evidence `output/qa/ORKA-7v6/bag-after-auto-equip.png`. This validates the exercised flow; Chapter 2 boss balance was not re-measured in this consolidation.
- The first overlapping browser runs were stopped after timing failures. Isolated required hook checks subsequently passed without source changes. The source-cleanliness assertion passed after the runtime commit.

`origin` was fetched; `origin/main` remained `1efb593a`. The local source is ready for a separately authorized push. Recovery archives and untracked local research/art remain local and preserved; they are not included in a main-only push.

## Integration debt limits

One recorded Integration Ready successor. The 76 divergent refs have not all been retested or evaluated for semantic/patch equivalence. Mechanical/semantic conflict totals and age averages remain unknown. Contained tips with dirty checkouts are protected.


## Root reconciliation

The old clear-localStorage test is preserved in the recovery tag/archive, superseded by the integrated isolated-context contract. Attacker-name diagnostics are retained alongside the stricter positive-damage filter. The root-only AGENTS pointer to the untracked historical research directory is preserved in recovery; the portable owning policy and full lane index are committed under governance instead. No local research files were deleted.
