# Wishfire progression adaptation proposals

Status: owner review. These sheets propose future goals; they authorize no implementation. Each numbered sheet can become one scoped goal after its open decisions are approved.

## Review stories

[Feature-by-feature user stories](user-stories.md) cover proposed additions and changes only, with player intent, concrete change, acceptance criteria and approval choices. Existing requirements remain in their owning specs.

## Authorized goal handoff

[Full implementation goal](implementation-goal.md) covers active spec acceptance criteria and user stories, with research holds and withdrawals preserved.

## Recommendation and order

Start with reliable fresh-state and independent hero/lamp progress displays, then trial EXP costs and lamp cadence. Skill adaptations are on research hold. Wishfire draws require no fuel resource; combat charges are withdrawn.

| Order | Spec | Purpose |
|---|---|---|
| 1 | [Fresh adventure](01-fresh-adventure.md) | Make the starting state trustworthy |
| 2 | [EXP and cadence](02-exp-and-cadence.md) | Give early levels deliberate pacing |
| Research hold | [Skill acquisition](03-skill-acquisition.md) | Trace all slots and acquisition before proposing changes |
| 4 | [Progress feedback](04-progress-feedback.md) | Show what leveled and what remains |
| 5 | [Equipment decisions](05-equipment-decisions.md) | Preserve manual judgment and quick Auto Equip |
| 6 | [Lamp tiers and gear bounds](06-lamp-tiers-and-gear-bounds.md) | Protect rarity and power progression |
| 7 | [Guidance](07-guidance-and-defeat.md) | Explain the lamp upgrade loop |
| Withdrawn | [Combat-earned charges](08-combat-earned-charges.md) | Unlimited draws bounded by storage and cadence |
| Every goal | [Player-facing proof](09-player-facing-proof.md) | Verify the delivered experience on video |

## Evidence and limits

The [Shana study](../../../.worktrees/wt-ORKA-0ln-lamp/test-results/shana-study/study.md) reached player Lv5 after 29 manual draws: 10 empty-slot equips and 19 recycled pieces. Recycling visibly supplied EXP; empty-slot equips did not. Required EXP was 350, 400, 500 and 600, totaling 1,850. The player ended with 31 EXP overflow. Its device stayed Lv1, and Auto required Lv16 or a paid monthly card. Combat replenished draw charges. Item comparison used signed total CP, permitting individual-stat reductions.

The measured 38m13s from first control to Lv5 includes inspection, notes and browser troubleshooting. It cannot establish ordinary human pacing. StoneAge findings come from supplied screenshots and flow descriptions, with no measured progression run.

The Wishfire lamp lane currently uses 25 EXP per successful draw, a two-second manual minimum, five-second Auto interval and party Lv5 Auto gate. Its recorded lamp-only Lv5 run took 69 draws and 2m50.616s. See [existing proof review](../../../.worktrees/wt-ORKA-0ln-lamp/output/qa/lamp-to-level5-fixed-review.md). These are lane observations, not confirmation that main contains the same build.

## Lamp upgrade follow-up

[Verified research](reference-evidence/shana-lamp-upgrades.md) now covers tier 1→2 costs, timer and ticket consumption, plus tier 3's odds preview. Wishfire essence prices need an income trial. The [lamp upgrade goal plan](lamp-upgrade-goal-plan.md) proposes instant upgrades initially; timers require separate approval.

## Owner rules retained

All four heroes receive EXP when a lamp draw succeeds. Dismantling grants resources only. Essence funds lamp upgrades. Raw items enter storage without CP filtering; the five-slot strip represents arrivals. The equip frame sorts the whole batch by descending CP. Manual equipment can reduce CP. Auto Equip takes at most four upgrades, one per hero, matching equipment slots and requiring a positive total hero CP change. Remaining gear enters irreversible dismantle storage; conversion requires Dismantle All. Its reward uses one essence asset and a transient banner.

## Decisions to reconcile

The earlier [hero progression plan](../../../.worktrees/wt-ORKA-0ln-lamp/governance/planning/hero-exp-skill-unlock-plan.md) proposed banked battle EXP, Spend EXP and skill milestones 2/3/4/6/8. Those remain proposals. The EXP sheet proposes automatic lamp-earned levels. Later skill milestones are withdrawn pending acquisition research. Approve one coherent progression model before implementation. Reconcile older combat documentation with the current realtime kits rather than importing obsolete SP/FLOW behavior.

## Current tuning decision

Owner chose “Keep current tuning”: retain the existing EXP curve and manual2s/Auto5s cadence. Sheet02’s eight-second/150-draw trial and1500 floor are declined; normal progression proof remains required. Other pending owner decisions remain explicit in the acceptance matrix.

The [primary-hero ownership defect](hero-owner-decision.md) still reproduces on candidate `4338182d`: canonical Fara owns the equipped stats while her `falie#1` combat actor receives none. The repair remains open under ORKA-5af.3; its save-owner/migration choice precedes runtime changes. Current Hero-screen CP presentation and Fara formation work do not resolve this ownership seam.
