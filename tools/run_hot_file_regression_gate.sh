#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

node --test \
  tests/powerAmpLifecycleContract.test.js \
  tests/yellowTurnHandoffContract.test.js \
  tests/huunExecutionDropBonusContract.test.js \
  tests/turnSchedulerRepeatGuardContract.test.js \
  tests/functionBankParityContract.test.js

node tools/audit_initiative_fairness.js
