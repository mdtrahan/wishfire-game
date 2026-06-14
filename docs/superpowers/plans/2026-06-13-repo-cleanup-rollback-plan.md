# Codex-Orka Repository Cleanup and Rollback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Codex-Orka to a clean, trustworthy repository state without risking the locally QA-proven good game state, and create rollback handles for every cleanup action.

**Architecture:** Use preservation-first lane hygiene. First identify which local URL/server/worktree produced the trusted QA gameplay state, then capture immutable evidence, branch bundles, rollback tags, dirty diffs, untracked archives, Beads state, and GitHub state. Only after the QA-proven state is protected should agents classify worktrees and branches by live ownership, then perform cleanup after an explicit owner disposition per lane. Treat six-digit diffs as a symptom of stale branch baseline or broad divergence, never as permission to delete, merge, or reset.

**Tech Stack:** Git worktrees/branches/tags/bundles, Beads via `bd`, GitHub CLI `gh`, local shell tooling, existing Node test suite, local `web-runner` browser QA.

---

## Critical Rules

- No cleanup mutation before an explicit owner approval and Beads gate exists for the exact cleanup run.
- No tag, archive, branch deletion, worktree removal, PR update, Beads mutation, or Project mutation before `Task 0` passes.
- No remote branch, including `origin/main`, is cleanup authority by default. Remote `main` is only the shared committed baseline. The recovery anchor is the local QA-proven state unless evidence proves that local QA was served from remote `main`.
- Do not ask the owner to pick an opaque SHA when the agent can determine the answer. The agent must trace local QA provenance first, then produce a recommendation. Ask the owner only when provenance is missing, conflicting, or requires mutating a dirty local state into a checkpoint commit.
- No deletion before a durable evidence root, rollback tag, full-ref Git bundle, per-lane bundle, dirty patch capture, staged patch capture, untracked archive, ignored-file manifest, and SHA-256 manifest exist.
- No rollback handle may live only in `/private/tmp`; use durable evidence outside the repo, then optionally mirror it to `/private/tmp` for convenience.
- No branch merge from a lane that shows broad two-dot diffs against the immutable recovery anchor SHA.
- Use three views for every lane:
  - `git diff --name-status <RECOVERY_ANCHOR_SHA>...<branch>` for branch-unique work.
  - `git diff --name-status <RECOVERY_ANCHOR_SHA> <branch>` for overwrite risk against the QA-proven game state.
  - `git log --oneline --left-right --cherry-pick <RECOVERY_ANCHOR_SHA>...<branch>` for non-equivalent commits.
- Closed Bead plus active worktree means cleanup candidate, not automatic deletion.
- Active Bead plus branch/worktree with broad runtime overlap means owner decision or repair lane, not new implementation.
- Primary `/Users/Mace/Codex-Orka` local `main` being behind remote is a cleanup finding, not proof that remote is better. Do not update, reset, or clean it until local QA provenance and dirty surfaces are preserved.
- Never hand-edit or git-restore `.beads/interactions.jsonl`; use `bd`, `bd doctor`, or an explicit Beads recovery procedure.
- Use `$bead-worktree-lifecycle` for approved cleanup execution. Raw `git worktree remove`, `git branch -d`, or `git branch -D` commands are reference-only fallback commands, not default execution.

## File and Artifact Map

**Create in durable storage outside repo during execution:**
- `/Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/README.md` - checkpoint index and restore instructions.
- `/Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/SHA256SUMS` - checksum manifest for every rollback artifact.
- `/Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/git-all-refs.bundle` - full Git rollback bundle.
- `/Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/qa-provenance.md` - exact local QA URL, server process, worktree path, branch, HEAD, dirty state, and validation evidence used to choose the recovery anchor.
- `/Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/recovery-anchor.env` - agent-selected recovery anchor and whether it is a clean commit, dirty local composite, or remote fallback.
- `/Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/lane-bundles/*.bundle` - one bundle per cleanup candidate branch or detached preservation ref.
- `/Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/worktree-archives/*` - per-worktree dirty, staged, untracked, and ignored preservation artifacts.
- `/Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/primary-main-dirty.diff` - tracked dirty patch from primary checkout.
- `/Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/primary-main-untracked.tgz` - untracked primary checkout files.
- `/Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/beads/*.txt` and `*.json` - read-only Beads snapshots.
- `/Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/github/*.json` - read-only PR, issue, and Project #2 snapshots.
- `/Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/lane-ledger.md` - owner-facing disposition ledger.
- Optional mirror: `/private/tmp/codex-orka-cleanup-YYYYMMDD-HHMMSS/` - scratch copy only, never the only rollback handle.

**Modify only after owner approval for cleanup execution:**
- Git worktree registry under `/Users/Mace/Codex-Orka/.git/worktrees/`.
- Local branches such as `bead/ORKA-c1h0-skill-draw-recovery`, `bead/ORKA-hiz8-locked-gem-desaturate`, `bead/ORKA-v4mh-simulation-core-contract`, `bead/ORKA-idfa-appjs-offload`, and preview branches.
- Primary checkout dirty files under `/Users/Mace/Codex-Orka`.

**Do not edit directly during cleanup classification:**
- `/Users/Mace/Codex-Orka/.beads/interactions.jsonl`
- `/Users/Mace/Codex-Orka/web-runner/app.js`
- `/Users/Mace/Codex-Orka/Scripts/functionBank.js`
- `/Users/Mace/Codex-Orka/web-runner/modules/functionBank.js`
- `/Users/Mace/Codex-Orka/web-runner/systems/renderRuntime.js`

## Task 0: Owner Approval and Beads Gate

**Files:**
- Create: durable evidence files only after explicit owner approval.
- Modify: nothing in this task.

- [ ] **Step 1: Record exact owner approval text**

The executor must have an owner message equivalent to:

```text
I approve a repo cleanup execution run for Codex-Orka. You may create durable evidence outside the repo, create rollback tags/bundles, inspect GitHub Project #2, inspect Beads, and prepare an owner disposition ledger. Do not remove worktrees, delete branches, close PRs/issues, update Beads, update Project fields, merge, archive, reset, or restore until I approve the exact item by name.
```

