#!/usr/bin/env python3
"""Dry-run Beads to GitHub visibility export for Codex-Orka.

This tool keeps Beads authoritative. It produces public-safe GitHub-facing
planning artifacts so a team can inspect backlog, active work, blockers,
review needs, and branch-overlap signals without exporting private Beads
internals.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


CLOSED_STATUSES = {"closed", "done"}
ACTIVE_PR_STATUSES = {"in_progress", "blocked", "recovery"}
BEAD_ID_RE = re.compile(r"ORKA-[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*")
LOCAL_PATH_RE = re.compile(r"/Users/[^\s`),]+")
MAX_REPORT_TEXT = 180
PRIVATE_EXPORT_PATH_PREFIXES = (".beads/",)
DEFAULT_REPOSITORY = "mdtrahan/wishfire-game"
ACTIVE_GENERATED_OUTPUT_DIR = "governance/planning/beads-github-export"


@dataclass
class BranchInfo:
    name: str
    upstream: str = ""
    sha: str = ""
    ahead_of_main: int | None = None
    behind_main: int | None = None
    changed_files: list[str] = field(default_factory=list)
    worktree_path: str = ""


def run_command(args: list[str], cwd: Path, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=cwd,
        check=check,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def parse_json_array(stdout: str) -> list[dict[str, Any]]:
    start = stdout.find("[")
    if start == -1:
        raise ValueError("bd JSON output did not contain a JSON array")
    return json.loads(stdout[start:])


def redact(value: Any) -> Any:
    if isinstance(value, str):
        return LOCAL_PATH_RE.sub("[local-path]", value)
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, dict):
        return {key: redact(item) for key, item in value.items()}
    return value


def short_text(value: str | None, limit: int = MAX_REPORT_TEXT) -> str:
    text = redact(value or "")
    text = " ".join(str(text).split())
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "..."


def slug(value: str, fallback: str = "review") -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return cleaned[:64].strip("-") or fallback


def primary_worktree(repo: Path) -> Path:
    result = run_command(["git", "worktree", "list", "--porcelain"], repo, check=False)
    if result.returncode != 0:
        return repo

    current_path = ""
    for line in result.stdout.splitlines():
        if line.startswith("worktree "):
            current_path = line.removeprefix("worktree ")
        elif line == "branch refs/heads/main" and current_path:
            return Path(current_path)
    return repo


def load_beads(repo: Path) -> list[dict[str, Any]]:
    result = run_command(["bd", "list", "--json", "--limit", "0"], repo, check=False)
    if result.returncode != 0 and "[" not in result.stdout:
        raise RuntimeError(result.stderr.strip() or "bd list failed without JSON output")
    beads = parse_json_array(result.stdout)
    return [redact(bead) for bead in beads]


def parse_branches(repo: Path) -> dict[str, BranchInfo]:
    result = run_command(
        [
            "git",
            "for-each-ref",
            "--format=%(refname:short)|%(upstream:short)|%(objectname:short)",
            "refs/heads",
        ],
        repo,
    )
    branches: dict[str, BranchInfo] = {}
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        name, upstream, sha = (line.split("|") + ["", ""])[:3]
        branches[name] = BranchInfo(name=name, upstream=upstream, sha=sha)
    return branches


def attach_worktrees(repo: Path, branches: dict[str, BranchInfo]) -> None:
    result = run_command(["git", "worktree", "list", "--porcelain"], repo)
    current_path = ""
    for line in result.stdout.splitlines():
        if line.startswith("worktree "):
            current_path = line.removeprefix("worktree ")
        elif line.startswith("branch "):
            branch = line.removeprefix("branch refs/heads/")
            if branch in branches:
                branches[branch].worktree_path = current_path


def attach_branch_diffs(repo: Path, branches: dict[str, BranchInfo]) -> None:
    for branch in branches.values():
        if branch.name == "main":
            continue
        if not BEAD_ID_RE.search(branch.name):
            continue

        count = run_command(
            ["git", "rev-list", "--left-right", "--count", f"main...{branch.name}"],
            repo,
            check=False,
        )
        if count.returncode == 0:
            parts = count.stdout.strip().split()
            if len(parts) == 2:
                branch.behind_main = int(parts[0])
                branch.ahead_of_main = int(parts[1])

        diff = run_command(
            ["git", "diff", "--name-only", f"main...{branch.name}"],
            repo,
            check=False,
        )
        if diff.returncode == 0:
            branch.changed_files = [line for line in diff.stdout.splitlines() if line.strip()]


def bead_id_from_branch(branch_name: str) -> str | None:
    match = BEAD_ID_RE.search(branch_name)
    return match.group(0) if match else None


def branch_map(branches: dict[str, BranchInfo]) -> dict[str, BranchInfo]:
    mapped: dict[str, BranchInfo] = {}

    def branch_priority(branch: BranchInfo) -> tuple[int, str]:
        if branch.name.startswith("bead/"):
            return (0, branch.name)
        if branch.name.startswith("codex/"):
            return (1, branch.name)
        if branch.name.startswith("archive/"):
            return (2, branch.name)
        return (3, branch.name)

    for branch in sorted(branches.values(), key=branch_priority):
        bead_id = bead_id_from_branch(branch.name)
        if bead_id and bead_id not in mapped:
            mapped[bead_id] = branch
    return mapped


def safe_changed_files(files: list[str]) -> list[str]:
    return [
        file_path
        for file_path in files
        if not any(file_path.startswith(prefix) for prefix in PRIVATE_EXPORT_PATH_PREFIXES)
    ]


def build_overlap_summaries(branches_by_bead: dict[str, BranchInfo]) -> dict[str, dict[str, Any]]:
    file_to_beads: dict[str, set[str]] = defaultdict(set)
    for bead_id, branch in branches_by_bead.items():
        for file_path in safe_changed_files(branch.changed_files):
            file_to_beads[file_path].add(bead_id)

    overlapping_beads: dict[str, set[str]] = defaultdict(set)
    overlap_file_counts: dict[str, int] = defaultdict(int)
    for file_path, bead_ids in file_to_beads.items():
        if len(bead_ids) < 2:
            continue
        for bead_id in bead_ids:
            overlapping_beads[bead_id].update(other for other in bead_ids if other != bead_id)
            overlap_file_counts[bead_id] += 1

    return {
        bead_id: {
            "overlap_bead_ids": sorted(others),
            "overlap_file_count": overlap_file_counts[bead_id],
        }
        for bead_id, others in overlapping_beads.items()
    }


def remote_base_status(repo: Path, remote_ref: str = "origin/main", local_ref: str = "main") -> dict[str, Any]:
    result = run_command(
        ["git", "rev-list", "--left-right", "--count", f"{remote_ref}...{local_ref}"],
        repo,
        check=False,
    )
    if result.returncode != 0:
        return {
            "remote_ref": remote_ref,
            "local_ref": local_ref,
            "available": False,
            "remote_ahead": None,
            "local_ahead": None,
            "safe_for_branch_prs": False,
            "note": "Could not compare local main to remote main.",
        }

    parts = result.stdout.strip().split()
    remote_ahead = int(parts[0]) if len(parts) == 2 else None
    local_ahead = int(parts[1]) if len(parts) == 2 else None
    safe = remote_ahead == 0 and local_ahead == 0
    note = "Local main matches remote main." if safe else "Sync local main to GitHub before opening Bead branch PRs."
    return {
        "remote_ref": remote_ref,
        "local_ref": local_ref,
        "available": True,
        "remote_ahead": remote_ahead,
        "local_ahead": local_ahead,
        "safe_for_branch_prs": safe,
        "note": note,
    }


def dependency_ids(bead: dict[str, Any]) -> list[str]:
    ids: list[str] = []
    for dependency in bead.get("dependencies") or []:
        depends_on = dependency.get("depends_on_id")
        if depends_on:
            ids.append(depends_on)
    return sorted(set(ids))


def dependent_ids(all_beads: list[dict[str, Any]], bead_id: str) -> list[str]:
    dependents: list[str] = []
    for bead in all_beads:
        if bead.get("id") == bead_id:
            continue
        if bead_id in dependency_ids(bead):
            dependents.append(bead["id"])
    return sorted(set(dependents))


def classify_surface(bead: dict[str, Any], branch: BranchInfo | None) -> tuple[str, str]:
    status = bead.get("status", "")
    priority = int(bead.get("priority") or 0)
    has_reviewable_branch = branch is not None and (branch.ahead_of_main or 0) > 0

    if has_reviewable_branch:
        return "draft_pr", "Local bead branch has commits ahead of main."
    if status in ACTIVE_PR_STATUSES and branch:
        return "draft_pr", "Active Bead has a local branch; open as draft once branch is pushed."
    if status in ACTIVE_PR_STATUSES or (priority == 1 and status == "open"):
        return "review_packet_pr", "Create tracked review packet if human review is needed before code."
    return "issue_project", "Mirror as GitHub Issue/Project item; no PR needed yet."


def make_mapping(beads: list[dict[str, Any]], branches: dict[str, BranchInfo]) -> list[dict[str, Any]]:
    branches_by_bead = branch_map(branches)
    overlap_summaries = build_overlap_summaries(branches_by_bead)
    visible = [bead for bead in beads if bead.get("status") not in CLOSED_STATUSES]

    rows: list[dict[str, Any]] = []
    for bead in visible:
        bead_id = bead["id"]
        branch = branches_by_bead.get(bead_id)
        safe_files = safe_changed_files(branch.changed_files) if branch else []
        overlap_summary = overlap_summaries.get(
            bead_id,
            {"overlap_bead_ids": [], "overlap_file_count": 0},
        )
        surface, surface_reason = classify_surface(bead, branch)
        gh_issue_title = f"{bead_id}: {bead.get('title', '').strip()}"
        review_slug = slug(bead.get("title", "review"))
        proposed_review_branch = branch.name if branch else f"bead/{bead_id}-{review_slug}"

        rows.append(
            {
                "bead_id": bead_id,
                "github_issue_title": gh_issue_title,
                "github_surface": surface,
                "surface_reason": surface_reason,
                "status": bead.get("status"),
                "priority": bead.get("priority"),
                "type": bead.get("issue_type"),
                "labels": bead.get("labels") or [],
                "parent": bead.get("parent") or "",
                "blockers": dependency_ids(bead),
                "blocks": dependent_ids(beads, bead_id),
                "branch": branch.name if branch else "",
                "upstream": branch.upstream if branch else "",
                "ahead_of_main": branch.ahead_of_main if branch else None,
                "behind_main": branch.behind_main if branch else None,
                "changed_file_count": len(safe_files),
                "review_artifact_path": f"{bead_id}.md" if surface == "review_packet_pr" and not branch else "",
                "proposed_review_branch": proposed_review_branch,
                "has_branch_overlap": bool(overlap_summary["overlap_bead_ids"]),
                "overlap_bead_ids": overlap_summary["overlap_bead_ids"],
                "overlap_file_count": overlap_summary["overlap_file_count"],
                "export_note": "Beads remains source of truth; GitHub is the team-visible review surface.",
            }
        )
    return rows


def first_batch(mapping: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    surface_rank = {"draft_pr": 0, "review_packet_pr": 1, "issue_project": 2}
    status_rank = {"in_progress": 0, "recovery": 1, "blocked": 2, "open": 3, "deferred": 4}

    candidates = [
        row
        for row in mapping
        if row["github_surface"] in {"draft_pr", "review_packet_pr"}
        or row["status"] in {"in_progress", "blocked", "recovery"}
        or int(row["priority"] or 0) <= 1
    ]
    candidates.sort(
        key=lambda row: (
            surface_rank.get(row["github_surface"], 9),
            status_rank.get(row["status"], 9),
            int(row["priority"] or 9),
            row["bead_id"],
        )
    )
    return candidates[:limit]


def markdown_table(rows: list[list[str]], headers: list[str]) -> str:
    table = ["| " + " | ".join(headers) + " |"]
    table.append("| " + " | ".join(["---"] * len(headers)) + " |")
    for row in rows:
        table.append("| " + " | ".join(cell.replace("|", "\\|") for cell in row) + " |")
    return "\n".join(table)


def render_report(mapping: list[dict[str, Any]], batch: list[dict[str, Any]]) -> str:
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    status_counts = Counter(row["status"] for row in mapping)
    surface_counts = Counter(row["github_surface"] for row in mapping)
    pr_ready = sum(1 for row in mapping if row["github_surface"] == "draft_pr")
    review_packet = sum(1 for row in mapping if row["github_surface"] == "review_packet_pr")

    status_rows = [[str(status), str(count)] for status, count in sorted(status_counts.items())]
    surface_rows = [[str(surface), str(count)] for surface, count in sorted(surface_counts.items())]
    batch_rows = [
        [
            row["bead_id"],
            row["status"],
            f"P{row['priority']}",
            row["github_surface"],
            row["branch"] or row["review_artifact_path"] or "issue/project",
            short_text(row["github_issue_title"]),
        ]
        for row in batch
    ]
    all_rows = [
        [
            row["bead_id"],
            row["status"],
            f"P{row['priority']}",
            row["type"] or "",
            row["github_surface"],
            row["branch"] or "",
            ", ".join(row["blockers"]),
            ", ".join(row["blocks"]),
            short_text(row["github_issue_title"]),
        ]
        for row in mapping
    ]

    overlap_rows: list[list[str]] = []
    for row in mapping:
        if not row["has_branch_overlap"]:
            continue
        overlap_rows.append(
            [
                row["bead_id"],
                row["branch"] or "",
                ", ".join(row["overlap_bead_ids"]),
                str(row["overlap_file_count"]),
            ]
        )

    report = [
        "# Beads to GitHub Visibility Dry Run",
        "",
        f"Generated: `{generated_at}`",
        "",
        "Beads remains source of truth. This report proposes GitHub Issues, Project rows, and draft PR review packets for team visibility only.",
        "",
        "## Summary",
        "",
        f"- Visible non-closed Beads: `{len(mapping)}`",
        f"- Draft PR candidates: `{pr_ready}`",
        f"- Review-packet PR candidates: `{review_packet}`",
        f"- Issue/Project-only candidates: `{surface_counts.get('issue_project', 0)}`",
        "",
        "## Status Counts",
        "",
        markdown_table(status_rows, ["Status", "Count"]),
        "",
        "## GitHub Surface Counts",
        "",
        markdown_table(surface_rows, ["Surface", "Count"]),
        "",
        "## Proposed First Batch",
        "",
        markdown_table(batch_rows, ["Bead", "Status", "Priority", "Surface", "Branch Or Artifact", "GitHub Title"]),
        "",
        "## Branch Overlap Risks",
        "",
    ]

    if overlap_rows:
        report.append(markdown_table(overlap_rows, ["Bead", "Branch", "Overlaps With", "Shared File Count"]))
    else:
        report.append("No branch file-overlap risks detected among local Bead branches.")

    report.extend(
        [
            "",
            "## All Visible Beads",
            "",
            markdown_table(
                all_rows,
                ["Bead", "Status", "Priority", "Type", "Surface", "Branch", "Blockers", "Blocks", "GitHub Title"],
            ),
            "",
            "## Data Safety",
            "",
            "- GitHub-publishable artifacts include Bead IDs, titles, status, priority, type, labels, dependency links, branch names, and branch-overlap signals.",
            "- GitHub-publishable artifacts omit Bead descriptions, acceptance criteria, comments, raw notes, changed-file paths, worktree paths, `.beads` backup data, credentials, local database internals, and Beads implementation files.",
            "- Local filesystem paths in exported text are redacted to `[local-path]`.",
        ]
    )
    return "\n".join(report) + "\n"


def render_template() -> str:
    return """# <BEAD_ID>: <TITLE>

