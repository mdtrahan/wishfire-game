# Scripts DOX

## Purpose
- Preserve the Construct-style runtime mirror used by parity contracts and legacy-compatible runtime helpers.
- Keep this tree aligned with the browser runtime where tests declare mirrored behavior.

## Ownership
- `Scripts/functionBank.js` mirrors selected high-risk gameplay functions from `web-runner/modules/functionBank.js`.
- `Scripts/state.js`, `mainSheet.js`, `skillSheet.js`, `functionRegistry.js`, and related modules preserve Construct-like runtime vocabulary.
- Retired Construct 3 project artifacts are not owned here and should not be reintroduced.

## Local Contracts
- Do not edit mirrored high-risk functions in only one runtime path. Check `tests/functionBankParityContract.test.js` before changing function-bank behavior.
- Keep names and state vocabulary compatible with `web-runner/modules/` unless a bead explicitly authorizes a migration.
- Deterministic gameplay rules should move toward shared `src/core/` or Rust SimulationCore seams, not deeper into the mirror.
- Avoid using this folder as a dumping ground for new browser UI, rendering, storage, or tooling behavior.

## Work Guidance
- When changing combat, skill, turn, damage, enemy, or gem behavior, inspect the matching `web-runner/modules/` function first.
- If only one mirror should change, document why in the bead and add/update a contract that proves the intentional divergence.
- Keep edits narrow; these files are hot and historically regression-prone.

## Verification
- `node --test tests/functionBankParityContract.test.js`
- Add focused contract tests for any intentionally new mirrored behavior.
- Run broader focused tests for the touched rule family when changing gameplay behavior.

## Child DOX Index
- None.

- Energy is a macro balance: quest entry spends it, combat actions do not. Purple recovery remains active. Combat defeat depends on party HP/living heroes; Continue preserves energy.
