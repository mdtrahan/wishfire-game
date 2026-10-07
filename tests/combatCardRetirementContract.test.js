const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const runtimeRoots = ['src', 'web-runner', 'Scripts', 'tools', 'rust/simulation_core/src'];
const sourceExtensions = new Set(['.js', '.mjs', '.rs']);
const retiredTokens = [
  /skill.?draught/i,
  /hero.?turn.?card/i,
  /session.?level.?up.?queue/i,
  /session.?buff.?combat.?visual/i,
  /sessionLevelUpBuffPresentation/i,
  /openDraught/i,
  /blueOpenDraught/i,
  /open_draught/i,
  /blue_open_draught/i,
  /cardText/i,
  /drawClass/i,
  /selected_from_skill_draught/i,
];

function sourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (sourceExtensions.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

test('retired combat-card modules, assets, and active-runtime tokens stay absent', () => {
  const forbiddenPaths = [
    'src/core/sessionLevelUpQueue.mjs',
    'web-runner/src/core/sessionLevelUpQueue.mjs',
    'web-runner/modules/sessionLevelUpBuffPresentation.mjs',
    'web-runner/src/core/heroTurnCards.mjs',
    'web-runner/systems/heroTurnCardFanUI.mjs',
    'web-runner/systems/heroCommandUI.mjs',
    'web-runner/systems/renderSkillDraughtOverlay.js',
    'web-runner/assets/images/navigation/flow.png',
  ];
  for (const relativePath of forbiddenPaths) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), false, `${relativePath} remains live`);
  }

  const violations = [];
  for (const relativeRoot of runtimeRoots) {
    for (const file of sourceFiles(path.join(root, relativeRoot))) {
      const source = fs.readFileSync(file, 'utf8');
      for (const pattern of retiredTokens) {
        if (pattern.test(source)) violations.push(`${path.relative(root, file)}: ${pattern}`);
      }
    }
  }
  assert.deepEqual(violations, [], 'retired combat-card vocabulary remains in active runtime roots');

  // Narrative/story cards remain a separate supported feature and are intentionally allowed.
  const storyEntry = fs.readFileSync(path.join(root, 'web-runner/systems/storyEntryFlow.mjs'), 'utf8');
  assert.match(storyEntry, /storyCardPresentation|Quest|story/i);
});

test('combat status stays on battlefield actors', () => {
  const app = fs.readFileSync(path.join(root, 'web-runner/app.js'), 'utf8');
  const render = fs.readFileSync(path.join(root, 'web-runner/systems/renderRuntime.js'), 'utf8');
  assert.doesNotMatch(app, /heroCommandUI|hero-commands/);
  assert.match(render, /HeroRestBasePosByUID[\s\S]*const hpRatio = Number\(hero\.maxHP/);
  assert.match(render, /const barY = Math\.round\(footPos\.y - actorHeight - 10 \* layoutScale\);/);
  const bodyStart = render.indexOf('const body = ') + 'const body = '.length;
  const bodyEnd = render.indexOf(';\n    const effectiveBody = assembleCombatRenderBody(body);', bodyStart);
  const authoredBody = vm.runInNewContext(render.slice(bodyStart, bodyEnd));
  assert.equal((authoredBody.match(/drawCombatHealthBar\(ctx, \{/g) || []).length, 2);
  const helperStart = render.indexOf('export function assembleCombatRenderBody(body) {');
  const helperEnd = render.indexOf('\n}\n\nlet renderImpl', helperStart) + 2;
  const helper = render.slice(helperStart, helperEnd).replace('export function', 'function');
  const assembledBody = new Function(`${helper}; return assembleCombatRenderBody;`)()(authoredBody);
  assert.equal((assembledBody.match(/drawCombatHealthBar\(ctx, \{/g) || []).length, 2);
  const bars = fs.readFileSync(path.join(root, 'web-runner/systems/combatHealthBarPresentation.mjs'), 'utf8');
  assert.match(bars, /ctx\.fillStyle = '#292E34';/);
});
