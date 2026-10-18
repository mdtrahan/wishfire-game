# Character identity: revised audit and staged plan

Planning only, ORKA-90u. No runtime implementation, save conversion, asset changes or merges are authorized by this document. Player-visible names, artwork, stats, skills, gear, earned progress, resources, HP/KO and combat behavior remain preservation requirements.

## Findings and scope

The diagnosis holds; the first proposal combined too many changes and underspecified save failure. This revision replaces it. The [reference and storage audit](character-identity-reference-audit.md) records exact paths, writer ownership and scan method against main `97f77474e44cb1f869ec2ecd227cc397fe4aac75`: **84 files with exact-case retired names, 92 case-insensitively, 31 using `heroInstanceKey`**. These are file counts, not 92 independent runtime defects.

A read-only probe using an in-memory storage mock confirmed that a version-99, level-42 snapshot becomes version 2, level 1 on restore when progress is dirty, without a storage error. `createHeroProgressStore` discards unrecognized versions; restore calls persistence, which can overwrite the original bytes. Both name-gated reaction skills, the unknown-hero cooldown fallback, puppet aliases and stranded ticket references are included in the audit.

The immediate ownership repair remains [ORKA-5af.3 as already approved](wishfire-progression-adaptations/hero-owner-decision.md). It does not absorb definition rekeying, saved party data, skins or support for additional owned copies.

## Required release order

Each row needs its own execution scope and validation against the main it will merge into. Proposed new beads are not implementation authorization. Enemy and appearance work may ship independently after save safety; they do not wait for one combined character rebuild.

| Order | Scoped work | Required evidence before the next dependent change |
| --- | --- | --- |
| 1 | New safety bead: fail closed on unknown/malformed hero save versions, without bumping a schema or rekeying a record. Distinguish absent storage from unsupported data. | Original bytes stay unchanged; normal, dirty, settlement and error paths cannot write a default store over unsupported data. Explicitly supported migrations remain explicit. |
| 2 | New writer-coordination bead: protect all participating hero/reward writers, developer level/reset/restore paths and ticket transactions; coordinate with equipment's existing lock. | Concurrent tabs and injected failures preserve complete writes; stale revision/epoch writes are refused. No private writer bypass or nested-lock deadlock. See the contract below. |
| 3 | Integrate ORKA-bhb's corrected candidate `f506f2d2` through its existing QA/Integration Ready gates. | CP and four-hero screen fixes are on main before ORKA-5af.3 implementation starts. A failed gate blocks that dependent repair; no silent copying from an unmerged lane. |
| 4 | Ship ORKA-5af.3 in its original permanent-owner/disposable-actor scope. A separate ticket-reconciliation bead uses its owner mapping to recover stranded wallets, pending spends and objective/reward references. | Menu and deployed base stats agree; temporary actors cannot create permanent heroes. Tickets remain spendable by their intended owner with no duplicate credits. Coordinate the two changes' save fields before conversion. |
| 5 | New hero definition-ID bead: replace name-derived identity using neutral immutable definition IDs and permanent owner references. Only this stage rekeys hero save identity. | Rename invariance, complete reference conversion and downgrade protection. Existing ownership/roster policy stays unchanged. |
| Independent | New enemy-ID bead: ID-based catalog, encounters, history and explicit delivery traits. Preserve authored catalog order. | Enumerate RNG input ordering and compare definition picks, draw counts, positions and rewards for pinned seeds. Convert only enemy-related persisted fields actually found by the audit; do not rewrite hero progression unnecessarily. |
| Independent | New appearance-ID bead: definition-to-appearance lookup for portraits, sprites, puppets and loader caches, initially pointing to existing files. | Same visible art/crops/scale and unchanged state. This stage adds no saved skin selection and does not rewrite hero progression. |
| Last | Separate cosmetic cleanup bead(s): rename obsolete symbols, files and current docs after ID consumers are proven. | Exact asset bytes and behavior retained; rerun the census case-insensitively. Keep semantic rekeying separate from cosmetic diffs. |

ORKA-5af.3 and the ticket companion must settle ownership before hero ID conversion. Enemy/appearance stages use explicit definition lookup tables as normal modular architecture. Those tables are not gameplay aliases from retired names to another saved hero. Each stage converts only its owned fields and publishes a supported format; releases need not wait for every row.

## Modular destination without added gameplay

A definition describes a character; a permanent owner records an individual player's hero; a battle-local entity references that owner. Display names, asset paths and temporary clone ordinals never identify permanent state. Hero-specific mechanics resolve through authored skill/effect IDs or traits. Unknown actors cannot inherit another hero's attack interval.

An enemy definition has an immutable ID, editable label/stats and explicit behavior traits. Appearance IDs resolve surface-specific art and animation data. Renaming or replacing those assets leaves identity intact. Reuse the existing content modules and loading services, with one owner per value; avoid a universal content framework.