Expected: if the owner approval does not include cleanup execution and rollback evidence creation, stop. A request to "plan cleanup" or "audit cleanup" is not execution approval. This approval does not allow a dirty local QA state to be converted into a checkpoint commit; that requires a later exact approval naming the path and files.

- [ ] **Step 2: Verify the controlling Beads lane**

```bash
cd /Users/Mace/.codex/worktrees/10c5/Codex-Orka
bd show ORKA-82o0
bd list --status in_progress --limit 0
bd list --status blocked --limit 0
```

Expected: `ORKA-82o0` is present as the lane-hygiene authority or the owner has named a replacement cleanup Bead. If no cleanup Bead is active or explicitly authorized, stop before creating tags, branches, archives, or worktrees.

- [ ] **Step 3: Verify public mirror disposition before mutation**

```bash
cd /Users/Mace/.codex/worktrees/10c5/Codex-Orka
gh pr list --repo mdtrahan/wishfire-game --state open --json number,title,url,headRefName,mergeStateStatus,mergeable
gh issue list --repo mdtrahan/wishfire-game --state open --limit 200 --json number,title,url,updatedAt,labels
gh project item-list 2 --owner mdtrahan --format json --limit 500
```

Expected: Project #2 rows and Beads state agree on which lanes are active, blocked, ready, stale, or owner-decision. If Project #2 says no close/delete/archive action is approved, stop before cleanup mutation.

- [ ] **Step 4: Freeze mutation scope**

Write the allowed mutation list in the evidence README before execution:

```text
Allowed before next owner gate:
- create durable evidence directory
- trace local QA provenance
- create rollback tag at agent-selected clean recovery anchor
- create temporary cleanup-preservation refs for detached HEADs
- create Git bundles and preservation archives
- inspect Git/Beads/GitHub/Project state
- write owner disposition ledger

Not allowed before next owner gate:
- remove worktrees
- delete, force-delete, archive, or move branch refs except temporary cleanup-preservation refs
- reset or restore files
- create a checkpoint commit from dirty local QA state
- update Beads
- update GitHub PRs/issues/Project
- merge or close PRs
- edit runtime code
```

Expected: every executor can tell the difference between evidence capture and cleanup mutation.

## Task 1: Trace Local QA Provenance and Freeze the Recovery Anchor

**Files:**
- Create: `/Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/README.md`
- Create: `/Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/git-all-refs.bundle`
- Create: `/Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/git-*.txt`
- Create: `/Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/qa-provenance.md`
- Create: `/Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/recovery-anchor.env`
- Create: `/Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/SHA256SUMS`

- [ ] **Step 1: Create a timestamped evidence directory**

```bash
STAMP="$(date -u +%Y%m%d-%H%M%S)"
EVIDENCE="/Users/Mace/Codex-Orka-cleanup-evidence/${STAMP}"
SCRATCH="/private/tmp/codex-orka-cleanup-${STAMP}"
mkdir -p "$EVIDENCE"/{beads,github,lane-bundles,restore-drill,worktree-archives,worktrees}
mkdir -p "$SCRATCH"
printf "# Codex-Orka cleanup checkpoint\n\nCreated: %s\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$EVIDENCE/README.md"
printf "Durable evidence: %s\nScratch mirror: %s\n" "$EVIDENCE" "$SCRATCH" >> "$EVIDENCE/README.md"
```

Expected: `echo "$EVIDENCE"` prints a unique durable `/Users/Mace/Codex-Orka-cleanup-evidence/*` directory. `/private/tmp` is only a scratch mirror.

- [ ] **Step 2: Capture Git baselines and local QA server provenance**

```bash
cd /Users/Mace/.codex/worktrees/10c5/Codex-Orka
git ls-remote origin refs/heads/main > "$EVIDENCE/git-ls-remote-main.txt"
REMOTE_MAIN_SHA="$(cut -f1 "$EVIDENCE/git-ls-remote-main.txt")"
LOCAL_ORIGIN_MAIN_SHA="$(git rev-parse origin/main)"
CURRENT_HEAD_SHA="$(git rev-parse HEAD)"
LOCAL_MAIN_SHA="$(git rev-parse main)"
{
  printf "REMOTE_MAIN_SHA=%s\n" "$REMOTE_MAIN_SHA"
  printf "LOCAL_ORIGIN_MAIN_SHA=%s\n" "$LOCAL_ORIGIN_MAIN_SHA"
  printf "CURRENT_HEAD_SHA=%s\n" "$CURRENT_HEAD_SHA"
  printf "LOCAL_MAIN_SHA=%s\n" "$LOCAL_MAIN_SHA"
} > "$EVIDENCE/git-baseline-shas.env"
git status --short --branch > "$EVIDENCE/current-worktree-status.txt"
git worktree list --porcelain > "$EVIDENCE/git-worktrees.porcelain.txt"

ps -ax -o pid,ppid,command \
  | grep -E 'node .*serve_web|python3 -m http.server|vite|webpack|agent-browser|web_game_playwright_client|web-runner' \
  | grep -v grep > "$EVIDENCE/local-qa-server-processes.txt" || true

lsof -nP -iTCP -sTCP:LISTEN > "$EVIDENCE/local-listening-ports.txt" || true

awk '{print $1}' "$EVIDENCE/local-qa-server-processes.txt" > "$EVIDENCE/local-qa-server-pids.txt"
while read -r pid; do
  test -n "$pid" || continue
  {
    printf "PID %s\n" "$pid"
    lsof -a -p "$pid" -d cwd -Fn || true
    lsof -a -p "$pid" -iTCP -sTCP:LISTEN -nP || true
    printf "\n"
  } >> "$EVIDENCE/local-qa-server-cwds-and-ports.txt"
done < "$EVIDENCE/local-qa-server-pids.txt"
```

Expected: the evidence identifies the local server process, listening port, and current working directory used for QA, or proves that no local QA server is currently discoverable. Do not infer that remote `main` is the recovery source merely because it is newer or cleaner.

