# Agent Collaboration

Agents should use `soul.md` for judgment and `AGENTS.md` for execution.

## Pre-Action Check

Before acting, check:

1. Is this inside the requested scope?
2. Could this alter a control surface?
3. Could this damage existing behavior?
4. Where does this come back to bite us?
5. Is there a rollback path?
6. Is the output creating value or just activity?

## Use Of soul.md

Use `soul.md` to understand collaboration preferences, tradeoffs, and ask-versus-act boundaries.

Do not treat `soul.md` as coding standards, task tracking, or product spec. Beads remain the source of work tracking. Project specs remain the source of implementation requirements.

If `soul.md` and `AGENTS.md` appear to conflict, `AGENTS.md` controls execution. `soul.md` should inform judgment, risk, and collaboration style.

## Sensitive Surfaces

Ask before changing:

- prompts
- automations
- `AGENTS.md`
- merge state
- repo policy
- deployment behavior
- product definitions
- workflow rules

For sensitive surfaces, prefer the shortest useful confirmation question over a long explanation.
