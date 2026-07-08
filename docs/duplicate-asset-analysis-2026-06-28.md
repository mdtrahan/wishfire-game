# Duplicate Asset Analysis And Cleanup Report

## Existing Project Capabilities
- Package scripts and `tools/` did not contain a duplicate-file or duplicate-image content-hash utility.
- Cached Fallow 2.87.0 is available and useful for duplicate code, dead/unused code, dependency hygiene, complexity, and architecture scans.
- Fallow does not provide this requested asset/file cleanup workflow: byte-identical arbitrary file groups, image content hashes, duplicate filenames, review-first report, and safe disk-space reclaim.
- Existing `docs/asset-usage-audit.md` is historical and stale for the current asset tree. It references older file counts and files no longer present.

## Reuse Decision
- Reuse Fallow for duplicate code and unused/dead-code policy work.
- Add `tools/analyze_duplicate_assets.js` for asset/file duplicate reporting because no existing project command covered byte-identical file/image analysis safely.
- Keep the new tool report-only. It has no delete mode.

## Cleanup Review
- Removed: `web-runner/assets/images/generated/falie_ward_84x62.png`.
- Authoritative copy retained: `web-runner/assets/images/falie_ward_84x62.png`.
- Rationale: the retained copy is the runtime/test-referenced path. The generated copy had no exact active path references, was byte-identical, and was introduced as checkpoint material before the canonical runtime asset was wired.
- Payload bytes recovered: 7,518 B.
- Approximate allocated disk space recovered: 8.0 KiB.
- References updated: none needed.

## Intentionally Retained Duplicates
- `bufficon1..4-animation 1-000.png` through `bufficon1..4-animation 1-004.png` are byte-identical by frame.
- These are retained because `web-runner/systems/runtimeVisualAssetLoader.js` dynamically loads all four buff-icon slots across frames `000..004`.
- Removing any slot-specific file would break current dynamic path construction unless a separate runtime/manifest change canonicalized those assets first.

## Post-Cleanup State
- Files scanned: 101.
- Image files scanned: 95.
- Content duplicate groups remaining: 5.
- Image duplicate groups remaining: 5.
- Duplicate filename groups remaining: 0.
- Remaining reclaimable bytes if the bufficon groups were canonicalized later: 6,093 B.
- Raw before-cleanup JSON: `test-results/ORKA-n9v2/duplicate-assets-before-cleanup.json`.
- Raw after-cleanup JSON: `test-results/ORKA-n9v2/duplicate-assets-after-cleanup.json`.

## Generated Before-Cleanup Report

Generated: 2026-06-28T21:17:18.707Z
Target: `web-runner/assets`

## Safety
- Report-only tool. It has no delete mode.
- Duplicate content means exact byte size plus exact SHA-256 match.
- Duplicate filenames are reported separately from duplicate content.
- Exact path reference hits are review hints only. Dynamic runtime references still require human review.

## Summary
- filesScanned: 102
- imageFilesScanned: 96
- uniqueContentHashes: 86
- contentDuplicateGroups: 6
- imageDuplicateGroups: 6
- duplicateFilenameGroups: 1
- totalFilesInContentDuplicateGroups: 22
- reclaimableBytesIfOneKeptPerContentGroup: 13611 (13.3 KiB)

## Extension Counts
- `.json`: 3
- `.md`: 1
- `.png`: 96
- `.ttf`: 1
- `.wasm`: 1

## Content Duplicate Groups
### Group 1
- bytes: 7518 (7.3 KiB)
- sha256: `6aff8532956fc9387790d822009168afd15c4adabcfad364b70162b026f158f9`
- reclaimable if one kept: 7518 (7.3 KiB)
- files:
- `web-runner/assets/images/falie_ward_84x62.png`
- `web-runner/assets/images/generated/falie_ward_84x62.png`
- exact path reference hints:
  - `web-runner/assets/images/falie_ward_84x62.png`: `Scripts/functionBank.js:5815` const CRIMSON_WARD_BARRIER_ASSET_PATH = 'images/falie_ward_84x62.png';
  - `web-runner/assets/images/falie_ward_84x62.png`: `tests/falieRedSuperGemBufferShieldContract.test.js:253` assert.equal(ctx.state.globals.PartyWardBarrierAssetPath, 'images/falie_ward_84x62.png');
  - `web-runner/assets/images/falie_ward_84x62.png`: `web-runner/modules/functionBank.js:5824` const CRIMSON_WARD_BARRIER_ASSET_PATH = 'images/falie_ward_84x62.png';
  - `web-runner/assets/images/falie_ward_84x62.png`: `web-runner/systems/runtimeVisualAssetLoader.js:111` wardBarrierImage = await loadImage(assetUrl('images/falie_ward_84x62.png'));
  - `web-runner/assets/images/generated/falie_ward_84x62.png`: none

### Group 2
- bytes: 466 (466 B)
- sha256: `40713ca6e89a9bfeb9f31c7c090545817cafd3a070ec0d464448c778f71e744b`
- reclaimable if one kept: 1398 (1.4 KiB)
- files:
- `web-runner/assets/images/bufficon1-animation 1-002.png`
- `web-runner/assets/images/bufficon2-animation 1-002.png`
- `web-runner/assets/images/bufficon3-animation 1-002.png`
- `web-runner/assets/images/bufficon4-animation 1-002.png`
- exact path reference hints:
  - `web-runner/assets/images/bufficon1-animation 1-002.png`: none
  - `web-runner/assets/images/bufficon2-animation 1-002.png`: none
  - `web-runner/assets/images/bufficon3-animation 1-002.png`: none
  - `web-runner/assets/images/bufficon4-animation 1-002.png`: none

