#!/usr/bin/env python3
import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple


HOT_FILES = [
    "web-runner/modules/functionBank.js",
    "Scripts/functionBank.js",
    "web-runner/app.js",
]
MODULE_SCOPE_TOKEN = "__MODULE__"
SIGNIFICANT_FILE_THRESHOLD = 3
SIGNIFICANT_LINE_THRESHOLD = 80

FUNCTION_PATTERNS = [
    re.compile(r"^\s*(?:export\s+)?function\s+([A-Za-z0-9_$]+)\s*\("),
    re.compile(r"^\s*(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?(?:function\b|\()"),
    re.compile(r"^\s*(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?[A-Za-z0-9_$]*\s*=>"),
    re.compile(r"^\s*(?:export\s+)?(?:let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?(?:function\b|\()"),
    re.compile(r"^\s*(?:export\s+)?(?:let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?[A-Za-z0-9_$]*\s*=>"),
]


def repo_root() -> Path:
    env = os.environ.get("HOT_FILE_SCOPE_REPO_ROOT")
    if env:
        return Path(env).resolve()
    return Path(__file__).resolve().parents[1]


def run(cmd: Sequence[str], cwd: Path, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        cwd=str(cwd),
        text=True,
        capture_output=True,
        check=check,
    )


def read_json(cmd: Sequence[str], cwd: Path) -> object:
    proc = run(cmd, cwd, check=False)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "command failed")
    return json.loads(proc.stdout or "[]")


def staged_files(root: Path) -> List[str]:
    proc = run(["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"], root)
    return [line.strip() for line in proc.stdout.splitlines() if line.strip()]


def staged_blob_id(root: Path, file_path: str) -> Optional[str]:
    proc = run(["git", "rev-parse", f":{file_path}"], root, check=False)
    if proc.returncode != 0:
        return None
    return proc.stdout.strip() or None


def parse_changed_lines(diff_text: str) -> List[int]:
    changed: List[int] = []
    pattern = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")
    for line in diff_text.splitlines():
        match = pattern.match(line)
        if not match:
            continue
        start = int(match.group(1))
        count = int(match.group(2) or "1")
        if count <= 0:
            continue
        changed.extend(range(start, start + count))
    return changed


def changed_lines_for_file(root: Path, file_path: str) -> List[int]:
    proc = run(["git", "diff", "--cached", "-U0", "--", file_path], root)
    return sorted(set(parse_changed_lines(proc.stdout)))


def parse_function_ranges(lines: Sequence[str]) -> List[Tuple[str, int, int]]:
    ranges: List[Tuple[str, int, int]] = []
    active_name: Optional[str] = None
    active_start: Optional[int] = None
    for idx, line in enumerate(lines, start=1):
        matched = None
        for pattern in FUNCTION_PATTERNS:
            matched = pattern.match(line)
            if matched:
                break
        if not matched:
            continue
        if active_name is not None and active_start is not None:
            ranges.append((active_name, active_start, idx - 1))
        active_name = matched.group(1)
        active_start = idx
    if active_name is not None and active_start is not None:
        ranges.append((active_name, active_start, len(lines)))
    return ranges


def locate_changed_functions(root: Path, file_path: str) -> Tuple[List[str], bool]:
    changed_lines = changed_lines_for_file(root, file_path)
    if not changed_lines:
        return [], False
    text = (root / file_path).read_text()
    ranges = parse_function_ranges(text.splitlines())
    functions: List[str] = []
    module_scope_needed = False
    range_idx = 0
    for line_no in changed_lines:
        while range_idx < len(ranges) and ranges[range_idx][2] < line_no:
            range_idx += 1
        if range_idx >= len(ranges) or ranges[range_idx][1] > line_no:
            module_scope_needed = True
            continue
        name = ranges[range_idx][0]
        if name not in functions:
            functions.append(name)
    return functions, module_scope_needed


def get_active_issue_ids(root: Path) -> List[str]:
    payload = read_json(["bd", "list", "--status=in_progress", "--json"], root)
    return [str(item["id"]) for item in payload if isinstance(item, dict) and item.get("id")]


def ensure_single_active_issue(root: Path) -> str:
    active_ids = get_active_issue_ids(root)
    if len(active_ids) != 1:
        raise RuntimeError("commit compliance requires exactly one in-progress Beads issue")
    return active_ids[0]


def hot_staged_files(files: List[str]) -> List[str]:
    return [file_path for file_path in files if file_path in HOT_FILES]


def metadata_dir(root: Path) -> Path:
    return root / ".beads" / "commit-check"


def metadata_path(root: Path, issue_id: str) -> Path:
    return metadata_dir(root) / f"{issue_id}.json"


def scope_dir(root: Path) -> Path:
    return root / ".beads" / "hot-file-lock"


def scope_path(root: Path, issue_id: str) -> Path:
    return scope_dir(root) / f"{issue_id}.scope"


def total_changed_lines(root: Path, files: List[str]) -> int:
    return sum(len(changed_lines_for_file(root, file_path)) for file_path in files)


