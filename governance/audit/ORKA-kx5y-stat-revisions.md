# ORKA-kx5y permanent-input revisions

Branch: `bead/ORKA-kx5y-stat-revisions`. Remediation starts at `141231b553527575a0e0941a63e3ac493afa5e51`; baseline `fbaab92fa70b06944772d80bac9e88ae84cfb827`. Independent FAIL report: `/tmp/verify-kx5y/report.md`. No push or merge. Work stayed in the assigned worktree; local Beads reads required sandbox escalation.

## Verifier remediation

F1: Phoenix captures its recipient maximum when a channel begins. Actor revival consumes `action_target_max_hp`; both cap healing at the current maximum and emit the actual healed amount. Arcane Pulse and Faze construction use committed Elevate. The additional commitment audit found Shadow landing reading live reach; it now uses committed reach. Boss basic and Mirewing release paths now use the shared committed-stat reader, and WFM action damage/healing uses committed MAG/ATK. Enemy revisions remain unsupported, so those enemy substitutions currently preserve behavior. Incoming mitigation, positions tracked by the existing targeting policy, passive aura/Mend and regeneration ticks remain live by design. No additional supported hero commitment leak was found in the source audit.

F2: native stats and the create/spawn/marker/revision payloads retain independent ATK, DEF, MAG and RES. Physical actions use ATK/DEF; magic actions use MAG/RES. Shadow remains physical with Arcane impact art; Bubble Pop/Pulse/Faze use magic. Djinn and Chimerilass select the channel per physical/magic action. Projectiles retain their launch channel. Supported schema-1.0 requests without the added fields retain their established equal-channel defaults; the production host emits every channel. The former `wfm_magic` actor stat is removed. MATK/RES Training changes payload signatures and accepted Rust stats. Creation now computes the permanent projection once, retaining entry HP's host ratio (review F5).

F3: `attachHeroProgress` routes the entire operation through detached meta while bound. The shared session reset refuses to reset bound actors; developer presets preserve the active Rust encounter and queue revisions. Watched real-host tests cover HP, maxHP, stats and statuses; accepted snapshots own live changes.

F4: the ABI gameplay hash includes host maxima in actor order, command sequence, encounter mode/state, identity reservations and ordinary-clear receipts. Current/captured independent stats, active Phoenix maximum, pending spawn stats and projectile launch channels also enter the appropriate production hash. The frozen harness retains its established host hash stream and equal stat pairs.

## Regression evidence

Tracked adaptations of verifier probes: `tests/combatRevisionVerifier.test.mjs` from `probes.mjs`; `tests/combatRevisionVerifier.before.json` preserves `wasm-host-probe.json`; the Phoenix test in `tests/combatPermanentInputs.test.mjs` derives from `phoenix.mjs`; native Pulse/Faze checks in `permanent.rs` derive from `native/src/bin/elevate.rs`.

Native tests cover actor/Phoenix revival after HP growth and shrink, the current healing cap, exactly one heal, committed Pulse/Faze Elevate and MAG, Shadow reach, independent incoming mitigation, next-action replacement, physical Shadow art and per-action Djinn channels. Real WASM covers Phoenix maxima 420/840/210/100, atomic rejection, coalescing, lost/stale ack rules, reload before ack, equipment/EXP/ticket/Training/developer commits, creation/spawn/marker channels and equal-HP hash divergence. The existing 13-result native/WASM fixture compares every event, snapshot and gameplay hash.

Focused regression run: 65 passed, zero failures. Full verification pending at this checkpoint; subsequent evidence below will replace this status.

## Full validation

PENDING_FINAL_VALIDATION

## Exact inherited unit failure set

The 18 baseline failure names are:

- hero screen reads every accepted kit skill from shared data
- automatic HERO_SINGLE uses the runtime random target in web-runner/modules/functionBank.js
- Tank HERO_SINGLE targeting follows runtime random in web-runner/modules/functionBank.js
- Fighter HERO_SINGLE targeting follows runtime random in web-runner/modules/functionBank.js
- Controller HERO_SINGLE targeting follows runtime random in web-runner/modules/functionBank.js
- Support HERO_SINGLE targeting follows runtime random in web-runner/modules/functionBank.js
- random targeting excludes dead enemies in web-runner/modules/functionBank.js
- automatic HERO_SINGLE uses the runtime random target in Scripts/functionBank.js
- Tank HERO_SINGLE targeting follows runtime random in Scripts/functionBank.js
- Fighter HERO_SINGLE targeting follows runtime random in Scripts/functionBank.js
- Controller HERO_SINGLE targeting follows runtime random in Scripts/functionBank.js
- Support HERO_SINGLE targeting follows runtime random in Scripts/functionBank.js
- random targeting excludes dead enemies in Scripts/functionBank.js
- leader-target bias spans own-nearest to the legacy shared target
- heroes split across nearby enemies by default and dog-pile under the legacy toggle
- heroes may stack on one target while hero-enemy spacing stays whole
- boss encounters keep full hero spacing along the front edge
- boss defeat is free, retains the full ready milestone, and resumes farming until summoned


## Limits and retained evidence

The first commit attempt stopped at the broad UI lock’s inherited nearest-target invariant. Its unchanged assertions and report are retained in `test-results/ui-lock/2026-11-01T20-42-21-767Z/`. The final reset guard lives in the shared combat session owner; developer UI source is unchanged. No visual review or release acceptance is claimed. Native and WASM evidence covers the named fixtures rather than every possible state. Full-suite logs and browser time boxes must be reported explicitly. Temporary Cargo caches and logs use `/tmp/kx5y-*` and `/tmp/ORKA-kx5y-*`; offline outputs and ignored test artifacts remain in this worktree for review. Integration Ready against newer main is outside this commit-only delivery.
