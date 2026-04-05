# Development Reports

Active handoff file only. Historical implementation reports live in `/agents/archive/dev_reports_archive.md` and should not be read during normal startup unless historical investigation is required.

## Template
- bead id:
- summary of changes:
- files modified:
- test evidence:
- discovery lane comparison:
- pilot value signals:
- scope confirmation:

## Recent Reports
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