- [ ] **Step 3: Write the QA provenance record and agent-selected recovery anchor**

Create `$EVIDENCE/qa-provenance.md` with the exact evidence used to decide the anchor:

```bash
cd /Users/Mace/.codex/worktrees/10c5/Codex-Orka
{
  printf "# Local QA Provenance\n\n"
  printf "## Required Decision Rule\n\n"
  printf "The recovery anchor is the worktree that served the trusted local QA gameplay state. Remote main is only a fallback committed baseline if local QA provenance is missing or proves the served worktree equals remote main.\n\n"
  printf "## Evidence Files\n\n"
  printf "- Git baseline SHAs: git-baseline-shas.env\n"
  printf "- Worktree list: git-worktrees.porcelain.txt\n"
  printf "- Local QA server processes: local-qa-server-processes.txt\n"
  printf "- Local listening ports: local-listening-ports.txt\n"
  printf "- Server cwd/port details: local-qa-server-cwds-and-ports.txt\n\n"
  printf "## Agent Recommendation\n\n"
  printf "Set RECOVERY_ANCHOR_KIND to one of: clean-local-commit, dirty-local-composite, remote-fallback, blocked-missing-provenance.\n"
  printf "Set REMOTE_MAIN_IS_AUTHORITY=yes only when evidence proves the QA server served remote main or no local QA-good state exists.\n"
} > "$EVIDENCE/qa-provenance.md"
```

Then write `$EVIDENCE/recovery-anchor.env` from the evidence. Use this exact schema:

```bash
cat > "$EVIDENCE/recovery-anchor.env" <<'ANCHOR'
RECOVERY_ANCHOR_KIND=blocked-missing-provenance
RECOVERY_ANCHOR_SHA=
RECOVERY_WORKTREE_PATH=
RECOVERY_BRANCH=
RECOVERY_QA_URL=
RECOVERY_HAS_DIRTY_TRACKED=unknown
RECOVERY_HAS_STAGED=unknown
RECOVERY_HAS_UNTRACKED=unknown
REMOTE_MAIN_IS_AUTHORITY=no
ANCHOR
```

Expected: the agent updates `recovery-anchor.env` to the best supported value from evidence:
- `clean-local-commit` when the QA-served worktree is clean and has a commit SHA.
- `dirty-local-composite` when the QA-served worktree has dirty, staged, or untracked state that may be part of the good game state.
- `remote-fallback` only when the QA-served worktree is proven to match remote `main`, or no local QA-good state can be identified after checking local server evidence.
- `blocked-missing-provenance` when the local QA server/source cannot be identified. In this case, stop and ask for the tested URL/session, not for a SHA.

- [ ] **Step 4: Create rollback tag and full Git bundle**

```bash
cd /Users/Mace/.codex/worktrees/10c5/Codex-Orka
. "$EVIDENCE/recovery-anchor.env"
test "$RECOVERY_ANCHOR_KIND" != "blocked-missing-provenance"
test -n "$RECOVERY_ANCHOR_SHA"
git cat-file -e "${RECOVERY_ANCHOR_SHA}^{commit}"
git tag "rollback/pre-repo-cleanup-${STAMP}" "$RECOVERY_ANCHOR_SHA"
git bundle create "$EVIDENCE/git-all-refs.bundle" --all
git bundle verify "$EVIDENCE/git-all-refs.bundle" > "$EVIDENCE/git-all-refs.bundle.verify.txt"
git show --stat --oneline "rollback/pre-repo-cleanup-${STAMP}" > "$EVIDENCE/rollback-tag-stat.txt"
find "$EVIDENCE" -type f -not -name SHA256SUMS -print0 | xargs -0 shasum -a 256 > "$EVIDENCE/SHA256SUMS"
```

Expected: bundle verification succeeds and the rollback tag points at the agent-selected `RECOVERY_ANCHOR_SHA`, not a guessed branch name. If `RECOVERY_ANCHOR_KIND=dirty-local-composite`, the tag protects only the committed base; the complete rollback handle is this tag plus the dirty/staged/untracked archives captured in Tasks 2 and 4. Do not clean or reset the QA-served worktree until those archives pass verification. If the dirty local state must become a single Git commit before cleanup, stop and request exact approval to create a checkpoint branch/commit naming the worktree and files.

## Task 2: Preserve Primary Checkout Dirt Before Touching It

**Files:**
- Create: `$EVIDENCE/primary-main-dirty.diff`
- Create: `$EVIDENCE/primary-main-staged.diff`
- Create: `$EVIDENCE/primary-main-untracked.tgz`
- Create: `$EVIDENCE/primary-main-ignored.manifest.txt`
- Create: `$EVIDENCE/primary-main-status.txt`

If local QA provenance points at `/Users/Mace/Codex-Orka`, this task is not just cleanup bookkeeping; it is part of the rollback handle for the good game state. A Git tag alone cannot restore dirty tracked changes, staged changes, or untracked assets.

- [ ] **Step 1: Capture tracked dirt**

```bash
cd /Users/Mace/Codex-Orka
git status --short --branch --untracked-files=all > "$EVIDENCE/primary-main-status.txt"
git diff --binary > "$EVIDENCE/primary-main-dirty.diff"
git diff --cached --binary > "$EVIDENCE/primary-main-staged.diff"
git diff --stat > "$EVIDENCE/primary-main-dirty.stat.txt"
git rev-parse HEAD > "$EVIDENCE/primary-main-head.txt"
```

Expected: the diff captures `.beads/interactions.jsonl`, `AGENTS.md`, and `governance/execution/beads-process.md` if they are still dirty.

- [ ] **Step 2: Capture untracked files**

```bash
cd /Users/Mace/Codex-Orka
git ls-files --others --exclude-standard -z > "$EVIDENCE/primary-main-untracked.zlist"
tar --null -T "$EVIDENCE/primary-main-untracked.zlist" -czf "$EVIDENCE/primary-main-untracked.tgz"
tar -tzf "$EVIDENCE/primary-main-untracked.tgz" > "$EVIDENCE/primary-main-untracked.manifest.txt"
git ls-files --others -i --exclude-standard > "$EVIDENCE/primary-main-ignored.manifest.txt"
```

