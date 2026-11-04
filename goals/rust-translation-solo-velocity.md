# Rust solo translation: velocity log

Epic ORKA-63bf, branch `rust-solo-fable`, port 8807. One dated entry per day, appended by the daily check-in job. Measures: units merged to the branch, cycle time per unit, first-pass yield (unit accepted on first self-verify), check time vs build time, blocked items. Each entry ends with at most two improvements; improvements never trade away code quality, determinism or runtime performance.

## 2026-11-04 (start)

- Started. Worktree reset to origin/main ea8bc3f2. Epic + 12 beads created.
- Architecture call: combat core stays `rust/wf_combat` (it already is the slice sim plus main's deltas) behind the typed host `World` in simulation_core; renderer ported from the slice client; meta rules into `wf_meta` with JS oracle fixtures.
- Units merged: 0. Checks: none yet. Blocked: none.
- Improvements: none yet (no data).

## 2026-11-04 (day 1, 12:15 PST)

- Units merged to the branch since the start entry: 12 beads closed (.1-.12), 11 feature/test commits, head 1d83c5ba. Epic stays open for owner play-through; all children closed, five follow-up beads logged (.13-.17).
- Cycle time per unit (in_progress -> closed, from commit gaps and bd close times): .1 ~5 min, .3 ~19 min, .4 ~20 min, .5+.6 together ~8 h across the overnight gap (host loop parity was the long pole), .7 31 min, .8 42 min, .9 2 h 04 min, .10 26 min, .11 15 min, .12 12 min.
- First-pass yield: 9/12. Three units needed a self-verify fix before closing: .9 (oracle replay exposed a float field type and a payload path), .10 (modal hit order found in the browser), .11 (deletion batch had to be rerun under bash).
- Time in checks vs building: roughly 30/70. Each commit gate ran 1-2 min (retained Node suite + touched crates); browser checks were scripted click/wait/probe sequences, about 10 min per bead; the audit converted two slice tests to the host loop and retired five.
- Blocked: none. Mechanical snags owned on the spot: zsh glob aborts in deletion loops, missing `timeout` binary, `wf_app` is a bin crate (`--bin wf_app` for test listing).
- Previous entry's improvements: none recorded (no data then).
- Improvements: (1) keep writing the JS oracle driver as a concrete replayable op list before the Rust port; it caught every parity bug in .9/.10 before any browser time. (2) keep browser verification as one scripted evaluate sequence per bead (click, wait, probe, read saves) rather than per-step screenshots; it cut .10-.12 checks to minutes without weakening the proof.
