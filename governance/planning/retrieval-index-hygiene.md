# Retrieval Index Hygiene

Bead: `ORKA-yib8.10`

## Scope

This audit documents the current codebase-memory and jcodemunch index state for Codex-Orka work. It does not delete indexes, reconfigure global MCP state, install tools, or rewrite broad workflow docs.

## Live Evidence

| Layer | Current signal | Interpretation |
|---|---|---|
| codebase-memory | `list_projects` shows `Users-Mace-Codex-Orka`; `index_status` is `ready` with `9440` nodes and `24900` edges. | Use this project for broad Codex-Orka repo orientation. It represents the live main checkout root, not every bead worktree branch. |
| codebase-memory symbol search | `IsPartySessionSkillActive` returns current hits in both `Scripts/functionBank.js` and `web-runner/modules/functionBank.js`. | The indexed live project can find current mirrored function-bank symbols. |
| jcodemunch repo list | Two `Codex-Orka` display-name repos exist: `local/Codex-Orka-904e2bad` and `local/Codex-Orka-c326b16a`. | Display name `Codex-Orka` is ambiguous and must not be used directly. |
| jcodemunch live repo | `local/Codex-Orka-904e2bad`, source root `/Users/Mace/Codex-Orka`, indexed at `2026-06-27T18:01:16.066318`, `6135` symbols, `337` files, git head `d444b19`. | This is the current main-checkout index for repo-wide code navigation. |
| jcodemunch stale/duplicate repo | `local/Codex-Orka-c326b16a`, source root under the user Codex worktrees directory, indexed at `2026-05-11T00:39:15.379381`, `2283` symbols, `155` files. | This is a historical worktree index. It still loads, but it is not current enough for live implementation decisions. |
| jcodemunch watch status | Watch service inactive; `any_stale=false`; both repo roots listed as not stale. | `any_stale=false` does not mean duplicate historical indexes are safe to use. |
| jcodemunch symbol check | Exact live repo id finds `IsPartySessionSkillActive` in both mirrored function-bank files. The historical repo id returns unrelated/older symbols for that query. | Use exact live repo id for current code. Treat unexpected symbol misses as a stop signal, not proof the symbol is absent. |

## Routing Rule

For Codex-Orka work:

1. Use codebase-memory project `Users-Mace-Codex-Orka` for broad architecture and text/symbol orientation.
2. Use `jcodemunch resolve_repo` against the active path, then use the exact returned repo id.
3. If jcodemunch asks to choose between `local/Codex-Orka-*` ids, choose `local/Codex-Orka-904e2bad` only when the requested evidence is against the current main-checkout index.
4. Do not use the historical worktree repo id for live implementation, PR review, or code-location claims.
5. In bead worktrees nested under `.worktrees/`, indexed tools can reflect the main root rather than branch-local uncommitted changes. Use indexed tools for baseline orientation, then verify branch diffs with direct file reads, `git diff`, and focused `rg`.
6. If indexed evidence conflicts with direct branch files, direct files in the active worktree win for the current PR.

## Known Limitation

The duplicate jcodemunch repo is not marked stale by watch status because the index itself is loadable and its source root still exists. This is a routing problem, not enough evidence for deletion. Deleting or reindexing user-level indexes needs explicit owner approval plus a rollback/export path.

## Stop Conditions

Stop before relying on indexed retrieval if:

- `jcodemunch resolve_repo` returns the historical worktree repo for live Codex-Orka work;
- `search_symbols` misses a known current symbol that codebase-memory or direct files find;
- `list_projects` or `index_status` no longer shows `Users-Mace-Codex-Orka` as ready;
- a branch-local change is the subject of the question and the indexed root predates that branch commit;
- a cleanup would delete or mutate global/user-level index state without approval.

## Validation

Commands/tools used:

- codebase-memory `list_projects`
- codebase-memory `index_status` for `Users-Mace-Codex-Orka`
- codebase-memory `search_code` for `IsPartySessionSkillActive`
- jcodemunch `list_repos`
- jcodemunch `get_watch_status`
- jcodemunch `resolve_repo` for repo and worktree paths
- jcodemunch `search_symbols` for `IsPartySessionSkillActive`
- `git diff --check` for this markdown-only change

No configuration, index, runtime, gameplay, or global user-level files were changed.
