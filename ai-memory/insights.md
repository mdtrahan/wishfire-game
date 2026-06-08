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
- When render extraction moves visual helpers behind a dependency scope, verify app-to-renderer predicates are live state readers rather than false stubs; status overlays keyed by effect names should accept stable prefixes such as `Blight*`.
- When removing a hero-specific heal expression, route that hero through the shared heal body; do not replace the special branch with a guard that still consumes action pacing but skips `ApplyPartyHeal`.
- For normal gem matches, refill must start at the gem-destruction seam before deferred action/turn handoff can leave visible board holes. Batch-create all queued refill gems before waiting on settle animation.

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
- For Playwright on macOS from Codex, diagnose in this order: direct browser startup, external Chrome CDP endpoint health, then Codex `connectOverCDP()` control. `MachPortRendezvous` / Crashpad permission errors prove startup is blocked inside Codex; they do not by themselves prove Automation/Accessibility is required for the CDP attach path.
- If both Playwright-owned launch and plain Codex-owned Chrome child-process launch crash, stop tuning Playwright flags. That pattern means the direct-launch regression is broader than Playwright and should be treated as a Codex/macOS startup boundary until proven otherwise.
- Keep the browser layers separate in writeups and debugging:
  - `tools/balance_harness.js` is the repo-owned batch automation path.
  - Playwright MCP / Codex Playwright skill are interactive inspection tools.
  - Success in MCP does not prove the harness's `require('playwright').chromium.launch(...)` path is healthy, and failure in the harness launch path does not prove MCP is broken.
- When a browser tool works in one layer and fails in another, compare ownership first:
  - who launches Chrome
  - whether launch is direct or CDP attach
  - whether the failing path is a repo script or an external tool wrapper
  Do not collapse those into a generic “Playwright is broken” conclusion.

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
- **Random draw reachability rule**: gameplay card draws must sample from the full eligible pool, not the first entries in registry order. If QA or acceptance requires a later skill such as Crimson Ward to be playable, add a deterministic RNG contract proving that normal draw can reach it without forced hooks.

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
- When full combat and idle combat share the same visual language, parity-check both render seams directly instead of assuming one inherits the other. Hit-flash palette changes in `renderHitFlashOverlay(...)` do not automatically update idle combat, which still owns its own sprite-overlay filter path in `web-runner/app.js`.

## 2026-03-18 — Extra Turns Must Be Proven By Provenance And By Long-Run Rate
- Repeated turns are only trustworthy when the scheduler can point to explicit provenance. Fence off speed-only shortcuts and route every legal repeat through an explicit extra-slot insert seam.
- For chance-based repeat-turn skills, a single `200`-run sample is enough to prove moveability and “no speed-only grants,” but not enough to prove rate stability. Pair the short sample with a larger calibration run before calling the proc rate compliant.

## 2026-03-18 — Dev Tooling Must Write Conditions Without Moving Turn State
- Dev panel toggles should only write the selected condition. If a QA toggle is meant to stage a skill harness, apply/remove it directly in the owning runtime seam and keep combat refresh, actor reload, and turn advancement out of the apply path.
- Global dev-panel Restart is an exception: it must be a layout-agnostic hard runtime restart, not a combat refresh, modal close, or layout transition. Clear transient dev-tool session config and force a clean app boot before any active-layout-specific refresh logic can run.
- When dev idle/autoplay is supposed to be hands-off, selection-only steps must be auto-resolved inside the dev automation loop, not by weakening normal gameplay selection rules.
- Dev autoplay progress must be tied to authoritative state changes, not just dispatched click events. A no-op supergem click can otherwise reset stall detection forever while combat appears frozen.
- When automated combat reaches defeat or energy exhaustion, route it through the same combat-failure exit as normal runtime and clear any atomic combat gate first; otherwise the layout transition can be queued behind the frozen state it is trying to leave.
- Dev-tool loadout slots are a special case: hero/enemy slot edits are not “staged only.” They should trigger the sensible active-layout rebuild path, or QA will see valid duplicate slot config in the panel while runtime still shows the old roster and conclude the dev tool is broken.
- If a skill is presented as a “free second attack,” do not implement it with extra-turn scheduler semantics. The owner seam must duplicate the attack immediately, preserve the original gem spend, and retarget only if the original target is gone before the follow-up lands.
- If a presentation-heavy attack pattern makes another mechanic unreadable, move that pattern behind an explicit skill harness instead of leaving it in the default action seam.
- If a free follow-up attack is meant to read as a real second attack, do not pre-time the second damage packet during the first action. Gate the second strike from the first strike's visible completion signal, then start a fresh lunge and schedule the second hit from that new anchor.

