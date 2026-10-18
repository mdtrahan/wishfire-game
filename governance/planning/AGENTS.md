# Governance Planning DOX

## Purpose
- Own architecture contracts, turn-state invariants, current migration plans and process planning.

## Ownership
- SimulationCore Rust/JS boundary docs.
- Turn-state invariants and layout/automation/backend contracts.
- Current consolidation plans and process decisions.

## Local Contracts
- Planning contracts describe intended boundaries and stop conditions; they do not authorize implementation unless the active bead scope does.
- SimulationCore planning establishes Rust as deterministic simulation owner and JavaScript as browser integration owner.
- Turn-state invariants establish speed-based interleaved initiative for normal combat.
- For JavaScript debloat, browser orchestration, `app.js` thinning, route/surface boundaries, or dependency-minimization decisions, consult `app-js-thinning-playbook.md` and apply `js-orchestration-review-checklist.md`.
- If a planning doc lists stop conditions, honor them before writing code.
- Keep reports/evidence separate from new implementation instructions unless a doc is explicitly a plan.

## Work Guidance
- When changing architecture docs, include the operational consequence: owner, forbidden owner, validation, and stop condition.
- Do not rewrite historical audits as current truth without checking current code and tests.
- Preserve rollback/checkpoint guidance for risky migrations and cleanup work.

## Verification
- `git diff --check` for markdown-only planning changes.
- Focused contract tests when planning changes are accompanied by code changes.
- For SimulationCore boundary changes, run Rust/WASM and focused ownership tests named in the relevant plan.

## Child DOX Index
- `character-identity-rebuild.md` - audit and proposed modular character/enemy identity, owned-hero and appearance boundaries; preserves current player-visible state and saves, with a gated one-time conversion and no runtime implementation authorization.
- `session-level-up-buff-pool.md` - final 48-card universal Wishfire session buff catalog, stage rules, runtime limits, and deterministic validation.

- `wishfire-progression-adaptations/README.md` owns the full adaptation goal, active stories, research holds, withdrawals and trial status; the acceptance matrix must cover every active spec criterion before full-goal completion.

- Wishfire progression keeps the owner-selected current EXP curve and manual2s/Auto5s cadence; sheet02 records the declined numeric trial. Combat/gear/hero-panel source agreement requires live deployed-actor evidence, including canonical versus instance identity.

- `wishfire-progression-adaptations/hero-owner-decision.md` records the repair to resume after integration: permanent progression/loadouts have one stable hero owner; combat actors are disposable and cannot create saved heroes. Save reconciliation requires earned-state preservation, unique item ownership and interrupted-write recovery.

- Reference progression evidence distinguishes combat stage from claimed task gates; a plus-looking skill control can stay task-locked. Use actual video frames for timestamps and preserve raw hashes when large recordings remain outside Git checkpoints.

- `conditional-skill-catalog.md` proposes readable conditions, targets and skill-action descriptions grounded in current combat; use Markdown per-hero skill cards with Skill/Condition/Target/CD tables followed by one-sentence effects; avoid raw HTML tables in the document preview; use native Markdown heading anchors for the skill navigation index and skill-name links, label proposals, and keep effects separate from counted skills. Preserve the original 24 proposed skill cards when adding legacy skills; each expanded hero kit retains one role-defining awakening, without cross-skill dependencies or named follow-ups. Legacy ownership, realtime adaptations and new tracking must be explicit. Chain Strike is one standalone Runa skill using the former II effect; Hondo owns the conical Arcane Pulse, Fara owns Destiny, and Kaja owns Shrink. Conditional progression tiers remain undecided. Cross-unit stat comparisons use parameterized subject/stat/operator/reference-group/aggregate inputs and current effective stats; avoid named-hero dependencies. Stat effects require projected-benefit guards, strongest-per-stat overlap, baseline recomputation and authored final bounds; validate again before commitment. Proposed cooldowns use integer seconds and exceed 20% separation within each hero, measured against the shorter cooldown. Validate count thresholds against pack sizes and spatial checks against combat coordinates; distances must never read as actor counts. Every named effect needs an explicit ID, owner and definition; undefined names fail authoring validation, and OR/AND groups must be explicit. Environmental affinities must cite authored lore and distinguish thematic proposals from established traits. Keep Owner review and readable linked hero cards separate from Coder direction; numerical bounds/unlocks remain labelled proposals, stable IDs survive display-name changes, and the active-worktree entry points govern implementation. Runtime implementation requires separate approval.

- The approved conditional catalog owns all 33 active entries, including four awakenings; historical five-skill migration sections cannot limit animation coverage. Implementation status and human QA/integration status remain separate.
- Progression proposal status follows accepted decisions and current implementation evidence. Declined tuning trials stay historical; unresolved save-owner defects retain their implementation blockers.
