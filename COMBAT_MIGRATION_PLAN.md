# Wishfire combat migration plan

Planning document • 7 September 2026

Replace gem-driven combat with direct hero commands beneath the existing arena. Players deploy one to six owned heroes, manage individual survival, and spend Astral Flow on solo or coordinated specials while continuing to earn roguelite party buffs.

Wishfire is an HTML5 game played in desktop and mobile browsers. Core combat controls must work with a mouse, touch or keyboard. Desktop support is part of this migration's scope.

This document defines the requested scope and the work required to deliver it. **Confirmed requirements are fixed. Proposed rules require a design decision before their dependent implementation begins.** No game code, configuration, saves or repository files have been changed for this plan.

## 1. Confirmed requirements

- Remove the gem board and replace its screen area with compact black command panels.
- Retain the arena, existing character identity and reusable combat presentation.
- Support a collectible roster with one to six deployed heroes.
- Make each hero's HP determine their survival, targeting and KO state. Retire shared party HP as a survival rule.
- Ordinary hero and enemy turns follow SPEED order. Only the scheduled actor takes an ordinary action; prepared commands do not override initiative.
- Use explicit buttons for combat commands, with ordinary click, tap and keyboard activation. Execute each hero through its own button. Remove the global Execute Round button. Swipe and drag commands are excluded.
- Preserve Astral Flow in the upper-left. It powers individual specials, smaller combinations and a full-group special.
- Preserve player-selected, party-wide roguelite buffs earned through Astral Flow, including stacking rules and combat-session lifetime.
- Keep the Astral Flow bar slim and text-free. Place tiny diamond face portraits directly on its notches, ordered by SPEED from fastest to slowest.
- Display exactly one notch per deployed hero, evenly spaced at fractions of the full bar.
- Reaching a SPEED-ordered milestone makes its pictured hero eligible for an AF special. With six members and 2/6 charge, only the first two milestone heroes qualify.
- Astral Flow is one shared spendable balance. Early specials deplete it and trade progress toward full-bar opportunities for an immediate combat advantage. Full charge enables the card draw and full-party combination options. Preserve the player's choice of how to spend or save it.
- Fill the six card positions down the left column, then down the right. Keep unused positions at the end of that order.
- Use small cropped face portraits. Keep concise functional button labels; omit role labels, readiness words, redundant action-description rows, helper sentences and decorative captions from party cards.

## 2. Screen and interaction specification

### Party screen

[Party-screen mockup](/Users/Mace/.codex/visualizations/2026/09/07/01a07dda-cd54-7de3-a3af-369c03d9d3c0/01-party-commands.png)

Use two columns of three fixed card positions:

| Row | Left column | Right column |
| --- | --- | --- |
| Top | Member 1 | Member 4 |
| Middle | Member 2 | Member 5 |
| Bottom | Member 3 | Member 6 |

A four-member party occupies all three left positions and the upper-right position. The other two frames contain no placeholder text. KO never moves a card into another position.

Each occupied card contains a small cropped portrait, name, compact HP/MP values with thin bars, and explicit action buttons. MP remains a proposed normal-skill resource. Communicate availability, resolution, spent activation and KO through portrait treatment, borders, icons or animation. Provide accessible state descriptions without adding visible explanatory copy.

Button-based input is confirmed. Opening the action editor and executing a prepared action use separate, visible buttons within each occupied hero card. The portrait and card background are informational. Remove the earlier split-card hit-area proposal.

**Planned compact controls:** an Actions button opens the editor; an execution button shows the prepared command's short name, such as Attack or Ward. Changing the command updates that button. Its accessible name includes the hero, command and selected target. The command name serves as functional button text, avoiding a separate description row. Keep portraits small and allocate space to usable buttons. Exact sizing and short labels require layout validation.

