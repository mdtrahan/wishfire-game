#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PATH="$HOME/.local/bin:$PATH"

STAMP="$(date +%Y%m%d-%H%M%S)"
INTEGRATION_BRANCH="codex/main-collapse-${STAMP}"
OUT_DIR="output/branch-collapse/${STAMP}"

stage_if_present() {
  local path
  for path in "$@"; do
    if [[ -e "$path" ]]; then
      git add "$path"
    fi
  done
}

echo "[collapse] archive current git state"
bash tools/archive_git_state.sh "${STAMP}"

echo "[collapse] commit active cleanup lanes"
bash tools/commit_cleanup_lanes.sh

echo "[collapse] restore umbrella governance bead"
bd update ORKA-b7wh --status in_progress >/dev/null

echo "[collapse] commit umbrella branch-recovery tooling/docs under ORKA-b7wh"
stage_if_present \
  AGENTS.md \
  agents/prompts/dev_agent.md \
  agents/prompts/pm_agent.md \
  tools/archive_git_state.sh \
  tools/collapse_to_healthy_main.sh \
  tools/commit_cleanup_lanes.sh
if ! git diff --cached --quiet; then
  git commit -m "chore(governance): collapse recovery branches to healthy main bd-ORKA-b7wh"
  git push origin "$(git branch --show-current)"
fi

echo "[collapse] create integration branch ${INTEGRATION_BRANCH}"
git checkout -b "${INTEGRATION_BRANCH}"

echo "[collapse] refresh archive tags after lane commits"
git tag -f "archive/pre-main-collapse-${STAMP}-integration-tip" HEAD
git push origin "${INTEGRATION_BRANCH}"
git push origin --tags

echo "[collapse] repoint local main to integration tip"
git checkout main
git reset --hard "${INTEGRATION_BRANCH}"

echo "[collapse] replace remote main with force-with-lease"
git push --force-with-lease origin main

echo "[collapse] return root checkout to clean main"
git status --short
bd update ORKA-b7wh --status done >/dev/null

cat > "${OUT_DIR}/post-collapse-next-steps.md" <<EOF
# Post Collapse Next Steps

Root checkout is now expected to be \`main\`.

Recommended follow-up:

\`\`\`bash
git branch -D codex/playright-fix
git worktree add ../wt-next-lane -b codex/<next-lane> main
\`\`\`

Keep \`codex/live\` for a confidence window, then delete it if main remains healthy.
Prune archived stashes only after confirming all needed recovery data exists in \`output/branch-collapse/${STAMP}/stashes\`.
EOF

echo "[collapse] done"
echo "integration branch: ${INTEGRATION_BRANCH}"
echo "artifacts: ${OUT_DIR}"
