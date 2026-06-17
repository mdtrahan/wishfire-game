# app.js Thinning Playbook

Last updated: 2026-06-15

## Purpose

Keep `web-runner/app.js` as a thin orchestration surface instead of a feature warehouse. This playbook turns JavaScript debloat research into repo-specific rules for reducing browser-shipped complexity through ownership boundaries, not syntax tricks.

This document does not authorize runtime edits. Any code change still requires the active Beads scope, the nearest AGENTS.md chain, hot-file scope compliance, and focused validation.

## Core Rule

`app.js` may coordinate runtime lifecycle, imports, initialization, and high-level event wiring. It must not own gameplay rules, durable state, rendering algorithms, persistence behavior, dependency-heavy feature logic, or reusable utilities.

When a change would expand `app.js`, first ask: which existing owner should receive this behavior?

## Ownership Targets

| Behavior | Owner | Forbidden owner |
|---|---|---|
| Runtime lifecycle wiring, top-level composition, startup sequence | `web-runner/app.js` | Feature modules with hidden startup side effects |
| Gameplay state and Construct-style gameplay functions | `web-runner/modules/` | `app.js`, render modules |
| Rendering, input, overlays, local persistence wrappers, dev tooling, SimulationCore shadow wiring | `web-runner/systems/` | `app.js` |
| Small UI/layout state holders for presentation surfaces | `web-runner/state/` | broad global state additions in `app.js` |
| Browser-shipped deterministic rules and runtime helpers | `web-runner/src/core/` | render modules, `app.js` |
| Shared deterministic contracts and reusable JS rules | `src/core/` | duplicated browser-only helpers |
| Rust-owned deterministic simulation rule families | `rust/simulation_core/` plus WASM boundary | JavaScript recomputation |
| Product truth and architecture contracts | `governance/` | code comments as the only source of intent |

## Debloat Principles

1. Prefer moving responsibility out of `app.js` over deleting lines.
2. Split by capability or runtime surface, not by arbitrary file size.
3. Keep module boundaries statically understandable so bundlers can prune unused code.
4. Keep dependency-heavy behavior out of the startup path unless the first screen needs it.
5. Make route, surface, owner, and validation boundaries visible in the file tree.
6. Avoid broad barrels, mega-utils, and hidden top-level side effects.
7. Treat every new dependency as a browser cost until proven otherwise.

## Structural Techniques

### Server-first and client-minimal thinking

Wishfire is a browser game, so it cannot simply server-render its primary runtime. The applicable lesson is narrower: do not make the browser runtime initialize features that are not needed for the current surface. Server-first research still supports the local rule: ship and execute less JavaScript at startup whenever a feature can be deferred.

Evidence:
- web.dev notes that shipping less startup JavaScript reduces parse, compile, execution, and main-thread work: https://web.dev/articles/reduce-javascript-payloads-with-code-splitting
- Next.js documents that server components reduce client JavaScript when browser-only capabilities are not needed: https://nextjs.org/docs/app/getting-started/server-and-client-components

Repo application:
- Keep startup wiring in `app.js` minimal.
- Push feature-specific setup behind explicit modules.
- Do not initialize hidden gameplay/progression/dev panels from top-level imports unless startup needs them.

### Surface and feature code splitting

Use route/surface/capability boundaries as loading boundaries where the current runtime allows it. Even before true dynamic loading, architectural splitting makes later lazy loading possible.

Evidence:
- MDN defines code splitting as independently loadable bundles so an app loads only code needed at a given time: https://developer.mozilla.org/en-US/docs/Glossary/Code_splitting
- React `lazy` defers component code until first render using dynamic import: https://react.dev/reference/react/lazy

Repo application:
- Extract optional surfaces such as dev tooling, gallery-like shells, overlays, and future non-combat panels into owned modules.
- Prefer an explicit `initX()` or `renderX()` owner module over adding conditional blocks to `app.js`.
- Keep `app.js` as the caller, not the implementation.

### Tree-shakeable module design

Tree shaking only helps when the module graph is understandable. ES module imports, narrow exports, and side-effect-light modules make unused code removable.

