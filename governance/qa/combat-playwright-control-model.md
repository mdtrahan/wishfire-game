# Combat QA And Playwright Control Model

## Purpose
- Capture how combat actually hands control between player input, animations, enemy actions, refill, and repopulation.
- Give human QA, Playwright runs, FAQ/tutorial writers, and future spec beads one practical control model.
- Prevent false bug reports caused by mistaking transition states for actionable states.

## First-Principles Model

Combat has only four meaningful control states:

1. Hero input window
2. Hero action resolution
3. Enemy action resolution
4. Board transition / repopulation window

Most QA mistakes happen when state 2, 3, or 4 is treated as state 1.

## True Player Input Window

The game is safely actionable only when all of these are true:

- `CanPickGems = 1`
- `IsPlayerBusy = 0`
- `TurnPhase = 0`
- `PendingSkillID` is empty
- no gems are still selected from a prior input

Plain-language rule:
- A visible board is not enough.
- A highlighted current hero is not enough.
- Input is only truly legal when the game has fully returned to an idle hero turn.

## Combat Sequence Timing

### Hero attack sequence

Hero action motion is approximately:

- anticipation: `0.14s`
- lunge: `0.32s`
- hold: `0.16s`
- retreat: `0.26s`

Total visible hero lunge sequence:
- about `0.88s`

Skill execution also applies an action lock:
- common post-skill lock: about `0.6s`

### Enemy attack sequence

Enemy action motion is approximately:

- anticipation: `0.14s`
- lunge: `0.32s`
- hit hold: `0.16s`
- retreat: `0.26s`

Total visible enemy action sequence:
- about `0.88s`

After enemy motion completes, combat still applies:
- post-action lock: about `0.35s`
- deferred turn advance

### Combat text timing

Damage/heal text can delay turn handoff:

- rise: `0.18s`
- hold: `0.70s`
- fade: `0.45s`

Total combat-text lifetime:
- about `1.33s`

Practical QA implication:
- “The animation ended” does not necessarily mean “the turn is over.”

## Gem Interaction Model

Current runtime player interaction is:

- tap any 3 gems of the same color
- adjacency is not required
- some colors resolve immediately
- some colors open a follow-up action

Follow-up action colors matter:

- red: opens single-target attack flow
- green: opens AOE attack flow
- purple: Power Amp activation path
- blue: Astral Flow / wallet path
- yellow: special sequence flow
- heal/light green: heal path

Important QA rule:
- red and green can require enemy targeting and then centered attack confirmation
- do not keep tapping random gems while a pending hero action is unresolved

## Enemy Spawn And Refill Model

Two transition windows often look broken when they are not:

### 1. Empty-enemy transition window

`livingEnemies = 0` can mean:
- wave cleared and repopulation is still in progress

It does not automatically mean:
- the combat loop is frozen
- the encounter ended incorrectly

### 2. Gem refill transition window

A finished refill does not always restore player control immediately.

Control restoration depends on whose turn it is:
- hero turn refill can lead back to player input
- enemy turn refill must not restore gem pickability

## False Failure Vs Real Lock

### Usually false failure

- no living enemies for a short window right after kills
- board visible but not yet actionable
- enemy lunge ended but the deferred advance has not resolved yet
- combat text still fading while the state machine is holding handoff
- refill finished but the current owner is still the enemy side

### Usually real lock

- `TurnPhase = 0` but player never regains `CanPickGems = 1`
- `PendingSkillID` remains set and target/confirm flow never resolves
- enemy turn remains active for too long with no `ActionInProgress`, no advance, and no new actor
- the board is tappable during enemy control
- enemy slots remain dead/stale indefinitely without repopulation or turn handoff

## QA Testing Order

Use this order before declaring a combat bug:

1. Check whose turn it is.
2. Check whether input is legally allowed.
3. Check whether a pending hero action exists.
4. Check whether refill or repopulation is still underway.
5. Only then call the state stuck.

Minimum state questions:

- `TurnPhase`?
- `CanPickGems`?
- `IsPlayerBusy`?
- `PendingSkillID`?
- `ActionInProgress`?
- current actor UID/name/type?
- living enemy count?

