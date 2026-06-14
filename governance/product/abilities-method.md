# Ability Method

Purpose:
- Preserve the review method that made `abilities.html` and `hero-and-party-skill-pseudocode.md` useful.
- Prevent future agents from rediscovering the same role-review and reference-search path.
- Keep process notes outside the GDD page itself.

Cross-project reuse:
- Use `$game-gdd` when available to apply this method to a new game, feature, or systems GDD.
- Do not add secondary methodology pointers to `AGENTS.md`; the existing `abilities.html` pointer is enough for this repo.

Use this method when changing ability taxonomy, skill tiers, Astral Flow draw behavior, supergem identity, event timing, source tags, or pseudocode handoff details.

## Source Stack

Primary local sources:
- `abilities.html` owns taxonomy, lifetimes, timing, risk containment, proof cues, and drift.
- `hero-and-party-skill-pseudocode.md` owns readable payload sketches and helper seams.
- `hero-and-party-skills.md` owns current skill names, owners, raw rank increments, and card text.
- `skill-proc-qa-guide.md` owns proc proof expectations.
- `hero-supergem-bead-ledger.md` owns current supergem evidence.
- `player-living-guide.md` owns player-facing language.

External references are inputs, not authority. Use them to improve structure and vocabulary, then translate the useful parts into local Wishfire terms.

Useful external channels from this pass:
- Machinations docs/articles: resource roles, feedback loops, converters, gates, drains, sources, delays.
- FFXI ability-layer review: different front doors can delegate into shared utility families and payload primitives. Translate this as Wishfire vocabulary only: thin recipes, owner identity first, named fields instead of positional arrays, presentation outside mechanics, and constrained support/passive lanes that do not steal a hero's main role.
- Modern GDD articles: keep docs live, scoped, scan-friendly, and tied to edge cases.
- RPG design references: connect skills to role, progression, party function, and player decision.
- Reddit/game-dev discussion: avoid central junk-drawer docs; make the slice useful for the team actually using it.

## Reviewer Lanes

Use four required reviewers for major ability-doc changes:
- Game designer: player fantasy, hero identity, skill draw reality, and local iteration clarity.
- Systems designer: taxonomy, lifetimes, rank math, event timing, loops, and source precedence.
- Product manager: source ownership, status vocabulary, doc scope, and team navigation.
- Combat designer: timing stacks, proc order, counterplay, supergem identity, and combat edge cases.

Add a technical gameplay designer when the doc touches pseudocode, events, source tags, state anchors, debug proof, or implementation handoff.

Reviewer output should be:
- `PASS`, or
- `CONCERNS` with must-fix issues first and nice-to-haves second.

Do not ask reviewers for broad brainstorming after the doc is already shaped. Ask them to attack specific failure modes.

## What Worked

High-value checks:
- Separate progression lane from payload facet. A skill can be a hero rank ability and a proc payload.
- Name the exact event before eligibility, roll, payload, feedback.
- Define compact event envelopes when pseudocode reads event fields.
- Use canonical lower-snake skill IDs in pseudocode, not display names.
- Preserve original source tags when redirecting damage; add redirect metadata separately.
- Tag generated payloads with `sourceTag` and `generatedBySkillId`.
- Mark unresolved mechanics as blocked stubs instead of half-implementable sketches.
- Keep party draw skills rank-1 for current session behavior; label full ladders as reference/future party-rank material.
- Give each skill a proof cue: visible feedback, trace/source tag, counter, cooldown, one-shot consumption, or deterministic check.
- Attack action-shape proposals for hidden one-off logic. Ask whether the skill can be expressed as player intent, trigger/owner, target/payload, bounds/counterpressure, and evidence/handoff before inventing a new function shape.
- Separate current runtime seams from design-target seams. Do not describe `ActionResult`, canonical ability events, shared resolvers, source-tag propagation, or cumulative rank chance as live unless current code proves them.
- Require source lineage, cap key, reset boundary, cooldown group, stack/overwrite policy, cleanup hook, generated-action suppression, visible proof, and trace proof for high-risk abilities.

Common failure modes:
- GDD copy drifting into agent workflow or delivery mechanics.
- Status labels sounding like tracker authority instead of design state.
- Skill draw language accidentally mixing permanent hero ranks with Astral Flow session picks.
- Pseudocode inventing state stores instead of naming existing runtime seams.
- Reference lessons becoming project canon instead of vocabulary for local design.
- One implemented skill, such as Destiny, being treated as archetypal DNA for every future ability.
- External article structure being copied instead of translated into the local game.

## Validation

Before calling the docs done:
- Check `abilities.html` table cells match headers.
- Check section anchors resolve.
- Check no tier ladders have spaces around slashes.
- Check no absolute local links.
- Check draw terminology has no beer-style variant or delivery/process wording.
- Check pseudocode uses canonical IDs.
- Check every named event used by pseudocode has an envelope or a deliberate no-field rule.
- Check generated damage, board effects, free actions, turn shifts, reward bonuses, and redirects carry source metadata.
- Check `git diff --check` on touched docs.

Stop when:
- Local validation passes.
- Required reviewers return `PASS`.
- Remaining unresolved gameplay items are visible as design drift or blocked stubs, not hidden contradictions.
