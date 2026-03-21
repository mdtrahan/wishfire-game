#!/usr/bin/env python3
import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple


DEFAULT_HOT_FILES = [
    "web-runner/modules/functionBank.js",
    "Scripts/functionBank.js",
    "web-runner/app.js",
]

MODULE_SCOPE_TOKEN = "__MODULE__"


FUNCTION_PATTERNS = [
    re.compile(r"^\s*(?:export\s+)?function\s+([A-Za-z0-9_$]+)\s*\("),
    re.compile(
        r"^\s*(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?(?:function\b|\()"
    ),
    re.compile(r"^\s*(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?[A-Za-z0-9_$]*\s*=>"),
    re.compile(
        r"^\s*(?:export\s+)?(?:let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?(?:function\b|\()"
    ),
    re.compile(
        r"^\s*(?:export\s+)?(?:let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?[A-Za-z0-9_$]*\s*=>"
    ),
]


@dataclass
class ScopeError:
    file: str
    line: Optional[int]
    kind: str
    message: str


def repo_root() -> Path:
    env = os.environ.get("HOT_FILE_SCOPE_REPO_ROOT")
    if env:
        return Path(env).resolve()
    return Path(__file__).resolve().parents[1]


def hot_files() -> List[str]:
    raw = os.environ.get("HOT_FILE_SCOPE_HOT_FILES", "")
    if not raw.strip():
        return DEFAULT_HOT_FILES[:]
    return [part.strip() for part in re.split(r"[\n,]+", raw) if part.strip()]


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
    try:
        return json.loads(proc.stdout or "[]")
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"invalid json from {' '.join(cmd)}: {exc}") from exc


def staged_files(root: Path) -> List[str]:
    proc = run(["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"], root)
    return [line.strip() for line in proc.stdout.splitlines() if line.strip()]


def staged_hot_files(root: Path) -> List[str]:
    hot = set(hot_files())
    return [path for path in staged_files(root) if path in hot]


def parse_changed_lines(diff_text: str) -> List[int]:
    changed: List[int] = []
    pattern = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")
    for line in diff_text.splitlines():
        m = pattern.match(line)
        if not m:
            continue
        start = int(m.group(1))
        count = int(m.group(2) or "1")
        if count <= 0:
            continue
        changed.extend(range(start, start + count))
    return changed


def changed_lines_for_file(root: Path, file_path: str) -> List[int]:
    proc = run(["git", "diff", "--cached", "-U0", "--", file_path], root)
    lines = sorted(set(parse_changed_lines(proc.stdout)))
    return lines


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


def locate_changed_functions(root: Path, file_path: str) -> Tuple[List[str], bool, List[ScopeError]]:
    changed_lines = changed_lines_for_file(root, file_path)
    if not changed_lines:
        return [], False, []
    text = (root / file_path).read_text()
    lines = text.splitlines()
    ranges = parse_function_ranges(lines)
    functions: List[str] = []
    module_scope_needed = False
    errors: List[ScopeError] = []
    range_idx = 0
    for line_no in changed_lines:
        while range_idx < len(ranges) and ranges[range_idx][2] < line_no:
            range_idx += 1
        if range_idx >= len(ranges) or ranges[range_idx][1] > line_no:
            module_scope_needed = True
            continue
        fn_name = ranges[range_idx][0]
        if fn_name not in functions:
            functions.append(fn_name)
    return functions, module_scope_needed, errors


