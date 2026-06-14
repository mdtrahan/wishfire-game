# DOX Research

Research source: cloned `https://github.com/agent0ai/dox` to `/private/tmp/dox-reference-ORKA-6fle`.

Reference revision inspected: `5cb5ba5 Update AGENTS.md link to include plain parameter`.

## Available Reference Material
- `README.md`
- `AGENTS.md`
- `LICENSE`

No examples directory, templates beyond root `AGENTS.md`, CLI, package, or runtime code were present in the cloned reference.

## Verified DOX Guidance
- DOX is an AGENTS.md hierarchy, not an installed package.
- Root `AGENTS.md` contains project-wide instructions and the top-level child index.
- Child `AGENTS.md` files contain local instructions for specific durable areas.
- Before editing, an agent should walk from the repo root to every target path and read all applicable AGENTS.md files.
- The nearest AGENTS.md is the local contract; parent docs still provide repo-wide rules.
- If docs conflict, the closer doc controls local details, but a child doc cannot weaken DOX.
- After meaningful changes, the agent should update the closest owning AGENTS.md and affected parent/child indexes.
- Create child docs when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards.
- Default child section order is:
  - Purpose
  - Ownership
  - Local Contracts
  - Work Guidance
  - Verification
  - Child DOX Index
- DOX docs should stay concise, current, and operational.
- DOX should document stable contracts, not diary entries.
- Broad rules belong in parent docs; concrete local details belong in child docs.
- Stale or contradictory text should be removed rather than explained historically.
- Verification guidance should reflect existing checks. If no check exists, leave it empty until one exists.

## Implementation Recommendations
- Preserve Codex-Orka's existing Beads, worktree, retrieval, validation, and `web-runner/app.js` constraints in the root AGENTS.md.
- Add child AGENTS.md files only where repository analysis shows a durable ownership boundary.
- Keep parent files focused on routing and inherited constraints; place subsystem rules in the nearest child.
- Document architectural intent and failure modes, especially:
  - JS browser shell vs Rust deterministic SimulationCore ownership
  - `Scripts/` and `web-runner/modules/` function-bank parity
  - strict hero/enemy team-phase turn sequencing
  - skill-draw class rules and Astral Flow/SkillDraught gating
  - supergem vs skill-card separation
  - save/load wrapper ownership outside SimulationCore
  - render/input/presentation boundaries
- Include a Child DOX Index in each parent that has direct child AGENTS.md files.
- Leave scaffold/archive folders root-owned until they become real architectural boundaries.

## Ambiguities And Assumptions
- DOX does not define a machine-readable schema, lint command, or validation tool. Assumption: markdown consistency plus focused repo validation is sufficient.
- DOX says an existing project can ask an agent to initialize the tree and "go deep," but it does not define how deep. This implementation follows the user's constraint: create child docs only at meaningful architectural boundaries.
- The reference does not specify whether root project rules should be replaced or merged. Assumption: merge DOX with existing repo workflow rules so local safety contracts are preserved.
- The reference does not provide examples for game repositories, Rust/JS hybrid repos, Beads workflows, or browser-game runtime boundaries. Placement is therefore justified from Codex-Orka evidence, not DOX examples.

## Placement Justification
- `Scripts/` is a durable runtime mirror with explicit parity tests against `web-runner/modules/functionBank.js`.
- `web-runner/` owns the browser runtime, local assets, shipped core copies, rendering/input systems, and the high-risk `app.js` orchestration surface.
- `web-runner/modules/` owns Construct-style gameplay state and combat/skill function surfaces.
- `web-runner/systems/` owns rendering, input, supergem runtime, local persistence wrappers, dev tooling, and SimulationCore shadow wiring.
- `web-runner/src/core/` owns browser-shipped deterministic rule modules and presentation-adjacent helpers used by the runtime.
- `web-runner/assets/` owns runtime data, media, generated layout data, and the shipped WASM artifact.
- `src/` owns shared deterministic JS contracts and layout controller code.
- `src/core/` owns reusable rule modules, packet shapes, layout state, and CJS exports used by tests.
- `src/layout/` owns layout descriptors and transition registrations.
- `rust/` owns the Rust SimulationCore deterministic boundary and WASM export source.
- `tests/` owns contract/regression proof surfaces; `tests/fixtures/` owns golden fixture data shared by JS and Rust checks.
- `tools/` owns QA automation, local server behavior, Rust build helper, and repo process tooling.
- `governance/` owns product, planning, audit, and Beads review docs; `governance/product/` and `governance/planning/` are separate because player/gameplay truth and architecture/process contracts drift differently.
