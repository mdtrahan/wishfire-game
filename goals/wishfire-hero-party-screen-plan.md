# Hero Party Screen Redesign — plan for owner review

Bead: ORKA-k63. Lane: `bead/ORKA-k63-hero-party-screen` at `.worktrees/wt-ORKA-k63-hero-party-screen`.
Rollback: tag `wishfire-checkpoint-20261020-before-ORKA-k63-hero-redesign` (= main `b5895de6`). Nothing lands on `main` without separate approval and Integration Ready evidence.

Status: drawn mockups r1–r3 in `output/ORKA-k63/mockup/drawn/`. Owner approved building phase 1 on 2026-10-20 (bead ORKA-9ee) with the r4 notes below. On 2026-10-20 the owner directed phases 2–4 to be built in the same ORKA-9ee lane (rollback tag `wishfire-checkpoint-20261020-before-ORKA-9ee-phase2`); the defaults taken for the open decisions are recorded under "Phase 2–4 build".

## What Archero 2 does better

Reference: the owner's Archero 2 Characters captures (roster, card actions, Resonance, Choose-a-skill, Star-up Stats).

| Archero pattern | Why it works | Wishfire today (ORKA-2c2 screen) |
|---|---|---|
| One screen: showcase on top, roster below, always visible together | You see who you're editing *and* the whole party; no carousel | Single hero with ‹ › arrows; roster hidden |
| Showcase sits on a scenic stage with a name plate and star row | Hero feels like a collectible; stars show long-term growth at a glance | Hero on flat navy; name/level/CP text top-left |
| Right-side card shows **one** signature skill with 3 tiers gated by stars | Clear "what makes this hero special" and "what's next" | Skills hidden in a tab; 8–9 skills paged four at a time |
| Actions appear **on the selected card** (Resonance / Star Up / Use) | Zero travel; context is obvious | Actions spread over tabs and slot buttons |
| Sub-panels replace the roster area with pill title + X; showcase stays | Deep features without leaving the screen | Tabs swap a cream panel |
| Card progress pill (29/150) + red dots | Always tells you what's upgradeable | No roster-level progress cues |
| **Resonance:** 2 slots that borrow other heroes' skills as passives | Player expression; every owned hero has value even when benched | No equivalent |
| **Star Up:** duplicate currency buys star milestones with hero *and* team-wide [All] rewards, +skill tiers, +Resonance slot | Second progression axis; collection pays the whole party | Level/EXP only; gear via lamp |

Streamlined because each piece of information has exactly one home; robust because two extra progression layers (stars, resonance) hang off the same card.

## Wishfire adaptation

Wishfire is a 4-hero party game, not a single-hero game, so:
- Archero **Use** → **Set Leader** (camera and lead, per the leader-anchored movement). Later, when the roster exceeds the deployed party, add **Deploy**.
- The roster shows 4 heroes + locked future slots; the **Formation** button (mini 4×3 preview + camera badge) sits at the showcase's left edge where Archero puts its castle icon, opening the agreed 4×3 board as a bottom sheet.
- Signature skill card = each hero's role-defining **awakening** (Cover, Overrun, Cataclysm, Sanctuary), not the full active list. The 8–9-skill kit with level unlocks (1/5/10/15/25, 35/50, 60, 75) stays in a Skills detail reached from the card.
- Tabs: **Heroes | Gear | Orb**. Gear keeps the existing Hat/Body/Boots lamp equipment detail; Orb keeps EXP, level progress and expanded stats until Orb equipment exists.

## Phases (each its own bead, lane and rollback tag)

1. **Layout restructure — existing data only.** Showcase on `training-scene.png`, name plate, signature card, tab strip, roster grid with on-card actions (Level Up / Set Leader / Details), sub-panel pattern, Formation button (opens a read-only preview until phase 2). Removes the carousel. No save or gameplay change. Shippable alone. Stars render hidden or as level tiers until phase 3.
2. **Formation sheet.** The agreed 4×3 board, drag/swap, leader badge, Auto-Form, 3 presets + Copy, Total CP. No formation board exists in runtime yet, so this needs a deterministic owner in `src/`/Rust and a save field — separate bead.
3. **Star Up.** New progression layer: material, star count, milestone rewards, save migration. **Gameplay change → requires player-living-guide update and owner approval first.**
4. **Resonance.** Passive slots fed by other heroes' skills; slot 2 from a star milestone. Depends on phase 3. **Gameplay change → same approval gate.**

Phases 1–2 are presentation and party setup; 3–4 change balance and must not start on presentation approval alone.

