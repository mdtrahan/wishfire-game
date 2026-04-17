id: ORKA-bse
title: [FEAT] Hero selector bounce-in effect
status: in_progress
priority: P2

description: Add a bounce-in appearance to the hero/character selector when it appears over the active hero. Use the provided easing curve for the scale-up entrance only. Do not add the matching scale-down phase. The selector's current rendered dimensions are the maximum size reached at the end of the bounce.

acceptance_criteria:
1. When the hero selector becomes visible for the active hero, it animates in with a bounce-scale entrance rather than appearing instantly.
2. The bounce uses the provided easing curve only for the scale-up / settle-in behavior; no scale-down exit animation is added.
3. The selector's current size remains the final settled size; the animation starts smaller and resolves to the current dimensions.
4. Existing selector pulse/bob behavior may continue after the entrance only if it does not distort the final max size target or fight the bounce-in effect.
5. Scope is limited to the hero selector visual treatment in combat; no change to selector rules, targeting, or other UI selectors.

notes: pmcycled 2026-04-12;  Easing reference supplied by user on 2026-04-12. Current selector render path lives in web-runner/app.js under the hero turn indicator selector block.
