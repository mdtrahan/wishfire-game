# Workflow Token Drift Audit

Bead: `ORKA-hjrt`
Date: 2026-06-29

## Scope

This is a workflow-efficiency audit only. It does not authorize gameplay, runtime, prompt, archive, or cleanup changes.

## Plain Finding

The repo already has good retrieval rules, but the working surfaces still make agents likely to load large generated exports, raw reports, old agent logs, and archived plans before using indexed retrieval. The main drift is not one bad file. It is many "official-looking" workflow artifacts sitting near active guidance with no strong routing signal.

## Evidence

Text-like workflow and guidance corpus inspected:

| Surface | Evidence |
| --- | --- |
| Governance/docs/agents/ai-memory text corpus | 174 files, 1,483,413 bytes total |
| Beads GitHub export folder | 354,615 bytes total |
| Agent coordination folder | 151,181 bytes total |
| Dev-directive active plus archive plans | 54,623 bytes total |
| Bead review packets | 51,220 bytes total |

Largest token-drift sources found:

| File | Size | Why it drifts context |
| --- | ---: | --- |
| `governance/planning/beads-github-export/github-publish-manifest.json` | 204,391 bytes | Generated visibility payload; useful for export replay, too large for routine board/context inspection. |
| `governance/audit/reports/fallow-raw-report-2026-06-04.md` | 182,752 bytes | Raw tool output; high evidence value, poor always-read value. |
| `governance/product/abilities.html` | 136,391 bytes | Canonical product truth, but too large to brute-read; needs section-level retrieval for ability questions. |
| `governance/planning/beads-github-export/bead-github-mapping.json` | 99,603 bytes | Generated mapping; should be queried or sampled, not read whole. |
| `agents/dev_reports.md` | 90,229 bytes | Append-only event/report log; agents can mistake stale historical reports for current truth. |
| `ai-memory/insights.md` | 71,071 bytes | Valuable reusable heuristics, but large enough to require search-first lookup. |
| `governance/audit/reports/2026-Layout-Harness-Conformance-Report.md` | 65,320 bytes | Historical audit report; should be cited only when the task names it or matching terms are found. |
| `agents/pm_status.md` | 41,740 bytes | Contains old jdocmunch/jcodemunch repo IDs and status history; useful as historical evidence, not current routing truth. |

Existing retrieval guidance already points the right way:

- `AGENTS.md` says to keep always-on context minimal and use `codebase-memory` first for project-wide maps.
- `governance/execution/repo-context-retrieval.md` makes `codebase-memory` first for repo orientation and `jcodemunch-mcp` first for exact code structure.
- `governance/execution/jcodemunch-mcp-adoption.md` says to use jcodemunch for large `web-runner/`, `Scripts/`, and `src/` analysis before broad reads.
- `agents/prompts/dev_agent.md` and `agents/prompts/pm_agent.md` already say to use jcodemunch first for large files and jdocmunch first for documentation-heavy tasks.

Observed retrieval gap in this session:

- `codebase-memory` was indexed and ready for `/Users/Mace/Codex-Orka`, but the exposed tool surface only allowed project listing/status, not document search.
- `jcodemunch` worked only after using the exact repo id `local/Codex-Orka-c326b16a`; generic names such as `wishfire-game` and `Users-Mace-Codex-Orka` failed, and `Codex-Orka` was ambiguous.
- The successful jcodemunch call returned compact hotspot evidence for `web-runner/` with `total_tokens_saved=75984326`, confirming that symbol-level retrieval is the right default for code hotspots.
- No `jdocmunch` tool was exposed in this session, despite repo guidance recommending it for documentation-heavy tasks.

Retrieval receipt:

