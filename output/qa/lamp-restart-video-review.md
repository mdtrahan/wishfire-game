# Lamp restart: recorded acceptance

2026-09-30 · ORKA-0ln · served owned lane on localhost:8024 · 360×640 DPR1 recordings.

Applied the global video-feedback-iteration skill. Its installation lives outside this project at ~/.codex/skills/video-feedback-iteration and contains no project names, paths, game rules or dependencies. Each invocation is scoped to its selected project and authorized artifacts.

[Manual recording](lamp-restart-manual.webm) uses a fresh save and normal START, manual lamp, reload and collection controls. [Auto recording](lamp-restart-auto-fixture.webm) separately seeds four level-5 heroes, three stored items and saved Auto ON, then operates ordinary controls. The fixture is disclosed because this short scenario does not demonstrate earning level 5. No user save was cleared. [Driver](lamp-record-restart.cjs).

## Video criteria

| Request | Visual evidence | Result |
|---|---|---|
| Arrival array starts empty and stays empty while idle. | Manual 00:09–00:15: five empty positions, cache 0, Auto locked. | Observed |
| Manual burps fill one position at a time. | Manual 00:18–00:21: one, two, three gear arrivals; counter reaches 3. | Observed |
| Restart clears arrivals while retaining cache. | Manual 00:27–00:32: empty positions, counter 3 and preview preserved. | Observed |
| Restart does not generate gear by itself. | Manual 00:27–00:33 stays at counter 3; Auto recording 00:40–00:44 stays at counter 4 with empty arrival positions and Auto off. | Observed |
| First new manual burp remains visible. | Manual 00:35 shows exactly one arrival and counter 4. | Observed |
| Existing cached gear remains usable. | Manual 00:37 shows HERO GEAR UPGRADE and four items in descending CP order. | Observed |
| Saved Auto ON requires new player intent after boot. | Auto fixture 00:10–00:12: empty strip, retained counter 3, Auto off. | Observed |
| Unlocked Auto produces gear after explicit toggle; disabling it stops production. | Auto fixture 00:14 shows Auto ON, one arrival and counter 4; later Auto off remains at 4 before reload. | Observed |
| Global skill governs scoped visual iterations. | Installed SKILL.md and agents/openai.yaml; initializer validator passes. The first recording found a zero-based sequence error, which was fixed before the final capture. | Validated artifact and demonstrated use |

## Implementation

The first storage transaction of a game boot switches saved Auto off while preserving gear, pending/discarded cache, EXP and loadouts. The arrival strip records the completed-emission counter when it first sees loaded data, then shows only items emitted at or after that session boundary. Item sequences are zero-based, so the first new item is included. Saved history remains intact for the supported data contract.

Both recording contexts completed without page errors. Native in-app operation confirmed empty idle, one manual arrival, then reload returning to an empty strip with cache count 1. The current game tab was reloaded to the final files and left in that state.

Validation: 29 focused core checks passed, 7 offline checks passed, and the final four-phone browser regression passed (360×640 DPR1, 216×384 DPR2, 233×452 DPR2, 316×452 DPR2). Earlier presentation checks assumed restored history filled the strip; those expectations were updated to the owner correction. Review closure used supported Escape after feedback because the existing compact DEV launcher intercepted the Close button. This restart change does not certify that launcher placement.

Scope: restart, first arrival, retained storage and explicit Auto intent. The earlier equip/dismantle video certifies its captured revision; this newer recording covers the changed lifecycle. No merge or publication.
