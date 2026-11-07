# Codex-Orka

Codex-Orka is the Wishfire game workspace. The game is one Rust application
(`rust/wf_app`, macroquad client) over the Rust combat simulation
(`rust/wf_combat` through `rust/simulation_core`) with the meta rules in
`rust/wf_meta` and the host loop, saves and economy in `rust/wf_host`. The
JavaScript runtime was translated and removed (ORKA-63bf); `web-runner/`
keeps the source art and the public page path.

## Runtime Surfaces

- Rust app and crates: `rust/` (see `rust/AGENTS.md`)
- Source art and runtime data: `web-runner/assets/`
- Product, planning, audit, and workflow truth: `governance/`
- Presentation specs that travel with every combat integration: `docs/vfx-3d/`

## Working In This Repo

Before editing, read `AGENTS.md`, `ai-memory/context.md`, and every applicable
child `AGENTS.md` on the path you will touch. Beads controls implementation
scope; Git is the transport layer.

## Useful Commands

```bash
npm run build            # pack art, build wf_app for wasm32, stage rust/wf_app/web
npm run serve            # serve the staged app on http://127.0.0.1:8807/
npm test                 # retained Node tooling contracts
cargo test --manifest-path rust/wf_meta/Cargo.toml   # one crate (also wf_host, wf_combat, wf_app, ...)
npm run test:merge -- --base origin/main             # full merge tier
```

The JS oracle fixtures under `tests/fixtures/rust-oracle/` are the frozen rule
specification; `tools/rust_oracle/README.md` explains how they were produced.

## Primary References

- `AGENTS.md` - repo workflow, Beads gate, DOX chain, and ownership rules.
- `rust/AGENTS.md` - crate boundaries and the translation contracts.
- `governance/product/player-living-guide.md` - player-facing product truth.
- `governance/product/abilities.html` - ability system map and drift register.
