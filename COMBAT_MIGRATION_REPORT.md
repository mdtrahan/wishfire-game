# Combat migration implementation report

## Current revision: results layout, death-only FLOW and ground bounce

Results now occupy 80% of the game canvas width and height, centered horizontally and vertically over a canvas-sized 40% black shade. Resize tracking preserves these proportions. Browser geometry gate: 250/250 passed at `test-results/ui-lock/2026-09-08T18-31-43-283Z/ui-lock-report.json`; all five viewport profiles include victory captures. Natural in-app proof:672×903 CSS viewport/DPR2,507×903 canvas,405.59×722.40 centered results panel; both ratios measured0.8000. Shade matched the complete canvas at rgba(0,0,0,0.4). No browser errors. The updated victory panel is left visible.

Enemy target triangles now render only during hero turns and hide at combat end. Target selection persists across enemy turns. Eight focused selector/command checks and renderer syntax validation passed.

Enemy defeat now awards FLOW orbs once per enemy. The default reward is one 10-FLOW orb; count/value remain configurable. Nonlethal attacks and all former role triggers generate no orbs. This supersedes the preceding attack-drop/passive implementation.

The renderer calls the original blue death-orb frame function, preserving its spill, three diminishing ground bounces and eased flight. Random living-hero distribution and charge on arrival remain. Victory settles combat and EXP immediately; the progression dialog waits until orb presentation finishes. SP, slots and CTB scheduling are unchanged.

Validation: **799 Node tests passed, 0 failed, 73 unchanged historical skips**. Updated tests cover death-only generation, no role-event drops, duplicate prevention, multikills, delayed collection and reuse of the old tween. Browser gate: **241/241 passed**. Receipt: `test-results/ui-lock/2026-09-08T15-05-27-856Z/ui-lock-report.json`. Inspected the reference ground-bounce screenshot; captures cover all five viewport profiles. In-app inspection remained unavailable because the Mac was locked.

Local implementation in `codex/ORKA-49k.7-astral-spending`. The preview is served from this worktree at `http://localhost:8047/web-runner/index.html`. Main and production have not been changed.

## Delivered behavior

| Area | Runtime implementation |
| --- | --- |
| Hero data | Fara, Hondo, Runa and Kaja each have seven active skills, six passives, one basic attack and a unique FLOW special. Combat and the hero screen share these definitions. |
| Progression | Individual level-1 acquisition, versioned saves, configurable level-50 cap, escalating EXP, per-hero growth and data-driven unlocks. Every victorious participant receives the full sum of defeated-enemy EXP, including KO heroes. Multiple levels resolve before results. Living HP gains only the max-HP difference; KO stays at zero. |
| Turn selection | SPEED determines the acting hero. `actionSlotsPerTurn` limits the queue independently of SP and known skills. Current kits default to three slots as configurable tuning. Mixed capacities are supported. A full queue commits automatically; ACT commits early. |
| SP | Encounters start at full SP. Living heroes regenerate five SP at their own turn start. Queues reserve their actual costs; unexecuted actions refund their costs. Remaining SP carries forward. Removing a draft entry restores its slot and reservation. |
| Targeting | Battlefield clicks select enemies persistently. A single-target skill captures that selection when queued. AoE captures its defined group. There is no target dropdown or separate Queue button. Queued targets remain independent after later selection changes. |
| FLOW | Each hero starts at zero with a red FLOW meter. Defeated enemies award orbs to random living heroes; former role modes are retired metadata. FLOW specials own the whole turn, preserve SP and cannot generate their caster's FLOW through their effects or reactions. |
| Effects | Generic statuses, stronger-magnitude refresh, affected-unit turn durations, snapshot DoT/HoT and simultaneous periodic resolution. Routine ticks generate no FLOW; qualifying kill outcomes remain eligible. |
| KO and revival | Ordinary statuses clear on KO, explicitly persistent effects survive, FLOW is preserved, and revival returns the actor to normal scheduling. |
| Target resolution | Tag-based Silence and Blind, separate accuracy/evasion, newest Provoke, newest eligible Cover, covering defender's defenses, original-target fallback after coverer KO. |
| Reactions | Counters resolve after the whole skill and before the next queued action, once per surviving defender, in current SPEED order with stable UID ties. Revalidation precedes each reaction. Counters cost no SP, consume no scheduled turn and cannot counter another counter. |
| Victory | Final enemy KO cancels remaining actions and refunds them before EXP, growth and unlock processing. A native results dialog presents the settled progression. |
| Hero screen | Canonical level/EXP, HP, SP, stats, role, FLOW earning rule, action capacity, all active/passive unlocks, costs, tags and unique special. The screen exposes no separate skill-level economy. |