def validate_file_with_declared_functions(
    root: Path,
    file_path: str,
    declared: Sequence[str],
) -> List[ScopeError]:
    changed_lines = changed_lines_for_file(root, file_path)
    if not changed_lines:
        return []
    text = (root / file_path).read_text()
    lines = text.splitlines()
    ranges = parse_function_ranges(lines)
    declared_set = set(declared)
    errors: List[ScopeError] = []
    module_scope_allowed = MODULE_SCOPE_TOKEN in declared_set
    range_idx = 0
    for line_no in changed_lines:
        while range_idx < len(ranges) and ranges[range_idx][2] < line_no:
            range_idx += 1
        if range_idx >= len(ranges) or ranges[range_idx][1] > line_no:
            if not module_scope_allowed:
                errors.append(
                    ScopeError(
                        file=file_path,
                        line=line_no,
                        kind="outside_scope",
                        message=(
                            f"{file_path}:{line_no} is outside any function scope "
                            f"(declare {MODULE_SCOPE_TOKEN} to allow reviewed module-scope edits)"
                        ),
                    )
                )
            continue
        fn_name = ranges[range_idx][0]
        if fn_name not in declared_set:
            declared_csv = ",".join(declared)
            suffix = declared_csv if declared_csv else "<none>"
            errors.append(
                ScopeError(
                    file=file_path,
                    line=line_no,
                    kind="undeclared_function",
                    message=(
                        f"{file_path}:{line_no} is inside undeclared function '{fn_name}'"
                        f" (declared: {suffix})"
                    ),
                )
            )
    return errors


def get_active_issue_ids(root: Path) -> List[str]:
    if shutil_which("bd") is None:
        raise RuntimeError("bd command not found. Hot-file lock requires active Beads issue context.")
    payload = read_json(["bd", "list", "--status=in_progress", "--json"], root)
    return [str(item["id"]) for item in payload if isinstance(item, dict) and item.get("id")]


def shutil_which(cmd: str) -> Optional[str]:
    for part in os.environ.get("PATH", "").split(os.pathsep):
        if not part:
            continue
        candidate = Path(part) / cmd
        if candidate.exists() and os.access(candidate, os.X_OK):
            return str(candidate)
    return None


def bead_status(root: Path, issue_id: str) -> Optional[str]:
    proc = run(["bd", "show", issue_id], root, check=False)
    if proc.returncode != 0:
        return None
    first = (proc.stdout or "").splitlines()
    if not first:
        return None
    m = re.search(r"\[(?:[^\]]*·\s*)?([A-Z_]+)\s*\]", first[0])
    if m:
        return m.group(1)
    return None


def staged_blob_id(root: Path, file_path: str) -> Optional[str]:
    proc = run(["git", "rev-parse", f":{file_path}"], root, check=False)
    if proc.returncode != 0:
        return None
    return proc.stdout.strip() or None


def scope_file_path(root: Path, issue_id: str) -> Path:
    return root / ".beads" / "hot-file-lock" / f"{issue_id}.scope"


def stamp_file_path(root: Path, issue_id: str) -> Path:
    return root / ".beads" / "hot-file-lock" / f"{issue_id}.prepared.json"


def load_scope(scope_path: Path) -> Dict[str, List[str]]:
    if not scope_path.exists():
        return {}
    mapping: Dict[str, List[str]] = {}
    for raw in scope_path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            raise RuntimeError(f"Invalid declaration line in {scope_path}: {line}")
        file_part, fn_part = line.split(":", 1)
        file_key = file_part.strip()
        functions = [part.strip() for part in fn_part.split(",") if part.strip()]
        mapping[file_key] = functions
    return mapping


def write_scope(scope_path: Path, mapping: Dict[str, List[str]]) -> None:
    scope_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"{file_path}:{','.join(functions)}" for file_path, functions in mapping.items()]
    scope_path.write_text("\n".join(lines) + ("\n" if lines else ""))


def write_stamp(stamp_path: Path, payload: Dict[str, object]) -> None:
    stamp_path.parent.mkdir(parents=True, exist_ok=True)
    stamp_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")


def print_errors(title: str, errors: Sequence[ScopeError]) -> int:
    print(f"ERROR: {title}", file=sys.stderr)
    for err in errors:
        print(f"  - {err.message}", file=sys.stderr)
    return 1