Beads remains source of truth. This PR is the team-visible review surface.

## Bead State
- Bead ID:
- Current Beads status:
- Priority:
- Type:
- Labels:
- Parent/epic:
- Blockers:
- Blocks:

## Scope

## Acceptance Criteria

## Branch And Worktree
- Branch:
- Upstream:
- Worktree:
- Ahead/behind main:

## Review Request
- Requested review type:
- Specific questions:
- Files or artifacts to inspect:

## Validation
- Automated checks:
- Manual QA:
- Known gaps:

## Overlap And Risk
- Shared files:
- Related Beads:
- Blocked decisions:

## Export Note
This PR mirrors Beads state for visibility. Do not infer that GitHub status replaces Beads status.
"""


def render_checklist() -> str:
    return """# Beads to GitHub Export Safety Checklist

Use this before creating or updating GitHub Issues, Project items, or draft PRs from Beads.

## Before Export
- Run `bd list --json --limit 0` from the target repo.
- Confirm the Bead export lane is active and scoped.
- Confirm local Git status and preserve unrelated dirty files.
- Confirm no runtime/gameplay files will be edited by the export pass.

## Data Rules
- Public GitHub issue and PR bodies may export Bead ID, title, status, priority, type, labels, parent, blockers, blocks, GitHub surface, branch presence, and branch-overlap signals.
- Do not export Bead descriptions, acceptance criteria, comments, raw notes, changed-file paths, worktree paths, `.beads` credentials, backup files, database internals, or private local metadata to GitHub.
- Redact local user paths before publishing text to GitHub.
- Keep Beads as source of truth for status.

