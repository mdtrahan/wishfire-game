# Insights (Canonical, Minimal)

## Purpose
- This is the only active insights log.
- Capture only decisions that change future behavior.
- Do not log routine execution history, file lists, or status chatter.

## Operating Constraints
- Beads are the sole work authorization channel.
- Use one lane at a time; mirror deterministic rule edits in both runtime mirrors when required.
- When a problem appears, check this file for prior fixes before expanding scope.

## Product Model (Current)
- ORKA progression is mobile-casual leaning: power should come from skills, trait passives, and booster/meta systems.
- Avoid reintroducing classic RPG-style timed character buff/debuff stacks unless explicitly approved in bead acceptance.
- Blue gem flow is wallet/progression oriented (Astral Flow), not direct party-stat buff application.
- Progression-family scaffolds (tomes/relics/vault/chests/etc.) should ship as deterministic layout/state shells first, with map-locale entry mappings where menu pointers are intentionally absent.

## Bead Triage Guidance
- Prefer: skill/passive/trait behavior beads (`ORKA-6gt`, `ORKA-2sa`, `ORKA-mo4`, `ORKA-hvj`).
- Reframe before implementation when acceptance language implies persistent timed stat stacks (`ORKA-9ri`, `ORKA-zih`, residual wording in `ORKA-69r`).

## Regression Triggers
- Before starting combat-system beads, scan acceptance + code for: `buff`, `debuff`, `duration`, `turns`, `stack`.
- If these imply outdated model assumptions, pause and rewrite bead scope before coding.

## 2026-03-07 Regression Note
- Hero selector render gate must treat hero-turn as `TurnPhase === 0` (not `1`) in web-runner runtime.
- Core runtime modules under `web-runner/src/core/` must be treated as required deployment artifacts; missing files there can silently regress previously fixed UI/turn behavior.
- For web-runner startup regressions, verify module parity first (`heroSelectorRules`, `initiativeGuards`, `combatRuntimeGateway` lifecycle API) before broader combat debugging.
- Yellow-match completion can regress from merge-target helper scope errors; keep target lookup dependency-free inside `handleGemMatch` (do not rely on out-of-scope locals like `instances`/`assetsLayout`).
- When diagnosing yellow stalls, run multi-pass checks through `__codexGame.forceMatch(3)` and confirm `BoardFillActive` returns to `0` within settle window.
- 2026-03-08: Gem matches are not a buff source. Any buff-like systems must be implemented as separate booster mechanics (free/paid), decoupled from gem-color match lifecycle.

## 2026-03-08 Figma Parity (Hero Layout)
- For `heroLayout` visual QA, use Figma node coordinates as source of truth and render placeholders exactly (`NUM`, `Skill Title`, `Skill Title Lv.2`) until behavior beads replace them.
- Keep icon assets wired to MCP-exported Figma URLs for arrows, plus/minus, and close oval when parity is the goal.
- Use Playwright screenshots for side-by-side parity checks; fix drift with coordinate-level updates (not subjective spacing tweaks).
- During parity checks, force background to pure white (`#ffffff`) to isolate color mismatches before reintroducing any tint.
- Figma instance transforms on nav icons (e.g., `rotate-90`, mirrored variants) must be replicated in canvas draw transforms; drawing raw source PNG orientation causes obvious parity drift.
- Hero nav arrows: treat Figma slot geometry (`24x38`) as canonical and enforce inward direction by draw-path when remote arrow assets are unreliable.
- Minus control icon in Hero skills uses vertical mirror (`scaleY=-1`) semantics from Figma, not 180-degree rotation.
- Hero-screen Figma parity lesson: validate nav arrow direction against frame screenshot, not naming assumptions ('back/next' can be visually opposite to expected UX convention).
- When doing visual parity, complete full top-to-bottom audit in one pass before declaring done; partial fixes create false confidence.
- Playwright launch failure pattern (`Opening in existing browser session`) is usually stale `playwright-mcp` + `mcp-chrome` processes. Kill stale processes first; if MCP transport dies, use CLI Playwright (`npx playwright screenshot ...`) as QA fallback until MCP restarts.
- Initiative regression guard: sanitize time-mode turn queues before commit so duplicate non-extra hero slots cannot accumulate from queue reconciliation drift.
- Preserve extra turns only when provenance is explicit mechanic; otherwise drop extra repeats during reconciliation.

