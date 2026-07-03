# Repo Context Retrieval

## Purpose
- Make `codebase-memory` the first-class project knowledge layer for Codex-Orka.
- Keep always-on context small while preserving evidence-first workflow.
- Route questions to the cheapest reliable source before broad text search.

## Retrieval Precedence
1. Required local contract: root `AGENTS.md`, nearest child `AGENTS.md` chain, `ai-memory/context.md`, and live `bd` state when scope/workflow matters.
2. `codebase-memory`: first project-wide index for repo maps, architecture, hotspots, indexed docs/code search, symbol discovery, and fast orientation.
3. Key repo docs: `REPOSITORY_ARCHITECTURE.md`, `DOX_RESEARCH.md`, `governance/execution/beads-process.md`, `governance/execution/jcodemunch-mcp-adoption.md`, and nearest `governance/product/` or `governance/planning/` truth docs.
4. `jcodemunch-mcp`: exact code-location, ownership, dependency, import, call-path, hot-file, and large-file structural analysis.
5. Other MCPs/connectors: GitHub, browser, Figma, Slack, Gmail, Drive, Agent Reach, or web research only when the answer depends on external or connected state.
6. Focused `rg`: final exact-text verification, docs/data search that indexed tools do not cover well, or fallback when indexes are missing/stale.

## Tool Boundaries
- `codebase-memory` is a project knowledge graph, not a workflow authority. It does not replace Beads, DOX, git status, tests, or source reads for final verification.
- `jcodemunch-mcp` remains better for exact symbol bundles, dependency graphs, import/caller evidence, and hot runtime files.
- RTK is a shell-output control layer. Prefix shell commands with `rtk` when available, but do not use RTK as a retrieval source.
- Connectors and external MCPs are for remote or app-owned state. Do not use them for local repo facts that `codebase-memory`, `jcodemunch-mcp`, or focused local reads can answer.
- Raw `rg` is still justified for literal strings, markdown/data files, generated artifacts, validation checks, and index drift checks.

## Standard Workflow
For repo-context questions:
1. Confirm the applicable AGENTS chain and whether Beads/workflow state matters.
2. Query `codebase-memory` for the project map or indexed search target.
3. Read the smallest relevant repo doc or AGENTS section.
4. Use `jcodemunch-mcp` for exact code structure if the answer touches code ownership, dependencies, or call paths.
5. Use focused `rg` only to verify exact wording or cover docs/data not represented well in the indexes.

For implementation planning:
1. Use live `bd` and the AGENTS chain for authority.
2. Use `codebase-memory get_architecture` or indexed search for orientation.
3. Use `jcodemunch-mcp` to identify precise symbols/files before editing hot or large code.
4. Read only the final target files or sections needed to patch safely.

## Overlap And Conflict Audit
- Root `AGENTS.md` previously said `jcodemunch-mcp` first for all code-location, ownership, dependency, and call-path questions. That remains true for exact structural code evidence, but broad repo-context orientation now starts with `codebase-memory`.
- `governance/execution/jcodemunch-mcp-adoption.md` remains valid for large code analysis. It is narrower than this routing doc.
- `REPOSITORY_ARCHITECTURE.md` is a stable architecture snapshot, not a live index. Refresh live context with `codebase-memory` or `jcodemunch-mcp` before relying on it for current files.
- `DOX_RESEARCH.md` explains AGENTS hierarchy rules. It does not define retrieval order beyond reading applicable AGENTS files.
- Beads docs remain workflow authority. Indexed tools can find relevant files faster, but they cannot authorize implementation.

## Validation Pattern
Use this pattern to prove the cheaper context path works:
1. Run `codebase-memory` project listing or architecture query to confirm the repo is indexed.
2. Ask the index for the relevant doc/code surface.
3. Use the nearest doc or `jcodemunch-mcp` for exact authority.
4. Use one focused `rg -n -m` only if exact wording must be confirmed.

Successful validation means the answer cites indexed project/doc evidence before broad search and uses broad `rg` only as a narrow check.
