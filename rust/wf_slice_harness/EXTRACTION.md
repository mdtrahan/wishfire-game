# Extraction receipt: ORKA-2hhu

Source: `experiment/ORKA-6jh1-rust-combat-mvp@9c142b5f73294bd5a783e79d3840d0c3386c90a1`, under `experiments/rust-combat-mvp/crates/wf_sim/`. Starting integration checkout: `b4d52e3caf8219a0ae6c2e5c947ebfcfd02f51a6`. The frozen ref and working copy were never edited.

Only these new crates and `rust/AGENTS.md` change. `simulation_core`, wasm, JS and the browser game retain their existing dependency graph.

## Proof

- Pristine source was extracted with `git archive` into `/tmp/orka-2hhu-baseline.nJQmHJ`. The temporary workspace includes only `wf_sim`, its existing lockfile, waves JSON and arena metadata. No source edits were made. The narrowed workspace membership excludes unrelated clients.
- Pristine `cargo test --offline`: **541 passed, 10 ignored**. All 551 original tests have one destination in [TEST_DESTINATIONS.tsv](TEST_DESTINATIONS.tsv); assertions and golden hashes retain their pinned values.
- The independent trace runner in `examples/trace.rs` was compiled against pristine `wf_sim` by changing only its import. `fixtures/baseline-trace.tsv` stores checkpoints and rolling digests of **every** combined state hash and ordered event through 27,000 steps, seeds **1, 7, 42**, spotlight **off/on**. All six runs match exactly; no allowed divergence or hash re-pin was needed.
- Default combat build runs 13 tests: four retained Mend tests, one retained geometry test and eight new host-input/output tests. Harness runs the other 536 original passing tests, 10 original ignored reports and the new pinned trace test.
- Target directories, temporary source builds and logs stay under `/tmp/orka-2hhu-*`. Nothing production depends on the harness. Arena JSON is metadata required by existing floor assertions; no art, binary or target directory is copied into Git.

## Verification environment

Native macOS arm64, `rustc 1.95.0 (59807616e 2026-04-14)`, `cargo 1.95.0`. Both crates retain the pristine source's resolved dependency versions. The isolated combat copy at `/tmp/orka-2hhu-isolated/wf_combat` passes its 13 tests without the harness or wave data present.

The original and facade-overlay `wf_client`/`wf_bench` pass `cargo check`, including the bench `bound` feature. Sources come from the same pinned archive; the overlay substitutes a `wf_sim` facade that reexports this harness. These are compilation checks. The temporary reference workspace uses `{}` as compile-only `gen/assets.json` bytes because the packed artwork is generated and absent from Git. No renderer run, artwork fidelity or asset-package validation is claimed. The pinned font and three bench Markdown inputs exist only in that temporary build.

The final default harness suite passes **537 tests**, with the original **10 ignored**. The combat suite passes **13 tests**. In total, all **541 originally passing tests** survive across their new homes, alongside **nine added tests**. The harness diagnostic feature also compiles. All original zero-allocation assertions pass.

## Seams

| Previous coupling | Combat input or output | Harness responsibility |
| --- | --- | --- |
| Actor spawn scaling | Resolved `Stats` per spawn, resolved child profiles | Apply original stage/tier/wave scaling once, in original float order |
| Boss timing/geometry | Cooldown multiplier, slam radius bonus, recharge reduction; neutral defaults | Resolve escalation on the original schedule |
| Transition and wave/boss gates | `EncounterState` booleans | Preserve the original phase decisions |
| Chest movement goals | Optional actor-keyed interest points | Compute chest approach before each hero update |
| Death bookkeeping | Ordered defeat-position output | Update last fall and kill count at original death seams |
| Marker materialization | Marker/actor output | Record authored spawn IDs before host completion checks |
| Spotlight finish | `finish_requested` output | Run original `finish_stage` synchronously after the combat call |
| Gameplay hash | Combat hash plus reference visitor insertion points | Hash scenario, director, rewards and chests in original byte order |

## File destinations

Paths below are relative to `rust/`. Inline test rows name their extra destination; per-test original and new line numbers are in the TSV.

