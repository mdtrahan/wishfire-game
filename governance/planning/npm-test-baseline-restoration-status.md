# npm Test Baseline Restoration Status

## Scope

This is the ORKA-yib8.8 coordination status for restoring the current `npm test` baseline.

This document does not authorize runtime fixes, test skips, test loosening, or package/tooling changes. The two reproduced failures are already owned by separate Beads and draft PRs.

## Current Baseline

Evidence captured from branch `bead/ORKA-yib8.8-npm-test-baseline-status`, based on `origin/main` at `d444b19`.

Focused command:

```bash
rtk node --test tests/kojonnPowerAmpSingleContract.test.js tests/partyDestinyContract.test.js
```

Result:

- exit code: `1`
- tests: `12`
- pass: `10`
- fail: `2`
- skipped: `0`
- failing tests:
  - `tests/kojonnPowerAmpSingleContract.test.js:96` - `ReferenceError: IsPartySessionSkillActive is not defined`
  - `tests/partyDestinyContract.test.js:320` - dev panel Destiny trigger block no longer matches the contract's expected inline `requestedUID` shape

Full command:

```bash
rtk npm test
```

Result:

- exit code: `1`
- tests: `677`
- pass: `675`
- fail: `2`
- cancelled: `0`
- skipped: `0`
- todo: `0`
- failing tests are the same two focused failures above

No tests were skipped, deleted, or weakened in this coordination lane.

## Failure Ownership

| Failure | Owner Bead | PR | Current PR state | Do-not-track rationale |
|---|---|---:|---|---|
| Kojonn red single Power Amp harness cannot resolve `IsPartySessionSkillActive` | `ORKA-zvq1` | #158 | open draft, clean merge state, deploy preview checks present | Already isolated to a Power Amp baseline PR. Duplicating it in ORKA-yib8.8 would violate the coordination bead's non-goal against runtime fixes. |
| Destiny dev panel trigger contract expects old inline `requestedUID` block | `ORKA-p3rw` | #159 | open draft, clean merge state, deploy preview checks present | Already isolated to the Destiny/dev-panel reliability PR. Duplicating it in ORKA-yib8.8 would mix coordination with implementation. |

No additional Beads are needed for the current red baseline unless either PR is abandoned or the post-merge suite exposes new failures.

## Closure Gate

Do not close ORKA-yib8.8 as green until all of the following are true:

1. PR #158 and PR #159 are merged or explicitly superseded.
2. The focused command exits `0`:

```bash
rtk node --test tests/kojonnPowerAmpSingleContract.test.js tests/partyDestinyContract.test.js
```

3. The full suite exits `0`:

```bash
rtk npm test
```

4. If any failure remains, it has an explicit owner Bead, a PR or do-not-track rationale, and evidence that no tests were skipped or weakened.

## Stop Conditions

Stop and create or route to a separate Bead if baseline restoration requires:

- runtime code changes
- test deletion, skipping, or weakening
- package or tooling changes
- broad gameplay behavior changes
- merging fixes into this coordination lane

## Evidence Receipt

- Beads checked: `ORKA-yib8.8`, `ORKA-zvq1`, `ORKA-p3rw`
- GitHub checked: PR #158 and PR #159 are open drafts with clean merge state at the time of this status update
- Commands run: focused two-file test command and full `npm test`
- Files changed in this lane: this planning/status document plus Beads interaction metadata