def ensure_single_active_issue(root: Path, target_issue_id: Optional[str]) -> Tuple[int, Optional[str]]:
    try:
        active_ids = get_active_issue_ids(root)
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1, None
    if len(active_ids) != 1:
        print("ERROR: Hot-file lock requires exactly one in-progress Beads issue.", file=sys.stderr)
        if active_ids:
            print(f"Current in-progress: {', '.join(active_ids)}", file=sys.stderr)
        print("Set a single active issue before committing hot-file edits.", file=sys.stderr)
        return 1, None
    issue_id = active_ids[0]
    if target_issue_id and issue_id != target_issue_id:
        print(
            f"ERROR: Active in-progress bead is {issue_id}, but prepare target is {target_issue_id}.",
            file=sys.stderr,
        )
        print(f"Run: bd update {issue_id} --status open", file=sys.stderr)
        print(f"Run: bd update {target_issue_id} --status in_progress", file=sys.stderr)
        return 1, None
    return 0, issue_id


def build_restore_commands(target_issue_id: str, target_original_status: Optional[str], other_active: Sequence[str]) -> List[str]:
    commands: List[str] = []
    if target_original_status and target_original_status != "IN_PROGRESS":
        commands.append(f"bd update {target_issue_id} --status {target_original_status.lower()}")
    for issue_id in other_active:
        commands.append(f"bd update {issue_id} --status in_progress")
    return commands


def maybe_align_active_issue(root: Path, target_issue_id: str, align: bool) -> Tuple[bool, List[str]]:
    try:
        active_ids = get_active_issue_ids(root)
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return False, []

    if active_ids == [target_issue_id]:
        return True, []

    target_original_status = bead_status(root, target_issue_id)
    other_active = [issue_id for issue_id in active_ids if issue_id != target_issue_id]
    restore_commands = build_restore_commands(target_issue_id, target_original_status, other_active)

    if not align:
        print(
            "ERROR: Hot-file prepare needs exactly one active in-progress bead matching the target issue.",
            file=sys.stderr,
        )
        if active_ids:
            print(f"Current in-progress: {', '.join(active_ids)}", file=sys.stderr)
        else:
            print("Current in-progress: <none>", file=sys.stderr)
        print("Run one of these flows before retrying:", file=sys.stderr)
        for issue_id in other_active:
            print(f"  bd update {issue_id} --status open", file=sys.stderr)
        if target_issue_id not in active_ids:
            print(f"  bd update {target_issue_id} --status in_progress", file=sys.stderr)
        if restore_commands:
            print("After commit, restore truthful state with:", file=sys.stderr)
            for cmd in restore_commands:
                print(f"  {cmd}", file=sys.stderr)
        return False, []

    for issue_id in other_active:
        proc = run(["bd", "update", issue_id, "--status", "open"], root, check=False)
        if proc.returncode != 0:
            print(proc.stderr.strip() or proc.stdout.strip(), file=sys.stderr)
            return False, []
    if target_issue_id not in active_ids:
        proc = run(["bd", "update", target_issue_id, "--status", "in_progress"], root, check=False)
        if proc.returncode != 0:
            print(proc.stderr.strip() or proc.stdout.strip(), file=sys.stderr)
            return False, []
    print(f"Aligned active hot-file bead to {target_issue_id}.", file=sys.stderr)
    return True, restore_commands


def current_prepared_blobs(root: Path, hot_staged: Sequence[str]) -> Dict[str, str]:
    blobs: Dict[str, str] = {}
    for file_path in hot_staged:
        blob = staged_blob_id(root, file_path)
        if blob:
            blobs[file_path] = blob
    return blobs