## 2026-03-08 — ORKA-spt multipass QA note
- For skill-point consumption multipass checks, reset `HeroSkillProgressByHeroId` per session/pass (or reload page) before asserting spend deltas.
- Without progress-state reset, later passes can show all `max_rank_reached` rejects with no spend despite point reseed at 300, which is a test artifact (not overdraft behavior).

## 2026-03-08 — Startup and bar rendering reliability
- Startup load stalls were amplified by serial `await loadImage(...)` chains; switching to parallel `Promise.all` for core visuals and staged critical/deferred sprite loads improves first-ready behavior without changing gameplay paths.
- Enemy gradient HP bars become visibly distorted when drawn with fractional sizes/positions and smoothing enabled; fix by integer snapping draw rects and disabling image smoothing only around bar draws.

## 2026-03-08 — Layout 0 loading UX strategy
- Keep a dedicated pre-bootstrap draw path (`drawStartupLoadingFrame`) so canvas never appears blank while assets initialize.
- Progress should advance by deterministic stage weights (layout/object/enemy/critical/core/finalize) and explicitly resolve to 100% at runtime-ready transition.

## 2026-03-08 — Vault Close-Control Regression Guard
- Helper functions declared before runtime asset variables must not capture later block-scoped symbols directly; pass assets as explicit parameters (`drawHeroStyleCloseControl(..., closeOvalImage, ...)`) to avoid `ReferenceError` in non-hero layout draw paths.
- When reusing Hero UI primitives across other layouts, update both draw path and hit-zone routing together; visual parity without input wiring causes partial regressions.

## 2026-03-09 — Reusable Heuristics For Similar Bugs
- **State-preserving UI exits**: treat layout close actions as state-preserving by default. Any close handler that mutates session-seeding, encounter selection, or board init flags should require explicit bead acceptance.
- **Randomness diagnosis order**: when “random feels stuck,” test in this order:
  1. seed variability
  2. selector scoring/tie-break behavior
  3. pool constraints (roles/locale/faction)
  Do not stop after seed checks.
- **Policy enforcement seam**: enforce combat behavior contracts at the seam that actually dispatches actions (`PickEnemySkill` / runtime selector), then optionally mirror in helper/resolver layers.
- **HP-threshold contracts**: for threshold-gated behaviors (e.g., heal below 50%), add explicit positive and negative gates:
  - required path below threshold
  - forbidden path above threshold
  This prevents “still damaged” logic from leaking through.
- **AOE heal readability rule**: if players must quickly perceive threat under fast pacing, prefer equal per-target heal application over split pools unless split behavior is explicitly part of design.
- **Outcome-table tuning workflow**: for event-style randomness (purple amp), keep probabilities in one visible table and tune only weights first; avoid adding pity/extra systems until weight tuning is proven insufficient.
- **Mirror discipline rule**: deterministic combat rules must be edited in both runtime mirrors (`web-runner/modules/functionBank.js` and `Scripts/functionBank.js`) in the same patch cycle.

## 2026-03-09 — Encounter Slotting Seam
- **Initial vs refill seam**: center-slot strongest logic belongs at package-to-slot assignment seams, not inside per-slot respawn picker logic.
- **Wave-clear repick guard**: when converting full-wave KO into packaged repick, add a pending gate (`WaveRepickPending`) and occupied-slot checks to prevent duplicate spawns from concurrent kill timers.
- **Flavor-preserving randomness**: keep side-slot assignment true-random while making center deterministic; this keeps readability without making battles feel scripted.

## 2026-03-09 — Frame-6 Reward Determinism
- If QA contract says a special gem should move a specific resource, avoid dual-reward random branching in the click handler (`gold|energy`) unless that randomness is explicitly in acceptance.
- Reward determinism for special gems should be enforced at the immediate interaction seam (`handleSpecialGem*`) and protected by a dedicated contract test, so yellow-flow tuning cannot accidentally reintroduce resource ambiguity.

## 2026-03-09 — Animation-to-Value Synchronization
- For resource fly-up effects, do not mutate HUD totals at sequence start; apply the total at animation completion (`t>=1`) so causality matches player perception.
- Keep a completion fallback for no-animation branches, but preserve the same semantic moment (sequence completion) to avoid mixed feedback contracts.

