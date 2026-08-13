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

sys.dont_write_bytecode = True

from git_diff_parsing import parse_changed_lines, parse_function_ranges


DEFAULT_HOT_FILES = [
    "web-runner/modules/functionBank.js",
    "Scripts/functionBank.js",
    "web-runner/app.js",
    "web-runner/systems/renderRuntime.js",
]

MODULE_SCOPE_TOKEN = "__MODULE__"


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


def staged_files(root: Path) -> List[str]:
    proc = run(["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"], root)
    return [line.strip() for line in proc.stdout.splitlines() if line.strip()]


def staged_hot_files(root: Path) -> List[str]:
    hot = set(hot_files())
    return [path for path in staged_files(root) if path in hot]


def changed_lines_for_file(root: Path, file_path: str) -> List[int]:
    proc = run(["git", "diff", "--cached", "-U0", "--", file_path], root)
    lines = sorted(set(parse_changed_lines(proc.stdout)))
    return lines


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


def current_prepared_blobs(root: Path, hot_staged: Sequence[str]) -> Dict[str, str]:
    blobs: Dict[str, str] = {}
    for file_path in hot_staged:
        blob = staged_blob_id(root, file_path)
        if blob:
            blobs[file_path] = blob
    return blobs


def prepared_stamps(root: Path) -> List[Tuple[str, Dict[str, object]]]:
    directory = scope_file_path(root, "placeholder").parent
    if not directory.exists():
        return []
    output: List[Tuple[str, Dict[str, object]]] = []
    for path in sorted(directory.glob("*.prepared.json")):
        try:
            payload = json.loads(path.read_text())
        except json.JSONDecodeError:
            continue
        issue_id = str(payload.get("issue_id") or path.name.removesuffix(".prepared.json"))
        if isinstance(payload, dict):
            output.append((issue_id, payload))
    return output


def matching_prepared_stamp(
    root: Path, hot_staged: Sequence[str]
) -> Tuple[Optional[str], Optional[Dict[str, object]], Optional[str]]:
    current_blobs = current_prepared_blobs(root, hot_staged)
    same_files = [
        (issue_id, payload)
        for issue_id, payload in prepared_stamps(root)
        if set((payload.get("hot_files") or {}).keys()) == set(current_blobs.keys())
    ]
    exact: List[Tuple[str, Dict[str, object]]] = []
    for issue_id, payload in same_files:
        prepared = payload.get("hot_files", {})
        if not isinstance(prepared, dict):
            continue
        if all(
            isinstance(prepared.get(file_path), dict)
            and prepared[file_path].get("staged_blob") == blob
            for file_path, blob in current_blobs.items()
        ):
            exact.append((issue_id, payload))
    if len(exact) == 1:
        return exact[0][0], exact[0][1], None
    if len(exact) > 1:
        return None, None, "multiple prepared hot-file stamps match the current staged diff"
    if same_files:
        return same_files[0][0], same_files[0][1], "stale"
    return None, None, "missing"


def command_prepare(args: argparse.Namespace) -> int:
    root = repo_root()
    target_issue_id = args.issue_id
    if args.align_active:
        print("--align-active is no longer needed; prepare uses the explicit issue id.", file=sys.stderr)

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
    return 0


def command_enforce(args: argparse.Namespace) -> int:
    root = repo_root()
    hot_staged = staged_hot_files(root)
    if not hot_staged:
        return 0

    issue_id, stamp, stamp_error = matching_prepared_stamp(root, hot_staged)
    if stamp_error == "missing":
        print("ERROR: Hot-file preparation missing for the current staged diff.", file=sys.stderr)
        print("Run tools/prepare_hot_file_commit.sh <bd-id>", file=sys.stderr)
        return 1
    if stamp_error == "stale":
        print(f"ERROR: Prepared hot-file scope for {issue_id} is stale.", file=sys.stderr)
        print(f"Run tools/prepare_hot_file_commit.sh {issue_id}", file=sys.stderr)
        return 1
    if stamp_error:
        print(f"ERROR: {stamp_error}.", file=sys.stderr)
        print("Remove stale .beads/hot-file-lock metadata or rerun tools/prepare_hot_file_commit.sh <bd-id>.", file=sys.stderr)
        return 1
    if not issue_id or stamp is None:
        print("ERROR: Hot-file preparation missing for the current staged diff.", file=sys.stderr)
        print("Run tools/prepare_hot_file_commit.sh <bd-id>", file=sys.stderr)
        return 1

    scope_path = scope_file_path(root, issue_id)
    stamp_path = stamp_file_path(root, issue_id)
    if not scope_path.exists() or not stamp_path.exists():
        print(f"ERROR: Hot-file preparation missing for {issue_id}.", file=sys.stderr)
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
        help="Deprecated no-op; prepare now uses the explicit issue id without changing Beads WIP state.",
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