| Intent | Mouse | Touch | Keyboard / assistive technology |
| --- | --- | --- | --- |
| Open hero actions | Click Actions button | Tap Actions button | Focus Actions, then activate with Enter/Space or the platform action |
| Execute prepared action | Click named execution button | Tap named execution button | Focus the execution button, then activate |
| Open AF selector | Click the button containing the AF bar | Tap the button containing the AF bar | Focus the AF button, then activate |
| Choose a skill/target or use Set Action/Back | Click its button | Tap its button | Focus and activate its button |

Use standard button activation, focus and browser scrolling. Provide non-overlapping button hit areas, accessible names and visible keyboard focus. Opening Actions must never trigger execution. Scrolling, dragging, pointer cancellation or release outside a button must not commit a command. Exclude custom gesture recognizers, swipe/drag commands, long-press actions, right-click requirements and hover-only controls. Skill lists remain scrollable through ordinary browser inputs.

Keep repeated play efficient: executing an already prepared command takes one button activation; changing it uses Actions, command/target selection and Set Action. Avoid extra confirmation dialogs for ordinary actions. Reload and Repeat retain their defined shortcuts. The AF bar remains slim and text-free inside a single semantic button, with an accessible name and an adequate hit area; no extra visible frame or permanent label is required.

Keep the footer controls Auto, Repeat, Reload and Menu. Their behavior is defined in section 3. Avoid adding permanent instructions above or below the cards.

### Hero action screen

[Hero-action mockup](/Users/Mace/.codex/visualizations/2026/09/07/01a07dda-cd54-7de3-a3af-369c03d9d3c0/02-hero-actions.png)

Keep the arena and upper-left Astral Flow visible. Show a compact hero header, available commands, costs, useful short effect descriptions, target selection, Back and Set Action.

Set Action stores the command and target, then returns to the party screen. It spends no resource and launches no effect. Back cancels the current edit. Activating that hero's named execution button then executes the stored choice.

An Astral Flow special opens the common participant selector with that hero preselected when eligible. The bar opens the same selector directly. Use one execution path for both entry points.

The mockups establish composition. The button requirements in this document supersede their earlier input layout; the images have not been revised to show these buttons. Their MP values, skill costs and proposed skill names require tuning and kit approval. Exact geometry, portrait crops, mouse/touch/keyboard behavior and six-actor arena placement require validation in the future playable implementation.

### Desktop and mobile constraints

Keep the bar's visual footprint small while giving the whole widget an adequate invisible touch region. Tiny diamond portraits need not be separate touch targets.

Allow long skill lists to scroll within the editor. Protect the footer and primary controls from safe-area overlap. Validate at the smallest supported viewport, including the existing compact-stage case, before finalizing dimensions. Preserve focus order, input cancellation, readable numbers and non-color state cues.

## 3. SPEED-ordered normal combat

**Confirmed model:** heroes and enemies take ordinary turns in SPEED order. Retain the existing initiative foundation and adapt its command and individual-HP dependencies. The player selects and executes the scheduled hero's ordinary action; scheduled enemies act through their AI. There is no freely ordered party phase followed by a separate enemy phase.

Basic Attack is the proposed initial command. The player may prepare commands for other heroes, but those heroes' ordinary execution buttons remain unavailable until their scheduled turn. Clearly distinguish normal-turn availability from milestone-based AF availability. Whether AF may interrupt the normal order is still a decision below.

Preparation is editable. Launch is a commitment:

1. Validate the actor, target, command, resource balance and current status.
2. Spend the resource once and consume the normal activation.
3. Resolve effects and triggered reactions in deterministic order.
4. Present the result and advance to the next eligible actor after pending reactions and resource choices have settled.

For the first release, resolve ordinary activations sequentially. Repeated clicks, taps or keyboard activations must never duplicate an action. Animation completion cannot change damage, status timing or resource ownership.

A stale manual selection stays unspent and requests a valid target or command. Define targeting separately for self, one living ally, all living allies, KO allies, one enemy and all enemies. Each multi-hit command needs a declared policy for a target that dies during its resolution. Remaining hits cannot cross into a newly spawned encounter.