## 2026-06-07 — Pending Supergem Target Rejections Need Full Handoff Recovery
- When a pending supergem target action rejects, clear the pending supergem action, pending skill/actor, selected target, and busy/defer ownership together. Falling back into normal `ExecuteSkill` from that rejected state can strand combat between target selection and refill.
- Dev one-color boards are harness state, not normal autoplay intent. When the board is forced to one color, autoplay may spend that forced color so scheduler recovery can be tested without waiting for a natural board.
- Per-actor proc latches for repeatable skill harnesses must reset at per-turn granularity, not only on encounter-wide scheduler resets. Otherwise a `100%` harness can appear correct once and then silently stop firing for the rest of combat.

## 2026-05-07 — Blue Gem Accounting Must Carry Count And Hero Ownership Together
- For blue gem / Astral Flow bugs, verify the full accounting chain instead of only the wallet write: selected-gem count must be passed into `ResolveGemAction(...)`, and the actor UID used for gem usage must resolve to a hero owner, not an enemy turn actor fallback.
- If combat log, Astral Flow wallet, and BLUE radiator totals all stay at zero together, treat that as an upstream resolution-input bug first, not three separate HUD defects.
- When converting a mechanic from extra-turn semantics to free-follow-up semantics, audit three seams separately: proc latch lifetime, target/retarget logic, and presentation pacing. Partial fixes can look correct in counters while still failing visually.

## 2026-05-11 — Proc QA Must Separate Activation From Execution
- For session proc skills, activation must not count as a proc check or payload execution unless the skill explicitly has an activation effect.
- Browser/AutoPlay side-panel evidence is the acceptance proof for proc behavior; internal helper tests can pass while live player actions never reach the combat-event hook.
- Proc debug counters should distinguish eligible `Checks`, successful `Procs`, failed `Misses`, and payload results such as `Heals`; locked, inactive, wrong-target, no-damage, and activation-only cases should not increment `Checks`.
- When a proc path is uncertain, instrument activation, combat-event hook, and roll-resolution seams with a stable console prefix before changing gameplay math.

## 2026-05-11 — Skill Beads Need Spec-First Contracts Before Runtime Edits
- For hero and party skills, require a clear definition of skill ID, owner, trigger, eligibility, roll, payload, counters, and Browser proof path before implementation starts.
- Test the activation, eligibility, roll, and payload seams before coding the runtime change; a helper-only test is not enough if the live combat event can miss the hook.
- Keep dev-panel controls as mutation surfaces and side-panel readouts as informational surfaces. Mixing those roles turns QA evidence into another gameplay side effect.

## 2026-05-07 — Layout Suppression Rules Need Preserved Ownership Metadata
- If a combat UI element is removed by layer/type rules, verify that the flattened runtime instances still carry `layerName` and `layerIndex` before changing draw filters. Suppression hooks against `BoardBG` or other layer owners silently fail when layout flattening strips that metadata.
- For legacy layout cleanup, debug in this order: identify the exact instance types and layer owners from the source layout, confirm those fields survive into the runtime `instances` list, then apply the narrow suppression rule at the owner seam. Do not assume a failed visual removal means the rule is wrong before checking whether the ownership metadata survived flattening.

