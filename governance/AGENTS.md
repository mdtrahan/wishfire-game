# Governance DOX

## Purpose
- Own durable product truth, planning contracts, current audit evidence and process documentation.
- Keep gameplay/design intent discoverable without bloating root AGENTS.md.

## Ownership
- `product/` owns player-facing and design-facing gameplay truth.
- `planning/` owns architecture contracts, invariants, and current process plans.
- `metrics/` and `qa/` own current evidence and metrics. `audit/` is reserved for current audit records. Historical generated packets belong outside normal repository search.
- `execution/` owns process guidance and active execution directives.

## Local Contracts
- `execution/integration.md` owns storage closeout for every lane: report task footprint, justify retained resources, audit retirement candidates and preserve ignored evidence until reviewed.
- Governance docs can guide implementation but do not by themselves authorize runtime edits outside the active bead scope.
- Product docs outrank code when deciding intended gameplay, but code/tests show current implementation reality.
- Planning docs that say "contract only" or "does not authorize implementation" must not be treated as permission to change code.
- Keep unresolved mechanics visible as blocked stubs, drift notes, or explicit open questions instead of burying them.
- Rust-only combat cutover must preserve live equipment, level and Training revisions in the existing world. Verify the shipped ABI accepts permanent-input revisions before retiring JS stat/HP consumers. Owner retired paid story Continue for ORKA-jiyg. D17′ ordinary AllDown restarts the same subwave free at slice origins; bosses retain their checkpoint rule.
- For gameplay/content bead creation, check `product/player-living-guide.md` for player-facing drift.

## Work Guidance
- Separate product truth, implementation plans, audit evidence, and process method docs.
- For repo-context retrieval, follow `execution/repo-context-retrieval.md` before adding more always-on guidance to root `AGENTS.md`.
- For root execution policy, prefer the focused docs in `execution/`: `implementation-gate.md`, `integration.md`, `retrieval.md`, `validation.md`, and `output-contracts.md`.
- For branch/worktree lifecycle, QA PASS, merge readiness, and repository audit classification, follow `execution/integration.md`.
- Keep historical generated review packets, export manifests, agent logs, and rollback plans outside current main.
- When docs disagree, preserve the conflict and ask or create a decision bead rather than flattening it.
- Avoid turning governance docs into event logs; record reusable rules, decisions, and evidence.

## Verification
- Link/anchor or table checks where existing tests/scripts cover them.
- `git diff --check` for markdown-only governance changes.
- Focused runtime tests only when governance changes accompany code behavior changes.

## Child DOX Index
- `governance/product/AGENTS.md` - gameplay, player-facing, hero/skill/progression truth.
- `governance/planning/AGENTS.md` - architecture contracts, invariants, and current process plans.

- Consolidation audits index retained historical lanes and local checkpoint locations; an archive or reachable tip does not establish feature acceptance or authorize historical runtime restoration.

- Permanent-input audit evidence distinguishes native/WASM commitment and channel regressions, frozen slice hash equality, exact inherited unit failure names and unfinished browser cases. A time box certifies no browser PASS.

- Permanent commitment audits apply the lead's A6/§3.3 boundary: capture permanent inputs and definition/modifier parameters; read transient Elevate live at impact with or without a revision. Record CPU-profile attribution and measured performance separately from hypotheses.

- The integration playbook owns the ignored generated-WASM lifecycle and mechanical source-integration rebuilds.