Expected: manifest includes current untracked docs, research, backups, and reports if present.

- [ ] **Step 3: Prove primary checkout can be restored**

```bash
test -f "$EVIDENCE/primary-main-dirty.diff"
test -f "$EVIDENCE/primary-main-staged.diff"
test -f "$EVIDENCE/primary-main-untracked.tgz"
tar -tzf "$EVIDENCE/primary-main-untracked.tgz" >/dev/null
wc -l "$EVIDENCE/primary-main-status.txt" "$EVIDENCE/primary-main-untracked.manifest.txt" "$EVIDENCE/primary-main-ignored.manifest.txt" > "$EVIDENCE/primary-main-preservation-counts.txt"
find "$EVIDENCE" -type f -not -name SHA256SUMS -print0 | xargs -0 shasum -a 256 > "$EVIDENCE/SHA256SUMS"
```

Expected: tracked, staged, untracked, and ignored inventories are restorable or intentionally empty. Empty diff files are acceptable only when status proves there is no matching dirt.

## Task 3: Build the Lane Ledger Without Mutating Lanes

**Files:**
- Create: `$EVIDENCE/lane-ledger.md`
- Create: `$EVIDENCE/worktrees/*.txt`
- Create: `$EVIDENCE/beads/*.txt`
- Create: `$EVIDENCE/github/*.json`

- [ ] **Step 1: Snapshot Git worktrees and branches**

```bash
cd /Users/Mace/.codex/worktrees/10c5/Codex-Orka
git worktree list --porcelain > "$EVIDENCE/worktrees/git-worktree-list.porcelain.txt"
git branch --all --verbose --no-abbrev > "$EVIDENCE/worktrees/git-branches-all.txt"
git for-each-ref --sort=-committerdate '--format=%(committerdate:iso8601)%09%(refname:short)%09%(objectname)%09%(subject)' refs/heads > "$EVIDENCE/worktrees/local-branches.tsv"
```

Expected: output includes detached automation worktrees and bead worktrees.

- [ ] **Step 2: Snapshot live Beads**

```bash
cd /Users/Mace/.codex/worktrees/10c5/Codex-Orka
bd ready -n 100 > "$EVIDENCE/beads/ready.txt"
bd list --status in_progress --limit 0 > "$EVIDENCE/beads/in-progress.txt"
bd list --status blocked --limit 0 > "$EVIDENCE/beads/blocked.txt"
bd list --status open --limit 0 > "$EVIDENCE/beads/open.txt"
bd list --status closed --limit 0 > "$EVIDENCE/beads/closed.txt"
bd list --status in_progress --limit 0 --json > "$EVIDENCE/beads/in-progress.json"
bd list --status open --limit 0 --json > "$EVIDENCE/beads/open.json"
```

Expected: in-progress includes `ORKA-yjky`, `ORKA-nozn`, and `ORKA-6fle` unless live state has changed.

- [ ] **Step 3: Snapshot GitHub mirror state**

```bash
cd /Users/Mace/.codex/worktrees/10c5/Codex-Orka
gh pr list --repo mdtrahan/wishfire-game --state open --json number,title,url,headRefName,baseRefName,isDraft,mergeStateStatus,mergeable,updatedAt,statusCheckRollup > "$EVIDENCE/github/open-prs.json"
gh issue list --repo mdtrahan/wishfire-game --state open --limit 200 --json number,title,url,updatedAt,labels,assignees > "$EVIDENCE/github/open-issues.json"
gh project item-list 2 --owner mdtrahan --format json --limit 500 > "$EVIDENCE/github/project-2-items.json"
```

Expected: open PR list includes PR 126 if it remains open. Project #2 has rows for every active Bead/worktree lane or the missing row is listed as an owner-decision blocker.

- [ ] **Step 4: Start the lane ledger with all known lanes**

```bash
{
cat <<'LEDGER'
# Codex-Orka Cleanup Lane Ledger

Columns:
- Lane
- Bead status
- PR state
- Worktree path
- Branch
- Dirty state
- Unique-work diff
- QA-anchor overwrite risk
- Preservation handle
- Recommended disposition
- Owner approval required

## Generated Worktree Rows
LEDGER
awk '
  function emit() {
    if (path != "") {
      label = branch != "" ? branch : "detached:" head
      print "- " label " | path=" path " | head=" head " | detached=" detached " | disposition=unclassified"
    }
  }
  /^worktree / { emit(); path=$2; branch=""; head=""; detached="no"; next }
  /^HEAD / { head=$2; next }
  /^branch / { branch=$2; next }
  /^detached$/ { detached="yes"; next }
  { next }
  END { emit() }
' "$EVIDENCE/worktrees/git-worktree-list.porcelain.txt"
} > "$EVIDENCE/lane-ledger.md"
```

Expected: ledger exists before per-lane classification begins. Every path from `git worktree list --porcelain`, including detached automation worktrees, must receive an explicit row before any cleanup mutation.

## Task 4: Preserve Every Candidate Lane Before Disposition

**Files:**
- Create: `$EVIDENCE/lane-bundles/*.bundle`
- Create: `$EVIDENCE/worktree-archives/*`
- Create: `$EVIDENCE/worktrees/*-status.txt`
- Create: `$EVIDENCE/worktrees/*-unique.diffstat.txt`

- [ ] **Step 1: Create preservation refs for detached worktrees**

Run for every detached worktree found in the worktree list:

