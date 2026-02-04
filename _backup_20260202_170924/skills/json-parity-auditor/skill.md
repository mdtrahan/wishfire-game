---
name: json-parity-auditor
description: Enforce JSON→JS parity by extracting intent from Construct JSONs and validating JS behavior against it before QA. Use for any parity work or regression fixes.
version: 1.0.0
tags: [parity, verification, json, construct3]
---

# JSON → JS Parity Auditor

Purpose: prevent regressions by **systematically checking JS changes against JSON intent** before relying on QA.

## When to Use
- Any change that affects gameplay logic, UI behavior, or layout rendering.
- Any regression fix where JSON is the source of truth.

## Workflow (required)

### 1) Identify JSON sources
- Event logic: `project_C3_conversion/eventSheets/*.json`
- Layout/positions: `project_C3_conversion/layouts/*.json`
- Object definitions: `project_C3_conversion/objectTypes/*.json`
- Data tables: `project_C3_conversion/files/*.json`

### 2) Extract intent
For each feature or fix:
- List the **exact** JSON rules (conditions/actions/values).
- Note any probabilities or thresholds (e.g., gem frame gating).
- Note placement rules (e.g., SlotX/SlotY, BBoxTop offsets, baseW ratios).

### 3) Map to JS
Create a short mapping:
- JSON rule → JS function/line range.
- If missing, mark as “gap.”

### 4) Pre‑QA validation
Before asking QA:
- Run the feature and check against JSON behavior.
- Confirm visuals match JSON layout/size.
- Confirm no debug substitutes remain.

### 5) Definition of Done (parity)
- Behavior, layout, and data flow match JSON.
- No feature ships without a JSON→JS mapping note.
