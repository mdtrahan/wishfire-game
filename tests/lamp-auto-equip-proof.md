# Lamp arrow and Auto gameplay proof · ORKA-der

Baseline: `main` at `5d7910f9bf0d567a082b6852b23d0cd83eb3784d`.

Run the repeatable player-path suite with `npm run test:lamp-ui`. It starts its own server and uses fresh headless browser contexts. Run the focused preservation checks with:

```sh
node --test tests/lampRoster.test.mjs tests/lampCPInvariant.test.mjs tests/lampConveyor.test.mjs tests/lampEquipment.test.mjs
```

Fixtures write synthetic gear and heroes before the game boots, once per context. Reload never reseeds the result. These tests do not use a player's browser profile or save. `LAMP_QA_URL` selects an existing server; `LAMP_TRUST_OUTPUT` selects the gameplay evidence directory.

## Reproduced failures on baseline

Both tests use controls present on baseline and candidate.

- `Auto-Equip never equips a hero advertised red by the arrows beside it`: open cache, capture visible arrows, click Auto, capture receipts. Baseline fails **Huun was advertised red but Auto equipped gear**.
- `a Kaja-only +15 upgrade survives the real dismantle flow with an early combat copy`: a geared copy precedes the four canonical owners. Open the cache and use the offered Dismantle action. Baseline fails **Dismantle destroyed a cached item worth +15 CP to Kaja**. A naked copy benefits from many items itself, so the destructive fixture deliberately retains an existing copy loadout.

## Candidate player-path matrix

The full game loads through `web-runner/index.html`; browser clicks drive its normal input handlers and storage owner.

| Case | Required evidence |
| --- | --- |
| Mixed two-item cache | Overview marks both eligible recipients green. Explicit hat review marks only its beneficiaries green and offers Equip / Back to cache. Overview Auto equips each different item to its correct owner. |
| Golden hat | Fixed gains Fara +13.6, Hondo +15, Runa +6, Kaja +11.9; Hondo receives the single hat once. |
| Equality / decrease | Every applicable arrow red, manual Equip disabled for each hero, ownership unchanged. API rejection also covered by the focused invariant suite. |
| Recipient ties | Equal +60 gains choose lower current CP even when that hero has higher max HP. Exact CP ties choose Fara in definition order despite reversed save order. |
| Item tie | Equal best gain chooses the higher rarity; the remaining equal item becomes red after equip. |
| Re-ranking | Body upgrade is followed by a hat that reveals a previously ineligible body replacement worth +29.3; the final body and hat are equipped. |
| Copy order | Canonical-first, copy-first and interleaved saves keep their saved record order yet render the same four canonical recipients. Kaja's +15 survives. Existing copy loadouts stay unchanged. |
| Full cache + held item | Twenty inferior cached pieces plus a held upgrade; held-item arrows agree with Auto and the held piece becomes the correct owner's gear. |
| Cross-tab stale disposal | Start with a zero-gain body in disposal. A second tab receives a disclosed hat fixture and legally equips it. First tab returns to overview with the now-positive body. The production locked dismantle rejects the stale preview with identical save bytes. Manual Equip then raises CP while preserving every other equipped slot. |
| Hero screen + reload | Read actual displayed CP and inspect gear for all four heroes after allocation. Compare fixed golden values and a separate projection that never calls lamp eligibility/ranking. Reload retains exact item records and loadouts. The cross-tab case also reads all four Hero screens before the change. |
| Phones | Existing four-phone suite checks arrows, manual eligibility, Auto, disposal, feedback, modal/helper bounds and ongoing combat at 360×640, 216×384, 233×452 and 316×452. |

After every matrix Auto and the cross-tab manual equip, the independent oracle also asserts every pending, discarded and held leftover is nonpositive for all four owners. Negative controls show the assertion rejecting known positive leftovers in each queue.

The focused suite additionally checks all 120 permutations of four owners plus a copy, queue/preview/locked protection, missing or mismatched owner guards, copy-recipient rejection, and preservation of item bytes, loadouts and balances. Missing-owner tests exercise a runtime guard; the current save loader recreates absent canonical records. This guard blocks every lamp transaction, including draws, conveyor checkpoints and Gold settlement, before read/migration/backup writes.

## Reading the evidence

`test-results/ORKA-der/before/` holds baseline screenshots and observed receipts/destruction. `after/` holds each scenario's opening, selected item, receipts and Hero-screen captures, plus `gameplay.json`, `red-promise.json`, `kaja-protection.json` and `stale-disposal.json`. `phones/` holds the four-phone results. The native collaborative-preview walkthrough is `test-results/ORKA-der/native-walkthrough.mp4`.

Inspect screenshots individually alongside the numeric records. A rule-test pass does not establish a browser pass. The golden CP case and displayed Hero-screen values supplement the shared CP formula; they do not prove that formula's balance design.

This repair changes roster selection and existing queue classification. It performs no identity conversion. Previously equipped copy gear is preserved for ORKA-5af.3. The portable `dist-offline` artifact is outside this lane and retains its separate rebuild requirement.

## Protected boot comparison

Run against separately served unchanged main and candidate:

```sh
LAMP_BASELINE_URL=http://localhost:8563/web-runner/index.html LAMP_QA_URL=http://localhost:8562/web-runner/index.html node --test tests/lampBootPreservation.test.mjs
```

This optional two-build audit reports an explicit skip when either URL is absent. It compares no-action boots for a canonical-first fixture and a geared-copy-first fixture. Protected equipment fields are every item/roll/ID, every loadout including copy keys, Gold, settled Gold receipts, party EXP, Essence, capacity tier, salvage, and all remaining fields. Hero progress (every record, settled list and pending outbox), combat progression, the Bag backup, QA reset backup and legacy Gold key compare byte-for-byte with unchanged main.

Allowed equipment differences are enumerated individually: lamp.pending, lamp.discarded, lamp.disposalRequested, lamp.reviewHold, lamp.guide, lamp.conveyorActiveMs and emissions[].issuedActiveMs. The current fixtures produce only pending/discarded queue differences for Kaja. boot-preservation.json records the actual differences. Separate storage tests prove reclassification changes no owned gear or balances; browser Back-to-cache asserts the whole equipment record stays identical.

The commit hook routes CP, equipment, roster, Hero gear display and proof-owner changes through the real gameplay and roster tests. Presentation changes retain the full phone suite. This keeps browser proof active when only rule code changes.
