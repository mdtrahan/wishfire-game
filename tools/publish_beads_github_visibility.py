#!/usr/bin/env python3
"""Apply a Beads-to-GitHub visibility manifest through GitHub CLI.

Default mode is a no-write dry run. Use --apply after reviewing the manifest
and confirming GitHub CLI authentication.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any


BEAD_TITLE_RE = re.compile(r"^(ORKA-[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*):")


def run_command(args: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        check=check,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def load_manifest(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_existing_issues(repo: str) -> dict[str, dict[str, Any]]:
    result = run_command(
        [
            "gh",
            "issue",
            "list",
            "--repo",
            repo,
            "--state",
            "all",
            "--limit",
            "500",
            "--json",
            "number,title,state,url",
        ]
    )
    issues = json.loads(result.stdout)
    by_bead: dict[str, dict[str, Any]] = {}
    for issue in issues:
        match = BEAD_TITLE_RE.match(issue.get("title") or "")
        if match:
            by_bead[match.group(1)] = issue
    return by_bead


def write_temp_body(body: str) -> str:
    handle = tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False)
    with handle:
        handle.write(body)
    return handle.name


def create_issue(repo: str, operation: dict[str, Any], with_labels: bool) -> str:
    body_file = write_temp_body(operation["body"])
    args = [
        "gh",
        "issue",
        "create",
        "--repo",
        repo,
        "--title",
        operation["title"],
        "--body-file",
        body_file,
    ]
    if with_labels and operation.get("labels"):
        args.extend(["--label", ",".join(operation["labels"])])
    result = run_command(args)
    return result.stdout.strip()


def update_issue(repo: str, number: int, operation: dict[str, Any], with_labels: bool) -> str:
    body_file = write_temp_body(operation["body"])
    args = [
        "gh",
        "issue",
        "edit",
        str(number),
        "--repo",
        repo,
        "--title",
        operation["title"],
        "--body-file",
        body_file,
    ]
    if with_labels and operation.get("labels"):
        args.extend(["--add-label", ",".join(operation["labels"])])
    result = run_command(args)
    return result.stdout.strip()


def publish_issues(
    manifest: dict[str, Any],
    apply: bool,
    first_batch_only: bool,
    with_labels: bool,
) -> list[dict[str, Any]]:
    repo = manifest["repository"]
    first_batch = set(manifest.get("first_batch_bead_ids") or [])
    operations = manifest["issue_operations"]
    if first_batch_only:
        operations = [operation for operation in operations if operation["match_key"] in first_batch]

    existing = load_existing_issues(repo) if apply else {}
    results: list[dict[str, Any]] = []
    for operation in operations:
        bead_id = operation["match_key"]
        existing_issue = existing.get(bead_id)
        planned_action = "update_issue" if existing_issue else "create_issue"

        result: dict[str, Any] = {
            "bead_id": bead_id,
            "title": operation["title"],
            "action": planned_action,
            "applied": False,
        }

        if not apply:
            results.append(result)
            continue

        if existing_issue:
            output = update_issue(repo, int(existing_issue["number"]), operation, with_labels)
            result.update({"applied": True, "issue_number": existing_issue["number"], "url": output})
        else:
            output = create_issue(repo, operation, with_labels)
            result.update({"applied": True, "url": output})
        results.append(result)

    return results


def summarize_pr_gates(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for operation in manifest.get("draft_pr_operations") or []:
        rows.append(
            {
                "bead_id": operation["match_key"],
                "head": operation["head"],
                "ready_to_create": operation["ready_to_create"],
                "requires_branch_push": operation["requires_branch_push"],
                "blocked_by_remote_base": operation["blocked_by_remote_base"],
                "requires_review_artifact": operation["requires_review_artifact"],
            }
        )
    return rows


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Publish Beads GitHub visibility manifest.")
    parser.add_argument(
        "--manifest",
        default="governance/planning/beads-github-export/github-publish-manifest.json",
    )
    parser.add_argument("--apply", action="store_true", help="Actually create/update GitHub issues.")
    parser.add_argument("--first-batch-only", action="store_true", help="Limit issue publish to first batch.")
    parser.add_argument(
        "--with-labels",
        action="store_true",
        help="Apply proposed labels. Requires labels to already exist or gh will fail.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest = load_manifest(Path(args.manifest))
    issue_results = publish_issues(
        manifest,
        apply=args.apply,
        first_batch_only=args.first_batch_only,
        with_labels=args.with_labels,
    )
    pr_gates = summarize_pr_gates(manifest)
    output = {
        "mode": "apply" if args.apply else "dry-run",
        "repository": manifest["repository"],
        "issue_results": issue_results,
        "draft_pr_gates": pr_gates,
    }
    print(json.dumps(output, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
