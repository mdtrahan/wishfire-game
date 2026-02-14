<!-- Runtime source of truth is Scripts/ + web-runner/. -->
# Codex-Orka (workspace bootstrap)

This repository contains process docs (ATLAS/GOTCHA). The workspace has been initialized with a minimal GOTCHA layout and a sample deterministic tool.

How to run the sample health check (quick):

```bash
python3 /Volumes/Newton/Projects/Codex-Orka/tools/health_check.py
```

To customize environment variables copy `.env.example` to `.env` and edit.

Next steps you can ask me to scaffold:
- Minimal Node/React app
- Minimal Python FastAPI app
- Supabase/Postgres schema + connection check