### Group 3
- bytes: 439 (439 B)
- sha256: `0ca30ae181d9ce23933a8ec47f0e3fdd88d2222970c3c65a22e100c3234bb33e`
- reclaimable if one kept: 1317 (1.3 KiB)
- files:
- `web-runner/assets/images/bufficon1-animation 1-003.png`
- `web-runner/assets/images/bufficon2-animation 1-003.png`
- `web-runner/assets/images/bufficon3-animation 1-003.png`
- `web-runner/assets/images/bufficon4-animation 1-003.png`
- exact path reference hints:
  - `web-runner/assets/images/bufficon1-animation 1-003.png`: none
  - `web-runner/assets/images/bufficon2-animation 1-003.png`: none
  - `web-runner/assets/images/bufficon3-animation 1-003.png`: none
  - `web-runner/assets/images/bufficon4-animation 1-003.png`: none

### Group 4
- bytes: 435 (435 B)
- sha256: `3d5b72d789ea0914bee1cc58d4e6a397e530319f16d69353f3da5d01ba6949c3`
- reclaimable if one kept: 1305 (1.3 KiB)
- files:
- `web-runner/assets/images/bufficon1-animation 1-004.png`
- `web-runner/assets/images/bufficon2-animation 1-004.png`
- `web-runner/assets/images/bufficon3-animation 1-004.png`
- `web-runner/assets/images/bufficon4-animation 1-004.png`
- exact path reference hints:
  - `web-runner/assets/images/bufficon1-animation 1-004.png`: none
  - `web-runner/assets/images/bufficon2-animation 1-004.png`: none
  - `web-runner/assets/images/bufficon3-animation 1-004.png`: none
  - `web-runner/assets/images/bufficon4-animation 1-004.png`: none

### Group 5
- bytes: 391 (391 B)
- sha256: `355697d27bf94780b350691baaf4b85049985beac5dadc4aa6e8517a2de0d17f`
- reclaimable if one kept: 1173 (1.1 KiB)
- files:
- `web-runner/assets/images/bufficon1-animation 1-001.png`
- `web-runner/assets/images/bufficon2-animation 1-001.png`
- `web-runner/assets/images/bufficon3-animation 1-001.png`
- `web-runner/assets/images/bufficon4-animation 1-001.png`
- exact path reference hints:
  - `web-runner/assets/images/bufficon1-animation 1-001.png`: none
  - `web-runner/assets/images/bufficon2-animation 1-001.png`: none
  - `web-runner/assets/images/bufficon3-animation 1-001.png`: none
  - `web-runner/assets/images/bufficon4-animation 1-001.png`: none

### Group 6
- bytes: 300 (300 B)
- sha256: `e8eb9e589aa63ef6d25c34c36dccb6753a546083ebb7e6df47597597dabda434`
- reclaimable if one kept: 900 (900 B)
- files:
- `web-runner/assets/images/bufficon1-animation 1-000.png`
- `web-runner/assets/images/bufficon2-animation 1-000.png`
- `web-runner/assets/images/bufficon3-animation 1-000.png`
- `web-runner/assets/images/bufficon4-animation 1-000.png`
- exact path reference hints:
  - `web-runner/assets/images/bufficon1-animation 1-000.png`: `web-runner/systems/runtimeVisualAssetLoader.js:124` 'images/bufficon1-animation 1-000.png',
  - `web-runner/assets/images/bufficon2-animation 1-000.png`: `web-runner/systems/runtimeVisualAssetLoader.js:125` 'images/bufficon2-animation 1-000.png',
  - `web-runner/assets/images/bufficon3-animation 1-000.png`: `web-runner/systems/runtimeVisualAssetLoader.js:126` 'images/bufficon3-animation 1-000.png',
  - `web-runner/assets/images/bufficon4-animation 1-000.png`: none

## Image Duplicate Groups
- Group 1: `web-runner/assets/images/falie_ward_84x62.png`, `web-runner/assets/images/generated/falie_ward_84x62.png`
- Group 2: `web-runner/assets/images/bufficon1-animation 1-002.png`, `web-runner/assets/images/bufficon2-animation 1-002.png`, `web-runner/assets/images/bufficon3-animation 1-002.png`, `web-runner/assets/images/bufficon4-animation 1-002.png`
- Group 3: `web-runner/assets/images/bufficon1-animation 1-003.png`, `web-runner/assets/images/bufficon2-animation 1-003.png`, `web-runner/assets/images/bufficon3-animation 1-003.png`, `web-runner/assets/images/bufficon4-animation 1-003.png`
- Group 4: `web-runner/assets/images/bufficon1-animation 1-004.png`, `web-runner/assets/images/bufficon2-animation 1-004.png`, `web-runner/assets/images/bufficon3-animation 1-004.png`, `web-runner/assets/images/bufficon4-animation 1-004.png`
- Group 5: `web-runner/assets/images/bufficon1-animation 1-001.png`, `web-runner/assets/images/bufficon2-animation 1-001.png`, `web-runner/assets/images/bufficon3-animation 1-001.png`, `web-runner/assets/images/bufficon4-animation 1-001.png`
- Group 6: `web-runner/assets/images/bufficon1-animation 1-000.png`, `web-runner/assets/images/bufficon2-animation 1-000.png`, `web-runner/assets/images/bufficon3-animation 1-000.png`, `web-runner/assets/images/bufficon4-animation 1-000.png`

## Duplicate Filename Groups
- `falie_ward_84x62.png`: `web-runner/assets/images/falie_ward_84x62.png`, `web-runner/assets/images/generated/falie_ward_84x62.png`
