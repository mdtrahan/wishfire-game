# Hero Screen Redesign

Bead: ORKA-2c2. Base checkpoint: 38f355d1. Active lane: codex/ORKA-2c2-hero-redesign.

## Goal
Implement the two attached optimized Hero references while retaining canonical heroes, owned instances, saved gear, progression, all supported skills, and persistent bottom navigation.

## Part 1
Enlarge and center full-body hero art; place name, level, role and CP at the upper left. Replace the persistent roster with previous/next hero arrows. Put Hat, Body, Boots and the existing Orb slot in one horizontal row. Remove decorative unassigned boxes. Show actual ATK, DEF and maximum HP in the gold stat bar. Place Orb/Gear/Skills tabs immediately above a larger cream information panel. Keep portrait geometry consistent across tabs and reserve the existing boss retry safe band. Validate the shell before Part 2.

## Part 2
Gear selects and highlights the owned item and reports name, rarity, level and every stat bonus. Skills shows exactly four icons at once, preserves access to the current 8–9-skill kits, and displays canonical name, range, cooldown, description and unlock condition. The Skills icon row has no Orb. The existing Orb slot is unavailable; retain that state and keep numeric EXP, level progress and expanded hero stats accessible in the Orb panel. Tab switches retain hero identity; hero switches refresh contextual data. No sample stat values or gameplay changes.

## Gauntlet and completion
A Luna builder implements each part sequentially. Independent Luna review checks the exact candidate against the references and supported interactions. Root validates the live in-app preview and automated portrait/compact geometry. Correct material regressions before final checkpoint. Preserve player saves; use isolated fixtures for destructive QA. Keep one active preview server and stop the replaced server.

Validation includes existing UI-lock baseline and final run, focused hero contracts, real-asset responsive interaction checks, screenshots of all tabs and hero switching, and a normal-hook scoped checkpoint. This branch is preserved for review; merge and publication are separate actions.

## Delivered candidate
Both parts completed sequentially. Part 1 passed its focused contracts, three-profile fixture and native preview before Part 2 started. Final Skills pages contain exactly four active icons: eight-skill kits use starts 0/4; Kaja’s nine-skill kit uses 0/4/5 to preserve a full final page. The shared icon background is differentiated by canonical effect glyphs and skill names.

Final checks: 8 focused contracts; all 33 skills across 360×640, 216×384 DPR2 and 591×1223; 120/120 UI-lock invariants; native Gear/Skills/Orb and hero switching, with no captured browser errors. Isolated browsing preserves both saved records and in-memory progression/equipment. Independent Luna source and screenshot review passed after correcting row placement, range wording, Shrink glyph and selected-text contrast. Reviewer context was reused under the agent-thread limit with a new task brief.

Artifacts: test-results/hero-redesign/report.json and per-profile/tab PNGs; native captures and UI-lock log under /Users/Mace/Codex-Orka/output/qa/ORKA-2c2. Preview remains localhost:8148; the prior preview process was stopped before replacement.

Remaining boundaries: Orb equipment was already unavailable and remains so. Skill art reuses the existing generic shield background. No merge, publication, gameplay balance or save migration belongs to this change.
