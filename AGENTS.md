## Project Guardrails (Codex-Orka)

### Canonical Runtime Source (Critical)

- The authoritative runtime source is:
  - `Scripts/`
  - `web-runner/`
- The deployed Netlify build defines canonical gameplay behavior.
- `main` branch is the only production branch.
- All new feature branches must branch from `main`.

### Legacy Construct 3 Archive (Read-Only)

- `project_C3_conversion/` is a historical archive.
- It is NOT runtime source of truth.
- It must never be used to regenerate or rewrite current runtime logic.
- No gameplay logic should be inferred from Construct 3 JSON.
- Do not mirror Construct 3 behavior unless explicitly instructed.

### Rendering & Assets

- Runtime assets must be referenced from the active runtime directories.
- Do not introduce placeholder art unless explicitly requested.
- UI text styling/size must not change unless requested.

### Turn/Combat System (Canonical Behavior)

- Turn order is strictly SPD-sorted.
- Speed buffs rebuild turn order while preserving the current actor.
- Speed spike rule:
  - If `SPD_self >= SPD_fastest_opponent * SpeedDoubleRatio`
  - Insert one extra immediate turn (heroes only unless specified).
- Newly spawned enemies append to bottom unless spike-qualified.
- Party uses a shared HP pool.
- Purple gem behavior:
  - Applies party attack amplification (not debuff).
  - No legacy debuff behavior is valid.

### Gem / Action Flow

- Player states are mutually exclusive:
  - gem selection
  - target selection
  - nav menu
  - refill
- Refill is gated during gem selection, target selection, and overlays.
- Blue gem = party buff roulette.
- Purple gem = party attack amplification (canonical behavior).

### UI / Modal Layering

- Nav UI renders above dark field.
- Dark field blocks gameplay but never covers nav UI.
- Gemboard layers must not shift during nav display.

### Deployment & Safety

- All deploys originate from `main`.
- Netlify must track `main`.
- Production builds must be tagged.
- Never rebuild runtime from archived C3 JSON.
- Never treat ZIP artifacts as secondary; they are canonical snapshots.

### Debug / QA

- Track-next group shows upcoming turns with base and boosted stats.
- Combat logs must remain intact.
- New instrumentation must be removable and isolated.
