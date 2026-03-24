# PM Status

Active snapshot only. Historical PM snapshots live in `/agents/archive/pm_status_archive.md` and should not be read during normal startup unless historical investigation is required.

_Last updated: 2026-03-23_

## Completed Beads
- ORKA-6opp queue correction (PM cycle claimed the ready-head feature bead just long enough to confirm it is still underspecified, then restored it to `open`; the bead purpose is clear, but acceptance/test boundaries are still missing so it remains rewrite-only rather than executable)
- ORKA-j4t0 (PM-cycle anti-orphan rule added: claimed or temporarily activated beads must now be executed, explicitly handed off, or restored to truthful queue state in the same cycle instead of being left as queue noise)
- ORKA-7w7q (multi-pass browser QA sweep completed: the discovery lane click-verified the `storyMock -> town -> combat -> mapLayout -> combat` loop across 3 passes and judged the game functionally sustainable on that core path, while also identifying flaky/unclassified non-map bottom-nav hit targets as the next browser-coverage risk)
- ORKA-e1n4 (bead-purpose statement compliance is now hardcoded: shared Beads process, PM flow, and dev flow all require a plain-language bead-purpose statement, and skipping it is explicitly non-compliant)
- ORKA-jz5i (queue cleanup sweep completed: ORKA-9yo was closed as stale/superseded by the shipped hot-file prepare/enforce tooling, ORKA-6n7 and ORKA-njg were explicitly marked rewrite-only instead of executable-ready, and ORKA-n0g was clarified as a future stub rather than another scaffold pass)
- ORKA-omdl (browser discovery-lane test case completed: the shipping lane reconfirmed the Chrome/AppKit startup boundary and produced no artifact, while the discovery lane produced richer runtime QA signal on the same local game scenario and classified the pilot as `found more`)
- ORKA-kewj (added a repo-owned browser discovery-lane pilot: the balance harness remains the shipping lane, while PM/dev prompts and QA docs now define when an experimental discovery lane is allowed, how it is reported, and how to unwind it)
- ORKA-9zlf follow-up 4 (HoT shimmer diamonds now cap at full opacity and are another 20% smaller, improving contrast without changing timing or line behavior)
- ORKA-9zlf follow-up 3 (HoT shimmer diamonds now cap at 0.8 opacity and are 20% smaller, improving readability without overpowering the hero lane)
- ORKA-apdf follow-up 6 (Faze DoT particles now cap at 90% opacity for clearer mid-combat read while staying unmasked above enemies)
- ORKA-cwtr (dev-panel forced monochrome boards no longer manufacture hero-loop leaks or freeze after the first blue/heal/purple support match; deferred advance now respects transient refill ownership and stale no-work refill passes clear `BoardFillActive`)
- ORKA-apdf follow-up (Kojonn Faze blight now adds slow upward purple dots over affected enemies while keeping the existing purple mask, creating clearer DoT-state symmetry with the new HoT party shimmer)
- ORKA-9zlf (party HoT no longer uses the sickly full-sprite hero tint; active regen now renders as a subtle clipped light-green vertical shimmer over heroes instead)
- ORKA-vlt8 follow-up (HP bar GSAP punch no longer sets DOM-only `transformOrigin` on plain canvas state objects, so combat HP updates stop emitting the false plugin warning while keeping the same front/lag easing split and bar punch behavior)
- ORKA-bypu (combat no longer falsely exits and re-enters through layout transitions when cached `PartyHP` drifts stale; defeat/fail gating and mirrored party-alive checks now derive from live hero entities instead of aggregate HUD state)
- ORKA-1g3x (party-wide HoT now adds a slight persistent light-green masked overlay to hero sprites for the full active regen duration, using the same sprite-overlay ownership seam as enemy Faze rather than only the HP bar cue)
- ORKA-jx97 (party HoT no longer double-logs floating text on the HP bar; HoT ticks now show actor-side heal bloom plus a short positive green wash on the party HP bar)
- ORKA-rszf (Kojonn Faze blight no longer spawns floating damage text on enemies; the purple overlay remains the primary signal while DoT damage and status duration stay intact)
- ORKA-rydb follow-up (gold coin scatter radius was tightened by 40% so the bloom stays closer to the source before the dart-to-wallet phase)
- ORKA-apdf (Kojonn Faze blight now keeps a persistent purple overlay attached to the affected enemy actor for the full DoT lifetime by deriving the render state from `EnemyDamageOverTime`, and the overlay clears only when the effect expires or the enemy dies)
- ORKA-rydb (gold coin collection now uses a dedicated GSAP scatter -> hover -> dart animation mode that targets the existing wallet seam without changing the default gem-merge path or reward math)
- ORKA-vlt8 (party and enemy HP bars now use a GSAP-driven front/lag split with faster front response, slower catch-up lag, and a small punch on change, implemented inside the existing canvas render seam instead of introducing a second DOM bar system)
- ORKA-baz4 (heals now have a separate reusable GSAP bloom effect built from heavy `➕` particles, triggered alongside heal numbers without changing damage-number motion or heal formatting)
- ORKA-baz4 follow-up (the heal bloom interpretation was tightened: it now renders behind hero sprites in the existing heal-blue palette and no longer fires from HP bar heal text, keeping the effect on the actor seam instead of the bar seam)
- ORKA-baz4 follow-up 2 (party-wide hero heals now fan heal bloom out to every hero behind their sprite, even when the heal value itself is still summarized at the party bar seam)
- ORKA-baz4 follow-up 3 (heal bloom pluses no longer depend on font glyph coloration and now render as solid heal-blue shapes, preventing black/grey QA regressions)
- ORKA-baz4 follow-up 4 (heal bloom density was reduced by about 30% so the effect reads cleaner while keeping the same timing and actor-seam placement)
- ORKA-3u60 follow-up (enemy death fade now stays on the original enemy actor instead of switching to a post-removal ghost copy, which removes the ghost-in/pop-out artifact seen most clearly on instant/AOE kills)
- ORKA-3u60 (enemy deaths now snapshot an actor-owned fade ghost before removal, so defeated enemies fade out at their own position instead of instantly popping out through slot-state disappearance; respawn timing and combat resolution are unchanged)
- ORKA-ejmi follow-up 2 (crit presentation now keeps white text while still using the new grouped GSAP motion, direct and deferred damage paths treat Power Amp x2/x3 as crit presentation, and hero heal/regen seams now preserve crit provenance so HoT text can render `!!` instead of silently dropping it in `app.js`)
- ORKA-ejmi (critical-hit damage text now appends `!!` through explicit crit provenance from the combat/heal owner seams instead of a fake damage-threshold heuristic, so low-value real crits show emphasis, high-value non-crits do not, and the grouped GSAP damage-number motion remains unchanged)
- ORKA-gmyj (damage numbers now use a reusable GSAP timeline module with per-digit spans, crit pre-phase behavior, stagger/random drift, and DOM cleanup; the live browser proof showed a spawned `-123` wrapper with 4 spans that auto-removed after timeline completion)
- ORKA-acx5 (damage and heal number text now goes through a minimal reusable formatter so damage is prefixed with `-` and healing with `+` before render)
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
- No bead is currently in progress.

