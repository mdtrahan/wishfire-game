# Retrieval

## Purpose
- Keep repository context evidence-first without bloating root `AGENTS.md`.
- Route from the cheapest reliable source to more specialized tools.

## Precedence
1. Required local contract: root `AGENTS.md`, nearest child `AGENTS.md` chain, `ai-memory/context.md`, and live `bd` state when scope/workflow matters.
2. `codebase-memory`: first project-wide knowledge layer for repo maps, architecture summaries, hotspots, indexed doc/code search, and symbol discovery.
3. Key repo docs, including `REPOSITORY_ARCHITECTURE.md`, `DOX_RESEARCH.md`, `governance/execution/beads-process.md`, and nearest product/planning truth docs.
4. `jcodemunch-mcp`: exact code-location, ownership, dependency, import, call-path, hot-file, and large-file structural evidence.
5. External connectors/MCPs only when local repo and indexed tools cannot answer.
6. Focused `rg` for exact-text checks, docs/data search, or fallback when indexes are missing or stale.

## Receipt Requirement
For code-location, ownership, dependency, or call-path answers, include:

- tool used
- if not `codebase-memory` or `jcodemunch-mcp`, why not
- repo/query used
- files/symbols retrieved
- whether full-file reads were avoided

## Detailed Routing
Follow `governance/execution/repo-context-retrieval.md` for the full routing guide and overlap audit.