**No saved party is introduced by this repair.** Combat currently derives party order from roster configuration and dev tooling. Preserve that exact resolution. A persistent party feature requires a separate proposal specifying its source and defaults. Likewise, current boot creates ownership for every definition: keep that rule during rekeying. Explicit acquisition, multiple separately owned copies, and saved skin choices require later product decisions. The destination separates definition from owner so those decisions do not require name-based identity again.

## Writer and cutover contract

All writers listed in the audit must participate. Use one documented cross-domain save coordinator/lock order for affected transactions; retained equipment locking must not be acquired recursively. Under the lock, reread storage, verify supported schema plus epoch/revision, stage the change, and acknowledge durable success before permanent state is reported as saved. Queue and flush lifecycle/settlement writes through that owner; prove failure and reload recovery. Storage events invalidate caches but do not serialize writes. QA reset/restore must use the same version-aware owner and treat backups as recovery inputs, never blindly copy old keys into an active generation.

A lock or epoch check protects only cooperating builds. An already running old tab ignores new rules. Schema-changing releases therefore use new versioned storage keys and readers that never implicitly import old keys again. Retain old bytes as a checkpoint. Quiesce supported clients and reconcile pending receipts before conversion; supported guard-aware tabs refuse stale writes and request reload. Changes made to an abandoned old generation are a detectable fork, never silently added or replayed.

An old same-origin QA reset can erase *all* namespaced keys, including new ones. Application locks cannot prevent arbitrary old JavaScript from doing this. Incompatible QA branches must use distinct origins/storage. Before same-origin cutover, unguarded tabs/builds must be closed and removed from the supported writer set. If this cannot be established, block cutover or specify storage isolation first. Do not claim a broadcast acknowledgment proves an unknown old tab is gone.

## Conversion and rollback rules

Before each schema-changing stage, publish its exact input/output schema, supported versions, key manifest and reconciliation rules. Checkpoint localStorage **and per-tab sessionStorage** from the audit, including missing-key markers, Gold/receipts, the conveyor clock and QA backup. Capture pending in-memory writes after writers are paused and flushed. Shared Gold appears in both equipment and reward receipts; do not sum replicated balances or re-credit acknowledged rewards. Resolve ticket duplicates using source receipts, not a blanket sum or maximum. Ambiguous credits stop conversion.

Preserve the approved hero reconciliation: greatest earned progression without duplicated EXP, reward watermarks, unique item ownership, the menu's equipped item, and HP/KO. Report conflicts with preservation requirements before applying them. Conversion cannot quietly repair balance or reroll inventory.

For a stage touching multiple persistent records, stage its complete affected set under new versioned keys, validate every reference, then commit a single active-generation marker. Unaffected domains retain their format and ownership. Every reader/writer of affected fields must use the marker; fence related session checkpoints with that generation. Interruptions before activation leave the original complete set active. Test missing components, quota/write failure and every commit boundary. This protocol is scoped to a stage, not an all-game rewrite.

**After activation, schema downgrade is prohibited.** Code rollback is allowed only to a build that supports the active schema. Otherwise ship a forward fix. Never restore the pre-conversion checkpoint over progress earned after cutover. Before activation, cancel by discarding the uncommitted stage while retaining original bytes. An older cached build must not read new payloads through an old key or overwrite the active generation. Incompatible old reset tools remain subject to the isolation requirement above.

Retired-name input maps are bounded migration tools. Remove them from active delivery after all supported saves have converted; retain original checkpoints as historical recovery evidence outside ordinary indexing. Definition registries remain. No indefinite retired-name gameplay resolver is part of the destination.

## Focused proof and stop conditions

Each bead tests its changed contract. Save safety covers downgrade, corruption, direct writers and two-tab races. Ownership covers repeat combat/reload, menu/deployed agreement and ticket reconciliation. Hero IDs cover renamed/duplicate labels without changing owners or the existing acquisition rule. Enemy IDs cover deterministic ordering explicitly. Appearances cover unchanged visuals and a test-only art substitution. Cosmetic cleanup proves asset hashes and reference removal separately.

The existing equipment tests remain regression checks where a touched consumer needs them; this plan adds no equipment algorithm work or new CP acceptance scope. Compare existing player controls and exact saves before/after each stage. Source-matched screenshots are required for changed presentation paths. Preserve the current JS/Rust simulation boundary and app.js orchestration-only rule.

Stop conversion on an unguarded writer, ambiguous owner/credit, incomplete save set, incompatible rollback build or unexplained player-visible difference. Implementation begins only after its bead records exact scope and dependencies. This revision contains audit evidence and a plan; it does not implement any of these protections or certify merge readiness.
