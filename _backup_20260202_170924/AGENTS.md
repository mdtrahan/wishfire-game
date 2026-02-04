## Project Guardrails (Codex-Orka)

### Source of Truth
- **JSON files in `project_C3_conversion/` are ground truth.** Never edit them.
- The JS/HTML must mirror Construct 3 behavior; do not invent mechanics without explicit design approval.

### Rendering & Assets
- Use sprite assets from `project_C3_conversion/images/` (no placeholder art).
- When a sprite is not placed on a layout, load its object type explicitly in JS.
- UI text styling/size should not change unless requested.

### Turn/Combat System
- Turn order is **strictly SPD‑sorted** (no jitter).
- Speed buffs trigger a **turn order rebuild** while preserving the current actor.
- **Speed spike rule:** if `SPD_self >= SPD_fastest_opponent * SpeedDoubleRatio` then insert one extra immediate turn (heroes only by default).
- **Newly spawned enemies** are appended to the **bottom** of the turn order unless they qualify for the speed spike rule.
- Party uses a **shared HP pool**; heroes remain in the turn order while `PartyHP > 0`.

### Gem/Action Flow
- Player activities are **mutually exclusive**: gem selection, target selection + confirm, nav menu, refill.
- Refill is gated during gem selection, target selection, and overlay.
- Blue gem = party buff roulette (no target selection).

### UI/Modal Layering
- Nav menu elements (labels, refill, backer, close button + X) must render **above** the dark field.
- Dark field blocks gameplay while nav is open but must **not** cover nav UI.
- Do not move/alter gemboard layers when showing nav UI.

### Debug/QA Aids
- Track‑next group shows upcoming turns with **base and boosted stats**.
- Maintain combat logs and buff logs for QA visibility.

### Netlify Packaging (when asked)
- Make all asset paths **relative** (no leading `/`).
- Deploy with `web-runner/` and `project_C3_conversion/` together.