## 2026-03-09 — Yellow Turn-Handoff Regression Guard
- For yellow action flows, lock handoff semantics in tests at two seams:
  - policy seam (`createYellowSequenceCompletion`) for `handoffPending` vs `canRestorePickability`
  - runtime seam (`tick` deferred-advance block) for resolve-then-single-advance ordering
- This prevents reintroducing “extra turn” regressions when animation or gating code is tuned.

## 2026-03-09 — Beads CLI Environment Check
- If `bd` is reported as missing, verify `~/.local/bin/bd` before treating it as an installation failure; this shell can omit `~/.local/bin` from `PATH` even when Beads is installed.
- When shell `PATH` is suspect, repair it first (`export PATH="$HOME/.local/bin:$PATH"`) and re-run `bd ready`/`bd show` before falling back to direct `.beads/` edits.
- If `bd` state and `.beads/` file state disagree, treat live `bd` output as the workflow source of truth for active issue selection, then reconcile stale repo tracking separately.

## 2026-03-09 — Combat Power Offense Selection
- Combat power helpers must choose offense from role intent, not ATK by default: `attackType === 'magic'` uses `MAG`, `attackType === 'melee'` uses `ATK`, and unknown/no-type callers should fall back to `max(ATK, MAG)`.
- When a derived stat is mirrored across runtime surfaces, lock the same helper signature and formula in both the app bootstrap path and the mirror modules so support/magic units do not drift between preview and spawned-runtime values.

## 2026-03-09 — Playwright Harness Environment Triage
- For Node-driven Playwright harness beads, validate browser launch with the exact known executable path first before debugging harness logic. If `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` still aborts, the problem is the execution environment, not the harness flow.
- A failure pattern of `Target page, context or browser has been closed`, `SIGABRT`, `bootstrap_check_in`, or Crashpad permission errors means the browser subprocess is dying before page control. Do not keep “fixing” gameplay automation code against that symptom.
- When end-to-end Node Playwright is blocked, still prove the runtime seam separately: confirm the local page loads, `window.render_game_to_text` exists, and the canvas/input surface is present through the browser tool or MCP path.
- If harness contracts pass and the browser subprocess dies at launch, first try `connectOverCDP()` against an already-running Chrome with a debug port before declaring the lane blocked. CDP attach can recover browser automation without changing game code.
- If CDP attach is the recovery path, treat browser ownership explicitly: the harness may close the attached Chrome when it is the automation-owned instance.
- For this combat runtime, “actionable hero turn” is not just `canPickGems=true`. Red/green gem flows can open a pending attack UI that must be finished by clicking an enemy and then the centered attack button, and defeated enemies can remain in state at `hp=0` instead of disappearing from the array.
- For balance harness input gating, require a true idle hero state before tapping gems: `canPickGems && !isPlayerBusy && turnPhase === 0 && no pending skill`. `canPickGems` alone is not safe enough under fast automation.
- If a session freezes with `pendingSkillId` set, inspect `SelectedEnemyUID`, `PendingHeroHits`, and hero move state before changing tap logic. A stuck `pendingSkillId` with `SelectedEnemyUID=0` means the harness must keep retrying the target-selection seam, not keep clicking gems.
- Do not treat `livingEnemies === 0` as an immediate session-ready state. In this runtime it can mean “wave between spawns,” so the harness should wait through repopulation windows before deciding the field is actionable or exhausted.
- If bounded harness runs succeed but the live battlefield grows past the configured enemies-per-wave, stop short of making CP balance claims. That indicates a game-side spawn/respawn distortion, not a harness-only issue.
- If no attach path exists and the browser still cannot launch, leave the bead `BLOCKED` and record the environment blocker explicitly. Do not mark the bead done and do not rewrite game code to compensate for sandboxed browser failures.

## 2026-03-10 — Combat Control And QA Timing Model
- For combat QA and browser automation, treat player control as a state contract, not a visual guess. The game is safely actionable only when `CanPickGems=1`, `IsPlayerBusy=0`, `TurnPhase=0`, and `PendingSkillID` is empty.
- Do not classify `livingEnemies === 0` as an immediate failure. In this runtime it can be a valid repopulation window between waves or slot refill events.
- Refill completion and action completion are different seams. A finished refill should not restore pickability on enemy turns, and an ended lunge is not the same thing as a completed turn handoff.
- Use actual sequence timings when judging stalls: hero/enemy lunge motion is about `0.88s`, enemy post-action lock is about `0.35s`, and combat text can hold handoff for about `1.33s`. Declaring a bug earlier than those combined windows creates false positives.
- For Playwright/player-like automation, the correct loop is: wait for true idle hero state, tap one 3-gem set, resolve any follow-up target/confirm action, then wait through text/refill/deferred advance before sending more gem input.

