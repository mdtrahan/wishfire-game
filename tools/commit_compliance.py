#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

sys.dont_write_bytecode = True

from git_diff_parsing import parse_changed_lines, parse_function_ranges


HOT_FILES = [
    "web-runner/modules/functionBank.js",
    "Scripts/functionBank.js",
    "web-runner/app.js",
    "web-runner/systems/renderRuntime.js",
]
MODULE_SCOPE_TOKEN = "__MODULE__"
SIGNIFICANT_FILE_THRESHOLD = 3
SIGNIFICANT_LINE_THRESHOLD = 80

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


def staged_files(root: Path) -> List[str]:
    proc = run(["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"], root)
    return [line.strip() for line in proc.stdout.splitlines() if line.strip()]


def staged_blob_id(root: Path, file_path: str) -> Optional[str]:
    proc = run(["git", "rev-parse", f":{file_path}"], root, check=False)
    if proc.returncode != 0:
        return None
    return proc.stdout.strip() or None


def changed_lines_for_file(root: Path, file_path: str) -> List[int]:
    proc = run(["git", "diff", "--cached", "-U0", "--", file_path], root)
    return sorted(set(parse_changed_lines(proc.stdout)))


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


def hot_stamp_path(root: Path, issue_id: str) -> Path:
    return scope_dir(root) / f"{issue_id}.prepared.json"


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


def prepared_metadata(root: Path) -> List[Tuple[str, Path, Dict[str, object]]]:
    directory = metadata_dir(root)
    if not directory.exists():
        return []
    output: List[Tuple[str, Path, Dict[str, object]]] = []
    for path in sorted(directory.glob("*.json")):
        try:
            payload = json.loads(path.read_text())
        except json.JSONDecodeError:
            continue
        issue_id = str(payload.get("issue_id") or path.stem)
        if isinstance(payload, dict):
            output.append((issue_id, path, payload))
    return output


def matching_metadata(root: Path, files: List[str]) -> Tuple[Optional[str], Optional[Dict[str, object]], Optional[str]]:
    current_blobs = current_blob_map(root, files)
    same_files = [
        (issue_id, payload)
        for issue_id, _path, payload in prepared_metadata(root)
        if payload.get("files") == files
    ]
    exact = [
        (issue_id, payload)
        for issue_id, payload in same_files
        if payload.get("staged_blobs") == current_blobs
    ]
    if len(exact) == 1:
        return exact[0][0], exact[0][1], None
    if len(exact) > 1:
        return None, None, "multiple prepared metadata files match the current staged diff"
    if same_files:
        return same_files[0][0], same_files[0][1], "stale"
    return None, None, "missing"


def prepare_hot(root: Path, issue_id: str) -> int:
    files = hot_staged_files(staged_files(root))
    if not files:
        print("No staged hot files; hot-file scope not generated.")
        return 0

    changed = changed_function_map(root, files)
    lines = [f"{file_path}:{','.join(names)}" for file_path, names in changed.items()]
    target = scope_path(root, issue_id)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n")
    stamp = hot_stamp_path(root, issue_id)
    stamp.write_text(
        json.dumps(
            {
                "issue_id": issue_id,
                "hot_files": {
                    file_path: {
                        "functions": changed[file_path],
                        "staged_blob": staged_blob_id(root, file_path),
                    }
                    for file_path in files
                },
            },
            indent=2,
            sort_keys=True,
        )
        + "\n"
    )
    print(f"Wrote {target.relative_to(root)}")
    print(f"Wrote {stamp.relative_to(root)}")
    return 0


def prepare(root: Path, issue_id: str) -> int:
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

    issue_id, payload, metadata_error = matching_metadata(root, files)
    if metadata_error == "missing":
        print("ERROR: Missing commit compliance metadata for the current staged diff.", file=sys.stderr)
        print("Run tools/prepare_commit_check.sh <bd-id>", file=sys.stderr)
        return 1
    if metadata_error == "stale":
        print("ERROR: Commit compliance metadata is stale for the current staged diff.", file=sys.stderr)
        print(f"Run tools/prepare_commit_check.sh {issue_id}", file=sys.stderr)
        return 1
    if metadata_error:
        print(f"ERROR: {metadata_error}.", file=sys.stderr)
        print("Remove stale .beads/commit-check metadata or rerun tools/prepare_commit_check.sh <bd-id>.", file=sys.stderr)
        return 1

    if not issue_id or payload is None:
        print("ERROR: Missing commit compliance metadata for the current staged diff.", file=sys.stderr)
        print("Run tools/prepare_commit_check.sh <bd-id>", file=sys.stderr)
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
