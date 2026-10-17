# Direct StoneAge D1 ordinary farming and boss captures

These are exact-byte copies from the Sol-controlled BlueStacks Air 5.21.790.7505 StoneAge 1.06.00 (76) session on 2026-10-11, originally recorded for ORKA-1uv.5 at `/Users/Mace/Codex-Orka/output/qa/ORKA-1uv/stoneage-direct/`. The downloaded game-content revision is unknown. This was an earlier study character, separate from WORLD360. No purchase or combat input occurred during either clip. The source report at `/Users/Mace/Codex-Orka/goals/combat-reference-team/round-2-direct-play.md` and original `index.html` describe the recording setup.

| Artifact | Direct observation | SHA-256 |
| --- | --- | --- |
| [Chapter 1-2 farming](chapter1-2-farming.mp4) | 12.04-second capture, Woody Lv1 and Nordor Lv1, camera 1; ordinary enemies and full green actor portraits in sampled frames. The boss remains gated by Guide 5. | `e96eb64fa49000345526629e61cc1399b158d09b4038b6501ad732b02853265b` |
| [Chapter 1-3 farming](chapter1-3-farming.mp4) | 22.04-second capture, Woody Lv3 and Nordor Lv1, camera 2; ordinary enemies, repeated Flame Slash cues, and full green actor portraits in sampled frames. The boss remains gated by Guide 7. | `8580e704c19fdfca95287745ae0a2a8465526b0b0b98618e187f7bb8ef655712` |
| [Chapter 1-2 sampled frame](chapter1-2-boss-gate.png) | Frame 100, captured around 2026-10-11 19:52:53.965 UTC; both actor portraits full green. Guide 5 still gates the boss. | `bb9bfa05f9c456082c2e69ca4ed5ba0c764a17ddaaf7bad02be237258f485d41` |
| [Chapter 1-3 sampled frame](chapter1-3-fight.png) | Frame 200, captured around 2026-10-11 20:02:37.889 UTC; ordinary attack and both actor portraits full green. | `2f06b9535fc954c8f7a8967aa7c0b4b75a72fb515348f87d715ea0af9189d551` |

The exact source screenshot-call sidecars are [Chapter 1-2 timestamps](chapter1-2-timestamps.json) (`888f3c6d778a0c18989f556fa52102d4750a46266cd639aeabfeb8c03862c073`) and [Chapter 1-3 timestamps](chapter1-3-timestamps.json) (`abf6f037194ea208dfbc50c0ba1b6a387df4041e07cde57b5e0beea6d18b5b07`). Their UTC call bounds are 19:52:48.673–19:53:00.702 and 20:02:27.597–20:02:49.603. The videos use the variable screenshot timing; they have no audio or engine timestamps. The original raw PNG streams have missing numbered files, and the sidecars include every attempted screenshot call. Video playback and sidecars support the observed short intervals, not exact attack cadence or a 20-consecutive-wave count.

The prior research report says no Hero KO, defeat, recovery, or retry was observed in these clips. The sampled stills confirm living/full-bar actors at those moments. Neither clip contains an ordinary-to-boss win transition or a Chapter 4-2 comparison. Keep the WORLD360 account, gear and later chapter evidence separate.

## Direct early chapter-boss frames

These exact-byte stills come from the same earlier study session's `sequence6` and `sequence8` source streams. Their original MP4s remain in the primary checkout's ignored `output/qa/ORKA-1uv/stoneage-direct/` directory. The source screenshot-call sidecars are tracked here as [Chapter 1-4 timestamps](chapter1-4-timestamps.json) (`b0a4e96bc36172c13ab30572fbf7fd1530d090e2ded146f0076137c24e5c20a4`) and [Chapter 1-5 timestamps](chapter1-5-timestamps.json) (`5f9d2bedaff91430d8ab9392d1d092ccfcdc69de40b4af5339e834660ae658bb`). Times below mark screenshot calls, not engine events.

| Frame | Direct observation at 2026-10-11 UTC | SHA-256 |
| --- | --- | --- |
| [Chapter 1-4 boss at 77%](chapter1-4-boss-77pct.png) | `sequence6/0328`, 20:23:18.255; Cess Hog, party power 17,525, Woody Lv3 with Stonegon and Nordor Lv4, three green portraits and a partly filled blue gauge. | `85e62cc1bc689da8965ae1c2e18032df37ae5e93f21a165ef99cb6d0438c0ce8` |
| [Chapter 1-4 clear](chapter1-4-clear.png) | `sequence6/0449`, 20:23:24.674; explicit Clear Stage and 400 of each shown reward, three green portraits. | `928799542ee917f4f48b9f46e2b6f11e26acbf347a602908d45d18e586f80bc5` |
| [Chapter 1-4 after clear](chapter1-4-after-clear.png) | `sequence6/0458`, 20:23:25.156; same three party members standing with green bars. | `1f9f367c058188afa9b51235c26fab9297c153a36926397fb063aef5c1c555b3` |
| [Chapter 1-5 boss at 69%](chapter1-5-boss-69pct.png) | `sequence8/0180`, 20:33:00.580; Bonde Tribe Dan, solo Woody Lv3, party power 5,206, green portrait, short remaining blue gauge, visible green `+24` whose source is unknown. | `62f9545ead8ac80efd3ae03e38c244957602d99e0d3893b2a774be2597c00ce8` |
| [Chapter 1-5 defeat](chapter1-5-defeat.png) | `sequence8/0238`, 20:33:05.455; explicit defeat message at boss 63%, empty blue gauge and Woody portrait still green. The game does not state the failure cause. | `088e2372e8bac2fbb92b9c765798614b96fe93c1f343bf1fe4d08baf240567f2` |
| [Chapter 1-5 return](chapter1-5-return.png) | `sequence8/0260`, 20:33:07.095; Woody upright on Chapter 1-5 with Summon Boss available again. No retry was clicked. | `d1fdbe0e3d6ecfe40b53837160e37596017624735d7bc5b3d029d057510ef0be` |

The clear and defeat involve different bosses and party sizes. The visible blue gauge and green portrait support a living-Hero defeat observation, while the exact timer and loss rule remain unknown. These frames do not form a matched causal boss comparison or later-chapter calibration band.
