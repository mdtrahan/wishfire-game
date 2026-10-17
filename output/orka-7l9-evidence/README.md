# ORKA-7l9 clean-source acceptance evidence

Game and harness source: `a7c5b75924ebb73e3f533e4f4969c7039b85083e`; clean empty patch SHA-256 `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`. All five seeds per fixture are 3235774474–3235774478. The level-15 Chapter 2–3 Hero states are synthetic progressed fixtures, not earned StoneAge or Wishfire progression.

`farming-matrix.csv` is the minimal per-Hero receipt: 105 rows with incoming HP damage, healing source, HP floor, clear time, event gaps, KO, recovery and PASS.

| Chapter | Party | Waves per seed | Lowest Hero HP | Report SHA-256 prefixes |
| --- | --- | ---: | ---: | --- |
| 1 | without Kojonn | 10 | 95.00% | `orka-7l9-clean-ch1-a` `ce21ef270148`, `orka-7l9-clean-ch1-b` `5787f8b1dee6`, `orka-7l9-clean-ch1-c` `6f7298352e20` |
| 1 | with Kojonn | 10 | 95.00% | `orka-7l9-clean-ch1-kaja` `cf2fc007d545` |
| 2 | without Kojonn | 15 | 97.92% | `orka-7l9-clean-ch2-no-kaja` `0a3c019e8b4b` |
| 2 | with Kojonn | 15 | 98.61% | `orka-7l9-clean-ch2-kaja` `24bbb705f5c0` |
| 3 | without Kojonn | 20 | 97.22% | `orka-7l9-clean-ch3-no-kaja` `1286be31daa0` |
| 3 | with Kojonn | 20 | 98.61% | `orka-7l9-clean-ch3-kaja` `3e2d39b1686a` |

Every farming session ended at its authored wave limit with zero Hero KO, recovery, deadlock, event gap and ambiguous wave transition. See the CSV for each Hero and seed.

Fixed 30-second boss and same-wave forced-KO recovery reports are pinned in `../orka-7l9-gauntlet-progress.md`; these five inspected frames are excerpts from clean browser-game runs, with the DEV2 grid visible. Boss timeout is a full-party retry with surviving Heroes, while ordinary forced KO restores the party on the same chapter and wave.