KO and incapacitated actors must not stall initiative. Define whether each disabling status skips a scheduled activation or permits a different command. Victory cancels remaining uncommitted commands. Revival requires an explicit queue re-entry rule; no faction-phase revival rule is selected.

Every timed effect must identify its clock, such as owner activations, initiative cycles or encounter duration. Preserve supported SPEED consumers where their contracts still fit. Verify Kaja's Step and Hondo's Glare against the retained queue, including individual KO and re-entry behavior. Define tie handling, when changed SPEED reorders actors, and what counts as a cycle before translating durations or queue effects.

### Automation

| Control | Required behavior |
| --- | --- |
| Auto | Choose legal commands and targets under an explicit resource policy; use the manual execution path |
| Repeat | Restore each hero's prior command and execute it when that hero's SPEED-ordered turn arrives, after current legality checks; recorded input order cannot override initiative |
| Reload | Restore prior selections for review without executing |
| Menu | Open encounter options without mutating prepared actions |

Repeat must handle lost targets, KO, silence, cooldowns and insufficient resources. Proposed invalid-command behavior stops automatic execution on that hero's turn and asks for a legal manual command without consuming the activation. KO and genuinely incapacitated actors follow the scheduler's skip rule. Auto pauses when the player opens an AF spending or party-buff choice. Its permission to spend Astral Flow requires a separate policy; the conservative proposed default saves charge.

General multi-skill activation by one hero and precise tap-timing bonuses are outside the required scope. Coordinated Astral Flow specials provide the requested group action.

## 4. Individual HP and normal resources

Per-hero HP fields already exist, but current eligibility can continue to include heroes while the shared pool survives. Replace that dependency throughout targeting, action selection, defeat checks, healing, status handling and rendering.

Incoming damage must identify its final recipient. Apply that hero's defenses, barrier and statuses. Resolve AOE separately for each eligible recipient. Cover determines redirection before damage and preserves attribution to the original attacker.

Define Guard's protection window, provoke targeting and ally protection independently. Healing affects living heroes unless the command explicitly revives. Revival specifies restored HP, retained or cleared statuses and the normal-activation timing described above. Defeat occurs when every deployed hero is KO, subject to already committed revival effects.

Define encounter carryover and rest recovery for HP, KO and the selected normal resource. Essential recovery must remain accessible to starter and intended solo parties.

**Proposed normal resource: individual MP.** Basic Attack and Guard remain free. Set each hero's maximum, skill costs, recovery, drains and carryover. A recovery command may trade an activation for MP if approved.

The current shared Energy resource needs a disposition. Retaining it as expedition attrition requires its own clear role and recovery rules. Retiring it requires conversion of related progression and removal of combat costs. Resolve the current difference between live and automated Energy depletion behavior during this work.

## 5. Astral Flow

### Confirmed presentation

For N deployed heroes, place milestone i at i/N of the usable fill length, including the final marker at 100%.

| Party size | Milestones |
| --- | --- |
| 1 | 100% |
| 2 | 50%, 100% |
| 3 | 33⅓%, 66⅔%, 100% |
| 4 | 25%, 50%, 75%, 100% |
| 5 | 20%, 40%, 60%, 80%, 100% |
| 6 | 16⅔%, 33⅓%, 50%, 66⅔%, 83⅓%, 100% |

Use exact fractions internally. Each notch carries a tiny cropped diamond portrait, embedded in the slim upper-left bar. Add no permanent text there.

Sort diamonds by SPEED descending. Card positions continue to follow formation order. For the current seed values, diamond order is Hondo, Kaja, Runa, Fara.

### Confirmed participation and shared currency

Reaching a diamond makes its pictured hero eligible for an AF special. SPEED therefore affects which heroes become available first. A six-member party at 2/6 charge can use either of the first two milestone heroes or combine them, subject to the selected cost and actor-status rules. The remaining heroes require more charge.

