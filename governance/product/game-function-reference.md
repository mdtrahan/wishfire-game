# Game Function Reference

Role: runtime-reference
Status: active
Canonical index: [../../docs/product/index.md](../../docs/product/index.md)

Purpose:
- Explain what the current game actually does today.
- Give future FAQ/tutorial/spec writers one stable place to start.
- Reduce repeated reverse-engineering of `web-runner/app.js` and `web-runner/modules/functionBank.js`.

Companion reference:
- For a broader game-design overview, use [governance/product/game-design-document.md](governance/product/game-design-document.md).
- For combat timing, QA sequencing, and Playwright/player-control rules, use [governance/qa/combat-playwright-control-model.md](governance/qa/combat-playwright-control-model.md).

Scope:
- Current runtime behavior only.
- This is not a promise of future design.
- If runtime and old planning notes disagree, runtime wins.

## 1. Core Player Loop

The smallest useful model of the game is:

1. Enter combat from the story mock screen.
2. Fight a 3-enemy encounter with a 4-hero party.
3. On hero turns, select 3 gems of the same color.
4. The gem color determines what kind of action or progress happens.
5. Enemy turns resolve automatically.
6. The fight can branch into side layouts such as Hero, Map, or Vault-family screens.
7. The player returns to combat and continues the same session.

This means the game is currently a:
- puzzle-combat battler
- with layout-driven meta screens
- and early progression scaffolds already wired into the runtime

## 2. Main Runtime Layouts

The active layout router lives in [web-runner/app.js](web-runner/app.js).

Current important layouts:

- `storyMock`
  - Startup / entry surface.
  - Player taps to enter combat.

- `combat`
  - Main gameplay board.
  - Heroes, enemies, gems, turn flow, combat text, counters, and side radiators all live here.

- `heroLayout`
  - Hero screen / hero roster presentation.
  - Shows hero identity, role messaging, and skill-card style UI.

- `mapLayout`
  - Map / locale surface.
  - Used to preview encounter context and return to combat.

- `chestsLayout`
  - Vault-family hub.
  - Entry point to the currently scaffolded progression children.

- Vault-family child layouts
  - `tomesLayout`
  - `artifactsLayout`
  - `mountsLayout`
  - `relicsLayout`
  - `petsLayout`
  - `homesteadLayout`

Important product interpretation:
- The Vault family is structurally present.
- Several child layouts are still scaffold/shell states, not full progression systems yet.

## 3. Combat Structure

Combat currently works like this:

- The party uses 4 heroes.
- A standard encounter usually shows 3 enemies.
- Turn order is driven by the runtime turn system in [web-runner/modules/functionBank.js](web-runner/modules/functionBank.js).
- Hero turns and enemy turns are processed by `ProcessTurn`, `HeroTurn`, and `EnemyTurn`.
- Enemy encounters are seeded and spawned through the combat/layout bootstrap in [web-runner/app.js](web-runner/app.js).

Practical FAQ/tutorial translation:
- “You do not drag-swap gems.”
- “You tap any 3 gems of the same color.”
- “Some colors resolve immediately; some open a follow-up action.”

## 4. Gem Meaning

The current gem-action mapping is defined by `ResolveGemAction` in [web-runner/modules/functionBank.js](web-runner/modules/functionBank.js).

Current meanings:

- Green (`gemColor === 0`)
  - Hero AOE attack flow.
  - Opens a hero attack action path.

- Red (`gemColor === 1`)
  - Hero single-target attack flow.
  - Opens a target-selection attack path.

- Blue (`gemColor === 2`)
  - Astral Flow wallet gain.
  - This is progression/wallet-oriented, not a direct party buff.

- Yellow (`gemColor === 3`)
  - Casino recolor / yellow-special flow.
  - It is its own system and should not be described as a normal direct-damage gem.

- Heal / light green (`gemColor === 4`)
  - Healing action.

- Purple (`gemColor === 5`)
  - Power Amp activation.
  - This is an attack amplification / offensive boost path.

Critical tutorial rule:
- A valid match is “any 3 gems of the same color.”
- The current runtime does not require row/column adjacency for player selection.

## 5. Follow-Up Action Rules

Not every gem resolves the same way.

Important player-facing rules:

- Red and green hero actions can enter a pending attack state.
- In that state, the player may need to:
  1. choose an enemy target
  2. confirm via the centered attack button

