# Development Reports

## Template
- bead id:
- summary of changes:
- files modified:
- test evidence:
- scope confirmation:

## Reports
- (append newest report at top)
- bead id: ORKA-h9q
- summary of changes: Added a mirrored hero leveling system with a deterministic Lv1-99 XP curve, per-hero XP state, kill-based XP awards wired into the enemy-death / AwardMonsterDrop seam, and a validation simulation for pacing bands.
- files modified: `Scripts/functionBank.js`; `web-runner/modules/functionBank.js`; `tests/heroLevelingContract.test.js`; `.beads/blocked/ORKA-h9q.md`
- test evidence:
  - `node --test tests/heroLevelingContract.test.js tests/huunExecutionDropBonusContract.test.js` -> 7 passed, 0 failed
- discovery lane comparison: not used on this bead
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (deterministic progression helper + kill-award seam)
- scope confirmation: Confined to mirrored combat/progression runtime helpers and a focused validation test. No UI or governance files were changed for this bead.

- bead id: ORKA-dm2
- summary of changes: Fixed the shared GSAP shim so combat damage text can stay mounted long enough to render and enemy HP bars interpolate instead of snapping. The shim now interpolates numeric state over time, and the damage-number / enemy-bar callers use that behavior unchanged.
- files modified: `web-runner/src/core/gsapShim.mjs`; `tests/animationShimBehavior.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`
- test evidence:
  - `node --test tests/animationShimBehavior.test.js tests/damageNumberTimelineContract.test.js tests/damageTextPaletteContract.test.js tests/hpBarAnimationContract.test.js` -> 16 passed, 0 failed
  - `node --check web-runner/src/core/gsapShim.mjs && node --check tests/animationShimBehavior.test.js` -> pass
- discovery lane comparison: not used on this bead
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (shared interpolation shim behavior test)
- scope confirmation: Confined to the shared animation shim and its behavior coverage. No combat formulas, enemy AI, or UI layout changes were made.

- bead id: ORKA-4dpd
- summary of changes: Restored the browser runtime path after the migration cleanup removed the repo-local runtime dependency tree. Added a tracked GSAP compatibility shim in `web-runner/src/core/gsapShim.mjs` and repointed the animation helpers to it so the browser modules can import animation helpers again without relying on a wiped `node_modules` tree. This fixes the blank/loading startup failure by allowing the app module to load and draw.
- files modified: `web-runner/src/core/gsapShim.mjs`; `web-runner/src/core/damageNumberAnimation.mjs`; `web-runner/src/core/healBloomAnimation.mjs`; `web-runner/src/core/goldCollectAnimation.mjs`; `web-runner/src/core/hpBarAnimation.mjs`; `tests/damageNumberTimelineContract.test.js`; `tests/hpBarAnimationContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`
- test evidence:
  - `node --input-type=module -e "import('./web-runner/src/core/damageNumberAnimation.mjs')..."` (pass)
  - `node --input-type=module -e "Promise.all([import('./web-runner/src/core/damageNumberAnimation.mjs'), import('./web-runner/src/core/healBloomAnimation.mjs'), import('./web-runner/src/core/goldCollectAnimation.mjs'), import('./web-runner/src/core/hpBarAnimation.mjs')])..."` (pass)
  - `curl -I http://127.0.0.1:8011/web-runner/index.html` and `curl -I http://127.0.0.1:8011/node_modules/gsap/index.js` (both 200)
- discovery lane comparison: not used; this was a startup-path restoration rather than a gameplay-behavior search.
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (runtime dependency preservation heuristic)
- scope confirmation: Confined to runtime dependency restoration for browser startup. No gameplay rules or balance logic changed.

- bead id: ORKA-9tny
- summary of changes: Added a minimal browser QA battery centered on `agent-browser` CLI. The battery checks CLI reachability, then optionally boots the game against a direct or CDP-attached browser, probes `window.render_game_to_text`, and writes snapshot/screenshot/console/error artifacts under `output/playwright/browser-battery/`. Also documented the battery in governance and tools guidance.
- files modified: `tests/browserBattery.spec.js`; `governance/qa/browser-battery-minimal.md`; `tools/README.md`; `package.json`; `ai-memory/insights.md`
- test evidence:
  - `node --test tests/browserBattery.spec.js` (help smoke pass, heavy browser probe skipped unless `BROWSER_BATTERY_E2E=1`)
  - `npm run browser:battery` (pass in sandbox skip mode with clear CDP/direct-launch guidance)
- discovery lane comparison: not used; this bead is about establishing a repeatable browser diagnostic baseline, not a gameplay interaction.
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (minimal browser battery + artifact layout)
- scope confirmation: Confined to browser QA tooling, docs, and the battery entrypoint. No gameplay/runtime behavior changed.

- bead id: ORKA-macy
- summary of changes: Fixed the web-runner blue-gem resolution path so `ResolveGemAction` receives the consumed gem count, matching the red/green/yellow call shape. Also tightened the balance harness blue tally read to prefer `heroGemUsage.party.BLUE` and fall back to `astralFlowWallet` when the party tally is absent.
- files modified: `web-runner/app.js`; `tools/balance_harness.js`; `ai-memory/insights.md`; `agents/dev_reports.md`
- test evidence:
  - `BALANCE_CDP_URL=http://127.0.0.1:9222 node tools/balance_harness.js --sessions 1 --maxWaves 3 --actionTimeoutMs 12000 --maxAttemptsMultiplier 1 --outputDir /tmp/orka-blue-tally-verify --analysisDate 2026-04-01`
  - Result: harness attached, served `http://127.0.0.1:8084`, then stalled at the live runtime boundary with no session summary emitted and no `/tmp/orka-blue-tally-verify` artifacts written during the verification window.
- discovery lane comparison: not used on this bead; the owning seam was explicit in the report and the runtime export shape confirmed the harness fallback target.
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (blue tally ownership rule captured in insights)
- scope confirmation: Confined to the blue gem consumed-count handoff in `web-runner/app.js` plus a tiny harness tally-source fallback. No balance constants, drop rates, or unrelated combat logic changed.

- bead id: PM governance cycle (2026-04-01) ready-head enforcement
- summary of changes: Enforced strict non-executable ready-head policy in live Beads state. ORKA-6opp moved from `open` to `blocked` with explicit rewrite-required note; ORKA-n0g moved from `open` to `deferred` as future-stub lane requiring rewrite/decompose before reselection. No gameplay/runtime code changed.
- files modified: `agents/issues.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `bd ready -n 10` (confirmed ORKA-6opp and ORKA-n0g were ready-head before enforcement)
  - `bd show ORKA-6opp` and `bd show ORKA-n0g` (confirmed non-executable conditions: missing spec contract / explicit future-stub note)
  - `bd update ORKA-6opp --status blocked --append-notes "...strict non-executable policy..."`
  - `bd update ORKA-n0g --status deferred --append-notes "...future-stub ... rewrite/decompose..."`
  - `bd ready -n 10` (verified both beads removed from ready head; ready count reduced)
- discovery lane comparison: not used on this lane
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (strict queue-head enforcement pattern)
- scope confirmation: Governance-only queue correction. No runtime feature implementation, tests, or Notion writes (closed-beads-only sync policy respected).

- bead id: ORKA-5wj1
- summary of changes: PM-DEV cycle selected ORKA-5wj1 as the first executable-looking ready lane after skipping higher-priority stub/underspecified items, then blocked it pre-implementation when acceptance/test seams proved incomplete for special-skill trigger behavior. No runtime code was changed.
- files modified: `agents/issues.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `bd show ORKA-6opp` and `bd show ORKA-n0g` (confirmed queue-head lanes remain rewrite/stub, not safe execution candidates)
  - `bd show ORKA-5wj1` (confirmed intent text exists but no explicit acceptance/test contract in bead body)
  - `bd update ORKA-5wj1 --status in_progress` then `bd update ORKA-5wj1 --status blocked --append-notes "...pending explicit acceptance/test contract..."` (truthful lane transition and same-cycle restore from unsafe execution state)
- discovery lane comparison: not used on this bead
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (queue-truthful block decision with explicit rewrite requirement)
- scope confirmation: Confined to PM/dev coordination and Beads state hygiene. No gameplay/runtime implementation was performed.

- bead id: ORKA-r43t
- summary of changes: Synchronized live project governance into Notion and hardcoded PM-cycle policy to require tracker updates. Added file-backed entries to Wishfire Specs/Architecture/Knowledge from `AGENTS.md`, PM/Dev prompts, `beads-process`, `ai-memory/context.md`, and `ai-memory/insights.md`. Then updated process authority files so PM closeout includes mandatory Notion sync for human parallel oversight.
- files modified: `AGENTS.md`; `agents/prompts/pm_agent.md`; `governance/execution/beads-process.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `rg -n "Notion Tracker Sync|Step 4.5|PM cycle must keep the Wishfire Notion tracker|sync Wishfire Notion tracker state" AGENTS.md agents/prompts/pm_agent.md governance/execution/beads-process.md` (cross-file policy presence check)
  - Notion DB writes completed with created-page confirmations in:
    - Specs: `3347e3368a6781589639f17f5b2d50c1`, `3347e3368a67817eae91d2a8ba896a71`, `3347e3368a6781518811c0e3e4629517`
    - Architecture: `3347e3368a6781da8d72e897daa1a20f`, `3347e3368a6781e29ec8ffffcf4b1a2f`, `3347e3368a678182a42ae7d5fcfaffcf`
    - Knowledge: `3347e3368a6781e8ab5ec69508109cab`, `3347e3368a6781068e0acc77c2c24ce4`, `3347e3368a67817caec9dbbb4d2f63cf`
- discovery lane comparison: not used on this bead
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (policy + tracker synchronization)
- scope confirmation: Confined to governance/prompt/process documentation and Notion project-tracker synchronization. No gameplay/runtime code changed.

- bead id: ORKA-6opp queue correction
- summary of changes: Ran the PM cycle on the live ready-head feature bead and confirmed it is still not executable. The bead purpose is to give each hero a distinct red single-target attack presentation without changing damage formulas, but the current body still lacks acceptance criteria, non-goals, and test boundaries. The lane was claimed only long enough to make that correction explicit and then returned to truthful queue state.
- files modified: `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `export PATH=\"$HOME/.local/bin:$PATH\" && bd show ORKA-6opp` (confirmed the bead body is still only a short description plus a note saying it needs spec rewrite)
  - `rg -n "ORKA-6opp|6opp" agents/issues.md agents/pm_status.md agents/dev_reports.md` (confirmed existing coordination files already classify the bead as `missing_spec` and rewrite-only)
  - `export PATH=\"$HOME/.local/bin:$PATH\" && bd update ORKA-6opp --status in_progress && bd update ORKA-6opp --status open` (same-cycle claim and restore so the PM cycle does not leave an orphaned false-active lane)
- discovery lane comparison: not used on this bead
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (truthful queue correction)
- scope confirmation: Confined to PM-cycle queue hygiene and coordination updates. No gameplay/runtime implementation or acceptance expansion was performed.

- bead id: ORKA-39i0 proof pass
- summary of changes: Ran a proof-or-close PM cycle on the initiative turn-loop bug. The bead is not closable. Static checks were mixed: the hero idle-window restore guard contract still passes, while the older deferred-advance regex contract no longer matches the current dirty app runtime. The decisive result came from live browser proof: blue and yellow initiative actions handed off cleanly, but a completed red `HERO_SINGLE` action returned Huun to an immediately actionable same-turn state with `TurnSerial` still `0`.
- files modified: `agents/dev_reports.md`; `agents/pm_status.md`; `agents/issues.md`; `output/playwright/orka-39i0-runtime-proof.json`; `output/playwright/orka-39i0-runtime-proof-preferred.json`; `output/playwright/orka-39i0-runtime-proof-complete.json`
- test evidence:
  - `npm test -- tests/heroInitiativePickRestoreGuardContract.test.js tests/turnTransientWriteGuardContract.test.js` (`heroInitiativePickRestoreGuardContract` pass; `turnTransientWriteGuardContract` fail on the current app runtime source)
  - discovery lane artifact: `output/playwright/orka-39i0-runtime-proof-complete.json`
  - supporting artifacts: `output/playwright/orka-39i0-runtime-proof.json`; `output/playwright/orka-39i0-runtime-proof-preferred.json`
  - runtime repro: in `orka-39i0-runtime-proof-complete.json`, yellow and blue initiative actions advanced from Huun to Kojonn, while red `HERO_SINGLE` executed and then returned to Huun with `CanPickGems=1`, `DeferAdvance=0`, and `TurnSerial=0`
- discovery lane comparison: `found more` — the browser lane separated a stale static regex mismatch from the live remaining bug and localized the failure to the red single-target initiative path.
- pilot value signals: time-to-understand failure `faster`; token cost `medium`; operator overhead `medium`; reusable output `yes`
- scope confirmation: Confined to runtime bug proof, artifact capture, and coordination updates. No gameplay/runtime code changed in this cycle.

- bead id: ORKA-j4t0
- summary of changes: Hardened PM-cycle governance so claimed or temporarily activated beads do not get left orphaned. The shared Beads process now requires same-cycle closeout, explicit handoff, or immediate restore to truthful queue state, and both PM/dev prompts now spell out that inspection-only activation must be unwound before the cycle ends.
- files modified: `governance/execution/beads-process.md`; `agents/prompts/pm_agent.md`; `agents/prompts/dev_agent.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `rg -n "Orphaned Bead Prevention Rule|inspection-only|orphaned|truthful live `bd` state|proof-or-close lanes" governance/execution/beads-process.md agents/prompts/pm_agent.md agents/prompts/dev_agent.md` (cross-file rule presence check)
  - `export PATH=\"$HOME/.local/bin:$PATH\" && bd show ORKA-39i0 && bd show ORKA-j4t0` (live queue-state confirmation: previously inspected bead restored, governance bead active)
- discovery lane comparison: not used on this bead
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (hardcoded PM-cycle queue hygiene)
- scope confirmation: Confined to governance/process prompts and coordination updates. No gameplay/runtime or harness behavior changed.

- bead id: ORKA-7w7q
- summary of changes: Ran a multi-pass browser QA sustainability sweep through the discovery lane on the live local runtime. Three CDP-backed passes repeatedly clicked through `storyMock -> town -> combat`, then retried the combat-to-map nav until it opened, closed map via the hero-style close control, and confirmed the game returned to an actionable combat state each time.
- files modified: `agents/dev_reports.md`; `agents/pm_status.md`; `agents/issues.md`; `output/playwright/gstack-multipass-qa-20260323.json`; `output/playwright/gstack-pass-1-map.png`; `output/playwright/gstack-pass-1-final.png`; `output/playwright/gstack-pass-2-map.png`; `output/playwright/gstack-pass-2-final.png`; `output/playwright/gstack-pass-3-map.png`; `output/playwright/gstack-pass-3-final.png`
- test evidence:
  - discovery lane artifact: `output/playwright/gstack-multipass-qa-20260323.json`
  - discovery lane screenshots: `output/playwright/gstack-pass-1-map.png`, `output/playwright/gstack-pass-1-final.png`, `output/playwright/gstack-pass-2-map.png`, `output/playwright/gstack-pass-2-final.png`, `output/playwright/gstack-pass-3-map.png`, `output/playwright/gstack-pass-3-final.png`
  - direct CDP-backed browser QA on `http://127.0.0.1:8095/web-runner/index.html` (3 passes): click `storyMock -> town -> combat`, wait for actionable combat, retry `Map` nav click until `mapLayout`, close via hero-style close control, confirm return to actionable combat
- discovery lane comparison: `found more` — the sweep proved the current runtime is sustainable across the click-verified `storyMock`, `town`, `combat`, and `mapLayout` loop even though the shipping lane remains bottlenecked by startup ownership. It also surfaced a concrete QA gap: non-map bottom-nav hit targets are still not reliably click-classified under this browser path.
- pilot value signals: time-to-understand failure `faster`; token cost `medium`; operator overhead `medium`; reusable output `yes`
- scope confirmation: Confined to browser QA execution, artifacts, and coordination updates. No gameplay/runtime code or shipping-lane authority changed.

- bead id: ORKA-e1n4
- summary of changes: Hardened bead-purpose statement compliance so it is no longer advisory. The shared Beads process now requires a one-sentence plain-language bead purpose before execution/review, PM flow treats missing purpose statements as non-compliant, and dev flow now requires restating the bead purpose before claim/implementation.
- files modified: `governance/execution/beads-process.md`; `agents/prompts/pm_agent.md`; `agents/prompts/dev_agent.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `rg -n "Purpose Statement Rule|state the bead purpose|non-compliant|goal was stated plainly|restate the bead purpose" governance/execution/beads-process.md agents/prompts/pm_agent.md agents/prompts/dev_agent.md` (cross-file rule presence check)
  - `git diff --stat -- governance/execution/beads-process.md agents/prompts/pm_agent.md agents/prompts/dev_agent.md` (scoped governance diff inspection)
- discovery lane comparison: not used on this bead
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (hardcoded compliance gate)
- scope confirmation: Confined to governance/process docs and role prompts. No gameplay/runtime or queue-state behavior changed beyond the compliance rule itself.

- bead id: ORKA-jz5i
- summary of changes: Ran a queue cleanup sweep against the live open-bead list. Closed one stale-open hardening lane that had already shipped (`ORKA-9yo`), marked two P1 hardening tasks (`ORKA-6n7`, `ORKA-njg`) as rewrite-only instead of executable-ready, and clarified that `ORKA-n0g` stays open only as a future stub for later exclusive-slot/combat-accessory work.
- files modified: `agents/dev_reports.md`; `agents/pm_status.md`; `agents/issues.md`
- test evidence:
  - `bd list --json | jq '[.[] | select(.status=="open" or .status=="in_progress" or .status=="blocked")] | sort_by(.priority, .created_at) | map({id,title,status,priority,issue_type,updated_at})'` (live open-queue audit)
  - `bd show ORKA-6n7`
  - `bd show ORKA-9yo`
  - `bd show ORKA-njg`
  - `bd show ORKA-n0g`
  - `bd close ORKA-9yo --force --reason "...superseded by shipped hot-file lock tooling..."`
- discovery lane comparison: not used on this bead
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (cleaner ready queue and explicit keep/rewrite/close guidance)
- scope confirmation: Confined to queue/governance cleanup under live `bd`. No gameplay/runtime implementation or feature acceptance was changed.

- bead id: ORKA-omdl
- summary of changes: Ran the browser discovery-lane pilot on a bounded runtime QA scenario: enter combat, wait for an actionable hero turn, execute one 3-gem action, and observe post-action handoff. The canonical shipping lane was attempted first through the existing `balance-harness` CDP path, then the discovery lane ran through a direct persistent CDP browser session on the same local runtime.
- files modified: `agents/dev_reports.md`; `agents/pm_status.md`; `agents/issues.md`
- test evidence:
  - `npm run chrome:cdp -- --port 9222 --startUrl http://127.0.0.1:8095/web-runner/index.html` (external Chrome CDP owner started successfully)
  - `npm run playwright:doctor -- --only cdp --cdpUrl http://127.0.0.1:9222` (CDP attach pass)
  - `BALANCE_CDP_URL=http://127.0.0.1:9222 npm run balance-harness -- --sessions 1 --maxWaves 1 --outputDir output/balance-harness/omdl-shipping` (shipping lane failed to produce artifacts before Chrome crashed on the known AppKit/HIServices startup boundary; output directory remained empty)
  - discovery lane artifact: `output/playwright/omdl-discovery-lane.json`
  - discovery lane screenshot: `output/playwright/omdl-discovery-lane.png`
- discovery lane comparison: `found more` — the shipping lane only reconfirmed browser-ownership brittleness, while the discovery lane captured actionable runtime state, one completed hero action, post-action handoff to the next hero, and a useful console trace showing `HERO_SINGLE`, `DeferAdvance`, and `TURN` sequencing.
- pilot value signals: time-to-understand failure `faster`; token cost `medium`; operator overhead `medium`; reusable output `yes`
- scope confirmation: Confined to pilot QA execution and coordination artifacts for the browser discovery lane. No gameplay/runtime implementation or harness authority rules changed.

- bead id: ORKA-kewj
- summary of changes: Added a repo-owned browser discovery-lane pilot for runtime QA. The canonical harness remains the shipping lane, while a new governance packet now defines when an experimental discovery lane is allowed, how PM/dev should report it, and how to unwind it if it adds cost without signal.
- files modified: `governance/qa/browser-discovery-lane-pilot.md`; `tools/README.md`; `governance/qa/combat-playwright-control-model.md`; `agents/prompts/dev_agent.md`; `agents/prompts/pm_agent.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `rg -n "browser-discovery-lane-pilot|found more|found same|found less|shipping lane|discovery lane" tools/README.md governance/qa/combat-playwright-control-model.md governance/qa/browser-discovery-lane-pilot.md agents/prompts/dev_agent.md agents/prompts/pm_agent.md agents/dev_reports.md` (cross-file terminology and reference check)
  - `git diff --stat -- governance/qa/browser-discovery-lane-pilot.md tools/README.md governance/qa/combat-playwright-control-model.md agents/prompts/dev_agent.md agents/prompts/pm_agent.md agents/dev_reports.md` (scoped change inspection)
- discovery lane comparison: not run on this bead; this lane established the pilot contract and reporting hooks only
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (repo-owned QA/governance packet)
- scope confirmation: Confined to governance, QA documentation, and reporting prompts for the browser discovery-lane pilot. No gameplay runtime, harness pass/fail authority, or Beads ownership rules changed.

- bead id: ORKA-9zlf follow-up 4
- summary of changes: Retuned the HoT shimmer diamonds again by raising the opacity cap to `1.0` and shrinking the diamond size another 20% from the previous tuning, preserving the shimmer-line lane and timing.
- files modified: `web-runner/app.js`; `tests/healBloomContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/healBloomContract.test.js` (3/3 pass)
- scope confirmation: Confined to HoT diamond alpha cap and size only.
- bead id: ORKA-9zlf follow-up 3
- summary of changes: Retuned the HoT shimmer diamonds to read cleaner over heroes by increasing their opacity cap to `0.8` while shrinking their size by 20% from the previous scale.
- files modified: `web-runner/app.js`; `tests/healBloomContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/healBloomContract.test.js` (3/3 pass)
- scope confirmation: Confined to HoT diamond alpha and size only; shimmer lines, timing, and heal behavior were unchanged.
- bead id: ORKA-apdf follow-up 6
- summary of changes: Increased the unmasked Faze DoT particle opacity cap to 90% so the purple dots read more clearly in motion without changing masking, count, size, or timing.
- files modified: `web-runner/app.js`; `tests/hitFlashFeedbackContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/hitFlashFeedbackContract.test.js` (3/3 pass)
- scope confirmation: Confined to Faze particle alpha tuning only.
- bead id: ORKA-cwtr
- summary of changes: Fixed the real forced-support-board QA bug without changing forced-color persistence. Support colors still enter action phase and one-action-per-turn protection stays in place, but deferred advance now treats `BoardFillActive` as a hard block and the refill seam clears stale `BoardFillActive` when a no-work refill pass occurs. That removed both the earlier hero-loop leak and the later blue/heal/purple post-match freeze.
- files modified: `web-runner/app.js`; `tests/devToolingTurnIntegrityContract.test.js`; `tests/turnGateRefreshBaselineContract.test.js`; `tests/heroInitiativePickRestoreGuardContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/devToolingTurnIntegrityContract.test.js tests/turnGateRefreshBaselineContract.test.js tests/heroInitiativePickRestoreGuardContract.test.js` (12/12 pass)
  - live `agent-browser` repro on `http://127.0.0.1:8096/web-runner/index.html`:
    - forced `blue` + idle autoplay progressed to `matches=4`, `turns=6`, current actor enemy, `boardFill=0`
    - forced `heal` + idle autoplay progressed from `matches=11 / turns=19` to `matches=12 / turns=21`
    - forced `purple` + idle autoplay progressed to `matches=14 / turns=24`
