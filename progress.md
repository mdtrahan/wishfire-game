Original prompt: Combat damage numbers are broken in combat.

# Progress

- Investigate whether damage numbers are missing, duplicated, malformed, or layered incorrectly in combat.
- Confirm the render path in browser and identify the owning seam before editing.
- Root cause candidate: DOM damage-number layer can suppress the canvas fallback globally before an individual DOM animation is confirmed.
- Fix in progress: make the fallback per-entry and keep canvas rendering available for entries without a live DOM animation.

- Current prompt: Damage numbers render, but the initial spawn pose flashes distractingly at the target point before the float-up animation settles.
- Follow-up: keep the entry pose full-size and reduce upward travel so the number does not read as too small or too high above the hit point.
- Follow-up: a second motion path on the wrapper was causing the pop/snapping translation; keep only one vertical float tween and claim DOM ownership before canvas fallback can draw the same entry.
