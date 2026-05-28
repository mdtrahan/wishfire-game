#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STAMP="${1:-$(date +%Y%m%d-%H%M%S)}"
OUT_DIR="output/branch-collapse/${STAMP}"
mkdir -p "${OUT_DIR}/stashes"

tag_ref() {
  local ref_name="$1"
  local target="$2"
  git tag -f "$ref_name" "$target"
}

echo "[archive] writing snapshots to ${OUT_DIR}"
git branch -a -vv > "${OUT_DIR}/branches.txt"
git status --short > "${OUT_DIR}/status.txt"
git stash list > "${OUT_DIR}/stash-list.txt"
git log --graph --decorate --oneline --all --max-count 100 > "${OUT_DIR}/graph.txt"

echo "[archive] tagging branch tips"
tag_ref "archive/pre-main-collapse-${STAMP}-codex-playright-fix" "codex/playright-fix"
tag_ref "archive/pre-main-collapse-${STAMP}-codex-live" "codex/live"
tag_ref "archive/pre-main-collapse-${STAMP}-local-main" "main"
tag_ref "archive/pre-main-collapse-${STAMP}-origin-main" "origin/main"

echo "[archive] exporting stashes"
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  stash_id="${line%%:*}"
  slug="$(printf '%s' "$line" | sed 's/^[^:]*: *//; s/[^A-Za-z0-9._-]/-/g')"
  git stash show -p "${stash_id}" > "${OUT_DIR}/stashes/${stash_id}-${slug}.patch"
done < <(git stash list)

cat > "${OUT_DIR}/README.md" <<EOF
# Branch Collapse Archive

- stamp: ${STAMP}
- repo: ${ROOT}
- current branch: $(git branch --show-current)

Created:
- branch/tag snapshots for codex/playright-fix, codex/live, local main, and origin/main
- stash patch exports under \`stashes/\`
- branch/status/stash/log manifests

Before pruning stashes or force-updating main, push the archive tags:

\`\`\`bash
git push origin --tags
\`\`\`
EOF

echo "[archive] done"
