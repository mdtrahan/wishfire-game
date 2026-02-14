# C3 → JS Parity TODO

## Immediate regressions to fix
- Re-open JSONs (`Function_Bank.json`, `UI_Logic.json`) and confirm nav, refill, enemy bars, mismatch behavior.
- Remove duplicate nav labels; render labels from JSON objects only and bind clicks to those objects.
- Fix REFILL to fill only missing gem slots (no re-roll).
- Ensure Enemy_Sprite animations are used per enemy name; remove any name/HP text overlays.
- Use slotIndex + `SlotX/SlotY` to distribute enemies across slots.
- Align enemy HP bars to JSON (`Bar_Fill/Bar_Yellow` baseW, targetWidth, smoothing, position from BBoxTop).
- Party HP bar starts full (PartyHP = PartyMaxHP) and renders via PartyHP_Bar.
- Restore invalid match flash + clear behavior (JSON: flash then ClearMatchState).

## Parity checklist (next)
- UI_Logic behaviors (chain UI, selectors, overlays) match JSON.
- Turn flow: ProcessTurn → HeroTurn/EnemyTurn recursion matches JSON.
- Enemy action resolution logic matches JSON thresholds.

## QA loop
- Resize window → layout stays aligned and stable.
- Validate REFILL, mismatches, buffs, and enemy HP bars.
