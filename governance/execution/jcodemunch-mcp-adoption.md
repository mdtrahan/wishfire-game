# jcodemunch MCP Adoption

## Purpose
- Make symbol-level code exploration the default for large-file analysis work.
- Reduce brute-force full-file reads in hot runtime files.
- Improve precision and speed when tracing ownership, lifecycle, and cross-file dependencies.

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

- This project is commercially relevant, so do not treat the tool as cleared for unrestricted production use until the license decision is confirmed by the project owner.

## Operational Default
- When `jcodemunch-mcp` is available in the active session, prefer it for large code analysis before falling back to broad `sed`/`rg` reads across giant files.
