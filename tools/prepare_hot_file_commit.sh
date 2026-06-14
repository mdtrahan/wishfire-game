#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="${HOT_FILE_SCOPE_REPO_ROOT:-$ROOT}"
cd "$REPO_ROOT"

exec python3 "$ROOT/tools/commit_compliance.py" prepare-hot "$@"
