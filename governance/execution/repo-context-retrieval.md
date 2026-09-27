# Repo Context Retrieval

## Scope
Ordinary development retrieval uses the current `main` checkout. An active worktree may be selected explicitly for its own task. Historical recovery, old worktrees, local Dolt storage, generated output, and retired evidence are outside the normal search scope.

## Order
1. Read the applicable `AGENTS.md` chain, current source, and live Beads state where needed.
2. Use focused `rg` and direct reads in the selected checkout.
3. Use an index only after verifying its source path is the selected checkout and its indexed commit matches that checkout. If either fact is unavailable, rely on local reads.
4. Use external sources only for facts that the selected checkout cannot answer.

An index is a locator, not authority. Verify decisions against current files, Git state, Beads, and tests. Never use a remembered index identifier as proof of freshness.