Evidence:
- web.dev explains that JavaScript remains costly after compression because the browser must parse, compile, and execute it: https://web.dev/articles/reduce-javascript-payloads-with-tree-shaking
- web.dev shows CommonJS and dynamic exports make bundles harder to optimize than ES modules: https://web.dev/articles/commonjs-larger-bundles
- webpack documents side-effect metadata and ES module tree shaking: https://webpack.js.org/guides/tree-shaking/

Repo application:
- Avoid adding broad import hubs around `app.js`.
- Avoid namespace utility objects and feature barrels that import whole subsystems.
- Keep modules focused enough that unused exports can disappear.

### Dependency governance

Dependencies are architecture decisions. A dependency imported by `app.js` is likely startup JavaScript unless isolated.

Evidence:
- web.dev recommends removing unused libraries, importing only what is needed, and considering library removal when selective import is not possible: https://web.dev/articles/remove-unused-code
- web.dev warns that third-party JavaScript affects performance, privacy, security, network overhead, rendering, and page behavior: https://web.dev/articles/third-party-javascript

Repo application:
- Do not add new package dependencies from `app.js`.
- If a dependency is necessary, place it behind the owning feature module and document why native/platform/internal code is insufficient.
- Ban duplicate dependency categories unless the bead is explicitly a migration.

### Cache and churn boundaries

Stable code should not be invalidated by volatile feature work. Even without a full bundling pipeline, owner boundaries reduce all-or-nothing runtime churn.

Evidence:
- web.dev recommends fingerprinted immutable assets for long-lived caching and explains that users should receive the smallest changed artifact on repeat visits: https://web.dev/articles/love-your-cache

Repo application:
- Keep feature churn out of central startup wiring.
- Avoid editing `app.js` for changes that can be made in owned modules.
- Treat frequent `app.js` edits as a signal that ownership boundaries are missing.

## app.js Expansion Review

Before adding code to `app.js`, classify the change:

| Question | If yes |
|---|---|
| Is it gameplay logic or game state mutation? | Move to `web-runner/modules/` or shared `src/core/`. |
| Is it rendering, input, overlay, persistence, dev tooling, or browser presentation timing? | Move to `web-runner/systems/`. |
| Is it small UI/layout state? | Move to `web-runner/state/`. |
| Is it a deterministic rule or packet contract? | Move to `src/core/`, `web-runner/src/core/`, or Rust-owned SimulationCore docs/tests. |
| Is it dependency-heavy or optional? | Place behind an owned module and consider lazy/surface-scoped loading. |
| Is it only lifecycle wiring? | It may stay in `app.js`, but keep the diff minimal. |

## Safe Extraction Pattern

Use this pattern for each debloat bead:

1. Read the applicable AGENTS.md chain.
2. Confirm active Beads scope and hot-file compliance before touching runtime code.
3. Map the target `app.js` block to an owner.
4. Add or update a focused owner module.
5. Move implementation without changing behavior.
6. Leave the smallest possible call/import in `app.js`.
7. Run focused tests or manual QA appropriate to the moved behavior.
8. Update the decomposition map if one exists.

## First Safe Targets

Prefer early slices with low gameplay risk:

- dev tooling wiring
- app shell viewport helpers
- non-combat presentation setup
- optional gallery/progression shell rendering
- overlay lifecycle routing
- narrow render orchestration helpers

Avoid as first slices:

- combat turn flow
- skill execution
- save/load compatibility
- SimulationCore shadow behavior
- `functionBank.js` parity paths
- dependency upgrades or package changes

## Failure Modes

- Moving lines without moving ownership.
- Creating a new `utils` or `core` dump that becomes another monolith.
- Adding an index barrel that imports entire feature trees.
- Running broad server/browser automation for docs-only changes.
- Treating this playbook as permission to bypass Beads or hot-file scope.
- Deleting imports because they look unused without proof from tests or runtime search.

## Definition Of Done For An Extraction

- `app.js` loses a concrete responsibility.
- The new owner has one clear purpose.
- No new startup dependency is introduced without documented justification.
- Existing behavior is unchanged.
- Focused validation passes.
- The diff is small enough to review in one sitting.
