# jcodemunch MCP Adoption

## Purpose
- Make symbol-level code exploration the default for large-file analysis work.
- Reduce brute-force full-file reads in hot runtime files.
- Improve precision and speed when tracing ownership, lifecycle, and cross-file dependencies.
- Scope this doc to `jcodemunch-mcp`; full retrieval precedence lives in `governance/execution/repo-context-retrieval.md`.

## Preferred Use
- Use `jcodemunch-mcp` for:
  - large-file exploration in `web-runner/`, `Scripts/`, and `src/`
  - symbol lookup
  - function/class extraction
  - dependency tracing
  - focused analysis before hot-file edits

- Prefer normal file reads for:
  - short files
  - final diff verification
  - local artifacts and docs

## Standard Analysis Pipeline
- Use this order for large code understanding:
  1. repo outline or file tree
  2. symbol search or file outline
  3. exact symbol retrieval
  4. broad file reads only if symbol-level retrieval is insufficient

- PM and worker should use the same order so:
  - prompts are based on the same code understanding
  - implementation lanes stay scoped to actual symbols/functions
  - token use stays low on hot files

- Default use cases:
  - PM: issue shaping, ownership mapping, hot-file boundary definition
  - Worker: target function lookup, dependency tracing, exact change validation

- Fallback to direct file reads when:
  - the file is small
  - the target is non-code text
  - the symbol index is missing or stale
  - final diff verification needs direct file context

## Codex-Orka Index Routing
- Current full index observed during ORKA-ygz6 diagnosis: `local/Codex-Orka-904e2bad`.
- Treat `local/Codex-Orka-c326b16a` as stale unless it is revalidated.
- If `repo: "Codex-Orka"` is ambiguous, run `get_repo_health` against each candidate and choose the index with current file/symbol counts.
- For an extra freshness check, inspect `web-runner/app.js` with `get_dependency_graph`. A current index should show the modern runtime module graph, including systems such as `renderRuntime`, `partyStatOsd`, `combatSessionInitializer`, `devToolingRuntime`, `superGemRuntime`, and `simulationCoreShadow`.
- Do not fall back to broad full-file reads after an ambiguity error. Resolve the index first, then continue with focused retrieval.

## Project Policy
- `jcodemunch-mcp` is a tooling aid, not a gameplay/runtime dependency.
- It should not be imported by game code.
- It should be used to reduce context size and improve analysis precision.
- It does not replace the Beads gate or issue-scoped execution.

## Local MCP Config
- A copy-ready example config is stored in:
  - `/Users/Mace/Wishfire/Codex-Orka/governance/execution/jcodemunch-mcp.example.json`

## Launch Pattern
- Upstream-supported stdio launch:
  - `uvx jcodemunch-mcp@latest`

## Licensing
- Upstream repository states:
  - non-commercial use is permitted under the included license
  - commercial use requires a paid commercial license

- Current project policy:
  - use is limited to internal pre-MVP evaluation during development
  - obtain the commercial license before public release or any commercial operation

## Operational Default
- When `jcodemunch-mcp` is available in the active session, prefer it for large code analysis before falling back to broad `sed`/`rg` reads across giant files.
- Treat this as the default for both PM planning and worker implementation on hot runtime files.