## Owner r4 notes (2026-10-20, applied to phase 1)

- Showcase backdrop is simple and quiet so the hero is the focus.
- Signature skill panel is a high-contrast card (light panel, strong border) that stands apart from the backdrop.
- Tabs are flat labels without ornament, hero art or flavour icons.
- Roster cards sit on a soft neutral light gradient, never coloured backers that read as rarity; cards show portrait, level and the hero-ticket progress bar only (no name or EXP strip).
- Gear tab shows the hero's equipped items and the full stat sheet; selectable inventory stays in the Bag screen. Orb tab shows only the coming-soon placeholder.
- Resonance stays as a placeholder entry for a later progression layer.

## Owner decisions needed

1. **Signature skill:** is the awakening the right "headline" skill for the card, or should it show the next locked active?
2. **Star Up material:** hero-specific Hero Tickets (art exists in `progression/hero-tickets.png`)? Source: quests, boss clears, Vault, daily? Wishfire has no duplicate/gacha source today.
3. **Star track:** how many stars (Archero: 5 gold + purple tier) and what milestones grant — party-wide stat bonuses, signature tiers, Resonance slot +1? Should stars gate any active skill, or stay additive so the level schedule in the player guide is untouched? (Recommend additive.)
4. **Resonance pool:** passive versions of other heroes' skills (Archero model), or a separate passive-talent pool? Is it worth having before the roster grows past four?
5. **Formation button side:** left edge (Archero position, recommended) vs right.
6. **Phase 1 action set:** Level Up / Set Leader / Details now, swapping to Resonance / Star Up / Set Leader when phases 3–4 land?

## Constraints carried forward

- Real hero art only (Fara, Hondo, Runa, Kaja PNGs); no Archero/StoneAge art or colours.
- Wishfire palette and existing bottom nav; 360×640 and 216×384 compact containment; UI-lock gate (`test:lamp-ui`) on presentation owners.
- Preserve saves, earned levels, EXP and equipment; `web-runner/app.js` stays orchestration-only.
- Previous redesign (ORKA-2c2) contracts for Gear detail and 33-skill coverage must still pass.

## Phase 2–4 build (2026-10-20, ORKA-9ee lane)

Defaults taken for the open owner decisions; each is a tunable constant and can be revised.
- **Formation** (`web-runner/src/core/heroFormationRules.mjs`, `systems/heroFormationStore.mjs`, save `wishfire.heroFormation.v2`). Owner r6 (2026-10-20) replaced the first 4×3 draft with the StoneAge spec: two 2×2 grids read left to right. Heroes fill the left grid column by column — tankier heroes in the left (front) column, ranged in the right (back) column — and players rearrange freely (tap a hero, then a slot). The right grid is locked until any hero reaches level 30 (`FORMATION_SECOND_GRID_LEVEL`, a provisional threshold); locked, it is a slim tile, and an empty grid adds no combat depth. The board faces left; combat mirrors it when the party travels right. Combat reads each hero's column (depth) and row (lane); the default board reproduces the authored role formation exactly. Owner r7: Formation is a full-screen modal (StoneAge Set Party), not an in-pane insert. Set Leader, Auto-Form, three presets with Copy (active → next) and Total CP remain; KO succession runs leader, then left to right, top to bottom. A saved dev movement tuning that names a leader still wins. Formation button: left edge.
- **Star Up** (`heroGrowthRules.mjs`, saved as `growth` inside the combat progression record, omitted while empty): material is the hero's own Hero Tickets (shared with Level Up). 15 stars = bronze/silver/gold tiers of five. Star n costs 50·n tickets. +2% HP/ATK/DEF/MATK/RES per own star; each completed tier on any hero is a +1% [All] party bonus. Additive only — stars gate no skills, so the level schedule is untouched.
- **Resonance**: two slots per hero, slot 2 at ★5. A slot holds another hero, who lends a passive echo of its signature stat (Fara DEF, Hondo ATK, Runa MATK, Kaja HP) worth 5% + 0.5% per lender star. Chosen over borrowing other heroes' active skills because it needs no new combat behaviour; skill-borrowing can replace it later. Free to change.
- Combat applies party training plus growth as one permanent `up` modifier per stat (`permanentHeroModifiers` in `realtimeSkillState.mjs`); later deployed copies (`#2+`) do not inherit growth, matching gear ownership. CP readouts stay on base stats.
- Signature skill card keeps the awakening; the selected-hero action row is Level Up / Star Up / Resonance.
