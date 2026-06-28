# Mirror Ownership Strategy

Status: planning contract for `ORKA-yib8.5`. This document classifies duplicate mirror families before any cleanup. It does not authorize dedupe, deletion, import rewrites, or runtime behavior changes.

## Current Evidence

Checked on 2026-06-28 from `origin/main` in the `ORKA-yib8.5` worktree.

- Fallow 2.87.0 duplicate summary: 364 files scanned, 286 files with clones, 43,408 duplicated lines, 508 clone groups, 1,610 clone instances, 54.27 percent duplicated lines.
- Mirrored directory family: `Scripts/` ↔ `web-runner/modules/`, 7 shared files, 10,511 total mirrored lines.
- Mirrored directory family: `src/core/` ↔ `web-runner/src/core/`, 30 shared files, 5,842 total mirrored lines.
- DOX rules say `Scripts/functionBank.js` mirrors selected high-risk gameplay functions from `web-runner/modules/functionBank.js`; root `src/core/` owns shared deterministic contracts; `web-runner/src/core/` owns browser-shipped deterministic ESM copies when runtime cannot import root directly.

## Ownership Matrix

| Mirror family | Classification | Current owner | Mirror purpose | Cleanup policy | Required validation |
| --- | --- | --- | --- | --- | --- |
| `web-runner/modules/functionBank.js` ↔ `Scripts/functionBank.js` | Intentional hot mirror | `web-runner/modules/functionBank.js` is browser-runtime authority; `Scripts/functionBank.js` is Construct-style compatibility/parity mirror. | Preserve high-risk gameplay behavior and legacy-compatible function vocabulary. | Do not dedupe manually. Any behavior change must touch both mirrors unless a bead explicitly authorizes divergence. Extract deterministic rules to `src/core/`, browser ESM copies, or Rust seams instead of moving logic between the two hot files. | `node --test tests/functionBankParityContract.test.js`, `npm run test:hot-file-gate`, plus the focused contract for the touched rule family. |
| `web-runner/modules/state.js` ↔ `Scripts/state.js` | Intentional state-shape mirror | `web-runner/modules/state.js` is live browser state envelope; `Scripts/state.js` preserves Construct-style shape. | Keep `state.globals` and `state.entities` vocabulary aligned for parity contracts and legacy-compatible helpers. | Do not delete or collapse until a state-envelope migration bead proves all consumers and reset/init behavior. | State-specific contract for the changed field plus focused runtime tests; for broad state moves, add a state-envelope ownership test first. |
| `functionRegistry.js`, `mainSheet.js`, `skillSheet.js`, `liveOpsTokens.js`, `monsterLootTableEventTokens.js` mirror pairs | Intentional module mirror, lower risk than functionBank | Browser `web-runner/modules/` files are live runtime; `Scripts/` files preserve compatible registry/sheet/token surfaces. | Keep registry dispatch, sheet behavior, and token constants discoverable in both runtime vocabularies. | Review pair by pair. Small retire candidates need their own bead and proof that both browser runtime and tests no longer consume the surface. | Focused sheet/token/registry contracts; `tests/regenDebugNoiseContract.test.js` for sheet debug noise; `tests/functionBankParityContract.test.js` if registry changes can affect functionBank loading. |
| `src/core/*.mjs` ↔ `web-runner/src/core/*.mjs` | Intentional deterministic rule mirror and future consolidation candidate | `src/core/` owns shared deterministic contracts used by tests and compatibility surfaces; `web-runner/src/core/` owns browser-shipped ESM rule modules. | Keep deterministic rules available to both Node/test/Rust-adjacent surfaces and browser runtime import paths. | Do not collapse wholesale. Consolidate only one rule family at a time after browser import constraints, packaging, and tests prove one canonical path can serve both. | Existing pair-specific tests such as `tests/speedInitiativeSchedulerContract.test.js`, `tests/damageFloatVectorContract.test.js`, `tests/statusEffectPacketContract.test.js`, fixture contracts, and Rust/WASM shadow tests when owner hooks are involved. |
| Root CJS/ESM compatibility files such as `src/core/combatRuntimeGateway.cjs` and `src/core/combatRuntimeGateway.js` | Intentional compatibility surface | `src/core/` owns compatibility exports for Node tests and runtime adapters. | CJS/ESM duplication exists to serve different consumers. | Do not remove a format without a bead proving all consumers have migrated and package semantics remain valid. | `node --test tests/combatRuntimeGateway.test.js tests/combatRuntimeGatewayContract.test.js tests/finalRustOwnershipBoundaryContract.test.js`. |

## Follow-Up Bead Split

1. `ORKA-yib8.7`: repair the unresolved `Scripts/functionBank.js -> ../src/core/initiativeGuards.mjs` import. Do not suppress it in Fallow.
2. Module-pair audit bead: classify each non-functionBank `Scripts/` ↔ `web-runner/modules/` pair as keep, retire candidate, or generated-source candidate. No deletion in the audit bead.
3. Core-rule import strategy bead: choose one deterministic rule family and prove whether browser runtime can import root `src/core/` directly or still needs a browser-shipped mirror.
4. Generation/sync bead: if manual mirroring remains necessary, add a narrow checker or generation note for the selected pair rather than broad dedupe.
5. Deletion bead: only after a pair-specific audit proves a file is unused by browser runtime, tests, legacy mirror contracts, and documentation.

## Do Not Change In Mirror Cleanup

- Do not run `fallow fix --yes`.
- Do not delete `Scripts/`, `web-runner/modules/`, `src/core/`, or `web-runner/src/core/` files from aggregate duplicate output.
- Do not use clone counts as deletion proof.
- Do not drift hot mirrored functions without a contract test and explicit Bead scope.
- Do not suppress a real unresolved import to make Fallow green.

## Success Standard

A future mirror cleanup PR is acceptable only when it names one mirror pair or one deterministic rule family, cites the owning Bead, lists exact files touched, proves the live owner and compatibility owner, and passes the focused validation named above.
