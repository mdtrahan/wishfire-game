Code navigation policy:

1. After AGENTS/startup checks, use codebase-memory for broad repo orientation.
2. Use jcodemunch-mcp for exact code-location, dependency, call-path, hotspot, and large-file analysis.
3. For Codex-Orka jcodemunch calls, prefer the current full index `local/Codex-Orka-904e2bad` until revalidated.
4. Treat `local/Codex-Orka-c326b16a` as stale unless deliberately comparing old index behavior.
5. Useful current jcodemunch calls include `get_repo_health`, `get_dependency_graph`, `get_signal_chains`, `get_symbol_importance`, and `get_impact_preview`.
6. If `repo: "Codex-Orka"` is ambiguous, resolve index freshness first. Do not fall back to broad full-file scans because of an ambiguity error.
