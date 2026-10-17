# Current-source first-boss visual pair

`timeout/` and `win/` preserve byte-identical copies of the headless browser outputs at `/private/tmp/orka-7l9-current-visual-boss/` and `/private/tmp/orka-7l9-current-visual-boss-win/`. Both reports serve clean source and harness `b601f0ea4ae48cfe5a07d3dab35f62330f332dd0`, empty patch fingerprint `4f53cda1`, no untracked files, the tracked `ui-equipped-lamp.json`, active Falie/Huun/Runa, Auto-Equip off, and seed `3235774465`. The Hero fixtures are tracked `level1-manual-ready-heroes.json` and `level5-manual-ready-heroes.json`; they are synthetic Wishfire progression states. Report `captures` paths still name the original temporary files; these same-named PNGs are durable copies.

| Copy | SHA-256 | Visible evidence |
| --- | --- | --- |
| `timeout/balance_metrics.json` | `e3a17735a95620fa1e3eb6e46febac84ff969a8855fb1b1254b633073edf11c1` | Ordered telemetry and provenance. |
| `timeout/session-1-combat_start.png` | `4aa2b8e87b687c634bb2830153fbb9bc2736c2fa291ff4158febe9b3aade7ee5` | Three Heroes, Chapter 1-1, ready Summon Boss control. |
| `timeout/session-1-boss_active.png` | `b8459bbeeaef626acef47c2b66f02e9da9ac28d46809399b55a53bf0b3fd15dd` | Three Heroes, first boss, blue gauge. |
| `timeout/session-1-boss_timer_half.png` | `31b85233cea1d58b327184ee7c257d8d16824f9d9c72a2231fdc2e6b6f8592a1` | Blue gauge visibly shorter during the living-party boss fight. |
| `timeout/session-1-recovery_reveal.png` | `8a1e1b201f0beace4c83921a63aec712f44d7f6a92d729e41fcf58b65a0f92a7` | Chapter 1-1 Summon Boss returns; three Heroes appear together. |
| `win/balance_metrics.json` | `212c63d2574f066def3fea499485ebb4a1979a83cff60cef6aa444867c3a6f95` | Ordered clear telemetry and provenance. |
| `win/session-1-combat_start.png` | `2f91800d774e1683fa86489018c52707251fbfffef8466b6c9fecc00e5f6bc0f` | Same party slots and ready Chapter 1-1 boss control. |
| `win/session-1-boss_active.png` | `4214fb74eb13960a692952f708e6e5242e73425e143df0efd24391d9d0ef6249` | First boss and blue gauge rendered. |
| `win/session-1-after_boss_clear.png` | `1d1b806e3577c806a88aa3f114596022a0098e63c0f7cebad17e217d0c5af6a7` | Party in Chapter 1-2 after the recorded clear. |

The timeout report records a Wishfire 18.0008-second boss attempt, boss HP 16/231, all three Heroes alive at 49/85, 50/60, and 57/69 HP, and same-stage full-party recovery. The win report records one boss clear, zero timeouts or Hero KOs, and Chapter 1-2 advancement. Its final sampled boss HP of 27 precedes the clear settlement and is not post-victory HP. Both reports record zero missing combat events, ambiguous wave transitions, and deadlocks. The frames show the gauge, combat, and stage outcomes; they do not display a numeric countdown or reliable numeric boss/party HP. The 18-second limit belongs to the current Wishfire runtime, not an observed StoneAge timer. One seed per visual run cannot replace the separate five-seed telemetry matrix.

The copied `session_results.csv` hashes are `82562a041a2d32db4394bf011d2ad9265a6d5731be44f9f519dd1e4f4b4deeab` for `timeout/` and `862a3ea12a08c264c58fa36e2b273367a281f2b28be0931d67b53af81fe98730` for `win/`.
