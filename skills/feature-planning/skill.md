---
name: feature-planning
description: Break down feature requests into detailed, execution-ready implementation plans. Use when the user asks to plan a new feature, enhancement, or complex change.
version: 1.0.0
tags: [planning, architecture, decomposition]
---

# Feature Planning Skill (Codex)

Systematically analyze feature requests and produce a **clear, structured implementation plan** that can be executed later by tools, goals, or a human operator.

---

## Skill Scope

This skill defines **how to think and plan**, not how to execute.

It does NOT:
- write code
- run scripts
- call tools
- commit changes
- modify files

Its sole output is a **well-specified implementation plan**.

Execution happens separately.

---

## When to Use

Activate this skill when the user:
- requests a new feature (e.g., “add user authentication”)
- asks for an enhancement (e.g., “improve performance”, “add export”)
- describes a complex, multi-step change
- explicitly asks for planning (“plan how to implement X”)
- provides vague requirements that need clarification

Do NOT use for:
- simple one-step changes
- bug fixes with a clear cause
- mechanical refactors with one obvious solution

Use this skill for **JSON → JS parity** work:
- when translating runtime behavior from a JSON spec into JavaScript
- when defining a deterministic “definition of done” for feature parity

---

## JSON → JS Parity Planning Addendum

When the task is to mirror functionality from a JSON source of truth into JS:

### Required Inputs
- JSON artifacts (event sheets, object types, layouts)
- Current JS implementation paths
- Known regressions or mismatches

### Output Requirements
- A **parity checklist** (feature-by-feature)
- **Definition of Done** for each feature
- A **pre‑QA validation plan** (self‑check steps)

### Minimum Definition of Done (Parity)
- Behavior matches JSON for all referenced conditions and actions
- Visual placement matches layout coordinates and sizing
- Data flow uses JSON‑defined variables and arrays
- No “debug substitute” UI shown in the final parity pass

---

## Planning Workflow

### 1. Understand Requirements

Clarify the problem before planning.

If information is missing, ask targeted questions such as:
- What problem does this solve?
- Who are the users?
- Are there technical or organizational constraints?
- What does success look like?

Do not assume unstated requirements.

---

### 2. Analyze Impact and Design

Identify what will change.

Consider:
- Affected components (backend, frontend, data, config)
- Required data changes (schemas, migrations, storage)
- Interfaces and integration points
- Error handling and edge cases
- Security, validation, and performance implications
- Dependencies or third-party libraries
- Consistency with existing patterns and conventions

Favor existing architecture unless there is a strong reason to diverge.

---

### 3. Create the Implementation Plan

Break the feature into **discrete, sequential tasks**.

Use the following structure exactly:

```
## Feature: <Feature Name>

### Overview

Brief description of what will be built and why.

### Architecture Decisions

* Decision 1: <what and why>
* Decision 2: <what and why>

### Implementation Tasks

#### Task 1: <Task Name>

* **Component/File**: <path or area>
* **Description**: What this task accomplishes
* **Details**:
  * Specific requirement
  * Edge case or constraint
* **Dependencies**: None or list task numbers

#### Task 2: <Task Name>

...

### Testing Strategy

* Types of tests required
* Critical scenarios to validate

### Integration Points

* How this connects to existing systems
* Potential impacts or risks
```

Tasks should be:
- atomic
- ordered
- independently verifiable

---

### 4. Review the Plan

Before finalizing, confirm:
- The plan matches the user’s intent
- No requirements are missing
- Trade-offs are documented
- The sequence is realistic

If uncertainty remains, pause and ask before proceeding.

---

### 5. Hand Off for Execution

The output of this skill is a **planning artifact**.

It may be used by:
- a goal workflow
- deterministic tools
- a human operator

Do NOT execute tasks automatically.

---

## Best Practices

**Planning**
- Start broad, then refine
- Reference existing patterns explicitly
- Think through failure modes early
- Prefer clarity over cleverness

**Communication**
- Explain architectural choices
- Call out assumptions
- Highlight trade-offs
- Write for future maintainers

---

## Success Criteria

A successful plan:
- Is complete and unambiguous
- Breaks work into clear, sequential tasks
- Surfaces risks and dependencies
- Can be executed without reinterpretation
