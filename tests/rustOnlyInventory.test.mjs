import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyRustOnlyInventory } from '../tools/verify_rust_only_inventory.mjs';
test('TDD-B §6 static inventory rejects retired combat modules, flags, calls and unclassified writers', () => {
  const result = verifyRustOnlyInventory();
  assert.deepEqual(result.violations, []);
  assert.equal(result.pass, true);
});

test('inventory gate rejects reintroduced combat authority in runtime and tools', () => {
  const root = mkdtempSync(join(tmpdir(), 'jiyg-inventory-'));
  try {
    mkdirSync(join(root, 'tools'));
    mkdirSync(join(root, 'web-runner'));
    const injected = join(root, 'tools', 'live.mjs');
    for (const source of [
      'ApplyDamageToTarget(ctx, 1, 10);',
      "const url = '?rustCombat=1';",
      'globalThis.__ORKA_SINGLE_HIT_OWNER__ = () => 1;',
      'actor.hp -= 10;',
      "actor['hp'] = 1;",
      'Object.assign(actor, { hp: 1 });',
      'globals.PendingHeroHits = [];',
    ]) {
      writeFileSync(injected, source);
      assert.equal(verifyRustOnlyInventory(root).pass, false, source);
    }
    rmSync(injected);
    writeFileSync(join(root, 'web-runner', 'pure.mjs'), 'export const count = 3;');
    assert.equal(verifyRustOnlyInventory(root).pass, true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