## GitHub Surface Rules
- Use one GitHub Issue or Project item per visible non-closed Bead.
- Apply Project V2 operations only from a `publication_safety=public-safe` manifest.
- Use draft PRs for active, blocked, QA-ready, or review-worthy Beads.
- Use a tracked review artifact when a Bead needs review but has no code branch.
- Generate tracked review artifacts only from the public-safe mapping/manifest.
- Do not create fake implementation PRs for plain backlog items.

## Batch Rules
- Publish a small first batch before mirroring the full backlog.
- Prioritize in-progress Beads, local branches with commits ahead of main, blocked P1 Beads, and recovery lanes.
- Check branch file overlap before requesting human review.
- Include the Bead ID in every GitHub title.

## After Export
- Record the GitHub issue/project/PR mapping.
- Confirm every active Bead is visible in GitHub.
- Confirm Project item count matches the visible non-closed Bead count when Project V2 apply is available.
- Confirm review packet artifact count matches all draft PR operations, or use `--review-required-only` when intentionally checking only the no-branch subset.
- Confirm backlog-only Beads are visible without PR noise.
- Confirm no closed Beads were exported unless explicitly requested.
"""


def proposed_labels(row: dict[str, Any]) -> list[str]:
    labels = ["bead", f"bead-status:{row['status']}", f"priority:P{row['priority']}"]
    if row.get("type"):
        labels.append(f"type:{row['type']}")
    labels.extend(f"bead:{label}" for label in row.get("labels") or [])
    return labels


def yes_no(value: bool) -> str:
    return "yes" if value else "no"


def render_overlap_signal(row: dict[str, Any]) -> str:
    if not row["has_branch_overlap"]:
        return "`no`"
    count = row["overlap_file_count"]
    noun = "file" if count == 1 else "files"
    return f"`yes` ({count} shared branch {noun}; details stay in Beads/local review artifacts)"


def render_project_overlap_value(row: dict[str, Any]) -> str:
    if not row["has_branch_overlap"]:
        return "no"
    count = row["overlap_file_count"]
    noun = "file" if count == 1 else "files"
    return f"yes ({count} shared branch {noun})"


def render_project_field_values(row: dict[str, Any]) -> dict[str, str]:
    return {
        "Bead ID": row["bead_id"],
        "Beads Status": row["status"] or "",
        "Priority": f"P{row['priority']}",
        "Type": row.get("type") or "",
        "Parent/Epic": row.get("parent") or "",
        "Blockers": ", ".join(row["blockers"]),
        "Blocks": ", ".join(row["blocks"]),
        "GitHub Surface": row["github_surface"],
        "Branch": row["branch"] or row["proposed_review_branch"] or "",
        "Overlap Risk": render_project_overlap_value(row),
    }


def render_issue_body(row: dict[str, Any]) -> str:
    blockers = ", ".join(row["blockers"]) or "None"
    blocks = ", ".join(row["blocks"]) or "None"

    return f"""Beads remains source of truth. This GitHub issue is a public-safe visibility mirror.

