# Tools manifest

# List deterministic tools (one-sentence description each)

- `tools/health_check.py` — simple environment and connectivity check
- `tools/export_beads_github_visibility.py` — guarded public-safe Beads-to-GitHub visibility export; refuses generated doc writes unless explicitly opted in
- `tools/generate_bead_review_packets.py` — guarded public-safe review packet generator; requires explicit mapping, manifest, output dir, and generated-doc opt-in
- `tools/publish_beads_github_visibility.py` — guarded GitHub CLI publisher for public-safe Beads visibility manifests; requires explicit manifest path
