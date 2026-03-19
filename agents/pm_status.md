# PM Status

_Last updated: 2026-03-07_

---
_Last updated: 2026-03-17_

## Completed Beads
- ORKA-daa4 (Double Attack now means an immediate free second single-target strike with retarget-on-death semantics, while the dev-panel toggle and side-panel proc counter remain intact)
- ORKA-qr88 (dev-panel duplicate hero/enemy slots now apply again; loadout changes rebuild the active combat/idle session sensibly and idle layout honors dev-tool overrides)
- ORKA-u4h (dev idle autoplay now prioritizes free frame-6 energy gems before normal triplets and uses the approved fallback triplet priority: PURPLE, HEAL, GREEN/RED, YELLOW, BLUE)
- ORKA-6mq (entity update failures already quarantine after the configured threshold with stable diagnostics; stale open mirror reconciled to done)
- ORKA-daa4 (dev panel can now stage Double Attack on/off for any hero without moving turn state, and the side panel mount now visibly shows holder/chance/proc count)
- ORKA-ju42 (dev idle mode now auto-resolves pending enemy selection instead of stalling on QA-only clicks)
- ORKA-mwl (speed-only repeat turns fenced off; explicit extra-turn skill harness now moves cleanly between heroes and long-run live proc rate calibrates at ~5%)
- ORKA-c4s (hero gem progress persistence and milestone hook seam verified still green; stale open mirror reconciled to done and browser reload/restore path re-verified)
- ORKA-fp9 (debuff lifecycle reliability hardening verified still green; stale open mirror reconciled to done)
- ORKA-3m8 (yellow completion extra-turn lane closed with restored handoff regression contracts and no runtime drift found)
- ORKA-5mt (idle combat hit flashes now match the approved black flash used in full combat; QA-passed)
- ORKA-xnz (neutral hit-flash feedback retuned to black at lighter opacity and QA-passed)
- ORKA-wuh (core trait runtime/proc framework already exists in mirrored function-bank owner seams and passes the surviving framework contract pack)
- ORKA-ysp (yellow fill now uses regular fill cadence and bounce behavior, keeps ordered sequence, and removes preview/strobe noise)
- ORKA-vm7 (combat text palette simplified to flat approved colors with QA-passed white enemy damage, red hero damage, cyan healing, and purple Kojonn DoT)

## Active Work
- None.

## Next Tasks
- Clean backlog mirrors for already-redacted/obsolete beads separately from runtime work.

## Known Issues
- Browser automation remains blocked in-session by the known Chrome crashpad/bootstrap permission failure, so current proof is deterministic contracts and live server availability.
- Repo-side `.beads/` mirror still lags live `bd` and should not be treated as authoritative for executable scope.

---
_Last updated: 2026-03-13_

## Completed Beads
- ORKA-jpvp (Hall of Heroes lane reprioritized behind hero skill/live-ops prerequisites)

## Active Work
- Hall of Heroes epic (`ORKA-0x85`) and child beads are now blocked/P3.

## Next Tasks
- Do not schedule Hall implementation ahead of:
  - final hero/character skill definitions
  - live-ops quest framework
  - recruit/hero content pipeline
  - event entry/exit rules
  - reward grant/economy contracts
- Keep the Hall ruling as compatibility guidance only until those systems mature.

## Known Issues
- `bd ready` can lag after bulk priority/status changes; use direct `bd show` for Hall beads when verifying the blocked/P3 state.

---
_Last updated: 2026-03-13_

## Completed Beads
- ORKA-l8sd (reconciled permanent roster direction with Hall of Heroes legacy model)

## Active Work
- Hall of Heroes planning remains active under `ORKA-0x85` and its child beads.

## Next Tasks
- Treat `ORKA-d9g` as the permanent player-owned formation system only.
- Treat `ORKA-v2s` as recruit/subordinate/world-discovery acquisition, not Hall-only legendary event heroes.
- Use Hall beads for temporary event allies whose lasting progression is relic + Spirit rather than permanent roster ownership.

## Known Issues
- The Hall model is now product-correct, but runtime implementation beads still need to express how temporary event allies appear during scenarios without implying permanent ownership.

---
_Last updated: 2026-03-13_

## Completed Beads
- None in ORKA-3as yet; escort-party scaffold is implemented and under QA review.

## Active Work
- ORKA-3as (escort NPC party scaffold with variable hero count)
  - Added runtime seam `EscortPartyConfig` for a one-hero-plus-escort party layout.
  - Escort renders in combat presentation but remains a non-acting `escort` entity outside initiative.

## Next Tasks
- Runtime QA with an escort config enabled to confirm escort visibility and no escort turn ownership.
- Keep future escort targeting/protection rules as separate follow-up scope; this bead is scaffold-only.

## Known Issues
- Current proof is deterministic contract coverage only; no browser QA has been run yet for the escort presentation path.

---
_Last updated: 2026-03-12_

## Completed Beads
- ORKA-1ys (idle farming layout now replaces the old astral/layout-2 stub with a visual Falie/Kojonn mock battle, scripted one-by-one enemy flow, and return routes to combat or camp)

## Active Work
- None in this lane.