## Bead State
- Bead ID: `{row['bead_id']}`
- Beads status: `{row['status']}`
- Priority: `P{row['priority']}`
- Type: `{row.get('type') or 'unknown'}`
- Parent/epic: `{row.get('parent') or 'None'}`
- Blockers: {blockers}
- Blocks: {blocks}

## GitHub Visibility Plan
- Surface: `{row['github_surface']}`
- Local branch present: `{yes_no(bool(row['branch']))}`
- Review artifact needed: `{yes_no(bool(row['review_artifact_path']))}`
- Branch-overlap signal: {render_overlap_signal(row)}
- Export note: {row['export_note']}

## Omitted From GitHub
Detailed Bead scope, acceptance criteria, comments, raw notes, changed-file paths, worktree paths, and `.beads` internals stay in Beads/local repo context.
"""


def render_pr_body(row: dict[str, Any], issue_reference: str = "<issue-number>") -> str:
    blockers = ", ".join(row["blockers"]) or "None"
    blocks = ", ".join(row["blocks"]) or "None"

    return f"""Beads remains source of truth. This draft PR is the public-safe team-visible review surface for `{row['bead_id']}`.

Linked Bead mirror issue: #{issue_reference}

## Bead State
- Bead ID: `{row['bead_id']}`
- Beads status: `{row['status']}`
- Priority: `P{row['priority']}`
- Type: `{row.get('type') or 'unknown'}`
- Blockers: {blockers}
- Blocks: {blocks}

