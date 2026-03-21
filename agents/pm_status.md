# PM Status

Active snapshot only. Historical PM snapshots live in `/agents/archive/pm_status_archive.md` and should not be read during normal startup unless historical investigation is required.

_Last updated: 2026-03-20_

## Completed Beads
- ORKA-tuin (hot-file commit preparation is now repo-owned: `tools/prepare_hot_file_commit.sh` generates `.scope` metadata from staged diffs, can temporarily align the active Beads lane for commit, and the shared validator now fails once with a prepare instruction or one batched error list instead of forcing iterative human retries)
- ORKA-tuin follow-up (the original hot-file lock came from ORKA-9yo and was optimized in ORKA-qpff as a strict function-scope guard; the new follow-up keeps that discipline but adds explicit `__MODULE__` scope for reviewed top-level imports/constants/state wiring so normal `web-runner/app.js` work is no longer blocked as uncommittable)
- ORKA-wnjr (turn integrity is now hardened across dev-panel apply/refresh, scheduler handoff, and mirrored turn baselines; refresh reseeds through one shared transient-state baseline, stale paused-session snapshots can no longer overwrite a fresh combat session, the canonical `balance_harness` browser path has been revalidated through its CDP fallback, and a focused Playwright combat-refresh scenario now shows real post-refresh enemy and hero turn progression with no repeated actor across turn advances)
- ORKA-4dcz (Djinn/Marid board clears are now structured as explicit Scathe/Sweep skill harness profiles, with direct tests for identity, axis semantics, pressure state, and incomplete-board fallback)
- ORKA-890 (heal combat text punctuation was already compliant in both mirrors; added a focused contract and closed the stale-open bead on proof)
- ORKA-3g5x (Kojonn delayed-hit packets now carry immutable final Power Amp totals, and focused x2/x3 regression coverage locks the red burst path against future drift)
- ORKA-l8r (fallback loop startup in `Scripts/logicCore.js` is now idempotent and restart-safe because interval/tick ownership is tracked and teardown is explicit)
- ORKA-d9g (hero screen now exposes a formation mode that assigns/swaps the four active party slots through the existing persistent combat-boot seam)
- ORKA-7c0.2 (stale-open hero-screen parity child reconciled closed after confirming the evidence pack and locked runtime style-spec still exist)
- ORKA-3go (enemy turns no longer leak player pickability into idle enemy states; the runtime now forces deterministic enemy-turn recovery instead of parking on actionable-state timeouts)
- ORKA-dnm (enemy-turn idle leaks now recover through a shared enemy-turn gate; attached-browser balance harness runs completed on energy depletion instead of timing out in a false enemy-turn actionable state)
- ORKA-8w4u (coordination guidance now keeps historical logs archived and no longer hard-stops PM/dev flow solely because unresolved issue count is high)
- ORKA-xtpi (Djinn/Marid line-clears now set explicit board-pressure state so holes persist until player commit without triggering immediate refill or infinite hero-turn loops; the incomplete-board fallback guard remains locked by focused regression coverage)
- ORKA-av1q (green AOE hero actions now use a longer hold/retreat profile and later impact beat so the lunge/return has breathing room)
- ORKA-7clz (lunge impact and defender flinch now use a delayed handoff so the beats read cleanly instead of colliding at the same instant)
- ORKA-gc68 (hero and enemy lunges are now clamped to the combat midpoint so neither side crosses the horizontal centerline)
- ORKA-x7gh (hero lunge distance pulled back 15% so heroes no longer overlap enemies as aggressively during the shared lunge motion)
- ORKA-nri9 (all actor lunges now use the shared 200px forward travel with a 750ms `cubic-bezier(1, 0, 0, 1)` forward phase)
- ORKA-tvn5 (enemy line-clears now rebuild board occupancy immediately through the app gem-sync seam, so refill/playability recovery sees real empty slots)
- ORKA-t2h3 (encounter respawns now cache the full eligible locale/faction pool instead of reusing the initial tiny pick set)
- ORKA-47nj (combat fail exits now return to layout 0 and idle collect restores player energy instead of gold)
- ORKA-pa1z (idle forced-enemy respawn seam restored with focused regression coverage)
- ORKA-3nlw (dirty worktree inventoried into explicit cleanup buckets and commit order)
- ORKA-zys (repo-side `.beads` open/in-progress mirrors reconciled to live `bd` state)

## Active Work
- No bead is active right now. The queue can move again without the hot-file commit babysitting loop that blocked recent runtime lanes.

## Next Tasks
- Use `tools/prepare_hot_file_commit.sh <bd-id>` before the next hot-file commit attempt instead of hand-authoring `.beads/hot-file-lock/*.scope`.
- If a hot-file commit lane needs temporary queue alignment, prefer `tools/prepare_hot_file_commit.sh <bd-id> --align-active` and then apply the printed restore commands after commit.
- Compare the harness `require('playwright').chromium.launch(...)` path against the working Playwright MCP/browser launch path so the repo can recover hands-off testing inside the canonical `balance_harness` lane if the launch assumptions can be matched.
- Keep `npm run playwright:launch-matrix` as the canonical proof that the current direct-launch regression is broader than Playwright flags alone.
- Use the bounded `BALANCE_CDP_URL=http://127.0.0.1:9222 npm run balance-harness -- --sessions 1 --maxWaves 1` run only as a secondary runtime check after browser-ownership assumptions are clarified, not as proof that Playwright MCP itself is broken.
- Promote the focused turn-refresh Playwright scenario into a reusable repo-owned check if we want this exact dev-panel apply/refresh proof to run automatically instead of as a one-off artifact script.
- Commit governance cleanup separately from runtime/test work; do not mix the `idleFarmRuntime` bug-fix bundle into the coordination patch.
- Rewrite ORKA-6opp before assigning it again; the live bead lacks explicit acceptance/test detail for safe implementation.
- Keep `ORKA-n0g` queued as a future stub; its own bead comment says the basic shell already shipped and remaining work is later exclusive-slot behavior, not another scaffold pass.
- The remaining visible ready head is now mostly under-specified features, future stubs, epic parents, or governance/meta lanes rather than another clearly bounded runtime bug.
- Keep using live `bd` for queue decisions instead of `.beads/`.

## Known Issues
- The hot-file hook remains intentionally strict, but the human bottleneck path is now tooling-owned; if enforcement complains after preparation, fix the batched error list or rerun `tools/prepare_hot_file_commit.sh <bd-id>` after staging changes.
- Playwright MCP browser control is working in this environment, so do not describe the current blocker as a generic Playwright or MCP outage.
- External Chrome + CDP attach is confirmed working on this machine/user context, so macOS Automation/Accessibility is not the blocker for the supported path.
- Any Codex-owned Chrome startup still aborts on macOS 26.3.1 in this environment, including plain child-process Chrome launch outside Playwright. Current evidence points at an OS/app-launch boundary (MachPort/Crashpad/HIServices registration), not a harness or Playwright-flag-only bug.
- Shell PATH still needs `export PATH="$HOME/.local/bin:$PATH"` before `bd` commands in automation turns.
- The canonical `balance_harness` now has fresh browser evidence for ORKA-wnjr through `BALANCE_CDP_URL` fallback, and there is now a separate focused Playwright artifact proving the dev-panel apply/refresh seam itself. The remaining limitation is browser ownership: direct Codex-owned Chrome launch still fails, so both proofs rely on the existing CDP fallback.
