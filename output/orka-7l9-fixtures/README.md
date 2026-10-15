# ORKA-7l9 combat fixtures

`ui-equipped-lamp.json` is the byte-exact lamp save exported after visible collection and equipment in an isolated Wishfire session. Its three body items are assigned to canonical `Falie`, `Kojonn`, and `Runa` keys. SHA-256: `dc2dc36342235e8691b7e6226c3adfd9349f6fa04666f00ae0453b8f3d9d25fe`.

`instance-key-lamp.json` changes only those three loadout keys to `falie#1`, `kojonn#1`, and `runa#1`. It permits an equipped unchanged-build comparison before canonical gear projection was fixed. SHA-256: `b2933c80c33a60ddd341554fce4ce951523393f0d935f639bbb6532f229a45ed`.

`level1-fullhp-heroes.json` was generated from the current `createHeroProgressStore()` and `newHeroProgress()` constructors. It includes four canonical and four deployed `#1` records at level 1, applies the same three body items' stats, and sets each current HP to its geared maximum. This is a synthetic fully healed starter state, not a StoneAge observation or an earned Wishfire progression record. SHA-256: `167ebacab142398fd44bdd0b4fb06fed78c8809c2569df8d09c941a664ab01aa`.

`level15-threehero-heroes.json` preserves the isolated Wishfire export with a synthetic developer level-15 preset and three deployed heroes; it is not earned progression or a StoneAge observation. SHA-256: `3c414abddab2b76350fc2562bd8c5e87a0513adbc21c9dd3e997be375b01ef4e`.

`level15-fourhero-heroes.json` adds only a level-15 `kojonn#1` record to that export. SHA-256: `c65de68efe1bd4cbd7d3087e5aee81ee47154d0e815e265d36bbbedf1231ca27`. `level15-healer-wound-heroes.json` changes only deployed Falie's current HP from 187 to 100, making Kojonn's level-15 heal eligible. SHA-256: `f2cfca590c1ac55425e1d924ab5d4f765987e2f28fe6ada10da5a2c1f7363ca4`.

Use `tools/balance_harness.js` with `--lampFixture` and, for the fully healed case, `--heroFixture`. The exact commands, clean source SHAs, reports, and acceptance limits are in `output/orka-7l9-gauntlet-progress.md`.
