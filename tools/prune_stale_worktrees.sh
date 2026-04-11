#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

tmp_detached="$(mktemp)"
trap 'rm -f "$tmp_detached"' EXIT

REPO_ROOT="$ROOT" python3 - <<'PY' > "$tmp_detached"
import subprocess
import os
from pathlib import Path

repo = Path(os.environ["REPO_ROOT"])
out = subprocess.check_output(['git', 'worktree', 'list', '--porcelain'], text=True, cwd=repo)
worktree = None
for line in out.splitlines():
    if line.startswith('worktree '):
        worktree = line.split(' ', 1)[1]
    elif line == 'detached' and worktree and worktree != str(repo):
        print(worktree)
PY

if [[ ! -s "$tmp_detached" ]]; then
  echo "No detached worktrees found."
  exit 0
fi

count="$(wc -l < "$tmp_detached" | tr -d ' ')"
echo "Removing ${count} detached worktrees:"
while IFS= read -r wt; do
  [[ -n "$wt" ]] || continue
  echo "- $wt"
  git worktree remove --force "$wt"
done < "$tmp_detached"

git worktree prune --expire now

echo "Done. Remaining worktrees:"
git worktree list --porcelain | awk '/^worktree /{c++} END{print c+0}'
