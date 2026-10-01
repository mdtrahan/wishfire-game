# Goal — Deliver the Wishfire adaptation specs and active user stories

Authorized by the owner to work in a new GPT 6.1 Sol High thread. This goal covers the complete active spec pack, not only the lamp modal.

## Objective

Implement the approved direction across fresh adventure, hero EXP progression, independent progress feedback, equipment review, lamp rarity upgrades and guidance. Meet each active spec’s acceptance criteria and each active user story’s criteria with player-facing video evidence. Complete missing reference skill/gacha research before proposing its adaptation.

## Sources and scope

Read README.md, user-stories.md and every numbered sheet in this folder. Build a criterion matrix mapping each active story and spec acceptance item to current behavior, required change, focused check and video timestamp. Existing behavior that already passes needs verification rather than duplicate implementation.

Active stories: US-05, US-06, US-15, US-25, US-26, US-27, US-30, US-35 and US-36. US-23 was consolidated into US-36. US-08/09/10 are on research hold; US-31 and US-32 were withdrawn.

Active feature/proof sheets: 01 fresh adventure, 02 EXP/cadence, 04 progress feedback, 05 equipment/dismantling, 06 lamp tiers/gear bounds, 07 guidance and 09 player-facing proof. Sheet 03 owns the missing research checklist. Sheet 08 is a withdrawal notice and authorizes no charge system.

## Work sequence

1. Read applicable AGENTS chains and current product rules. Resolve the lamp checkout/main state, existing bead ownership and prior checkpoints. Preserve unrelated work. Use one scoped implementation bead/lane at a time under repository policy.
2. Establish the fresh Lv1 baseline and separate hero EXP feedback from lamp tier. Reuse passing storage/equipment behavior; validate it against sheet 05. Add stable review pausing under US-15 without silently enabling Auto afterward.
3. Implement and measure the EXP/cadence tuning trial under sheet 02. Its 150-draw, eight-second and 22–30 minute values remain explicit trial hypotheses. Record normal-play timing and waiting versus useful action time. Request owner choice where competing EXP policies remain unresolved; continue independent work.
4. Complete US-36’s lamp upgrade modal using current tier/resource hooks: current lamp level, current/next effective rarity percentages, essence price, confirmation, exact single deduction and applied odds. Calibrate US-25 prices from earned essence batches. Implement the party rarity gates and item-level band only with their stated proposal/approval status clearly resolved. Preserve positive HP and no SPD gear rules.
5. Extend guidance through the actual upgrade loop. No invented defeat recommendation, combat fuel, resource-holding incentive, timer or speedup economy.
6. Complete sheet 03 research by playing the reference through all five slot conditions and exercising skill/ally gacha. Log acquisition, slot unlock/equip/upgrade conditions, currencies, duplicate handling and information exposure. Infer a binding formula only where evidence supports it. Bring newly evidenced skill adaptations and stories to the owner for approval before implementing them. Do not reuse withdrawn milestone or free Unlock assumptions.
7. Record the full player-facing Wishfire flow after changes. Compare annotated frames against approved visual references at equal viewport size. Correct failures and replay the complete flow before handoff.

## Owner decisions and boundaries

Work on the active scope is authorized. Numeric proposals are tuning trials, not established balance. Record explicit decisions on battle EXP versus Spend EXP, save migration, final rarity gates/scaling, essence prices and any new skill adaptation. Do not stall the whole goal when one decision blocks only one part; finish independent authorized work and report the unresolved criterion.

The lamp generates gear indefinitely over time while storage has room and cadence permits. Raw burps have no CP filter. Dismantling grants essence only. Auto Equip accepts positive total hero CP changes, at most one item per hero and four total. Manual downgrades remain allowed. Stored leftovers committed to dismantling cannot be rescued. Reward is a brief essence banner. No early skill access is invented from incomplete reference research.

## Definition of Done

- Every active spec and story criterion has a documented PASS, or an explicit owner-resolved exception. A blocked/unverified criterion prevents claiming the entire goal complete.
- Existing passing foundations are preserved; changes implement the actual deltas. Persistence, exact-once essence spending/rewards, odds normalization and eligibility have focused checks.
- Continuous player-facing video proves fresh start, correct hero EXP rollovers, normal progression pacing, Auto state, stable complete equipment review, responsive CP floats, dismantling/banner, lamp upgrade cost/benefits and guidance. Provide timestamps and annotated comparison frames.
- Skill/ally research evidence covers the missing conditions; unresolved formula claims are labeled. Any new implementation follows owner-approved stories.
- Deliver the acceptance matrix, timing/resource ledger, videos, changed files, remaining decisions and a validated checkpoint/rollback path. Follow current Integration Ready rules before any merge; do not claim integration from feature tests alone.

## Handoff context

Root checkout: /Users/Mace/Codex-Orka. Previous lamp lane: /Users/Mace/Codex-Orka/.worktrees/wt-ORKA-0ln-lamp, last preview localhost:8027. Verify these live before use. Spec files are currently uncommitted in the root checkout and must be carried into an implementation lane deliberately. Do not discard existing root or lamp-lane changes.

Reference evidence in reference-evidence/shana-lamp-upgrades.md confirms tier 1→2 at 6,000 coins plus five minutes and one tutorial speedup ticket, with rarity gains. It does not establish Wishfire prices or justify importing charges, timers or premium resources. In-game reference currency use is authorized; real-money lanes are excluded.
