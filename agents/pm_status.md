# PM Status

Active snapshot only. Historical PM snapshots live in `/agents/archive/pm_status_archive.md`.

_Last updated: 2026-04-09_

## Completed Beads
- ORKA-h3x (harness-engineering repo map first cut landed with rollback checkpoint, docs indexes, compatibility shims, canonical browser policy/validation docs, and a doc contract test)
- ORKA-dm5 (damage-number glow pass aligned to the main glyph baseline; DOM ownership now claims before canvas fallback so Falie hits no longer read as doubled)
- ORKA-dm4 (damage text size reduced by 30% with a uniform scale-only change; tween path, rise distance, and aspect ratio preserved)
- ORKA-dm3 (damage-number entry pose now starts hidden/compressed so the first visible frame no longer flashes at the target anchor)
- ORKA-dm2 (shared GSAP shim now interpolates combat damage text and enemy HP bar animations instead of snapping final values)
- ORKA-dmg (combat damage numbers hardened with per-entry fallback, so overlay ownership no longer blanks combat text)
- ORKA-h9q (hero leveling system added with deterministic Lv1-99 XP curve, kill-based XP awards, and pacing validation)
- ORKA-9tny (minimal browser QA battery added with agent-browser smoke, render-hook probe, and artifact capture guidance)
- ORKA-r43t (governance + Notion sync hardening completed)
- ORKA-j4t0 (anti-orphan PM-cycle rule landed)
- ORKA-e1n4 (mandatory bead-purpose statement compliance landed)
- ORKA-pmcycle-2026-04-01 (strict ready-head governance enforcement applied: ORKA-6opp blocked, ORKA-n0g deferred)
- ORKA-esqm (party HP bar immediate resize for hero party path; tiered front colors, yellow plateau updated to #EBE413; enemy HP animation untouched)
- ORKA-ksw (hero skill-node trio aligned to Figma frame; circle badges centered and diamond re-anchored by centerline math)
- ORKA-0ky2 (hero skill modal opens from skill taps; modal reuses the selected skill frame variant and keeps descriptions placeholder-only)

## Active Work
- None.

## Next Tasks
- Reconcile the remaining domain docs into explicit roles in the registry so the harness map can expand safely without reintroducing duplicate front doors.
- Decide whether to migrate canonical product and workflow docs physically under `docs/` or keep the new indexes as the permanent alias layer.
- Add broken-link and duplicate-purpose checks to the doc contract suite once the active docs set is stable.
- Execute ORKA-hvj.5.1 first to lock the Westrom sandbox baseline, preserved layout language, and fixed scroll anchors between the skill-points row and close-button area.
- Execute ORKA-hvj.5.2 after ORKA-hvj.5.1 to source five additional hero skill cards from existing beads only and apply the agreed Runa slot-8 `mapping pending` non-actionable policy if still unmapped.
- Execute ORKA-hvj.5.3 after ORKA-hvj.5.1/.2 to render the expanded card stack inside one bounded scroll owner with no nested scroll containers.
- Rewrite ORKA-5wj1 with explicit acceptance/test contract for: threshold trigger behavior, player prompt branch vs passive-chance branch, and effect-end reset verification seam.
- Rewrite ORKA-6opp with concrete acceptance + deterministic/runtime tests, then reopen only when executable.
- Rewrite/decompose ORKA-n0g into remaining exclusive-slot/combat-accessory hook scope before undefer/reselect.
- Resume executable bug lane ORKA-39i0 once queue-head noise is removed.
- Resume ORKA-macy only after the harness/runtime launch boundary is stable, then rerun the 20-valid-pass evidence collection.
- Prepare the next Figma-driven modal/layout bead using the hero-skill modal seam as the reusable pattern.

## Known Issues
- The harness migration is only phase 1/2 complete; canonical indexes exist, but many legacy docs outside the entrypoint set still need explicit role tagging or archival decisions.
- Browser policy contradiction is reduced but not fully retired until older QA docs are further normalized or archived.
- Browser battery e2e path is CDP-attached by design; direct sandbox launch remains flaky here and is documented as an external-browser boundary.
- ORKA-5wj1 is blocked due missing executable acceptance/test contract.
- ORKA-6opp is blocked pending rewrite.
- ORKA-n0g is deferred as future stub pending rewrite/decompose.
- ORKA-39i0 remains open with known red single-target handoff regression risk.
- ORKA-macy is blocked because 20-valid-pass evidence could not be completed at the harness/runtime launch boundary.
