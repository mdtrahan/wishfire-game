#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="${HOT_FILE_SCOPE_REPO_ROOT:-$ROOT}"
cd "$REPO_ROOT"

ISSUE_ID="${1:-}"
if [[ -z "$ISSUE_ID" ]]; then
  echo "usage: tools/prepare_commit_check.sh <bd-id> [prepare_hot_file_commit args...]" >&2
  exit 1
fi
shift || true

STAGED="$(git diff --cached --name-only --diff-filter=ACMR)"
if grep -Eq '^(web-runner/modules/functionBank\.js|Scripts/functionBank\.js|web-runner/app\.js)$' <<<"$STAGED"; then
  "$ROOT/tools/prepare_hot_file_commit.sh" "$ISSUE_ID" "$@"
fi

exec python3 "$ROOT/tools/commit_compliance.py" prepare "$ISSUE_ID"