The participant selector must show eligible heroes, selected participants, targets, total cost and the resulting effects before commitment. Support a single participant, a smaller group and the full deployed group when eligible. Specials consume Astral Flow only.

Early special use depletes the same balance that is being saved for a card draw or full-party combination. Exact solo and group prices remain to be selected. Validate the current milestone eligibility and affordability when launching, including specials prepared earlier. Commit the cost once. Refresh milestone availability after each spend; do not bank permanent unlocks from previously reached diamonds.

At full charge, expose the card-draw and full-party combination options. The player chooses the resource's use. Exact full-bar spending amounts and the choice presentation remain to be specified; do not silently give both rewards from one expenditure. An eligible special remains a valid tactical choice even when the player could save for a larger reward. Avoid additional per-phase quotas, required special sequences or mandatory saving rules.

Author each hero's special contribution, including protection or recovery for support kits. Resolve group contributions in a declared order while presenting a coordinated attack. Six heroes have 63 nonempty subsets; compose combinations from their individual contributions instead of requiring a unique cinematic for every subset.

**Proposed encounter rules:**

- Fix N to deployed count at encounter entry. KO does not reduce prices or remove denominator slots.
- KO or incapacitated heroes cannot contribute unless their special explicitly permits it. Specify the resulting full-charge option when the whole deployed group cannot act.
- Define when effective SPEED changes reorder the milestone portraits alongside the retained initiative system; formation order is a proposed tiebreaker.
- Decide whether an eligible AF special can act outside its hero's normal turn, whether it consumes that turn, and where an interrupt enters the action sequence. Preserve immediate tactical opportunities without permitting an input to alter already resolved damage.
- Handle formation changes between encounters through an approved charge carryover rule. Mid-encounter roster swaps are outside initial scope.

### Earning and spending the shared bar

Replace blue-gem income with a combat earning rule available to every viable roster. Optional support skills may improve that income.

Budget gain against meaningful actions and party size. Counting every animation hit would favor multi-hit kits and large parties excessively. Prevent farming through full-HP healing, indefinite guarding, duplicate KO rewards, summons or recursively triggered effects. AF specials and their induced reactions should not refill AF under the proposed initial rule.

Use one authoritative spendable AF balance. Combat income fills it; solo specials, group specials and card draws use it under their selected prices and thresholds. Remove the separate, independently earned buff-progress proposal. Existing wallet and draft-progress fields must be consolidated or converted without duplicating currency or creating a hidden earned-draw entitlement.

The slim bar displays this shared balance. An early spend leaves the player farther from the full-bar choices. Reaching full charge makes the card draw available; do not automatically consume the balance or award an independent buff when filling the bar. Opening or cancelling the selector spends nothing. Choosing an available use commits its cost and result once.

Finish already committed action effects and reactions before resolving a buff selection. Apply the chosen buff before the next action. Define cap/overflow, save conversion and the safe input window for spending without inventing a second currency. Tune draw frequency alongside the player's ability to spend early; a lower draw count caused by deliberate special use is part of the selected tradeoff.

## 6. Preserve the nine party upgrades

Keep party scope, session lifetime, prerequisite rules, one-off suppression, tier limits and repeatable behavior. Assign each effect an explicit command-era trigger and recipient rule.

| Upgrade | Required migration behavior |
| --- | --- |
| Crimson Ward | Retain party protection and capped refresh intent. Define whether protection is per hero or a shared barrier budget, with explicit consumption |
| Magic Fruit | Preserve healing and maximum-HP growth across eligible heroes. Define rounding and KO treatment; revival requires an explicit rule |
| Destiny | Preserve positive-hit healing and one-off acquisition. Retain the originating hero through redirection and group resolution |
| Faze | Retain its field function and reconcile expiry with the selected initiative clock |
| Grow | Preserve three tiers and the power/max-HP tradeoff. Recalculate current HP proportionally; the stat conversion is not a damage event. Define revived-hero treatment |
| Chain Strike I | Preserve one bounce at 33%, eligible attack triggers and deterministic targets |
| Chain Strike II | Preserve the prerequisite upgrade to two bounces at 66% and replacement behavior |
| Arcane Pulse | Preserve the every-other-qualifying-attack trigger and 12 magic damage. Count qualifying activations consistently |
| Split | Map the retired red-attack category to an explicit normal-attack category while preserving total damage allocation and bounce interactions |

