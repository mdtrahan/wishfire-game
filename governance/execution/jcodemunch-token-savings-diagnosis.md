# jcodemunch Token-Savings Diagnosis

## Verdict
The low observed token savings are caused by routing and index hygiene issues, not by lack of value in jcodemunch itself.

## Evidence
- `codebase-memory` is ready for this repo: `9693` nodes and `23847` edges.
- A bare jcodemunch repo request for `Codex-Orka` is ambiguous. The tool reports two candidates:
  - `local/Codex-Orka-904e2bad`
  - `local/Codex-Orka-c326b16a`
- The current index is `local/Codex-Orka-904e2bad`:
  - `340` files
  - `6259` symbols
  - `web-runner/app.js` dependency graph: `39` nodes and `38` edges
  - current runtime graph includes `renderRuntime`, `partyStatOsd`, `combatSessionInitializer`, `devToolingRuntime`, `superGemRuntime`, and `simulationCoreShadow`
- The stale index is `local/Codex-Orka-c326b16a`:
  - `155` files
  - `2283` symbols
  - `web-runner/app.js` dependency graph: `4` nodes and `3` edges
  - app graph only showed old imports: `state.js`, `functionRegistry.js`, and `combatRuntimeGateway.js`
- `get_symbol_importance` showed the difference clearly:
  - current index, scope `web-runner`: `297085` tokens saved for the call
  - stale index, scope `web-runner`: `0` tokens saved for the call
- `.codex/agent_rules.md` referenced obsolete tool names: `jcodemunch.discover`, `jcodemunch.search`, and `jcodemunch.retrieve`.

## Root Causes
1. Duplicate Codex-Orka jcodemunch indexes make the plain repo name ambiguous.
2. One duplicate index is stale enough to miss the modern runtime graph.
3. Local agent rules pointed at old jcodemunch APIs that are not the current exposed MCP calls.
4. When jcodemunch routing fails, agents are likely to fall back to broad `rg`, `sed`, or full-file reads, which erases the expected token savings.

## Fixes Applied
- Updated `.codex/agent_rules.md` to use the current retrieval order and current jcodemunch tool names.
- Added Codex-Orka index routing guidance to `governance/execution/jcodemunch-mcp-adoption.md`.
- Recorded this diagnosis so future Beads can distinguish tool value from stale-index noise.

## Operating Rule
Use this sequence for repo/code orientation:
1. Read the required AGENTS/DOX chain and live Beads state.
2. Use `codebase-memory` for broad repo orientation.
3. Use jcodemunch with `local/Codex-Orka-904e2bad` for exact code structure.
4. If the repo name is ambiguous, resolve the current index first.
5. Use focused local reads only for final verification or short target files.

## Follow-Up
- Remove or refresh `local/Codex-Orka-c326b16a` when jcodemunch exposes a safe admin path for index cleanup.
- Revalidate the canonical jcodemunch repo id after major repo moves or full reindexing.