- Blue resolves into wallet/progression flow and turn handoff timing.
- Purple resolves into Power Amp state.
- Yellow has its own special sequence behavior.

This matters for:
- tutorial copy
- automation
- acceptance criteria for future combat beads

## 6. Heroes

The runtime currently presents four core heroes:

- Falie
- Huun
- Runa
- Kojonn

What the system already supports:

- stable hero identity
- hero combat stats
- hero skill progress state
- hero role messaging surfaces
- gem-usage tracking by hero

What is important for specs:
- Hero identity is not only visual.
- Several systems now key progression by stable hero identity, not temporary actor UID alone.

## 7. Enemies

Enemy runtime behavior currently includes:

- CP/combat-power indexing
- role / locale / faction metadata
- single-target attack and magic attack behaviors
- named enemy job skills such as:
  - self-heal
  - ally-heal
  - all-allies heal
  - drain buff
  - X Out
  - Wipe

Important spec note:
- Some enemies remain alive in runtime arrays at `hp = 0` before cleanup/respawn handling catches up.
- Future automation/spec work should not assume “missing from array” is the only defeat signal.

## 8. Currencies And Counters

Current visible runtime currencies/progression counters include:

- Energy
  - core combat/session resource

- Gold
  - visible wallet resource

- Astral Flow Wallet
  - blue-gem driven wallet/progression surface

- Hero Gem Usage
  - per-hero color totals
  - party-wide color totals

- Hero Gem Milestones
  - threshold-tracking seam for future progression rewards/unlocks

Important product interpretation:
- The gem counter radiator and persistence layer now make gem use a real progression input, not just temporary combat telemetry.

## 9. Progression Surfaces Already Stubbed Or Partially Wired

These systems exist in meaningful form already:

- Hero skill-point progression runtime
- Hero gem-usage persistence
- Hero gem milestone seam
- Vault family hub
- Relics shell
- Pets shell
- Mounts shell
- Artifacts shell
- Tomes shell
- Homestead shell

What that means:
- The game already has multiple “future progression homes.”
- Content, art, reward rules, and unlock logic are still incomplete in many of them.

## 10. What Is Real Vs. What Is Still Placeholder

Real now:

- combat entry and combat turns
- enemy encounters
- gem-color action meanings
- target-selection flows
- hero roster runtime
- hero gem counters and persistence
- Vault-family navigation shell

Still mostly placeholder/scaffold:

- many Vault child content screens
- full Relics gameplay hooks
- final progression copy/tutorialization
- fully mature class-identity messaging
- final art/layout polish for future Vault surfaces

## 11. FAQ/Tutorial Writing Rules

Use these rules when drafting player-facing text:

- Say “tap 3 gems of the same color,” not “make a line” or “swap gems.”
- Describe blue as Astral Flow / wallet progress, not a standard temporary stat buff.
- Describe purple as Power Amp / damage amplification.
- Explain that some gem matches require a follow-up target/attack confirmation.
- Treat the Vault as a family of progression rooms, not one single inventory page.
- Do not promise unfinished child-layout features as if they already have full gameplay.

## 12. Spec Writing Rules For Future Beads

When writing future beads, specify:

- which layout is affected
- which gem colors or combat seams are affected
- whether the behavior is:
  - immediate resolution
  - pending target selection
  - progression tracking
  - UI shell only

Also specify whether the bead touches:

- combat rules
- layout routing
- progression persistence
- hero identity/state
- Vault child layouts

This prevents “UI shell” beads from accidentally becoming “gameplay system” beads.

## 13. Canonical Runtime Seams

Use these as the first places to inspect:

- Layout routing and runtime entry:
  - [web-runner/app.js](web-runner/app.js)

- Combat and gem-action rules:
  - [web-runner/modules/functionBank.js](web-runner/modules/functionBank.js)

- Combat gateway / layout integration:
  - [web-runner/src/core/combatRuntimeGateway.js](web-runner/src/core/combatRuntimeGateway.js)

- Stable project retrieval map:
  - [ai-memory/project.md](ai-memory/project.md)

## 14. Short Version

If someone asks “what game are we building?” the shortest correct answer is:

Codex-Orka is a tap-3-color puzzle combat game with 4 heroes, seeded enemy encounters, layout-based meta screens, and early progression scaffolds where gem usage, Astral Flow, and hero identity are already being turned into longer-term progression systems.
