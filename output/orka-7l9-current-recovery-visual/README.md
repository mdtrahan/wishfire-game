# Current-source forced recovery frames

The copied `balance_metrics.json` and four PNGs are byte-identical to the clean headless browser run at `/private/tmp/orka-7l9-current-visual-recovery/`. Its embedded source and harness are `1f879557daecead61682f3e09badab885332794b` with empty patch fingerprint `4f53cda1` and no untracked files. Input: tracked `stage2-onehp-heroes.json` and `ui-equipped-lamp.json`, active Falie/Huun/Runa, Auto-Equip off, seed `3235774465`, one ordinary-wave target. The report's `captures` paths point to the original temporary output; the identically named PNGs beside this README are the durable copies.

| File | SHA-256 | Visible evidence |
| --- | --- | --- |
| `session-1-combat_start.png` | `a56bd882f1d2081fffe266b877416a8b71f5763fed3fa9729aacdc67d6c0f1e7` | Three Heroes face ordinary enemies on the Chapter 1-2 DEV grid. |
| `session-1-recovery_reveal.png` | `92c3b01a4b69119233216cf9804764eb0cae066656cf9ed12af983a811f8fbbf` | Three Hero sprites appear together with blue HP bars during the recovery reveal. |
| `session-1-post_recovery.png` | `61857f35dfd126fb1b4c706b59116aa9512ae00460944f077e2d07209fe5091c` | The party remains together with blue HP bars and ordinary enemies present. |
| `session-1-first_wave_clear.png` | `4436970de0b7ba3509c3c3b686f15027927192f973551f11c4956721b8bc7a33` | A subsequent ordinary encounter is visible after the wave-clear counter advances. |

The report SHA-256 is `dcecf91f3c5f33635f0ae5dfb5c39d3d4aab7ad4c755fb8fc29e5576854f9b2c`; `session_results.csv` SHA-256 is `ea66792839737b8a2300ca95b4625fb1119872073337d8708ca32c3a1216e6d3`. Telemetry records Huun's KO at 9.136 simulation seconds, full-party restore to Falie 85, Huun 60, Runa 69 HP, the same Stage 1-2 wave 1 immediately after recovery, a later enemy KO, and one ordinary wave clear. It reports zero missing events, ambiguous wave transitions, and deadlocks. The screenshots show rendered combat and the recovery huddle, but the 360×640 bars do not yield reliable numeric HP by visual reading. This is one forced synthetic seed, not earned progression or a StoneAge comparison.