## Next Tasks
- `ORKA-39i0` remains the highest-priority executable bug lane. The next implementation cycle should fix the red single-target initiative handoff path: after `HERO_SINGLE` completes, Huun can still become immediately actionable again with `TurnSerial` unchanged.
- Do not assign `ORKA-6opp` again until the bead is rewritten with per-hero presentation expectations, explicit non-goals, and focused test requirements; right now it is a clear idea with no safe pass/fail contract.
- After `ORKA-j4t0`, return to `ORKA-39i0` only when we are actually ready to run the proof-or-close runtime verification in the same cycle.
- If `ORKA-39i0` closes cleanly on runtime evidence, `ORKA-4dpd` remains the clearest next implementation-ready non-epic lane.
- Reopen browser discovery only if we need broader layout coverage than `storyMock`, `town`, `combat`, and `mapLayout`; the next highest-value target is classifying real click hit boxes for `Hero` and `Astral Flow` rather than re-proving the map loop again.
- Repeat the browser discovery lane on another player-facing runtime bead only when the shipping lane is flaky or classification-poor; keep recording `found more` / `found same` / `found less` so the pilot can be unwound if it stops paying off.
- Resume from the remaining open queue; the HoT actor-overlay follow-up is now closed.
- Reopen ORKA-bypu only if extended QA shows another combat->story/town->combat jump with live heroes still alive; the first diagnostic to capture is whether `Player_Energy` or live hero HP actually hit zero at the transition.
- Use `tools/prepare_hot_file_commit.sh <bd-id>` before the next hot-file commit attempt instead of hand-authoring `.beads/hot-file-lock/*.scope`.
- If a hot-file commit lane needs temporary queue alignment, prefer `tools/prepare_hot_file_commit.sh <bd-id> --align-active` and then apply the printed restore commands after commit.
- Compare the harness `require('playwright').chromium.launch(...)` path against the working Playwright MCP/browser launch path so the repo can recover hands-off testing inside the canonical `balance_harness` lane if the launch assumptions can be matched.
- Run the browser discovery lane only on qualifying player-facing runtime beads and record `found more` / `found same` / `found less` plus lightweight value signals before promoting any resulting QA pattern.
- Keep `npm run playwright:launch-matrix` as the canonical proof that the current direct-launch regression is broader than Playwright flags alone.
- Use the bounded `BALANCE_CDP_URL=http://127.0.0.1:9222 npm run balance-harness -- --sessions 1 --maxWaves 1` run only as a secondary runtime check after browser-ownership assumptions are clarified, not as proof that Playwright MCP itself is broken.
- Promote the focused turn-refresh Playwright scenario into a reusable repo-owned check if we want this exact dev-panel apply/refresh proof to run automatically instead of as a one-off artifact script.
- Commit governance cleanup separately from runtime/test work; do not mix the `idleFarmRuntime` bug-fix bundle into the coordination patch.
- Rewrite ORKA-6opp before assigning it again; the live bead lacks explicit acceptance/test detail for safe implementation.
- Keep `ORKA-n0g` queued as a future stub; its own bead comment says the basic shell already shipped and remaining work is later exclusive-slot behavior, not another scaffold pass.
- The remaining visible ready head is now mostly under-specified features, future stubs, epic parents, or governance/meta lanes rather than another clearly bounded runtime bug.
- Keep using live `bd` for queue decisions instead of `.beads/`.

