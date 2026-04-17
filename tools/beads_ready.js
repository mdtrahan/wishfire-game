#!/usr/bin/env node
const { repairBeadsBackend } = require('./beads_runtime');

(async () => {
  const result = await repairBeadsBackend(process.cwd());
  if (result.ok) {
    if (result.repaired) {
      console.log(`Beads backend ready (Dolt repaired on port ${result.port}).`);
    } else {
      console.log('Beads backend ready.');
    }
    process.exit(0);
  }

  console.error('Beads backend unavailable. Board can use local mirror fallback, but live bd writes remain blocked.');
  if (result.error) console.error(result.error);
  process.exit(1);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
