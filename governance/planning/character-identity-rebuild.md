# Character identity: audit and proposed execution boundaries

Planning only, ORKA-90u. This revision supersedes `4b1db897`; it authorizes no runtime work, save writes or merges. Preserve current player-facing content, gear, earned progress, resources, HP/KO and combat rules. The desired destination remains modular identity independent of character names and art.

## Verified findings and unresolved preservation issue

The [source audit](character-identity-reference-audit.md) pins main `97f77474e44cb1f869ec2ecd227cc397fe4aac75`, reproduces 84 exact-case retired-name files / 92 case-insensitive / 31 instance-key files, and lists storage keys and writers. The second review identified additional hazards beyond that name census, including first-four-record roster selection, nested version loss and synchronous lifecycle writers.

**Purchased levels on duplicate records remain an unresolved conversion blocker.** Saves lack complete historical spend information. Selecting the greatest record can discard paid investment; a precise refund cannot be invented. Pending forensic review and a specific owner decision, preserve affected saves byte-for-byte and do not activate their conversion. The safety release remains their supported format. Do not ship a final schema release that strands known affected saves. First report actual affected records and recoverable history; do not ask the owner to choose an abstract refund before showing the discrepancy.

The exact preservation, activation and rollback rules are in the [save cutover contract](character-save-cutover-contract.md). It replaces the earlier ticket rule, watermark rule, all-tab checkpoint requirement and same-origin tab-closure prerequisite.

## Work boundaries and order

New entries below are proposed bead scopes, not created implementation tasks. Re-read current main and ownership before execution. ORKA-bhb's corrected `f506f2d2` candidate is still unmerged.

| Scope | Boundary and release gate |
| --- | --- |
| A. Save-health guard | Cover hero version, nested topology, equipment and combat-progression validation, developer level/reset/import and all dependent writers. Unsupported data blocks mutable gameplay before defaults, classification or objective boot writes. See contract. No schema bump or identity conversion. |
| B. Existing CP/screen work | Integrate ORKA-bhb through its existing QA/Integration Ready gates before ownership work touches those consumers. Do not silently reimplement the unmerged branch. This plan adds no CP algorithm scope. |
| C. Lamp roster source | After B, replace every first-four-progress-record selector with the four current authored heroes in definition order, resolved to their existing permanent owners. No new saved party. This intentionally repairs omitted-hero gear protection; document that classification change. Land before conversion. |
| D1. Writer resource and developer paths | Introduce one version-independent lock-name constant. Route supported developer writes through the owner; remove destructive developer controls from production builds, keeping explicit QA access separate. No nested acquisition of the same lock. |
| D2. Synchronous durability | Implement and prove the single-writer lease and lifecycle contract, including reward boundaries. Never implement cross-tab compare-and-write as an atomic operation. D1 alone does not solve synchronous writers. |
| D3. Combat-progression commits | Route wallet/objective/debit/boot commits through the same writer lease. Partial coordination may be reviewed separately; it cannot be advertised as complete protection. |
| E. Actor containment | Develop the original ORKA-5af.3 actor/permanent-owner boundary in a separately reviewable slice. A no-conversion release is allowed only if it preserves existing save keys, eligibility IDs, objectives and normal fresh-save behavior. If owner resolution changes any of these, activate it with F instead. Do not claim this slice completes ORKA-5af.3. |
| F. One coordinated owner/ID conversion | A new explicitly scoped migration bead owns the final neutral owner/definition IDs and the joint conversion of heroes, loadouts, wallets, spends, objectives and receipts. Actor/eligibility switching activates with this bundle. Do not perform an intermediate duplicate merge followed by a second identity rekey. ORKA-5af.3 keeps its approved responsibility; broader content/migration work is not silently added to it. |
| Independent enemy IDs | May ship before A–F if the field census confirms no persistent enemy identity changes. Current checkpoints contain region/stage/wave state and numeric defeat UIDs, not enemy definition identity. Preserve catalog array/RNG order explicitly; prove same definition picks, draw counts, positions and rewards. |
| Independent appearances | Add definition-to-appearance lookup using existing assets/crops/scale. No saved skin-selection feature or hero-save rewrite. Existing display names are editable metadata. |
| Final cosmetic cleanup | Separately rename obsolete symbols/assets/current docs after semantic consumers are proven. Check asset hashes and rerun the case-insensitive census. Definition lookup tables remain normal architecture; retired-name gameplay aliases do not. |

**Recommended target: one hero-identity conversion, into the final IDs.** This is a revised proposal requiring an explicit migration-bead scope before code. Code review may split E/F by module; release activation cannot split the fields that share an owner. A standalone E build must leave existing hero/equipment/combat-progression fixtures byte-identical on no-op boot, including a pending hero-upgrade objective targeting a duplicate. A failed proof folds E activation into F.

## Destination and mutation manifest

Definition, permanent owned hero and battle entity are different identities. Actors cannot create permanent records. Use immutable non-integer-like, prefixed IDs; no ID derives from labels, filenames or enumeration order. A definition can later support multiple owned copies without making temporary combat clones permanent. No new acquisition, duplicate-copy, gacha, party or skin gameplay is added now. Preserve current auto-ownership of definitions and configured party resolution until a separate product decision changes them.

| Stage | Persistent fields allowed to change |
| --- | --- |
| A | Healthy saves: none from the guard itself. Unsupported saves: no writes/removals in any dependent area. |
| C | Cache pending/discarded classification for the documented roster bug; no gear ownership, progression or identity-key changes. |
| D | Writer protocol metadata only when its activation is specified; no identity rekey. Existing payload schemas remain until F. Its old-client protection is not complete before protected storage activation. |
| E alone | No hero/loadout/wallet/target rekey. Temporary actor references only, subject to the no-op boot and fresh-save proof. |
| F | Hero-map keys and definition references; loadout owner keys; ticket-wallet keys; pending-spend/objective/reward/participant owner references; generation metadata. Preserve item IDs, balances, progression values and checkpoint content under the explicit reconciliation rules. |
| Enemy / appearance | No hero-save fields. Any discovered persisted enemy/appearance reference requires its own field-specific conversion scope before release. |
| Cosmetic | Files/identifiers and explicit asset paths only; no serialized state. |

## Acceptance and limits

Use the concrete fixtures in the cutover contract. Re-run affected existing consumer tests, including equipment protection where its roster source changes. Screenshots verify presentation changes against the same valid save. Keep app.js orchestration-only and preserve deterministic JS/Rust ownership and required mirrors.

This proposal remains **not ready for conversion** until purchased-level reconciliation has evidence and an owner decision, the write protocol passes browser lifecycle/concurrency proof, and the old-build namespace audit supports the selected protected storage. No test result, migration success or merge readiness is claimed by these Markdown changes.