## 2026-03-18 — Session Update Paths Must Rehydrate Stored Config Before Respawn
- If a layout session stores normalized config like forced hero/enemy names at creation time, the update/respawn path must read from that stored session field again before spawning new entities. Session creation alone is not enough once the update loop becomes the owner of later spawns.
- For presentation loops with delayed respawns, add a narrow contract that proves the stored normalized config survives into the respawn callsite. Otherwise a single missing local binding can hard-crash the layout only after entry, which slips past simple boot-time checks.

## 2026-03-18 — Separate Dead Server State From Source Rollback
- If a major restored feature seems to vanish all at once, verify the served `app.js` before assuming source rollback. A stale page or dead local listener can mimic a regression even when the owner file still contains the feature markers.
- Diagnostic order for local runtime confusion: check the live file on disk, check the asset actually served over `127.0.0.1`, then check whether anything is listening on the expected port. Do not kill the existing listener until you are ready to replace it with a persistent server process.

## 2026-03-19 — UI/Runtime Resource Keys Must Share One Owner Vocabulary
- If a player-facing layout is already rendering a resource as `Energy`, audit the runtime ledger and collect/apply helper names before adding more UI logic. Mixed keys like `unclaimedGold` in the helper and `unclaimedEnergy` in the layout create silent no-op collects that look like routing bugs instead of resource-owner bugs.
- For fail-state exits, keep the destination rule in one explicit branch instead of encoding layout selection inside an inline ternary. Recovery-routing requirements change faster than the surrounding gate conditions, and the inline route choice becomes an easy stale-policy seam.

## 2026-05-07 — Layout Suppression Rules Need Preserved Ownership Metadata
- If a combat UI element is removed by layer/type rules, verify that the flattened runtime instances still carry `layerName` and `layerIndex` before changing draw filters. Suppression hooks against `BoardBG` or other layer owners silently fail when layout flattening strips that metadata.
- For legacy layout cleanup, debug in this order: identify the exact instance types and layer owners from the source layout, confirm those fields survive into the runtime `instances` list, then apply the narrow suppression rule at the owner seam. Do not assume a failed visual removal means the rule is wrong before checking whether the ownership metadata survived flattening.

## 2026-03-19 — Keep Encounter Candidate Pools Separate From Initial Picks
- If later spawns are supposed to preserve biome/faction diversity, do not reuse the initial selected encounter picks as the long-lived pool. Store the full eligible candidate set separately, then let spawn planning choose from that broader pool.
- Diagnostic order for spawn-subset regressions: check the request filter first, then check what global/runtime field caches the eligible pool, then check whether respawn helpers are reading the cached pool or only the initial picks.

## 2026-03-19 — Gem Array Replacements Must Rebuild Board Occupancy Immediately
- If gameplay code replaces the gem array through `ctx.setGems(...)`, the app-owned occupancy grid must be rebuilt in the same seam. Refill, pickability, and board-integrity checks read grid occupancy, not just the gem list.
- Diagnostic order for board-playability regressions after enemy mutations: verify the gem array changed, then verify the occupancy grid was rebuilt from that array, then verify refill logic is scanning the rebuilt grid for zero-valued slots. A correct mutation plus a stale grid looks like refill logic is broken when the real fault is state synchronization.

## 2026-03-19 — Bead Creation And Bead Execution Must Stay Separate
- A user asking to create a bead is asking for queue management by default, not authorizing immediate implementation. Treat “make a bead” as “record this work item” unless they separately assign it or request execution now.
- Diagnostic order for lane confusion: check whether the user asked to create a bead, check whether they separately assigned that bead for work, then check whether the normal bead-selection loop chose it. Do not collapse those three acts into one.