## Next Tasks
- Use `web-runner/src/core/idleFarmRuntime.mjs` as the evolution seam for future AFK reward scaling, subordinate identity swaps, and eventual non-placeholder idle squad presentation.
- Keep any later combat-stat integration out of this layout unless the product direction changes; it is intentionally a timed reward facade, not real combat simulation.

## Known Issues
- Browser-runtime spot check was attempted, but Playwright MCP launch failed in this session with the existing persistent-session startup issue; contract tests and local server verification passed.

---
_Last updated: 2026-03-10_

## Completed Beads
- ORKA-r9z (Evolution Tree runtime scaffold added with seven-level ladder, research-gate placeholders, and Vault retention routing)

## Active Work
- None in this lane.

## Next Tasks
- If Vault-family progression work continues, use `evolutionLayout` as the shell for future soft-currency upgrade and research-node follow-up beads.

## Known Issues
- Browser-runtime spot check was attempted, but Playwright MCP launch failed in this session with the existing persistent-session startup issue; contract tests passed.

---
_Last updated: 2026-03-10_

## Completed Beads
- ORKA-094 (full jdocmunch repository index completed and verified)

## Active Work
- None in this lane.

## Next Tasks
- Use repo id `local/Codex-Orka` for subsequent jdocmunch retrieval calls in this session.

## Known Issues
- `jdocmunch` exposes document sections and hierarchy rather than a code-style symbol graph export.

---
_Last updated: 2026-03-10_

## Completed Beads
- ORKA-0zk (full non-incremental jcodemunch repository index completed and verified)

## Active Work
- None in this lane.

## Next Tasks
- Use repo id `local/Codex-Orka-f7dcaf91` for subsequent jcodemunch retrieval calls in this session.

## Known Issues
- The MCP surface used here verifies fresh repo/symbol inventory after indexing, but does not expose a separate user-facing “symbol graph export” command in this session.

---
_Last updated: 2026-03-10_

## Completed Beads
- ORKA-maq (repo-local Codex agent retrieval rule file added under `.codex/agent_rules.md`)

## Active Work
- None in this lane.

## Next Tasks
- Use `.codex/agent_rules.md` alongside repo AGENTS/governance guidance when future agent lanes need symbol-first code exploration.

## Known Issues
- This rule file is repo-local guidance only; it does not replace external Codex home config.

---
_Last updated: 2026-03-10_

## Completed Beads
- None in ORKA-boj; repo-side retrieval guidance and MCP indexing are in place, but the exact home-level MCP config/install path is blocked.

## Active Work
- ORKA-boj (`[CHORE] Configure MCP retrieval servers for Codex-Orka`) is blocked on sandbox/home-write limits and invalid npm package names in the task text.

## Next Tasks
- Outside this sandbox, update the real Codex home config with the correct MCP server entries and package launch commands.
- Keep using the already-available `jcodemunch` / `jdocmunch` MCP servers in-session for retrieval work.

## Known Issues
- This session cannot write `~/.codex/config.json`.
- `jcodemunch-mcp`, `jdocmunch-mcp`, `jcontextmunch-mcp`, and `jcodemunch` are not resolvable on npm as written in the task instructions, so the install/CLI validation steps fail with `E404`.

---
_Last updated: 2026-03-10_

## Completed Beads
- ORKA-a1k (combat QA and Playwright control model documented as canonical guidance for future QA/tutorial/spec work)

## Active Work
- None in this lane.

## Next Tasks
- Use `governance/qa/combat-playwright-control-model.md` before future combat QA or automation beads.
- Keep future Playwright and manual QA acceptance language aligned to true hero-input windows and transition waits.

## Known Issues
- The guide reflects current runtime truth, but any future changes to turn gating, refill policy, or follow-up action UX must update the document.

---
_Last updated: 2026-03-10_

## Completed Beads
- ORKA-4m4 (balance harness energy-depletion stop contract completed and verified in bounded CDP-attached prelim runs)
- ORKA-jwx (Power Amp lifecycle telemetry added for harness trust; bounded prelim runs now emit `power_amp_trace.json`)

## Active Work
- None in this lane.

## Next Tasks
- Open a follow-up bead for enemy overfill / respawn distortion before trusting full CP balance recommendations.
- After that fix, rerun a larger balance sample (`BALANCE_SESSION_COUNT` in the hundreds or thousands) using the now-working CDP harness path.

## Known Issues
- Live gameplay still does not hard-stop at energy depletion; the harness must declare and enforce that boundary explicitly for balance analysis.
- Bounded prelim runs succeed, but combat can temporarily overfill beyond the expected enemies-per-wave, which makes the current CP recommendation non-authoritative.

---
_Last updated: 2026-03-10_

## Completed Beads
- ORKA-gxn (game function reference for FAQs, tutorials, and future bead specs)

## Active Work
- None in this lane.

## Next Tasks
- Use `governance/product/game-function-reference.md` as the first product-writing reference before drafting FAQ/tutorial/spec beads.
- Expand the reference only when live runtime behavior changes, not for speculative future design.

## Known Issues
- The reference reflects current runtime truth, but some progression layouts remain scaffold-only and should not be described as fully shipped systems.