def classify_significance(root: Path, files: List[str]) -> Tuple[bool, Dict[str, object]]:
    hot = hot_staged_files(files)
    line_count = total_changed_lines(root, files)
    significant = bool(hot) or len(files) >= SIGNIFICANT_FILE_THRESHOLD or line_count >= SIGNIFICANT_LINE_THRESHOLD
    return significant, {
        "hot_files_touched": hot,
        "staged_file_count": len(files),
        "staged_line_count": line_count,
        "thresholds": {
            "hot_files_always_significant": True,
            "file_count": SIGNIFICANT_FILE_THRESHOLD,
            "line_count": SIGNIFICANT_LINE_THRESHOLD,
        },
    }


def changed_function_map(root: Path, files: List[str]) -> Dict[str, List[str]]:
    output: Dict[str, List[str]] = {}
    for file_path in files:
        functions, module_scope_needed = locate_changed_functions(root, file_path)
        names = list(functions)
        if module_scope_needed:
            names.append(MODULE_SCOPE_TOKEN)
        output[file_path] = names
    return output


def current_blob_map(root: Path, files: List[str]) -> Dict[str, str]:
    output: Dict[str, str] = {}
    for file_path in files:
        blob = staged_blob_id(root, file_path)
        if blob:
            output[file_path] = blob
    return output


def prepare_hot(root: Path, issue_id: str) -> int:
    active_issue = ensure_single_active_issue(root)
    if active_issue != issue_id:
        print(f"ERROR: active in-progress bead is {active_issue}, but prepare target is {issue_id}.", file=sys.stderr)
        print(f"Run: bd update {active_issue} --status open", file=sys.stderr)
        print(f"Run: bd update {issue_id} --status in_progress", file=sys.stderr)
        return 1

    files = hot_staged_files(staged_files(root))
    if not files:
        print("No staged hot files; hot-file scope not generated.")
        return 0

    changed = changed_function_map(root, files)
    lines = [f"{file_path}:{','.join(names)}" for file_path, names in changed.items()]
    target = scope_path(root, issue_id)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n")
    print(f"Wrote {target.relative_to(root)}")
    return 0


def prepare(root: Path, issue_id: str) -> int:
    active_issue = ensure_single_active_issue(root)
    if active_issue != issue_id:
        print(f"ERROR: active in-progress bead is {active_issue}, but prepare target is {issue_id}.", file=sys.stderr)
        print(f"Run: bd update {active_issue} --status open", file=sys.stderr)
        print(f"Run: bd update {issue_id} --status in_progress", file=sys.stderr)
        return 1

    files = staged_files(root)
    if not files:
        print("No staged files; commit compliance metadata not generated.")
        return 0

    significant, details = classify_significance(root, files)
    payload = {
        "issue_id": issue_id,
        "significant": significant,
        "details": details,
        "files": files,
        "changed_functions": changed_function_map(root, files),
        "staged_blobs": current_blob_map(root, files),
        "out_of_scope_hot_file_touch": False,
    }
    target = metadata_path(root, issue_id)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    print(f"Wrote {target.relative_to(root)}")
    if significant:
        print("Prepared commit compliance metadata for significant staged diff.")
    else:
        print("Prepared commit compliance metadata, but staged diff is currently below significant threshold.")
    return 0


def enforce(root: Path) -> int:
    files = staged_files(root)
    if not files:
        return 0

    significant, details = classify_significance(root, files)
    if not significant:
        return 0

    try:
        issue_id = ensure_single_active_issue(root)
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    target = metadata_path(root, issue_id)
    if not target.exists():
        print(f"ERROR: Missing commit compliance metadata for {issue_id}.", file=sys.stderr)
        print(f"Run tools/prepare_commit_check.sh {issue_id}", file=sys.stderr)
        return 1

    payload = json.loads(target.read_text())
    if payload.get("files") != files or payload.get("staged_blobs") != current_blob_map(root, files):
        print("ERROR: Commit compliance metadata is stale for the current staged diff.", file=sys.stderr)
        print(f"Run tools/prepare_commit_check.sh {issue_id}", file=sys.stderr)
        return 1

    if not payload.get("significant", False):
        print("ERROR: Commit compliance metadata claims the diff is not significant, but current diff is significant.", file=sys.stderr)
        print(f"Run tools/prepare_commit_check.sh {issue_id}", file=sys.stderr)
        return 1

    if details["hot_files_touched"] and payload.get("out_of_scope_hot_file_touch", False):
        print("ERROR: Prepared metadata declares out-of-scope hot-file touch.", file=sys.stderr)
        return 1

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare/enforce commit compliance for significant diffs.")
    sub = parser.add_subparsers(dest="command", required=True)

    prepare_parser = sub.add_parser("prepare")
    prepare_parser.add_argument("issue_id")

    prepare_hot_parser = sub.add_parser("prepare-hot")
    prepare_hot_parser.add_argument("issue_id")

    sub.add_parser("enforce")
    args = parser.parse_args()

    root = repo_root()
    if args.command == "prepare":
        return prepare(root, args.issue_id)
    if args.command == "prepare-hot":
        return prepare_hot(root, args.issue_id)
    return enforce(root)


if __name__ == "__main__":
    raise SystemExit(main())