## Known Issues
- `ORKA-39i0` is no longer just stale-open queue noise. A fresh runtime proof reproduced the remaining bug specifically on the red single-target initiative path: after `HERO_SINGLE` executes, Huun can become immediately actionable again with `TurnSerial` still `0`, while blue/yellow initiative actions advance correctly.
- `ORKA-6opp`, `ORKA-6n7`, and `ORKA-njg` should not sit at the ready head without rewrite work; they are currently queue-noisy rather than implementation-ready. `ORKA-6opp` was rechecked this cycle and remains underspecified.
- The shipping lane still depends on a brittle Chrome/AppKit startup seam in this environment. On ORKA-omdl, external Chrome CDP attach passed, but the canonical harness attempt produced no artifact before the same AppKit/HIServices crash boundary reappeared.
- The discovery lane currently adds value mainly because it can keep a persistent CDP-owned browser alive long enough to capture state and console evidence when the shipping lane cannot.
- Multi-pass QA now shows the core `storyMock -> town -> combat -> mapLayout -> combat` loop is stable in this environment, but bottom-nav click reliability outside `Map` is still under-classified and should not be assumed healthy.
- `ORKA-39i0` was briefly claimed for inspection and then restored to `open` during this governance pass; that correction is intentional and now backed by explicit anti-orphan policy.
- The hot-file hook remains intentionally strict, but the human bottleneck path is now tooling-owned; if enforcement complains after preparation, fix the batched error list or rerun `tools/prepare_hot_file_commit.sh <bd-id>` after staging changes.
- Playwright MCP browser control is working in this environment, so do not describe the current blocker as a generic Playwright or MCP outage.
- External Chrome + CDP attach is confirmed working on this machine/user context, so macOS Automation/Accessibility is not the blocker for the supported path.
- Any Codex-owned Chrome startup still aborts on macOS 26.3.1 in this environment, including plain child-process Chrome launch outside Playwright. Current evidence points at an OS/app-launch boundary (MachPort/Crashpad/HIServices registration), not a harness or Playwright-flag-only bug.
- Shell PATH still needs `export PATH="$HOME/.local/bin:$PATH"` before `bd` commands in automation turns.
- The canonical `balance_harness` now has fresh browser evidence for ORKA-wnjr through `BALANCE_CDP_URL` fallback, and there is now a separate focused Playwright artifact proving the dev-panel apply/refresh seam itself. The remaining limitation is browser ownership: direct Codex-owned Chrome launch still fails, so both proofs rely on the existing CDP fallback.
- The browser discovery lane is now documented as an optional pilot only. If it starts duplicating the shipping lane or adds more token/operator cost than signal, unwind it instead of normalizing a second browser authority.
## Completed Beads
- `ORKA-l0je` — party HP bar front fill now degrades continuously from green to yellow to red by HP ratio instead of staying a single color
- `ORKA-r6v5` — hero HoT now restores real HP instead of only moving the shared bar; small regen ticks survive redistribution onto live heroes
- `ORKA-9zlf` follow-up 2 — Kojonn HoT shimmer lines and diamonds now use the stronger opacity settings aligned with the tuned Faze particle readability
- `ORKA-apdf` follow-up 5 — Kojonn combat text now says `casts Faze` instead of `blight`, and the Faze dot/stroke opacity is another 20% stronger
- `ORKA-apdf` follow-up 4 — Faze DoT dots are 20% larger for clearer recognition without changing the unmasked particle path
- `ORKA-apdf` follow-up 3 — Faze DoT dots now hold higher opacity so the darker unmasked particles read more clearly at gameplay speed
- `ORKA-apdf` follow-up 2 — Faze DoT dots now use a darker purple fill with darker outline/glow so the unmasked particles read cleanly against enemy art
- `ORKA-apdf` follow-up — Faze keeps the masked purple enemy overlay, while the upward purple DoT dots now render unmasked above affected enemies
- `ORKA-9zlf` follow-up — hero HoT shimmer lines and diamonds now render unmasked above heroes instead of clipping to the sprite silhouette
- `ORKA-3u60` — enemy death fade lifecycle corrected and closed
- `ORKA-k21n` — Power Amp attacks now preserve crit `!!` presentation for queued and multi-hit amp paths
- `ORKA-mjri` — removed `+/-` number prefixes while preserving heal/damage color semantics
- `ORKA-n0p7` — Kojonn AOE presentation restored to `Faze`; blight remains the condition name
- `ORKA-rydb` — gold collect motion now uses continuous curved steering without scatter-to-wallet snapping
- `ORKA-lvep` — hero HP and heal presentation colors retuned to requested green palette

## Active Work
- `ORKA-39i0` — verify the hero-initiative infinite-turn regression is gone after tightening the app-side pick-restore guard

## Next Tasks
- QA `ORKA-39i0` on hero-initiative combat turns; if hero turns still loop, capture whether `DeferAdvance`, `CanPickGems`, and `ActionInProgress` are simultaneously live when control returns
- continue from remaining open presentation/runtime beads in queue

## Known Issues
- `ORKA-39i0` is not closed yet; the likely app-side leak is fixed, but it still needs runtime confirmation from initiative-heavy combat