## 2026-03-10 — Mirror Parity Fences For Hot Runtime Files
- When a deterministic combat rule must remain mirrored across `Scripts/` and `web-runner/modules/`, do not rely on broad file diffs to judge safety. Fence parity with a curated contract that compares normalized source for only the high-risk functions that actually drive runtime behavior.
- For mirrored telemetry/state-lifecycle seams, parity includes side effects and trace fields, not just gameplay math. If one runtime logs activation/consume/clear state with extra lifecycle metadata, the other mirror must match or debugging will diverge by environment.
- If whole-file drift is already large, reduce risk by synchronizing one meaningful seam first and then freezing it with a deterministic contract; this is safer than forcing immediate total-file identity in a dirty worktree.

## 2026-03-10 — Entity Failure Quarantine
- For always-on update loops, swallowing entity exceptions and continuing silently is worse than a bounded quarantine. Keep the loop alive, but fence the specific failing entity after a small consecutive-failure threshold.
- Attribute entity failures with a stable key before logging or quarantining. Prefer `uid` when present; otherwise derive a repeatable fallback key from kind/name/index so later diagnostics can identify the same bad instance.
- Consecutive-failure counters should reset on a successful update. This prevents one transient exception from poisoning an entity forever and makes quarantine mean “repeatedly broken,” not “ever failed once.”

## 2026-03-11 — Global Dev Tooling Modal Strategy
- For all-layout developer controls, prefer a DOM overlay with one global hotkey over canvas-drawn debug panels. It survives layout transitions cleanly, is easier to keep testable, and avoids contaminating gameplay render order.
- In first-pass tooling shells, separate knobs into two classes: live-safe controls (gold, board recolor, speed multipliers) and staged controls (future encounter/party/reward settings). That keeps the tool immediately useful without forcing risky rewires across unrelated systems.
- Expose tooling state through the same runtime debug surface used by automation (`render_game_to_text` / `window.__codexGame`) so future QA and harness beads can introspect the modal configuration without depending on DOM selectors alone.
- If a tooling control is staged rather than immediately live, give it an explicit reseed/refresh path in the same UI. A control that changes config but does not visibly affect the current session reads as broken to QA even when the state write is technically correct.

## 2026-03-13 — Idle Reward Claim Ownership
- When an idle/AFK reward ledger clears into shared resources, route the wallet credit through one helper seam instead of mutating `goldTotal` and `TokenWallet` ad hoc at the click site. That keeps the credit path testable and prevents the ledger from zeroing out while downstream state appears unchanged.
- Clone the token wallet object on claim and leave an explicit `IdleFarmLastCollect` trace in globals. Fresh object identity plus a visible claim summary makes wallet/debug surfaces much less likely to look stale after a successful collect.

## 2026-03-13 — Dev Speed Must Not Hydrate Main Combat By Default
- Persisted dev-tool configuration is not the same thing as active runtime intent. For speed controls especially, do not hydrate live combat from stored dev config on boot; default the runtime back to `1x` and require an explicit apply action to opt into altered speed.
- If a dev-only multiplier touches the main frame/update loop, fence it with a contract that proves boot-time combat stays baseline while the explicit apply path still exists. Otherwise stale QA settings can masquerade as core combat regressions.

## 2026-03-13 — Idle Theater Entry Must Use Restart Semantics
- If a layout is meant to present a deterministic staged scene on every entry, do not boot it through an `ensure...` seam. `ensure` preserves cached session state, which is correct for persistence but wrong for theater-style entry UX.
- For idle/theater layouts that should restart visually while keeping separate reward persistence, make layout `onEnter` call the same restart seam as the explicit restart button. Keep the reward ledger outside that restart state so presentation resets do not wipe earnings.

