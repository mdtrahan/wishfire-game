# Proposed character save contract

Planning only, ORKA-90u. Companion to the [execution plan](character-identity-rebuild.md) and [source/key audit](character-identity-reference-audit.md). These are proposed executable requirements, not implemented protections. Target one coordinated hero-identity conversion; original ORKA-5af.3 scope and any new migration scope must be recorded explicitly before code.

## 1. Load health and dependent play

Restore has two outcomes: ready with validated supported state, or blocked with original bytes intact. Only genuinely absent storage may create a fresh store. Validate existing top-level versions and nested `continuousStage.topologyVersion`, supported legacy forms, records and references before sanitizing factories can discard fields. Combat progression needs its own version gate; equipment validation must join the same readiness result.

When any required store is blocked, pause mutable gameplay before combat, reward settlement, lamp emission/collection/classification, auto/manual equip, dismantle, spending, objective creation/reassignment or automatic save writes. Do not render default level-1 heroes as the loaded account. Present a recoverable save-load error. Read-only diagnosis/export is permitted; normal developer level/preset/reset/import paths cannot clear the error or overwrite the originals. A destructive recovery reset would require a separate explicit action after a verified backup and is not a fallback.

Admission checks belong in the save owner and its APIs, including boot `ensureCombatObjective`, not only disabled UI buttons. A session with an unsupported hero save must leave hero, equipment, combat-progression, Gold and checkpoint keys byte-identical even when callers attempt lamp or developer actions. Healthy, supported sessions retain normal gameplay.

## 2. Writer ownership and lifecycle

Introduce one version-independent resource constant, proposed value `wishfire.save-writer`. Never derive the lock name from a save key. All supported domain writers and developer controls use that coordinator; no hardcoded v5/v6 lock literals remain. A new constant does not retroactively coordinate old tabs.

Proposed model: acquire an exclusive Web Lock **before** mutable restore/play and hold it for that tab's writer session. Other cooperating tabs cannot mutate; show save-in-use/reload status rather than simulate progression without saving. This is an explicit safety behavior for concurrent tabs, not a claim of unchanged multi-tab behavior. A tab must reacquire ownership and reread/validate the latest revision before resuming, rebuild its runtime projection, and never flush stale RAM from before handoff.

Two call classes share that already-held lease:

- Async admission/preparation acquires the lease or prepares work without mutating committed state. Its commit section is synchronous, serialized through the owner and has no `await` between affected record writes. At that commit boundary, reread the admitted generation/revision and reapply or reject a stale prepared intent; the lease alone does not serialize same-tab async work. Never recursively request the held resource. Do not acknowledge an equip, spend or reward while it only exists in a pending promise.
- Synchronous frame/reward/checkpoint calls run only while the tab already owns the lease. They persist dirty state in the same task; they do not request an async lock per frame. Reward/settlement boundaries durably record their existing receipts before reporting permanent success. A failed write blocks further persistent actions and retains recoverable pending state.

On hidden/pagehide, pause first and synchronously checkpoint while the lease is still held. Release only after the handoff checkpoint; if it fails, do not tell another cooperating tab that handoff succeeded. After release, this tab is read-only and pagehide cannot perform an unlocked save. A clean shutdown may still need explicit lock release for browser lifecycle behavior; test actual freeze/BFCache/resume and avoid stealing a lock from a writer still executing.

**Guarantee:** already acknowledged permanent rewards/spends/equips were durable before pagehide. Pagehide is a best-effort final checkpoint, not the sole durable reward write and not a guarantee that an async operation waiting for a lock completes. If another tab owns the lease, this tab cannot have admitted new persistent actions. On crashes with no lifecycle event, recover the last completed durable commit and its pending receipts; do not claim unsaved RAM frames are durable.

