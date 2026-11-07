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

## 2026-11-05 (day 2, 09:00 PST)

- Units merged since the last entry: 10 beads closed (.18-.27), 15 feature/fix commits, head fed754f2. Epic stays open for owner play-through; follow-ups .13-.17 still open, not started (owner direction went to the Bag, orbs and Dev Tools instead).
- Cycle time per unit (bead created -> closed; `started_at` is not recorded and beads are opened when coding starts, so investigation before that is not counted): .18 5 min (bead opened after the work), .19 53 min, .20 28 min, .21 22 min, .22 12 min, .23 6 min, .24 5 min, .25 15 min, .26 45 min, .27 4 min.
- First-pass yield: 4/6 on the units with records (.22-.27); .25 needed two fixes in self-verify (host rejects speeds above 4x, Step did not advance a paused clock) and .27 one (test compile error). .18-.21 not re-measured. Two defects reached the owner: the unbounded orb field from .20 (2,488 saved orbs, 56 ms per save transaction; fixed in .22) and the dead Dev panel after RESET GAME from .22 (fixed in .25).
- Time in checks vs building: roughly 40/60. Units were small, so the fixed cost per bead (Rust suites ~1 min, Node ~20 s, one headless browser script 1-2 min, feature commit plus two receipt commits) was close to half of the shortest ones.
- Blocked: none. Owned on the spot: one push rejected by GitHub (`fatal error in commit_refs`), succeeded on retry. Waiting on owner decisions, not blocking other work: Bag flow reorder (reward modal), what happens to displaced orbs, how banked Bag fills become levels once EXP exists.
- Previous entry's improvements: (1) oracle op list before a port: not exercised, no new ports (these units were owner-directed changes with no JS oracle). (2) One scripted browser sequence per bead: helped; every unit .22-.27 was proven by a single headless script in 1-2 min.
- Improvements: (1) anything that accumulates in a save gets its bound and a long-idle test in the same bead that introduces it; the orb pile-up was the only defect that put the owner's machine at risk. (2) Move the shared browser helpers (boot, START, Dev Tools button/row lookups, save probe) into one committed tool so each bead's check is a short script instead of a rewritten one; selector mistakes cost reruns in .25.

## 2026-11-06 (day 3, 09:00 PST)

- Units merged since the last entry: 22 beads closed (.28-.49), 22 feature/fix commits plus 22 gate receipts, head 913f3099. All were owner-directed changes from four review rounds. Epic stays open for owner play-through; follow-ups .13-.17 still open, not started (.39 fixed the ticket and Level Up half of .13; .13 needs re-scoping to what is left).
- Cycle time per unit: singles (created -> closed) .28 15 min, .29 10, .30 3, .31 7, .32 10, .33 13, .34 12, .35 2, .36 5. Batch beads were created together, so they are measured close-to-close: .37 6, .38 5, .39 8, .41 22, .40 14 (five units in 55 min); .42 3, .43 2, .44 2, .45 5, .46 8, .49 4, .47 11, .48 9 (eight units in 43 min). Median about 6 min; the long pole was .41 (Arcane Pulse totem, new hazard kind).
- First-pass yield: 10/16 on .34-.49; six needed a fix in self-verify (.34 test assumptions about free slots, .41 test imports, .42 chained free pulses exposed by the smaller blast, .47 the opening wave used a second spawn path, .48 manifest did not round-trip through a JSON rewrite, .49 a kill on the first strike kept the whole bar). .28-.33 not re-measured. Rework reaching the owner was the larger cost: 8 of the 22 units were bugs the owner found in play (.31, .38, .39, .40, .45, .47, .48, .49). Three were translation gaps (.39 known since .13, .40 retired skill text, .48 an image never copied in); .45 reversed a flow choice Fable made in .32/.34; Arcane Pulse's radius changed three times (.29, .41, .42).
- Time in checks vs building: roughly 45/55. Units were mostly 2-10 min, so the fixed cost (Rust suites, commit gate, receipt commit, push, one headless script) was about half of each; six units also re-recorded the stage trace and compared outcomes (.30, .37, .41, .42, .47, .49). .47 and .49 are proven by simulation tests only, not watched in the browser.
- Blocked: none. Owned on the spot: final replies bounced by the reply-shape gate and resent shorter; a safety check refuses glob deletes after `cd`, so check outputs go to new folders. Standing miss: monday cards not updated (no monday tool in this session). Waiting on owner, not blocking: totem drain rate, Done button wording, whether held Essence is marked on the bag, retired text in Party Skills / Resonance / star sheet.
- Previous entry's improvements: (1) bound plus test in the same bead for anything that accumulates: helped; resource pickups (.33) shipped with `LOOT_LIMIT` and judged-at-pickup orbs (.34) with a Bag-capacity assertion, and no pile-up reached the owner. (2) Committed browser helpers: not done; twelve check scripts still sit in the session scratchpad and boot/selector code was rewritten per bead (two selector reruns in .34).
- Improvements: (1) one gap-sweep bead before the next review round: diff the art manifest and hero text against the slice and main so missing images and retired text are found by a script, not by the owner (it would have caught .48 and .40; `hit-fire.png` and `crit-fire.png` are already known absent). (2) Carry over the committed browser helper, and use it to watch each owner-reported visual symptom once in the browser before the unit closes, so combat fixes like .47/.49 are not closed on simulation proof alone.