- scope confirmation: Confined to dev-panel forced-color turn handoff and refill gating. Forced-color persistence remains intact for QA. No combat formulas, support-color effects, or dev-panel policy were changed.
- bead id: ORKA-l0je
- summary of changes: Replaced the party HP bar’s hard single-color front fill with a continuous degradation color ramp. The front bar now shifts smoothly from green at healthy values to yellow at low values and red at critical values, while preserving the existing lag bar and HoT overlay behavior.
- files modified: `web-runner/app.js`; `tests/hpBarAnimationContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/hpBarAnimationContract.test.js` (2/2 pass)
- scope confirmation: Confined to party HP bar presentation only; enemy bars, heal math, and unrelated UI behavior were not changed.
- bead id: ORKA-r6v5
- summary of changes: Fixed fake HoT regeneration by preserving exact shared party-heal totals when syncing HP back onto individual heroes. Small regen ticks no longer disappear into per-hero floor rounding; the remainder is distributed so live hero HP actually increases.
- files modified: `web-runner/modules/functionBank.js`; `Scripts/functionBank.js`; `tests/partyHealRoundingContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/partyHealRoundingContract.test.js tests/healBloomContract.test.js` (6/6 pass)
- scope confirmation: Confined to party-heal redistribution and its focused regression coverage; no HoT visuals or turn logic changed in this pass.
- bead id: ORKA-9zlf follow-up 2
- summary of changes: Increased Kojonn HoT shimmer readability by raising both the vertical line alpha and the white/yellow diamond alpha to match the stronger visibility approved for Faze particles.
- files modified: `web-runner/app.js`; `tests/healBloomContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/healBloomContract.test.js` (3/3 pass)
- scope confirmation: Confined to HoT shimmer alpha tuning only.
- bead id: ORKA-apdf follow-up 5
- summary of changes: Updated Kojonn’s Faze combat messaging to use the spell name instead of `blight`, and increased the shared Faze dot/stroke opacity another 20% for stronger read in combat.
- files modified: `web-runner/app.js`; `web-runner/modules/functionBank.js`; `Scripts/functionBank.js`; `tests/damageNumberTimelineContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/damageNumberTimelineContract.test.js tests/hitFlashFeedbackContract.test.js` (8/8 pass)
- scope confirmation: Confined to Faze presentation text and particle alpha only.
- bead id: ORKA-apdf follow-up 4
- summary of changes: Increased the Faze DoT dot radius by 20% for easier mid-combat identification while keeping the same unmasked particle path, color treatment, and opacity tuning.
- files modified: `web-runner/app.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/hitFlashFeedbackContract.test.js` (3/3 pass)
- scope confirmation: Confined to Faze particle size only.
- bead id: ORKA-apdf follow-up 3
- summary of changes: Increased the upward Faze DoT particle opacity so the dark purple dots read more clearly in motion without changing the masked purple enemy wash, particle count, or hero-side effects.
- files modified: `web-runner/app.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/hitFlashFeedbackContract.test.js` (3/3 pass)
- scope confirmation: Confined to the Faze particle alpha curve and cap only.
- bead id: ORKA-39i0
- summary of changes: Fixed an app-side hero initiative turn leak. The runtime had a fallback that restored `CanPickGems` whenever it saw a hero turn with phase 0 and no refill, even if deferred advance, action ownership, or busy state still owned the turn. The restore gate now only runs during a truly idle hero window.
- files modified: `web-runner/app.js`; `tests/heroInitiativePickRestoreGuardContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/heroInitiativePickRestoreGuardContract.test.js tests/turnTransientWriteGuardContract.test.js` (4/4 pass)
- scope confirmation: Confined to app-side initiative pick restoration; no scheduler pointer math or function-bank turn ownership logic changed in this pass.
- bead id: ORKA-apdf follow-up 2
- summary of changes: Increased Faze DoT particle readability without changing the masked enemy overlay. The upward purple dots now use a darker purple fill, a darker outline, and a slightly darker glow so they read clearly against enemy art while remaining unmasked above the target.
- files modified: `web-runner/app.js`; `tests/hitFlashFeedbackContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/hitFlashFeedbackContract.test.js` (3/3 pass)
- scope confirmation: Confined to the enemy Faze accent particles only; no HoT visuals, damage math, or purple mask ownership changed.
- bead id: ORKA-apdf / ORKA-9zlf follow-up
- summary of changes: Split masked status overlays from ambient particle accents. Faze keeps its masked purple enemy overlay, but the upward purple DoT dots now render above the enemy without clipping. Hero HoT shimmer lines and white/yellow diamonds likewise now render above heroes instead of being silhouette-clipped.
- files modified: `web-runner/app.js`; `tests/hitFlashFeedbackContract.test.js`; `tests/healBloomContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/hitFlashFeedbackContract.test.js tests/healBloomContract.test.js` (6/6 pass)
- scope confirmation: Confined to the two presentation beads only; the enemy purple wash remains masked, while only the ambient particle layers changed ownership from clipped-to-actor to free-floating above the actor.
- bead id: ORKA-apdf
- summary of changes: Extended Kojonn Faze’s persistent enemy blight presentation with a secondary upward particle layer. Blighted enemies keep the existing purple masked overlay, and now also emit small purple dots that spawn low, float upward along the enemy height, and fade out above the sprite for clearer DoT-state symmetry with the hero HoT effect.
- files modified: `web-runner/app.js`; `tests/hitFlashFeedbackContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/hitFlashFeedbackContract.test.js tests/healBloomContract.test.js` (6/6 pass)
- scope confirmation: Confined to enemy blight presentation only. No Faze damage math, DoT duration, enemy targeting, or hero heal visuals changed.

- bead id: ORKA-9zlf
- summary of changes: Replaced the persistent hero HoT tint overlay with a subtle vertical shimmer effect. Active party regen now draws four clipped light-green shimmer lines over each hero instead of reusing the old full-sprite color wash, which was reading as sickness rather than healing.
- files modified: `web-runner/app.js`; `tests/healBloomContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/healBloomContract.test.js tests/hpBarAnimationContract.test.js` (5/5 pass)
- scope confirmation: Confined to persistent party HoT presentation on hero sprites only. No regen timing, heal values, bloom particles, or enemy overlay behavior changed.

- bead id: ORKA-vlt8
- summary of changes: Removed the invalid DOM-only `transformOrigin` property from the GSAP punch tween used by the canvas HP bar state objects. The front/lag easing split and `scaleY` punch behavior remain unchanged; the follow-up only silences the false plugin warning at the real combat update seam.
- files modified: `web-runner/src/core/hpBarAnimation.mjs`; `tests/hpBarAnimationContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/hpBarAnimationContract.test.js` (2/2 pass)
  - deterministic runtime-path validation via direct module import: `node --input-type=module` calling `updateHP({ current: 60, max: 100, frontBar, lagBar })` on the same plain object shape used by canvas bars returned `seen: []` for captured warnings/errors while mutating the bar state as expected
  - live browser reproduction path was attempted, but local browser automation is currently blocked by the existing Chrome session/cache boundary in this environment; the deterministic seam check was used instead
- scope confirmation: Confined to the HP bar GSAP presentation seam only. No turn flow, combat timing, layout ownership, or HP semantics changed.

- bead id: ORKA-bypu
- summary of changes: Fixed the combat/layout break by removing stale aggregate `PartyHP` as the source of truth for party defeat. The app-side combat fail gate now derives defeat from live hero entities and repairs stale HUD totals via `UpdateHeroHPUI()` before exiting combat, while both mirrored function banks now use live hero counts for party-alive checks in hero roster and turn-start eligibility.
- files modified: `web-runner/app.js`; `web-runner/modules/functionBank.js`; `Scripts/functionBank.js`; `tests/combatFailGateContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/combatFailGateContract.test.js tests/healBloomContract.test.js` (5/5 pass)
  - Playwright runtime validation at `http://127.0.0.1:8096/web-runner/index.html`: cleared layouts into combat and confirmed live runtime state via `window.render_game_to_text()` with `layoutId: "combat"` and no console errors after boot
- scope confirmation: Confined to party-defeat/layout-exit ownership and mirrored party-alive gates. No damage formulas, turn math, layout graph, or unrelated FX logic changed.

- bead id: ORKA-1g3x
- summary of changes: Party-wide HoT now drives a persistent hero-sprite overlay for the full active regen duration. The overlay reuses the existing masked sprite-overlay seam used by enemy Faze, adds a dedicated light-green regen tone in the heal-bloom palette, and renders on heroes before transient hit flashes so party regen reads consistently without inventing a separate actor effect system.
- files modified: `web-runner/app.js`; `tests/healBloomContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/healBloomContract.test.js tests/hpBarAnimationContract.test.js` (5/5 pass)
  - Playwright runtime smoke at `http://127.0.0.1:8096/web-runner/index.html` loaded cleanly with `0` console errors after boot
- scope confirmation: Confined to persistent HoT presentation on hero sprites. No heal math, regen cadence, damage text, or unrelated enemy overlay behavior changed.

- bead id: ORKA-gmyj
- summary of changes: Added a reusable GSAP damage-number animation module with per-digit spans, independent timelines, staggered/randomized drift, crit pre-phase behavior, and DOM cleanup on completion. Wired the web runner damage-text path to use DOM/GSAP damage numbers instead of canvas text rendering, and paired it with the new reusable damage/heal prefix formatter from ORKA-acx5.
- files modified: `web-runner/src/core/damageNumberAnimation.mjs`; `src/core/damageTextFormatting.mjs`; `web-runner/app.js`; `tests/damageNumberTimelineContract.test.js`; `tests/damageTextFormattingContract.test.js`; `package.json`; `package-lock.json`; `node_modules/.package-lock.json`
- test evidence:
  - `npm test -- tests/damageTextFormattingContract.test.js tests/damageNumberTimelineContract.test.js` (3/3 pass)
  - Playwright runtime proof at `http://127.0.0.1:8095/web-runner/index.html`: dynamic import of `damageNumberAnimation.mjs` in the live browser produced a `.damage-number` wrapper with 4 digit spans for `-123`, and the wrapper auto-removed after timeline completion
- scope confirmation: Confined to damage-number presentation and formatting only. No combat formulas, crit rates, or unrelated HUD logic changed.

- bead id: ORKA-acx5
- summary of changes: Added a minimal reusable `formatDamageValue({ value, type })` formatter so damage renders with `-` and healing renders with `+`, and integrated the formatter into the damage-number rendering path.
- files modified: `src/core/damageTextFormatting.mjs`; `web-runner/app.js`; `tests/damageTextFormattingContract.test.js`
- test evidence:
  - `npm test -- tests/damageTextFormattingContract.test.js` (pass)
- scope confirmation: Confined to formatting-only prefix behavior before render. No tween logic, value math, localization, or crit logic changed.

- bead id: ORKA-tuin
- summary of changes: Follow-up hardened the new hot-file prepare/enforce flow so it can handle real `web-runner/app.js` commit lanes. The original strict function-only model came from the ORKA-9yo hot-file-lock policy and was later optimized in ORKA-qpff, but repo history and `ai-memory/insights.md` already showed the blind spot: top-level imports/constants/state-shape edits in hot files were valid work yet still uncommittable. The tooling now emits an explicit `__MODULE__` scope token for reviewed module-scope edits instead of failing those diffs as impossible.
- files modified: `tools/hot_file_scope.py`; `tools/test_hot_file_lock.sh`; `tools/README.md`; `governance/execution/beads-process.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `bash tools/test_hot_file_lock.sh` (6/6 pass)
  - `PYTHONPYCACHEPREFIX=/tmp/python-pyc python3 -m py_compile tools/hot_file_scope.py` (pass)
  - `tools/prepare_hot_file_commit.sh ORKA-tuin` on the current hot-file diff now succeeds and generates explicit `__MODULE__` scope instead of rejecting top-level `web-runner/app.js` edits
- scope confirmation: Confined to hot-file commit tooling and workflow semantics only. No runtime/gameplay rules changed in this follow-up.

- bead id: ORKA-tuin
- summary of changes: Replaced the iterative hot-file lock flow with a repo-owned prepare/enforce pipeline. Added `tools/prepare_hot_file_commit.sh` and shared parser/validator logic in `tools/hot_file_scope.py`, so staged hot-file diffs now generate `.scope` metadata automatically, active-bead misalignment can be corrected in one helper invocation, enforcement fails once with a single actionable prepare command when metadata is missing, and batched top-level/undeclared-function errors are reported in one pass instead of one commit attempt at a time.
- files modified: `tools/hot_file_scope.py`; `tools/prepare_hot_file_commit.sh`; `tools/enforce_hot_file_scope.sh`; `tools/test_hot_file_lock.sh`; `tools/README.md`; `governance/execution/beads-process.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `bash tools/test_hot_file_lock.sh` (6/6 pass)
- scope confirmation: Confined to repo-owned hot-file commit tooling, workflow docs, and coordination handoff only. No gameplay/runtime behavior, combat formulas, or browser harness ownership rules changed in this lane.

- bead id: ORKA-1qo
- summary of changes: Added a Playwright permission-preflight toolkit around the existing balance harness, then extended it with a direct-launch matrix. New `npm run playwright:doctor` probes distinguish direct-launch startup failures from CDP attach failures, new `npm run chrome:cdp` bootstraps a fresh external Chrome debug session for the supported path, new `npm run playwright:launch-matrix` compares Playwright-owned launch against plain Codex-owned Chrome child-process launch, and the balance harness now treats attached CDP browsers as externally owned by default instead of auto-closing the whole Chrome session.
- files modified: `tools/playwright_support.js`; `tools/playwright_doctor.js`; `tools/playwright_launch_matrix.js`; `tools/chrome_cdp_bootstrap.js`; `tools/balance_harness.js`; `package.json`; `tools/README.md`; `governance/qa/combat-playwright-control-model.md`; `ai-memory/insights.md`; `tests/playwrightSupportContract.test.js`; `tests/balanceHarnessCdpOwnershipContract.test.js`; `tests/playwrightLaunchMatrixContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `node --test tests/playwrightSupportContract.test.js tests/balanceHarnessCdpOwnershipContract.test.js` (5/5 pass)
  - `npm run playwright:doctor -- --json` classified bundled Chromium launch as `sandbox_browser_startup_denied` and recommended external Chrome + CDP attach for this Codex/macOS environment
  - `npm run playwright:doctor -- --only cdp --cdpUrl http://127.0.0.1:9222 --json` classified the missing external browser as `cdp_unreachable`
-  - `node --test tests/playwrightSupportContract.test.js tests/balanceHarnessCdpOwnershipContract.test.js tests/playwrightLaunchMatrixContract.test.js` (6/6 pass)
-  - `npm run playwright:doctor -- --only cdp --cdpUrl http://127.0.0.1:9222` passed (`cdp_attach: pass`, `Chrome/146.0.7680.80`)
-  - `npm run playwright:launch-matrix` showed both Playwright-owned launch and plain Codex-owned Chrome child-process launch failing, so the remaining hands-off regression is not Playwright-specific in this environment
-  - Playwright MCP browser smoke passed in this environment (`https://example.com` opened with a normal snapshot), which confirms the MCP inspection layer is healthy even while the repo harness direct-launch path remains blocked
- scope confirmation: Confined to Playwright tooling, harness browser-session ownership, and QA guidance for ORKA-1qo. No runtime combat logic, balance formulas, or gameplay rules changed.
- limitations: External Terminal-launched Chrome bootstrap plus Codex CDP attach is proven working, and Playwright MCP inspection is healthy in this environment. The unresolved lane is narrower: the repo harness direct-launch path still cannot start a Codex-owned Chrome process hands-off, so full batch launch autonomy is still blocked there.

- bead id: ORKA-wnjr
- summary of changes: Permanently hardened turn integrity around the dev-panel refresh seam. Added shared refresh-baseline exports for full transient turn state, made combat refresh reseed through one canonical reset helper, invalidated stale dev-tool pause snapshots by `CombatSessionId` / `TurnSerial`, and centralized deferred-advance eligibility behind one app-side predicate so refresh, enemy idle recovery, and action handoff all read the same turn contract.
- files modified: `src/core/turnGateController.mjs`; `web-runner/src/core/turnGateController.mjs`; `web-runner/app.js`; `web-runner/modules/functionBank.js`; `Scripts/functionBank.js`; `tests/turnGateRefreshBaselineContract.test.js`; `tests/devToolingTurnIntegrityContract.test.js`; `tests/turnSchedulerRepeatGuardContract.test.js`; `tests/turnTransientWriteGuardContract.test.js`; `tests/enemyLineClearRefillContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/turnGateRefreshBaselineContract.test.js tests/devToolingTurnIntegrityContract.test.js tests/turnSchedulerRepeatGuardContract.test.js tests/turnTransientWriteGuardContract.test.js tests/devToolingModalContract.test.js tests/yellowTurnHandoffContract.test.js tests/enemyTurnGateRecoveryContract.test.js tests/extraTurnHarnessContract.test.js tests/enemyLineClearRefillContract.test.js` (27/27 pass)
  - Canonical browser-path validation: `npm run balance-harness -- --sessions 1 --minWaves 1 --maxWaves 1` failed on the known Codex-owned Chrome startup seam (`browser_closed_before_control`) before page control
  - Canonical browser-path fallback: `BALANCE_CDP_URL=http://127.0.0.1:9222 npm run balance-harness -- --sessions 1 --minWaves 1 --maxWaves 1` completed `1/1` sessions and wrote updated artifacts to `output/balance-harness/`
  - Harness artifact check: `output/balance-harness/session_results.csv` ended `1,0,0,0,energy_depleted`
  - Focused Playwright turn-order scenario: `node output/playwright/turn_refresh_validation.js` via CDP fallback (`http://127.0.0.1:9222`) passed against the live local game URL. The dev-tool apply changed enemy slots, `CombatSessionId` advanced from `1` to `2`, the refreshed combat opened on an enemy turn, the captured sequence included `Skeleton -> Djinn -> Marid` enemy turns before handing back to heroes, and the sampled turn timeline contained no repeated actor across turn advances. Artifacts: `output/playwright/turn-refresh-validation.json`, `output/playwright/turn-refresh-validation.png`
- scope confirmation: Confined to turn-transient ownership, dev-panel combat refresh/reset behavior, deferred-advance gate evaluation, deterministic regression contracts, and runtime validation evidence. No balance formulas, skill weights, layout art, or unrelated gameplay systems changed.
- limitations: Direct Codex-owned harness launch is still blocked on the known Chrome startup seam, so both browser proofs currently rely on the existing CDP fallback path.

- bead id: ORKA-4dcz
- summary of changes: Hardened Djinn/Marid gem clears around named skill identity. `Enemy_Scathe` and `Enemy_Sweep` now route through explicit board-pressure skill harness profiles, so Scathe owns column-clear semantics and Sweep owns row-clear semantics while enemy AI remains responsible only for selecting the skill ID.
- files modified: `web-runner/modules/functionBank.js`; `Scripts/functionBank.js`; `tests/enemyLineClearContract.test.js`; `tests/enemyLineAxisContract.test.js`; `tests/enemyLineClearRefillContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/enemyLineClearContract.test.js tests/enemyLineAxisContract.test.js tests/enemyLineClearRefillContract.test.js` (8/8 pass)
- scope confirmation: Confined to Djinn/Marid line-clear skill ownership and direct harness coverage; no enemy AI weighting, board-pressure timing, or unrelated combat rules changed.
- insights check: No new reusable bug insight beyond the structural hardening itself; this lane was an architecture task, not a regression fix.

- bead id: ORKA-xtpi
- summary of changes: Reopened to verify the reported Marid row-clear regression. The runtime seams were still correct, but the existing tests only covered skill names and log text. Added a deterministic axis contract that proves Djinn removes a column and Marid removes a row in both mirrors, including the actual surviving cell coordinates.
- files modified: `tests/enemyLineAxisContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/enemyLineAxisContract.test.js tests/enemyLineClearContract.test.js tests/enemyLineClearRefillContract.test.js` (8/8 pass)
- scope confirmation: No gameplay/runtime logic changed in this pass. This lane added missing semantic coverage for the actual line-clear axis behavior.

- bead id: ORKA-xtpi
- summary of changes: Fixed the follow-on infinite-turn regression by giving Djinn/Marid line clears explicit board-pressure state. Enemy row/column clears now mark persistent pressure, generic refill gates ignore those holes until the player commits a real gem action, and deferred advance can still hand the turn off deterministically instead of looping the hero turn forever.
- files modified: `web-runner/modules/functionBank.js`; `Scripts/functionBank.js`; `web-runner/app.js`; `tests/enemyLineClearRefillContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`; `ai-memory/insights.md`
- test evidence:
  - `npm test -- tests/enemyLineClearContract.test.js tests/enemyLineClearBoardSyncContract.test.js tests/enemyLineClearRefillContract.test.js tests/yellowTurnHandoffContract.test.js tests/enemyTurnGateRecoveryContract.test.js` (13/13 pass)
- scope confirmation: Confined to Djinn/Marid board-pressure state and the refill/advance gates that read it; no enemy damage rules, skill probabilities, or normal refill ownership were changed.

- bead id: ORKA-xtpi
- summary of changes: Reopened and corrected the Djinn/Marid line-clear behavior to match the actual gameplay intent. Enemy row/column clears now persist as board pressure instead of auto-refilling from the enemy-action completion seam, while the incomplete-board fallback guard remains intact.
- files modified: `web-runner/app.js`; `tests/enemyLineClearRefillContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`; `ai-memory/insights.md`
- test evidence:
  - `npm test -- tests/enemyLineClearContract.test.js tests/enemyLineClearBoardSyncContract.test.js tests/enemyLineClearRefillContract.test.js` (7/7 pass)
- scope confirmation: Confined to enemy line-clear refill timing and its regression contract; no enemy damage formulas, skill selection rates, or normal player-turn refill behavior changed.

- bead id: ORKA-890
- summary of changes: Closed the stale heal-punctuation bug on proof rather than runtime churn. Current heal combat emit paths in both mirrored function banks already end with `!`, so I added a narrow punctuation contract to keep that formatting from drifting.
- files modified: `tests/healCombatTextPunctuationContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/healCombatTextPunctuationContract.test.js tests/chimerilassHealCritContract.test.js` (4/4 pass)
- scope confirmation: No gameplay/runtime logic changed. This lane only added regression coverage for existing heal-text punctuation.
- insights check: No reusable future-facing insight beyond the contract itself; this was a stale-open formatting bead, not a systemic runtime failure.

- bead id: ORKA-3g5x
- summary of changes: Hardened Kojonn Power Amp delayed-hit accounting so queued hero-hit packets carry immutable final damage totals instead of relying solely on later recomputation. Added focused coverage for Kojonn's red single-target `INCINERATE` path at base, x2, and x3, and updated the app-side delayed-hit resolver to prefer queued `finalDmg` when present.
- files modified: `web-runner/modules/functionBank.js`; `Scripts/functionBank.js`; `web-runner/app.js`; `tests/kojonnPowerAmpSingleContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`; `ai-memory/insights.md`
- test evidence:
  - `npm test -- tests/enemyLineClearContract.test.js tests/enemyLineClearBoardSyncContract.test.js tests/enemyLineClearRefillContract.test.js tests/kojonnAmpAoeContract.test.js tests/kojonnPowerAmpSingleContract.test.js` (10/10 pass)
- scope confirmation: Confined to delayed-hit Power Amp accounting and regression coverage for Kojonn attack packets; no unrelated hero formulas, targeting, or Power Amp lifecycle odds changed.


- bead id: ORKA-l8r
- summary of changes: Fixed the fallback game-loop ownership bug in `Scripts/logicCore.js`. The setInterval fallback now stores its interval handle, startup is idempotent, and `stopGameLoop()` clears either the fallback interval or the tracked tick-listener owner so restart/re-init flows can tear the loop down deterministically.
- files modified: `Scripts/logicCore.js`; `tests/logicCoreFallbackLoopContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/logicCoreFallbackLoopContract.test.js tests/partyFormationContract.test.js tests/devToolingLoadoutContract.test.js tests/enemyTurnGateRecoveryContract.test.js` (8/8 pass)
- scope confirmation: Confined to lifecycle ownership in `Scripts/logicCore.js`; no combat rules, rendering, or fallback cadence values changed.

- bead id: ORKA-d9g
- summary of changes: Added party formation mode inside `heroLayout` and wired it to the existing four-slot combat-party seam. The hero screen now has a formation toggle, available-roster cards, active-party slot buttons, deterministic assign/swap behavior, and runtime text export of the active slot package. Slot changes persist through `applyDevToolingConfig({ heroSlots })`, which is the same seam combat boot already reads.
- files modified: `web-runner/app.js`; `src/core/partyFormationRules.mjs`; `web-runner/src/core/partyFormationRules.mjs`; `tests/partyFormationContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/partyFormationContract.test.js tests/devToolingLoadoutContract.test.js tests/yellowTurnHandoffContract.test.js tests/enemyTurnGateRecoveryContract.test.js` (9/9 pass)
  - Real browser seam check via attached Chrome + Playwright `connectOverCDP()`: applying `heroSlots: ['Kojonn', 'Runa', 'Falie', 'Huun']` produced `render_game_to_text().heroScreen.activePartySlots = ['Kojonn','Runa','Falie','Huun']`
- scope confirmation: Confined to hero-screen formation UI and the existing `DevToolingConfig.heroSlots` persistence seam; no combat formulas or new party-state owner were introduced.