- Tool used: `codebase-memory`
- Query/repo: `list_projects`, `index_status(project="Users-Mace-Codex-Orka")`
- Result: repo index ready, 9,693 nodes and 23,847 edges
- Why not enough alone: no document-search tool was exposed in this session
- Tool used: `jcodemunch`
- Query/repo: `get_symbol_importance(repo="local/Codex-Orka-c326b16a", scope="web-runner")`
- Files/symbols retrieved: top `web-runner` symbols including `state.js::state`, `functionBank.js::ExecuteSkill`, `app.js::HarnessInputDomainManager`
- Full-file reads avoided: yes for code hotspot orientation; docs still required bounded shell scans because jdocmunch was unavailable

## Main Drift Sources

1. Generated exports are too close to active planning docs.
   `governance/planning/beads-github-export/` contains replay/audit payloads that are useful for board publication but expensive for ordinary context. Agents looking for board truth can accidentally read export payloads instead of live `bd`/GitHub state.

2. Raw reports are treated like current guidance.
   `governance/audit/reports/` contains large historical evidence. These should be searched by term and date, not loaded as a default source.

3. Append-only agent logs are oversized.
   `agents/dev_reports.md` and `agents/pm_status.md` mix old status, old tool IDs, and current-looking sections. They invite stale conclusions unless the task explicitly asks for agent-history evidence.

4. Product truth has large monoliths.
   `governance/product/abilities.html` is canonical, but it is too large for routine full reads. Ability tasks should use section or exact-term lookup first, then read a narrow range.

5. Archived plans still look executable.
   `docs/archive/` and `governance/execution/dev-directives/archive/` contain old plans and directives. Without date/path filtering, they inflate context and can contradict current Beads/AGENTS guidance.

6. Tool routing names drift.
   Stored notes mention old or session-specific repo IDs such as `local/Codex-Orka-f7dcaf91`. Current `jcodemunch` required `local/Codex-Orka-c326b16a`; generic names failed. Agents need a quick current-ID check before relying on old MCP names.

## Where To Use jcodemunch Earlier

Use jcodemunch before broad code reads when the question involves:

- `web-runner/app.js`, `web-runner/modules/functionBank.js`, `Scripts/functionBank.js`, `web-runner/systems/renderRuntime.js`, or `simulationCoreShadow.js`
- ownership, imports, dependencies, callers, duplicate mirrors, or symbol-level behavior
- hotspot triage before creating implementation Beads
- proving that a planned edit is scoped to a specific symbol or module seam

Expected route:

1. Confirm current jcodemunch repo id.
2. Use symbol importance/search/outline for the relevant subtree.
3. Retrieve exact symbols or dependency paths.
4. Use `rg` or direct reads only for final wording/diff checks.

## Where To Use jdocmunch Earlier

Use jdocmunch before broad documentation reads when the question involves:

- ability/product docs, especially `abilities.html`
- Beads/GitHub export docs
- archived plans or audit reports
- governance policy comparison
- "what does the repo say about X" questions across many markdown/html files

Expected route:

1. Confirm jdocmunch is actually exposed in the session.
2. Query table-of-contents or section search first.
3. Read only matching sections and adjacent context.
4. Fall back to bounded `rg -n -m` if jdocmunch is unavailable.

## Recommended Changes

1. Add a short "generated export, do not read whole" header or README in `governance/planning/beads-github-export/`.
2. Split `agents/dev_reports.md` and `agents/pm_status.md` into current summary plus archived dated chunks, or add a hard "search-first historical log" warning near the top.
3. Add a tiny `governance/audit/reports/README.md` that says reports are historical evidence and should be searched by date/topic.
4. Add current MCP repo-id discovery to the retrieval workflow: list/status first, then use the exact repo id returned by the active session.
5. Treat absent `jdocmunch` as a routing failure to record in handoff, not a reason to brute-read large docs silently.
6. Keep `AGENTS.md` minimal; put any new detailed routing in `governance/execution/repo-context-retrieval.md` or a small README beside the bloated artifact family.

## Validation

- Confirmed `driftwood.md` exists.
- Confirmed findings are limited to workflow efficiency.
- Confirmed no runtime, gameplay, prompt, archive-cleanup, or generated-export changes were made.
