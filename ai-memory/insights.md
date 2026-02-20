# Insights / Decisions Log

## 2026-02-19
- Applied hardening clause for browser backend integrity.
- Added required policy file:
  - `/Users/Mace/Wishfire/Codex-Orka/docs/backend/browser-backend-policy.md`
- Updated `AGENTS.md` with Lead/Dev constraints against legacy browser-driver usage and explicit `agent-browser --help` prerequisite.
- Mandatory regression scan executed for banned legacy browser-driver tokens with zero matches.
- Validation gate check: `agent-browser --help` exit code `0`.
- Next: Await next explicit user request.