Declare whether each upgrade reacts to normal attacks, skills, counters or AF contributions. Prevent recursive bounce and proc loops. Keep current ordinary-attack behavior as the proposed starting contract; review additional special interactions individually.

## 7. Replace every function removed with the board

| Retired dependency | Work required |
| --- | --- |
| Red matches and match-size damage | Route normal attacks and skills into shared damage resolution; retire or explicitly convert match multipliers |
| Green healing | Supply targeted and party recovery through approved commands, skills or consumables |
| Blue AF income | Implement the shared earning, milestone and spending rules in section 5 |
| Purple Energy recovery | Implement the approved normal-resource and expedition-recovery rules |
| Yellow gold | Move income to encounter rewards or bounded combat earnings |
| Supergem availability and cluster geometry | Move retained special payloads behind AF eligibility and spending |
| Enemy board locks, rerolls, Scathe, Sweep and Wipe | Re-author equivalent encounter pressure through debuffs, threatened attacks or resource effects |
| Gem-use progression and milestones | Convert earned progress through versioned save migration |
| Board readiness, refill waits and color-selection automation | Remove dependencies after command execution and automation replace them |

Re-author Hondo's gold-consuming mechanics with a defined currency source, cost and damage basis. Keep account currency, run earnings and combat-spend balances distinct.

Rebalance enemies around individual targeting, six possible actions, healing coverage and smaller-party vulnerabilities. A uniform HP multiplier cannot cover these changes. Measure intended solo and small-party builds for survival, AF access and reward efficiency.

## 8. Hero content, collection and persistence

Extend existing formation and selected-member initialization to one through six units. Replace fixed-four assumptions in placement, arrays, eligibility and encounter setup.

Use separate identities for a hero definition, an owned copy and a temporary combat actor. Progression belongs to the persistent owned unit, independent of formation position or battle UID. Preserve the current mappings Falie→Fara, Huun→Hondo, Runa→Runa and Kojonn→Kaja when migrating saves.

The sixteen existing hero-skill registry entries have no implemented payloads. Budget actual kit authoring and effects. Several entries describe passive or gem-dependent behavior and require redesign.

**Proposed minimum kit budget:** common Attack/Guard, two role skills, one passive and one AF contribution per hero. Preserve Fara's protection, Hondo's physical/gold identity, Runa's magic/totems and Kaja's support/AF identity. Select roles and assets for two additional heroes. Review Runa's totems/Invert, Kaja's gem-cost bypass and all old initiative effects individually.

Each adopted ability needs a target rule, resource cost, unlock, scaling, duration clock, trigger category, animation and observable result. Ensure useful choices across the full kit without assuming all registry entries become buttons.

Collection scope includes owned-unit storage, recruitment results, formation editing, hero details, upgrades, onboarding and persistence. Six playable heroes fill the formation. A seventh candidate is needed to demonstrate replacing a member while retaining a full six-member group; a larger launch roster adds content work.

Decide duplicate acquisition separately from duplicate deployment. The proposed initial formation rule permits one copy of each hero definition. Random recruitment requires pool weights, cost, duplicate outcomes, transaction integrity and any adopted guarantees.

Paid acquisition remains conditional scope. If selected, separately scope account recovery, authoritative inventory/currency, purchase verification, restoration, refunds and pool operations. The combat migration does not settle those commercial choices.

Save migration must preserve earned hero progress, unlocked content and formation identity. Choose how to convert gem milestones and obsolete Energy investments. Interrupted battles need an explicit version policy, such as a safe encounter restart with preserved run rewards, before old board state is retired.

