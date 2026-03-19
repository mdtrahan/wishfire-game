const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('hero red single-target attacks default to a single strike and keep Incinerate as an explicit clustered harness in both runtime mirrors', () => {
  const appSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'app.js'), 'utf8');
  const runtimeSrc = fs.readFileSync(path.join(__dirname, '..', 'web-runner', 'modules', 'functionBank.js'), 'utf8');
  const mirrorSrc = fs.readFileSync(path.join(__dirname, '..', 'Scripts', 'functionBank.js'), 'utf8');

  for (const src of [runtimeSrc, mirrorSrc]) {
    assert.match(src, /export function ConfigureActorRedAttackSkill\(ctx, actorUID, options = \{\}\)/);
    assert.match(src, /export function RemoveActorRedAttackSkill\(ctx, actorUID\)/);
    assert.match(src, /export function GetActorRedAttackSkill\(ctx, actorUID\)/);
    assert.match(src, /const redSkillConfig = ensureActorRedAttackSkillStore\(g\)\[Number\(heroUID \|\| 0\)\] \|\| null;/);
    assert.match(src, /if \(String\(redSkillConfig\?\.skillId \|\| ''\) === 'INCINERATE'\) \{/);
    assert.match(src, /const presentationProfiles = \{/);
    assert.match(src, /Falie: \{ hitCount: 4, intervalSec: 0\.3, scatter: \{ radiusX: 10, radiusY: 8 \} \}/);
    assert.match(src, /Huun: \{ hitCount: 4, intervalSec: 0\.3, scatter: \{ radiusX: 16, radiusY: 6 \} \}/);
    assert.match(src, /Runa: \{ hitCount: 4, intervalSec: 0\.3, scatter: \{ radiusX: 14, radiusY: 12 \} \}/);
    assert.match(src, /Kojonn: \{ hitCount: 4, intervalSec: 0\.3, scatter: \{ radiusX: 22, radiusY: 16 \} \}/);
    assert.match(src, /for \(let hitIndex = 0; hitIndex < presentation\.hitCount; hitIndex \+= 1\)/);
    assert.match(src, /damageTextScatter: presentation\.scatter,/);
    assert.match(src, /LogCombat\(ctx, `\$\{actorName\} used Incinerate on \$\{target\.name \|\| '\?'\} for \$\{totalBurstDamage\}!`\);/);
    assert.match(src, /const finalDmg = ampMult > 0 \? Math\.max\(1, Math\.ceil\(dmg \* ampMult\)\) : Math\.max\(1, dmg\);/);
    assert.match(src, /g\.PendingHeroHits\.push\(\{\s*at: applyAt,\s*heroUID,\s*targetUID,\s*dmg,\s*powerAmpMultiplier: ampMult,/s);
    assert.match(src, /msg: `\$\{actorName\} hit \$\{target\.name \|\| '\?'\} for \$\{finalDmg\}!`,/);
    assert.match(src, /if \(kind === 'damage' && g\.NextDamageTextScatter && typeof g\.NextDamageTextScatter === 'object'\) \{/);
    assert.match(src, /drawX \+= Math\.cos\(angle\) \* radiusX \* distance;/);
    assert.match(src, /drawY \+= Math\.sin\(angle\) \* radiusY \* distance;/);
    assert.match(src, /delete g\.NextDamageTextScatter;/);
    assert.match(src, /x: drawX,/);
    assert.match(src, /baseY: drawY,/);
  }

  assert.match(appSrc, /if \(hit\.damageTextScatter && typeof hit\.damageTextScatter === 'object'\) \{/);
});
