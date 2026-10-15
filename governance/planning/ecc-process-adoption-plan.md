# ECC process adoption plan

Status: active under Beads epic `ORKA-ddf`. This document does not authorize gameplay or merge changes.

## Target

Use ECC as the default engineering process for Codex-Orka. Apply its planning, test-first implementation, Git review, and verification methods through the repository's actual Node, Rust/WASM, browser, and Beads surfaces. Keep product and architecture contracts, task scope, worktree isolation, and merge safety intact.

## Skill routing

| Trigger | ECC skill | Project-specific execution |
| --- | --- | --- |
| Feature, bug fix, or refactor | `tdd-workflow` | Start from bead acceptance criteria. Record failing and passing checks before implementation and after the fix. |
| Branch, commit, PR, conflict, or release work | `git-workflow` | Use its GitHub Flow path with one bead-scoped branch/worktree and the existing Integration Ready gate. |
| Significant code change or PR readiness | `verification-loop` | Run its phases with commands that exist in this checkout; record unavailable gates as unavailable. |
| New Playwright coverage | `e2e-testing` | Reuse the installed Playwright package and the project's browser QA surface. |
| Rust SimulationCore work | `rust-testing` and `rust-patterns` | Cover the Rust implementation and its WASM/JavaScript boundary. |
| User input, save import, network endpoint, or credentials | `security-review` | Apply relevant checks to the touched trust boundary. |

Use other ECC skills when the task calls for them. Record the reason in the task; do not load the full catalog into every run. ECC's Claude-specific `/orchestrate` commands are not part of the Codex path.

## Process reconciliation

| Seam | ECC process | Codex-Orka mechanism | Resolution |
| --- | --- | --- | --- |
| Work selection | Plan from user outcomes and testable journeys. | Live Beads owns assignment, scope, and status. | Put each ECC journey and acceptance check in the selected bead. One implementation bead stays active per lane. |
| Test-first checkpoints | Commit RED evidence, then GREEN implementation; preserve both. | Commits require `bd-<id>`; hot-file commits need prepared scope metadata. | Make RED and GREEN commits on the same bead branch with the bead ID. Run hot-file preparation for each affected staged commit. Carry RED/GREEN evidence into the PR if history is squashed. |
| Branching | ECC recommends GitHub Flow for this shape of work. | Bead-scoped worktree, QA PASS, Integration Ready, rollback checkpoint. | Branch from current `main`; retain the repo's readiness and rollback checks before merge. Avoid ECC's alternate trunk and GitFlow examples for this repo. |
| Coverage | ECC TDD requires at least 80% coverage. | `node --test` and focused Rust checks exist; a coverage gate is not yet declared in `package.json`. | Establish measured coverage for affected code and an explicit 80% gate before claiming ECC TDD completion. Add only the runner support needed to measure it, under its own scoped bead if necessary. Until then report the gate as unmet, not passed or waived. |
| Verification commands | Build, type, lint, tests, security, and diff review. | This checkout has no generic `build`, `lint`, `typecheck`, or `test:coverage` scripts. | Map each phase to real commands for the touched seam. For Rust/WASM use the Rust and WASM build/boundary checks; for JS use Node tests; for visual work inspect the final browser state. Record absent phases and decide whether to add a durable gate in a scoped bead. |
| Review and merge | ECC diff review and PR review. | QA PASS proves feature quality; Integration Ready proves merge safety against current `main`. | Review the full bead diff from its merge base through `HEAD`, including RED, GREEN, and refactor commits. Then run the current-main integration check. ECC's example `git diff HEAD~1` is too narrow for this commit sequence. Preserve both evidence sets. |

## Hook and tool wiring

The installed native ECC plugin exposes 292 `SKILL.md` files, one Chrome DevTools MCP, and one `SessionStart` hook. The hook creates ECC session directories, prunes old ECC session files, writes a session lease, detects the package manager, and can inject prior context. Its trust has not been granted. Codex's plugin-scoped config keeps the bundled Chrome DevTools MCP disabled while the ECC plugin remains enabled.

1. Inspect the hook's exact write and prune directories and behavior in a detached temporary home. Test two worktrees sharing a Git directory. The pinned hook deliberately falls back to another worktree's prior summary when repo identity matches; treat that as a known context-isolation conflict, not an untested risk.
2. Keep the pinned hook untrusted while that conflict remains. Resolve it through a supported exact-worktree-only mode or by disabling ECC session-summary injection with `ECC_SESSION_START_CONTEXT=off`, then repeat the isolated check before trusting the hook. ECC skills and process do not depend on hook trust. Record the chosen setting and its global effect before applying it.
3. On a real browser-debugging task, compare the in-app Browser and existing Playwright route first. Enable ECC's Chrome DevTools MCP only if it adds a needed capability, then document the result and disable it again if it has no continuing role.

## Rollout and acceptance

1. Create a bead for the process change and record this plan's decisions there. Preserve existing dirty work; change only owned files in a clean lane. Use a representative completed bead's existing evidence as the native baseline for quality, time, tool calls, and review effort. Link the comparison to the global [ECC evaluation](/Users/Mace/.codex/ecc-evaluation.md).
2. Trial one small JavaScript or Rust bead end to end: ECC plan, RED commit, GREEN commit, coverage measurement, ECC verification report, full-branch review, QA PASS, and Integration Ready. Capture actual commands, timing, and maintenance cost.
3. Trial one browser-facing bead to test ECC E2E guidance and the browser tool route. Capture the final rendered state and compare tool overhead with the baseline.
4. Once the trials establish workable mappings, add a short ECC-first routing rule to the execution policy. Update only the validation, integration, and Beads passages whose current wording blocks ECC's TDD checkpoints or gates. Keep the policy diff reviewable.
5. Accept the process cutover when both trials meet their bead criteria, ECC's applicable gates, and current-main merge safety. If a mapping fails, preserve ECC as the target process, roll back the affected local policy change, and open a scoped follow-up for the missing gate or integration. Record an owner and next action for every unresolved blocker.

The rollout must keep global configuration changes reversible and verify plugin state after each change.