## 9. Engineering ownership and reuse

Keep deterministic combat rules in the existing shared simulation owners. Rendering and input submit commands and present results. Preserve supported JS/Rust boundaries and mirrors; app.js remains orchestration-only.

| Location | Planned responsibility |
| --- | --- |
| [state.js](/Users/Mace/Codex-Orka/web-runner/modules/state.js) | Roster, individual resources/KO, prepared commands, initiative state and one shared AF balance |
| [functionBank.js](/Users/Mace/Codex-Orka/web-runner/modules/functionBank.js) | Command dispatch, eligibility, initiative handoff, retained damage/buff/reward paths and progression identity |
| [Shared core](/Users/Mace/Codex-Orka/src/core/) and [browser core](/Users/Mace/Codex-Orka/web-runner/src/core/) | Deterministic legality, targets, costs, actor-turn completion and formation rules |
| [Rust simulation](/Users/Mace/Codex-Orka/rust/simulation_core/src/lib.rs) and [shadow integration](/Users/Mace/Codex-Orka/web-runner/systems/simulationCoreShadow.js) | Update affected owned rules, state packets and export contracts; regenerate WASM after changes |
| [Render runtime](/Users/Mace/Codex-Orka/web-runner/systems/renderRuntime.js) and focused input/render modules | Command cards, editor, targeting, AF selector, mobile layout and accessible input |
| [Combat initialization](/Users/Mace/Codex-Orka/web-runner/systems/combatSessionInitializer.js), [hero configuration](/Users/Mace/Codex-Orka/web-runner/state/heroScreenConfig.js) and [formation rules](/Users/Mace/Codex-Orka/web-runner/src/core/partyFormationRules.mjs) | Owned roster deployment, six positions and additional heroes |
| [Progress storage](/Users/Mace/Codex-Orka/web-runner/systems/heroGemProgressStorage.js) | Versioned conversion and persistent owned-unit progression |
| [Supergem runtime](/Users/Mace/Codex-Orka/web-runner/systems/superGemRuntime.js) | Extract retained special effects, then retire board availability logic |
| [Autoplay rules](/Users/Mace/Codex-Orka/web-runner/src/core/idleAutoplayPriority.mjs) and [balance harness](/Users/Mace/Codex-Orka/tools/balance_harness.js) | Legal command policy and encounter measurements |
| [Supported runtime mirror](/Users/Mace/Codex-Orka/Scripts/functionBank.js), tests and product documentation | Required parity, revised contracts and command-era tutorials |

Reuse ExecuteSkill, HeroAttackSingle, HeroAttackAOE and ApplyDamageToTarget where their contracts fit. Extend actor attribution and trigger categories through these paths. Avoid a separate damage engine for the menu or AF.

After migration, remove gem dispatch, geometry, selection, refill waits, obsolete tutorials and retired assertions. Support old saves through a finite conversion; maintaining a second puzzle-combat mode is outside scope.

## 10. Delivery sequence and effort

Estimates assume six initial kits, reuse of current assets and simulation, a limited existing enemy set, and composable AF effects. They are preliminary person-weeks, pending confirmation through one playable encounter.

The ranges below predate the selected SPEED-order and shared-currency rules. Re-estimate the affected work after defining AF interruption and validating reuse of the existing scheduler; these figures are not a revised commitment.

| Work package | Engineering effort | Completion condition |
| --- | ---: | --- |
| Commands, retained initiative and individual HP | 3–5 weeks | Direct actions, valid targets, KO/revival and reliable actor-turn completion |
| Variable formation, owned identity and collection foundation | 2–4 weeks | All party sizes launch; reorder/save/load preserve progression |
| Normal resources and six kits | 4–7 weeks | Every hero has implemented legal actions, recovery and authored effects |
| AF combinations and nine upgrades | 3–5 weeks | Correct thresholds, participation, spending, draws and proc behavior |
| Enemy and economy conversion | 3–5 weeks | Board threats replaced; intended party sizes complete representative encounters |
| Saves, automation, board retirement and mobile integration | 4–6 weeks | Restart/resume and complete runs work without retired board dependencies |
| **Total** | **19–32 engineering person-weeks** | Integrated combat and roster migration |

