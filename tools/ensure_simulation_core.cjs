// Shared synchronous bootstrap for standalone Node tests and the local server.
require('node:child_process').execFileSync(process.execPath, [
  require('node:path').join(__dirname, 'build_simulation_core_wasm.js'), '--ensure',
], { stdio: 'inherit' });
