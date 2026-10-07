# Arrival strip clearing proof

Build: `codex/ORKA-0ln-lamp`, served by the owned worktree at `http://localhost:8027/web-runner/index.html`. Runtime change: filter session emission snapshots by current pending/discarded IDs. Stored rolls, EXP, inventory routing and saved history remain unchanged.

Capture: fresh disposable browser context, 360×640 CSS pixels, DPR 1, matching bundled Chromium, ordinary Start/Reveal/Skip/Dismantle controls, no injected state. Native in-app browser separately exercised manual Reveal → Skip → Dismantle and showed cache 0/20 with empty positions. The old native tab timed out, so the current build was opened in a responsive tab on the same origin/save.

Video: `lamp-arrival-clear.webm` (56.44 seconds). Full recording inspected through sampled frames; direct video seeks at 00:42, 00:44 and 00:51 confirmed transitions. Times below refer to playback, with ranges covering the observed state.

| Requirement | Observed result | Video time | Status |
|---|---|---|---|
| Fill more than five items without filtering | Eight ordinary burps; five arrival illustrations, cache eight | 00:06–00:27 | Observed |
| Preserve sorted equip review | Eight pieces open in descending CP review; Skip visits each candidate | 00:28–00:39 | Observed |
| Separate dismantle screen before conversion | Eight inert pieces and Dismantle All button | 00:40–00:41 | Observed |
| Empty storage clears arrival art | Confirmation yields essence 9, cache zero, all five arrival positions empty | 00:42–00:46 | Observed |
| Reward needs no dismissal tap | Passive DISMANTLED strip disappears into combat | 00:45–00:47 | Observed |
| Next burp contains no historical art | One new piece, four empty arrival positions, cache one | 00:49–00:53 | Observed |
| Next cache still opens equip | Single fresh candidate in hero gear review | 00:54–00:56 | Observed |

Supplemental: 29 core tests passed; four-phone presentation flow passed with assertions for zero arrival buttons, five empty positions and one next arrival. No captured browser page errors. This recording certifies the reported collect/dismantle/next-burp seam; other previously recorded progression criteria retain their separate evidence.