## Branch
- Branch: `{row['branch'] or row['proposed_review_branch']}`
- Upstream: `{row['upstream'] or 'not configured'}`
- Ahead/behind main: `{row['ahead_of_main']}/{row['behind_main']}`

## Review Request
- Review type: `{row['github_surface']}`
- Inspect Bead scope, overlap, blockers, and whether this lane should continue, split, or wait.
- Branch-overlap signal: {render_overlap_signal(row)}

## Omitted From GitHub
Detailed Bead scope, acceptance criteria, comments, raw notes, changed-file paths, worktree paths, and `.beads` internals stay in Beads/local repo context.

## Export Note
This PR mirrors Beads state for visibility. Do not infer that GitHub status replaces Beads status.
"""


def build_publish_manifest(
    mapping: list[dict[str, Any]],
    batch: list[dict[str, Any]],
    repo: Path,
    repository_full_name: str,
) -> dict[str, Any]:
    remote_status = remote_base_status(repo)
    issue_operations = [
        {
            "operation": "create_or_update_issue",
            "match_key": row["bead_id"],
            "title": row["github_issue_title"],
            "labels": proposed_labels(row),
            "body": render_issue_body(row),
        }
        for row in mapping
    ]
    project_item_operations = [
        {
            "operation": "create_or_update_project_item",
            "match_key": row["bead_id"],
            "issue_title": row["github_issue_title"],
            "field_values": render_project_field_values(row),
        }
        for row in mapping
    ]

    pr_operations = []
    for row in mapping:
        if row["github_surface"] not in {"draft_pr", "review_packet_pr"}:
            continue
        has_branch = bool(row["branch"])
        can_open_branch_pr = has_branch and bool(row["upstream"]) and remote_status["safe_for_branch_prs"]
        pr_operations.append(
            {
                "operation": "create_draft_pr",
                "match_key": row["bead_id"],
                "title": row["github_issue_title"],
                "head": row["branch"] or row["proposed_review_branch"],
                "base": "main",
                "draft": True,
                "body": render_pr_body(row),
                "requires_review_artifact": row["github_surface"] == "review_packet_pr" and not has_branch,
                "review_artifact_path": row["review_artifact_path"],
                "requires_branch_push": has_branch and not bool(row["upstream"]),
                "blocked_by_remote_base": has_branch and not remote_status["safe_for_branch_prs"],
                "ready_to_create": can_open_branch_pr,
            }
        )

    return {
        "repository": repository_full_name,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "live bd list plus local git branch/worktree state",
        "source_of_truth": "Beads remains authoritative; GitHub mirrors visibility.",
        "publication_safety": "public-safe",
        "omitted_from_github": [
            "bead descriptions",
            "acceptance criteria",
            "comments",
            "raw notes",
            "changed-file paths",
            "worktree paths",
            ".beads internals",
            "credentials",
            "local database internals",
        ],
        "remote_base_status": remote_status,
        "counts": {
            "visible_beads": len(mapping),
            "issue_operations": len(issue_operations),
            "project_item_operations": len(project_item_operations),
            "draft_pr_operations": len(pr_operations),
            "first_batch": len(batch),
        },
        "first_batch_bead_ids": [row["bead_id"] for row in batch],
        "project_fields": [
            "Bead ID",
            "Beads Status",
            "Priority",
            "Type",
            "Parent/Epic",
            "Blockers",
            "Blocks",
            "GitHub Surface",
            "Branch",
            "Overlap Risk",
        ],
        "issue_operations": issue_operations,
        "project_item_operations": project_item_operations,
        "draft_pr_operations": pr_operations,
    }


def render_publish_plan(manifest: dict[str, Any], batch: list[dict[str, Any]]) -> str:
    remote = manifest["remote_base_status"]
    first_batch_rows = [
        [
            row["bead_id"],
            row["status"],
            f"P{row['priority']}",
            row["github_surface"],
            row["branch"] or row["review_artifact_path"] or "issue/project",
            "yes" if row["github_surface"] != "issue_project" else "no",
        ]
        for row in batch
    ]
    gate_rows = [
        ["Remote baseline", "pass" if remote["safe_for_branch_prs"] else "blocked", remote["note"]],
        ["Issue creation", "ready", "Manifest contains one create/update operation per visible non-closed Bead."],
        ["Project item creation", "ready", "Manifest contains one Project item operation per visible non-closed Bead."],
        [
            "Draft PR creation",
            "blocked" if not remote["safe_for_branch_prs"] else "ready",
            "Requires pushed branch/review artifact and remote main parity.",
        ],
    ]

    return "\n".join(
        [
            "# Beads to GitHub Publish Plan",
            "",
            f"Repository: `{manifest['repository']}`",
            "",
            "Beads remains source of truth. Publish GitHub records as visibility mirrors only.",
            "",
            "## Current Gates",
            "",
            markdown_table(gate_rows, ["Gate", "State", "Evidence"]),
            "",
            "## GitHub Access Notes",
            "",
            "- Verify local `gh auth status` and Project scope before applying writes from the local CLI.",
            "- Project item apply requires an existing GitHub Project owner and Project number; do not create a new Project without explicit approval.",
            "- The first connector write rejected detailed Bead bodies as too much non-public workspace data; `github-publish-manifest.json` is now public-safe and omits detailed scope, acceptance criteria, changed-file paths, worktree paths, and raw Beads internals.",
            "",
            "## Remote Baseline",
            "",
            f"- `{remote['local_ref']}` is `{remote['local_ahead']}` commits ahead of `{remote['remote_ref']}`.",
            f"- `{remote['remote_ref']}` is `{remote['remote_ahead']}` commits ahead of `{remote['local_ref']}`.",
            "- If the local baseline has commits not yet on GitHub, sync it through the protected-branch PR process before opening Bead branch PRs.",
            "",
            "## Publish Phases",
            "",
            "1. Create or update GitHub Issues for all visible non-closed Beads from the public-safe `github-publish-manifest.json`.",
            "2. Add those Issues to the team Project and expose the listed project fields from `project_item_operations`.",
            "3. Sync local `main` to GitHub through the protected-branch PR process.",
            "4. Push selected Bead branches or create tracked review artifacts.",
            "5. Open draft PRs for active, blocked, QA-ready, or review-worthy Beads.",
            "",
            "## First Batch",
            "",
            markdown_table(first_batch_rows, ["Bead", "Status", "Priority", "Surface", "Branch Or Artifact", "Needs PR"]),
            "",
            "## Safety Rules",
            "",
            "- Do not publish raw `.beads` internals.",
            "- Do not use GitHub status to overwrite Beads status in this pass.",
            "- Do not create fake implementation PRs for backlog-only Beads.",
            "- Prefer a small first batch before publishing the entire backlog.",
        ]
    ) + "\n"


def write_outputs(
    mapping: list[dict[str, Any]],
    batch: list[dict[str, Any]],
    output_dir: Path,
    repo: Path,
    repository_full_name: str,
) -> None:
    manifest = build_publish_manifest(mapping, batch, repo, repository_full_name)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "bead-github-mapping.json").write_text(
        json.dumps({"beads": mapping, "first_batch": batch}, indent=2) + "\n",
        encoding="utf-8",
    )
    (output_dir / "github-publish-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    (output_dir / "dry-run-report.md").write_text(render_report(mapping, batch), encoding="utf-8")
    (output_dir / "pr-body-template.md").write_text(render_template(), encoding="utf-8")
    (output_dir / "safety-checklist.md").write_text(render_checklist(), encoding="utf-8")
    (output_dir / "publish-plan.md").write_text(render_publish_plan(manifest, batch), encoding="utf-8")


def is_active_generated_output_dir(output_dir: str) -> bool:
    return Path(output_dir).as_posix().rstrip("/") == ACTIVE_GENERATED_OUTPUT_DIR


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export Beads visibility plan for GitHub.")
    parser.add_argument(
        "--output-dir",
        default="",
        help="Directory for generated dry-run artifacts. Required with --allow-generated-doc-output.",
    )
    parser.add_argument(
        "--bd-cwd",
        default="",
        help="Directory used for live bd reads. Defaults to the main worktree.",
    )
    parser.add_argument(
        "--repository",
        default=DEFAULT_REPOSITORY,
        help="GitHub repository in owner/name form for generated publish operations.",
    )
    parser.add_argument("--first-batch-limit", type=int, default=12)
    parser.add_argument(
        "--allow-generated-doc-output",
        action="store_true",
        help="Required to write generated Beads/GitHub visibility artifacts.",
    )
    parser.add_argument(
        "--allow-active-doc-output",
        action="store_true",
        help="Permit writing to governance/planning/beads-github-export instead of a quarantine or temporary directory.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.allow_generated_doc_output:
        print(
            "Refusing to write generated Beads/GitHub visibility docs without "
            "--allow-generated-doc-output."
        )
        print("Use an explicit --output-dir, preferably under governance/audit/quarantine/ or /tmp.")
        return 2
    if not args.output_dir:
        print("Refusing to choose a default output directory. Pass --output-dir explicitly.")
        return 2
    if is_active_generated_output_dir(args.output_dir) and not args.allow_active_doc_output:
        print(
            "Refusing to write generated export artifacts into the active planning path without "
            "--allow-active-doc-output."
        )
        print("Prefer a dated quarantine or temporary output directory.")
        return 2
    repo = Path.cwd()
    bd_cwd = Path(args.bd_cwd).expanduser().resolve() if args.bd_cwd else primary_worktree(repo)
    beads = load_beads(bd_cwd)
    branches = parse_branches(repo)
    attach_worktrees(repo, branches)
    attach_branch_diffs(repo, branches)
    mapping = make_mapping(beads, branches)
    batch = first_batch(mapping, args.first_batch_limit)
    write_outputs(mapping, batch, repo / args.output_dir, repo, args.repository)

    print(f"Visible non-closed Beads: {len(mapping)}")
    print(f"Draft PR candidates: {sum(1 for row in mapping if row['github_surface'] == 'draft_pr')}")
    print(f"Review-packet PR candidates: {sum(1 for row in mapping if row['github_surface'] == 'review_packet_pr')}")
    print(f"Wrote: {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
