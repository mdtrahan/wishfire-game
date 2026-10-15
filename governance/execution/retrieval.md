# Retrieval

## Precedence
1. Read the applicable `AGENTS.md` chain, current source, and live Beads state when relevant.
2. Search the current `main` checkout or one explicitly selected active worktree with focused `rg` and direct reads.
3. Use an optional code index only after verifying its source path and indexed commit against that checkout. If freshness is uncertain, use local files.
4. Use external sources for facts outside the repository.

Historical recovery, retired worktrees, generated output, and local Dolt storage are outside ordinary search/index scope. An index never replaces current source, Git status, Beads, or validation.