| Original source | Destination |
| --- | --- |
| `src/actors.rs` | `wf_combat/src/actors.rs` |
| `src/ai.rs` | `wf_combat/src/ai.rs`; `wf_slice_harness/src/ai_inline.rs (original inline assertions)` |
| `src/api.rs` | `wf_combat/src/api.rs (combat views/events)`; `wf_slice_harness/src/api.rs (host views/events and facade)` |
| `src/arcane_pulse_tests.rs` | `wf_slice_harness/src/arcane_pulse_tests.rs` |
| `src/barrage.rs` | `wf_combat/src/barrage.rs`; `wf_slice_harness/src/barrage_inline.rs (original inline assertions)` |
| `src/beam_metrics.rs` | `wf_combat/src/beam_metrics.rs`; `wf_slice_harness/src/beam_metrics.rs` |
| `src/beam_tests.rs` | `wf_slice_harness/src/beam_tests.rs` |
| `src/boss_commit.rs` | `wf_combat/src/boss_commit.rs` |
| `src/boss_commit_tests.rs` | `wf_slice_harness/src/boss_commit_tests.rs` |
| `src/boss_hp_tests.rs` | `wf_slice_harness/src/boss_hp_tests.rs` |
| `src/boss_identity_tests.rs` | `wf_slice_harness/src/boss_identity_tests.rs` |
| `src/bound.rs` | `wf_combat/src/bound.rs`; `wf_slice_harness/src/bound.rs` |
| `src/bubble_aura.rs` | `wf_combat/src/bubble_aura.rs` |
| `src/bubble_aura_tests.rs` | `wf_slice_harness/src/bubble_aura_tests.rs` |
| `src/bubble_target_tests.rs` | `wf_slice_harness/src/bubble_target_tests.rs` |
| `src/combat.rs` | `wf_combat/src/combat.rs`; `wf_slice_harness/src/combat_inline.rs (original inline assertions)` |
| `src/combo.rs` | `wf_combat/src/combo.rs` |
| `src/combo_metrics.rs` | `wf_slice_harness/src/combo_metrics.rs` |
| `src/combo_tests.rs` | `wf_slice_harness/src/combo_tests.rs` |
| `src/director.rs` | `wf_slice_harness/src/director.rs` |
| `src/djinn_summon_tests.rs` | `wf_slice_harness/src/djinn_summon_tests.rs` |
| `src/enemies.rs` | `wf_combat/src/enemies.rs` |
| `src/enemy_healing.rs` | `wf_combat/src/enemy_healing.rs`; `wf_slice_harness/src/enemy_healing_inline.rs (original inline assertions)` |
| `src/enemy_status.rs` | `wf_combat/src/enemy_status.rs` |
| `src/enmity.rs` | `wf_combat/src/enmity.rs` |
| `src/enmity_attribution.rs` | `wf_combat/src/enmity_attribution.rs`; `wf_slice_harness/src/enmity_attribution.rs` |
| `src/enmity_metrics.rs` | `wf_slice_harness/src/enmity_metrics.rs` |
| `src/enmity_tests.rs` | `wf_slice_harness/src/enmity_tests.rs` |
| `src/events.rs` | `wf_combat/src/events.rs` |
| `src/fara_tests.rs` | `wf_slice_harness/src/fara_tests.rs` |
| `src/fizzmite_death_tests.rs` | `wf_slice_harness/src/fizzmite_death_tests.rs` |
| `src/formations.rs` | `wf_slice_harness/src/formations.rs` |
| `src/groove.rs` | `wf_combat/src/groove.rs` |
| `src/groove_tests.rs` | `wf_slice_harness/src/groove_tests.rs` |
| `src/ground_pound_tests.rs` | `wf_slice_harness/src/ground_pound_tests.rs` |
| `src/hazards.rs` | `wf_combat/src/hazards.rs`; `wf_slice_harness/src/trials.rs (trial setup); geometry assertions remain core` |
| `src/healing_spring.rs` | `wf_combat/src/healing_spring.rs` |
| `src/healing_spring_tests.rs` | `wf_slice_harness/src/healing_spring_tests.rs` |
| `src/kaja_mend_tests.rs` | `wf_combat/src/kaja_mend_tests.rs` |
| `src/kiting.rs` | `wf_combat/src/kiting.rs` |
| `src/knockback.rs` | `wf_combat/src/knockback.rs` |
| `src/knockback_tests.rs` | `wf_slice_harness/src/knockback_tests.rs` |
| `src/lib.rs` | `wf_combat/src/lib.rs (mechanics)`; `wf_slice_harness/src/lib.rs (original host pipeline)`; `wf_slice_harness/src/trials.rs (trial setup)` |
| `src/mage_kiting_tests.rs` | `wf_slice_harness/src/mage_kiting_tests.rs` |
| `src/mage_target_tests.rs` | `wf_slice_harness/src/mage_target_tests.rs` |
| `src/marching_stomp.rs` | `wf_combat/src/marching_stomp.rs` |
| `src/marching_stomp_tests.rs` | `wf_slice_harness/src/marching_stomp_tests.rs` |
| `src/marid.rs` | `wf_combat/src/marid.rs`; `wf_slice_harness/src/marid_inline.rs (original inline assertions)` |
| `src/math.rs` | `wf_combat/src/math.rs` |
| `src/mirewing_tests.rs` | `wf_slice_harness/src/mirewing_tests.rs` |
| `src/qa_showcase.rs` | `wf_slice_harness/src/qa_showcase.rs` |
| `src/revival.rs` | `wf_combat/src/revival.rs` |
| `src/rewards.rs` | `wf_slice_harness/src/rewards.rs` |
| `src/rng.rs` | `wf_combat/src/rng.rs` |
| `src/roster_tests.rs` | `wf_slice_harness/src/roster_tests.rs` |
| `src/round14_tests.rs` | `wf_combat/src/round14_tests.rs`; `wf_slice_harness/src/round14_tests.rs` |
| `src/separation.rs` | `wf_combat/src/separation.rs` |
| `src/skill_spacing_tests.rs` | `wf_slice_harness/src/skill_spacing_tests.rs` |
| `src/snapshot.rs` | `wf_combat/src/snapshot.rs`; `wf_slice_harness/src/snapshot.rs` |
| `src/spatial_hit_tests.rs` | `wf_slice_harness/src/spatial_hit_tests.rs` |
| `src/spawns.rs` | `wf_slice_harness/src/spawns.rs` |
| `src/spotlight.rs` | `wf_combat/src/spotlight.rs` |
| `src/spotlight_tests.rs` | `wf_slice_harness/src/spotlight_tests.rs` |
| `src/spring_behavior_metrics.rs` | `wf_slice_harness/src/spring_behavior_metrics.rs` |
| `src/spring_behavior_tests.rs` | `wf_slice_harness/src/spring_behavior_tests.rs` |
| `src/stage_script.rs` | `wf_slice_harness/src/stage_script.rs` |
| `src/stomp_metrics.rs` | `wf_combat/src/stomp_metrics.rs`; `wf_slice_harness/src/stomp_metrics.rs` |
| `src/survival_tests.rs` | `wf_slice_harness/src/survival_tests.rs` |
| `src/target_lock_metrics.rs` | `wf_combat/src/target_lock_metrics.rs`; `wf_slice_harness/src/target_lock_metrics.rs` |
| `src/target_lock_tests.rs` | `wf_slice_harness/src/target_lock_tests.rs` |
| `src/taunt_floor_tests.rs` | `wf_slice_harness/src/taunt_floor_tests.rs` |
| `src/tests.rs` | `wf_slice_harness/src/tests.rs` |
| `src/tuning.rs` | `wf_combat/src/tuning.rs`; `wf_slice_harness/src/tuning.rs` |
| `src/wave_clear_tests.rs` | `wf_slice_harness/src/wave_clear_tests.rs` |
| `src/wave_tests.rs` | `wf_slice_harness/src/wave_tests.rs` |
| `build.rs` | `wf_slice_harness/build.rs`; input path points at `fixtures/waves.json` |
| `Cargo.toml` | Standalone manifests in both crates; pinned lockfiles retain pristine dependency versions |
| `data/waves.json` | `wf_slice_harness/fixtures/waves.json` |
| `art/arena/arena.json` | `wf_slice_harness/fixtures/arena.json` (metadata only) |

## Reproduce baseline

Archive the pinned crate, lockfile, waves and arena JSON to a fresh temporary directory. Use a temporary workspace containing only `crates/wf_sim` with the original workspace edition/publish/libm values. Run its unchanged tests. Copy `examples/trace.rs` into that temporary crate and replace `use wf_slice_harness::*` with `use wf_sim::*`. Run `cargo run --offline --example trace` and compare stdout with `fixtures/baseline-trace.tsv`.

The harness keeps mechanics fixtures that still use private reference setup together with the owning host fixtures in this bounded extraction. They call the extracted mechanics through `Sim::combat`; they contain no second combat implementation. The pure Mend and geometry fixtures demonstrate the direct host-free path. Later definition/roster/protocol beads can migrate additional setup without discarding these assertions.
