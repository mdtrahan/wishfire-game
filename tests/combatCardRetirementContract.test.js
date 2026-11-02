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

test('combat status stays on living battlefield actors with hero-only meters and separate boss HUD', async () => {
  const { drawSliceActorBars } = await import('../web-runner/systems/rustCombatWorldHud.mjs');
  const app = fs.readFileSync(path.join(root, 'web-runner/app.js'), 'utf8');
  assert.doesNotMatch(app, /heroCommandUI|hero-commands/);
  const tracks=[],meters=[],fills=[];let color,current;
  const ctx=new Proxy({}, {get:(_target,key)=>key==='roundRect'?(...r)=>{current=r.slice(0,4);}:key==='fillRect'?(...r)=>{if(color==='#292E34')tracks.push(r);else meters.push({r,color});}:key==='fill'?()=>fills.push({r:current,color}):()=>{},set:(_target,key,value)=>{if(key==='fillStyle')color=value;return true;}});
  const actor=(team,kind,x,extra={})=>({team,kind,hp:50,max_hp:100,groove:'super',meter:1.5,pos:{x,y:200},...extra});
  const snapshot={actors:[actor('hero','fara',100),actor('enemy','gobloc',150),actor('enemy','boss_troll',200),actor('enemy','gobloc',250,{hp:0}),actor('hero','hondo',300,{downed:true}),actor('hero','runa',350,{hp:0})]};
  const before=structuredClone(snapshot);
  drawSliceActorBars(ctx,snapshot,{zoom:.5,x:x=>x,y:y=>y},1,0,0);
  assert.deepEqual(tracks,[[91.5,208,17,1.5],[141.5,204,17,1.5]]);
  assert.deepEqual(fills,[{r:[91.5,208,8.5,1.5],color:'#35B9E7'},{r:[141.5,204,8.5,1.5],color:'#E98824'}]);
  assert.deepEqual(meters,[{r:[91.5,210.5,17,1],color:'#090e12'},{r:[91.5,210.5,8.5,1],color:'#ffc745'}]);
  assert.deepEqual(snapshot,before,'HUD cannot mutate combat or visibility state');
});