```bash
cd /Users/Mace/.codex/worktrees/10c5/Codex-Orka
awk '
  /^worktree / { path=$2; detached="no"; head=""; next }
  /^HEAD / { head=$2; next }
  /^detached$/ { detached="yes"; next }
  /^$/ {
    if (detached == "yes" && head != "") print head
    path=""; detached="no"; head=""
  }
  END {
    if (detached == "yes" && head != "") print head
  }
' "$EVIDENCE/worktrees/git-worktree-list.porcelain.txt" | sort -u > "$EVIDENCE/worktrees/detached-heads.txt"

while read -r head_sha; do
  test -n "$head_sha" || continue
  ref="refs/cleanup-preserve/${STAMP}/${head_sha}"
  git update-ref "$ref" "$head_sha"
  printf "%s %s\n" "$ref" "$head_sha" >> "$EVIDENCE/worktrees/detached-preservation-refs.txt"
done < "$EVIDENCE/worktrees/detached-heads.txt"
```

Expected: every detached HEAD has a named preservation ref before any worktree cleanup is discussed.

- [ ] **Step 2: For each branch or detached preservation ref, create a bundle and diff evidence**

Run against a generated ref list:

```bash
cd /Users/Mace/.codex/worktrees/10c5/Codex-Orka
. "$EVIDENCE/recovery-anchor.env"
test -n "$RECOVERY_ANCHOR_SHA"
{
  git for-each-ref --format='%(refname:short)' refs/heads
  if test -f "$EVIDENCE/worktrees/detached-preservation-refs.txt"; then
    awk '{print $1}' "$EVIDENCE/worktrees/detached-preservation-refs.txt"
  fi
} | sort -u > "$EVIDENCE/worktrees/preservation-refs.txt"

while read -r REF; do
  test -n "$REF" || continue
  SAFE_NAME="$(printf '%s' "$REF" | tr '/.' '__')"
  git bundle create "$EVIDENCE/lane-bundles/${SAFE_NAME}.bundle" "$REF"
  git bundle verify "$EVIDENCE/lane-bundles/${SAFE_NAME}.bundle" > "$EVIDENCE/lane-bundles/${SAFE_NAME}.verify.txt"
  git log --oneline --decorate "${RECOVERY_ANCHOR_SHA}..$REF" > "$EVIDENCE/worktrees/${SAFE_NAME}.commits-ahead.txt" || true
  git diff --name-status "${RECOVERY_ANCHOR_SHA}...$REF" > "$EVIDENCE/worktrees/${SAFE_NAME}.unique-name-status.txt" || true
  git diff --stat "${RECOVERY_ANCHOR_SHA}...$REF" > "$EVIDENCE/worktrees/${SAFE_NAME}.unique-diffstat.txt" || true
  git diff --name-status "$RECOVERY_ANCHOR_SHA" "$REF" > "$EVIDENCE/worktrees/${SAFE_NAME}.overwrite-risk-name-status.txt" || true
  git diff --stat "$RECOVERY_ANCHOR_SHA" "$REF" > "$EVIDENCE/worktrees/${SAFE_NAME}.overwrite-risk-diffstat.txt" || true
done < "$EVIDENCE/worktrees/preservation-refs.txt"
```

Expected: every local branch and detached preservation ref has a verified bundle and separate unique/overwrite-risk diff summaries. Broad diffs remain evidence for owner disposition, not cleanup permission.

- [ ] **Step 3: Capture full worktree dirt, staged changes, untracked files, and ignored inventory**

```bash
awk '/^worktree / { print $2 }' "$EVIDENCE/worktrees/git-worktree-list.porcelain.txt" > "$EVIDENCE/worktrees/worktree-paths.txt"

while read -r wt; do
  test -n "$wt" || continue
  safe="$(printf '%s' "$wt" | sed 's#^/##; s#[/. ]#_#g')"
  archive_dir="$EVIDENCE/worktree-archives/$safe"
  mkdir -p "$archive_dir"
  git -C "$wt" rev-parse HEAD > "$archive_dir/HEAD.txt"
  git -C "$wt" status --short --branch --untracked-files=all > "$archive_dir/status.txt"
  git -C "$wt" diff --binary > "$archive_dir/dirty.diff"
  git -C "$wt" diff --cached --binary > "$archive_dir/staged.diff"
  git -C "$wt" ls-files --others --exclude-standard -z > "$archive_dir/untracked.zlist"
  tar -C "$wt" --null -T "$archive_dir/untracked.zlist" -czf "$archive_dir/untracked.tgz"
  tar -tzf "$archive_dir/untracked.tgz" > "$archive_dir/untracked.manifest.txt"
  git -C "$wt" ls-files --others -i --exclude-standard > "$archive_dir/ignored.manifest.txt"
done < "$EVIDENCE/worktrees/worktree-paths.txt"

find "$EVIDENCE" -type f -not -name SHA256SUMS -print0 | xargs -0 shasum -a 256 > "$EVIDENCE/SHA256SUMS"
```

Expected: no worktree removal is considered unless that worktree has `HEAD.txt`, `status.txt`, `dirty.diff`, `staged.diff`, `untracked.tgz`, `untracked.manifest.txt`, and `ignored.manifest.txt`. A clean status is not enough by itself; preservation artifacts are mandatory for every path.

## Task 5: Classify Lanes Into Exact Dispositions

**Files:**
- Modify: `$EVIDENCE/lane-ledger.md`

- [ ] **Step 1: Mark active implementation lanes as protected**

Append:

```markdown
## Protected Active Lanes

- ORKA-yjky: protected until PR 126 conflict and Beads/branch mirror state are reconciled. Do not delete branch or worktree.
- ORKA-nozn: protected while Beads shows in_progress. Do not delete branch or worktree.
- ORKA-6fle: protected while Beads shows in_progress. Do not delete branch or worktree. If GitHub Project #2 has no matching row, record that as public-mirror drift, not deletion permission.
- Detached automation worktrees: protected until owner disposition names each path or session. Do not bucket-delete detached worktrees.
```

Expected: active lanes are excluded from cleanup deletion.

- [ ] **Step 2: Mark closed-but-active cleanup candidates**

Append:

```markdown
## Closed-But-Active Cleanup Candidates

- ORKA-hiz8: Beads closed, PR 127 merged, local worktree/branch still present. Candidate for worktree removal and local branch archival after owner approval and verified bundle.
- ORKA-c1h0: Beads closed, local worktree/branch still present, broad unique diff intersects runtime and tests. Candidate for archival only after owner approves the preserved state as obsolete.
```