## Playwright Control Rules

Playwright should model a player like this:

1. Wait for a true idle hero input window.
2. Choose one valid 3-gem color set.
3. Tap those 3 gems only once each.
4. Stop input immediately after the match.
5. If a follow-up action opens, resolve that action.
6. Wait through action, refill, text, and handoff windows.
7. Repeat only after control is truly back.

### What Playwright should not do

- do not click gems while `IsPlayerBusy = 1`
- do not click gems while `TurnPhase != 0`
- do not click gems while `PendingSkillID` is active
- do not treat `CanPickGems = 1` alone as sufficient
- do not assume enemy removal from arrays is the only defeat signal
- do not treat `livingEnemies = 0` as immediate permission to continue tapping

## Codex Preflight

When Playwright is running from Codex on macOS, separate browser startup from browser control:

1. Start Chrome outside Codex with a fresh profile and `--remote-debugging-port`.
2. Verify the CDP endpoint responds on `/json/version`.
3. From Codex, run a minimal `connectOverCDP()` probe before any game harness run.
4. Only if attach + page control succeed should the game harness be treated as the next blocker.

Practical rule:
- Direct `chromium.launch()` failure inside Codex is a browser-start failure until CDP attach proves otherwise.
- Do not assume Automation/Accessibility is required for the supported path unless the CDP attach probe itself triggers that denial.

Canonical ownership rule:
- `tools/balance_harness.js` remains the repo-owned game automation pipeline.
- The shipping lane uses that pipeline as the only pass/fail authority.
- Playwright MCP, the Codex Playwright skill, and other browser tools may also run as the bounded discovery lane defined in `governance/qa/browser-discovery-lane-pilot.md`.
- `playwright:doctor`, `playwright:launch-matrix`, and `chrome:cdp` are diagnostics/bootstrap helpers for the same harness lane.

Discovery-lane rule:
- A persistent browser session is allowed when the goal is better diagnosis, pacing insight, or failure classification for the same bead.
- Discovery-lane runs must stay bounded to one scenario at a time and report whether they found more, the same, or less signal than the shipping lane.
- Discovery-lane findings may improve QA docs or harness behavior later, but they do not redefine shipping evidence on the current bead.

## Recommended Automation Rhythm

For player-like automation, use this cadence:

- short tap spacing between chosen gems: around `40ms`
- state polling window: around `75ms`
- after each match, wait for state change, not a fixed arbitrary spam loop
- if the game enters a follow-up action, resolve that before any further gem taps

Practical interpretation:
- fast automation is fine
- uncontrolled burst-clicking is not

## Human QA Rhythm

Human QA should look for this sequence:

1. Hero highlight / idle state
2. gem tap trio
3. visible hero or system action
4. damage/heal text and any refill
5. enemy action if enemy turn follows
6. explicit return to idle hero state

If the game fails, record which step did not complete.

## Recommended Logging For Future Beads

When diagnosing combat control issues, log these first:

- current actor UID / type / name
- `TurnPhase`
- `CanPickGems`
- `IsPlayerBusy`
- `ActionInProgress`
- `PendingSkillID`
- `ActionOwnerUID`
- living enemy count
- selected gem count

This is higher-value than screenshots alone because many false failures are timing-state issues, not visual issues.

## Tutorial / FAQ Translation

Plain-language player instructions should say:

- “Tap any 3 gems of the same color.”
- “Some colors trigger an immediate effect.”
- “Attack colors may ask you to pick a target before the turn finishes.”
- “Enemy turns resolve automatically.”
- “If the board pauses briefly after kills or refills, that is usually the combat system handing off turns.”

## Bead Acceptance Guidance

Future combat, QA, and automation beads should specify:

- what counts as a valid actionable hero state
- whether pending hero target-selection is in scope
- whether refill/repopulation waits are expected
- which timing seam is under test:
  - gem input
  - hero action
  - enemy action
  - refill
  - repopulation
  - deferred turn handoff

This prevents vague acceptance like “combat got stuck” when the real problem is a specific state handoff seam.
