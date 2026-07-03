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
TEXT_PROJECT_FIELDS = {
    "Bead ID",
    "Parent/Epic",
    "Blockers",
    "Blocks",
    "Branch",
    "Overlap Risk",
}
SINGLE_SELECT_FIELD_ORDER = {
    "Beads Status": ["open", "in_progress", "blocked", "recovery", "deferred", "closed"],
    "Priority": ["P1", "P2", "P3", "P4"],
    "Type": ["task", "bug", "feature", "epic", "chore"],
    "GitHub Surface": ["draft_pr", "review_packet_pr", "issue_project", "historical_closed_mirror"],
}


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


def ordered_options(field_name: str, values: set[str]) -> list[str]:
    preferred = SINGLE_SELECT_FIELD_ORDER.get(field_name, [])
    ordered = [value for value in preferred if value in values]
    ordered.extend(sorted(value for value in values if value not in preferred))
    return ordered


def desired_project_field_specs(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    fields = manifest.get("project_fields") or []
    operations = manifest.get("project_item_operations") or []
    specs: list[dict[str, Any]] = []
    for field_name in fields:
        values = {
            str((operation.get("field_values") or {}).get(field_name) or "").strip()
            for operation in operations
        }
        values.discard("")
        if field_name in SINGLE_SELECT_FIELD_ORDER:
            specs.append(
                {
                    "field": field_name,
                    "data_type": "SINGLE_SELECT",
                    "options": ordered_options(field_name, values),
                }
            )
        elif field_name in TEXT_PROJECT_FIELDS:
            specs.append({"field": field_name, "data_type": "TEXT", "options": []})
        else:
            specs.append({"field": field_name, "data_type": "TEXT", "options": []})
    return specs


def project_field_gaps(
    specs: list[dict[str, Any]],
    project: dict[str, Any],
) -> dict[str, list[dict[str, Any]]]:
    missing_fields: list[dict[str, Any]] = []
    missing_options: list[dict[str, Any]] = []
    wrong_types: list[dict[str, Any]] = []
    fields = project["fields"]
    for spec in specs:
        field_name = spec["field"]
        field = fields.get(field_name)
        if not field:
            missing_fields.append(spec)
            continue
        expected_type = spec["data_type"]
        if expected_type == "SINGLE_SELECT":
            if field.get("__typename") != "ProjectV2SingleSelectField":
                wrong_types.append(
                    {
                        "field": field_name,
                        "expected": expected_type,
                        "actual": field.get("__typename") or field.get("dataType") or "unknown",
                    }
                )
                continue
            existing = {str(option.get("name") or "").casefold() for option in field.get("options") or []}
            missing = [option for option in spec["options"] if option.casefold() not in existing]
            if missing:
                missing_options.append({"field": field_name, "missing_options": missing})
            continue
        if field.get("__typename") != "ProjectV2Field" or field.get("dataType") != expected_type:
            wrong_types.append(
                {
                    "field": field_name,
                    "expected": expected_type,
                    "actual": field.get("dataType") or field.get("__typename") or "unknown",
                }
            )
    return {
        "missing_fields": missing_fields,
        "missing_options": missing_options,
        "wrong_types": wrong_types,
    }


def create_project_field(owner: str, number: int, spec: dict[str, Any]) -> dict[str, Any]:
    args = [
        "gh",
        "project",
        "field-create",
        str(number),
        "--owner",
        owner,
        "--name",
        spec["field"],
        "--data-type",
        spec["data_type"],
        "--format",
        "json",
    ]
    if spec["data_type"] == "SINGLE_SELECT":
        args.extend(["--single-select-options", ",".join(spec["options"])])
    result = run_command(args)
    return json.loads(result.stdout)


def ensure_project_fields(
    manifest: dict[str, Any],
    apply: bool,
    ensure_fields: bool,
    project_owner: str,
    project_owner_type: str,
    project_number: int | None,
) -> list[dict[str, Any]]:
    specs = desired_project_field_specs(manifest)
    results: list[dict[str, Any]] = []
    if project_number is None:
        for spec in specs:
            results.append({**spec, "action": "requires_project_number", "applied": False})
        return results

    project = load_project_v2(project_owner, int(project_number), project_owner_type)
    gaps = project_field_gaps(specs, project)
    missing_by_name = {field["field"]: field for field in gaps["missing_fields"]}
    missing_options_by_name = {field["field"]: field["missing_options"] for field in gaps["missing_options"]}
    wrong_types_by_name = {field["field"]: field for field in gaps["wrong_types"]}

    for spec in specs:
        field_name = spec["field"]
        result = {**spec, "applied": False}
        if field_name in wrong_types_by_name:
            result.update({"action": "wrong_type", "details": wrong_types_by_name[field_name]})
        elif field_name in missing_options_by_name:
            result.update({"action": "missing_options", "missing_options": missing_options_by_name[field_name]})
        elif field_name in missing_by_name:
            if apply and ensure_fields:
                output = create_project_field(project_owner, int(project_number), spec)
                result.update({"action": "created_field", "applied": True, "output": output})
            else:
                result.update({"action": "create_field", "applied": False})
        else:
            result.update({"action": "exists", "applied": False})
        results.append(result)
    return results


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
    allow_missing_project_fields: bool,
) -> list[dict[str, Any]]:
    repo = manifest["repository"]
    first_batch = set(manifest.get("first_batch_bead_ids") or [])
    operations = manifest.get("project_item_operations") or []
    if first_batch_only:
        operations = [operation for operation in operations if operation["match_key"] in first_batch]

    existing = load_existing_issues(repo) if apply else {}
    project = load_project_v2(project_owner, int(project_number), project_owner_type) if apply else None
    if apply and project and not allow_missing_project_fields:
        specs = desired_project_field_specs(manifest)
        gaps = project_field_gaps(specs, project)
        if gaps["missing_fields"] or gaps["missing_options"] or gaps["wrong_types"]:
            raise SystemExit(
                "Refusing to apply Project items because the target Project is missing "
                "the public-safe Bead field schema. Run with --ensure-project-fields "
                "after explicit approval, or pass --allow-missing-project-fields for "
                "a deliberately partial Project view.\n"
                + json.dumps(gaps, indent=2)
            )
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
        default="",
        help="Path to a reviewed public-safe publish manifest. Required; no active docs path is assumed.",
    )
    parser.add_argument("--apply", action="store_true", help="Actually create/update GitHub issues.")
    parser.add_argument(
        "--skip-issues",
        action="store_true",
        help="Do not create/update Issues. Useful when applying only Project V2 items.",
    )
    parser.add_argument(
        "--skip-project-items",
        action="store_true",
        help="Do not add/update Project items. Useful when applying only Project field setup.",
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
        "--ensure-project-fields",
        action="store_true",
        help="With --apply and --project-number, create missing public-safe Bead Project fields before item insertion.",
    )
    parser.add_argument(
        "--allow-missing-project-fields",
        action="store_true",
        help="Allow Project item insertion even if public-safe Bead fields are missing. Produces a partial Project view.",
    )
    parser.add_argument(
        "--allow-detailed-internal",
        action="store_true",
        help="Allow applying an older/detailed manifest. Do not use for public GitHub publication.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.manifest:
        print("Refusing to choose a default publish manifest. Pass --manifest explicitly.")
        return 2
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
    project_apply = bool(args.apply and args.project_number is not None and not args.skip_project_items)
    project_field_results = ensure_project_fields(
        manifest,
        apply=bool(args.apply),
        ensure_fields=args.ensure_project_fields,
        project_owner=project_owner,
        project_owner_type=args.project_owner_type,
        project_number=args.project_number,
    )
    project_item_results = []
    if not args.skip_project_items:
        project_item_results = publish_project_items(
            manifest,
            apply=project_apply,
            first_batch_only=args.first_batch_only,
            project_owner=project_owner,
            project_owner_type=args.project_owner_type,
            project_number=args.project_number,
            allow_missing_project_fields=args.allow_missing_project_fields,
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
            "fields_ensured": bool(args.apply and args.ensure_project_fields and args.project_number),
        },
        "issue_results": issue_results,
        "project_field_results": project_field_results,
        "project_item_results": project_item_results,
        "draft_pr_gates": pr_gates,
    }
    print(json.dumps(output, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