Expected: `ORKA-hiz8` and `ORKA-c1h0` are separated; merged PR state makes `ORKA-hiz8` lower risk than `ORKA-c1h0`.

- [ ] **Step 3: Mark stale broad-diff lanes**

Append:

```markdown
## Stale Broad-Diff Lanes

- ORKA-v4mh: open Bead with old design branch; preserve contract doc before deciding merge, archive, or close.
- ORKA-idfa: open Bead with broad app shell extraction branch; preserve before deciding whether to split into fresh scoped beads.
- codex/preview-orka-6snw-yjky-combined: preview branch overlaps yjky/devtools work; preserve and archive unless owner explicitly wants it revived.
```

Expected: broad two-dot diffs are treated as stale-lane risk, not cleanup proof.

- [ ] **Step 4: Record owner approvals needed**

Append:

```markdown
## Owner Approval Required Before Mutation

1. Approve exact cleanup Bead authority and Project #2 state for the cleanup run.
2. Resolve PR 126 and PR 127 public mirror disposition before any closed-lane cleanup.
3. Remove local worktree for ORKA-hiz8.
4. Delete or archive local branch for ORKA-hiz8.
5. Archive or keep ORKA-c1h0 branch/worktree.
6. Archive, refresh, or split ORKA-idfa.
7. Archive, merge, or refresh ORKA-v4mh.
8. Archive preview branch codex/preview-orka-6snw-yjky-combined.
9. Decide whether primary checkout dirty policy/doc files should be committed, restored, or archived.
10. Decide whether untracked reports/research/backups should become repo docs, external evidence only, or archive artifacts.
11. Decide disposition for every detached automation worktree by path.
```

Expected: cleanup execution has a finite owner decision list.

## Task 6: Reconcile PR and Project Disposition Before Cleanup

**Files:**
- Modify: nothing unless the owner later authorizes public mirror updates.
- Create: `$EVIDENCE/github/pr-disposition.json`
- Create: `$EVIDENCE/github/project-disposition-check.md`

- [ ] **Step 1: Refresh PR 126 and PR 127 state**

```bash
cd /Users/Mace/.codex/worktrees/10c5/Codex-Orka
gh pr view 126 --repo mdtrahan/wishfire-game --json number,title,url,state,headRefName,baseRefName,mergeStateStatus,mergeable,statusCheckRollup,files,commits > "$EVIDENCE/github/pr-126-disposition.json"
gh pr view 127 --repo mdtrahan/wishfire-game --json number,title,url,state,closedAt,mergedAt,headRefName,baseRefName,mergeStateStatus,mergeable > "$EVIDENCE/github/pr-127-disposition.json"
```

Expected: PR 126 is either repaired/closed by a separate owner-approved lane or explicitly blocked from cleanup mutation. PR 127 merged state is recorded before considering `ORKA-hiz8` cleanup.

- [ ] **Step 2: Check Project #2 rows for cleanup blockers**

```bash
cd /Users/Mace/.codex/worktrees/10c5/Codex-Orka
gh project item-list 2 --owner mdtrahan --format json --limit 500 > "$EVIDENCE/github/project-2-before-cleanup.json"
printf "# Project Disposition Check\n\n" > "$EVIDENCE/github/project-disposition-check.md"
printf "Check every lane row for Bead ID, Status, Beads Status, Branch, and Overlap Risk before mutation.\n" >> "$EVIDENCE/github/project-disposition-check.md"
```

Expected: if Project #2 says no close/delete/archive action is approved, stop. If an active Bead/worktree such as `ORKA-6fle` lacks a row, stop and ask whether to reconcile the mirror first.

- [ ] **Step 3: Convert PR 126 repair into a separate owner-approved lane**

Do not repair PR 126 in this cleanup plan. Write this disposition:

```markdown
## PR 126 Disposition

- PR: https://github.com/mdtrahan/wishfire-game/pull/126
- Bead: ORKA-yjky
- Cleanup action: blocked until owner approves a PR repair, close, or supersede lane.
- Cleanup reason: active PR conflict and Beads/Project mirror state must be resolved before closed-lane cleanup.
```

Expected: cleanup execution cannot use PR repair as a hidden implementation step.

## Task 7: Execute Owner-Approved Worktree Cleanup Safely

**Files:**
- Modify: local Git worktree registry only after owner approval and `$bead-worktree-lifecycle` guidance.

- [ ] **Step 1: Load the required lifecycle skill before cleanup execution**

Before removing any worktree or branch, invoke `$bead-worktree-lifecycle` and follow its current cleanup instructions. If that skill is unavailable, stop and ask the owner whether raw Git lifecycle commands are approved for the exact named target.

Expected: cleanup execution follows repo worktree discipline, not ad hoc shell commands.

- [ ] **Step 2: Recheck target worktree preservation immediately before removal**

```bash
TARGET="/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-hiz8-locked-gem-desaturate"
SAFE_TARGET="$(printf '%s' "$TARGET" | sed 's#^/##; s#[/. ]#_#g')"
test -f "$EVIDENCE/worktree-archives/$SAFE_TARGET/HEAD.txt"
test -f "$EVIDENCE/worktree-archives/$SAFE_TARGET/dirty.diff"
test -f "$EVIDENCE/worktree-archives/$SAFE_TARGET/staged.diff"
test -f "$EVIDENCE/worktree-archives/$SAFE_TARGET/untracked.tgz"
git -C "$TARGET" status --short --branch --untracked-files=all > "$EVIDENCE/worktree-archives/$SAFE_TARGET/pre-removal-status.txt"
git -C "$TARGET" rev-parse HEAD > "$EVIDENCE/worktree-archives/$SAFE_TARGET/pre-removal-HEAD.txt"
```

Expected: target has complete preservation artifacts and current status matches the disposition packet. If not, stop and refresh preservation before cleanup.