## Code ownership and cleanup

- `web-runner/src/core/heroDefinitions.mjs`: authored kits and configurable tuning.
- `heroProgression.mjs`: individual growth, unlocks and once-only battle settlement.
- `actionSelection.mjs`: capacity, reservations and battlefield target capture.
- `combatRules.mjs`: effects, status timing, targeting, reaction order and FLOW attribution.
- `web-runner/modules/heroCommands.mjs`: validates and resolves the sequence through the existing lunge/presentation handoff and damage owner.
- `heroCommandUI.mjs`, `renderHeroScreen.js`, `heroProgressStorage.js` and `questCombatSession.mjs`: presentation, persistence and encounter lifecycle.

The live command path has one canonical skill catalog and one effect resolver. The old hero skill-rank screen and gem-progress storage were replaced. Shared AF UI and milestones are gone. Party-card acquisition remains paused; its old frame-based regeneration and enemy periodic entrypoints were disconnected. Native damage ignores the parked shared shield. Retired board/refill animation flags cannot block native action claiming or turn advancement.

Historical puzzle/card definitions and isolated helpers remain in the existing registry for reference. This is not a claim that every historical symbol has been deleted. They are not the source of current hero kits, personal resources or periodic effects. The two function-bank files retain their pre-existing differences; both received the corresponding migration edits.

## Validation

- Full Node suite: **791 passed, 0 failed, 73 skipped**; 864 total. Skips are labeled historical paused card/shared-AF cases. Obsolete active-timer and shared-shield expectations were replaced with retirement checks or removed with their retired behavior.
- App orchestration boundary: **4 passed**.
- Hot-file gate: **11 passed**; initiative fairness audit **PASS (benign)**.
- Browser checks cover groups 1–6, battlefield clicks, persistent target selection, exact SP costs, early commitment, automatic commitment for capacities 1/2/3, current-actor glow, FLOW spending, and reference/compact/narrow/Retina containment.
- A real native attack triggered victory, awarded 3000 fixture EXP to both participants including a KO hero, processed multiple levels and unlocks, and opened the production progression dialog.
- Natural in-app preview: **709×1239 CSS pixels, DPR 1**, canvas **696×1239**. Observed target selection, queue removal restoring 100 SP/three slots, one-skill ACT spending 20 SP, Hondo earning FLOW and the next actor becoming active. No browser errors were returned in that check.

Final browser gate: **236/236 passed**. Receipt: `test-results/ui-lock/2026-09-08T07-06-13-982Z/ui-lock-report.json`. Hero-screen Skills, Passives and FLOW Special tabs passed across all five viewport profiles. The arena selector resolves the current actor by UID.

Local checkpoint: the commit containing this report on `codex/ORKA-49k.7-astral-spending` (`bd-ORKA-49k.7`).

## Scope limits

Costs, growth, FLOW rates and three-slot defaults are placeholder tuning. This pass does not certify final encounter balance. Only the four existing heroes are authored; one-to-six-member groups are valid. Commercial acquisition, extra heroes, multi-hero stored combinations, catch-up EXP and the paused roguelite card system remain outside this implementation.

The lane is preserved for review. This report does not certify integration against current main or authorize deployment.

## Hero management revision (in progress)

The existing hero screen now uses HERO / GEAR / SKILLS, a persistent portrait and roster, concise level milestones, and expandable full stats. Active, passive and FLOW categories remain canonical. The owner subsequently authorized a placeholder equipment catalog. Gear now manages the same persisted inventory purchased through Astral Flow. See EQUIPMENT_MIGRATION_REPORT.md for scope and validation. Enemy-death FLOW remains authoritative.