## 2026-03-19 — Enemy Turns Need Their Own Idle-Recovery Gate
- If combat lands on an enemy turn with `TurnPhase === 2`, no active enemy action, and either leaked pickability or no deferred advance, recover in the enemy-turn seam itself. Hero-turn pickability restore and refill-complete logic are not sufficient to rescue enemy-idle stalls.
- Enemy-action aborts must clear both ownership and progression state together. Clearing `IsPlayerBusy` alone is not enough; also release `ActionInProgress` / `ActionActorUID` and schedule a deferred advance so the turn loop can move on deterministically.
- For harness-driven turn-stall bugs, validate in this order: deterministic gate contract first, then one attached-browser sample run, then a fresh-profile repeat run. That separates runtime deadlocks from brittle CDP/browser-session setup failures.

## 2026-03-20 — Option-Denying Enemy Board Attacks Must Persist Into The Player Turn
- If an enemy skill is supposed to cripple board choice, immediate refill is a design bug even when the board remains technically valid. A persistent partial board preserves pressure; an instant refill reduces the attack to a cosmetic reshuffle.
- Diagnostic order for enemy line-clear behavior bugs: verify the mutation changed the gem array, verify the grid shows the missing cells, then verify refill is still owned by the normal player-side board lifecycle instead of being kicked from the enemy-action completion seam.
- If the persistent holes are meant to survive until the player commits an action, store that as explicit runtime state. A simple pressure flag is safer than trying to infer intent from `hasEmptySlots()` alone, because normal refill holes and enemy-pressure holes need different turn-advance behavior.

## 2026-03-20 — Consumable Multipliers Should Queue Final Damage, Not Recompute It Later
- If an attack consumes a one-shot multiplier before its hit lands, queue the resolved final damage on the delayed hit packet. Recomputing from base damage later adds an avoidable drift seam between skill execution time and hit-application time.
- For delayed-hit regressions, contract both layers: the skill builder must store immutable `finalDmg`, and the app-side resolver must prefer queued final totals before falling back to multiplier recomputation.

## 2026-03-20 — Refreshing Combat Must Invalidate Paused Turn Snapshots
- Dev-panel apply/refresh is a session reseed, not a paused-turn resume. If the modal captured `CanPickGems` / `IsPlayerBusy` / `DeferAdvance` from the old combat session, that snapshot must be discarded before the fresh session becomes live.
- Treat combat turn transients as one owned bundle: gate flags, action ownership, pending skill selection, and enemy board-pressure state must reset together through a shared helper. Partial hand-written resets are how stale turn loops re-enter a clean session.
- Diagnostic order for refresh-only turn bugs: compare fresh normal combat first, then inspect the dev-tool pause snapshot session identity, then verify refresh applies the shared turn baseline instead of restoring old `DeferAdvance`, `PendingSkillID`, or `ActionOwnerUID`.

## 2026-05-08 — Dev Autoplay Color Priority Should Encode Real Preference Tiers Only
- If QA automation is supposed to sample several gem colors fairly, keep those colors in one shared priority tier instead of expressing a fake total order. Pushing one color to the bottom of the array silently biases long autoplay runs and makes balance checks look worse than the underlying runtime behavior.
- Diagnostic order for autoplay color-bias reports: verify any autoplay bypass or pick-before-triplet rules first, then inspect the triplet priority tiers, then confirm same-tier selection is the only place randomness is applied. Do not tune downstream balance numbers before checking whether the dev automation itself is skewing picks.

## 2026-05-10 — Gem Spawn Tweens Need Matching Timebases
- If a visual tween is stamped in game seconds, the renderer must evaluate it against game time, not `performance.now()`. A valid `bounceStart`/`bounceDur` pair will still look like a pop-in if render time is thousands of seconds ahead of the tween clock.
- Diagnostic order for gem pop-in regressions: verify new gems carry appearance metadata, verify the render scale reads the same clock as that metadata, then tune curve magnitude/duration only after the timebase is correct.

