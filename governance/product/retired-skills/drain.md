# Drain

Status: retired

Retired on: 2026-06-14

Canonical skill id: `party_drain`

Related Beads:
- `ORKA-nozn` - original Drain skill implementation bead
- `ORKA-zsc9` - Drain visual-presentation fix bead

Reference implementation:
- Branch: `bead/ORKA-zsc9-drain-visual-pool`
- Commit: `d9af89847e0710333e3d98256e5e93636dd6cc05`
- PR: `https://github.com/mdtrahan/wishfire-game/pull/142`
- Local archive tag: `archive/drain-visual-reference-20260614`

## Retirement Decision

Drain is retired as an active skill-card option.

Historical note: the original retirement rationale referenced an older
team-turn combat framing. Current normal combat uses effective Speed interleaving.
Drain remains retired because a party skill focused on slowing enemy Speed did
not deliver the power-fantasy level expected from Astral Flow skill cards.

Drain must not appear in normal skill draughts, forced skill draughts, or active
skill draw debug counters.

## Preserved Value

The `ORKA-zsc9` lane is useful as visual presentation reference, not as a skill
to ship. QA found:
- the blue pool/ground effect reads correctly
- the blue enemy mask reads correctly
- the intended slow shimmer line cue still did not visibly appear

Use the branch/commit above if a future high-value skill needs a blue pool field
or blue enemy mask treatment.

## Recovery

To inspect the retired visual work later:
`git show d9af89847e0710333e3d98256e5e93636dd6cc05`.
