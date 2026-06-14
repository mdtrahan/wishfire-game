# Test Fixtures DOX

## Purpose
- Own deterministic fixture rows used by JS, Rust, and WASM parity tests.

## Ownership
- `*.csv` files define named input/output cases for deterministic rule families.

## Local Contracts
- Preserve headers unless all readers are updated in the same bead.
- Fixture rows should be deterministic, seed-aware when randomness is involved, and independent of DOM/canvas/localStorage state.
- Case names should describe the edge or invariant being protected.
- Do not update expected values merely to match a changed implementation unless the product/architecture contract changed too.

## Work Guidance
- Update the corresponding JS and Rust/WASM tests when adding or changing fixture columns.
- Include edge cases for empty queues, dead/disabled actors, threshold values, invalid inputs, and owner disagreements where relevant.

## Verification
- Run the fixture contract test that reads the changed CSV.
- Run Rust/WASM fixture checks when the CSV is shared with `rust/simulation_core/`.

## Child DOX Index
- None.