---
_Last updated: 2026-03-10_

## Completed Beads
- ORKA-91m (`.beads` mirror contradictions removed; remaining mismatch set is `bd`-only missing mirrors, which is acceptable under live-`bd` authority)

## Active Work
- No active bead after `.beads` reconciliation closeout.

## Next Tasks
- Continue from the next ready live-`bd` bead.
- Optionally remove stale non-issue `.beads/hot-file-lock/*.scope` artifacts in a separate cleanup lane if they are no longer needed.

## Known Issues
- Repo-side mirrors are now non-contradictory, but they are intentionally incomplete relative to live `bd`.

---
_Last updated: 2026-03-10_

## Completed Beads
- ORKA-1qo (energy session balance harness via Playwright recovered with CDP attach mode and smoke-run artifact generation)

## Active Work
- None in this lane.

## Next Tasks
- For full balance sampling, start Chrome with a debug port and run `npm run balance-harness` with `BALANCE_CDP_URL=http://127.0.0.1:9222`.
- Review the generated `output/balance-harness/` artifacts before acting on the CP recommendation.

## Known Issues
- Direct Node Playwright browser spawn still aborts in this sandbox; the supported working path here is CDP attach to an already-running Chrome instance.

---
_Last updated: 2026-03-10_

## Completed Beads
- None in ORKA-1qo; implementation is present but the bead remains blocked.

## Active Work
- ORKA-1qo (`[CHORE] Energy session balance harness via Playwright`) is blocked on environment-level Playwright browser launch failure from the Node harness process.

## Next Tasks
- Re-run `npm run balance-harness` on a host where Playwright can launch Chrome normally, then review `output/balance-harness/` artifacts and decide whether the CP recommendation is actionable.

## Known Issues
- In this sandbox, Playwright-launched Chrome aborts before page control begins (`SIGABRT`, Crashpad/bootstrap permission errors), even when launched through the known system Chrome executable path.

---
_Last updated: 2026-03-10_

## Completed Beads
- None in ORKA-4ws inventory pass; cleanup scope has been bounded but not yet destructively applied.

## Active Work
- ORKA-4ws (cleanup inventory): live `bd` is authoritative, but repo-side `.beads/` mirrors are materially stale and the worktree remains mixed.

## Next Tasks
- Split dirty worktree by lane before deleting or rewriting any `.beads/` mirror files.
- Reconcile mirror files only after runtime/governance/tooling edits are isolated enough to avoid accidental loss.

## Known Issues
- Mirror mismatch examples: `ORKA-7c0` (`bd=open`, mirror=`in_progress`), `ORKA-hsf`/`ORKA-mwl` mirror-only in-progress lanes, and many mirror-only open lanes absent from live `bd`.
- Dirty worktree breakdown at inventory time: 24 mirror files, 8 governance files, 6 runtime files, 3 tests, 4 tooling files.

---
_Last updated: 2026-03-10_

## Completed Beads
- ORKA-dme (combat damage/heal numbers now use a hard pure-black offset drop shadow; contract pass + user QA pass)

## Active Work
- No additional bead claimed in this visual-fix cycle.

## Next Tasks
- Continue from the next explicitly assigned or ready bead.

## Known Issues
- None newly introduced by ORKA-dme.

---
_Last updated: 2026-03-10_

## Completed Beads
- ORKA-6nk (canonical Codex-Orka Beads process added under governance/execution)

## Active Work
- No additional bead claimed in this process-hardening cycle.

## Next Tasks
- Use `governance/execution/beads-process.md` as the canonical repo-specific Beads workflow reference.
- Keep future Beads policy changes centralized there instead of expanding `AGENTS.md`.

## Known Issues
- `bd` read-after-write inconsistency still warrants double-read confirmation on stateful transitions.

---
_Last updated: 2026-03-10_

## Completed Beads
- ORKA-xtz (workflow policy now treats live `bd` as authoritative and documents the `~/.local/bin` PATH prerequisite)

## Active Work
- No additional bead claimed in this governance correction cycle.

## Next Tasks
- Reconcile stale repo-side `.beads/` mirrors against live `bd` state in a separate cleanup lane.
- Split unrelated dirty hot-file work before reviewing or closing another runtime bead from this worktree.

## Known Issues
- Historical entries below still mention direct `.beads/` fallback; they remain as log history, not current policy.

---
_Last updated: 2026-03-09_

## Completed Beads
- ORKA-dzt (combat power now respects magic-primary offense and unknown-type fallback; targeted contract passes)

## Active Work
- No additional bead claimed in this cycle after ORKA-dzt closeout.

## Next Tasks
- Reconcile stale `.beads/` repo files against live `bd` state before the next PM-Dev cycle so lane selection does not drift.
- Split unrelated dirty work in `web-runner/app.js`, `web-runner/modules/functionBank.js`, and `Scripts/functionBank.js` before reviewing another bead from this worktree.

## Known Issues
- Shell `PATH` omitted `~/.local/bin`; `bd` was installed but not resolvable until PATH repair.
- Repo-side `.beads/` files do not currently match live `bd` issue state.

