# Beads to GitHub Visibility Dry Run

Generated: `2026-06-08T15:12:46Z`

Beads remains source of truth. This report proposes GitHub Issues, Project rows, and draft PR review packets for team visibility only.

## Summary

- Visible non-closed Beads: `99`
- Draft PR candidates: `4`
- Review-packet PR candidates: `32`
- Issue/Project-only candidates: `63`

## Status Counts

| Status | Count |
| --- | --- |
| blocked | 19 |
| deferred | 1 |
| in_progress | 2 |
| open | 76 |
| recovery | 1 |

## GitHub Surface Counts

| Surface | Count |
| --- | --- |
| draft_pr | 4 |
| issue_project | 63 |
| review_packet_pr | 32 |

## Proposed First Batch

| Bead | Status | Priority | Surface | Branch Or Artifact | GitHub Title |
| --- | --- | --- | --- | --- | --- |
| ORKA-7ff6 | in_progress | P1 | draft_pr | bead/ORKA-7ff6-github-visibility-export | ORKA-7ff6: [TASK] Export Beads to GitHub visibility surfaces |
| ORKA-zy2o | in_progress | P1 | draft_pr | bead/ORKA-zy2o-remove-green-gems | ORKA-zy2o: [TASK] Remove green gems and green super gems safely |
| ORKA-v4mh | open | P1 | draft_pr | bead/ORKA-v4mh-simulation-core-contract | ORKA-v4mh: [MIGRATION] SimulationCore Rust/JS contract and fixture strategy |
| ORKA-idfa | open | P2 | draft_pr | bead/ORKA-idfa-appjs-offload | ORKA-idfa: App shell cleanup after render extraction |
| ORKA-iz4q | recovery | P1 | review_packet_pr | governance/bead-reviews/ORKA-iz4q.md | ORKA-iz4q: [RECOVERY] Verify recent merged beads in isolated worktree before safe merge |
| ORKA-03d | blocked | P1 | review_packet_pr | governance/bead-reviews/ORKA-03d.md | ORKA-03d: [BUG] REM-2026-001 Harness boot remediation |
| ORKA-39i0 | blocked | P1 | review_packet_pr | governance/bead-reviews/ORKA-39i0.md | ORKA-39i0: [BUG] Turn loop regression after status-effect presentation edits |
| ORKA-6opp | blocked | P1 | review_packet_pr | governance/bead-reviews/ORKA-6opp.md | ORKA-6opp: [FEAT] Hero-specific red single-target attack presentation variants |
| ORKA-macy | blocked | P1 | review_packet_pr | governance/bead-reviews/ORKA-macy.md | ORKA-macy: [QA] Multipass blue gem frequency before 150 energy depletion |
| ORKA-tk9 | blocked | P1 | review_packet_pr | governance/bead-reviews/ORKA-tk9.md | ORKA-tk9: [FEAT] TASK-010 Tower war-beacon map loop |
| ORKA-b2c | blocked | P2 | review_packet_pr | governance/bead-reviews/ORKA-b2c.md | ORKA-b2c: [REF] TASK-006 Transition-depth suspend/resume validation |
| ORKA-e67 | blocked | P2 | review_packet_pr | governance/bead-reviews/ORKA-e67.md | ORKA-e67: [STUB] Enemy-death loot fly-up visual hook (art pending) |

## Branch Overlap Risks

| Bead | Branch | Overlaps With | Shared File Count |
| --- | --- | --- | --- |
| ORKA-zy2o | bead/ORKA-zy2o-remove-green-gems | ORKA-c1h0, ORKA-c6zn, ORKA-idfa, ORKA-rrxj.9 | 15 |
| ORKA-idfa | bead/ORKA-idfa-appjs-offload | ORKA-c1h0, ORKA-rrxj.9, ORKA-zy2o | 1 |

## All Visible Beads