## 2026-05-11 — Enemy Target Bias Must Be Identity-Owned
- Default enemy target selection should be uniform over living heroes; never encode hero-specific aggro as a global enemy picker rule.
- Enemy target preferences belong on the enemy identity data (`targetPreference` / targeting policy fields) and should route through one shared deterministic rule helper before the action seam receives a target.
- Diagnostic order for targeting-bias reports: check whether the random picker is actually being called with the expected `(ctx, list)` shape, then check for hard-coded hero exceptions, then check identity policy data.

## 2026-05-11 — HoT Cadence Must Be Explicit
- If a status effect is turn-based, store an explicit `cadence: 'turn'` plus turn-serial gates on its queued payload. Reusing timer-tick fields for a turn-based effect makes later merges silently convert combat semantics back to wall-clock behavior.
- Diagnostic order for HoT/DoT recovery: verify the skill payload shape first, then verify the app-side cadence owner, then verify visual overlays. A correct shimmer can mask a wrong healing cadence.
- For DoT packages, also contract the first-hit resolver. The initial impact decides total tick count and queued cadence, so a correct queue helper can still ship the wrong behavior if the delayed-hit resolver keeps old timer-based defaults.
- Actor-turn DoTs must be owned by the afflicted actor's turn-start seam, not a frame loop or global turn watcher. Hero turns and other enemies' turns can advance global serials, but they must not spend another enemy's DoT counter.

## 2026-05-11 — Supergem Spend Must Reserve Match Pacing
- Supergem activation removes a larger footprint, but it is still a player match action. Do not start refill immediately if activation opened target selection, queued a pending supergem attack, or reserved a deferred action handoff.
- Diagnostic order for supergem interaction bugs: verify idle QA can actually click a supergem, then verify spend removes the footprint, then verify refill waits behind pending activation and hit timing instead of colliding with the match presentation.

## 2026-05-11 — Autoplay Must Clear Non-Combat Choice Modals
- Idle combat autoplay needs bypass handlers for modal choice screens that are not the behavior under test. If a modal such as skill draw can stay open without changing turn, energy, pending skill, or gem counts, the progress watchdog will eventually classify a healthy run as stalled.
- For random QA bypasses, select from the modal's live candidate list rather than hard-coding a card index. That keeps the harness moving while still sampling the temporary choice surface.

## 2026-05-11 — Canvas Pixel Overlays Must Re-anchor On Resize
- If a combat HUD overlay stores computed canvas-pixel bounds, browser resize must recompute those bounds after `layoutScale` and layout offsets change. Redrawing with stale pixel coordinates makes otherwise-correct combat log and story-card windows drift relative to the game field.
- Diagnostic order for resize drift: verify whether the overlay stores world coordinates or canvas pixels, then verify the resize handler refreshes the derived bounds, then inspect CSS/DOM reflow only after the canvas-owned placement is current.

## 2026-05-13 — Team-Turn Effects Need Team-Owned Counters
- If an effect duration is expressed in hero team turns, do not derive it from total combatant `TurnSerial` or full turn-queue length. Enemy turns and small-party encounters will skew the duration.
- Store an explicit hero-team-turn serial that advances only after the live hero side completes a pass, then anchor field expiry to that serial. The field can still remember hero-team size for QA/debug, but size is not the clock.

## 2026-05-14 — Strategy Turns Are Team Phases, Not Global Queues
- If combat is strategy-game-style, phase ownership must alternate by team regardless of team size. Do not let global speed sorting weave heroes and enemies together or let enemy count shrink/expand spill one side into the other side's phase.
- Speed sorting belongs only inside the active team phase. Battle start should initialize the first phase, not create enemy-first starts or extra priority turns.

