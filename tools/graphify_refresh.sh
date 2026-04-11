#!/usr/bin/env bash
set -u

EVENT="${1:-post-commit}"
PREV_HEAD="${2:-}"
NEW_HEAD="${3:-}"
BRANCH_SWITCH="${4:-}"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" 2>/dev/null || exit 0

PYTHON=""
for candidate in python3.10 python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import graphify' >/dev/null 2>&1; then
    PYTHON="$candidate"
    break
  fi
done

[ -n "$PYTHON" ] || exit 0

export GRAPHIFY_EVENT="$EVENT"
export GRAPHIFY_PREV_HEAD="$PREV_HEAD"
export GRAPHIFY_NEW_HEAD="$NEW_HEAD"
export GRAPHIFY_BRANCH_SWITCH="$BRANCH_SWITCH"
export GRAPHIFY_QUIET="${GRAPHIFY_QUIET:-0}"

"$PYTHON" - <<'PY'
from __future__ import annotations

import os
import sys
import subprocess
import shutil
from pathlib import Path

from graphify.detect import CODE_EXTENSIONS, DOC_EXTENSIONS, IMAGE_EXTENSIONS
from graphify.watch import _rebuild_code

root = Path(".")
event = os.environ.get("GRAPHIFY_EVENT", "post-commit")
prev_head = os.environ.get("GRAPHIFY_PREV_HEAD", "")
new_head = os.environ.get("GRAPHIFY_NEW_HEAD", "")
branch_switch = os.environ.get("GRAPHIFY_BRANCH_SWITCH", "")
quiet = os.environ.get("GRAPHIFY_QUIET", "0") == "1"

graph_path = root / "graphify-out" / "graph.json"
if event == "post-checkout" and branch_switch == "1" and not graph_path.exists():
    raise SystemExit(0)


def beads_is_valid() -> bool:
    if subprocess.run(["bd", "ready", "--json"], cwd=root, capture_output=True, text=True, check=False).returncode != 0:
        return False
    result = subprocess.run(
        ["bd", "list", "--status=in_progress", "--json"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return False
    return '"id"' in result.stdout


if event in {"post-commit", "post-checkout"}:
    if not shutil.which("bd"):
        raise SystemExit(0)
    if not beads_is_valid():
        raise SystemExit(0)


def git_changed(*args: str) -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", *args],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    changed = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    if changed:
        return changed
    if event == "post-commit" and args[:2] == ("HEAD~1", "HEAD"):
        result = subprocess.run(
            ["git", "show", "--pretty=", "--name-only", "--no-renames", "HEAD"],
            cwd=root,
            capture_output=True,
            text=True,
            check=False,
        )
        return [line.strip() for line in result.stdout.splitlines() if line.strip()]
    return []


if event == "post-checkout":
    if branch_switch != "1" or not prev_head or not new_head:
        raise SystemExit(0)
    changed = git_changed(prev_head, new_head)
else:
    changed = git_changed("HEAD~1", "HEAD")

if not changed:
    raise SystemExit(0)

code_changed = False
docs_or_images_changed = False

for rel in changed:
    suffix = Path(rel).suffix.lower()
    if suffix in CODE_EXTENSIONS:
        code_changed = True
    elif suffix in DOC_EXTENSIONS or suffix == ".pdf" or suffix in IMAGE_EXTENSIONS:
        docs_or_images_changed = True

if not code_changed and not docs_or_images_changed:
    raise SystemExit(0)

if code_changed:
    try:
        _rebuild_code(root)
        if not quiet:
            print(f"[graphify hook] {event}: code graph refreshed")
    except Exception as exc:
        print(f"[graphify hook] {event}: code refresh failed: {exc}", file=sys.stderr)

if docs_or_images_changed:
    out = root / "graphify-out"
    out.mkdir(exist_ok=True)
    stale_flag = out / "needs_update"
    stale_flag.write_text(
        "Docs/images changed. Run graphify --update from Claude Code for semantic refresh.\n"
    )
    if not quiet:
        print(f"[graphify hook] {event}: docs/images changed - marked {stale_flag}")
PY

exit 0
