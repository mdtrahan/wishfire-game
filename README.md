# Codex-Orka

Codex-Orka is the Wishfire HTML5 game workspace.

## Runtime Surfaces

- Browser runner: `web-runner/`
- Construct-style runtime mirror: `Scripts/`
- Shared deterministic JavaScript contracts: `src/`
- Rust SimulationCore source: `rust/simulation_core/`
- Product, planning, audit, and workflow truth: `governance/`

Legacy Construct 3 JSON artifacts and conversion tooling are retired. See
`docs/construct3-retirement.md`.

## Working In This Repo

Before editing, read `AGENTS.md`, `ai-memory/context.md`, and every applicable
child `AGENTS.md` on the path you will touch. Beads controls implementation
scope; Git is the transport layer.

For runtime work, prefer focused owner modules over adding behavior to
`web-runner/app.js`. Keep deterministic rules in `src/`, `web-runner/src/core/`,
or Rust-owned SimulationCore seams when the local contract requires it.

## Useful Commands

```bash
npm run serve:qa
npm test
npm run test:appjs-boundary
npm run test:hot-file-gate
npm run rust:build-wasm
cargo test --manifest-path rust/simulation_core/Cargo.toml
```

Prefer focused `node --test tests/<file>.test.js` checks during development and
use broad validation only when the change requires it.

## Primary References

- `AGENTS.md` - repo workflow, Beads gate, DOX chain, and ownership rules.
- `governance/product/player-living-guide.md` - player-facing product truth.
- `governance/product/abilities.html` - ability system map and drift register.
- `governance/execution/repo-context-retrieval.md` - retrieval/tool routing.
- `governance/planning/app-js-thinning-playbook.md` - `app.js` ownership rules.
- `governance/planning/simulation-core-rust-js-contract.md` - Rust/JS boundary.
