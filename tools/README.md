Legacy C3 conversion tooling retired.

Construct 3 JSON artifacts and converter script were removed from the repository on 2026-02-24.
Runtime authority is the current hand-authored code in `Scripts/` and `web-runner/`.

## Hot-File Regression Gate Pack

Use the repo-owned regression gate pack when a bead changes staged hot files or PM/dev closeout needs one deterministic regression proof for core hot-file seams.

- `npm run test:hot-file-gate`

This pack intentionally reuses shipped checks:

- `tests/powerAmpLifecycleContract.test.js`
- `tests/yellowTurnHandoffContract.test.js`
- `tests/huunExecutionDropBonusContract.test.js`
- `tests/turnSchedulerRepeatGuardContract.test.js`
- `tests/functionBankParityContract.test.js`
- `node tools/audit_initiative_fairness.js`

Treat it as the default deterministic regression pack for hot-file lanes unless the bead explicitly names a narrower or broader replacement pack.
