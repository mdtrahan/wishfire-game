#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

node --test \
  tests/functionBankParityContract.test.js \
  tests/realtimeHeroSkillsContract.test.mjs \
  tests/realtimeHeroBasicSchedulingContract.test.mjs \
  tests/realtimeEnemyActionSchedulingContract.test.mjs \
  tests/combatSimulationTickContract.test.mjs \
  tests/enemyRewardLifecycleContract.test.js

node --test tests/lampEquipment.test.mjs
# Lamp presentation owners use the same reference/compact phone gate.
if git diff --name-only HEAD -- web-runner/app.js web-runner/systems/lampEquipmentUI.mjs web-runner/assets/lampEquipmentUI.css web-runner/systems/renderExistingNavigation.mjs | rg -q .; then
  npm run test:lamp-ui
fi