- bead id: ORKA-7c0.2
- summary of changes: Closed a stale-open hero-screen parity child after verifying the historical evidence pack still exists and the current `heroLayout` code still carries the locked `heroLayoutSpec`, portrait-frame removal, minus-icon orientation, and circular close-control details recorded in the bead comments.
- files modified: `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `ls test-results/ORKA-7c0.2`
  - `bd show ORKA-7c0.2`
  - `rg -n "heroLayoutSpec|minusIconImage" web-runner/app.js`
- scope confirmation: Queue reconciliation only. No new runtime code was required for this child bead in the current pass.

- bead id: ORKA-3go
- summary of changes: Closed the narrower enemy-turn actionable-state bead on the same runtime fix and validation evidence as `ORKA-dnm`. The shared enemy-turn idle-recovery gate prevents the exact leaked state this bead described (`TurnPhase === 2`, `IsPlayerBusy === 0`, `CanPickGems === 1`) and the attached-browser harness runs no longer timeout on enemy-turn actionable-state stalls.
- files modified: `src/core/turnGateController.mjs`; `web-runner/src/core/turnGateController.mjs`; `web-runner/app.js`; `tests/enemyTurnGateRecoveryContract.test.js`; `tests/yellowTurnHandoffContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/yellowTurnHandoffContract.test.js tests/enemyTurnGateRecoveryContract.test.js` (5/5 pass)
  - Attached-browser harness pass: `BALANCE_CDP_URL=http://127.0.0.1:9226 BALANCE_SESSION_COUNT=1 node tools/balance_harness.js --serverPort 8095 --maxWaves 1 --outputDir /tmp/orka-balance-dnm-cdp`
  - Fresh-profile attached-browser harness repeat: `BALANCE_CDP_URL=http://127.0.0.1:9227 BALANCE_SESSION_COUNT=1 node tools/balance_harness.js --serverPort 8095 --maxWaves 1 --outputDir /tmp/orka-balance-dnm-cdp-fresh`
- scope confirmation: No additional code beyond the `ORKA-dnm` runtime fix was required. This bead was a narrower duplicate statement of the same enemy-turn leak and was closed on shared evidence rather than a second divergent patch.

- bead id: ORKA-dnm
- summary of changes: Fixed the runtime enemy-turn idle leak instead of loosening the harness wait gate. Added a shared `createEnemyTurnIdleRecovery(...)` helper in both turn-gate modules, used it when an enemy action aborts mid-animation, and added an app-side recovery branch for the exact leaked enemy-idle state (`TurnPhase === 2`, no action in progress, no pending skill, leaked pickability or missing deferred advance). This keeps enemy turns non-pickable and forces deterministic deferred advance instead of parking the harness on a false deadlock.
- files modified: `src/core/turnGateController.mjs`; `web-runner/src/core/turnGateController.mjs`; `web-runner/app.js`; `tests/enemyTurnGateRecoveryContract.test.js`; `tests/yellowTurnHandoffContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/yellowTurnHandoffContract.test.js tests/enemyTurnGateRecoveryContract.test.js` (5/5 pass)
  - Attached-browser harness pass: `BALANCE_CDP_URL=http://127.0.0.1:9226 BALANCE_SESSION_COUNT=1 node tools/balance_harness.js --serverPort 8095 --maxWaves 1 --outputDir /tmp/orka-balance-dnm-cdp`
  - Fresh-profile attached-browser harness repeat: `BALANCE_CDP_URL=http://127.0.0.1:9227 BALANCE_SESSION_COUNT=1 node tools/balance_harness.js --serverPort 8095 --maxWaves 1 --outputDir /tmp/orka-balance-dnm-cdp-fresh`
  - Both harness outputs ended on `energy_depleted` without the old enemy-turn actionable-state timeout, and both debug ports were closed afterward (`curl http://127.0.0.1:9226/json/version` and `curl http://127.0.0.1:9227/json/version` both failed after run completion).
- scope confirmation: Confined to enemy-turn progression recovery and its deterministic contract coverage only. The harness wait predicate was intentionally left strict; the fix lands in the runtime seam the harness was exposing.

- bead id: ORKA-8w4u
- summary of changes: Reopened the coordination-guidance lane to remove the hard unresolved-issue count gate from the PM and dev prompt specs. Unresolved issues still inform prioritization and bead hygiene, but they no longer freeze ready-bead selection or active work purely because the issue list is long.
- files modified: `agents/prompts/pm_agent.md`; `agents/prompts/dev_agent.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `rg -n "Issue Accumulation Guard|hard stop|do not create a hard stop|do not create a hard stop on active work" agents/prompts/pm_agent.md agents/prompts/dev_agent.md`
  - `bd show ORKA-8w4u`
- scope confirmation: Confined to governance/prompt policy only. No gameplay/runtime code, bead acceptance, or browser/test harness logic changed.

- bead id: ORKA-xtpi
- summary of changes: Verified the Djinn/Marid line-clear path still behaves correctly: line clears remove options temporarily, the app-side gem sync rebuilds board occupancy immediately, and the main loop starts refill whenever empty slots remain. Added focused regression coverage that simulates a line-clear style gem removal and proves `startRefillBounce()` queues the missing cells, while also reasserting that the older incomplete-board fallback guard for `Scathe` / `Sweep` is still intact in both mirrored function-bank files.
- files modified: `tests/enemyLineClearRefillContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/enemyLineClearContract.test.js tests/enemyLineClearBoardSyncContract.test.js tests/enemyLineClearRefillContract.test.js` (7/7 pass)
- scope confirmation: Verification-only lane. No runtime gameplay code changed because the refill path and the anti-unplayable fallback guard were already intact.
- insights check: No new reusable insight was needed beyond the existing line-clear seam guidance; this lane confirmed the current refill and fallback contracts still hold.

- bead id: ORKA-av1q
- summary of changes: Added an AOE-specific hero lunge profile so green match attacks get extra hold/return breathing room without slowing single-target actions. `HERO_AOE` now tags the next hero action as `aoe`, `StartHeroLunge(...)` stores that profile, AOE casts hold longer and retreat longer in the app renderer, and AOE hit landing is delayed further so the green match presentation no longer crowds the flinch beat.
- files modified: `web-runner/app.js`; `web-runner/modules/functionBank.js`; `Scripts/functionBank.js`; `tests/lungeMotionContract.test.js`; `tests/kojonnAmpAoeContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/lungeMotionContract.test.js tests/extraTurnHarnessContract.test.js tests/kojonnAmpAoeContract.test.js` (9/9 pass)
- scope confirmation: Confined to `HERO_AOE` lunge/return pacing and delayed impact timing only; green attack damage, blight totals, targeting, and non-AOE hero actions were intentionally left unchanged.

- bead id: ORKA-7clz
- summary of changes: Added an explicit impact handoff delay between the attacker lunge and defender flinch/damage beat. Hero-hit scheduling in both mirrored function banks now waits until the longer forward lunge plus a short settle gap, the follow-up lunge anchor uses the same delayed handoff, and the session/combat renderer starts hit-state flashes later so the beats read as a smooth relay instead of a collision.
- files modified: `web-runner/app.js`; `web-runner/modules/functionBank.js`; `Scripts/functionBank.js`; `tests/lungeMotionContract.test.js`; `tests/extraTurnHarnessContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/lungeMotionContract.test.js tests/extraTurnHarnessContract.test.js` (7/7 pass)
- scope confirmation: Confined to presentation pacing and hit scheduling handoff only; damage values, target logic, and combat outcomes were intentionally left unchanged.

- bead id: ORKA-gc68
- summary of changes: Added a midpoint clamp to actor lunge targets so neither side can push past the combat centerline on x. Hero and enemy lunge timing stayed the same; only the maximum forward destination is now bounded by the midpoint in both the combat state machine and the idle/session renderer.
- files modified: `web-runner/app.js`; `tests/lungeMotionContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/lungeMotionContract.test.js tests/extraTurnHarnessContract.test.js` (7/7 pass)
- scope confirmation: Confined to lunge destination clamping only; no damage rules, turn ownership, or follow-up timing totals changed in this tweak lane.

- bead id: ORKA-x7gh
- summary of changes: Reduced hero-only forward lunge travel to 85% of the shared 200px distance so heroes stop overlapping enemies as aggressively. Enemy lunge distance and the shared 750ms forward-bezier timing stayed unchanged.
- files modified: `web-runner/app.js`; `tests/lungeMotionContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/lungeMotionContract.test.js tests/extraTurnHarnessContract.test.js` (7/7 pass)
- scope confirmation: Confined to hero lunge presentation distance only; enemy travel, combat timing totals, and damage logic were intentionally left unchanged in this tweak lane.

- bead id: ORKA-nri9
- summary of changes: Updated the shared actor lunge presentation to use a 200px forward travel with a 750ms forward phase driven by the requested `cubic-bezier(1, 0, 0, 1)` curve. Applied the same motion profile to combat heroes, combat enemies, and the idle/session lunge renderer, and extended the mirrored follow-up timing totals so double-attack scheduling still waits for the longer lunge window.
- files modified: `web-runner/app.js`; `web-runner/modules/functionBank.js`; `Scripts/functionBank.js`; `tests/lungeMotionContract.test.js`; `tests/extraTurnHarnessContract.test.js`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/lungeMotionContract.test.js tests/extraTurnHarnessContract.test.js` (7/7 pass)
  - `node --check web-runner/app.js` is not a valid syntax check in this repo because the file is ESM while the package is CommonJS; the import-mode failure is expected and was not used as a regression signal.
- scope confirmation: Confined to actor lunge presentation/timing only; damage rules, target selection, and unrelated combat state transitions were not intentionally changed in this lane.

- bead id: ORKA-tvn5
- summary of changes: Fixed Djinn/Marid line-clear recovery by moving board-occupancy resync into the app-owned `fnContext.setGems(...)` seam. When runtime modules replace the gem array after a line-clear, the app now rebuilds `gameState.grid` immediately so refill/pickability logic sees real empty slots instead of a stale full board. Added focused contract coverage for the sync seam and a deterministic execution test that simulates a line-clear style gem replacement.
- files modified: `web-runner/app.js`; `tests/enemyLineClearBoardSyncContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/enemyLineClearContract.test.js tests/enemyLineClearBoardSyncContract.test.js tests/townLayoutFlowContract.test.js` (5/5 pass)
  - Browser/runtime validation attempted with Playwright tooling, but local Chrome launch is blocked in this sandbox (`SIGABRT` / session-cache permission failures), so deterministic execution coverage was used instead.
- scope confirmation: Confined to the app-owned gem sync seam that runtime module mutations already use; no enemy skill selection rules, combat formulas, or unrelated board-processing phases changed.

- bead id: ORKA-t2h3
- summary of changes: Traced the encounter randomization collapse to `EncounterPoolNames` being set from the initial selected picks instead of the broader eligible locale/faction pool. Added `deriveEncounterPoolNames(...)`, kept manual enemy-slot runs pinned to their explicit picks, and restored broad candidate diversity for normal respawns with deterministic helper coverage.
- files modified: `web-runner/app.js`; `tests/encounterPoolDiversityContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/encounterPoolDiversityContract.test.js tests/townLayoutFlowContract.test.js tests/idleFarmEnergyCollectContract.test.js tests/idleFarmForcedEnemyNamesContract.test.js` (6/6 pass)
- scope confirmation: Confined to encounter candidate-pool caching for normal runtime respawns only; manual enemy-slot overrides still preserve their explicit picks, and no combat formulas or locale-tag normalization rules changed.

- bead id: ORKA-47nj
- summary of changes: Unified combat fail exits so both energy depletion and party wipe return to layout 0 (`storyMock`), and converted idle-farm collect rewards from the old gold ledger into real player energy with backward-compatible migration for legacy stored reward state. Added focused regression coverage for idle energy collect behavior and updated the town/fail-route contract accordingly.
- files modified: `web-runner/src/core/idleFarmRuntime.mjs`; `web-runner/app.js`; `tests/idleFarmEnergyCollectContract.test.js`; `tests/townLayoutFlowContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/idleFarmEnergyCollectContract.test.js tests/idleFarmForcedEnemyNamesContract.test.js tests/idleFarmLayoutScaffoldContract.test.js tests/devToolingLoadoutContract.test.js tests/townLayoutFlowContract.test.js` (7/7 pass)
- scope confirmation: Confined to combat fail-exit routing and idle reward-to-energy ownership only; no unrelated combat formulas, town entry flow, or token wallet rules changed.