## 2026-05-14 — Field Effects Must Own Their Own Visual And DoT Timers
- Slot/field effects should render from field-zone state, not from the current living unit in that slot. Unit death, entry, or direct status expiry must not pop the field visual unless the field's own timer expired.
- If a field and a direct status both express the same visible debuff, keep their queued DoT packages in separate ownership buckets. Reapplying direct Faze can reset direct Faze, and reapplying SG Faze can refresh SG-owned field blight, but neither path should silently delete or renew the other's timer.
- A multi-slot field application needs one shared expiry contract. DoT application to a unit standing in a field may use the field id for ownership cleanup, but it must not renew an individual puddle slot or the field will drift slot-by-slot.
- If a field visually represents an infection, units standing in that active field must show the infection visual even after that field's damage packet has spent its ticks. Damage cadence and visual occupation are separate contracts.
- When a field is the stronger expression of the same debuff, it owns the overlapping visual/status window. Direct same-debuff packets applied before or during the field should be absorbed for covered units, so they cannot reassert the unit visual after the field dissipates; a fresh direct application after the field is gone may start its own visual again.

## 2026-05-16 — Hero Signature Actions Need Identity Beyond Shared Skill Slots
- Shared slots like `HERO_AOE` are routing conveniences, not player-facing action identity. If a hero-specific action such as Kojonn's Faze rides the shared green path, keep an explicit action/profile marker on the queued packet so later presentation work cannot collapse it back into the common AOE expression.
- For hero-signature regressions, contract both the payload semantics and the expression identity: DoT packets can be correct while the lunge/profile/presentation marker is still generic.

## 2026-05-16 — Supergem Hero Identity Must Use The Runtime Current-Hero Seam
- If supergem activation receives both a spender actor and a current hero signal, hero-specific supergem effects should resolve from the runtime current-hero seam first, then fall back to the passed actor. The passed actor can be stale during board spend plumbing, while `CurrentHeroUID` is the hero-turn owner set by the combat turn seam.
- For hero-specific supergem regressions that fall back to generic resource collection, contract the mismatch case directly: non-Huun actor plus current Huun should still queue Huun's action packet, lunge, and combat log instead of only awarding gold.

## 2026-05-16 — Closed Beads Still Need Main-Line Presence Checks
- Before treating a closed gameplay bead as stable, verify its owner commit is reachable from current `main` and that its contract test exists in the active tree. A closed bead in an unmerged lane is not implemented behavior for the shipped runtime.
- For silent feature regressions after merge cleanup, compare Bead intent against current code first, then check commit ancestry. Missing state keys, renderer markers, and focused tests together usually mean the feature was never incorporated, not that a small branch condition drifted.

## 2026-05-16 — HUD Readout Popups Need Canvas Anchors
- If a floating number is supposed to appear over a HUD readout, anchor it to the rendered canvas coordinate for that readout. Reusing the text object's world coordinate can project to an unrelated stage position when the HUD layout overrides the draw position.
- Timing gates should wait on the popup's own text-animation completion signal. For resource-gain paths, max the action lock against `TextAnimEndAt` instead of replacing it with a fixed short delay after spawning the text.

## 2026-05-16 — Batched Visual Randomness Needs Per-Instance Decorrelation
- If several damage texts spawn from one action, randomize at the text-instance seam, not only at the action or packet seam. A repeated or deterministic RNG value can make a whole AoE read as one shared vector unless each spawned text also carries a sequence/salt into the variation picker.
- For visual-randomness QA, test both normal RNG and fixed-RNG runs. Fixed-RNG proof catches accidental batch coupling while normal runs catch distribution and readability issues.

## 2026-05-17 — Death Refills Must Be Scheduler Gates
- Treat enemy death resolution, required-slot refill, slot occupancy, and target validity as one roster-stability contract before any next action can be claimed.
- A side-turn boundary is too late for backup arrival if the prior turn killed an enemy. The completion seam that observes death must either finish refill or hold the scheduler behind an explicit refill-pending gate.
- For softlocks where a hero waits on a missing target or enemies act with absent allies, trace every death-producing path first, then verify the shared next-action gate rejects dead targets, empty required slots, duplicate slot occupants, and pending refill state.
- Roster-refill holds may preserve a visible attack selection, but an already-owned deferred action must clear stale pending target fields while keeping only the deferred advance ownership.
- Pending death entries are not yet refill work. The action-completion seam must commit pending enemy deaths into killed slots before asking the roster-stability gate to hold, or the gate blocks the only path that schedules backup.