---
_Last updated: 2026-03-09_

## Completed Beads
- ORKA-cpb (doctrine metadata follow-up lane closed by contract evidence)

## Active Work
- ORKA-7c0, ORKA-hsf, ORKA-mwl remain in-progress legacy lanes.

## Next Tasks
- Continue executable lanes with explicit scope/acceptance.
- Rewrite or decompose `null`-body open beads before assigning to dev.

## Known Issues
- `ORKA-6n7`, `ORKA-900`, `ORKA-9yo`, `ORKA-9ri`, `ORKA-c4s`, `ORKA-f0l`, `ORKA-ksw`, `ORKA-njg`, `ORKA-pv3`, `ORKA-wuh`, `ORKA-hvj.4` are open but currently non-executable due missing spec body.

---
_Last updated: 2026-03-09_

## Completed Beads
- ORKA-wbk (center-slot strongest CP assignment + full-wave KO packaged repick)

## Active Work
- In-progress legacy lanes remain: ORKA-7c0, ORKA-hsf, ORKA-mwl.

## Next Tasks
- Run runtime QA sweep for ORKA-wbk:
  - verify center slot always strongest CP on non-solo starts,
  - verify side slots vary run-to-run,
  - verify full-wave KO repick follows same center rule.
- Resolve or decompose `null`-body governance beads (`ORKA-6n7`, `ORKA-900`, `ORKA-9yo`) before attempting execution.

## Known Issues
- `bd` CLI is unavailable in this shell; bead state is being managed directly under `.beads/`.

---
_Last updated: 2026-03-09_

## Completed Beads
- ORKA-jj0 (yellow -> gold fly-up lane closed as completed; stale-open hygiene fix)

## Active Work
- Planning->implementation bridge prepared for center-slot CP placement:
  - ORKA-wbz (plan done)
  - ORKA-wbk (implementation open)

## Next Tasks
- Execute ORKA-wbk (center-slot strongest + random sides + solo commander mode guard).
- Defer `ORKA-6n7`, `ORKA-900`, `ORKA-9yo` until scope is written (currently `null` bodies).

## Known Issues
- Multiple listed P1 beads remain non-executable due missing spec content (`null` definitions).

## Completed Beads
- ORKA-jmf (yellow-match completion regression stabilized; multi-pass checks clean)

## Active Work
- ORKA-cpc (in_progress):
  - encounter request injection hook (`setEncounterRequest`)
  - map-return CP policy stub (`warMeter -> targetCP/policy`)
  - policy/faction contract hardening

## Next Tasks
- Drive `EncounterLocale`/`EncounterFaction` from concrete map-node metadata once map schema is finalized.
- Promote behavior-level (non-regex) solver tests when builder is moved to a dedicated shared module.

## Known Issues
- Debug-only `BOARD_INTEGRITY` logs remain too noisy at error level when `ok=true` (cleanup follow-up).

---
_Last updated: 2026-03-07_

## Completed Beads
- ORKA-jmf (yellow-match completion regression stabilized; multi-pass checks clean)

## Active Work
- ORKA-cpc (in_progress): CP-budget encounter system hardening and caller-owned encounter request integration.

## Next Tasks
- Add faction/policy behavior coverage tests (solo commander, fodder-only, mixed fit quality).
- Wire map/tower stub to call `setEncounterRequest` before combat entry.

## Known Issues
- Debug-only `BOARD_INTEGRITY` logs are noisy at error level even when `ok=true`; non-blocking, should be downgraded in a cleanup bead.

---
_Last updated: 2026-03-07_

## Completed Beads
- None in this cycle (ORKA-jmf remains active until user QA confirmation).

## Active Work
- ORKA-jmf (in_progress): yellow-match completion regression fix + multi-pass validation + insights traceback.

## Next Tasks
- QA yellow matching interactively in runtime and close ORKA-jmf on confirmation.
- Resume ORKA-cpc after ORKA-jmf closure.

## Known Issues
- Existing debug diagnostics still emit noisy `BOARD_INTEGRITY` error-level logs even on `ok=true`; functional blocker cleared but log hygiene follow-up recommended.

---
_Last updated: 2026-03-07_

## Completed Beads
- None in this traceability correction cycle.

## Active Work
- ORKA-cpc (in_progress): CP-budget encounter builder + strict locale narrative filter + doctrine metadata normalization now formally tracked in Beads lane.

## Next Tasks
- Close ORKA-cpc after gameplay QA pass and bead closeout commit.
- Continue ORKA-cpb for doctrine taxonomy/content migration follow-ups only.

## Known Issues
- `bd` CLI unavailable in this shell; Beads state reconciled via `.beads/` files directly to preserve policy traceability.

---
_Last updated: 2026-03-06_

## Completed Beads
- ORKA-mwl (turn flow unscheduled back-to-back fix + blue handoff sequencing)
- ORKA-z0b (hero selector consistency)
- ORKA-855 (hit-flash opacity + alpha mask fix)
- ORKA-cxi (rollback ORKA-jj0 regression)
- ORKA-9hl (yellow->gold without fly-up)

## Active Work
- ORKA-69r blue lane closeout verification

