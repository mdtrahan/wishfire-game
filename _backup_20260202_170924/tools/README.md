C3 JSON → JS converter

Usage:

node tools/convert_c3.js --input project_C3_conversion --output src/data --format simple

Options:
- --input <dir>   : folder containing Construct 3 project JSON files (default: project_C3_conversion)
- --output <dir>  : output folder for generated JS modules (default: src/data)
- --format <name> : output format: simple | factory | class (default: simple)

Notes:
- Files >5MB are skipped by default to avoid embedding large assets.
- Top-level keys `access_token` and `client_secret` are removed when found.
- This is a minimal first-pass converter; extend it to extract base64 assets and emit runtime adapters.