| Bead | Status | Priority | Type | Surface | Branch | Blockers | Blocks | GitHub Title |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ORKA-7ff6 | in_progress | P1 | task | draft_pr | bead/ORKA-7ff6-github-visibility-export |  |  | ORKA-7ff6: [TASK] Export Beads to GitHub visibility surfaces |
| ORKA-zy2o | in_progress | P1 | task | draft_pr | bead/ORKA-zy2o-remove-green-gems |  | ORKA-8hqv | ORKA-zy2o: [TASK] Remove green gems and green super gems safely |
| ORKA-0h6k | open | P1 | bug | review_packet_pr |  |  |  | ORKA-0h6k: [BUG] Faze skill-card damage floats stack per enemy |
| ORKA-v4mh | open | P1 | task | draft_pr | bead/ORKA-v4mh-simulation-core-contract |  |  | ORKA-v4mh: [MIGRATION] SimulationCore Rust/JS contract and fixture strategy |
| ORKA-8hqv | open | P1 | feature | review_packet_pr |  | ORKA-zps4, ORKA-zy2o |  | ORKA-8hqv: [FEAT] Kojonn green supergem Tainted Ground redesign |
| ORKA-zvq1 | open | P1 | bug | review_packet_pr |  |  |  | ORKA-zvq1: [BUG] Amped attacks do not always express increased damage |
| ORKA-9vi9 | open | P1 | feature | review_packet_pr |  |  | ORKA-p3rw, ORKA-uhha | ORKA-9vi9: [UI] Skill testing side-panel readout |
| ORKA-p3rw | open | P1 | bug | review_packet_pr |  | ORKA-9vi9 |  | ORKA-p3rw: [BUG] Clear Skills dev button does not visibly clear session skill state |
| ORKA-uhha | open | P1 | feature | review_packet_pr |  | ORKA-9vi9 |  | ORKA-uhha: [DEV] Skill ID harness and side-panel skill test readout |
| ORKA-rrxj.4 | open | P1 | feature | review_packet_pr |  | ORKA-rrxj, ORKA-rrxj.2 |  | ORKA-rrxj.4: [FEAT] Vault relic passive state foundation |
| ORKA-rrxj | open | P1 | epic | review_packet_pr |  |  | ORKA-rrxj.4 | ORKA-rrxj: [EPIC] Hero skills and Vault relic progression implementation plan |
| ORKA-iz4q | recovery | P1 | task | review_packet_pr |  |  |  | ORKA-iz4q: [RECOVERY] Verify recent merged beads in isolated worktree before safe merge |
| ORKA-macy | blocked | P1 | task | review_packet_pr |  |  |  | ORKA-macy: [QA] Multipass blue gem frequency before 150 energy depletion |
| ORKA-xjtv | open | P1 | task | review_packet_pr |  |  |  | ORKA-xjtv: [QA] Multipass blue gem frequency before 150 energy depletion |
| ORKA-39i0 | blocked | P1 | bug | review_packet_pr |  |  |  | ORKA-39i0: [BUG] Turn loop regression after status-effect presentation edits |
| ORKA-6opp | blocked | P1 | feature | review_packet_pr |  |  |  | ORKA-6opp: [FEAT] Hero-specific red single-target attack presentation variants |
| ORKA-n0g | deferred | P1 | feature | issue_project |  |  |  | ORKA-n0g: [FEAT] Layout scaffold: Relics gallery and combat-accessory hooks |
| ORKA-hvj | open | P1 | epic | review_packet_pr |  |  | ORKA-hvj.5 | ORKA-hvj: [EPIC] Skill-point progression system (no EXP levels) |
| ORKA-7c0 | open | P1 | epic | review_packet_pr |  |  | ORKA-7c0.2 | ORKA-7c0: [EPIC] Hero Screen Placeholder V1 (Figma-parity runtime UI) |
| ORKA-zih | open | P1 | epic | review_packet_pr |  |  |  | ORKA-zih: [EPIC] Hero Class Identity Restoration (traits + support/debuff reliability) |
| ORKA-03d | blocked | P1 | bug | review_packet_pr |  |  |  | ORKA-03d: [BUG] REM-2026-001 Harness boot remediation |
| ORKA-tk9 | blocked | P1 | feature | review_packet_pr |  | ORKA-a09 | ORKA-b2c, ORKA-sdn8 | ORKA-tk9: [FEAT] TASK-010 Tower war-beacon map loop |
| ORKA-sdn8 | open | P2 | feature | issue_project |  | ORKA-tk9 |  | ORKA-sdn8: [FEAT] Tower performance-grade reward chests |
| ORKA-myb3 | open | P2 | feature | issue_project |  |  |  | ORKA-myb3: [FEAT] Add periodic on-off effect capability to skills |
| ORKA-pktr | open | P2 | task | issue_project |  |  |  | ORKA-pktr: [TASK] Remove or retire the single-tap energy gem |
| ORKA-8ww8 | open | P2 | feature | issue_project |  |  |  | ORKA-8ww8: [POLISH] Destiny heal visual presentation |
| ORKA-idfa | open | P2 | task | draft_pr | bead/ORKA-idfa-appjs-offload |  |  | ORKA-idfa: App shell cleanup after render extraction |
| ORKA-euir | open | P2 | task | issue_project |  |  |  | ORKA-euir: Stabilize mapLayoutState access layer |
| ORKA-b0zs | open | P2 | task | issue_project |  |  |  | ORKA-b0zs: Temporarily disable rainbow super-gem generation |
| ORKA-ygz6 | open | P2 | task | issue_project |  |  |  | ORKA-ygz6: Diagnose jcodemunch token-savings gap in Codex-Orka |
| ORKA-ljm1 | open | P2 | task | issue_project |  |  |  | ORKA-ljm1: Remove super-gem blue outline border |
| ORKA-d9g.1 | open | P2 | feature | issue_project |  | ORKA-d9g |  | ORKA-d9g.1: [FEAT] Standalone party formation screen extracted from hero layout |
| ORKA-hvj.5.1 | open | P2 | task | issue_project |  | ORKA-hvj.5 | ORKA-hvj.5.2 | ORKA-hvj.5.1: [TASK] Westrom hero skill-card baseline + bounds contract |
| ORKA-hvj.5.2 | open | P2 | task | issue_project |  | ORKA-hvj.5, ORKA-hvj.5.1 |  | ORKA-hvj.5.2: [TASK] Hero skill-card source mapping + slot-8 placeholder policy |
| ORKA-2anc | open | P2 | feature | issue_project |  |  |  | ORKA-2anc: [SKILL] KOJONN - Scrolls |
| ORKA-8jr6 | open | P2 | feature | issue_project |  |  |  | ORKA-8jr6: [SKILL] KOJONN - Weaken |
| ORKA-elqq | open | P2 | feature | issue_project |  |  |  | ORKA-elqq: [SKILL] KOJONN - Lift |
| ORKA-h5k4 | open | P2 | feature | issue_project |  |  |  | ORKA-h5k4: [SKILL] KOJONN - Step |
| ORKA-ivcq | open | P2 | feature | issue_project |  |  |  | ORKA-ivcq: [SKILL] KOJONN - Lock |
| ORKA-nwyi | open | P2 | feature | issue_project |  |  |  | ORKA-nwyi: [SKILL] KOJONN - Exchange |
| ORKA-uo0j | open | P2 | feature | issue_project |  |  |  | ORKA-uo0j: [SKILL] KOJONN - Elevate |
| ORKA-z4fs | open | P2 | feature | issue_project |  |  |  | ORKA-z4fs: [SKILL] KOJONN - Lucky |
| ORKA-zwki | open | P2 | feature | issue_project |  |  |  | ORKA-zwki: [SKILL] RUNA - Inspire |
| ORKA-0uvk | open | P2 | feature | issue_project |  |  |  | ORKA-0uvk: [SKILL] HUUN - Steal |
| ORKA-as8q | open | P2 | feature | issue_project |  |  |  | ORKA-as8q: [SKILL] RUNA - Aura Burn Totem |
| ORKA-fs6j | open | P2 | feature | issue_project |  |  |  | ORKA-fs6j: [SKILL] HUUN - Glare |
| ORKA-gcij | open | P2 | feature | issue_project |  |  |  | ORKA-gcij: [SKILL] RUNA - Aura Blast Totem |
| ORKA-r8pf | open | P2 | feature | issue_project |  |  |  | ORKA-r8pf: [SKILL] RUNA - Insight |
| ORKA-u6gr | open | P2 | feature | issue_project |  |  |  | ORKA-u6gr: [SKILL] RUNA - Ignore |
| ORKA-u6m6 | open | P2 | feature | issue_project |  |  |  | ORKA-u6m6: [SKILL] RUNA - Invert |
| ORKA-xwvc | open | P2 | feature | issue_project |  |  |  | ORKA-xwvc: [SKILL] RUNA - Intensify |
| ORKA-y8ye | open | P2 | feature | issue_project |  |  |  | ORKA-y8ye: [SKILL] HUUN - Growth |
| ORKA-05x8 | open | P2 | feature | issue_project |  |  |  | ORKA-05x8: [SKILL] FALIE - Formless |
| ORKA-7oh3 | open | P2 | feature | issue_project |  |  |  | ORKA-7oh3: [SKILL] HUUN - Bell |
| ORKA-b96w | open | P2 | feature | issue_project |  |  |  | ORKA-b96w: [SKILL] HUUN - RabbityHole |
| ORKA-hkpx | open | P2 | feature | issue_project |  |  |  | ORKA-hkpx: [SKILL] FALIE - Phalanx |
| ORKA-j2d3 | open | P2 | feature | issue_project |  |  |  | ORKA-j2d3: [SKILL] FALIE - Protect |
| ORKA-nj24 | open | P2 | feature | issue_project |  |  |  | ORKA-nj24: [SKILL] HUUN - Siphon HoT |
| ORKA-xdwu | open | P2 | feature | issue_project |  |  |  | ORKA-xdwu: [SKILL] HUUN - Trinity |
| ORKA-xf1q | open | P2 | feature | issue_project |  |  |  | ORKA-xf1q: [SKILL] FALIE - Shell |
| ORKA-zhft | open | P2 | feature | issue_project |  |  |  | ORKA-zhft: [SKILL] HUUN - Scout |
| ORKA-0yzu | open | P2 | feature | issue_project |  |  |  | ORKA-0yzu: [SKILL] FALIE - Reprisal |
| ORKA-n064 | open | P2 | feature | issue_project |  |  |  | ORKA-n064: [SKILL] FALIE - Crusade |
| ORKA-wec6 | open | P2 | feature | issue_project |  |  |  | ORKA-wec6: [SKILL] FALIE - Block |
| ORKA-ysh3 | open | P2 | feature | issue_project |  |  |  | ORKA-ysh3: [SKILL] FALIE - Shield Bash |
| ORKA-hjrt | open | P2 | chore | issue_project |  |  |  | ORKA-hjrt: [CHORE] Audit workflow token drift and jcodemunch usage gaps |
| ORKA-4dpd | open | P2 | feature | issue_project |  |  |  | ORKA-4dpd: [FRAMEWORK] Static mission combat-power gate with soft odds bands and farm-efficiency hints |
| ORKA-v2s | open | P2 | feature | issue_project |  |  |  | ORKA-v2s: [FEAT] Lore-driven recruit discovery system instead of generic box gacha |
| ORKA-aye | open | P2 | feature | issue_project |  |  |  | ORKA-aye: [BACKLOG] Membership: Privilege Card |
| ORKA-dt7 | open | P2 | feature | issue_project |  |  |  | ORKA-dt7: [BACKLOG] Banner Offer: Flash Sale (1000% value) |
| ORKA-dxq | open | P2 | feature | issue_project |  |  |  | ORKA-dxq: [BACKLOG] Battle Pass: Talent Fund family |
| ORKA-pca | open | P2 | feature | issue_project |  |  |  | ORKA-pca: [BACKLOG] Banner Offer: Golden Piggy I |
| ORKA-yv1 | open | P2 | feature | issue_project |  |  |  | ORKA-yv1: [BACKLOG] Retention: 7 Days Check-In |
| ORKA-16n | open | P2 | feature | issue_project |  |  |  | ORKA-16n: [BACKLOG] Banner Offer: Lucky Koi shop |
| ORKA-4ov | open | P2 | feature | issue_project |  |  |  | ORKA-4ov: [BACKLOG] Core Events framework (Arena/Challenge/Dungeon) |
| ORKA-8jl | open | P2 | feature | issue_project |  |  |  | ORKA-8jl: [BACKLOG] Banner Offer: Daily Special shop |
| ORKA-gq3 | open | P2 | feature | issue_project |  |  |  | ORKA-gq3: [BACKLOG] Banner Offer: Dungeon Up Fund |
| ORKA-y5x | open | P2 | chore | issue_project |  |  |  | ORKA-y5x: [CHORE] Introduce agent coordination layer |
| ORKA-hvj.5 | open | P2 | feature | issue_project |  | ORKA-hvj, ORKA-hvj.1, ORKA-hvj.2, ORKA-hvj.3, ORKA-hvj.6 | ORKA-hvj.5.1, ORKA-hvj.5.2 | ORKA-hvj.5: [FEAT] Hero skill cards expansion (fixed scroll region bounds) |
| ORKA-2u0 | open | P2 | chore | issue_project |  |  |  | ORKA-2u0: [CHORE] Optimize hot-file scope hook runtime (enforce_hot_file_scope.sh) |
| ORKA-4c0 | open | P2 | task | issue_project |  | ORKA-1vf, ORKA-7c0.1, ORKA-7c0.2, ORKA-uc7 |  | ORKA-4c0: [TASK] Asset usage check for new hero-screen pack |
| ORKA-9ng | open | P2 | bug | issue_project |  |  |  | ORKA-9ng: [BUG] Layout transition exception handling + rollback |
| ORKA-p8t | open | P2 | bug | issue_project |  |  |  | ORKA-p8t: [BUG] Duplicate keyboard listener guard in gameLogic setup |
| ORKA-e67 | blocked | P2 | task | review_packet_pr |  |  |  | ORKA-e67: [STUB] Enemy-death loot fly-up visual hook (art pending) |
| ORKA-b2c | blocked | P2 | task | review_packet_pr |  | ORKA-tk9 |  | ORKA-b2c: [REF] TASK-006 Transition-depth suspend/resume validation |
| ORKA-nroi | open | P3 | feature | issue_project |  |  |  | ORKA-nroi: Wild Meter (Armed Color, Variable Reward System) |
| ORKA-6cfd | blocked | P3 | feature | review_packet_pr |  |  |  | ORKA-6cfd: [FEAT] Event booster catalog for temporary war-scenario accelerators |
| ORKA-9e0b | blocked | P3 | feature | review_packet_pr |  |  |  | ORKA-9e0b: [FEAT] Event reward tracks and premium acceleration framework |
| ORKA-qw2o | blocked | P3 | feature | review_packet_pr |  |  |  | ORKA-qw2o: [FEAT] Story trigger framework for node-based and non-node hero campaigns |
| ORKA-toxc | blocked | P3 | feature | review_packet_pr |  |  |  | ORKA-toxc: [FEAT] Flashback quest side-B access model for past hero events |
| ORKA-5fnb | blocked | P3 | feature | review_packet_pr |  |  |  | ORKA-5fnb: [FEAT] Spirit skill equipability and archetype compatibility contract |
| ORKA-arti | blocked | P3 | feature | review_packet_pr |  |  |  | ORKA-arti: [FEAT] Relic passive tier structure and Hall upgrade data model |
| ORKA-dbxf | blocked | P3 | feature | review_packet_pr |  |  |  | ORKA-dbxf: [FEAT] Weekly war event template library for hero campaigns |
| ORKA-mgpd | blocked | P3 | feature | review_packet_pr |  |  |  | ORKA-mgpd: [FEAT] Event hero participation modes runtime scaffold |
| ORKA-tpql | blocked | P3 | feature | review_packet_pr |  |  |  | ORKA-tpql: [FEAT] Hall of Heroes gallery layout and phylactery states |
| ORKA-0x85 | blocked | P3 | epic | review_packet_pr |  |  |  | ORKA-0x85: [EPIC] Hall of Heroes event system |
| ORKA-o2ww | blocked | P3 | feature | review_packet_pr |  |  |  | ORKA-o2ww: [FEAT] Hero legacy unlock state and Spirit grant contract |
| ORKA-3as | blocked | P3 | feature | review_packet_pr |  |  |  | ORKA-3as: [FEAT] Escort NPC party scaffold with variable hero count |
| ORKA-wc01 | open | P4 | feature | issue_project |  |  |  | ORKA-wc01: Manual UI design tweak mode |

## Data Safety

- GitHub-publishable artifacts include Bead IDs, titles, status, priority, type, labels, dependency links, branch names, and branch-overlap signals.
- GitHub-publishable artifacts omit Bead descriptions, acceptance criteria, comments, raw notes, changed-file paths, worktree paths, `.beads` backup data, credentials, local database internals, and Beads implementation files.
- Local filesystem paths in exported text are redacted to `[local-path]`.