## Next Tasks
- Finalize ORKA-69r and close if QA remains clean
- Continue player-facing feature lanes after blue lane closure

## Known Issues
- Netlify path/deploy issues are tabled until product flow prioritizes deployment hardening
- Hero-screen progression binding lane remains blocked on product specification decisions

## Execution Kernel Improvements
- Assignment bottleneck reduced: workers may claim the highest-priority READY bead when PM has not explicitly assigned one that cycle.
- Autonomy improved: `/agents/**` coordination files are formally reporting-only and ignored by workers unless a bead explicitly scopes them.
- Safeguards introduced:
  - queue availability target (maintain at least 3 READY beads when possible)
  - repeated-failure decomposition requirement (>2 failed reviews)
  - scope-drift rejection and documentation in `/agents/issues.md`

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-dwg (Combat power index added to hero/enemy runtime arrays for gating stubs)

## Active Work
- Resume prioritized scaffold queue after user-prioritized combat-power indexing lane.

## Next Tasks
- ORKA-axd (Pets scaffold), then ORKA-c1j (Vault scaffold).

## Known Issues
- None newly introduced in ORKA-dwg; formula is deterministic and surfaced for downstream consumers.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-a0k (Chests layout scaffold: mission-nav entry, deterministic tabs/progress/reward shell)

## Active Work
- Continue prioritized layout scaffold queue.

## Next Tasks
- ORKA-axd (Pets scaffold) and ORKA-c1j (Vault scaffold).

## Known Issues
- None newly introduced in ORKA-a0k; mechanics intentionally scaffold-only.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-51g (Homestead layout scaffold: map locale entry, deterministic scene metadata, runtime shell)

## Active Work
- Continue prioritized layout scaffold queue.

## Next Tasks
- ORKA-a0k (Chests scaffold) and ORKA-axd (Pets scaffold).

## Known Issues
- None newly introduced in ORKA-51g; mechanics intentionally scaffold-only.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-khb (Collectibles layout scaffold: map locale entry, deterministic gallery metadata, runtime shell)

## Active Work
- Continue prioritized layout scaffold queue.

## Next Tasks
- ORKA-51g (Homestead scaffold) and ORKA-a0k (Chests scaffold).

## Known Issues
- None newly introduced in ORKA-khb; mechanics intentionally scaffold-only.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-8k4 (Mounts layout scaffold: map locale entry, deterministic gallery metadata, runtime shell)

## Active Work
- Continue prioritized layout scaffold queue.

## Next Tasks
- ORKA-khb (Collectibles scaffold) and ORKA-51g (Homestead scaffold).

## Known Issues
- None newly introduced in ORKA-8k4; mechanics intentionally scaffold-only.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-3e4 (Artifacts layout scaffold: map locale entry, deterministic gallery/passive metadata, runtime shell)

## Active Work
- Continue prioritized layout scaffold queue.

## Next Tasks
- ORKA-8k4 (Mounts scaffold) and ORKA-khb (Collectibles scaffold).

## Known Issues
- None newly introduced in ORKA-3e4; mechanics intentionally scaffold-only.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-7pi (Tomes layout scaffold: map locale entry, deterministic gallery state, and runtime shell)

## Active Work
- Continue prioritized layout scaffold queue.

## Next Tasks
- ORKA-n0g (Relics scaffold) and ORKA-c1j (Vault scaffold) from current P1 readiness order.

## Known Issues
- None newly introduced in ORKA-7pi; mechanics intentionally left as scaffold-only.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-fp9 (debuff lifecycle reliability hardening)

## Active Work
- Preparing ORKA-9ri (Kojonn DoT/debuff support conversion) now that ORKA-fp9 blocker is resolved.

## Next Tasks
- Close ORKA-fp9 in Beads after commit and proceed with ORKA-9ri implementation.

## Known Issues
- None new in this cycle.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-6gt (Falie enmity target-bias with capped guardrail)

## Active Work
- Queue health check and next class-identity slice selection.

## Next Tasks
- Reframe ORKA-9ri to align with skill/passive model before implementation.

## Known Issues
- None new in this cycle.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-2sa (Runa magic-resist trigger vs enemy caster magic paths)

## Active Work
- Continue class identity slices aligned to skill/passive progression model.

## Next Tasks
- ORKA-mo4 (Huun execution drop bonus) or ORKA-69r QA closeout.

## Known Issues
- ORKA-9ri remains intentionally held for scope reframing to avoid RPG-style persistent debuff model drift.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-mo4 (Huun execution drop bonus chance via existing TH drop pipeline)

## Active Work
- Queue continuing through aligned class-identity + wallet/progression lanes.

## Next Tasks
- ORKA-69r QA closeout or ORKA-9hl cleanup/closure alignment.

## Known Issues
- ORKA-9ri remains on hold pending model-aligned rewrite.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-69r (QA contract lock for blue->Astral wallet and no direct blue stat apply)

## Active Work
- Continue aligned backlog slices (non-RPG timer-stack model).

## Next Tasks
- ORKA-9hl closure cleanup and/or queue governance bead cleanup.

## Known Issues
- ORKA-9ri still requires acceptance rewrite before implementation.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-xnz (hit-flash feedback contract lock)

