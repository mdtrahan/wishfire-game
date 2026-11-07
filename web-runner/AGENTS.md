# Web Runner DOX

## Purpose
- `web-runner/` is the asset tree and the public page path of the game. The game itself is the Rust app in `rust/wf_app` (see `rust/AGENTS.md`); the JavaScript runtime was removed in the Rust cutover (ORKA-63bf.11).

## Ownership
- `index.html` is a thin loader that points at `rust/wf_app/web/`. Hosted builds (`tools/build_runtime_release.mjs`) publish the built Rust page as `dist/web-runner/`, so the public `/web-runner/` URL keeps serving the game.
- `assets/` owns source art and runtime data the Rust build reads: `puppets/` and `arenas/` (packed by `rust/wf_pack`), `rust-combat/` (effects, decals, font manifest), `images/` (chrome art copied by `tools/build_wf_app.sh`), `narrative/` (chapter map, town token, scene cast), `gems/coin.png`, `enemies.json`, `fonts/`.
- No gameplay rule lives here. Rules live in `rust/wf_meta`, `rust/wf_host` and `rust/wf_combat`.

## Local Contracts
- Add chrome art by copying it in `tools/build_wf_app.sh` and listing it in `rust/wf_app/src/assets.rs` (`UI_ART`).
- Asset filenames are referenced by the build script and Rust code; rename only with a full reference search.

## Child DOX Index
- `assets/AGENTS.md` - runtime data and media contracts.