- [ ] **Step 3: Verify exact owner approval for the named target**

```text
Approved target:
- Worktree path: /Users/Mace/Codex-Orka/.worktrees/wt-ORKA-hiz8-locked-gem-desaturate
- Branch: bead/ORKA-hiz8-locked-gem-desaturate
- Bead: ORKA-hiz8
- Bead status: CLOSED
- PR: https://github.com/mdtrahan/wishfire-game/pull/127 MERGED
- Project #2 row: cleanup approved or no active blocker
- Preservation bundle: verified
```

Expected: approval names the exact path and branch. Broad approval such as "clean stale stuff" is insufficient.

- [ ] **Step 4: Remove only the approved worktree through lifecycle procedure**

Use `$bead-worktree-lifecycle` cleanup execution for the target. If the owner explicitly approves raw Git fallback after the skill is unavailable, the fallback command is:

```bash
cd /Users/Mace/.codex/worktrees/10c5/Codex-Orka
git worktree remove "/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-hiz8-locked-gem-desaturate"
git worktree list --porcelain > "$EVIDENCE/worktrees/post-remove-ORKA-hiz8.porcelain.txt"
```

Expected: target path disappears from `git worktree list`; other worktrees remain untouched.

- [ ] **Step 5: Archive local branch, then delete only if safe**

```bash
cd /Users/Mace/.codex/worktrees/10c5/Codex-Orka
git branch "archive/local-cleanup/ORKA-hiz8-${STAMP}" "bead/ORKA-hiz8-locked-gem-desaturate"
git branch -d "bead/ORKA-hiz8-locked-gem-desaturate"
```

Expected: `git branch -d` succeeds only when Git considers the branch safely merged. If it refuses, stop. Never use `git branch -D` without a fresh owner approval naming the exact branch and acknowledging the preservation bundle.

## Task 8: Clean the Primary Checkout Only After Preservation and Owner Disposition

**Files:**
- Modify: `/Users/Mace/Codex-Orka` only after preservation and owner disposition.

- [ ] **Step 1: Fast-forward local main after preserving dirt**

```bash
cd /Users/Mace/Codex-Orka
. "$EVIDENCE/recovery-anchor.env"
if test "$RECOVERY_WORKTREE_PATH" = "/Users/Mace/Codex-Orka" && test "$RECOVERY_ANCHOR_KIND" = "dirty-local-composite"; then
  printf "STOP: primary local main is the dirty QA recovery state. Do not fast-forward until checkpoint approval exists.\n"
  exit 2
fi
git status --short --branch --untracked-files=all
git pull --ff-only
```

Expected: if primary local main is the dirty QA recovery state, stop before `git pull`. If dirty state blocks pull, stop and apply owner decision for the preserved dirty files before retrying.

- [ ] **Step 2: Apply owner disposition for tracked dirty files**

Allowed outcomes:

```text
.beads/interactions.jsonl: never hand-edit, never git-restore, and never reset as a cleanup shortcut. Resolve with live `bd` state, `bd doctor`, or an explicit Beads recovery procedure with before/after `bd list --json` and `bd show` snapshots.
AGENTS.md: keep only if current policy edits are approved.
governance/execution/beads-process.md: keep only if current process edits are approved.
```

Expected: tracked dirt is either committed under an approved bead/minor-doc exemption, preserved externally and left untouched, or resolved through the owning tool. `.beads/interactions.jsonl` is not restored from Git by hand.

- [ ] **Step 3: Apply owner disposition for untracked folders**

Allowed outcomes:

```text
docs/superpowers/: commit plan docs if approved.
game-design-research/: commit curated research docs if approved.
governance/audit/backups/: move to external evidence or commit only if repo policy wants durable backups.
reports/: commit only summarized reports; keep raw generated reports outside repo unless approved.
```

Expected: primary checkout reaches clean `git status --short --branch`.

## Task 9: Final Validation and Rollback Drill

**Files:**
- Create: `$EVIDENCE/final-validation.txt`
- Create: `$EVIDENCE/rollback-drill.txt`
- Create: `$EVIDENCE/restore-drill/*`

- [ ] **Step 1: Verify repository state**

```bash
cd /Users/Mace/.codex/worktrees/10c5/Codex-Orka
git worktree list --porcelain > "$EVIDENCE/final-worktree-list.porcelain.txt"
git branch --all --verbose --no-abbrev > "$EVIDENCE/final-branches.txt"
bd list --status in_progress --limit 0 > "$EVIDENCE/beads/final-in-progress.txt"
gh pr list --repo mdtrahan/wishfire-game --state open --json number,title,url,headRefName,mergeStateStatus,mergeable > "$EVIDENCE/github/final-open-prs.json"
gh project item-list 2 --owner mdtrahan --format json --limit 500 > "$EVIDENCE/github/final-project-2-items.json"
```

Expected: worktree count is at or below the repo cap, active Beads match active worktrees, and open PRs match active lanes.

- [ ] **Step 2: Run focused validation**

```bash
npm test -- --runInBand
```

If the repo does not support that command, run the established focused Node tests for touched surfaces:

```bash
node --test tests/devToolingModalContract.test.js tests/skillDraughtDevPanelContract.test.js tests/superGemRulesContract.test.js
```

Expected: selected validation passes. If full suite is too large or unavailable, record the exact command attempted and the scoped substitute.

- [ ] **Step 3: Prove rollback handles work in a scratch restore directory**

