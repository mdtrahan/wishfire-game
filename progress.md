Original prompt: Expose deterministic test hooks so agent-browser CLI can validate turns, skills, and board resolution without manual play (dev-only, no gameplay changes, canvas game).

Notes
- Add window.render_game_to_text with concise state snapshot for agent-browser CLI.
- Add window.advanceTime(ms) deterministic stepping hook tied to update/render.
- Reuse existing __codexGame hooks (dev-only) and avoid gameplay changes.

TODO
- Implement render_game_to_text and advanceTime.
- Ensure progress.md updated after changes.
- Run agent-browser CLI flow if requested.

Update
- Added window.render_game_to_text with concise state snapshot (turn, party, resources, heroes/enemies, gems, flags).
- Added window.advanceTime(ms) deterministic stepping using fixed 60fps dt.
- drawFrame now accepts optional dt override.
 - Added round state + TurnOrderArray snapshot to render_game_to_text for deterministic turn-order tests.
 - agent-browser CLI test burst (KeyA devtest) confirms turn order advances across rounds (see /tmp/web-game-turns-2).
