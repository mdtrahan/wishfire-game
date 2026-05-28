#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PATH="$HOME/.local/bin:$PATH"

BRANCH="${1:-$(git branch --show-current)}"

stage_if_present() {
  local path
  for path in "$@"; do
    if [[ -e "$path" ]]; then
      git add "$path"
    fi
  done
}

has_staged_changes_for_paths() {
  if [[ "$#" -eq 0 ]]; then
    return 1
  fi
  if git diff --cached --quiet -- "$@"; then
    return 1
  fi
  return 0
}

has_worktree_changes_for_paths() {
  if [[ "$#" -eq 0 ]]; then
    return 1
  fi
  if git diff --quiet -- "$@"; then
    return 1
  fi
  return 0
}

require_clean_active() {
  local expected="$1"
  local current
  current="$(bd list --status in_progress | awk 'NF{print $2; exit}' || true)"
  if [[ "$current" != "$expected" ]]; then
    echo "ERROR: expected active bead ${expected}, got ${current:-<none>}" >&2
    exit 1
  fi
}

set_only_active() {
  local target="$1"
  local issue_id
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    issue_id="$(printf '%s\n' "$line" | awk '{print $2}')"
    [[ -z "$issue_id" ]] && continue
    [[ "$issue_id" == "$target" ]] && continue
    bd update "$issue_id" --status open >/dev/null
  done < <(bd list --status in_progress)
  bd update "$target" --status in_progress >/dev/null
}

bead_is_done() {
  local issue_id="$1"
  bd show "$issue_id" | grep -q '\[.*DONE\]'
}

cleanup_generated_scope() {
  local issue_id="$1"
  rm -f ".beads/hot-file-lock/${issue_id}.scope" ".beads/hot-file-lock/${issue_id}.prepared.json"
}

if bead_is_done ORKA-pmf; then
  echo "[1/3] Runtime/test checkpoint under ORKA-pmf (already done, skipping)"
elif ! has_staged_changes_for_paths \
  Scripts/functionBank.js \
  Scripts/logicCore.js \
  src/core/partyFormationRules.mjs \
  src/core/turnGateController.mjs \
  tests \
  web-runner/app.js \
  web-runner/modules/functionBank.js \
  web-runner/src/core/idleFarmRuntime.mjs \
  web-runner/src/core/partyFormationRules.mjs \
  web-runner/src/core/turnGateController.mjs; then
  echo "[1/3] Runtime/test checkpoint under ORKA-pmf (no staged runtime/test changes, skipping)"
else
  echo "[1/3] Runtime/test checkpoint under ORKA-pmf"
  set_only_active ORKA-pmf
  require_clean_active "ORKA-pmf"
  tools/prepare_hot_file_commit.sh ORKA-pmf
  git commit -m "fix(runtime): checkpoint turn-combat-runtime bundle bd-ORKA-pmf"
  git push origin "$BRANCH"
  bd update ORKA-pmf --status done >/dev/null
  cleanup_generated_scope ORKA-pmf
fi

if bead_is_done ORKA-1qo; then
  echo "[2/3] Playwright tooling lane under ORKA-1qo (already done, skipping)"
elif ! has_worktree_changes_for_paths \
  package.json \
  tools/balance_harness.js \
  tools/chrome_cdp_bootstrap.js \
  tools/playwright_doctor.js \
  tools/playwright_launch_matrix.js \
  tools/playwright_support.js \
  governance/qa/combat-playwright-control-model.md \
  ai-memory/insights.md; then
  echo "[2/3] Playwright tooling lane under ORKA-1qo (no pending tooling changes, skipping)"
else
  echo "[2/3] Playwright tooling lane under ORKA-1qo"
  set_only_active ORKA-1qo
  require_clean_active "ORKA-1qo"
  stage_if_present \
    package.json \
    tools/balance_harness.js \
    tools/chrome_cdp_bootstrap.js \
    tools/playwright_doctor.js \
    tools/playwright_launch_matrix.js \
    tools/playwright_support.js \
    governance/qa/combat-playwright-control-model.md \
    ai-memory/insights.md
  git commit -m "chore(tooling): harden playwright harness support bd-ORKA-1qo"
  git push origin "$BRANCH"
  bd update ORKA-1qo --status done >/dev/null
fi

if bead_is_done ORKA-tuin; then
  echo "[3/3] Hot-file tooling lane under ORKA-tuin (already done, skipping)"
elif ! has_worktree_changes_for_paths \
  tools/enforce_hot_file_scope.sh \
  tools/test_hot_file_lock.sh \
  tools/hot_file_scope.py \
  tools/prepare_hot_file_commit.sh \
  tools/README.md \
  governance/execution/beads-process.md; then
  echo "[3/3] Hot-file tooling lane under ORKA-tuin (no pending tooling changes, skipping)"
else
  echo "[3/3] Hot-file tooling lane under ORKA-tuin"
  set_only_active ORKA-tuin
  require_clean_active "ORKA-tuin"
  stage_if_present \
    tools/enforce_hot_file_scope.sh \
    tools/test_hot_file_lock.sh \
    tools/hot_file_scope.py \
    tools/prepare_hot_file_commit.sh \
    tools/README.md \
    governance/execution/beads-process.md
  git commit -m "chore(tooling): automate hot-file commit preparation bd-ORKA-tuin"
  git push origin "$BRANCH"
  bd update ORKA-tuin --status done >/dev/null
fi

echo "Done. Active in-progress beads:"
bd list --status in_progress