## Active Work
- Continuing low-conflict cleanup/hardening beads.

## Next Tasks
- ORKA-ohb (regen debug noise cleanup) as next low-risk runtime hygiene slice.

## Known Issues
- ORKA-9ri remains held pending acceptance rewrite.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-ohb (regen debug noise contract lock)

## Active Work
- Continue queue on low-conflict, model-aligned slices.

## Next Tasks
- ORKA-y5x / ORKA-zys governance cleanup, then revisit high-priority epic slicing.

## Known Issues
- ORKA-9ri still pending rewrite for model alignment.

---

_Last updated: 2026-03-07_

## Completed Beads
- ORKA-6x3 (yellow per-gem slam settle sequence)

## Active Work
- Priority queue shifted toward layout scaffolds (tomes/relics/vault/chests/evolution/homestead/pets/artifacts/mounts/collectibles).

## Next Tasks
- Begin first layout scaffold implementation bead from new P1 queue.

## Known Issues
- ORKA-9ri still pending model-aligned rewrite before execution.

---
_Last updated: 2026-03-07_

## Completed Beads
- ORKA-cpc (CP-budget encounter wiring complete: builder spawn path, map request stub, caller-owned request API)

## Active Work
- ORKA-cpb (in_progress): doctrine taxonomy/content migration follow-up and consistency contracts

## Next Tasks
- Finalize doctrine taxonomy pass across current placeholder roster.
- Keep locale/faction defaults stable for future enemy additions via contract tests.

## Known Issues
- `bd` CLI is unavailable in this shell session; Beads file-state updates are being applied directly under `.beads/`.

---
_Last updated: 2026-03-07_

## Completed Beads
- ORKA-cpb (doctrine metadata follow-up complete: taxonomy consistency + default fallback contracts)

## Active Work
- ORKA-cpc (in_progress): final hardening/traceability pass for map encounter-node request authority

## Next Tasks
- Resolve underspecified P0 bead bodies (`null` scope) so priority queue is executable again.
- Promote next fully-specified runtime bead once P0 scopes are clarified.

## Known Issues
- Several open P0 beads are currently header-only and blocked by missing scope/acceptance content.

---
_Last updated: 2026-03-08_

---
_Last updated: 2026-03-10_

## Completed Beads
- ORKA-9gv (functionBank mirror parity fence for high-risk combat seams)

## Active Work
- None in this request lane.

## Next Tasks
- ORKA-x18 (quarantine repeatedly failing entity updates)
- ORKA-l8r (guard fallback game loop against duplicate intervals)

## Known Issues
- `Scripts/functionBank.js` and `web-runner/modules/functionBank.js` still contain broader non-authoritative drift outside the curated parity fence; future mirrored combat-rule beads should either expand the fence or collapse ownership into a single source seam.

---
_Last updated: 2026-03-10_

## Completed Beads
- ORKA-x18 (entity update failures now quarantine after repeated faults with stable attribution)

## Active Work
- None in this request lane.

## Next Tasks
- ORKA-l8r (guard fallback game loop against duplicate intervals)
- ORKA-boj (still blocked on external Codex MCP config/install path)

## Known Issues
- Entity quarantine is currently a runtime-local fence in `Scripts/entities.js`; if a future browser/runtime path starts depending on the same entity update seam, mirror or extract that behavior rather than reintroducing swallow-and-continue handling.

---
_Last updated: 2026-03-11_

## Completed Beads
- ORKA-7kt (global dev tooling modal shell with `Ctrl+Shift+P` access)

## Active Work
- None in this request lane.

## Next Tasks
- User runtime QA of the new dev modal hotkey and staged/live controls.
- ORKA-3as (escort NPC + variable hero-count scaffold) is the natural follow-up if party-count control should drive a real gameplay seam next.

## Known Issues
- `ORKA-7kt` currently applies gold, board-color, and combat-speed live; hero/enemy count, enemy type, and reward settings are staged into globals/debug surfaces for future combat seeding rather than fully rewiring every runtime subsystem in this first shell.
- Browser spot-check was blocked by the known Playwright MCP persistent-session startup error in this terminal session.

---
_Last updated: 2026-03-11_

## Completed Beads
- ORKA-7kt reopen follow-up (Apply now refreshes combat with staged config; reward drop input is structured)

## Active Work
- None in this request lane.

## Next Tasks
- User runtime QA on the refreshed dev-tooling modal.
- ORKA-3as remains the next logical gameplay scaffold if variable hero count should extend into escort/NPC party behavior.

## Known Issues
- `ORKA-7kt` still caps hero count at 4 and enemy count at 6 in tooling because the current combat/layout surfaces are still authored around those bounds.

## Completed Beads
- ORKA-f0l (Layout 1 hero gem-usage counter radiator with per-hero + party color totals)
- ORKA-c4s (persistent hero gem counter state + milestone hook surfaces for future Vault progression)

## Active Work
- None in this request lane.

## Next Tasks
- Decide which Vault-child progression shell should consume the saved gem milestone surfaces first.

## Known Issues
- Beads still shows occasional read-after-write lag; use direct `bd show <id>` confirmation after close.

