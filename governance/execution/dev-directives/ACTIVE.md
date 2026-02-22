# ACTIVE Dev Directive

## Current Sprint
Sprint X

## Dispatch Integrity (Mandatory)
- Expected Branch: `codex/task019-poweramp-next-own-turn-expiry`
- Baseline Commit or Tag: `d11a540`
- Drift Action: if branch/baseline check fails, stop immediately and request Lead resync before any code execution.

## Active TASK-###
- TASK-019
  - Plan:
    - `/Users/Mace/Wishfire/Codex-Orka/governance/execution/dev-directives/TASK-019-execution-plan.md`

## Strict File Lock (TASK-019)
- Allowed files:
  - `/Users/Mace/Wishfire/Codex-Orka/web-runner/modules/functionBank.js`
  - `/Users/Mace/Wishfire/Codex-Orka/Scripts/functionBank.js` (parity only if needed)
  - `/Users/Mace/Wishfire/Codex-Orka/test-results/task019/*`
- Forbidden files:
  - `/Users/Mace/Wishfire/Codex-Orka/governance/planning/*`
  - `/Users/Mace/Wishfire/Codex-Orka/governance/audit/*`
  - `/Users/Mace/Wishfire/Codex-Orka/AGENTS.md`
  - any file outside the allowed list
- Rule: any modification outside allowed list = automatic FAIL.

## Dev Next Action
1. Implement TASK-019 authoritative lifecycle exactly:
   - pending-next-own-turn arm state
   - active-this-turn usage state
   - mandatory own-turn-end expiry for attack and non-attack paths
2. Keep patch isolated to power-amp lifecycle only:
   - no initiative text edits
   - no story-card/yellow behavior edits
   - no combat balance tuning
3. Publish full artifact contract and return PASS/FAIL with strict file-lock compliance statement.

## Artifact Contract
- `task019-poweramp-recipient-turn-trace.json`
- `task019-poweramp-next-turn-only-assertions.json`
- `task019-poweramp-partywide-expiry-assertions.json`
- `task019-no-carryover-assertions.json`
- `task019-partywide-skew-trace.json`
- `task019-partywide-leak-stomp-assertions.json`
- `task019-text-print-regression-guard.json`
- `task019-closure-recommendation.json`

## Prior Task Closure
- TASK-020 Lead verdict: PASS (2026-02-22).
