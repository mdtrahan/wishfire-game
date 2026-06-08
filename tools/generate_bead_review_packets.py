#!/usr/bin/env python3
"""Generate public-safe Bead review packet artifacts.

The packets are review surfaces for Beads that need human triage, including
branch-backed draft PR candidates and Beads that do not yet have a code branch
suitable for a normal implementation PR. They are generated only from the
public-safe Beads-to-GitHub mapping and manifest.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ISSUE_ROW_RE = re.compile(
    r"^\| \[#(?P<number>\d+)\]\((?P<url>[^)]+)\) \| (?P<bead>ORKA-[^ |]+) \|"
)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def issue_links(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists():
        return {}
    links: dict[str, dict[str, str]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        match = ISSUE_ROW_RE.match(line)
        if match:
            links[match.group("bead")] = {
                "number": match.group("number"),
                "url": match.group("url"),
            }
    return links


def yes_no(value: bool) -> str:
    return "yes" if value else "no"


def comma_list(values: list[str]) -> str:
    return ", ".join(values) if values else "None"


def branch_overlap(row: dict[str, Any]) -> str:
    if not row.get("has_branch_overlap"):
        return "no"
    count = row.get("overlap_file_count") or 0
    noun = "file" if count == 1 else "files"
    return f"yes ({count} shared branch {noun}; file-level detail stays local)"


def render_packet(
    row: dict[str, Any],
    operation: dict[str, Any],
    issue: dict[str, str] | None,
    generated_at: str,
) -> str:
    issue_line = f"[#{issue['number']}]({issue['url']})" if issue else "Not published in mapping"
    title = row["github_issue_title"]
    return f"""# {title}

Generated: `{generated_at}`

Beads remains source of truth. This review packet is a public-safe GitHub-visible triage artifact; it is not an implementation branch and does not replace Beads.

## GitHub Links

- Mirror issue: {issue_line}
- Proposed review branch: `{operation['head']}`
- Proposed PR base: `{operation['base']}`

## Bead State

| Field | Value |
| --- | --- |
| Bead ID | `{row['bead_id']}` |
| Beads status | `{row['status']}` |
| Priority | `P{row['priority']}` |
| Type | `{row.get('type') or 'unknown'}` |
| Parent/Epic | `{row.get('parent') or 'None'}` |
| Blockers | {comma_list(row.get('blockers') or [])} |
| Blocks | {comma_list(row.get('blocks') or [])} |
| GitHub surface | `{row['github_surface']}` |
| Review artifact needed | `{yes_no(operation['requires_review_artifact'])}` |
| Branch-overlap signal | {branch_overlap(row)} |

## Review Request

- Decide whether this Bead should become an implementation branch, stay backlog-only, split into smaller Beads, or wait on blockers.
- Check overlap and dependency signals before assigning work.
- If implementation starts or continues, use the Bead-scoped branch/worktree and keep Beads as the workflow authority.

## Omitted From GitHub

Detailed Bead descriptions, acceptance criteria, comments, raw notes, changed-file paths, worktree paths, and `.beads` internals stay in Beads/local repo context.
"""


def render_index(rows: list[dict[str, Any]], generated_at: str) -> str:
    lines = [
        "# Bead Review Packet Index",
        "",
        f"Generated: `{generated_at}`",
        "",
        "Beads remains source of truth. These are public-safe review packet artifacts for draft PR candidates, including branch-backed Beads and Beads that need triage before code.",
        "",
        f"- Review packets: `{len(rows)}`",
        "",
        "| Bead | Status | Priority | Type | Packet | Mirror Issue |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for row in rows:
        issue = row["issue"]
        issue_link = f"[#{issue['number']}]({issue['url']})" if issue else "missing"
        lines.append(
            "| "
            + " | ".join(
                [
                    row["bead_id"],
                    row["status"],
                    f"P{row['priority']}",
                    row["type"] or "",
                    f"[packet]({Path(row['artifact_path']).name})",
                    issue_link,
                ]
            )
            + " |"
        )
    lines.extend(
        [
            "",
            "## Safety",
            "",
            "- Packets include Bead ID, title, status, priority, type, parent, dependency links, GitHub surface, proposed review branch, and branch-overlap signal only.",
            "- Packets omit Bead descriptions, acceptance criteria, comments, raw notes, changed-file paths, worktree paths, and `.beads` internals.",
        ]
    )
    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate public-safe Bead review packets.")
    parser.add_argument(
        "--mapping",
        default="governance/planning/beads-github-export/bead-github-mapping.json",
    )
    parser.add_argument(
        "--manifest",
        default="governance/planning/beads-github-export/github-publish-manifest.json",
    )
    parser.add_argument(
        "--published-issues",
        default="governance/planning/beads-github-export/published-issue-mapping.md",
    )
    parser.add_argument("--output-dir", default="governance/bead-reviews")
    parser.add_argument(
        "--review-required-only",
        action="store_true",
        help="Generate only packets for operations that explicitly require review artifacts.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    mapping = load_json(Path(args.mapping))
    manifest = load_json(Path(args.manifest))
    links = issue_links(Path(args.published_issues))
    rows_by_bead = {row["bead_id"]: row for row in mapping["beads"]}
    operations = manifest.get("draft_pr_operations") or []
    if args.review_required_only:
        operations = [operation for operation in operations if operation.get("requires_review_artifact")]
    generated_at = manifest.get("generated_at") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    index_rows: list[dict[str, Any]] = []
    for operation in operations:
        bead_id = operation["match_key"]
        row = rows_by_bead[bead_id]
        artifact_path = Path(operation["review_artifact_path"] or f"{bead_id}.md")
        if artifact_path.parent != output_dir:
            artifact_path = output_dir / artifact_path.name
        issue = links.get(bead_id)
        artifact_path.write_text(render_packet(row, operation, issue, generated_at), encoding="utf-8")
        index_rows.append(
            {
                "bead_id": bead_id,
                "status": row["status"],
                "priority": row["priority"],
                "type": row.get("type") or "",
                "artifact_path": str(artifact_path),
                "issue": issue,
            }
        )

    (output_dir / "INDEX.md").write_text(render_index(index_rows, generated_at), encoding="utf-8")
    print(f"Review packets: {len(index_rows)}")
    print(f"Wrote: {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