---
_Last updated: 2026-03-10_

## Completed Beads
- ORKA-jdu (Vault family lock-up: Relics rename + Pets scaffold)
- ORKA-1ol (Queue hygiene: closed obsolete Vault/Pets duplicate scaffold beads)
- ORKA-sht (Full queue audit: closed stale duplicate/policy beads and verified no dangling in-progress work)
- ORKA-s0v (Chimerilass heals now support crit/non-crit runtime behavior with browser multipass verification)

## Active Work
- None in this request lane.

## Next Tasks
- Hold further Vault layout work until art team delivers the next Figma layouts.
- If/when Relics resumes, treat ORKA-n0g as future gameplay-hook work, not another scaffold/rename pass.

## Known Issues
- `bd ready` can briefly show recently closed beads even when direct `bd show <id>` already reports `CLOSED`.

---
_Last updated: 2026-03-09_

## Completed Beads
- ORKA-jj0 (reopen regression fix: frame-6 click restored to deterministic energy gain)
- ORKA-jj0 (reopen timing fix: yellow gold total now updates at fly-up arrival, not before)
- ORKA-3m8 (yellow completion extra-turn regression lane closed with handoff contract tests)

## Active Work
- None in this lane.

## Next Tasks
- User runtime QA on frame-6 click behavior during combat.

## Known Issues
- `bd` CLI unavailable in shell; bead state maintained directly in `.beads/` files.

---
_Last updated: 2026-03-09_

## Completed Beads
- ORKA-cpc (CP-budget encounter builder lane closed; explicit-seed + history-aware contract drift resolved)

## Active Work
- ORKA-7c0 (EPIC hero screen lane remains in progress)
- ORKA-hsf (hero Figma compliance bug lane remains in progress)
- ORKA-mwl (initiative extra-turn regression lane remains in progress)

## Next Tasks
- Convert one in-progress lane to review-ready state with concrete acceptance evidence (recommend ORKA-mwl first due to P0 priority).
- Normalize stale bead status hygiene for any lane with completed implementation but missing closeout metadata.

## Known Issues
- `bd` CLI is not available in this shell session (`command not found`); bead-state operations are being applied directly in `.beads/`.

## Completed Beads
- None newly closed this pass.

## Active Work
- ORKA-cpc (in_progress): final CP encounter normalization hardening complete; awaiting lane closure decision.

## Next Tasks
- Close ORKA-cpc after final QA checkpoint.
- Continue ORKA-cpb only if additional doctrine content migration is requested.

## Known Issues
- Open P1/P2 queue is largely non-executable (`null` issue bodies) except ORKA-cpc/ORKA-cpb.

---
_Last updated: 2026-03-08_

## Completed Beads
- ORKA-jj0 (yellow->gold fly-up behavior confirmed in runtime + contract tests)

## Active Work
- Legacy bead-state reconciliation in progress (open vs implemented runtime)

## Next Tasks
- Continue status cleanup for open beads already evidenced in dev_reports/tests.
- Keep only truly unstarted/unimplemented beads in open queue.

## Known Issues
- Conflicting legacy bead ORKA-9hl moved to blocked; contradicts current shipped yellow fly-up behavior.

---
_Last updated: 2026-03-08_

## Completed Beads
- ORKA-hlc (closed obsolete; blue-match buffs removed by product direction)

## Active Work
- Backlog/bead decision cleanup to align queue with current non-buff gem model.

## Next Tasks
- Continue P0/P1 decision-gated bead closures/rewrites one-by-one.

## Known Issues
- Legacy open queue still contains stub beads needing explicit keep/close/scope decisions.

---
_Last updated: 2026-03-08_

## Completed Beads
- None newly closed in this pass.

## Active Work
- ORKA-hsf (in_progress): Hero screen Figma 1:3 compliance implementation complete; pending visual QA confirmation.

## Next Tasks
- Visual compare runtime Hero screen vs Figma node 1:3 and resolve remaining pixel-level variance.

## Known Issues
- Browser MCP localhost access is unreliable on current network, so visual validation may require user-side runtime check.

---
_Last updated: 2026-03-08_

## Completed Beads
- None newly closed this pass.

## Active Work
- ORKA-mwl (in_progress): initiative repeat-turn regression fix implemented with queue sanitizer + explicit-extra provenance gate.

## Next Tasks
- Runtime QA confirm: no hero stacking in initiative order under repeated turn advancement.
- Close ORKA-mwl after user validation.

## Known Issues
- MCP Playwright transport is unstable in this session; CLI Playwright remains available for screenshots/QA fallback.

## Completed Beads
- ORKA-spt (party skill points seeded to 300 + multipass spend/cap validation complete)

## Active Work
- ORKA-mwl remains in_progress (initiative queue regression verification/closure lane).

## Next Tasks
- Resume highest-priority READY/in_progress bead with executable scope.

## Known Issues
- `bd` CLI remains unavailable in-shell; bead file-state updates continue via direct `.beads/` file edits.

---
_Last updated: 2026-03-08_

## Completed Beads
- ORKA-lod (startup loading staged + parallelized)
- ORKA-bar (enemy HP bar distortion fix)