## 2026-05-17 — Action Starts Must Claim The Handoff Gate Before Queuing Damage
- Damage packets, lunge presentation, and deferred turn ownership are one action contract. If the lunge/action gate refuses to start, the caller must not queue damage, consume a supergem, or reserve `DeferAdvance`.
- The scheduler must not re-enter while any action is in progress, even if the active action belongs to the current turn owner. Same-owner reentry is still reentry and can mutate target-selection state into an unplayable phase.
- For hero-action softlocks, inspect the meta-state first: `PendingSkillID`, `ActionInProgress`, `ActionActorUID`, `HeroAction`/`EnemyAction`, `ActionOwnerUID`, and `DeferAdvance` must describe the same owner and phase. Individual hero edge cases usually fall out of that broken symmetry.

## 2026-05-17 — Deferred Handoffs Must Survive Blocking Gates
- A deferred turn-advance token is not spent until `AdvanceTurn()` has actually moved the scheduler or intentionally finished the handoff. If a refill/death gate keeps the same owner and phase, preserve the owned defer so the handoff can resume after the gate clears.
- Refill-complete gates may release visual/busy state, but they must not restore player input while `TurnPhase` is still resolving. `CanPickGems` is an idle hero-phase privilege, not a generic "no animation is running" flag.
- Actor identity for special actions must come from the scheduler owner at the action seam. Stale convenience fields like `CurrentHeroUID` can assist display or fallback routing, but they must not be allowed to claim an action for a non-current actor.

## 2026-05-17 — QA Autoplay Must Not Spend Resource Turns As Combat Turns
- When investigating turn-order failures through dev autoplay, separate scheduler ownership from the action chosen by the harness. A valid resource-only hero turn can look like a skipped hero if it has no console-visible combat line.
- Combat QA autoplay should not spend non-combat resource-only picks while enemies are alive unless the tested hero turns that resource into combat pressure.

## 2026-05-26 — Presentation Lanes Need One Shared Barrier
- Refill, gem merge/collection, yellow conversion, floating text, hero/enemy action, action locks, and pending hit packets are one presentation barrier. Turn advance, refill start, action claim, and input restore should ask that barrier instead of racing local boolean checks.
- If a visual overlap bug looks like a refill issue, first check whether the refill path can start while another presentation lane is active. The fix should serialize the existing lanes, not create a second scheduler.

## 2026-05-26 — Pending Target Resolution Is Not A New Action Claim
- A red/green target picker created by the current gem match must resolve before refill, even when the match already left empty board slots. `refill-pending` blocks new action claims, turn advance, input restore, and refill completion; it must not block the already-pending target button that will finish the current action.
- For target-selection regressions, validate both normal match and pending supergem action shapes. `PendingSkillID` plus `TurnPhase === 1` or `PendingSuperGemAction` should be allowed through only when no real presentation lane is active and `DeferAdvance` is clear.

## 2026-05-31 — Supergem And Skill-Card Effects Must Stay In Separate Seams
- Supergem activations and skill-card selections are separate trigger seams. If a supergem path directly grants a skill-owned effect, regressions will silently re-couple unrelated systems.
- For supergem/skill crossovers, contract both negative and positive paths: assert the supergem does **not** open/select skills or grant the skill effect, and assert the same effect still appears through skill-card selection.

## 2026-05-31 — Hero Match Routes Must Not Own Skill-Card Identity
- If a named ability is moved into skill-card draw, remove that identity from gem-match logs, profiles, and direct payload branches. A generic match that still says the old ability name will be indistinguishable from a live skill trigger in QA.
- For ability separation bugs, test both sides of the boundary: the old match route must stay generic, and the new card route must own the renamed payload and presentation state.

