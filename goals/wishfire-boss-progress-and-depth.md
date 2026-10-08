# Wishfire: boss progress and actor-owned HP bars

Status: implementing; requested 2026-10-07. Bead: ORKA-7yv. Baseline checkpoint verified before work.

## Goal

Make adventure progress visible through a cute chibi progress bar, automatically enter an earned boss fight, and place HP bars beneath their owners with correct depth ordering.

Reference: the StoneAge Idle Adventure screenshot supplied by the user, showing a chapter/stage label, notched bar, party head marker and red monster head. Match its readable visual language with Wishfire artwork. The reference's Chapter 4-22 text is an example; display Wishfire's actual active chapter and stage.

## Progress HUD

- Replace the existing Boss button in its HUD footprint. Retire the manual press requirement and associated prompt.
- Approved HUD sizing: 105 logical pixels wide, centered at reference X=180; height, head size and label font remain unchanged after the requested 30% width reduction. Notches are 1.5 times their original width and height (3 by 7.5 logical pixels).
- Use at most three internal notches. Default: four segments corresponding to the existing four completed waves required for a boss.
- Derive progress from authoritative combat state. A pack kill must not count as a full wave; avoid a second independently maintained progress counter.
- Use a simplified head from Hondo's existing approved artwork as the moving progress marker, with a reddish chibi monster head at the boss endpoint. Keep bold outlines and readable silhouettes at the actual HUD size. Reuse artwork and the current asset pipeline; this needs no new puppet rig.
- Keep the active chapter/stage label visible during roaming, the boss transition and the boss battle. Its value must agree with the runtime stage, including after defeat and reload.
- During the boss fight, retain the completed bar and identify the boss encounter clearly. Reset progress when the next stage begins.

## Automatic boss entry

- Completing the fourth wave fills the bar and starts the existing boss transition automatically, exactly once. Finish the clear before entering; preserve the rule that the party neutralizes local threats before moving on.
- Reuse the existing screen wipe, left-party/right-boss layout and large boss presentation. Preserve party HP on entry and existing victory recovery rules.
- Guard the lifecycle against duplicate activation, queued ordinary attacks, repeated update ticks and reload during a transition.
- Approved retry policy: defeat returns the party to wave 1 of the same stage with empty progress and readiness false. Four newly completed waves earn the next automatic attempt. Reload preserves earned progress; loaded readiness enters once on an unpaused combat tick.
- Future authored boss victories can lead into story through the existing narrative flow. This goal includes documenting that transition boundary; story content and speculative new plumbing remain outside this change.

The user's request explicitly supersedes the product guide's manual Boss-press requirement. Update that guide when the new behavior is implemented. The user approved the four-wave refill retry policy on 2026-10-07.

## HP placement and depth

- Place each hero/enemy HP bar visually beneath its body or feet, consistently offset from the owner's world position.
- Render the actor and its HP bar as one depth-sorted group using the owner's existing depth key. Eliminate any global pass that draws all HP bars over all actors.
- A bar may overlap another actor only where its owner has the same foreground ordering. Check crossing actors in both directions, tightly clustered heroes, enemy packs and the enlarged boss.
- Preserve HP values, visibility rules and damage timing. Adjust layout clearance only where needed for readable bars at the current game scale.

## Baseline and scope

Use the current approved arena behavior: three-screen arena, center start, dispersed packs, tight formation with Fara/Hondo leading, Runa/Kaja supporting, committed local clears and shared puppet rigs. Candidate checkpoint: 99cc58a5 in the ORKA-p3s lane; confirm its current integration status before branching. Preserve unrelated dirty work and existing recovery checkpoints.

The shared boss-power curve remains a separate outstanding balance concern. This HUD/transition change must not introduce per-boss stat patches. The existing introductory-boss exception must be tracked honestly rather than described as a completed universal curve.

## Gauntlet sequence

1. Confirm the candidate baseline, ownership and current Beads state. Resolve retry/save behavior before touching persistence. Create one scoped implementation lane and retain a rollback checkpoint.
2. Trace the existing wave-clear, readiness, boss-entry and stage-label paths. Produce the compact Hondo/monster HUD artwork and a visual preview using existing tools.
3. Implement the progress display and automatic entry through existing shared combat lifecycle seams. Group HP rendering with each owner in the renderer. Keep orchestration files thin.
4. Run focused checks for four-wave progress, stage truth, exactly-once entry, defeat/reload behavior and stale queued actions. Inspect native in-app Browser screenshots for HUD readability and actor/bar overlap at current scale; run applicable UI layout checks.
5. Use an independent Luna review when it adds useful coverage, reusing an idle agent where possible. Correct specific findings and repeat only affected checks. Record QA evidence and current Integration Ready proof before any merge.

## Acceptance evidence

- Screenshots show at most three notches, recognizable Hondo and red monster heads, and a runtime-correct chapter/stage label.
- A recorded ordinary clear cycle reaches a boss with no button press and only one transition. The next stage resets the bar correctly.
- A defeat/reload check proves the agreed retry policy avoids immediate reentry loops and preserves the intended stage state.
- Crossing/clustered actor screenshots prove HP bars stay beneath their owners and follow the same depth ordering, including during the boss fight.
- Existing roaming formation, pack-clear commitment and combat timing checks pass.

## Resource housekeeping

Keep the active localhost:8148 preview while working. Before starting a replacement, inspect service command, working directory and connections; stop only verified inactive Wishfire preview services. Preserve source files, worktrees, database services and active tool connections. Reuse idle Luna agents for bounded tasks and leave redundant workers idle. Goal drafting needs no additional server or agent.

## Candidate verification

The candidate passes 102 focused combat/rendering checks and 120 UI invariants. Native in-app captures cover natural 535x1223, reference 360x640 and requested compact 216x384 (Browser measured CSS viewport 240x384, Canvas 216x384). Independent Luna review preferred the candidate for the subtle centered guide brief, with limited anonymity because branding and capture sizes differ. Full validation retains the pre-existing lampPresentation failure; the candidate has no other failing test. Boss-state native visual proof and human QA remain pending; this is not Integration Ready or merged.