## Active Work
- Continue highest-priority remaining in-progress bead after runtime QA confirmation.

## Next Tasks
- Runtime QA: verify perceived first-load improvement and enemy bar visual quality in live combat scene.

## Known Issues
- `bd` CLI unavailable in current shell; bead state updated directly in `.beads/` files.

---
_Last updated: 2026-03-08_

## Completed Beads
- ORKA-lod (load staging + parallelized core startup)
- ORKA-bar (enemy HP bar distortion rendering fix)
- ORKA-lpb (Layout 0 loading/progress bar implementation)

## Active Work
- None in this lane.

## Next Tasks
- Runtime QA pass on perceived startup time and loading bar behavior under cold cache.

## Known Issues
- `bd` CLI unavailable in shell; Bead status maintained directly in `.beads/` files.

---
_Last updated: 2026-03-08_

## QA Pass
- Startup/load regression retest: PASS
- Full sprite preload before runtime activation confirmed.
- Layout 0 loading/progress bar confirmed visible through bootstrap.

---
_Last updated: 2026-03-08_

## Completed Beads
- ORKA-vlt (Vault nav rename + retention button move Map -> Chests)
- ORKA-l0p (Layout 0 loading bar moved to bottom mobile style)

## Active Work
- None in this request lane.

## Next Tasks
- User visual QA of chests top-rail buttons and new loading bar placement.

## Known Issues
- None newly introduced in this lane.

---
_Last updated: 2026-03-08_

## Completed Beads
- ORKA-mxc (Map `Return Combat` replaced with Hero-style circle `X` close control)

## Active Work
- None in this lane.

## Next Tasks
- User runtime QA confirmation on Map close-control interaction and drag/pan behavior.

## Known Issues
- `bd` CLI unavailable in shell; bead state maintained directly in `.beads/` files.

---
_Last updated: 2026-03-08_

## Completed Beads
- ORKA-ysp (yellow randomize+bounce timing tuned faster with preserved anticipation)

## Active Work
- None in this lane.

## Next Tasks
- User runtime QA confirmation on perceived yellow sequence pace.

## Known Issues
- `bd` CLI unavailable in shell; bead state maintained directly in `.beads/` files.

---
_Last updated: 2026-03-08_

## Completed Beads
- ORKA-4c0 (hero-screen pack asset usage check + local-first policy)

## Active Work
- None in this lane.

## Next Tasks
- Optional runtime visual QA on hero screen controls under offline/slow-network conditions.

## Known Issues
- `bd` CLI unavailable in shell; bead state maintained directly in `.beads/` files.

---
_Last updated: 2026-03-08_

## Completed Beads
- ORKA-qpff (hot-file scope hook runtime optimized from ~28m46s to ~0.01s on the ORKA-luo staged diff)
- ORKA-7kt (global dev tooling modal runtime controls; QA passed for live apply, dynamic hero swaps, and duplicate hero clone identity)
- ORKA-gsb (per-slot gem backers behind board gems with explicit rollback toggle)
- ORKA-cmh (reopen regression fix: Chimerilass heal threshold strictness restored)
- ORKA-1ys (idle farming combat presentation/layout complete; emission contract split to ORKA-gxd)
- ORKA-1ys (reopened staging polish; QA passed for dramatic entry, lane positioning, and reduced damage-flash intensity)
- ORKA-srm (idle Collect now credits shared gold/token wallet state through a single helper seam)
- ORKA-xyu (idle emission weights rebalanced so gold owns 40 percent share and non-gold tiers retain proportional rarity)
- ORKA-4u7 (regular combat speed no longer hydrates from stale dev-tool speed settings on boot)
- ORKA-bmv (idle layout entry now cold-boots through Restart Run seam instead of resuming cached theater state)
- ORKA-eh1 (idle emissions now accrue independently of the visible theater session and Collect restarts emission cadence without restarting the scene)

## Active Work
- None in this lane.

## Next Tasks
- Revisit ORKA-gxd only if user wants another runtime polish pass on emission presentation.
- ORKA-5vf (dev panel autoplay until energy depletion) remains separate from the player-facing idle farm lane.
- Follow ORKA-3nlw / ORKA-pmf cleanup ordering for the remaining local runtime/UI diff now that ORKA-luo is committed and the hot-file hook is no longer a time sink.

## Known Issues
- `bd` is available via `~/.local/bin/bd`; default shell PATH is still inconsistent, so direct path use remains safer in automation turns.

---
_Last updated: 2026-03-13_

## Completed Beads
- ORKA-i8n2 (default red single-target restored to one strike; old cluster burst isolated behind explicit Incinerate harness)
- ORKA-daa4 (Double Attack dev-panel harness now performs a readable repeatable free second strike with retarget support)
- ORKA-sklg (durable harness-skill product log added)

## Active Work
- None in this lane.

## Next Tasks
- Add new harness skills to the product log as they are accepted.
- Consider enemy-facing harness assignment tooling when the next authored enemy skill lane is claimed.

## Known Issues
- `bd` CLI unavailable in shell; bead state maintained directly in `.beads/` files.