A same-task localStorage reread/revision check followed by `setItem` is **not** an atomic compare-and-swap across tabs. [WHATWG's storage specification](https://html.spec.whatwg.org/dev/webstorage.html) explicitly requires assuming no cross-agent locking. [Web Locks](https://www.w3.org/TR/web-locks/) acquire asynchronously; [browser lifecycle guidance](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) does not promise completion of newly queued async work during termination. Thus no unlocked compare/write escape hatch is permitted. The lease design must pass its browser proof before implementation claims durability.

## 3. Old builds, protected storage and clocks

Do not require proving that every old player tab is closed. Audited old builds may continue writing old keys; after activation those writes are forks, never implicit imports into the active account. Detect and retain changed old payloads for diagnosis without merging/re-crediting them. Cooperating tabs use the shared lease; uncooperative tabs are excluded from the new **storage address**, not assumed to respect the lease.

The old reset helper deletes keys matching `^(orka\.|wishfire\.)`. Merely using `wishfire.*.v6` is unsafe. Proposed protected namespace: `wf.save.*`, including the active marker, staged records and checkpoint copies. Before selecting it, audit every supported old release's deletion predicates and prove that the namespace survives them. If an older supported build performs `localStorage.clear()` or another broader erasure, this namespace choice is insufficient: stop and specify a separately isolated store before cutover. No claim is made against arbitrary same-origin code deliberately deleting all storage.

Remove destructive developer reset/level entry points from production builds, enforced on handlers/build output rather than CSS. Keep explicitly enabled QA tooling in isolated test storage. Removing new controls does not disable an old tab's already-loaded reset function; test that actual function against the proposed protected namespace.

Conversion uses a validated, captured legacy checkpoint. Reread/hash every source component around capture and restart on change; validate pending cross-store receipts. An uncooperative source has no general multi-key atomic snapshot guarantee. If a consistent supported checkpoint cannot be established, defer activation while retaining every captured fork. Do not present a double-read as a universal atomic snapshot. The migration-bead admission evidence must identify its source snapshot and the receipts that make it consistent.

The key audit distinguishes localStorage from sessionStorage. Capture only this tab's accessible session values; do not attempt to read other tabs' sessionStorage. Preserve equipment `seed`, `sequence`, `lastActivationAt`, saved active time and emission fields. The existing clock checkpoint is accepted only when its seed/sequence/time match that equipment record; retain that check. Other tabs validate their own checkpoints when they become active. Developer session config remains session config, not a saved party.

## 4. Exact reconciliation rules

### Tickets

Current wallet keys are separate balances: the sole runtime credit assignment is in `combatProgressionRules.mjs:181`, guarded by a global receipt ID; debit is at `:196-197`. Map all keys proven to belong to the same permanent owner and **sum their current balances exactly**, with safe-integer overflow/invalid-data rejection. Never take their maximum. Missing receipts older than the 256-entry retention cap do not make balances ambiguous. Retained receipts are a corruption/invariant check, not a means to reconstruct the entire wallet history.

Pending spends already deducted tickets: remap their owner IDs without debiting again. Preserve their `id`, `cost`, `fromLevel` and settlement identity. Remap objectives, reward recipients and retained receipt references in the same activation. Do not re-award old objective receipts. Unexpected duplicate/cross-owner receipt IDs or an unresolved owner fail validation; preserve the input rather than invent a correction.

### EXP and lamp watermark

Treat each record's level, residual EXP and `lampEXPClaimed` as one inseparable tuple. On immutable working copies, project each tuple's unclaimed lamp amount `max(0, partyEXP - claimed)` using the existing progression rules. Compare projected cumulative progression, not raw levels or mixed tuple components. Keep each source and report its projected state. A surviving reconciled record's watermark is the current `partyEXP` after projection, so it cannot receive the bank again. Do not create a replacement at watermark zero. Reject invalid/future watermark provenance rather than silently crediting it.

An exact mock fixture at bank 9000: A=(level10, EXP20, claimed5000) projects from total11128 to15128, yielding level11/EXP857; B=(level9, EXP30, claimed1000) projects from8438 to16438, yielding level11/EXP2167; C=(level11, EXP0, claimed9000) stays14271, yielding level11/EXP0. Each projected watermark is9000 and a second apply grants zero. These numbers were obtained with the unchanged progression helper in memory, not a real save conversion.

This projection prevents replay/loss from mismatched watermarks; it does **not** settle purchased levels on other records. The prior greatest-earned-record policy is insufficient when it would discard paid investment. Completed spends retain only bounded IDs; neither their lifetime cost nor unique EXP contribution can always be reconstructed. Do not sum all record EXP, invent a refund or quietly select a maximum. Produce a per-save report of levels/EXP, watermarks, balances, pending spends, surviving receipt coverage and proposed loss. Until evidence plus an owner-approved compensation/retention rule resolves it, keep that save unconverted in its supported safety-release format. A migration is not successful merely because it preserved the highest displayed level.

### Gear and other state

Retain exact equipment item IDs and unique owners; keep the menu's equipped item under the prior approved repair rule and return a genuinely displaced piece to the cache. Do not equip, transfer, dismantle or reroll gear as part of conversion. Preserve currencies and HP/KO. Gold's current bank and settlement acknowledgments are not independent balances to sum. Follow the complete key/receipt audit, including legacy import bytes and the QA backup.

## 5. Joint activation and rollback

Stage one target generation containing final neutral owner/definition IDs and all affected hero, loadout, wallet, pending-spend, objective, reward and participant references. Use explicit non-integer-like IDs. Validate every reference and balance before setting a single active marker in the protected namespace. The actor/eligibility readers switch only after that complete generation is admitted. No boot-time objective normalizer runs against old targets with new actors.

Schema metadata, fields and old-to-final mapping must be listed in the migration bead. The original owner's duplicate-record merge is itself identity-changing, even if its input/output fields share a version number. It cannot ship as a harmless pre-conversion cleanup. Coordinate code ownership across beads, with one activation. A partial-owner build must refuse conversion and preserve the old combat-progression bytes.

Before activation, a failed/quota-interrupted stage is discarded without modifying original data. After activation, code rollback requires a build supporting the active schema; otherwise use a forward fix. Never restore an old checkpoint over post-cutover progress. Keep sufficient checkpoint material outside old reset predicates. Supported old-key activity is a retained fork, not a migration replay trigger.

## Required failure and preservation fixtures

- Unknown hero version, nested topology version, combat-progression version, malformed equipment and developer preset attempts: no writes/removals to any dependent key; gameplay mutations blocked.
- Two wallet keys with balances17 and23 and no retained old receipts: final balance40; pending debit preserved once; reload/retry keeps40.
- Pending `hero_upgrade` objective targeting an old duplicate: a partial owner build leaves its original store byte-identical; full joint activation remaps its target, wallet and pending spend before boot normalization.
- All permutations of a five-record save containing four authored heroes plus an early duplicate: lamp roster contains the same four owners in authored order and protects each hero's useful gear. Compare classification against the documented roster bugfix, not the old broken subset.
- Three-record lamp fixture above: exact cumulative EXP and watermarks, no second credit. A paid-progress ambiguity fixture refuses conversion and preserves all original records/balances; no synthetic refund.
- Pagehide while a different cooperating tab holds the writer lease: this tab has admitted no new persistent action, performs no unlocked writes, and reload loses no acknowledged reward. Add hidden/reacquire, freeze/BFCache, quota failure and crash-after-reward-commit cases.
- Real old-build tab left open during activation: old writes stay outside active storage; its actual reset function cannot erase active/staged/checkpoint keys. Verify production build output has no destructive dev entry point. Test marker interruption at every write and incompatible rollback with post-cutover progress.

These are required future tests. Passing them, reconciling actual legacy forks and deciding paid-level preservation remain prerequisites, not results of this audit.
