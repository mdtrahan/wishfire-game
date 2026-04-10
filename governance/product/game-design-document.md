# Wishfire / Codex-Orka Game Design Document

Role: product-spec
Status: active
Canonical index: [../../docs/product/index.md](../../docs/product/index.md)

Purpose:
- Give a single product-facing description of the game, its current feature set, and its design intent.
- Provide a stable document to compare against other games' GDDs.
- Stay grounded in the live runtime; if the runtime and older planning notes disagree, runtime wins.

Companion references:
- For a tighter feature-by-feature runtime explanation, use [governance/product/game-function-reference.md](governance/product/game-function-reference.md).
- For combat timing, player-control windows, and browser QA behavior, use [governance/qa/combat-playwright-control-model.md](governance/qa/combat-playwright-control-model.md).

## 1. High Concept

Codex-Orka is a puzzle-combat battler with a 4-hero party, seeded enemy encounters, layout-based meta screens, and a growing progression layer built around gem use, hero identity, and future unlock surfaces.

The simplest description is:
- tap-3 gem combat
- turn-based hero/enemy resolution
- hero roster and skill progression
- meta screens for map, vault, and related systems

## 2. Design Pillars

### 2.1 Readable combat first
- Combat must be legible at a glance.
- The player should understand whose turn it is, what gem color means, and whether input is allowed.
- Visual effects support the action, but do not obscure the board.

### 2.2 Distinct hero identity
- Heroes are not anonymous units.
- Falie, Huun, Runa, and Kojonn each have their own identity, role messaging, and skill-facing surfaces.
- Progress is keyed by stable hero identity rather than a temporary runtime actor alone.

### 2.3 Layout-driven metagame
- The game is not only a battle board.
- Hero, map, chest/vault-family, and related screens are part of the experience.
- These layouts are meant to expand the player loop rather than replace it.

### 2.4 Current-state honesty
- The document describes what exists now, not only what is planned.
- Scaffold/shell screens should be treated as real surfaced content, but not as finished systems.

## 3. Core Player Loop

1. Enter combat from the story mock screen.
2. Match 3 gems of the same color.
3. Resolve the gem's action or progression effect.
4. Enemy actions resolve automatically.
5. Return to a safe player-input window.
6. Branch into hero, map, vault-family, or other side layouts when the game offers them.
7. Return to combat and continue the same session.

This is best described as:
- a puzzle-combat battler
- with light hero management
- and a progression shell that grows around the combat loop

## 4. Player Fantasy

The player fantasy is not "build a deck" or "open-world roam."
It is:
- assemble a small party of named heroes
- read the board quickly
- use gem color to trigger the right kind of action
- watch the party's identity and progression grow over time

That makes the game closer to a tactical puzzle battler than a generic RPG sheet.

## 5. Combat System

### 5.1 Party and encounter shape
- The party currently uses 4 heroes.
- A standard encounter usually shows 3 enemies.
- Turn order is driven by runtime combat state rather than a freeform action queue.

### 5.2 Match rule
- Valid input is currently "any 3 gems of the same color."
- Adjacency is not the player-facing rule.
- The color choice matters more than row/column position.

### 5.3 Gem meaning

Current runtime gem-action mapping:
- Green: hero AOE attack flow
- Red: hero single-target attack flow
- Blue: Astral Flow wallet / progression gain
- Yellow: special casino/recolor flow
- Heal / light green: healing action
- Purple: Power Amp activation

### 5.4 Follow-up action states
- Some gem colors resolve immediately.
- Some open a follow-up choice such as target selection or confirmation.
- A visible board is not enough to imply actionable input.

The combat model is intentionally stateful:
- hero input window
- hero action resolution
- enemy action resolution
- board transition / repopulation window

### 5.5 Combat presentation
- Combat text, counters, turn flow, and side radiators all exist in the combat layout.
- Presentation should help the player understand state, not hide it.

## 6. Heroes

The current core heroes are:
- Falie
- Huun
- Runa
- Kojonn

What hero design currently includes:
- stable identity
- role messaging
- combat stats
- skill progress state
- skill-facing UI surfaces
- per-hero gem usage tracking

Hero design intent:
- each hero should feel like a real party member
- hero-facing UI should communicate progression, not just numbers

## 7. Skills And Progression

The game already has multiple progression surfaces:
- hero skill points
- gem usage persistence
- gem milestone tracking
- blue-gem wallet/progression
- the Vault family hub
- several scaffolded child screens that act as future progression homes

Current implication:
- the game is not just about combat outcomes
- combat feeds long-term progression systems
- progression systems are still being filled in, not all of them are finished

## 8. Layouts And Screens

### 8.1 Story mock
- Startup / entry surface
- Used to enter combat

### 8.2 Combat
- Main game board
- Core tactical loop
- Hero input, enemy turns, combat text, and radiators live here

### 8.3 Hero screen
- Hero identity and progression surface
- Skill-oriented UI
- Used to inspect and upgrade hero-specific capability

### 8.4 Map
- Locale / routing surface
- Used to preview encounter context and return to combat

### 8.5 Chests / Vault family
- Hub for future and partial progression systems
- Includes scaffolded child layouts such as tomes, artifacts, mounts, relics, pets, and homestead

### 8.6 Dev / utility surfaces
- The runtime also exposes utility and QA-facing controls
- These are not core player fantasy, but they matter for testing and iteration

## 9. Visual And UI Principles

- The combat board should remain readable.
- Layouts should have clear ownership boundaries.
- Side radiators should not obscure the active play area.
- Skill and hero screens should prioritize identity and progression over dense spreadsheets.
- Motion should clarify state changes, not create ambiguity.

## 10. Feature Inventory: Live, Scaffolded, Future

### Live and player-visible
- Combat board
- Gem color matching
- Hero roster
- Hero identity / role messaging
- Combat text
- Map routing
- Hero skill / progression surfaces
- Gem usage tracking

### Present but still scaffolded or partial
- Vault-family child screens
- Several future progression shells
- Some economy/progression unlock surfaces

### Planned or intentionally incomplete
- Final tutorial copy
- Final feature presentation polish
- Many long-term progression reward rules
- Any content that depends on future art or narrative fills

## 11. What This Game Is Not

It is not currently:
- a full open-world RPG
- a deckbuilder
- a combat sim with freeform positioning
- a static UI mockup

It is:
- a live puzzle-combat game
- with a growing meta-progression layer
- and a layout system that already supports several distinct screens

## 12. Practical Product Reading

If you need the shortest possible summary for external comparison:
- core genre: puzzle-combat battler
- player loop: match 3 gems, resolve hero/enemy turns, return to combat, grow hero progression
- differentiator: the gem colors map to different action families and progression seams
- product shape: playable combat now, with expanding hero/map/vault progression shells around it

## 13. Known Gaps

This document intentionally does not invent:
- final tutorial text
- final skill descriptions
- finished vault contents
- finished meta-progression economy
- future story beats

Those should be defined in bead acceptance, implementation docs, or later product notes when they are actually ready.
