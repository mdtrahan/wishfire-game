import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RETIRED_COMBAT_ENTRYPOINTS = Object.freeze([
  'TickRealtimeHeroBasics', 'TickRealtimeEnemyActions', 'ProcessTurn', 'AdvanceTurn', 'StartRound', 'HeroTurn', 'EnemyTurn',
  'CalculateDamage', 'ApplyDamageToTarget', 'ApplyPartyDamage', 'KillEnemy', 'DoHeal', 'ApplyActiveHeroHeal',
  'advanceContinuousCombatArena', 'advanceCombatCamera', 'resolveSkill', 'turnStart', 'applyStatus',
]);
const families = 'calculateDamageRules effectiveStatRules enemyTargetingRules enemyJobSkillRules enemySkillChoiceRules enemyTurnFlowRules heroTurnEntryRules startEnemyActionRules singleHitRules partyDamageRules statusEffectRules heroSustainRules heroWard realtimeHeroSkills realtimeHeroPassives realtimeHeroTargeting realtimeCooldown realtimeSkillState dynamicInitiativeAuthorityExperiment dynamicInitiativeRules dynamicInitiativeRuntimeShadow initiativeGuards roundPointerAdvanceRules turnActorEligibilityRules turnOrderGroupRules turnPhaseAssignmentRules turnSummaryRules schedulerRules combatOutcomeRules runaMagicResistRules combatRules combatRuntimeGateway heroAttackTargetingRules'.split(' ');
const retiredPaths = [
  ...families.flatMap(name => ['src/core', 'web-runner/src/core'].flatMap(root => ['mjs', 'js', 'cjs'].map(ext => `${root}/${name}.${ext}`))),
  'Scripts/functionBank.js', 'Scripts/skillSheet.js', 'Scripts/functionRegistry.js',
  ...['combatSimulationTick.mjs', 'superGemRuntime.js', 'combatAttackVfxPresentation.mjs', 'astralFlowKoOrbPresentation.js', 'heroWardAura.mjs', 'combatTurnQaReadout.mjs', 'rustCombatShadow.mjs', 'rustCombatShadowRuntime.mjs'].map(name => `web-runner/systems/${name}`),
];
// TDD-B §6 classifications. These are the only supported host writers; the
// runtime-spy gate exercises admission, pause, AllDown and revision boundaries.
const writers = {
  'tools/qa_rust_combat_playtest2.mjs': 'isolated fixture projection from Rust snapshots',
  'tools/combat_lab/model.mjs': 'offline counterfactual model; no live runtime',
  'tools/combat_lab/party_sustain.mjs': 'offline survival model; no live runtime',
  'web-runner/systems/rustCombatRuntime.mjs': 'Rust snapshot projection; stopped-world restoration',
  'web-runner/systems/rustCombatPresentation.mjs': 'disposable presentation snapshot',
  'web-runner/systems/equipmentStorage.mjs': 'unbound meta transaction; bound inputs use revisions',
  'web-runner/systems/questCombatSession.mjs': 'stopped-world lifecycle; bound actors reject restoration',
  'web-runner/src/core/arenaCombat.mjs': 'pre-world origin placement',
  'web-runner/src/core/continuousCombatStage.mjs': 'authored spawn data; stopped-world lifecycle',
  'web-runner/src/core/heroProgression.mjs': 'canonical meta stats; bound inputs use revisions',
};
function files(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(resolve(root, entry.name)) : /\.[cm]?js$/.test(entry.name) ? [resolve(root, entry.name)] : []);
}
export function verifyRustOnlyInventory(root = resolve(import.meta.dirname, '..')) {
  const violations = retiredPaths.filter(path => existsSync(resolve(root, path))).map(path => `retired module: ${path}`), inventory = [];
  const calls = new RegExp(`\\b(?:${RETIRED_COMBAT_ENTRYPOINTS.join('|')})\\s*\\(`);
  for (const file of [...files(resolve(root, 'web-runner')), ...files(resolve(root, 'src')), ...files(resolve(root, 'Scripts')), ...files(resolve(root, 'tools')), ...files(resolve(root, 'tests'))]) {
    const path = relative(root, file), source = readFileSync(file, 'utf8');
    const fixture = path.startsWith('tests/');
    if (fixture) {
      if (calls.test(source) || /__ORKA_[A-Z_]+_OWNER__/.test(source)) inventory.push({ path, classification: 'fixture or retirement assertion' });
      continue;
    }
    if (path === 'tools/verify_rust_only_inventory.mjs') continue;
    if (calls.test(source)) violations.push(`retired call or implementation: ${path}`);
    if (/rustCombat=|rustShadow=|get\(['"]rust(?:Combat|Shadow)['"]\)/.test(source)) violations.push(`combat feature flag: ${path}`);
    if (/__ORKA_(?!SEEDED_RNG)[A-Z_]+_OWNER__/.test(source)) violations.push(`retired scalar owner hook: ${path}`);
    const fields = 'hp|maxHP|ward|footX|footY|PendingHeroHits|PendingEnemyHits|RealtimeSkillEffects|ActiveGroundSkills|RealtimeHeroBasicClocks|RealtimeEnemyActions';
    const assignments = new RegExp(`(?:\\.(?:${fields})|\\[['"](?:${fields})['"]\\])\\s*(?:=(?!=)|\\+=|-=)`, 'g');
    const projections = new RegExp(`Object\\.assign\\(\\s*[\\w.]+\\s*,\\s*\\{[^}]*\\b(?:${fields})\\s*:`, 'g');
    const writes = [...source.matchAll(assignments)].length + [...source.matchAll(projections)].length;
    if (writes) {
      inventory.push({ path, writes, classification: writers[path] || 'PROHIBITED' });
      if (!writers[path]) violations.push(`unclassified combat writer: ${path}`);
    }
  }
  return { pass: violations.length === 0, violations, inventory, fixtureRoots: ['tests/', 'tools/'], retainedScalars: ['CP', 'meta RNG'], scannedRoots: ['web-runner/', 'src/', 'Scripts/', 'tools/', 'tests/'] };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyRustOnlyInventory();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.pass ? 0 : 1;
}
