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
PUBLIC_SAFE_LEVEL = "public-safe"


def run_command(
    args: list[str],
    check: bool = True,
    input_text: str | None = None,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        check=check,
        input=input_text,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def load_manifest(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def is_public_safe_manifest(manifest: dict[str, Any]) -> bool:
    return manifest.get("publication_safety") == PUBLIC_SAFE_LEVEL


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
            "number,title,state,url,id",
        ]
    )
    issues = json.loads(result.stdout)
    by_bead: dict[str, dict[str, Any]] = {}
    for issue in issues:
        match = BEAD_TITLE_RE.match(issue.get("title") or "")
        if match:
            by_bead[match.group(1)] = issue
    return by_bead


def repo_owner(repo: str) -> str:
    return repo.split("/", 1)[0]


def run_graphql(query: str, variables: dict[str, Any]) -> dict[str, Any]:
    payload = json.dumps({"query": query, "variables": variables})
    result = run_command(["gh", "api", "graphql", "--input", "-"], input_text=payload)
    data = json.loads(result.stdout)
    if data.get("errors"):
        raise RuntimeError(json.dumps(data["errors"], indent=2))
    return data


def load_project_v2(owner: str, number: int, owner_type: str) -> dict[str, Any]:
    root = "organization" if owner_type == "organization" else "user"
    query = f"""
query($owner: String!, $number: Int!) {{
  {root}(login: $owner) {{
    projectV2(number: $number) {{
      id
      fields(first: 100) {{
        nodes {{
          __typename
          ... on ProjectV2Field {{
            id
            name
            dataType
          }}
          ... on ProjectV2SingleSelectField {{
            id
            name
            options {{
              id
              name
            }}
          }}
        }}
      }}
    }}
  }}
}}
"""
    data = run_graphql(query, {"owner": owner, "number": number})
    project = ((data.get("data") or {}).get(root) or {}).get("projectV2")
    if not project:
        raise RuntimeError(f"Project V2 #{number} was not found for {owner_type} {owner}.")
    fields = {
        field["name"]: field
        for field in (project.get("fields") or {}).get("nodes") or []
        if field and field.get("name")
    }
    return {"id": project["id"], "fields": fields}


def existing_project_item_id(issue_node_id: str, project_id: str) -> str | None:
    query = """
query($contentId: ID!) {
  node(id: $contentId) {
    ... on Issue {
      projectItems(first: 50) {
        nodes {
          id
          project {
            id
          }
        }
      }
    }
  }
}
"""
    data = run_graphql(query, {"contentId": issue_node_id})
    items = (((data.get("data") or {}).get("node") or {}).get("projectItems") or {}).get("nodes") or []
    for item in items:
        if ((item or {}).get("project") or {}).get("id") == project_id:
            return item["id"]
    return None


def add_project_item(project_id: str, issue_node_id: str) -> str:
    query = """
mutation($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
    item {
      id
    }
  }
}
"""
    data = run_graphql(query, {"projectId": project_id, "contentId": issue_node_id})
    return data["data"]["addProjectV2ItemById"]["item"]["id"]


def project_field_value(field: dict[str, Any], raw_value: str) -> tuple[dict[str, Any] | None, str]:
    value = str(raw_value or "").strip()
    if not value:
        return None, "empty"
    if field.get("__typename") == "ProjectV2SingleSelectField":
        for option in field.get("options") or []:
            if option.get("name", "").casefold() == value.casefold():
                return {"singleSelectOptionId": option["id"]}, "single_select"
        return None, "missing_select_option"
    data_type = field.get("dataType")
    if data_type == "TEXT":
        return {"text": value}, "text"
    if data_type == "NUMBER":
        try:
            return {"number": float(value)}, "number"
        except ValueError:
            return None, "not_number"
    return None, f"unsupported_{data_type or 'field'}"


def update_project_field(
    project_id: str,
    item_id: str,
    field: dict[str, Any],
    value: dict[str, Any],
) -> None:
    query = """
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
  updateProjectV2ItemFieldValue(
    input: {projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value}
  ) {
    projectV2Item {
      id
    }
  }
}
"""
    run_graphql(
        query,
        {
            "projectId": project_id,
            "itemId": item_id,
            "fieldId": field["id"],
            "value": value,
        },
    )


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