## 2026-03-13 — Idle Emissions Must Be Ledger-Owned, Not Theater-Owned
- For AFK/idle features, split the system into two authorities: a background emission ledger and a foreground theater session. The theater should be disposable presentation; the ledger should be the only owner of reward accrual.
- `Collect` should cash out the current unclaimed ledger and restart cadence immediately from the collection timestamp. It should not be forced to restart or preserve the visible battle scene in order to keep rewards flowing.
- When a feature must accrue while the player is away, drive it from timestamps and cadence state, not from per-frame scene updates. Layout presence should only affect what is rendered, not whether the rewards continue to exist.

## 2026-03-13 — Hot-File Commit Recovery Path
- When a runtime checkpoint spans hot files and non-hot files, do not force a single “savepoint” commit. First split out a compliant non-hot runtime/modules/tests commit so Git history advances without violating the hook.
- A hot-file scope declaration only helps when the changed lines live inside named function ranges. If `web-runner/app.js` includes top-level imports, constants, or game-state object edits, the hot-file hook will still reject the commit even with a scope file present.
- For this repo, the practical recovery order is: push governance/tooling first, then commit standalone runtime modules and deterministic contracts, then tackle hot-file integration in a separate bead with explicit function ownership.

## 2026-03-14 — Hot-File Hook Performance Must Scale With Changed Lines, Not File Size
- A policy hook that re-scans every changed line against every function range in bash becomes operationally broken on large hot files. If the check takes tens of minutes, users will restart it, assume it is stuck, and lose trust in the workflow.
- For hot-file validation, derive the small authoritative set first: staged changed lines plus declared functions. Then validate in a single pass over sorted function ranges. The runtime should scale with the size of the diff, not with repeated nested shell loops over the whole file.
- If the hook is slow enough that a user has to babysit the terminal, treat that as a tooling bug, not user impatience. Fix the tool before asking for more manual retries.

## 2026-03-17 — Runtime Recovery Must Start With Surviving Owner Seams
- When a gameplay surface appears rolled back, inventory the live source before attempting recovery. Reports and bead notes can prove prior intent, but the current runtime owner file still decides what ships.
- If a missing feature left behind surviving support seams or debug surfaces, restore the smallest shell on top of those seams first. A visible shell plus deterministic contract is safer than trying to recreate the entire lost feature stack in one pass.

## 2026-03-17 — Tone-Aware Hit Flashes Need An Explicit Hand-Off
- If the renderer supports colored hit flashes, the damage owner seam must write a structured flash entry, not a bare timestamp. A plain `until` number silently collapses all specialized tones back to the default even when callers correctly arm `NextHitFlashTone`.
- For transient combat FX, treat the hand-off as a three-link chain and test all three: caller arms the tone, damage application persists `{ until, tone }`, renderer reads the tone-aware entry. Verifying only one end of that chain is not enough.

## 2026-03-17 — App-Side Queues Must Match Function-Bank Exports
- If `app.js` stages a delayed combat effect through `callFunctionWithContext(...)`, the owning helper must exist in both mirrored function-bank files. A live caller plus a missing export creates silent feature loss that can survive static UI smoke checks.
- For hero-specialized AOE paths, contract the specialization itself, not just the shared function name. Kojonn green needed an explicit contract for `effectType: 'dot_apply'`, blight queueing, and non-generic log text; otherwise it drifted back to the generic burst lane without syntax errors.

## 2026-03-17 — Guard Contracts Must Cover Skill Identity, Not Just Fallbacks
- A blocker/fallback contract is not sufficient if the underlying special skill can silently drift back to an older implementation. The Djinn/Marid board guard stayed green while the actual mutation seam reverted from `Scathe` / `Sweep` to the older diagonal `X Out`.
- For enemy board-mutation lanes, contract both halves: the guard decision (`only on full board, else fallback`) and the concrete mutation identity (`column` vs `row`, plus log/skill names). Otherwise the tests can certify the wrong skill.

## 2026-03-17 — Recovery Work Must Be Saved As Soon As The User Confirms Runtime Parity
- When rollback recovery spans several gameplay seams, checkpoint the accepted restores immediately after QA passes. Do not leave multiple recovered lanes floating only in the dirty worktree while investigating the next regression.
- During recovery, trust present source plus focused contracts over branch labels or external app sessions. A repo can be on the right branch and still be missing the required runtime lanes in the owner file.
