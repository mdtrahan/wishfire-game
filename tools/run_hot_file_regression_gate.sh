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
