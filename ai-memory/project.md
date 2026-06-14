# PROJECT INDEX — Codex-Orka

Purpose:
Provide a compact retrieval map of canonical runtime behavior.
Always consult this file before broad repo search.

Companion reference:
- `governance/product/game-function-reference.md` = product-language explanation of what the game currently does, for FAQ/tutorial/spec drafting.

---

## Canonical Runtime

Authoritative gameplay behavior lives in:

- Scripts/
- web-runner/

Anything outside these folders is non-canonical unless explicitly stated.

---

## Core Behavior Domains

### Combat / Turn System
Primary logic lives in:
- Scripts/ (search for: turn, speed, initiative, combat, resolve)
- web-runner/ (runtime integration layer)

Rules reference:
- SPD-sorted turn order
- Speed spike rule
- Shared HP pool
- Purple gem = combat Energy restoration

---

### Gem / Action Flow
Search in:
- Scripts/ (search for: gem, selection, target, refill)

States:
- gem selection
- target selection
- nav menu
- refill

---

### UI / Modal Layering
Search in:
- Scripts/ (search for: nav, overlay, dark field, modal)

Rules:
- Nav above dark field
- Dark field blocks gameplay only
- Gemboard must not shift

---

### Deployment Runtime
- web-runner/ contains build entry
- Netlify deploy tracks main branch

---

## Memory System

Operational files:
- ai-memory/context.md
- ai-memory/todo.md
- ai-memory/insights.md

---

## External Reference Router

Use this when a repo question needs outside examples, APIs, learning material, or tool candidates.

Rules:
- Local repo docs, Beads, and runtime code stay authoritative.
- Treat these names as search targets, not installed dependencies.
- Verify exact upstream identity, license, maintenance, auth, rate limits, and safety before adoption.

| Need | Start With | Use Mode |
| --- | --- | --- |
| Free/public API candidates | public-apis | Find candidate APIs; verify auth, rate limits, and license before use. |
| Learn or build unfamiliar tech | build-your-own-x; project-based-learning; developer-roadmap; freeCodeCamp; free-programming-books; coding-interview-university | Study/reference. Use to understand patterns before writing repo-specific plans. |
| Systems, CS, and interview-style explanations | system-design-primer; tech-interview-handbook; javascript-algorithms | Study/reference. Useful for architecture vocabulary and algorithm comparisons. |
| JavaScript depth and snippets | you-dont-know-js; 30-seconds-of-code | Study/adapt. Follow local repo style before copying patterns. |
| Terminal, security, OSINT, and broad hacker resources | the-art-of-command-line; the-book-of-secret-knowledge; maigret | Study/tool candidates. Verify legality, privacy, and safety before running anything. |
| Self-hosted app candidates | awesome-selfhosted; open-webui; stable-diffusion-webui | Candidate systems. Verify maintenance and security posture before install. |
| Dev templates | gitignore | Use as reference when introducing a new stack or generated artifact class. |
| Local models and AI foundations | ollama; huggingface-transformers | Candidate runtimes/libraries for local model or ML experiments. |
| AI app builders, workflows, and memory | langchain; n8n; dify; langflow; mem0 | Candidate tools for agent/app prototypes, automation, and memory layers. |
| Browser automation and file conversion | browser-use; browserbase-skills; markitdown | Candidate capabilities. Verify integration shape and sandbox/security impact. |
| Multi-agent frameworks and orchestration | crewai; autogen; metagpt; cocoindex; hermes-agent; ruflo; openclaw; lobe-hub | Compare concepts first. Verify exact project identity before adopting. |
| AI coding and agency experiments | aider; agency-agents; tradingagents | Study/tool candidates. Isolate before use and do not treat outputs as repo authority. |

---

## Archive (Read-only)

- project_C3_conversion/

Never infer runtime behavior from C3 JSON.

---

## Retrieval Rule

Before editing:
1) Identify domain from this file.
2) Read relevant Scripts/ or web-runner/ files.

## Retrieval Map (Read before grepping)
Before searching the repo broadly, search `ai-memory/PROJECT.md`.
If information is missing, record an "Index gap" note in `ai-memory/insights.md`.
