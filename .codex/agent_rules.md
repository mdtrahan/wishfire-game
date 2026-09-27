Code navigation policy:

1. Select the current main checkout or an explicitly named active worktree.
2. Search and read that checkout directly with focused `rg` and source reads.
3. Use an optional code index only when its source path and indexed commit match the selected checkout.
4. Treat missing or unverifiable index metadata as stale; use local source instead.
5. Keep recovery archives, retired worktrees, generated output, and raw Dolt state outside ordinary retrieval.
6. Root-level scans and indexes must exclude `.worktrees/`. To inspect an active lane, select that exact worktree as the search root. Honor `.ignore` for generated QA, output, builds, backups, and Dolt state.