Allow approximately 4–8 additional design/art person-weeks, depending on asset reuse. A single noncommercial random-recruitment pool may add 3–5 engineering person-weeks beyond collection foundations. Price paid services separately after requirements are defined.

Begin with approved combat and AF rules, then implement one encounter with individual HP, variable formation and solo/pair/full-group AF activation. A preliminary 6–10 engineering person-week allowance for this slice is included within the total. Use its results to revise the remaining estimate before completing all kits, enemy conversions, progression migration and retirement.

## 11. Acceptance criteria

- Every party size from one through six enters and completes combat. Cards follow column-major order and remain fixed through KO.
- Every hero's damage, healing, cover, barriers and defeat state use individual HP.
- Preparation spends nothing. Launch commits once. Duplicate clicks/taps, keyboard repeat, interruption and resume never duplicate costs, damage or rewards.
- Ordinary actions follow SPEED order. Preparation and Repeat cannot bypass it. Incapacitation, counters, revival and final-enemy death cannot stall initiative or grant unintended ordinary activations.
- Each AF bar has exactly N markers at i/N, with SPEED ordering independent of card order.
- Solo specials, all participant counts and full-group activation obey current eligibility and charge. Specials require AF only.
- At 2/6 charge with six heroes, only the first two milestone heroes qualify for specials. Spending reduces the shared balance and refreshes availability. There is no independent buff-progress balance or automatic reward that bypasses the chosen spend. Full charge exposes card-draw and group-combination options; validate their selected prices and overflow policy.
- All nine party upgrades preserve acquisition classes, prerequisites, caps, attribution and intended triggers.
- No AF or currency farming loop exists through repeated heals, reaction chains, duplicate kills or unattended guarding.
- Reload prepares only. Repeat and Auto revalidate commands, targets and resources.
- Reordering, benching and save conversion preserve owned-unit progression. Interrupted saves follow the approved migration policy.
- Relevant simulation, Rust packet/export and supported mirror checks pass. No command waits on board selection or refill.
- Desktop and mobile inspection covers six arena actors, small viewports, long descriptions, mouse/touch cancellation, keyboard focus, backgrounding and every card state. Complete an encounter using mouse only and keyboard only, and on touch. Opening Actions or scrolling a list never executes a hero. Portraits and card backgrounds trigger no command. Test every button's label, hit area and disabled state at the smallest supported size. No combat command requires swiping or dragging.
- Balance results compare party sizes using win rate, encounter duration, damage per hero, KO frequency, resource starvation, special group size, buff draws and reward efficiency.

## 12. Decisions required before dependent implementation

| Decision | Proposed starting point |
| --- | --- |
| Normal resources | Individual MP, free Attack/Guard; separately decide shared Energy's future |
| AF prices and income | Select solo/group/card-draw prices, bounded earnings, cap and overflow for the confirmed shared balance |
| KO and revival | Fixed encounter denominator is proposed; select full-charge behavior with unavailable heroes and revival's initiative re-entry |
| AF timing and carryover | Select special interruption windows and effect on normal turns; define encounter carryover |
| SPEED updates | Retain SPEED initiative; select tie/reordering behavior for the queue and milestone portraits; verify existing initiative skills |
| Small-party balance | Support intentional solo and smaller groups; determine encounter and reward scaling from measured play |
| Collection launch | Choose roster size, duplicates, recruitment rules and whether paid acquisition is included |
| Existing saves | Approve progression conversion and interrupted-battle handling |

These decisions bound implementation. The required visual layout, individual HP, six-slot capacity, removal of the board and Execute Round, and preservation of party buffs remain fixed throughout delivery.
