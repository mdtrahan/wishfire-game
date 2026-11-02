# Scripts DOX

Retained state, runtime adapters, entity/config initialization and meta token helpers live here. Combat function-bank and skill-sheet mirrors are retired. Do not restore JS scheduling, damage, healing, statuses or turn dispatch. Rust owns combat; the browser host owns meta transactions and lifecycle.

Validation: `tests/rustOnlyInventory.test.mjs` scans Scripts with runtime, shared core, tools and tests. Retained CP and meta RNG contracts stay independent of combat RNG.