def command_prepare(args: argparse.Namespace) -> int:
    root = repo_root()
    target_issue_id = args.issue_id
    ok, restore_commands = maybe_align_active_issue(root, target_issue_id, args.align_active)
    if not ok:
        return 1

    hot_staged = staged_hot_files(root)
    if not hot_staged:
        print("No staged hot-file edits detected. Nothing to prepare.")
        return 0

    mapping: Dict[str, List[str]] = {}
    errors: List[ScopeError] = []
    for file_path in hot_staged:
        functions, module_scope_needed, file_errors = locate_changed_functions(root, file_path)
        declared = functions[:]
        if module_scope_needed:
            declared.insert(0, MODULE_SCOPE_TOKEN)
        mapping[file_path] = declared
        errors.extend(file_errors)

    scope_path = scope_file_path(root, target_issue_id)
    stamp_path = stamp_file_path(root, target_issue_id)
    write_scope(scope_path, mapping)
    payload = {
        "issue_id": target_issue_id,
        "hot_files": {
            file_path: {
                "functions": mapping[file_path],
                "staged_blob": staged_blob_id(root, file_path),
            }
            for file_path in hot_staged
        },
    }
    write_stamp(stamp_path, payload)

    print(f"Prepared hot-file commit lane for {target_issue_id}.")
    for file_path, functions in mapping.items():
        print(f"  {file_path}: {', '.join(functions) if functions else '<none>'}")
    print(f"  scope: {scope_path.relative_to(root)}")
    print(f"  stamp: {stamp_path.relative_to(root)}")
    if restore_commands:
        print("After commit, restore truthful Beads state with:")
        for cmd in restore_commands:
            print(f"  {cmd}")
    return 0


def command_enforce(args: argparse.Namespace) -> int:
    root = repo_root()
    hot_staged = staged_hot_files(root)
    if not hot_staged:
        return 0

    rc, issue_id = ensure_single_active_issue(root, None)
    if rc != 0 or not issue_id:
        return 1

    scope_path = scope_file_path(root, issue_id)
    stamp_path = stamp_file_path(root, issue_id)
    if not scope_path.exists() or not stamp_path.exists():
        print(f"ERROR: Hot-file preparation missing for {issue_id}.", file=sys.stderr)
        print(f"Run tools/prepare_hot_file_commit.sh {issue_id}", file=sys.stderr)
        return 1

    try:
        stamp = json.loads(stamp_path.read_text())
    except json.JSONDecodeError:
        print(f"ERROR: Invalid prepared metadata in {stamp_path}.", file=sys.stderr)
        print(f"Run tools/prepare_hot_file_commit.sh {issue_id}", file=sys.stderr)
        return 1

    prepared = stamp.get("hot_files", {}) if isinstance(stamp, dict) else {}
    current_blobs = current_prepared_blobs(root, hot_staged)
    drift = False
    if set(prepared.keys()) != set(current_blobs.keys()):
        drift = True
    else:
        for file_path, blob in current_blobs.items():
            prepared_blob = None
            if isinstance(prepared.get(file_path), dict):
                prepared_blob = prepared[file_path].get("staged_blob")
            if prepared_blob != blob:
                drift = True
                break
    if drift:
        print(f"ERROR: Prepared hot-file scope for {issue_id} is stale.", file=sys.stderr)
        print(f"Run tools/prepare_hot_file_commit.sh {issue_id}", file=sys.stderr)
        return 1

    try:
        scope_map = load_scope(scope_path)
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    errors: List[ScopeError] = []
    for file_path in hot_staged:
        declared = scope_map.get(file_path)
        if not declared:
            errors.append(
                ScopeError(
                    file=file_path,
                    line=None,
                    kind="missing_declaration",
                    message=f"{file_path} modified but no declaration found in {scope_path.relative_to(root)}",
                )
            )
            continue
        errors.extend(validate_file_with_declared_functions(root, file_path, declared))
    if errors:
        return print_errors("hot-file validation failed", errors)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Prepare and enforce hot-file scope metadata.")
    sub = parser.add_subparsers(dest="command", required=True)

    prepare = sub.add_parser("prepare", help="Generate scope metadata from staged hot-file edits.")
    prepare.add_argument("issue_id", help="Beads issue id for the hot-file commit lane.")
    prepare.add_argument(
        "--align-active",
        action="store_true",
        help="Temporarily align active in-progress bead state to the target issue before preparing.",
    )
    prepare.set_defaults(func=command_prepare)

    enforce = sub.add_parser("enforce", help="Validate staged hot-file edits against prepared scope metadata.")
    enforce.set_defaults(func=command_enforce)
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