def publish_project_items(
    manifest: dict[str, Any],
    apply: bool,
    first_batch_only: bool,
    project_owner: str,
    project_owner_type: str,
    project_number: int | None,
) -> list[dict[str, Any]]:
    repo = manifest["repository"]
    first_batch = set(manifest.get("first_batch_bead_ids") or [])
    operations = manifest.get("project_item_operations") or []
    if first_batch_only:
        operations = [operation for operation in operations if operation["match_key"] in first_batch]

    existing = load_existing_issues(repo) if apply else {}
    project = load_project_v2(project_owner, int(project_number), project_owner_type) if apply else None
    results: list[dict[str, Any]] = []
    for operation in operations:
        bead_id = operation["match_key"]
        field_values = operation.get("field_values") or {}
        result: dict[str, Any] = {
            "bead_id": bead_id,
            "issue_title": operation["issue_title"],
            "action": "add_or_update_project_item",
            "field_count": len(field_values),
            "applied": False,
        }

        if not apply:
            results.append(result)
            continue

        issue = existing.get(bead_id)
        if not issue:
            result.update({"error": "matching_issue_not_found"})
            results.append(result)
            continue

        assert project is not None
        project_id = project["id"]
        item_id = existing_project_item_id(issue["id"], project_id)
        project_action = "update_project_item" if item_id else "add_project_item"
        if not item_id:
            item_id = add_project_item(project_id, issue["id"])

        field_results: list[dict[str, Any]] = []
        for field_name, raw_value in field_values.items():
            field = project["fields"].get(field_name)
            if not field:
                field_results.append({"field": field_name, "applied": False, "reason": "missing_project_field"})
                continue
            value, value_type = project_field_value(field, raw_value)
            if not value:
                field_results.append({"field": field_name, "applied": False, "reason": value_type})
                continue
            update_project_field(project_id, item_id, field, value)
            field_results.append({"field": field_name, "applied": True, "value_type": value_type})

        result.update(
            {
                "applied": True,
                "action": project_action,
                "issue_number": issue.get("number"),
                "issue_url": issue.get("url"),
                "project_item_id": item_id,
                "field_results": field_results,
            }
        )
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
    parser.add_argument(
        "--skip-issues",
        action="store_true",
        help="Do not create/update Issues. Useful when applying only Project V2 items.",
    )
    parser.add_argument("--first-batch-only", action="store_true", help="Limit issue publish to first batch.")
    parser.add_argument(
        "--project-owner",
        default="",
        help="GitHub user or organization that owns the Project V2. Defaults to repository owner.",
    )
    parser.add_argument(
        "--project-owner-type",
        choices=["user", "organization"],
        default="user",
        help="Whether --project-owner is a user or organization.",
    )
    parser.add_argument(
        "--project-number",
        type=int,
        default=None,
        help="Project V2 number. Project writes are dry-run unless this is supplied with --apply.",
    )
    parser.add_argument(
        "--with-labels",
        action="store_true",
        help="Apply proposed labels. Requires labels to already exist or gh will fail.",
    )
    parser.add_argument(
        "--allow-detailed-internal",
        action="store_true",
        help="Allow applying an older/detailed manifest. Do not use for public GitHub publication.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest = load_manifest(Path(args.manifest))
    if args.apply and not is_public_safe_manifest(manifest) and not args.allow_detailed_internal:
        raise SystemExit(
            "Refusing to apply manifest without publication_safety=public-safe. "
            "Regenerate with tools/export_beads_github_visibility.py or pass "
            "--allow-detailed-internal only for explicitly approved internal use."
        )
    issue_results = []
    if not args.skip_issues:
        issue_results = publish_issues(
            manifest,
            apply=args.apply,
            first_batch_only=args.first_batch_only,
            with_labels=args.with_labels,
        )
    project_owner = args.project_owner or repo_owner(manifest["repository"])
    project_apply = bool(args.apply and args.project_number is not None)
    project_item_results = publish_project_items(
        manifest,
        apply=project_apply,
        first_batch_only=args.first_batch_only,
        project_owner=project_owner,
        project_owner_type=args.project_owner_type,
        project_number=args.project_number,
    )
    pr_gates = summarize_pr_gates(manifest)
    output = {
        "mode": "apply" if args.apply else "dry-run",
        "repository": manifest["repository"],
        "project_target": {
            "owner": project_owner,
            "owner_type": args.project_owner_type,
            "number": args.project_number,
            "applied": project_apply,
        },
        "issue_results": issue_results,
        "project_item_results": project_item_results,
        "draft_pr_gates": pr_gates,
    }
    print(json.dumps(output, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