## 2026-06-04 — Party Draw Cleanup Must Audit Every Unimplemented Party Stub
- When removing party skill stubs from skill-card draw, audit the full `PARTY_SKILL_DEFINITIONS` list for `payloadImplemented: false`, not only the originally reported slot numbers.
- Keep canonical definitions intact for planning/reference, but contract both normal random draws and forced QA draws so unimplemented party cards cannot leak into the playable draw modal.

## 2026-06-06 — Debug Counters Must Live At The Measured Event Seam
- If a QA counter is meant to track card appearances, increment it when the draw candidate list is created, not when the player selects or applies a card. A downstream application seam will undercount visible choices and make unsupported card appearances look lower than what QA can see.
- For pause-to-inspect debug surfaces, opening the panel must freeze gameplay through the same turn-gate pause owner as the primary dev panel, or the act of reading the panel can pollute the state being measured.

## 2026-06-07 — Layout Navigation Must Not Borrow Combat Input Gates
- Top-level layout navigation such as Map and Vault must stay reachable when gem-pick gates, selected gems, or selection locks are active. Those gates own combat board actions, not escape or inspection routes.
- For nav click regressions, validate both the exact text hit zones and the fallback nav band under a polluted combat state so selected-gem state and scaled canvas coordinates do not hide the real gate.

## 2026-06-07 — Dev Board Overrides Must Reset Board-Owned State
- A Dev Panel board-color override is a QA board reset, not only a visual recolor. It must clear selected gems, supergem overlays/cell maps, pending supergem actions, merge effects, and board-fill flags before handing control back to autoplay.
- If autoplay freezes after a forced board color, inspect whether the visible board and board-owned runtime state diverged. A visually recolored board can still be logically old if supergem or selection state survived the override.

## 2026-06-02 — Skill Draw Modals Need A Checkpoint Gate
- Skill draw eligibility may be discovered during a hero action, but the modal should spawn only at a hero-turn checkpoint after merge, refill, action locks, pending hits, and target selection are clear.
- Treat an open skill draw as a presentation barrier lane. It should block refill, enemy action claims, deferred turn advance, and input restore until selection closes the modal.
- Treat a pending skill draw as a handoff barrier, not a presentation lane. It must block refill and turn advance while still allowing the checkpoint claim once presentation lanes are clear.

## 2026-06-02 — Modal Handoffs Must Not Borrow Read-Time Locks
- Combat message read time and action-lock time are separate contracts. If a modal claim gate waits on `ActionLockUntil`, do not extend that lock only to keep a combat line readable; pin the text through its own presentation state.
- For meter-threshold modal bugs, check the queued flag, the action lock, and the checkpoint claim gate together. A full meter with `SkillDraughtPendingOpen=1` can still look broken if the claim is hidden behind a decorative read-time lock.
- Hero turn type is `0`; never default `GetCurrentType()` with `||` in hero-only gates. Use nullish fallback so a valid hero turn does not become `-1` and strand pending Astral Flow modals.
- Skill-card draw trigger ownership is blue-only: regular blue opens draw only through full Astral Flow, and blue supergem opens draw directly. Green/red/yellow/purple paths must not call `QueueSkillDraughtForHero`, even when they relate to implemented skills such as Faze.

## 2026-06-08 — Frame-Zero Board Color Retirement Must Not Touch Heal
- Retiring frame `0` green is not a reason to remove frame `4` heal. Keep heal in forced board options, spawn palettes, visual preload lists, and supergem detection unless a separate heal-removal bead explicitly says otherwise.
- Supergem spends may defer turn/action presentation, but the board refill lane must be claimed in the same call that clears gem cells. A deferred action handoff must not leave frame-zero empty board slots without refill ownership.