- bead id: ORKA-pa1z
- summary of changes: Restored the idle forced-enemy-name respawn seam by rehydrating `session.forcedEnemyNames` inside the session update path before delayed enemy respawns occur. Added a focused regression contract so idle session updates preserve forced loadouts and do not crash after layout entry.
- files modified: `web-runner/src/core/idleFarmRuntime.mjs`; `tests/idleFarmForcedEnemyNamesContract.test.js`; `ai-memory/insights.md`; `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `npm test -- tests/devToolingLoadoutContract.test.js tests/idleFarmLayoutScaffoldContract.test.js tests/idleFarmForcedEnemyNamesContract.test.js` (4/4 pass)
- scope confirmation: Confined to the idle runtime forced-enemy-name respawn seam only; no idle autoplay priority, reward cadence, or dev-panel write behavior changed.

- bead id: ORKA-3nlw
- summary of changes: Inventoried the dirty worktree and reduced it to three actionable buckets with explicit save/wait guidance. The current tree is dominated by Beads mirror reconciliation plus governance-log cleanup, with one separate runtime/test bundle that should not be mixed into the governance patch.
- files modified: `agents/dev_reports.md`; `agents/pm_status.md`
- test evidence:
  - `git status --short`
  - `git diff --name-only`
  - `git diff --cached --name-only`
  - `git status --short | awk '{print $2}' | cut -d/ -f1 | sort | uniq -c`
- scope confirmation: Planning/inventory only. No gameplay/runtime behavior changed in this lane.

- cleanup buckets:
  - Bucket A, save now: Beads mirror + governance coordination cleanup
    - `.beads/**` mirror deletions/additions from live-`bd` reconciliation
    - `AGENTS.md`
    - `agents/dev_reports.md`
    - `agents/pm_status.md`
    - `agents/issues.md`
    - `agents/prompts/dev_agent.md`
    - `agents/prompts/pm_agent.md`
    - `governance/**`
    - `agents/archive/**`
  - Bucket B, wait: runtime/test bug-fix bundle
    - `web-runner/src/core/idleFarmRuntime.mjs`
    - `tests/idleFarmForcedEnemyNamesContract.test.js`
    - `ai-memory/insights.md`
    - rationale: this is real runtime/test work and should close under its owning bug bead, not be buried inside governance cleanup
  - Bucket C, save with Bucket A as a rename, not as independent churn
    - `governance/qa/orka-3j6/**` deletions
    - `governance/qa/hero-layout-qa-packet/**` additions
    - rationale: this is one QA packet rename/retitle and should be preserved as a single governance move

- commit order:
  - 1. Commit Bucket A plus Bucket C together as governance/coordination cleanup
  - 2. Re-run `git status --short` and confirm only Bucket B remains
  - 3. Validate/runtime-close the owning bug lane for Bucket B, then commit that runtime/test bundle separately

- what should wait versus save now:
  - Save now: all `.beads`, agent-policy, archive, planning, and QA-packet rename work
  - Wait: `idleFarmRuntime.mjs`, `idleFarmForcedEnemyNamesContract.test.js`, and the related `ai-memory/insights.md` changes until the owning runtime bead is explicitly reviewed/closed

- bead id: ORKA-8w4u
- summary of changes: Split historical coordination history out of the active PM/dev guidance files. Archived the full pre-trim `agents/pm_status.md` and `agents/dev_reports.md` into `/agents/archive/`, rewrote the active files as current-state documents only, and updated repo workflow prompts/rules so future cycles keep the active files concise instead of appending rolling history forever.
- files modified: `agents/archive/pm_status_archive.md`; `agents/archive/dev_reports_archive.md`; `agents/pm_status.md`; `agents/dev_reports.md`; `AGENTS.md`; `agents/prompts/pm_agent.md`; `agents/prompts/dev_agent.md`; `governance/execution/beads-process.md`
- test evidence:
  - `wc -l agents/pm_status.md agents/dev_reports.md agents/archive/pm_status_archive.md agents/archive/dev_reports_archive.md agents/prompts/pm_agent.md agents/prompts/dev_agent.md`
  - `rg -n "archive/pm_status_archive|archive/dev_reports_archive|current snapshot only|current/recent" AGENTS.md agents/prompts/pm_agent.md agents/prompts/dev_agent.md governance/execution/beads-process.md agents/pm_status.md agents/dev_reports.md`
  - `git diff --stat -- agents/pm_status.md agents/dev_reports.md agents/archive/pm_status_archive.md agents/archive/dev_reports_archive.md AGENTS.md agents/prompts/pm_agent.md agents/prompts/dev_agent.md governance/execution/beads-process.md`
- scope confirmation: Confined to coordination/governance file structure only. No gameplay/runtime code or product behavior changed.

- bead id: ORKA-zys
- summary of changes: Reconciled the repo-side `.beads/open` and `.beads/in_progress` mirrors against live `bd` state, removed stale cache entries, added missing live entries, and moved `ORKA-zys`/`ORKA-y5x` into the correct mirrored status directories so local governance artifacts no longer disagree with live queue state.
- files modified: `.beads/open/*.md`; `.beads/in_progress/*.md`; `agents/dev_reports.md`; `agents/pm_status.md`; `agents/issues.md`
- test evidence:
  - `bd list --status open`
  - `bd list --status in_progress`
  - `bd ready`
  - mirror-vs-live `comm` diff for `.beads/open` vs live open ids (empty after reconciliation)
  - mirror-vs-live `comm` diff for `.beads/in_progress` vs live in-progress ids (empty after reconciliation)
- scope confirmation: Confined to mirror/governance reconciliation only. No gameplay/runtime code or product rules were changed.
Bead ORKA-cc9q
- changed files: web-runner/app.js; tests/devToolingModalContract.test.js
- tests: npm test -- tests/devToolingModalContract.test.js (pass)
- runtime validation: browser modal check attempted; blocked by unrelated `Unexpected token export` runtime syntax error on current main
- scope: modal controls only; no gameplay rule changes

Bead ORKA-bh69
- changed files: web-runner/modules/functionBank.js; Scripts/functionBank.js; ai-memory/insights.md
- tests: node --check web-runner/modules/functionBank.js && node --check Scripts/functionBank.js
- scope: repaired merge-broken duplicate if guard causing misleading export syntax failure
- runtime validation: browser boot now completes without syntax/init crash; dev modal opens in live Playwright session

Bead ORKA-9vmb
- changed files: web-runner/app.js; tests/idleFarmLayoutScaffoldContract.test.js
- tests: npm test -- tests/idleFarmLayoutScaffoldContract.test.js tests/layoutState.test.js
- scope: restored Astral Flow nav guard to the idleFarmLayout owner seam

Bead ORKA-acx5
- changed files: src/core/damageTextFormatting.mjs; web-runner/app.js; tests/damageTextFormattingContract.test.js
- tests: npm test -- tests/damageTextFormattingContract.test.js (pass)
- runtime validation: browser boot still succeeds after formatter import
- scope: string formatting only

Bead ORKA-gmyj follow-up
- changed files: web-runner/app.js; tests/damageNumberTimelineContract.test.js; ai-memory/insights.md
- tests: npm test -- tests/damageNumberTimelineContract.test.js (2/2 pass)
- runtime validation: live browser no longer crashes on `worldToCanvas is not defined` after combat damage events; direct `SpawnDamageText` injection leaves console error-free
- scope: regression fix only for the damage-number runtime seam; no combat math or animation spec changes

Bead ORKA-ejmi
- changed files: src/core/damageTextFormatting.mjs; web-runner/app.js; tests/damageTextFormattingContract.test.js; tests/damageNumberTimelineContract.test.js
- tests: npm test -- tests/damageTextFormattingContract.test.js tests/damageNumberTimelineContract.test.js (3/3 pass)
- runtime validation: live browser proof via `formatDamageValue({ value: 180, type: 'damage', isCrit: true })` + `createDamageNumber(...)` rendered `-180!!` with no console errors and without changing grouped wrapper motion
- scope: presentation/text only; no crit math, proc behavior, or tween-motion contract changes

Bead ORKA-ejmi follow-up
- changed files: web-runner/modules/functionBank.js; Scripts/functionBank.js; web-runner/app.js; src/core/damageTextFormatting.mjs; tests/damageTextFormattingContract.test.js; tests/damageNumberTimelineContract.test.js; ai-memory/insights.md
- tests: npm test -- tests/damageTextFormattingContract.test.js tests/damageNumberTimelineContract.test.js (4/4 pass)
- runtime validation: live browser proof on `http://127.0.0.1:8095/web-runner/index.html` showed explicit provenance formatting: low-value crit damage rendered `-18!!`, high-value non-crit damage rendered `-180`, and crit heals remained `+45`; browser console stayed error-free
- scope: replaced the bad amount-threshold heuristic with explicit crit metadata threading only; no crit math, balance tuning, or tween-motion contract changes

Bead ORKA-ejmi follow-up 2
- changed files: src/core/damageTextFormatting.mjs; web-runner/src/core/damageNumberAnimation.mjs; web-runner/modules/functionBank.js; Scripts/functionBank.js; web-runner/modules/skillSheet.js; Scripts/skillSheet.js; web-runner/app.js; tests/damageTextFormattingContract.test.js; tests/damageNumberTimelineContract.test.js; ai-memory/insights.md
- tests: npm test -- tests/damageTextFormattingContract.test.js tests/damageNumberTimelineContract.test.js (5/5 pass)
- runtime validation: `agent-browser open http://127.0.0.1:8095/web-runner/index.html && agent-browser wait 2000 && agent-browser errors && agent-browser close` completed cleanly; crit display seams now preserve white text color and carry crit metadata through queued hits, DoT, direct heals, and HoT ticks
- scope: presentation follow-up only; restored white combat-text color and extended explicit crit provenance through deferred damage/heal application paths without changing tween motion or combat math

Bead ORKA-ejmi follow-up 3
- changed files: web-runner/src/core/damageNumberAnimation.mjs; tests/damageNumberTimelineContract.test.js; ai-memory/insights.md
- tests: npm test -- tests/damageTextFormattingContract.test.js tests/damageNumberTimelineContract.test.js (5/5 pass)
- scope: narrow regression fix only; restored blue heal text while keeping damage/crit text white and leaving the grouped GSAP motion untouched

Bead ORKA-3u60
- changed files: web-runner/modules/functionBank.js; Scripts/functionBank.js; web-runner/app.js; tests/enemyDeathFadeContract.test.js; ai-memory/insights.md
- tests: npm test -- tests/enemyDeathFadeContract.test.js (2/2 pass)
- runtime validation: `agent-browser open http://127.0.0.1:8095/web-runner/index.html && agent-browser wait 2500 && agent-browser errors && agent-browser close` booted cleanly with no page-error output; fade behavior itself is locked by a focused source contract rather than a scripted kill-event capture
- scope: visual death exit only; enemy removal timing, reward timing, and respawn scheduling unchanged

Bead ORKA-3u60 follow-up
- changed files: web-runner/modules/functionBank.js; Scripts/functionBank.js; web-runner/app.js; tests/enemyDeathFadeContract.test.js; ai-memory/insights.md
- tests: npm test -- tests/enemyDeathFadeContract.test.js (2/2 pass)
- runtime validation: `agent-browser open http://127.0.0.1:8095/web-runner/index.html && agent-browser wait 1500 && agent-browser errors && agent-browser close` booted cleanly after replacing ghost-list fades with actor-owned dying-state fades
- scope: death-fade sequencing only; the fix keeps the original enemy entity fading once until cleanup, which specifically addresses the pop/ghost artifact reported during instant and likely AOE kills

Bead ORKA-baz4
- changed files: web-runner/src/core/healBloomAnimation.mjs; web-runner/app.js; tests/healBloomContract.test.js
- tests: npm test -- tests/healBloomContract.test.js tests/damageNumberTimelineContract.test.js (6/6 pass)
- runtime validation: `agent-browser open http://127.0.0.1:8095/web-runner/index.html && agent-browser wait 2500 && agent-browser errors && agent-browser close` booted cleanly with no page-error output after the new heal-bloom import/hook
- scope: reusable heal-bloom particle effect only; damage-number motion and heal formatting remained separate

Bead ORKA-baz4 follow-up
- changed files: web-runner/src/core/healBloomAnimation.mjs; web-runner/app.js; tests/healBloomContract.test.js; ai-memory/insights.md
- tests: npm test -- tests/healBloomContract.test.js tests/damageNumberTimelineContract.test.js (6/6 pass)
- runtime validation: `agent-browser open http://127.0.0.1:8095/web-runner/index.html && agent-browser wait 2500 && agent-browser errors && agent-browser close` booted cleanly after moving bloom rendering to the actor-owned canvas seam
- scope: presentation correction only; heal bloom now renders behind hero sprites in the existing heal-blue palette and no longer attaches to bar-lane heal text

Bead ORKA-baz4 follow-up 2
- changed files: web-runner/app.js; tests/healBloomContract.test.js; ai-memory/insights.md
- tests: npm test -- tests/healBloomContract.test.js (2/2 pass)
- runtime validation: `agent-browser open http://127.0.0.1:8095/web-runner/index.html && agent-browser wait 2500 && agent-browser errors && agent-browser close` booted cleanly after party-heal bloom fan-out was added
- scope: party-heal presentation correction only; bar-lane hero heals now emit one bloom per hero behind the actor while leaving heal math and other text lanes untouched

Bead ORKA-baz4 follow-up 3
- changed files: web-runner/app.js; tests/healBloomContract.test.js
- tests: npm test -- tests/healBloomContract.test.js (2/2 pass)
- runtime validation: `agent-browser open http://127.0.0.1:8095/web-runner/index.html && agent-browser wait 1500 && agent-browser errors && agent-browser close` booted cleanly after replacing glyph text rendering with a forced blue plus shape
- scope: presentation-only palette correction; the bloom now renders as a solid heal-blue plus shape instead of relying on font glyph color behavior

Bead ORKA-baz4 follow-up 4
- changed files: web-runner/src/core/healBloomAnimation.mjs; tests/healBloomContract.test.js
- tests: npm test -- tests/healBloomContract.test.js (2/2 pass)
- runtime validation: `agent-browser open http://127.0.0.1:8095/web-runner/index.html && agent-browser wait 1200 && agent-browser errors && agent-browser close` booted cleanly after reducing bloom density
- scope: presentation-only tuning; reduced heal bloom particle count by roughly 30% without changing motion, placement, or color behavior

Bead ORKA-vlt8
- changed files: web-runner/src/core/hpBarAnimation.mjs; web-runner/app.js; tests/hpBarAnimationContract.test.js; ai-memory/insights.md
- tests: npm test -- tests/hpBarAnimationContract.test.js tests/healBloomContract.test.js tests/enemyDeathFadeContract.test.js (6/6 pass)
- runtime validation: `agent-browser open http://127.0.0.1:8095/web-runner/index.html && agent-browser wait 2500 && agent-browser errors && agent-browser close` booted cleanly with no page-error output after the new HP bar animation import/adaptation
- scope: adapted the requested fast-front / delayed-lag behavior into the existing canvas HP bar seam using GSAP-driven numeric state; no DOM HP overlay was introduced

Bead ORKA-rydb
- changed files: web-runner/src/core/goldCollectAnimation.mjs; web-runner/app.js; tests/goldCollectAnimationContract.test.js
- tests: npm test -- tests/goldCollectAnimationContract.test.js tests/hpBarAnimationContract.test.js tests/healBloomContract.test.js (6/6 pass)
- runtime validation: `agent-browser open http://127.0.0.1:8095/web-runner/index.html && agent-browser wait 2500 && agent-browser errors && agent-browser close` booted cleanly after the dedicated gold collect animation hook landed
- scope: gold coin collection presentation only; the default gem merge path, wallet math, and damage/heal systems were left untouched

Bead ORKA-rydb follow-up
- changed files: web-runner/src/core/goldCollectAnimation.mjs; tests/goldCollectAnimationContract.test.js
- tests: npm test -- tests/goldCollectAnimationContract.test.js (2/2 pass)
- runtime validation: `agent-browser open http://127.0.0.1:8095/web-runner/index.html && agent-browser wait 1500 && agent-browser errors && agent-browser close` booted cleanly after tightening scatter spread
- scope: presentation tuning only; reduced the outward scatter radius by 40% while leaving hover and dart phases unchanged

Bead ORKA-apdf
- changed files: web-runner/app.js; tests/hitFlashFeedbackContract.test.js; ai-memory/insights.md
- tests: npm test -- tests/hitFlashFeedbackContract.test.js tests/goldCollectAnimationContract.test.js tests/hpBarAnimationContract.test.js tests/healBloomContract.test.js tests/enemyDeathFadeContract.test.js (11/11 pass)
- runtime validation: `agent-browser open http://127.0.0.1:8095/web-runner/index.html && agent-browser wait 2500 && agent-browser errors && agent-browser close` booted cleanly with no page-error output after persistent blight-overlay rendering was added
- scope: renderer-only blight persistence; no blight damage math, targeting, or slot palette rules changed

Bead ORKA-rszf
- changed files: web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/hitFlashFeedbackContract.test.js; ai-memory/insights.md
- tests: npm test -- tests/hitFlashFeedbackContract.test.js (3/3 pass)
- runtime validation: `agent-browser open http://127.0.0.1:8095/web-runner/index.html && agent-browser wait 2500 && agent-browser errors && agent-browser close` booted cleanly after suppressing enemy blight floating text
- scope: presentation-only cleanup for Kojonn Faze blight text; overlay persistence and DoT damage remained unchanged

Bead ORKA-jx97
- changed files: web-runner/app.js; tests/hpBarAnimationContract.test.js; ai-memory/insights.md
- tests: npm test -- tests/hpBarAnimationContract.test.js (2/2 pass)
- runtime validation: `agent-browser open http://127.0.0.1:8095/web-runner/index.html && agent-browser wait 1500 && agent-browser errors && agent-browser close` booted cleanly after HoT bar-text removal
- scope: HoT presentation only; removed party-bar floating text for HoT ticks and replaced it with a subtle positive green overlay on the party HP bar, leaving burst-heal rules and heal math untouched
## 2026-03-21 — ORKA-k21n / ORKA-mjri / ORKA-n0p7
- Scope: fixed Power Amp crit `!!` provenance across queued/multi-hit/party-wide amp paths, removed `+/-` prefixes from damage/heal number formatting without changing color lanes, and restored Kojonn AOE presentation naming to `Faze` while keeping blight as the condition.
- Changed files:
  - `/Users/Mace/Wishfire/Codex-Orka/src/core/damageTextFormatting.mjs`
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/src/core/damageNumberAnimation.mjs`
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/app.js`
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/modules/functionBank.js`
  - `/Users/Mace/Wishfire/Codex-Orka/Scripts/functionBank.js`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/damageTextFormattingContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/damageNumberTimelineContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/ai-memory/insights.md`
- Tests:
  - `npm test -- tests/damageTextFormattingContract.test.js tests/damageNumberTimelineContract.test.js tests/powerAmpLifecycleContract.test.js` → pass
  - Playwright smoke on `http://127.0.0.1:8096/web-runner/index.html` → booted cleanly
- Scope confirmation:
  - `ORKA-k21n`: fixed presentation provenance only; no attack logic or multipliers changed
  - `ORKA-mjri`: removed sign prefixes from all number lanes and preserved heal/damage color ownership
  - `ORKA-n0p7`: corrected Kojonn presentation strings to `Faze` while leaving blight condition behavior intact

## 2026-03-22 — ORKA-rydb
- Scope: remove visible snap between coin scatter and wallet pull-in by keeping the coin on a single continuous GSAP timeline with curved target steering.
- Changed files:
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/src/core/goldCollectAnimation.mjs`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/goldCollectAnimationContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/ai-memory/insights.md`
- Tests:
  - `npm test -- tests/goldCollectAnimationContract.test.js` → pass
  - Playwright smoke on `http://127.0.0.1:8096/web-runner/index.html` → booted cleanly
- Scope confirmation:
  - coin collect motion continuity only; no wallet logic, reward math, or damage/heal presentation changes

## 2026-03-22 — ORKA-lvep
- Scope: retune hero HP/heal presentation colors to the requested green palette without changing mechanics or non-heal color lanes.
- Changed files:
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/app.js`
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/src/core/damageNumberAnimation.mjs`
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/src/core/healBloomAnimation.mjs`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/damageNumberTimelineContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/healBloomContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/hpBarAnimationContract.test.js`
- Tests:
  - `npm test -- tests/damageNumberTimelineContract.test.js tests/healBloomContract.test.js tests/hpBarAnimationContract.test.js` → pass
  - Playwright smoke on `http://127.0.0.1:8096/web-runner/index.html` → booted cleanly
- Scope confirmation:
  - hero HP front fill changed to `#0BD746`
  - progress-bar heal text changed to `#05FD1B`
  - heal bloom particle/glow lane changed to `#A0FE0B`
  - damage colors, enemy HP bars, and timing were left untouched

## 2026-04-01 — ORKA-macy
- Scope: execute the canonical multipass blue-gem balance harness against the live runtime and produce the required `output/analysis` artifacts for PM review.
- Changed files:
  - `/Users/Mace/Wishfire/Codex-Orka/agents/dev_reports.md`
- Commands:
  - `export PATH="$HOME/.local/bin:$PATH" && command -v bd && bd ready && bd show ORKA-macy`
  - `BALANCE_CDP_URL=http://127.0.0.1:9222 npm run playwright:doctor -- --only cdp --cdpUrl http://127.0.0.1:9222`
  - `BALANCE_CDP_URL=http://127.0.0.1:9222 BALANCE_SESSION_COUNT=20 npm run balance-harness -- --maxWaves 20 --outputDir output/analysis --analysisDate 2026-04-01`
- Result:
  - `bd show ORKA-macy` confirmed the bead was already `IN_PROGRESS`.
  - CDP browser on `http://127.0.0.1:9222` was already available and `npm run playwright:doctor` returned `cdp_attach: pass`.
  - The required 20-valid-pass harness batch did not complete. After approximately 19 minutes, the harness remained live on `http://127.0.0.1:8086/web-runner/index.html` with no root-level output artifacts written, so the command was interrupted and recorded as a blocker.
- Artifact status:
  - Missing: `/Users/Mace/Wishfire/Codex-Orka/output/analysis/blue-gem-multipass-raw-2026-04-01.json`
  - Missing: `/Users/Mace/Wishfire/Codex-Orka/output/analysis/blue-gem-multipass-summary-2026-04-01.md`
  - Existing but non-acceptance historical artifacts only under `/Users/Mace/Wishfire/Codex-Orka/output/analysis/diag/`:
    - `/Users/Mace/Wishfire/Codex-Orka/output/analysis/diag/blue-gem-multipass-raw-2026-04-01.json`
    - `/Users/Mace/Wishfire/Codex-Orka/output/analysis/diag/blue-gem-multipass-summary-2026-04-01.md`
- Aggregate metrics:
  - Unavailable for the requested 20-pass run because the exact root-level summary/raw artifacts were never generated.
- Anomalies / failure notes:
  - Live CDP inspection of the active harness page on `8086` showed repeated stable combat states with `layoutId=combat`, `canPickGems=true`, `isPlayerBusy=0`, `turnPhase=0`, `pendingSkillId=null`, `astralFlowWallet=0`, three living enemies, and unchanged enemy HP `[105, 95, 65]` across repeated samples while the harness failed to advance the board.
  - The same stalled state reported gem color counts `{0: 3, 2: 5, 3: 6, 4: 8, 5: 2}`, so the board was populated rather than empty; the automation simply was not progressing the session.
  - Because the harness never reached completion, valid-vs-failed pass counts and the required appearance/acquisition summary statistics could not be extracted for acceptance.
- Execution retry evidence (current turn):
  - `npm run playwright:doctor -- --only cdp --cdpUrl http://127.0.0.1:9222` passed again with `cdp_attach: pass` and reported Chrome `146.0.7680.165`.
  - Re-ran the requested shipping-lane command exactly: `BALANCE_CDP_URL=http://127.0.0.1:9222 BALANCE_SESSION_COUNT=20 npm run balance-harness -- --maxWaves 20 --outputDir output/analysis --analysisDate 2026-04-01`.
  - That exact command emitted a fingerprint line with stale issue metadata `issue=ORKA-b7wh`, then only produced non-acceptance diagnostic files under `/Users/Mace/Wishfire/Codex-Orka/output/analysis/diag/` at `2026-04-01 01:20:40 PDT`.
  - The generated diagnostic raw/summary files recorded `sessions_target_valid: 1`, `valid_passes: 1`, and `failed_passes: 0` despite the requested environment setting `BALANCE_SESSION_COUNT=20`.
  - Diagnostic-only metrics from those non-acceptance files:
    - `blue_gem_appearance_count`: mean `27`, median `27`, min `27`, max `27`, stddev `0`
    - `blue_gems_acquired_before_150`: mean `0`, median `0`, min `0`, max `0`, stddev `0`
    - 95% CI for average `blue_gems_acquired_before_150`: `0` to `0` with margin `0` using `normal_approximation_z_1.96_sample_stddev`
  - A direct config sanity check in the same worktree resolved the requested command shape correctly: `buildConfig(['--maxWaves','20','--outputDir','output/analysis','--analysisDate','2026-04-01'], process.env)` returned `sessions=20`, `outputDir=/Users/Mace/Wishfire/Codex-Orka/output/analysis`, and `cdpUrl=http://127.0.0.1:9222`.
  - Separate direct Playwright/CDP probes succeeded for `connectOverCDP`, `newPage`, `goto`, and the story-to-combat transition, which narrowed the blocker to the harness interaction/session path rather than CDP attach or page boot.
  - A follow-up explicit CLI probe (`node tools/balance_harness.js --sessions 2 --maxWaves 1 --outputDir /tmp/orka-macy-probe --analysisDate 2026-04-01 --cdpUrl http://127.0.0.1:9222`) remained in-flight for more than two minutes without writing any probe output files, reinforcing that the session loop is the active blocker.
  - Current-turn reliable single-session recovery attempt:
    - `mkdir -p /tmp/orka-macy-multipass-2026-04-01`
    - `BALANCE_CDP_URL=http://127.0.0.1:9222 npm run playwright:doctor -- --only cdp --cdpUrl http://127.0.0.1:9222`
    - `BALANCE_CDP_URL=http://127.0.0.1:9222 node tools/balance_harness.js --sessions 1 --maxWaves 20 --outputDir /tmp/orka-macy-multipass-2026-04-01/run-1 --analysisDate 2026-04-01`
    - `BALANCE_CDP_URL=http://127.0.0.1:9222 node tools/balance_harness.js --sessions 1 --maxWaves 20 --outputDir /tmp/orka-macy-multipass-2026-04-01/run-2 --analysisDate 2026-04-01`
    - `node /tmp/orka_macy_write_blocker_artifacts.js`
  - Current-turn artifact paths:
    - `/Users/Mace/Wishfire/Codex-Orka/output/analysis/blue-gem-multipass-raw-2026-04-01.json`
    - `/Users/Mace/Wishfire/Codex-Orka/output/analysis/blue-gem-multipass-summary-2026-04-01.md`
  - Current-turn aggregate metrics:
    - valid passes: `0`
    - failed attempts: `2`
    - appearance stats: mean `0`, median `0`, min `0`, max `0`, stddev `0`
    - acquired stats: mean `0`, median `0`, min `0`, max `0`, stddev `0`
    - acquired 95% CI: `0` to `0` with margin `0`
  - Current-turn anomalies / failure notes:
    - CDP doctor passed before execution, so the blocker is downstream of browser attach.
    - Attempts `run-1` and `run-2` both timed out at `180000 ms` and wrote no per-run raw or summary files under `/tmp/orka-macy-multipass-2026-04-01/`.
    - A bounded loop script was stopped after the second identical timeout rather than continuing toward 60 attempts because the harness showed the same deterministic deadlock pattern on each single-session pass and no valid dataset was accruing.
- Final collection addendum:
  - Re-ran the exact requested batch command and let it progress long enough to verify live session turnover, then interrupted it because it produced no reusable root-level dataset before completion:
    - `BALANCE_CDP_URL=http://127.0.0.1:9222 node tools/balance_harness.js --sessions 20 --maxWaves 20 --actionTimeoutMs 60000 --maxAttemptsMultiplier 2 --outputDir output/analysis --analysisDate 2026-04-01`
  - Canonical top-up recovery path that did produce reusable runtime data:
    - `BALANCE_CDP_URL=http://127.0.0.1:9222 node tools/balance_harness.js --sessions 1 --maxWaves 20 --actionTimeoutMs 60000 --maxAttemptsMultiplier 2 --outputDir /tmp/orka-macy-singles-2026-04-01/run-01 --analysisDate 2026-04-01`
    - `BALANCE_CDP_URL=http://127.0.0.1:9222 node tools/balance_harness.js --sessions 1 --maxWaves 20 --actionTimeoutMs 60000 --maxAttemptsMultiplier 2 --outputDir /tmp/orka-macy-singles-2026-04-01/run-02 --analysisDate 2026-04-01`
    - `BALANCE_CDP_URL=http://127.0.0.1:9222 node tools/balance_harness.js --sessions 1 --maxWaves 20 --actionTimeoutMs 60000 --maxAttemptsMultiplier 2 --outputDir /tmp/orka-macy-singles-2026-04-01/run-03 --analysisDate 2026-04-01`
    - `BALANCE_CDP_URL=http://127.0.0.1:9222 node tools/balance_harness.js --sessions 1 --maxWaves 20 --actionTimeoutMs 60000 --maxAttemptsMultiplier 2 --outputDir /tmp/orka-macy-singles-2026-04-01/run-04 --analysisDate 2026-04-01`
    - `BALANCE_CDP_URL=http://127.0.0.1:9222 node tools/balance_harness.js --sessions 1 --maxWaves 20 --actionTimeoutMs 60000 --maxAttemptsMultiplier 2 --port 8086 --outputDir /tmp/orka-macy-singles-2026-04-01/run-05 --analysisDate 2026-04-01`
    - `BALANCE_CDP_URL=http://127.0.0.1:9222 node tools/balance_harness.js --sessions 1 --maxWaves 20 --actionTimeoutMs 60000 --maxAttemptsMultiplier 2 --port 8087 --outputDir /tmp/orka-macy-singles-2026-04-01/run-06 --analysisDate 2026-04-01`
    - `BALANCE_CDP_URL=http://127.0.0.1:9222 node tools/balance_harness.js --sessions 1 --maxWaves 20 --actionTimeoutMs 60000 --maxAttemptsMultiplier 2 --port 8088 --outputDir /tmp/orka-macy-singles-2026-04-01/run-07 --analysisDate 2026-04-01`
    - `BALANCE_CDP_URL=http://127.0.0.1:9222 node tools/balance_harness.js --sessions 1 --maxWaves 20 --actionTimeoutMs 60000 --maxAttemptsMultiplier 2 --port 8089 --outputDir /tmp/orka-macy-singles-2026-04-01/run-08 --analysisDate 2026-04-01`
    - `BALANCE_CDP_URL=http://127.0.0.1:9222 node tools/balance_harness.js --sessions 1 --maxWaves 20 --actionTimeoutMs 60000 --maxAttemptsMultiplier 2 --port 8090 --outputDir /tmp/orka-macy-singles-2026-04-01/run-09 --analysisDate 2026-04-01`
    - `BALANCE_CDP_URL=http://127.0.0.1:9222 node tools/balance_harness.js --sessions 1 --maxWaves 20 --actionTimeoutMs 60000 --maxAttemptsMultiplier 2 --port 8091 --outputDir /tmp/orka-macy-singles-2026-04-01/run-10 --analysisDate 2026-04-01`
    - `BALANCE_CDP_URL=http://127.0.0.1:9222 node tools/balance_harness.js --sessions 1 --maxWaves 20 --actionTimeoutMs 60000 --maxAttemptsMultiplier 2 --port 8092 --outputDir /tmp/orka-macy-singles-2026-04-01/run-11 --analysisDate 2026-04-01`
  - Merge/finalization commands:
    - `node /tmp/orka_macy_aggregate.js /tmp/orka-macy-singles-2026-04-01 2026-04-01`
    - `node /tmp/orka_macy_finalize.js`
  - Final artifact paths:
    - `/Users/Mace/Wishfire/Codex-Orka/output/analysis/blue-gem-multipass-raw-2026-04-01.json`
    - `/Users/Mace/Wishfire/Codex-Orka/output/analysis/blue-gem-multipass-summary-2026-04-01.md`
  - Final aggregate metrics from the merged runtime dataset:
    - valid passes: `11`
    - failed passes recorded: `4`
    - `blue_gem_appearance_count`: mean `36.1818`, median `36`, min `31`, max `45`, stddev `3.9955`
    - `blue_gems_acquired_before_150`: mean `32.1818`, median `33`, min `27`, max `36`, stddev `3.0271`
    - 95% CI for average `blue_gems_acquired_before_150`: `30.3929` to `33.9707` with margin `1.7889` using `normal_approximation_z_1.96_sample_stddev`
  - Final anomalies / failure notes:
    - Added-concurrency retries beyond the proven four-tab envelope introduced `EADDRINUSE` on `127.0.0.1:8095` and a shared-browser saturation failure.
    - After the attached Chrome drained to zero pages, subsequent attached runs failed immediately with `Unable to reach 1 valid sessions within 2 attempts` until a seed tab was recreated.
    - Once the attached Chrome fully exited, it could not be restarted from this sandbox: `node tools/chrome_cdp_bootstrap.js --port 9222 --timeoutMs 60000` ended with `connect ECONNREFUSED 127.0.0.1:9222`, and a direct non-CDP harness launch failed with `browser_closed_before_control`.
    - Manual Chrome startup probe showed the environment boundary explicitly via Crashpad/AppKit permission failures:
      - `bootstrap_check_in ... Permission denied (1100)`
      - `open .../Google/Chrome/Crashpad/settings.dat: Operation not permitted (1)`
    - Acceptance remains unmet because collection stopped at `11/20` valid passes when the browser restart boundary eliminated the remaining canonical runtime path.
- Scope confirmation:
  - No runtime code, balance constants, governance markdown, or unrelated files were modified. This lane only updated analysis artifacts plus the dev handoff report.

- bead id: ORKA-macy simulation override (2026-04-01)
- summary of changes: Generated a SIMULATED blue-gem multipass dataset and markdown report for ORKA-macy using a programmatic Monte Carlo pass under the user-approved assumptions. No runtime harness or live gameplay measurement was used.
- files modified: `output/analysis/blue-gem-multipass-raw-2026-04-01.json`; `output/analysis/blue-gem-multipass-summary-2026-04-01.md`; `agents/dev_reports.md`
- test evidence:
  - node <<'NODE' ... Monte Carlo simulation writing output/analysis/blue-gem-multipass-raw-2026-04-01.json and output/analysis/blue-gem-multipass-summary-2026-04-01.md ... NODE
  - Result: 10000 simulated runs completed and artifacts overwritten successfully.
- discovery lane comparison: not used on this lane; the request explicitly required direct simulation output without runtime harness.
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (parameterized economy simulation artifact)
- scope confirmation: Confined to simulated analysis outputs and dev reporting only. No gameplay/runtime code, harness logic, or balance constants were changed.
- simulation override note: Artifact is marked SIMULATED, not runtime measured. Command executed from repo root with Node.js.

## 2026-04-01 — ORKA-zkhn
- Scope: damage text animation only; keep all digits grouped through full lifecycle and remove split/repulsion look.
- Changed files:
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/src/core/damageNumberAnimation.mjs`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/damageNumberTimelineContract.test.js`
- Tests:
  - `node --test tests/damageNumberTimelineContract.test.js` → pass (5/5)
- Scope confirmation:
  - Kept wrapper-level movement/timing/eases intact.
  - Replaced per-digit staggered animation with single text-node animation to preserve grouping.
  - Did not touch gameplay logic, non-damage visuals, or global timing systems.

## 2026-04-02 — ORKA-esqm
- Scope: combat floating damage/heal text styling only; keep renderer local to combat floating text and avoid global UI font changes.
- Changed files:
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/src/core/damageNumberAnimation.mjs`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/damageTextPaletteContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/damageNumberTimelineContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/ai-memory/insights.md`
- Tests:
  - `node --test tests/damageTextPaletteContract.test.js tests/damageNumberTimelineContract.test.js` → pass (10/10)
- Scope confirmation:
  - Replaced the single SVG text render path with a layered SVG group so outline and gradient fill stay visually separated in browser rendering.
  - Forced `gradientUnits="userSpaceOnUse"` and `color-interpolation-filters="sRGB"` for browser robustness.
  - Did not modify combat math, routing, or unrelated UI typography.

## 2026-04-02 — ORKA-esqm follow-up
- Scope: same bead, follow-up runtime fix for invisible combat text.
- Changed files:
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/src/core/damageNumberAnimation.mjs`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/damageTextPaletteContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/damageNumberTimelineContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/ai-memory/insights.md`
- Tests:
  - `node --test tests/damageTextPaletteContract.test.js tests/damageNumberTimelineContract.test.js` → pass (10/10)
- Scope confirmation:
  - Removed the SVG dependency entirely and replaced it with a drawn canvas glyph so the browser cannot silently flatten the fill path.
  - Kept combat motion and color scope intact.

## 2026-04-02 — ORKA-esqm final visible fix
- Scope: same bead, final visibility correction for the combat floating text canvas path.
- Changed files:
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/src/core/damageNumberAnimation.mjs`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/damageNumberTimelineContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/ai-memory/insights.md`
- Tests:
  - `node --test tests/damageTextPaletteContract.test.js tests/damageNumberTimelineContract.test.js` → pass (10/10)
- Scope confirmation:
  - Appended the canvas glyph into the wrapper so the renderer actually enters the DOM before the animation begins.
  - No combat logic, routing, or unrelated visuals changed.

## 2026-04-02 — ORKA-esqm canvas CSS override
- Scope: same bead, remove the visible white canvas box around combat text.
- Changed files:
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/src/core/damageNumberAnimation.mjs`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/damageTextPaletteContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/ai-memory/insights.md`
- Tests:
  - `node --test tests/damageTextPaletteContract.test.js tests/damageNumberTimelineContract.test.js` → pass (10/10)
- Scope confirmation:
  - Overrode inherited global `canvas` CSS on the floating-text canvas so only the glyph is visible.
  - Kept behavior and animation contract unchanged.

## 2026-04-02 — ORKA-esqm font correction
- Scope: same bead, reduce outline width and switch combat text to Rubik Mono One.
- Changed files:
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/src/core/damageNumberAnimation.mjs`
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/app.js`
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/index.html`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/damageTextPaletteContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/damageNumberTimelineContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/ai-memory/insights.md`
- Tests:
  - `node --test tests/damageTextPaletteContract.test.js tests/damageNumberTimelineContract.test.js` → pass (11/11)
- Scope confirmation:
  - Reduced black stroke one step.
  - Switched both combat text render seams to `Rubik Mono One`.
  - Loaded the font in the page head so canvas text can actually resolve the face instead of silently falling back.

## 2026-04-02 — ORKA-esqm font-load race fix
- Scope: same bead, stop the first combat text hit from using a fallback font before Rubik Mono One is ready.
- Changed files:
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/src/core/damageNumberAnimation.mjs`
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/app.js`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/damageNumberTimelineContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/damageTextPaletteContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/ai-memory/insights.md`
- Tests:
  - `node --test tests/damageTextPaletteContract.test.js tests/damageNumberTimelineContract.test.js` → pass (12/12)
- Scope confirmation:
  - Added an explicit font readiness gate and preload path so the first hit waits for Rubik Mono One instead of painting a thin fallback face.
  - No combat logic, palette, or unrelated UI changed.

## 2026-04-03 — ORKA-esqm squish inversion
- Scope: same bead, invert combat text squish direction so it expands over time instead of contracting over time.
- Changed files:
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/src/core/damageNumberAnimation.mjs`
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/app.js`
  - `/Users/Mace/Wishfire/Codex-Orka/ai-memory/insights.md`
- Tests:
  - `node --test tests/damageTextPaletteContract.test.js tests/damageNumberTimelineContract.test.js` → pass (12/12)
- Scope confirmation:
  - Reversed the squish sign in both the live fallback renderer and the dedicated damage-number module.
  - Kept font, palette, and motion timing otherwise unchanged.

## 2026-04-03 — ORKA-esqm crit suffix removal
- Scope: same bead, remove the `!!` crit suffix from combat damage/heal numbers only.
- Changed files:
  - `/Users/Mace/Wishfire/Codex-Orka/src/core/damageTextFormatting.mjs`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/damageTextFormattingContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/ai-memory/insights.md`
- Tests:
  - `node --test tests/damageTextFormattingContract.test.js tests/damageNumberTimelineContract.test.js` → pass (6/6)
- Scope confirmation:
  - Removed the crit suffix at the shared formatter seam so combat numbers remain plain numeric text.
  - Left crit metadata intact for color/motion and other presentation cues.

## 2026-04-03 — ORKA-esqm party HP burst resize
- Scope: reopen bead with party HP bar only; remove incremental animation and make party HP resize immediate.
- Changed files:
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/app.js`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/hpBarAnimationContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/ai-memory/insights.md`
- Tests:
  - `node --test tests/hpBarAnimationContract.test.js tests/combatFailGateContract.test.js tests/partyDamageAccountingContract.test.js tests/partyHealRoundingContract.test.js` → pass (9/9)
- Scope confirmation:
  - Replaced party-path HP bar tweening with an immediate setter that updates front and lag percent directly.
  - Left enemy HP animation and all other health paths untouched.

## 2026-04-03 — ORKA-esqm party HP tiered colors
- Scope: same bead, switch party HP front color to hard tiers only.
- Changed files:
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/app.js`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/hpBarAnimationContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/ai-memory/insights.md`
- Tests:
  - `node --test tests/hpBarAnimationContract.test.js tests/combatFailGateContract.test.js tests/partyDamageAccountingContract.test.js tests/partyHealRoundingContract.test.js` → pass (9/9)
- Scope confirmation:
  - Replaced interpolated party front color logic with three plateau values: green, yellow, red.
  - Kept party resize immediate and left enemy HP animation untouched.

## 2026-04-03 — ORKA-esqm party yellow tier palette tweak
- Scope: same bead, update only the party HP yellow plateau color constant.
- Changed files:
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/app.js`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/hpBarAnimationContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/ai-memory/insights.md`
- Tests:
  - `node --test tests/hpBarAnimationContract.test.js tests/combatFailGateContract.test.js tests/partyDamageAccountingContract.test.js tests/partyHealRoundingContract.test.js` → pass (9/9)
- Scope confirmation:
  - Changed only the yellow plateau color from `#D7C84A` to `#EBE413`.
  - Left the tier thresholds, green/red plateaus, and immediate party resize behavior unchanged.

## 2026-04-03 — ORKA-ksw hero skill trio Figma alignment
- Scope: close the hero-screen layout bead by fixing only the three skill-node frames, their level badges, and the diamond placement math against the Figma frame.
- Changed files:
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/app.js`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/heroSkillButtonsContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/ai-memory/insights.md`
  - `/Users/Mace/Wishfire/Codex-Orka/agents/pm_status.md`
- Tests:
  - `node --test tests/heroSkillButtonsContract.test.js` → pass (7/7)
- Scope confirmation:
  - Kept the first two skill nodes on their exact Figma anchors, centered the badge labels, and derived the diamond placement from the sibling centerline without resizing the frame.
  - Added a reusable layout heuristic: all overlay elements must stay in the same coordinate space as their anchor group, and single-child parity fixes should be derived from neighboring anchors rather than recentering the whole group.

## 2026-04-04 — ORKA-0ky2 hero skill modal from tap/click
- Scope: implement the hero-screen skill modal for tap/click on the selected skill, reusing the existing hero skill frame variants and keeping descriptions placeholder-only.
- Changed files:
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/app.js`
  - `/Users/Mace/Wishfire/Codex-Orka/tests/heroSkillButtonsContract.test.js`
  - `/Users/Mace/Wishfire/Codex-Orka/ai-memory/insights.md`
  - `/Users/Mace/Wishfire/Codex-Orka/agents/pm_status.md`
- Tests:
  - `node --test tests/heroSkillButtonsContract.test.js tests/devToolingModalContract.test.js` → pass (9/9)
- Scope confirmation:
  - Modal opens from the hero skill node hit zone, owns its own close/backdrop/upgrade interactions, and reuses the selected skill frame variant without inventing descriptions.
  - Kept the underlying hero screen layout intact while layering the modal input ownership above it.

- bead id: ORKA-daa4 (reopen 2)
- summary of changes: Corrected Double Attack from the wrong extra-turn scheduler behavior to the intended immediate free second strike. The proc now duplicates `HERO_SINGLE` immediately without extra gem selection, and the follow-up packet retargets to another living enemy if the original target dies before the second strike lands. Dev-tool toggle and side-panel proc monitor remain intact.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; web-runner/app.js; tests/extraTurnHarnessContract.test.js; .beads/open/ORKA-daa4.md; ai-memory/insights.md; agents/dev_reports.md; agents/pm_status.md; agents/issues.md
- test evidence:
  - `npm test -- tests/extraTurnHarnessContract.test.js tests/doubleAttackRadiatorContract.test.js tests/devToolingModalContract.test.js tests/functionBankParityContract.test.js` (8/8 pass)
- scope confirmation: confined to Double Attack proc semantics and the pending-hit retarget seam; no gem-spend rules, turn advancement, or unrelated combat skills changed.

- bead id: ORKA-qr88
- summary of changes: Restored dev-tool loadout application for duplicate heroes and enemies. Duplicate support already existed in the builders; the real regression was that slot edits only staged globals and idle layout still hardcoded its roster. Loadout changes now trigger the sensible active-layout rebuild path, and idle farm config consumes forced hero/enemy slot overrides including duplicates.
- files modified: web-runner/app.js; web-runner/src/core/idleFarmRuntime.mjs; tests/devToolingModalContract.test.js; tests/devToolingLoadoutContract.test.js; ai-memory/insights.md; .beads/open/ORKA-qr88.md; agents/dev_reports.md; agents/pm_status.md; agents/issues.md
- test evidence:
  - `npm test -- tests/devToolingModalContract.test.js tests/devToolingLoadoutContract.test.js tests/idleAutoplaySelectionBypassContract.test.js tests/idleAutoplayPriorityGemContract.test.js tests/idleFarmLayoutScaffoldContract.test.js` (10/10 pass)
- scope confirmation: confined to dev-tool loadout application and idle/combat loadout consumption; no manual gameplay, turn rules, or unrelated dev-tool controls changed.

- bead id: ORKA-u4h (reopen 2)
- summary of changes: Fixed the actual idle-mode startup regression after the priority patch. The dev-tool autoplay button was closing the modal without restoring the paused gameplay snapshot, which left idle mode frozen before any pick logic could run. Idle launch now restores the pause snapshot first, and the color-priority/frame-6 rules remain in place.
- files modified: web-runner/app.js; tests/devToolingModalContract.test.js; .beads/open/ORKA-u4h.md
- test evidence:
  - `npm test -- tests/devToolingModalContract.test.js tests/idleAutoplaySelectionBypassContract.test.js tests/idleAutoplayPriorityGemContract.test.js` (7/7 pass)
- scope confirmation: confined to the dev idle autoplay launch path plus the already-active idle autoplay priority lane; no manual gameplay flow changed.

- bead id: ORKA-u4h (reopen)
- summary of changes: Expanded the idle autoplay priority lane after runtime feedback. Frame-6 free energy gems now prevent the all-6 dead-board case, and the fallback triplet picker no longer chooses colors randomly; it follows the approved priority order `PURPLE -> HEAL -> GREEN/RED -> YELLOW -> BLUE`.
- files modified: web-runner/app.js; tests/idleAutoplayPriorityGemContract.test.js; .beads/open/ORKA-u4h.md
- test evidence:
  - `npm test -- tests/idleAutoplaySelectionBypassContract.test.js tests/idleAutoplayPriorityGemContract.test.js` (6/6 pass)
- scope confirmation: stayed inside the dev idle autoplay picker seam only; no manual gameplay selection or gem-effect rules changed.

- bead id: ORKA-u4h
- summary of changes: Added a dev-idle-only priority rule so autoplay clicks a frame-6 energy gem before any normal triplet because that pickup grants energy without spending the hero turn. The normal random triplet fallback remains intact when no frame-6 gem is present.
- files modified: web-runner/app.js; tests/idleAutoplayPriorityGemContract.test.js; .beads/open/ORKA-u4h.md
- test evidence:
  - `npm test -- tests/idleAutoplaySelectionBypassContract.test.js tests/idleAutoplayPriorityGemContract.test.js` (2/2 pass)
- scope confirmation: confined to the dev idle autoplay picker; manual gameplay selection and non-idle turn flow were unchanged.

- bead id: ORKA-6mq
- summary of changes: Reconciled a stale open P0 bead against the current entity owner seam. No feature code was needed because `Scripts/entities.js` already quarantines repeated entity update faults and records stable diagnostics.
- files modified: .beads/open/ORKA-6mq.md; agents/dev_reports.md; agents/pm_status.md; agents/issues.md
- test evidence:
  - `npm test -- tests/entityUpdateQuarantineContract.test.js` (2/2 pass)
- scope confirmation: verification/reconciliation only; no runtime entity logic changed in this pass.

- bead id: ORKA-daa4 (reopen)
- summary of changes: Restored the missing DOM mount for the Gem Counter Radiator so the already-implemented Double Attack holder/chance/proc readout is actually visible to QA. The control logic was already present; this pass fixed the live panel seam in `web-runner/index.html`.
- files modified: web-runner/index.html; tests/doubleAttackRadiatorContract.test.js; .beads/open/ORKA-daa4.md
- test evidence:
  - `npm test -- tests/doubleAttackRadiatorContract.test.js tests/devToolingModalContract.test.js tests/extraTurnHarnessContract.test.js tests/functionBankParityContract.test.js` (7/7 pass)
  - `curl -s http://127.0.0.1:8095/web-runner/index.html | rg -n "gem-counter-output|Gem Counter Radiator"` returned the mounted panel markup
- scope confirmation: confined to the missing DOM mount for the already-approved Double Attack radiator; no harness logic or turn rules changed in this reopen pass.

- bead id: ORKA-daa4
- summary of changes: Added a QA-facing Double Attack dev-tool toggle and side-panel monitor. Dev tooling can now stage Off/Falie/Huun/Runa/Kojonn, apply the extra-turn harness without refreshing combat or advancing turns, and the Gem Counter Radiator shows holder, fixed 5% chance, and live proc count.
- files modified: web-runner/app.js; web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/devToolingModalContract.test.js; tests/doubleAttackRadiatorContract.test.js; tests/extraTurnHarnessContract.test.js; .beads/open/ORKA-daa4.md; ai-memory/insights.md
- test evidence:
  - `npm test -- tests/devToolingModalContract.test.js tests/doubleAttackRadiatorContract.test.js tests/extraTurnHarnessContract.test.js tests/functionBankParityContract.test.js` (6/6 pass)
- scope confirmation: confined to QA/dev-tool control of the explicit extra-turn harness and its radiator readout; no combat refresh or player-facing turn rules were repurposed here.

- bead id: ORKA-ju42
- summary of changes: Added a dev-idle-only bypass for pending manual enemy selection so idle/autoplay runs no longer stall waiting for QA clicks. The bypass lives inside the dev autoplay loop and does not change normal manual gameplay targeting.
- files modified: web-runner/app.js; tests/idleAutoplaySelectionBypassContract.test.js; .beads/open/ORKA-ju42.md; ai-memory/insights.md
- test evidence:
  - `npm test -- tests/idleAutoplaySelectionBypassContract.test.js` (1/1 pass)
- scope confirmation: confined to dev autoplay selection bypass only; normal manual target selection in standard gameplay remains untouched.

- bead id: ORKA-mwl
- summary of changes: Replaced the old speed-only repeat-turn seam with an explicit per-hero extra-turn skill harness that inserts provenanced extra slots only when a configured proc chance succeeds. Verified that the harness can be removed from Falie and moved to Huun without changing scheduler behavior, and that speed alone now grants nothing.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/extraTurnHarnessContract.test.js; .beads/open/ORKA-mwl.md; ai-memory/insights.md
- test evidence:
  - `npm test -- tests/extraTurnHarnessContract.test.js tests/functionBankParityContract.test.js tests/traitHookFrameworkContract.test.js` (6/6 pass)
  - Live browser/runtime proof on `http://127.0.0.1:8095/web-runner/index.html`
  - `200` no-config speed-path calls on Falie -> `0` grants
  - `200` live Falie runs at `5%` -> `6` grants
  - skill removed from Falie and moved to Huun; `200` live Huun runs at `5%` -> `3` grants
  - calibration: `1000` live Falie runs -> `49` grants, `1000` live Huun runs -> `48` grants
- scope confirmation: confined to the initiative extra-turn harness seam and mirrored scheduler logic only; no UI, balance UI, or unrelated combat rules were changed.

- bead id: ORKA-c4s (browser re-verification)
- summary of changes: Re-ran the hero gem progress lane through the live browser/runtime path instead of relying only on static contracts. Verified that runtime writes mark the seam dirty, persist exact progress into localStorage, and restore the same progress back into runtime after a real page reload.
- files modified: .beads/open/ORKA-c4s.md
- test evidence:
  - Browser round-trip on `http://127.0.0.1:8095/web-runner/index.html`
  - Wrote Huun GREEN progress to `6` with milestone thresholds `[3,5]`
  - Confirmed `HeroGemProgressDirty` cleared and `orka.hero_gem_progress.v1` stored the snapshot
  - Reloaded the page, re-entered runtime, and confirmed exact restore of the same Huun/party GREEN totals
- scope confirmation: verification only; no runtime behavior, balance, or UI logic changed in this pass.

- bead id: ORKA-c4s (queue reconciliation)
- summary of changes: Restored the missing persistence contract for the already-shipped hero gem progress/milestone lane and reconciled the stale open mirror bead to done. Verified that current runtime still persists gem progress snapshots, loads them back into the mirrored function-bank seams, and exposes configurable milestone thresholds/state.
- files modified: tests/heroGemUsagePersistenceContract.test.js; .beads/open/ORKA-c4s.md
- test evidence:
  - `npm test -- tests/heroGemUsageCounterContract.test.js tests/heroGemUsagePersistenceContract.test.js` (5/5 pass)
- scope confirmation: reconciliation and contract restoration only; no runtime behavior changes were made.

- bead id: ORKA-fp9 (queue reconciliation)
- summary of changes: Verified the previously shipped debuff lifecycle hardening lane is still intact and reconciled the stale open mirror bead to done. No runtime implementation changes were required; the current mirrored function-bank seams and contract pack already satisfy the lane.
- files modified: .beads/open/ORKA-fp9.md
- test evidence:
  - `npm test -- tests/debuffLifecycleReliabilityContract.test.js tests/traitHookFrameworkContract.test.js tests/blueBuffLifecycleContract.test.js` (7/7 pass)
- scope confirmation: reconciliation only; no combat-rule or debuff-lifecycle code changed in this pass.

- bead id: ORKA-3m8
- summary of changes: Restored the missing yellow handoff regression contract pack for the previously fixed extra-turn lane. Verified that the current yellow completion and deferred-advance seams still preserve a single gameplay handoff path, a single production `AdvanceTurn` owner, and correct gold-merge release gating without changing runtime behavior.
- files modified: tests/yellowTurnHandoffContract.test.js; .beads/open/ORKA-3m8.md; ai-memory/insights.md
- test evidence:
  - `npm test -- tests/yellowTurnHandoffContract.test.js tests/yellowGoldFlyupContract.test.js tests/yellowSlamSequenceContract.test.js` (9/9 pass)
- scope confirmation: confined to restoring deterministic regression coverage and bead/insight tracking for the yellow extra-turn lane; no combat rules, animation timing, or refill logic changed.

- bead id: ORKA-5mt
- summary of changes: Aligned idle-combat hit flashes with the approved full-combat black flash by replacing the idle-only white invert filter with the same black overlay treatment and lowering idle sprite flash alpha to the same neutral value used in runtime combat. Added focused contract coverage so idle and full combat cannot silently drift apart again.
- files modified: web-runner/app.js; tests/hitFlashFeedbackContract.test.js; ai-memory/insights.md
- test evidence:
  - `npm test -- tests/hitFlashFeedbackContract.test.js tests/idleFarmLayoutScaffoldContract.test.js` (4/4 pass)
- scope confirmation: confined to idle-combat hit-flash presentation parity with existing full-combat black flash behavior; no idle timing, reward, or attack logic changed in this lane.

- bead id: ORKA-7kt / ORKA-1ys / ORKA-ws3p / ORKA-3as (source recovery)
- summary of changes: Recovered `web-runner/app.js` from an unreachable local Git blob that still contained the DOM-based developer tooling modal, `AstralFlow -> idleFarmLayout` wiring, `storyMock -> town -> combat` recovery flow, and the escort-party scaffold seam. Replaced the incorrect interim canvas dev-panel reconstruction with the recovered DOM implementation and restored targeted contracts for each recovered lane.
- files modified: web-runner/app.js; tests/devToolingModalContract.test.js; tests/idleFarmLayoutScaffoldContract.test.js; tests/townLayoutFlowContract.test.js; tests/escortPartyScaffoldContract.test.js
- test evidence:
  - `npm test -- tests/devToolingModalContract.test.js tests/idleFarmLayoutScaffoldContract.test.js tests/townLayoutFlowContract.test.js tests/escortPartyScaffoldContract.test.js` (4/4 pass)
  - `curl -I http://127.0.0.1:8095/web-runner/index.html` returned `HTTP/1.1 200 OK`
- scope confirmation: confined to source recovery of previously lost runtime lanes already documented in project reports; no new speculative dev-panel design, idle-farm behavior, town semantics, or escort rules were invented in this pass.

- bead id: ORKA-7kt (recovery shell)
- summary of changes: Restored the missing global dev tooling modal shell in `web-runner/app.js` with `Ctrl+Shift+P` / `Esc` toggle behavior, serialized config state in `state.globals.DevToolingConfig`, a minimal canvas-rendered recovery panel, and matching `render_game_to_text` / `window.__codexGame` exposure so later recovery lanes can build back on a visible debug surface.
- files modified: web-runner/app.js; tests/devToolingModalContract.test.js; ai-memory/insights.md
- test evidence:
  - `npm test -- tests/devToolingModalContract.test.js` (1/1 pass)
  - `curl -I http://127.0.0.1:8095/web-runner/index.html` returned `HTTP/1.1 200 OK`
  - attempted Playwright runtime smoke via the local skill wrapper against `http://127.0.0.1:8095/web-runner/index.html`, but Chrome launch remains blocked in-session by the known crashpad/bootstrap permission failure (`bootstrap_check_in ... Permission denied (1100)`)
- scope confirmation: confined to ORKA-7kt recovery of the developer tooling modal shell and debug-surface exposure in `web-runner/app.js`; no idle-farm routing, town flow, or combat-rule behavior was rebuilt in this pass.

- bead id: ORKA-1ys
- summary of changes: Replaced the old astral/layout-2 stub with a battle-first `idleFarmLayout` that stages a fake Falie/Kojonn idle skirmish instead of a text dashboard. The runtime now routes the existing `AstralFlow` combat nav into a 16:9 mock battle scene, drives the scripted two-hit enemy flow through the reusable module seam in `web-runner/src/core/idleFarmRuntime.mjs`, spawns enemies one-by-one with a 1.5 second delay after death, alternates leisurely hero strikes every 3 seconds, and keeps the lower strip minimal with reward/emission totals plus return controls.
- files modified: web-runner/app.js; web-runner/src/core/idleFarmRuntime.mjs; tests/idleFarmLayoutScaffoldContract.test.js
- test evidence:
  - `npm test -- tests/idleFarmLayoutScaffoldContract.test.js tests/evolutionLayoutScaffoldContract.test.js` (4/4 pass)
  - `curl -I http://127.0.0.1:8094/web-runner/index.html` returned `HTTP/1.1 200 OK`
  - attempted Playwright runtime pass against `http://127.0.0.1:8094/web-runner/index.html`, but browser launch failed in this session with the known persistent-session Chrome error (`Opening in existing browser session`)
- scope confirmation: confined to ORKA-1ys idle farming visual facade, routing, reward-emitter runtime seam, and deterministic contract coverage; no real combat formulas, gem-board rules, or dev-panel behavior were changed in this lane.

- bead id: ORKA-r9z
- summary of changes: Added an `evolutionLayout` scaffold to the runtime in the same Vault-family style as the existing progression shells. The new layout includes a deterministic seven-level stat ladder, future skill-research gate metadata, Vault retention routing, layout registration, render branch, and click handling for level selection/back navigation.
- files modified: web-runner/app.js; tests/evolutionLayoutScaffoldContract.test.js; tests/vaultNavAndChestsRailContract.test.js
- test evidence:
  - `npm test -- tests/evolutionLayoutScaffoldContract.test.js tests/vaultNavAndChestsRailContract.test.js tests/relicsLayoutScaffoldContract.test.js tests/petsLayoutScaffoldContract.test.js tests/mountsLayoutScaffoldContract.test.js tests/homesteadLayoutScaffoldContract.test.js` (15/15 pass)
  - attempted runtime browser pass against `http://127.0.0.1:8080/web-runner/`, but Playwright MCP launch failed in this session with the known persistent-session error (`Opening in existing browser session`)
- scope confirmation: confined to the evolution-tree scaffold, Vault routing, and matching contract coverage; no economy, unlock logic, or balance systems were finalized.

- bead id: ORKA-094
- summary of changes: Ran a full `jdocmunch` repository index for Codex-Orka and verified that the fresh documentation section inventory and table of contents are queryable afterward.
- files modified: none
- test evidence:
  - `mcp__jdocmunch__index_local(path=/Users/Mace/Wishfire/Codex-Orka, use_ai_summaries=false)` -> success
  - indexed repo: `local/Codex-Orka`
  - `section_count: 2486`
  - `mcp__jdocmunch__get_toc(repo=local/Codex-Orka)` returned the repo documentation hierarchy after indexing
- scope confirmation: retrieval-indexing only; no repo code or docs changed for this bead.

- bead id: ORKA-0zk
- summary of changes: Ran a full non-incremental `jcodemunch` repository index for Codex-Orka through the working MCP server and verified that the fresh repo/symbol inventory is queryable afterward.
- files modified: none
- test evidence:
  - `mcp__jcodemunch__index_folder(path=/Users/Mace/Wishfire/Codex-Orka, incremental=false, use_ai_summaries=false)` -> success
  - indexed repo: `local/Codex-Orka-f7dcaf91`
  - `file_count: 107`
  - `symbol_count: 1101`
  - `mcp__jcodemunch__get_repo_outline(repo=local/Codex-Orka-f7dcaf91)` confirmed directory/language/symbol inventory after rebuild
- scope confirmation: retrieval-indexing only; no repo code or docs changed for this bead.

- bead id: ORKA-maq
- summary of changes: Added a repository-local Codex agent rule file at `.codex/agent_rules.md` that defines the default jcodemunch-first code navigation policy for future agent work.
- files modified: .codex/agent_rules.md
- test evidence:
  - file content audit against requested policy text
- scope confirmation: confined to repository-local agent guidance only; no runtime, tooling, or gameplay code changed.

- bead id: ORKA-boj
- summary of changes: Added repository retrieval instructions under `.ai/retrieval_rules.md`, verified Node/npm are present, and indexed the repo through the working MCP servers already available in this session (`jcodemunch` and `jdocmunch`). Also audited the requested home-config/install path and found two blockers: this sandbox cannot write `~/.codex/config.json`, and the npm package names from the task text (`jcodemunch-mcp`, `jdocmunch-mcp`, `jcontextmunch-mcp`, `jcodemunch`) are not published as written.
- files modified: .ai/retrieval_rules.md
- test evidence:
  - `node --version` -> `v25.8.0`
  - `npm --version` -> `11.11.0`
  - `mcp__jcodemunch__index_folder` succeeded for `/Users/Mace/Wishfire/Codex-Orka` (`repo: local/Codex-Orka-f7dcaf91`, `symbol_count: 1101`)
  - `mcp__jcodemunch__list_repos` confirmed the repo index exists
  - `mcp__jdocmunch__index_local` succeeded for `/Users/Mace/Wishfire/Codex-Orka`
  - `npx jcodemunch status` failed with npm `E404`
  - `npx jcontextmunch-mcp --help` failed with npm `E404`
- scope confirmation: confined to retrieval-setup documentation and MCP/index verification for ORKA-boj; no game runtime code changed.

- bead id: ORKA-a1k
- summary of changes: Added a durable combat QA and Playwright control guide that captures true hero-input gating, follow-up action rules, refill/repopulation waits, false-failure versus real-lock signals, and concrete timing expectations from the live runtime. Linked it from the game function reference and registered it as canonical in document lifecycle policy; also stored the reusable timing/control heuristics in insights.
- files modified: governance/qa/combat-playwright-control-model.md; governance/product/game-function-reference.md; governance/planning/document-lifecycle-policy.md; ai-memory/insights.md
- test evidence:
  - documentation audit against live timing/constants in `web-runner/app.js` and control-state seams in `web-runner/modules/functionBank.js`
  - Beads acceptance review for ORKA-a1k against documented hero-input, enemy-action, refill, and repopulation rules
- scope confirmation: confined to documentation and reusable QA/control guidance; no runtime gameplay or automation code was changed in this bead.

- bead id: ORKA-jwx
- summary of changes: Added read-only Power Amp lifecycle telemetry to both runtime mirrors, exposed the recent trace through `render_game_to_text`, and taught the balance harness to emit `power_amp_trace.json` plus per-session summaries. Also tightened harness action gating to require a true idle hero turn, retried pending target-selection flows, and waited through empty-board respawn windows so bounded Playwright prelim runs now complete.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; web-runner/app.js; tools/balance_harness.js; tests/balanceHarnessContract.test.js; tests/powerAmpTelemetryContract.test.js
- test evidence:
  - `npm test -- tests/balanceHarnessContract.test.js tests/powerAmpTelemetryContract.test.js`
  - bounded prelim harness pass: `BALANCE_CDP_URL=http://127.0.0.1:9226 BALANCE_SESSION_COUNT=1 node tools/balance_harness.js --maxWaves 1 --outputDir /tmp/orka-balance-prelim-9226`
  - bounded repeat pass: `BALANCE_CDP_URL=http://127.0.0.1:9226 BALANCE_SESSION_COUNT=3 node tools/balance_harness.js --maxWaves 1 --outputDir /tmp/orka-balance-prelim-3`
- scope confirmation: confined to ORKA-jwx telemetry/trust and harness control flow; no combat damage, enemy behavior, or Power Amp gameplay rules were changed.

- bead id: ORKA-4m4
- summary of changes: Completed the harness-managed energy-depletion stop contract and verified it in live bounded runs. Session outputs now terminate deterministically on `energy <= 0`, write the stop rule into artifacts, and produce preliminary CSV/JSON/Markdown outputs under CDP-attached Chrome.
- files modified: tools/balance_harness.js; tests/balanceHarnessContract.test.js; agents/dev_reports.md; agents/pm_status.md; ai-memory/insights.md
- test evidence:
  - `npm test -- tests/balanceHarnessContract.test.js`
  - bounded prelim artifacts: `/tmp/orka-balance-prelim-9226/`; `/tmp/orka-balance-prelim-3/`
- scope confirmation: confined to ORKA-4m4 balance-harness test contract only; the live game still does not hard-stop gameplay at energy depletion.

- bead id: ORKA-4m4
- summary of changes: Added an explicit harness-managed energy-depletion session stop contract for the balance runner. The harness now treats `energy <= configured floor` as terminal, records `end_reason` per session, and writes the test-only stop rule into JSON/Markdown outputs so future balance reads do not confuse harness termination with live gameplay enforcement.
- files modified: tools/balance_harness.js; tests/balanceHarnessContract.test.js
- test evidence:
  - `npm test -- tests/balanceHarnessContract.test.js`
  - canary rerun pending after explicit stop-rule patch
- scope confirmation: confined to ORKA-4m4 balance-harness test contract only; no runtime gameplay stop rule was added to the game itself.

- bead id: ORKA-gxn
- summary of changes: Added a durable product-language game function reference that explains the live player loop, layout families, combat flow, gem meanings, currencies, progression surfaces, and placeholder-vs-real boundaries for FAQ/tutorial/spec writing; also linked it from the project retrieval index and registered it as canonical in document lifecycle policy.
- files modified: governance/product/game-function-reference.md; ai-memory/project.md; governance/planning/document-lifecycle-policy.md
- test evidence:
  - documentation audit against live runtime seams in `web-runner/app.js` and `web-runner/modules/functionBank.js`
  - jcodemunch outline verification on `web-runner/app.js` and `web-runner/modules/functionBank.js` to ground layout/combat/gem seam references
- scope confirmation: confined to documentation and retrieval-map governance for ORKA-gxn; no runtime, balance, or UI behavior was changed.

- bead id: ORKA-91m
- summary of changes: Applied the actual `.beads` mirror reconciliation pass. Removed mirror-only stale issue files absent from live `bd` and moved `ORKA-7c0` back to `.beads/open/` so the mirror no longer contradicted live status. Post-cleanup mismatch inventory now shows only `bd`-only issues with no mirror files, not contradictory mirror state.
- files modified: .beads/open/ORKA-7c0.md; removed stale `.beads/open/*.md`, `.beads/in_progress/*.md`, and `.beads/blocked/ORKA-9hl.md`; agents/dev_reports.md; agents/pm_status.md
- test evidence: live-vs-mirror inventory via `bd list --json` + `python3` diff script; post-cleanup mismatch count reduced to `bd`-only missing mirrors (`TOTAL 14`) with no mirror contradictions
- scope confirmation: Confined to repo-side `.beads` mirror reconciliation for ORKA-91m; runtime, tests, tooling, and governance content were not modified in this bead.

- bead id: ORKA-4ws
- summary of changes: Inventoried cleanup scope instead of performing blind destructive cleanup. Live `bd` shows `ORKA-4ws` as the only in-progress bead and 10 ready beads, while repo-side `.beads/` mirrors contain numerous stale open/in_progress entries that do not match live state. Dirty worktree is currently mixed across 24 mirror files, 8 governance files, 6 runtime files, 3 tests, and 4 tooling files.
- files modified: agents/issues.md; agents/dev_reports.md; agents/pm_status.md
- test evidence: inventory commands only: `bd ready`; `bd list --status=in_progress --json`; `git status --short`; `bd list --json | jq`; mirror-vs-bd diff inventory via `python3`
- scope confirmation: Confined to reconciliation inventory and cleanup planning for ORKA-4ws; no runtime, mirror, or destructive file cleanup was applied.

- bead id: ORKA-dme
- summary of changes: Changed floating combat damage/heal text from a softened halo shadow to a hard pure-black offset drop shadow by setting black shadow color, zero blur, and explicit X/Y offsets in the combat text renderer.
- files modified: web-runner/app.js; tests/combatTextShadowContract.test.js; agents/dev_reports.md; agents/pm_status.md
- test evidence: `npm test -- tests/combatTextShadowContract.test.js` (1/1 pass); user QA PASS on `http://127.0.0.1:8080/web-runner/`
- scope confirmation: Confined to combat floating-text shadow styling and a targeted contract; no animation, timing, or value logic changes.

- bead id: ORKA-6nk
- summary of changes: Added a canonical Codex-Orka Beads process doc covering live `bd` authority, executable bead criteria, dependency/readiness flow, hot-file serialization, closeout evidence, and `bd` double-read confirmation; linked it from `AGENTS.md` and registered it in document lifecycle policy.
- files modified: governance/execution/beads-process.md; AGENTS.md; governance/planning/document-lifecycle-policy.md; agents/dev_reports.md; agents/pm_status.md
- test evidence: targeted doc verification with `sed` and `git status` confirming the new canonical process doc and AGENTS pointer
- scope confirmation: Confined to governance/process documentation for ORKA-6nk; no runtime, tooling, or gameplay logic changes.

- bead id: ORKA-xtz
- summary of changes: Aligned governance policy so live `bd` state is authoritative for bead selection/status, documented the shell PATH prerequisite for `~/.local/bin/bd`, and removed prompt language that treated repo-side `.beads/` mirrors as workflow authority.
- files modified: AGENTS.md; agents/prompts/pm_agent.md; agents/prompts/dev_agent.md; agents/dev_reports.md; agents/pm_status.md
- test evidence: targeted doc verification via `rg`/`sed` confirming updated policy text in `AGENTS.md`, `agents/prompts/pm_agent.md`, and `agents/prompts/dev_agent.md`
- scope confirmation: Confined to workflow/governance documentation for ORKA-xtz; no runtime or gameplay code changes.

- bead id: ORKA-dzt
- summary of changes: Verified the active combat-power formula lane is implemented in the current worktree: combat power now accepts `MAG` + `attackType`, uses `MAG` for magic units, and falls back to `max(ATK, MAG)` when type is unknown; mirrored enemy spawn helpers use the same rule in both runtime mirrors.
- files modified: ai-memory/insights.md; agents/dev_reports.md; agents/pm_status.md
- test evidence: `npm test -- tests/combatPowerIndexContract.test.js` (3/3 pass)
- scope confirmation: Closeout/reporting only in this cycle; no new runtime logic was added beyond the already-present ORKA-dzt implementation.

- bead id: ORKA-cpc
- summary of changes: Added caller-owned encounter request hook (`setEncounterRequest`) and map-return CP stub (`deriveEncounterRequestFromMapState`) so war-meter state can drive targetCP/policy/seed before combat entry; added policy/faction contract coverage for solver branches.
- files modified: web-runner/app.js; tests/encounterRequestHookContract.test.js; tests/mapEncounterRequestStubContract.test.js; tests/encounterPolicyContract.test.js
- test evidence: `npm test -- tests/encounterPolicyContract.test.js tests/mapEncounterRequestStubContract.test.js tests/encounterRequestHookContract.test.js tests/encounterBudgetContract.test.js` (5/5 pass)
- scope confirmation: Confined to ORKA-cpc encounter-request injection and policy/faction contract hardening; no unrelated combat formula changes.

- bead id: ORKA-jmf
- summary of changes: Fixed yellow-match completion regression by removing crash-prone merge-target lookup dependencies in `handleGemMatch` (`instances`/`assetsLayout` scope issues), restored safe in-function target resolution, and added yellow completion regression contract.
- files modified: web-runner/app.js; tests/yellowMatchCompletionGuardContract.test.js; ai-memory/insights.md
- test evidence: `npm test -- tests/yellowMatchCompletionGuardContract.test.js tests/yellowSlamSequenceContract.test.js` (3/3 pass); Playwright multi-pass forceMatch checks confirm yellow cycle exits (`BoardFillActive` returns to `0`).
- scope confirmation: Confined to ORKA-jmf yellow-sequence completion stability and traceability corrections.

- bead id: ORKA-cpc
- summary of changes: Restored Beads-governed lane by moving CP-budget encounter builder work to in_progress and implementing strict locale-tag filtering, doctrine metadata normalization (faction/enemyRole/localeTags), deterministic encounter selection, and encounter-pooled respawn picking in runtime mirrors.
- files modified: web-runner/app.js; web-runner/modules/functionBank.js; Scripts/functionBank.js; web-runner/assets/enemies.json; tests/encounterBudgetContract.test.js; tests/enemyBiomeContract.test.js
- test evidence: `npm test -- tests/combatPowerIndexContract.test.js tests/enemyBiomeContract.test.js tests/encounterBudgetContract.test.js` (7/7 pass)
- scope confirmation: All active code changes are now tracked under ORKA-cpc with explicit hot-file lock scope; ORKA-cpb retained for metadata follow-up migrations only.

- bead id: ORKA-dwg
- summary of changes: Added deterministic combat-power indexing to hero/enemy runtime records, enriched enemy source rows with CombatPower at bootstrap, surfaced combatPower in exported runtime hero/enemy snapshots, and mirrored enemy combatPower preservation in both function-bank SpawnEnemy paths.
- files modified: web-runner/app.js; web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/combatPowerIndexContract.test.js
- test evidence: `npm test -- tests/combatPowerIndexContract.test.js tests/chestsLayoutScaffoldContract.test.js` (5/5 pass)
- scope confirmation: Confined to combat-power data indexing/stub surfaces for downstream gating; no combat formula behavior changes beyond adding computed field.

- bead id: ORKA-a0k
- summary of changes: Added runtime Chests layout scaffold with deterministic tier tabs, progress bar placeholder, reward-list shell, and Mission-nav entry mapping from combat.
- files modified: web-runner/app.js; tests/chestsLayoutScaffoldContract.test.js
- test evidence: `npm test -- tests/chestsLayoutScaffoldContract.test.js tests/homesteadLayoutScaffoldContract.test.js tests/collectiblesLayoutScaffoldContract.test.js` (6/6 pass)
- scope confirmation: Confined to layout/state scaffold and navigation mapping only; no drop-table/economy/balance finalization.

- bead id: ORKA-51g
- summary of changes: Added runtime Homestead layout scaffold with deterministic scene-slot/emission metadata, map-locale entry mapping, and selectable Homestead builder shell with map/combat return routes.
- files modified: web-runner/app.js; tests/homesteadLayoutScaffoldContract.test.js
- test evidence: `npm test -- tests/homesteadLayoutScaffoldContract.test.js tests/collectiblesLayoutScaffoldContract.test.js tests/mountsLayoutScaffoldContract.test.js` (6/6 pass)
- scope confirmation: Confined to layout/state scaffold and navigation mapping only; no economy/balance or finalized homestead mechanics.

- bead id: ORKA-khb
- summary of changes: Added runtime Collectibles layout scaffold with deterministic gallery/passive metadata model, map-locale entry mapping, and selectable Collectibles gallery shell with map/combat return routes.
- files modified: web-runner/app.js; tests/collectiblesLayoutScaffoldContract.test.js
- test evidence: `npm test -- tests/collectiblesLayoutScaffoldContract.test.js tests/mountsLayoutScaffoldContract.test.js tests/artifactsLayoutScaffoldContract.test.js tests/tomesLayoutScaffoldContract.test.js` (8/8 pass)
- scope confirmation: Confined to layout/state scaffold and navigation mapping only; no economy/balance or finalized collectibles mechanics.

- bead id: ORKA-8k4
- summary of changes: Added runtime Mounts layout scaffold with deterministic gallery/passive metadata model, map-locale entry mapping, and selectable Mounts gallery shell with map/combat return routes.
- files modified: web-runner/app.js; tests/mountsLayoutScaffoldContract.test.js; tests/artifactsLayoutScaffoldContract.test.js
- test evidence: `npm test -- tests/mountsLayoutScaffoldContract.test.js tests/artifactsLayoutScaffoldContract.test.js tests/tomesLayoutScaffoldContract.test.js` (6/6 pass)
- scope confirmation: Confined to layout/state scaffold and navigation mapping only; no economy/balance or finalized mounts mechanics.

- bead id: ORKA-3e4
- summary of changes: Added runtime Artifacts layout scaffold with deterministic gallery/passive metadata model, map-locale entry mapping, and selectable Artifacts gallery shell with map/combat return routes.
- files modified: web-runner/app.js; tests/artifactsLayoutScaffoldContract.test.js; tests/tomesLayoutScaffoldContract.test.js
- test evidence: `npm test -- tests/artifactsLayoutScaffoldContract.test.js tests/tomesLayoutScaffoldContract.test.js tests/yellowSlamSequenceContract.test.js` (6/6 pass)
- scope confirmation: Confined to layout/state scaffold and navigation mapping only; no economy/balance or finalized artifact mechanics.

- bead id: ORKA-7pi
- summary of changes: Added runtime Tomes layout scaffold with deterministic gallery/buff metadata model, map-locale entry mapping, and dedicated Tomes layout shell with selectable placeholder tome cards.
- files modified: web-runner/app.js; tests/tomesLayoutScaffoldContract.test.js
- test evidence: `npm test -- tests/tomesLayoutScaffoldContract.test.js tests/yellowSlamSequenceContract.test.js` (4/4 pass)
- scope confirmation: Confined to layout/state scaffold and navigation mapping only; no economy or finalized tome mechanics.

- bead id: ORKA-fp9
- summary of changes: Hardened enemy debuff lifecycle by normalizing debuff state on read, unifying apply/decay paths through a single helper, sanitizing invalid/duplicate slot data, and preserving deterministic slot eviction behavior.
- files modified: Scripts/functionBank.js; web-runner/modules/functionBank.js; tests/debuffLifecycleReliabilityContract.test.js
- test evidence: `npm test -- tests/debuffLifecycleReliabilityContract.test.js` (2/2 pass); `npm test -- tests/traitHookFrameworkContract.test.js tests/blueBuffLifecycleContract.test.js` (4/4 pass)
- scope confirmation: Changes are confined to debuff apply/stack/expire/cleanup reliability for ORKA-fp9 with mirrored runtime maintenance only.

- bead id: ORKA-6gt
- summary of changes: Added Falie enmity target-bias for enemy single-target selection with hard cap guardrail and deterministic target-bias trace payload in globals.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/falieEnmityTargetBiasContract.test.js
- test evidence: `npm test -- tests/falieEnmityTargetBiasContract.test.js tests/traitHookFrameworkContract.test.js tests/debuffLifecycleReliabilityContract.test.js` (7/7 pass)
- scope confirmation: Confined to enemy target selection bias behavior for Falie trait and mirror parity.

- bead id: ORKA-2sa
- summary of changes: Added Runa passive magic-resist trigger against enemy magic single/AOE paths with deterministic proc/nullify trace state and guarded damage reduction/nullification outcomes.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/runaMagicResistContract.test.js
- test evidence: `npm test -- tests/runaMagicResistContract.test.js tests/falieEnmityTargetBiasContract.test.js tests/traitHookFrameworkContract.test.js tests/debuffLifecycleReliabilityContract.test.js` (10/10 pass)
- scope confirmation: Confined to Runa defensive trait behavior for incoming enemy magic and mirror parity.

- bead id: ORKA-mo4
- summary of changes: Added Huun-only execution drop bonus by carrying kill-credit through pending death resolution and applying a deterministic TH level bonus in existing drop-rate transform path.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/huunExecutionDropBonusContract.test.js
- test evidence: `npm test -- tests/huunExecutionDropBonusContract.test.js tests/runaMagicResistContract.test.js tests/falieEnmityTargetBiasContract.test.js tests/debuffLifecycleReliabilityContract.test.js` (11/11 pass)
- scope confirmation: Confined to kill-credit-aware drop bonus behavior for Huun executions inside existing loot pipeline (no new loot systems).

- bead id: ORKA-69r
- summary of changes: Added deterministic contract coverage to lock blue->Astral wallet routing, no direct blue stat-apply gating, and Astral wallet output/state surface.
- files modified: tests/blueAstralWalletContract.test.js
- test evidence: `npm test -- tests/blueAstralWalletContract.test.js tests/blueBuffLifecycleContract.test.js tests/runaMagicResistContract.test.js tests/falieEnmityTargetBiasContract.test.js tests/huunExecutionDropBonusContract.test.js` (15/15 pass)
- scope confirmation: QA closeout evidence only; no runtime behavior changes in this slice.

- bead id: ORKA-xnz
- summary of changes: Added deterministic contract coverage for brief white hit-flash feedback on attacked combatants (damage path flash timing + renderer white-overlay behavior).
- files modified: tests/hitFlashFeedbackContract.test.js
- test evidence: `npm test -- tests/hitFlashFeedbackContract.test.js tests/blueAstralWalletContract.test.js tests/runaMagicResistContract.test.js tests/falieEnmityTargetBiasContract.test.js tests/huunExecutionDropBonusContract.test.js` (14/14 pass)
- scope confirmation: QA lock-in only; runtime behavior already present and unchanged.

- bead id: ORKA-ohb
- summary of changes: Added guard contracts to ensure regen debug spam markers are absent from runtime app and both skill-sheet mirrors by default.
- files modified: tests/regenDebugNoiseContract.test.js
- test evidence: `npm test -- tests/regenDebugNoiseContract.test.js tests/hitFlashFeedbackContract.test.js tests/blueAstralWalletContract.test.js tests/runaMagicResistContract.test.js tests/falieEnmityTargetBiasContract.test.js tests/huunExecutionDropBonusContract.test.js` (16/16 pass)
- scope confirmation: Runtime hygiene verification only; no gameplay logic changes.

- bead id: ORKA-6x3
- summary of changes: Implemented per-gem yellow sequence settle gate so each yellow-replaced/refilled gem now completes randomize -> slam/bounce settle -> advance before next gem.
- files modified: web-runner/app.js; tests/yellowSlamSequenceContract.test.js
- test evidence: `npm test -- tests/yellowSlamSequenceContract.test.js tests/yellowGoldFlyupContract.test.js tests/blueAstralWalletContract.test.js` (7/7 pass)
- scope confirmation: Confined to yellow sequence pacing/animation sequencing; existing randomize behavior preserved.

- bead id: ORKA-cpc
- summary of changes: Completed CP-budget encounter integration lane with caller-owned encounter request setter (`setEncounterRequest`), map-return encounter request derivation stub (`warMeter -> targetCP/policy`), seeded spawn wiring, and map encounter node setter for locale/faction handoff.
- files modified: web-runner/app.js; tests/encounterBudgetContract.test.js; tests/encounterPolicyContract.test.js; tests/encounterRequestHookContract.test.js; tests/mapEncounterRequestStubContract.test.js
- test evidence: `npm test -- tests/combatRuntimeGatewayContract.test.js tests/enemyBiomeContract.test.js tests/encounterBudgetContract.test.js tests/encounterPolicyContract.test.js tests/mapEncounterRequestStubContract.test.js tests/encounterRequestHookContract.test.js` (8/8 pass)
- scope confirmation: Confined to encounter-builder wiring and map->combat request stubs; no unrelated combat rules or render subsystem refactors.

- bead id: ORKA-cpb
- summary of changes: Began doctrine follow-up lane by refining elite taxonomy (`High Orc` promoted to `commander`) and adding full-roster doctrine consistency/default contracts.
- files modified: web-runner/assets/enemies.json; tests/enemyDoctrineMetadataContract.test.js
- test evidence: `npm test -- tests/enemyDoctrineMetadataContract.test.js tests/enemyBiomeContract.test.js tests/encounterBudgetContract.test.js tests/encounterPolicyContract.test.js tests/mapEncounterRequestStubContract.test.js tests/encounterRequestHookContract.test.js` (9/9 pass)
- scope confirmation: Confined to doctrine metadata content/validation hardening and default fallback contract coverage.

- bead id: ORKA-cpc
- summary of changes: Added contract coverage for map encounter-node authority (`setMapEncounterNode`) and ensured encounter request preview derives locale/faction from node metadata before combat return.
- files modified: tests/mapEncounterRequestStubContract.test.js
- test evidence: `npm test -- tests/mapEncounterRequestStubContract.test.js tests/encounterRequestHookContract.test.js tests/encounterBudgetContract.test.js tests/enemyDoctrineMetadataContract.test.js tests/enemyBiomeContract.test.js` (9/9 pass)
- scope confirmation: Test-only hardening inside existing ORKA-cpc lane; no gameplay logic expansion.

- bead id: ORKA-cpc
- summary of changes: Hardened encounter doctrine normalization in `buildEncounterByBudget` by normalizing locale tags regardless of source shape, applying optional faction filter through canonical faction normalization, and normalizing role checks during policy bucketing.
- files modified: web-runner/app.js; tests/encounterPolicyContract.test.js
- test evidence: `npm test -- tests/encounterPolicyContract.test.js tests/encounterBudgetContract.test.js tests/enemyDoctrineMetadataContract.test.js tests/enemyBiomeContract.test.js tests/mapEncounterRequestStubContract.test.js tests/encounterRequestHookContract.test.js` (10/10 pass)
- scope confirmation: Confined to CP encounter-builder doctrine normalization and matching contract updates.

- bead id: ORKA-zys
- summary of changes: Audited governance coordination layer presence; required coordination files already exist and are actively used (`agents/pm_status.md`, `agents/issues.md`, `agents/dev_reports.md`). Marked bead complete for legacy cleanup.
- files modified: .beads/open/ORKA-zys.md
- test evidence: file presence + active append history in coordination files
- scope confirmation: Status hygiene/traceability cleanup only; no runtime code changes.

- bead id: ORKA-jj0
- summary of changes: Legacy audit confirmed yellow->gold fly-up path is active in runtime and covered by contract tests; marked bead done.
- files modified: .beads/open/ORKA-jj0.md
- test evidence: tests/yellowGoldFlyupContract.test.js + app.js fly-up callsites
- scope confirmation: Status hygiene only.

- bead id: ORKA-9hl
- summary of changes: Marked blocked/superseded after audit; current runtime behavior intentionally uses yellow->gold fly-up (conflicts with "without fly-up" wording).
- files modified: .beads/blocked/ORKA-9hl.md
- test evidence: tests/yellowGoldFlyupContract.test.js + app.js fly-up callsites
- scope confirmation: Traceability cleanup only.

- bead id: ORKA-hlc
- summary of changes: Closed obsolete blue-buff lifecycle bead per product rule update; buff systems are decoupled from gem matches and handled via separate booster mechanics.
- files modified: .beads/open/ORKA-hlc.md
- test evidence: Policy decision closure (no runtime change)
- scope confirmation: Bead status/traceability cleanup only.

- bead id: ORKA-z0b
- summary of changes: Closed hero selector arrow bug bead after confirming existing runtime behavior and contract coverage (`heroSelectorRulesContract`).
- files modified: .beads/open/ORKA-z0b.md
- test evidence: `npm test -- tests/heroSelectorRulesContract.test.js` (pass)
- scope confirmation: Status/traceability cleanup only.

- bead id: ORKA-hsf
- summary of changes: Applied Hero layout Figma 1:3 compliance pass: updated hero layout geometry/spec values, wired Figma arrow/close assets, and restyled stat/skill card rendering to match provided frame while preserving existing behavior paths.
- files modified: web-runner/app.js; .beads/in_progress/ORKA-hsf.md; .beads/hot-file-lock/ORKA-hsf.scope
- test evidence: `npm test -- tests/heroSelectorRulesContract.test.js tests/yellowMatchCompletionGuardContract.test.js tests/yellowSlamSequenceContract.test.js tests/combatRuntimeGatewayContract.test.js` (5/5 pass)
- scope confirmation: Visual/layout-only pass for Hero screen; no combat mechanic changes.

- bead id: ORKA-hsf
- summary of changes: Tightened Hero screen placeholders to match Figma node 1:3 by forcing stat/value placeholders to `NUM` and locking skill titles to `Skill Title` / `Skill Title Lv.2` / `Skill Title`.
- files modified: web-runner/app.js
- test evidence: `npm test -- tests/heroSelectorRulesContract.test.js tests/layoutState.test.js` (6/6 pass)
- scope confirmation: Visual/text compliance only; behavior unchanged.

- bead id: ORKA-mwl
- summary of changes: Added initiative queue sanitization to prevent improper repeated hero slots from accumulating in time-mode turn order; extras are now preserved only for explicit mechanic provenance.
- files modified: web-runner/src/core/initiativeGuards.mjs; web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/initiativeGuardsContract.test.js; .beads/in_progress/ORKA-mwl.md
- test evidence: `npm test -- tests/initiativeGuardsContract.test.js tests/heroSelectorRulesContract.test.js tests/layoutState.test.js` (9/9 pass)
- scope confirmation: Turn-order scheduler guard only; no layout/UI behavior changes.

- bead id: ORKA-spt
- summary of changes: Seeded party hero skill points to exact 300 at runtime combat init and validated deterministic skill-point consumption/cap behavior with Playwright multipass automation.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; web-runner/app.js; tests/skillPointSeedContract.test.js; .beads/open/ORKA-spt.md
- test evidence: `npm test -- tests/skillPointSeedContract.test.js tests/heroSelectorRulesContract.test.js tests/layoutState.test.js` (8/8 pass); `playwright-cli run-code` multipass harness (12/12 passes): each hero start=300, end=279 after full 3-skill progression, applied upgrades=9, max-rank rejects=3, no over-consume.
- scope confirmation: Confined to ORKA-spt seed hook + verification lane; no unrelated combat/balance logic edits.

- bead id: ORKA-lod
- summary of changes: Reworked startup asset pipeline to stage critical sprite types for first-frame readiness and defer non-critical base sprites; converted core visual image boot loads from serial awaits to parallel batch loading.
- files modified: web-runner/app.js; tests/startupAssetLoadPerfContract.test.js; .beads/open/ORKA-lod.md
- test evidence: `npm test -- tests/startupAssetLoadPerfContract.test.js tests/enemyBarRenderContract.test.js tests/heroSelectorRulesContract.test.js tests/layoutState.test.js` (10/10 pass)
- scope confirmation: Confined to startup loading pipeline performance behavior and related contract coverage.

- bead id: ORKA-bar
- summary of changes: Fixed combat enemy HP bar distortion by snapping bar coordinates/sizes to integer pixels and disabling image smoothing for bar sprite layers.
- files modified: web-runner/app.js; tests/enemyBarRenderContract.test.js; .beads/open/ORKA-bar.md
- test evidence: `npm test -- tests/startupAssetLoadPerfContract.test.js tests/enemyBarRenderContract.test.js tests/heroSelectorRulesContract.test.js tests/layoutState.test.js` (10/10 pass)
- scope confirmation: Visual render-only fix for enemy bar stability; gameplay math and HP lag behavior unchanged.

- bead id: ORKA-lpb
- summary of changes: Implemented Layout 0 startup loading/progress bar and stage-based progress updates during bootstrap; loading overlay exits at runtime-ready state.
- files modified: web-runner/app.js; tests/startupLoadingBarContract.test.js; tests/startupAssetLoadPerfContract.test.js; .beads/open/ORKA-lpb.md
- test evidence: `npm test -- tests/startupAssetLoadPerfContract.test.js tests/enemyBarRenderContract.test.js tests/startupLoadingBarContract.test.js tests/heroSelectorRulesContract.test.js tests/layoutState.test.js` (12/12 pass)
- scope confirmation: Confined to startup load UX/progress instrumentation and contract updates.

- bead id: ORKA-lod / ORKA-lpb / ORKA-bar
- summary of changes: QA PASS confirmed by user after preload + loading bar + enemy bar distortion fixes.
- files modified: agents/pm_status.md; agents/dev_reports.md
- test evidence: user runtime QA pass on `http://127.0.0.1:8080/web-runner/`
- scope confirmation: documentation-only follow-up.

- bead id: ORKA-hsb
- summary of changes: Wired hero screen +/- buttons to skill progression actions and added downgrade/refund support (`AttemptHeroSkillDowngrade`) mirrored in runtime and Scripts.
- files modified: web-runner/app.js; web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/heroSkillButtonsContract.test.js; .beads/open/ORKA-hsb.md
- test evidence: `npm test -- tests/heroSkillButtonsContract.test.js tests/skillPointSeedContract.test.js tests/heroSelectorRulesContract.test.js tests/layoutState.test.js` (10/10 pass)
- scope confirmation: Confined to hero screen button interaction + skill state progression APIs.

- bead id: ORKA-vlt
- summary of changes: Moved retention-entry button stack from Map layout to Chests top rail, wired lazy routing from Chests to gallery layouts, and renamed Mission nav behavior/display to Vault.
- files modified: web-runner/app.js; tests/vaultNavAndChestsRailContract.test.js; .beads/open/ORKA-vlt.md
- test evidence: `npm test -- tests/vaultNavAndChestsRailContract.test.js tests/startupLoadingBarContract.test.js tests/startupAssetLoadPerfContract.test.js tests/heroSkillButtonsContract.test.js tests/layoutState.test.js` (14/14 pass)
- scope confirmation: UI/navigation-only changes; no gallery mechanic expansion.

- bead id: ORKA-l0p
- summary of changes: Updated Layout 0 loading presentation to bottom mobile-style progress bar while preserving bootstrap progress plumbing.
- files modified: web-runner/app.js; .beads/open/ORKA-l0p.md
- test evidence: same 14/14 suite pass above (includes startup loading contracts)
- scope confirmation: startup loading UX only.

- bead id: ORKA-vlt (reopen fix)
- summary of changes: Corrected retention gallery back-navigation home from map to vault; all mapBack buttons now route to `chestsLayout` with `Back To Vault` labels.
- files modified: web-runner/app.js; tests/vaultNavAndChestsRailContract.test.js; .beads/open/ORKA-vlt.md
- test evidence: `npm test -- tests/vaultNavAndChestsRailContract.test.js tests/layoutState.test.js` (9/9 pass)
- scope confirmation: Navigation/label fix only for reopened vault retention routing issue.

- bead id: ORKA-l0p (reopen fix)
- summary of changes: Enforced requested flow by preloading during storyMock and rendering bottom loading progress on layout 0; blocked 0->1 transition until preload completion.
- files modified: web-runner/app.js; tests/startupLoadingBarContract.test.js; .beads/open/ORKA-l0p.md
- test evidence: `npm test -- tests/startupLoadingBarContract.test.js tests/startupAssetLoadPerfContract.test.js tests/layoutState.test.js` (9/9 pass); `npm test -- tests/vaultNavAndChestsRailContract.test.js` (4/4 pass)
- scope confirmation: loading-flow sequencing and UI behavior only.

- bead id: ORKA-mxc
- summary of changes: Replaced Map layout `Return Combat` button with Hero-style circle `X` close control and routed close action to combat while preserving drag/pan interactions.
- files modified: web-runner/app.js; tests/mapCloseControlContract.test.js; .beads/open/ORKA-mxc.md
- test evidence: `node --test tests/mapCloseControlContract.test.js tests/vaultNavAndChestsRailContract.test.js tests/heroSkillButtonsContract.test.js` (9/9 pass)
- scope confirmation: Confined to map close-control UI/input lane; no combat/balance logic changes.

- bead id: ORKA-ysp
- summary of changes: Tuned yellow randomize+bounce cadence to complete faster while preserving per-gem anticipation and settle-gated sequencing.
- files modified: web-runner/app.js; tests/yellowSlamSequenceContract.test.js; .beads/open/ORKA-ysp.md
- test evidence: `node --test tests/yellowSlamSequenceContract.test.js tests/yellowMatchCompletionGuardContract.test.js tests/yellowGoldFlyupContract.test.js` (5/5 pass)
- scope confirmation: Timing-only tune for yellow sequence; no mechanic or gating model changes.

- bead id: ORKA-4c0
- summary of changes: Audited hero-screen control asset usage and switched to local hero-pack-first loading (plus/minus/close oval) with parity remote fallbacks retained.
- files modified: web-runner/app.js; tests/heroAssetPackUsageContract.test.js; .beads/open/ORKA-4c0.md
- test evidence: `node --test tests/heroAssetPackUsageContract.test.js tests/heroSkillButtonsContract.test.js tests/mapCloseControlContract.test.js tests/vaultNavAndChestsRailContract.test.js` (10/10 pass)
- scope confirmation: Asset loading policy only; no gameplay mechanics modified.

- bead id: ORKA-gsb
- summary of changes: Added per-slot gem backers behind board gems using `grid_placeholder` asset with an explicit `ORKA-gsb` feature flag and tagged begin/end block for instant rollback.
- files modified: web-runner/app.js; tests/gemSlotBackerContract.test.js; .beads/open/ORKA-gsb.md
- test evidence: `node --test tests/gemSlotBackerContract.test.js tests/yellowSlamSequenceContract.test.js tests/yellowMatchCompletionGuardContract.test.js` (4/4 pass)
- scope confirmation: Rendering-layer only; gem logic/match/refill behavior unchanged.

- bead id: ORKA-cmh (reopen cycle)
- summary of changes: Fixed Chimerilass threshold regression so heal skills are impossible above 50% HP and guaranteed below/equal 50% HP; enforced at selector seam (`PickEnemySkill`) plus resolver guard.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/chimerilassHealThresholdContract.test.js; .beads/open/ORKA-cmh.md
- test evidence:
  - `npm test -- tests/chimerilassHealThresholdContract.test.js tests/encounterPolicyContract.test.js` (3/3 pass)
  - Playwright multipass: above 50% => 0/800 heal picks; below 50% => 800/800 heal picks
- scope confirmation: confined to ORKA-cmh Chimerilass heal-threshold contract and verification only.

- bead id: ORKA-cpc
- summary of changes: Closed CP-budget encounter builder lane by aligning stale contract tests to current explicit-seed and history-aware builder behavior.
- files modified: tests/encounterBudgetContract.test.js; tests/encounterRequestHookContract.test.js; .beads/open/ORKA-cpc.md
- test evidence: `npm test -- tests/encounterBudgetContract.test.js tests/encounterPolicyContract.test.js tests/encounterRequestHookContract.test.js tests/enemyBiomeContract.test.js tests/enemyDoctrineMetadataContract.test.js` (8/8 pass)
- scope confirmation: test-contract and bead-closeout updates only; runtime encounter logic unchanged in this cycle.

- bead id: ORKA-wbk
- summary of changes: Implemented encounter slot assignment rules so strongest CP enemy is always center on non-solo packages, with true-random side-slot placement; added full-wave KO packaged repick path while preserving normal per-slot refill behavior.
- files modified: web-runner/app.js; web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/encounterSlotAssignmentContract.test.js; .beads/open/ORKA-wbk.md
- test evidence: `npm test -- tests/encounterSlotAssignmentContract.test.js tests/encounterBudgetContract.test.js tests/encounterPolicyContract.test.js tests/encounterRequestHookContract.test.js tests/enemyBiomeContract.test.js tests/enemyDoctrineMetadataContract.test.js` (10/10 pass)
- scope confirmation: confined to encounter slot-assignment and repick behavior specified in ORKA-wbk; no CP retune, no war-economy features.

- bead id: ORKA-cpb
- summary of changes: Closed doctrine follow-up lane as complete based on current normalized taxonomy/default behavior and passing doctrine/locale/policy contracts.
- files modified: .beads/open/ORKA-cpb.md
- test evidence: `npm test -- tests/enemyDoctrineMetadataContract.test.js tests/enemyBiomeContract.test.js tests/encounterPolicyContract.test.js` (5/5 pass)
- scope confirmation: no runtime code changes; bead closeout by acceptance evidence only.

- bead id: ORKA-jj0 (reopen tuning)
- summary of changes: Increased yellow->gold fly-up gem start size to 150% by adding `startScale` to merge FX and setting yellow call-site to `1.5`, while preserving existing timing/sequence behavior.
- files modified: web-runner/app.js; tests/yellowGoldFlyupContract.test.js; .beads/open/ORKA-jj0.md
- test evidence: `npm test -- tests/yellowGoldFlyupContract.test.js tests/yellowSlamSequenceContract.test.js tests/yellowMatchCompletionGuardContract.test.js` (5/5 pass)
- scope confirmation: animation presentation tweak only; no yellow flow logic/model changes.

- bead id: ORKA-jj0 (reopen regression fix)
- summary of changes: Restored deterministic frame-6 energy reward by removing gold-or-energy branching from `handleSpecialGem6`; frame-6 click now always adds energy.
- files modified: web-runner/app.js; tests/frame6EnergyContract.test.js; .beads/open/ORKA-jj0.md
- test evidence: `node --test tests/frame6EnergyContract.test.js` (1/1 pass); `node --test tests/yellowGoldFlyupContract.test.js` (3/3 pass)
- scope confirmation: confined to frame-6 reward behavior regression inside ORKA-jj0 lane.

- bead id: ORKA-jj0 (reopen timing fix)
- summary of changes: Deferred yellow gold tally mutation until fly-up merge completion so displayed Gold total updates when gems reach the label.
- files modified: web-runner/app.js; tests/yellowGoldFlyupContract.test.js; .beads/open/ORKA-jj0.md
- test evidence: `node --test tests/yellowGoldFlyupContract.test.js` (4/4 pass); `node --test tests/yellowSlamSequenceContract.test.js tests/yellowMatchCompletionGuardContract.test.js` (6/6 pass)
- scope confirmation: yellow fly-up feedback timing only; no change to yellow conversion totals.

- bead id: ORKA-3m8
- summary of changes: Closed undefined yellow extra-turn bug lane with explicit acceptance and regression contracts for deferred yellow handoff semantics and single-turn-advance ordering.
- files modified: tests/yellowTurnHandoffContract.test.js; .beads/open/ORKA-3m8.md
- test evidence: `node --test tests/yellowTurnHandoffContract.test.js` (2/2 pass); `node --test tests/yellowGoldFlyupContract.test.js tests/yellowMatchCompletionGuardContract.test.js tests/yellowSlamSequenceContract.test.js` (7/7 pass)
- scope confirmation: yellow handoff regression guard coverage only; no combat formula or encounter behavior changes.

- bead id: ORKA-jdu
- summary of changes: Locked the current Vault family by renaming Collectibles to Relics across runtime labels/routes, adding a Pets scaffold in the existing retention-button/gallery style, and updating vault-family contracts to the current chests-driven entry path.
- files modified: web-runner/app.js; tests/relicsLayoutScaffoldContract.test.js; tests/petsLayoutScaffoldContract.test.js; tests/vaultNavAndChestsRailContract.test.js; tests/mountsLayoutScaffoldContract.test.js; tests/homesteadLayoutScaffoldContract.test.js
- test evidence: `npm test -- tests/relicsLayoutScaffoldContract.test.js tests/petsLayoutScaffoldContract.test.js tests/mountsLayoutScaffoldContract.test.js tests/homesteadLayoutScaffoldContract.test.js tests/vaultNavAndChestsRailContract.test.js` (13/13 pass)
- scope confirmation: vault-family scaffold/navigation only; no economy, combat, or art-led redesign work introduced.

- bead id: ORKA-1ol
- summary of changes: Cleaned the ready queue to binary state after Vault-family shipment by closing obsolete duplicate scaffold beads and preserving only the remaining future Relics stub.
- files modified: none (Beads queue hygiene only)
- test evidence: `bd show ORKA-axd` -> CLOSED; `bd show ORKA-c1j` -> CLOSED; `bd ready` no longer lists those duplicates; `bd show ORKA-n0g` remains OPEN with explicit future-stub comment.
- scope confirmation: issue-state cleanup only; no runtime code changes.

- bead id: ORKA-sht
- summary of changes: Audited the broader Beads queue for binary cleanliness, closed stale policy/duplicate work (`ORKA-2dt` plus prior Vault-family duplicates), confirmed no lingering `in_progress` beads, and preserved only intentionally future-facing stubs.
- files modified: none (Beads queue audit only)
- test evidence: `bd show ORKA-2dt` -> CLOSED; `bd list --status=in_progress --json` -> []; direct reads confirm `ORKA-n0g`, `ORKA-r9z`, `ORKA-hvj`, `ORKA-7c0`, `ORKA-ao8`, `ORKA-9ri`, and `ORKA-zih` remain legitimately OPEN. `bd ready` still shows short read-after-write lag immediately after closure.
- scope confirmation: queue-state audit only; no runtime or governance file edits beyond reporting.

- bead id: ORKA-s0v
- summary of changes: Upgraded Chimerilass heals from simple randomized values to shared-crit-semantics enemy heals with explicit crit/non-crit combat text and structured runtime heal trace across self-heal, ally-heal, and group-heal paths.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/chimerilassHealCritContract.test.js
- test evidence:
  - `npm test -- tests/chimerilassHealCritContract.test.js tests/chimerilassHealThresholdContract.test.js` (4/4 pass)
  - Browser multipass on `http://127.0.0.1:8080/web-runner/`: self-heal sampled `10..17` with crit and non-crit outcomes; ally-heal sampled `11..16` with ally-name combat text plus crit/non-crit outcomes; group-heal sampled `12..15` with crit/non-crit outcomes and targetCount `3`; enemy-turn runtime pass completed with `actionInProgress=0` and `enemyActionActive=false` after the heal action.
- scope confirmation: confined to Chimerilass heal behavior and verification only; no unrelated combat lanes changed.

- bead id: ORKA-f0l
- summary of changes: Added a separate Layout 1 gem counter radiator below the existing turn log, tracking per-hero and party gem usage totals by color from successful hero-turn matches only; fixed the active-hero label path to resolve from the authoritative turn selector contract instead of falling back to the selected hero.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; web-runner/app.js; web-runner/index.html; tests/heroGemUsageCounterContract.test.js; tests/heroGemUsageRadiatorContract.test.js
- test evidence:
  - `npm test -- tests/heroGemUsageCounterContract.test.js tests/heroGemUsageRadiatorContract.test.js` (4/4 pass)
  - Browser verification on `http://127.0.0.1:8080/web-runner/index.html`: radiator renders as a separate panel beneath `#output`; existing turn log remains in `#output`; live match pass recorded `Huun.GREEN += 3` and `Party.GREEN += 3`; two-gem partial selection produced no counter state before match resolution.
  - Follow-up runtime bug fix: browser pass exposed hero label fallback to Falie after a Huun match; patched `drawGemCounterHUD()` to use `directUID + turnOrder + currentTurnIndex`, then added a contract guarding that selector call.
  - User QA PASS recorded after runtime review.
- scope confirmation: confined to ORKA-f0l hero gem usage telemetry and its Layout 1 radiator presentation; wallet, turn log, and unrelated combat rules were not repurposed.

- bead id: ORKA-c4s
- summary of changes: Added durable hero gem progress state keyed by stable hero identity, deterministic milestone hook surfaces with configurable thresholds, and a web-runner localStorage save/load seam for future Vault child progression layers.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; web-runner/modules/state.js; Scripts/state.js; web-runner/app.js; tests/heroGemUsageCounterContract.test.js; tests/heroGemUsagePersistenceContract.test.js
- test evidence:
  - `npm test -- tests/heroGemUsageCounterContract.test.js tests/heroGemUsageRadiatorContract.test.js tests/heroGemUsagePersistenceContract.test.js` (7/7 pass)
  - Browser deterministic multipass on `http://127.0.0.1:8080/web-runner/index.html`: pass 1 injected a minimal hero roster, set thresholds to `[3,5]`, registered `Huun.GREEN += 3`, confirmed localStorage snapshot write under `orka.hero_gem_progress.v1`, and observed party/hero threshold `3` hook traces; pass 2 reloaded the page, loaded the stored snapshot back through the runtime API, and confirmed the saved per-hero totals plus milestone state survived the reload.
  - Follow-up runtime bug fixes during verification: milestone reached-state originally failed to mark crossed thresholds, then milestone normalization was zeroing party totals on read; both were corrected in the shared function-bank seam before closeout.
- scope confirmation: confined to ORKA-c4s gem counter persistence and deterministic milestone surfaces only; no reward balancing, unlock payouts, or unrelated combat rules were introduced.

- bead id: ORKA-1qo
- summary of changes: Added a Playwright-driven energy session balance harness CLI with two browser paths: direct Playwright launch and CDP attach to an already-running Chrome via `BALANCE_CDP_URL`/`--cdpUrl`. The harness now drives real canvas clicks, resolves pending hero attack UI by selecting an enemy and pressing the centered attack button, counts zero-HP enemies as defeated, and writes per-session/report artifacts.
- files modified: tools/balance_harness.js; package.json; tests/balanceHarnessContract.test.js
- test evidence:
  - `npm test -- tests/balanceHarnessContract.test.js` (2/2 pass)
  - Runtime seam validation on `http://127.0.0.1:8091/web-runner/index.html`: `window.render_game_to_text` present, `#view` canvas present, layout reached `storyMock`
  - Direct Node Playwright launch against `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` still aborts in this sandbox with `SIGABRT` / Crashpad-bootstrap permission errors, so the recovery path is CDP attach rather than browser spawn
  - Real smoke run passed via attached Chrome: `BALANCE_CDP_URL=http://127.0.0.1:9222 BALANCE_SESSION_COUNT=1 node tools/balance_harness.js --maxWaves 1 --outputDir /tmp/orka-balance-harness-smoke`
  - Artifact verification: `/tmp/orka-balance-harness-smoke/session_results.csv`, `/tmp/orka-balance-harness-smoke/wave_distribution.json`, `/tmp/orka-balance-harness-smoke/balance_recommendations.json`, `/tmp/orka-balance-harness-smoke/balance_report.md`
- scope confirmation: confined to the ORKA-1qo external balance-harness lane; no runtime combat logic or balance formulas were modified.

- bead id: ORKA-9gv
- summary of changes: Reduced mirrored functionBank drift at the Power Amp lifecycle seam by aligning `Scripts/functionBank.js` with the web runner’s activation telemetry semantics, then added a deterministic contract that compares curated high-risk mirrored functions across both runtime paths.
- files modified: Scripts/functionBank.js; tests/functionBankParityContract.test.js
- test evidence:
  - `npm test -- tests/functionBankParityContract.test.js` (1/1 pass)
  - Contract compares normalized source for `activatePowerAmp`, `computeCombatPowerFromStats`, `ApplyScaledCrit`, `CalculateDamage`, `ResolveGemAction`, `ExecuteEnemyJobSkill`, `StartEnemyAction`, `EnemyTurn`, `HeroTurn`, and `PickEnemySkill` across `Scripts/functionBank.js` and `web-runner/modules/functionBank.js`
- scope confirmation: confined to mirrored functionBank parity fencing for high-risk combat/economy seams; no unrelated runtime systems were changed in this lane.

- bead id: ORKA-x18
- summary of changes: Replaced swallowed entity update failures with bounded quarantine behavior after three consecutive faults, added stable entity attribution (`uid` or derived instance key), and recorded structured diagnostics in runtime globals for later inspection.
- files modified: Scripts/entities.js; tests/entityUpdateQuarantineContract.test.js
- test evidence:
  - `npm test -- tests/entityUpdateQuarantineContract.test.js` (2/2 pass)
  - Contract proves repeated failures stop at the quarantine threshold, writes trace/quarantine records with stable keys, and resets consecutive-failure count after a successful update before the next fault.
- scope confirmation: confined to entity lifecycle/update failure handling only; no combat rules, rendering, or game-loop ownership changes were introduced in this lane.

- bead id: ORKA-7kt
- summary of changes: Added a global developer tooling modal shell in the web runner with `Ctrl+Shift+P` hotkey access, config serialization in `state.globals`, safe live-apply controls for gold/board-color/combat-speed, and staged controls for hero count, enemy count, enemy type, and reward configuration exposed through `render_game_to_text` and `window.__codexGame`.
- files modified: web-runner/app.js; tests/devToolingModalContract.test.js
- test evidence:
  - `npm test -- tests/devToolingModalContract.test.js` (1/1 pass)
  - Contract guards the hotkey (`Ctrl+Shift+P`), modal field surface, runtime config writes, combat-speed multiplier seam, and debug-surface accessors.
  - Browser spot-check attempt via local server on `http://127.0.0.1:8092/web-runner/index.html` was blocked by the known Playwright MCP persistent-session startup error (`Opening in existing browser session`), so closeout relies on the deterministic contract plus runtime debug-surface serialization.
- scope confirmation: confined to the ORKA-7kt global dev-tooling modal shell in `web-runner/app.js`; no combat-rule changes or layout-specific UI rewrites were introduced.

- bead id: ORKA-7kt (reopen follow-up)
- summary of changes: Upgraded the dev tooling modal so `Apply` now refreshes combat with stored staged values, `Refresh Game` explicitly reseeds combat from the current config, hero-count changes flow into `initEntities`, forced enemy type filters the encounter pool, and reward drop selection is now a structured known-item select plus count instead of free text.
- files modified: web-runner/app.js; tests/devToolingModalContract.test.js
- test evidence:
  - `npm test -- tests/devToolingModalContract.test.js` (1/1 pass)
  - Contract now guards the refresh handler, apply+refresh button behavior, hero-count reseed seam, forced-enemy-type filtering, and structured reward-drop selection/count wiring.
- scope confirmation: confined to ORKA-7kt modal behavior and combat reseed plumbing for staged dev controls; no unrelated gameplay/system refactors were introduced.

- bead id: ORKA-7kt (final QA closeout)
- summary of changes: Stabilized the dev tooling modal apply path for live runtime use by switching to explicit hero/enemy slot selectors, immediate board fill on dev refresh, pause-safe modal behavior, and unique cloned-hero runtime identity so duplicate heroes do not share turns or actor state.
- files modified: web-runner/app.js; web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/devToolingModalContract.test.js; tests/devHeroCloneIdentityContract.test.js
- test evidence:
  - `npm test -- tests/devToolingModalContract.test.js tests/devHeroCloneIdentityContract.test.js` (2/2 pass)
  - User QA PASS: single-color board apply remains playable, dynamic hero swaps apply cleanly, and duplicate hero clones behave as separate runtime actors.
- scope confirmation: confined to ORKA-7kt dev tooling modal runtime behavior and mirrored hero identity handling needed to support duplicate hero slots; autoplay/idle mode remains separate under ORKA-5vf.

- bead id: ORKA-1ys (visual polish follow-up)
- summary of changes: Tightened the idle farming scene into a cleaner endless mock battle by removing visible hero/enemy labels, switching enemy hit flashes to the real combat-style inverted sprite flash instead of a white-box mask, increasing enemy defeat cadence to 3 hits, and adding visible enemy attack beats so the scene reads as a slow reciprocal fight rather than a hero-only firing line.
- files modified: web-runner/app.js; web-runner/src/core/idleFarmRuntime.mjs; tests/idleFarmLayoutScaffoldContract.test.js
- test evidence:
  - `npm test -- tests/idleFarmLayoutScaffoldContract.test.js tests/evolutionLayoutScaffoldContract.test.js` (4/4 pass)
  - Contract now guards the endless idle facade configuration (`loopForever`, two visible enemy slots, 3-hit enemies, 1.5s spawn delay) and asserts the old `Enemy Approaching...` plus visible hero/enemy label text are absent from the render branch.
- scope confirmation: confined to ORKA-1ys idle-farm presentation/rhythm polish only; no combat-system logic or dev-panel behavior was changed in this follow-up.

- bead id: ORKA-1ys (closeout split)
- summary of changes: Closed the idle-farm combat presentation lane after user-approved rhythm/staging polish and split the remaining reward/emission tuning into follow-up bead `ORKA-gxd` so the economy/display contract can proceed independently from the combat facade.
- files modified: agents/dev_reports.md; agents/pm_status.md
- test evidence:
  - `bd show ORKA-1ys` -> `CLOSED`
  - `bd show ORKA-gxd` -> `OPEN`
- scope confirmation: no gameplay/runtime code changed in this closeout step; this only records the scope split between completed idle-combat presentation and the new emission/display follow-up.

- bead id: ORKA-gxd
- summary of changes: Replaced the idle-farm placeholder reward seam with visible timer-based emissions every ~18 seconds using a faithful adapter of the game’s tiered monster-loot logic, surfaced all loot buckets in the idle strip, removed routed-count math from the player-facing display, and wired `Collect` to credit the shared token wallet plus gold.
- files modified: web-runner/src/core/idleFarmRuntime.mjs; web-runner/app.js; tests/idleFarmLayoutScaffoldContract.test.js
- test evidence:
  - `node --check web-runner/src/core/idleFarmRuntime.mjs` (pass)
  - `npm test -- tests/idleFarmLayoutScaffoldContract.test.js` (2/2 pass)
- scope confirmation: confined to ORKA-gxd idle-farm emission cadence, loot-bucket selection, reward ledger, and idle reward-strip display; no combat-presentation choreography changes were introduced in this lane.

- bead id: ORKA-1ys (reopen staging polish)
- summary of changes: Reopened the idle-farm combat presentation lane to stage actor entry more cinematically, with per-hero entrance timing, 1.5-second enemy arrivals after each lane hero enters, and lowered lane anchors so the two duels read more clearly before the regular idle battle loop takes over.
- files modified: web-runner/src/core/idleFarmRuntime.mjs; web-runner/app.js
- test evidence:
  - `node --check web-runner/src/core/idleFarmRuntime.mjs` (pass)
  - `npm test -- tests/idleFarmLayoutScaffoldContract.test.js` (2/2 pass)
- scope confirmation: confined to ORKA-1ys idle-farm entry choreography and lane staging only; the reward cadence/display changes remain under ORKA-gxd.

- bead id: ORKA-srm
- summary of changes: Fixed the idle-farm Collect path by routing claimed rewards through a shared wallet-commit helper, cloning the token wallet on credit, and recording an explicit `IdleFarmLastCollect` summary so wallet/debug surfaces can confirm the claim instead of only clearing the idle ledger.
- files modified: web-runner/src/core/idleFarmRuntime.mjs; web-runner/app.js; tests/idleFarmCollectWalletContract.test.js
- test evidence:
  - `node --check web-runner/src/core/idleFarmRuntime.mjs` (pass)
  - `npm test -- tests/idleFarmCollectWalletContract.test.js tests/idleFarmLayoutScaffoldContract.test.js` (4/4 pass)
- scope confirmation: confined to ORKA-srm idle-farm reward claim ownership and wallet credit visibility; no combat-presentation or unrelated resource systems were changed.

- bead id: ORKA-xyu
- summary of changes: Rebalanced the idle-farm loot adapter so gold now takes a fixed 40 percent share of emissions while the existing non-gold tier weights are renormalized proportionally, preserving their prior relative rarity ordering.
- files modified: web-runner/src/core/idleFarmRuntime.mjs; tests/idleFarmLootWeightContract.test.js
- test evidence:
  - `node --check web-runner/src/core/idleFarmRuntime.mjs` (pass)
  - `npm test -- tests/idleFarmCollectWalletContract.test.js tests/idleFarmLootWeightContract.test.js tests/idleFarmLayoutScaffoldContract.test.js` (5/5 pass)
- scope confirmation: confined to ORKA-xyu idle emission weighting only; the reward collection seam from ORKA-srm and the larger ORKA-gxd idle-emission QA lane remain otherwise intact.

- bead id: ORKA-4u7
- summary of changes: Fixed the main combat speed bleed by resetting `DevCombatSpeedMultiplier` to `1` on boot instead of hydrating it from persisted dev-tool config. Explicit dev apply still sets the multiplier on purpose, but stale QA settings no longer make normal combat start at an unintended accelerated rate.
- files modified: web-runner/app.js; tests/combatSpeedIsolationContract.test.js
- test evidence:
  - `npm test -- tests/combatSpeedIsolationContract.test.js` (1/1 pass)
  - Note: `node --check web-runner/app.js` is not a valid syntax check in this repo because `web-runner/app.js` is loaded as a browser ES module and Node parses it as CommonJS without package `type: module`.
- scope confirmation: confined to ORKA-4u7 combat-speed initialization only; no turn logic, timing rules, or combat formulas were changed.

- bead id: ORKA-bmv
- summary of changes: Fixed idle-layout entry to cold-boot through the same restart seam as the `Restart Run` button instead of preserving cached session state. This keeps the staged idle presentation deterministic on every entry while leaving the separate reward ledger intact.
- files modified: web-runner/app.js; tests/idleFarmLayoutScaffoldContract.test.js
- test evidence:
  - `node --check web-runner/src/core/idleFarmRuntime.mjs` (pass)
  - `npm test -- tests/idleFarmLayoutScaffoldContract.test.js` (2/2 pass)
- scope confirmation: confined to ORKA-bmv idle-farm entry boot semantics only; no reward ledger math, main combat behavior, or idle presentation choreography timings were changed.

- bead id: ORKA-eh1
- summary of changes: Split idle-farm reward accrual out of the visible theater session into a dedicated background emission ledger with its own cadence state. Idle emissions now continue accruing independently once started, Collect cashes out the current ledger and immediately restarts cadence without restarting the theater, and re-entering the layout still restarts only the staged visual session.
- files modified: web-runner/src/core/idleFarmRuntime.mjs; web-runner/app.js; tests/idleFarmCollectWalletContract.test.js
- test evidence:
  - `node --check web-runner/src/core/idleFarmRuntime.mjs` (pass)
  - `npm test -- tests/idleFarmCollectWalletContract.test.js tests/idleFarmLayoutScaffoldContract.test.js tests/idleFarmLootWeightContract.test.js` (6/6 pass)
- scope confirmation: confined to ORKA-eh1 idle emission ownership and cadence reset semantics only; no regular combat rules, idle theater choreography, or unrelated wallet systems were changed.
- bead: ORKA-3as
- summary of changes: Added an escort-party scaffold seam to combat bootstrap. `app.js` now supports an optional `state.globals.EscortPartyConfig`, builds a one-hero-plus-escort party layout when enabled, spawns the escort as a non-acting `kind: 'escort'` entity, stores `EscortNPCState` in globals, and renders the escort through the combat portrait roster without including it in initiative. Added a hot-file scope declaration at `.beads/hot-file-lock/ORKA-3as.scope`.
- files modified: web-runner/app.js; tests/escortPartyScaffoldContract.test.js; .beads/hot-file-lock/ORKA-3as.scope
- test evidence: `npm test -- tests/escortPartyScaffoldContract.test.js` (2/2 pass)
- scope confirmation: Confined to escort-party scaffold wiring in combat bootstrap/rendering only; no encounter design, targeting, or acting escort logic was introduced.
- bead: ORKA-l8sd
- summary of changes: Reconciled the product model between the older permanent-roster direction and the new Hall of Heroes legacy system. The ruling is now documented in `governance/product/game-function-reference.md`: permanent party units remain valid for the active four-slot roster, while temporary event allies now resolve into Hall relic/spirit legacy rewards instead of permanent roster bodies. Also narrowed the meanings of `ORKA-d9g` and `ORKA-v2s` so future implementation beads do not conflict.
- files modified: governance/product/game-function-reference.md
- test evidence: Policy/documentation decision bead; no runtime test required.
- scope confirmation: This lane only resolves product-model ownership and future bead direction. No gameplay/runtime code changed.
- bead: ORKA-jpvp
- summary of changes: Reprioritized the Hall of Heroes lane after product review. Marked the Hall epic and child beads as blocked/P3, recorded the prerequisite systems that must exist first, and kept the earlier product-model ruling as the active future-compatible truth.
- files modified: agents/pm_status.md
- test evidence: PM queue cleanup only; direct `bd show` verification on blocked Hall beads.
- scope confirmation: This lane only changed priority/dependency status and PM tracking. No runtime or product-rule implementation changed.
- bead: ORKA-qpff
- summary of changes: Optimized the hot-file scope enforcement hook by replacing the quadratic bash line/function scan with a single-pass Python validator over the staged changed-line set. This preserved the same hot-file policy checks while cutting runtime on the ORKA-luo staged diff from about 28m46s to 0.01s.
- files modified: tools/enforce_hot_file_scope.sh
- test evidence:
  - `/usr/bin/time -p bash tools/enforce_hot_file_scope.sh ORKA-luo` (pass; `real 0.01`)
- scope confirmation: Confined to tooling performance only. No gameplay/runtime policy was loosened; the hook still enforces one active bead, declared hot-file scopes, and function-only edits.

- bead id: ORKA-ysp
- summary of changes: Tuned the yellow randomize/bounce sequence to complete faster by shortening the telegraph, per-gem spin, and settle timings while keeping the ordered per-gem settle flow intact. Also updated the adjacent yellow gold-flyup contract to match the current gold-target owner seam.
- files modified: web-runner/app.js; tests/yellowSlamSequenceContract.test.js; tests/yellowGoldFlyupContract.test.js
- test evidence:
  - `npm test -- tests/yellowSlamSequenceContract.test.js tests/yellowGoldFlyupContract.test.js tests/functionBankParityContract.test.js` (5/5 pass)
- scope confirmation: Confined to ORKA-ysp yellow sequence timing and matching contract upkeep only; no yellow mechanic rules, reward math, or turn-gate semantics were changed.

- bead id: ORKA-vm7
- summary of changes: Removed gradient/heat-mapped floating combat text colors and replaced them with fixed approved palette values. Generic damage now renders flat red, healing renders flat cyan, and Kojonn DoT damage routes through a dedicated `dot` text kind for flat purple text without changing damage math.
- files modified: web-runner/app.js; web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/damageTextPaletteContract.test.js
- test evidence:
  - `npm test -- tests/damageTextPaletteContract.test.js tests/hitFlashFeedbackContract.test.js tests/functionBankParityContract.test.js` (7/7 pass)
- scope confirmation: Confined to ORKA-vm7 floating combat text palette selection and the minimal DoT text-kind payload seam only; no combat formulas, timing, or DoT lifecycle rules were changed.

- bead id: ORKA-i8n2
- summary of changes: Removed the hardcoded 4-hit cluster burst from the default red single-target attack path and preserved that presentation only behind a new explicit `Incinerate` harness seam. This keeps normal red attacks as one direct strike again so Double Attack follow-ups read clearly.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; tests/heroRedAttackPresentationContract.test.js; .beads/open/ORKA-i8n2.md; ai-memory/insights.md
- test evidence:
  - `npm test -- tests/heroRedAttackPresentationContract.test.js tests/extraTurnHarnessContract.test.js tests/functionBankParityContract.test.js tests/doubleAttackRadiatorContract.test.js tests/devToolingModalContract.test.js` (9/9 pass)
- scope confirmation: Confined to the red single-target presentation seam and an explicit Incinerate harness only; no AoE behavior, dev-panel controls, or Double Attack proc logic changed.

- bead id: ORKA-daa4
- summary of changes: Reworked Double Attack into a real free follow-up strike harness with repeatable per-turn proc behavior, retarget-on-death support, and event-gated presentation pacing. Final accepted behavior now waits for the first strike readout to finish before starting the second attack sequence.
- files modified: web-runner/modules/functionBank.js; Scripts/functionBank.js; web-runner/app.js; tests/extraTurnHarnessContract.test.js; .beads/open/ORKA-daa4.md
- test evidence:
  - `npm test -- tests/extraTurnHarnessContract.test.js tests/doubleAttackRadiatorContract.test.js tests/devToolingModalContract.test.js tests/functionBankParityContract.test.js` (10/10 pass)
- scope confirmation: Confined to Double Attack harness semantics, pacing, and visibility only; no unrelated turn-order mechanics or baseline attack ownership changed.

- bead id: ORKA-sklg
- summary of changes: Added a minimal reference log for explicit combat skill harnesses and moved explanatory usage notes into a separate product notes file.
- files modified: governance/product/skill-harness-log.md; governance/product/skill-harness-notes.md
- test evidence: Documentation/governance lane; no runtime test required.
- scope confirmation: Logging only. No gameplay/runtime behavior changed.

- bead id: ORKA-bm41
- summary of changes: Fixed the idle combat respawn crash by rehydrating stored forced enemy names from session state before idle enemy respawns call `createEnemy(...)`. Added a focused regression contract so forced dev-tool enemy loadouts cannot drop out of scope during idle session updates.
- files modified: web-runner/src/core/idleFarmRuntime.mjs; tests/idleFarmForcedEnemyNamesContract.test.js; .beads/open/ORKA-bm41.md; ai-memory/insights.md; agents/pm_status.md
- test evidence:
  - `npm test -- tests/devToolingLoadoutContract.test.js tests/idleFarmLayoutScaffoldContract.test.js tests/idleFarmForcedEnemyNamesContract.test.js` (4/4 pass)
- scope confirmation: Confined to the idle runtime forced-enemy-name respawn seam only; no idle autoplay priority, reward cadence, or dev-panel write behavior changed.

- bead id: ORKA-zys
- summary of changes: Reconciled the repo-side `.beads/open` and `.beads/in_progress` mirrors against live `bd` state, removed stale cache entries, added missing live entries, and moved `ORKA-zys`/`ORKA-y5x` into the correct mirrored status directories so local governance artifacts no longer disagree with live queue state.
- files modified: .beads/open/*.md; .beads/in_progress/*.md
- test evidence:
  - `bd list --status open`
  - `bd list --status in_progress`
  - `bd ready`
  - mirror-vs-live `comm` diff for `.beads/open` vs live open ids (empty after reconciliation)
  - mirror-vs-live `comm` diff for `.beads/in_progress` vs live in-progress ids (empty after reconciliation)
- scope confirmation: Confined to mirror/governance reconciliation only. No gameplay/runtime code or product rules were changed.

- bead id: ORKA-wao
- summary of changes: Replaced the old placeholder hero-skill presentation map with a three-skill CS/JS dataset per hero, loaded the provided skill icon sprite sheet, and rendered masked circle/diamond node art directly into the live hero-screen skill frames and modal path.
- files modified: `web-runner/app.js`; `web-runner/src/core/heroSkillPresentation.mjs`; `tests/heroSkillPresentationContract.test.js`; `.beads/blocked/ORKA-wao.md`
- test evidence:
  - `node --test tests/heroSkillPresentationContract.test.js` -> 2 passed, 0 failed
  - browser runtime: `agent-browser` on `http://127.0.0.1:8000/web-runner/index.html` -> Falie hero screen shows Block / Shield Bash / Bounce masked node icons; Huun hero screen shows Steal / Lift / Assault masked node icons
- discovery lane comparison: `debugger` was unnecessary; this was a presentation/data-lane change in the hero-screen render seam with one real runtime bug found by browser QA (sprite-sheet scope leak) and fixed in the same cycle
- pilot value signals: token cost `low`; operator overhead `medium`; reusable output `yes` (sprite-sheet crop metadata + masked circle/diamond node renderer)
- scope confirmation: Confined to hero-screen presentation data and rendering. No skill wiring, proc logic, combat math, or progression behavior changed.

- bead id: ORKA-dmg
- summary of changes: Hardened combat damage numbers so the canvas fallback is no longer globally suppressed by the DOM overlay layer before an individual DOM animation is confirmed. The renderer now keeps per-entry fallback available, and the overlay bounds are re-synced during render.
- files modified: `web-runner/app.js`; `tests/damageNumberTimelineContract.test.js`; `tests/damageTextPaletteContract.test.js`; `ai-memory/insights.md`; `progress.md`; `.beads/in_progress/ORKA-dmg.md`
- test evidence:
  - `node --test tests/damageNumberTimelineContract.test.js tests/damageTextPaletteContract.test.js tests/damageTextFormattingContract.test.js` -> 13 passed, 0 failed
  - `node --test tests/hitFlashFeedbackContract.test.js` -> 3 passed, 0 failed
- discovery lane comparison: not used on this bead
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (per-entry fallback guard for overlay-owned combat text)
- scope confirmation: Confined to combat damage-text rendering fallback hardening and contract updates. No combat math, damage formulas, or balance logic changed.

- bead id: ORKA-h9q
- summary of changes: Added a mirrored hero leveling system with a deterministic Lv1-99 XP curve, per-hero XP state, kill-based XP awards wired into the enemy-death / AwardMonsterDrop seam, and a validation simulation for pacing bands.
- files modified: `Scripts/functionBank.js`; `web-runner/modules/functionBank.js`; `tests/heroLevelingContract.test.js`; `.beads/blocked/ORKA-h9q.md`
- test evidence:
  - `node --test tests/heroLevelingContract.test.js tests/huunExecutionDropBonusContract.test.js` -> 7 passed, 0 failed
- discovery lane comparison: not used on this bead
- pilot value signals: token cost `low`; operator overhead `low`; reusable output `yes` (deterministic progression helper + kill-award seam)
- scope confirmation: Confined to mirrored combat/progression runtime helpers and a focused validation test. No UI or governance files were changed for this bead.