```bash
. "$EVIDENCE/recovery-anchor.env"
RESTORE="$EVIDENCE/restore-drill/full-bundle"
mkdir -p "$RESTORE"
git clone "$EVIDENCE/git-all-refs.bundle" "$RESTORE/repo" > "$EVIDENCE/rollback-drill.txt" 2>&1
git -C "$RESTORE/repo" checkout "rollback/pre-repo-cleanup-${STAMP}" >> "$EVIDENCE/rollback-drill.txt" 2>&1
git -C "$RESTORE/repo" rev-parse HEAD >> "$EVIDENCE/rollback-drill.txt"

for bundle in "$EVIDENCE"/lane-bundles/*.bundle; do
  git bundle verify "$bundle" >> "$EVIDENCE/rollback-drill.txt"
done

git -C "$RESTORE/repo" apply --check "$EVIDENCE/primary-main-dirty.diff" >> "$EVIDENCE/rollback-drill.txt" 2>&1 || {
  printf "primary-main-dirty.diff does not apply cleanly to rollback checkout; inspect before cleanup closeout\n" >> "$EVIDENCE/rollback-drill.txt"
}

mkdir -p "$RESTORE/untracked-extract"
tar -xzf "$EVIDENCE/primary-main-untracked.tgz" -C "$RESTORE/untracked-extract"
find "$RESTORE/untracked-extract" -type f | sort > "$EVIDENCE/restore-drill/primary-untracked-restored-files.txt"

if test "$RECOVERY_ANCHOR_KIND" = "dirty-local-composite"; then
  SAFE_RECOVERY_PATH="$(printf '%s' "$RECOVERY_WORKTREE_PATH" | sed 's#^/##; s#[/. ]#_#g')"
  QA_ARCHIVE="$EVIDENCE/worktree-archives/$SAFE_RECOVERY_PATH"
  test -f "$QA_ARCHIVE/dirty.diff"
  test -f "$QA_ARCHIVE/staged.diff"
  test -f "$QA_ARCHIVE/untracked.tgz"
  git -C "$RESTORE/repo" apply --check "$QA_ARCHIVE/dirty.diff" >> "$EVIDENCE/rollback-drill.txt" 2>&1 || {
    printf "QA dirty diff does not apply cleanly to rollback checkout; checkpoint commit is required before cleanup mutation\n" >> "$EVIDENCE/rollback-drill.txt"
  }
  mkdir -p "$RESTORE/qa-untracked-extract"
  tar -xzf "$QA_ARCHIVE/untracked.tgz" -C "$RESTORE/qa-untracked-extract"
  find "$RESTORE/qa-untracked-extract" -type f | sort > "$EVIDENCE/restore-drill/qa-untracked-restored-files.txt"
fi
```

Expected: the full bundle can be cloned, the rollback tag can be checked out, every lane bundle verifies, the primary dirty patch is at least checked against the rollback checkout, and untracked archive extraction produces files or an intentionally empty manifest. If the recovery anchor is `dirty-local-composite`, the QA-served worktree's dirty patch and untracked archive are also tested. If the QA dirty patch does not apply, stop before cleanup mutation and create an explicitly approved checkpoint branch/commit. This drill must not change the real repo.

## Rollback Playbook

Use this only with explicit owner approval.

### Restore primary tracked tree only from rollback tag

This is destructive to the target checkout. It does not restore deleted branches, removed worktrees, untracked files, Beads state, GitHub state, Project state, or lane refs. Before using it, create a fresh dirty archive of the target checkout and name the exact path being reset.

```bash
cd /Users/Mace/Codex-Orka
git status --short --branch --untracked-files=all
git reset --hard "rollback/pre-repo-cleanup-YYYYMMDD-HHMMSS"
```

Expected: the target checkout's tracked files return to the rollback tag tree. This is a last resort, not the default rollback drill.

### Restore dirty local QA composite state

Use this only when `recovery-anchor.env` says `RECOVERY_ANCHOR_KIND=dirty-local-composite`. A tag is not enough for this case; restoration requires the rollback tag plus the archived dirty/staged patches and untracked tarball for the QA-served worktree.

```bash
. /Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/recovery-anchor.env
cd "$RECOVERY_WORKTREE_PATH"
SAFE_RECOVERY_PATH="$(printf '%s' "$RECOVERY_WORKTREE_PATH" | sed 's#^/##; s#[/. ]#_#g')"
QA_ARCHIVE="/Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/worktree-archives/$SAFE_RECOVERY_PATH"
git reset --hard "rollback/pre-repo-cleanup-YYYYMMDD-HHMMSS"
git apply "$QA_ARCHIVE/dirty.diff"
git apply --cached "$QA_ARCHIVE/staged.diff"
tar -xzf "$QA_ARCHIVE/untracked.tgz" -C "$RECOVERY_WORKTREE_PATH"
```

Expected: the target worktree returns to the committed rollback base plus the dirty/staged/untracked local QA state. This is the relevant restore path when local QA, not remote `main`, was the trusted game state.

### Restore a deleted branch from its lane bundle

```bash
cd /Users/Mace/.codex/worktrees/10c5/Codex-Orka
git fetch /Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/lane-bundles/bead__ORKA-hiz8-locked-gem-desaturate.bundle \
  refs/heads/bead/ORKA-hiz8-locked-gem-desaturate:refs/heads/restore/ORKA-hiz8
git worktree add /Users/Mace/Codex-Orka/.worktrees/wt-restore-ORKA-hiz8 restore/ORKA-hiz8
```

Expected: the branch is restored under `restore/ORKA-hiz8` and available in a new worktree.

### Restore primary checkout dirty files

```bash
cd /Users/Mace/Codex-Orka
git apply /Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/primary-main-dirty.diff
git apply --cached /Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/primary-main-staged.diff
tar -xzf /Users/Mace/Codex-Orka-cleanup-evidence/YYYYMMDD-HHMMSS/primary-main-untracked.tgz
```

Expected: tracked, staged, and untracked primary checkout material returns to the captured pre-cleanup state. `.beads/interactions.jsonl` still requires Beads recovery discipline before accepting the restored workflow state.

## Self-Review

- Spec coverage: The plan covers rollback, branch/worktree cleanup, closed-but-active lanes, stale broad diffs, active lane protection, PR 126 conflict, primary checkout dirt, Beads/GitHub reconciliation, and final validation.
- Placeholder scan: No open-ended placeholder steps are present; each task has exact commands, expected outcomes, and stop conditions.
- Risk check: Destructive actions are gated behind evidence capture, owner disposition, clean worktree checks, and branch bundles. Broad diffs are treated as risk evidence, not deletion proof.
