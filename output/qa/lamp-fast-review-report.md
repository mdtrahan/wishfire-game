# Responsive equip review and complete cache

Current build: `codex/ORKA-0ln-lamp`, served from `/Users/Mace/Codex-Orka/.worktrees/wt-ORKA-0ln-lamp` at `http://localhost:8027/web-runner/index.html?strip-redesign=1`.

The CP animation previously held the save/action lock and froze every render for 1.8 seconds. The shared equip paths now release the lock after the saved operation, so item and recipient choices continue while their CP receipts float. Concurrent receipts are tracked independently. Only final review advancement or modal closure waits until all receipts finish. Reused portrait image nodes avoid decoding flicker during selection updates.

Auto previously continued generating during review. It now pauses while review opens and remains open. Entry awaits an in-flight saved action, storage sync, and the decoded shared gear atlas before rendering all sorted cache items in one operation. A draw already committed before opening is included in the initial inventory. Auto resumes after review closes if enabled. No additional gear-generation caller exists beyond manual activation and Auto.

## Current video evidence

`lamp-fast-review.webm`, 29.92 seconds. Captured with the existing Playwright recorder at 360×640 CSS pixels; the in-app browser was separately reloaded and operated. This recording uses a disclosed disposable fixture: three generated items and four Lv5 heroes. The player toggles Auto; one Auto draw completes before review opens, making four initial items. The user's live save is preserved.

| Criterion | Video evidence | Status |
|---|---|---|
| Complete cache at entry | Four sorted inventory tiles appear together at review entry; their IDs and count match committed storage | 14.0–14.5s; runtime assertion | Observed |
| No incoming items during review | Same four-item inventory remains stable while Auto is enabled; saved sequence unchanged over the six-second check | 14.5–22.0s | Observed |
| Immediate next selection | First equip advances to the next item while Fara's CP receipt floats; Hondo's equip completes before that receipt ends | 23.25–24.75s | Observed |
| Further rapid equips | Runa and Kaja receive equipment while earlier receipts remain visible | 25.0–26.5s | Observed |
| Final close waits | Last modal stays until Kaja's receipt finishes; combat resumes with no CP receipt outside the modal | 26.5–27.75s | Observed |
| Stable portrait art during updates | All portraits remain visible through the rapid selection sequence | 23.25–27.5s | Observed |

Decoded timestamped frames: `../../test-results/lamp/fast-review/rapid-video-annotations.png`. Native final cache proof: `../../test-results/lamp/fast-review/in-app-cache.png`; accessibility inventory confirms all14 saved items were present together at opening, with Auto locked on that save.

The reusable `node output/qa/lamp-fast-review.cjs` passes: complete initial inventory, unchanged inventory and sequence during six seconds of Auto review, two overlapping CP receipts, final modal hold, and no page errors. Existing `tests/lampPresentation.test.mjs` passed all four phone sizes before the final portrait-node reuse; the final driver covers that last presentation adjustment. Syntax and diff checks pass. Generation cooldown, reward amounts, item rolls, sorting and equip eligibility remain unchanged.
