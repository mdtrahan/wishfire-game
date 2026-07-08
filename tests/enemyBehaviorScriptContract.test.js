const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const rulesPaths = [
  path.join(__dirname, '..', 'src', 'core', 'enemySkillChoiceRules.mjs'),
  path.join(__dirname, '..', 'web-runner', 'src', 'core', 'enemySkillChoiceRules.mjs'),
];

for (const rulesPath of rulesPaths) {
  test(`enemy behavior scripts are deterministic in ${path.relative(path.join(__dirname, '..'), rulesPath)}`, async () => {
    const { enemySkillChoiceFromJs } = await import(pathToFileURL(rulesPath));

    assert.deepEqual(
      pick(enemySkillChoiceFromJs, {
        enemyName: 'Djinn',
        behaviorTurn: 0,
        lastBehaviorSkill: '',
        boardReady: 1,
        roll: 0.99,
      }),
      { selected: 'Enemy_Scathe', branch: 'opening' },
    );

    assert.deepEqual(
      pick(enemySkillChoiceFromJs, {
        enemyName: 'Djinn',
        behaviorTurn: 1,
        lastBehaviorSkill: 'Enemy_Scathe',
        boardReady: 1,
        roll: 0,
      }),
      { selected: 'Enemy_MAG_Single', branch: 'loop' },
    );

    assert.deepEqual(
      pick(enemySkillChoiceFromJs, {
        enemyName: 'Marid',
        behaviorTurn: 0,
        lastBehaviorSkill: '',
        boardReady: 1,
        roll: 0.99,
      }),
      { selected: 'Enemy_Sweep', branch: 'opening' },
    );

    assert.deepEqual(
      pick(enemySkillChoiceFromJs, {
        enemyName: 'Gobloc',
        behaviorTurn: 4,
        lastBehaviorSkill: 'Enemy_ATK_Single',
        roll: 0,
      }),
      { selected: 'Enemy_ATK_Single', branch: 'loop' },
    );
  });

  test(`Chimerilass script prioritizes healing interrupts in ${path.relative(path.join(__dirname, '..'), rulesPath)}`, async () => {
    const { enemySkillChoiceFromJs } = await import(pathToFileURL(rulesPath));

    assert.deepEqual(
      pick(enemySkillChoiceFromJs, {
        enemyName: 'Chimerilass',
        hp: 80,
        maxHP: 100,
        damagedAlliesCount: 2,
        criticalAlliesCount: 0,
        behaviorTurn: 1,
        lastBehaviorSkill: 'Enemy_MAG_Single',
      }),
      { selected: 'Enemy_Heal_Allies', branch: 'rule_heal_party' },
    );

    assert.deepEqual(
      pick(enemySkillChoiceFromJs, {
        enemyName: 'Chimerilass',
        hp: 80,
        maxHP: 100,
        damagedAlliesCount: 1,
        criticalAlliesCount: 0,
        behaviorTurn: 2,
        lastBehaviorSkill: 'Enemy_MAG_Single',
      }),
      { selected: 'Enemy_Heal_Ally', branch: 'rule_heal_ally' },
    );

    assert.deepEqual(
      pick(enemySkillChoiceFromJs, {
        enemyName: 'Chimerilass',
        hp: 45,
        maxHP: 100,
        damagedAlliesCount: 0,
        criticalAlliesCount: 0,
        behaviorTurn: 3,
        lastBehaviorSkill: 'Enemy_MAG_Single',
      }),
      { selected: 'Enemy_Heal_Self', branch: 'rule_heal_self' },
    );
  });

  test(`Chimerilass avoids non-critical repeated healing in ${path.relative(path.join(__dirname, '..'), rulesPath)}`, async () => {
    const { enemySkillChoiceFromJs } = await import(pathToFileURL(rulesPath));

    assert.deepEqual(
      pick(enemySkillChoiceFromJs, {
        enemyName: 'Chimerilass',
        hp: 45,
        maxHP: 100,
        damagedAlliesCount: 1,
        criticalAlliesCount: 0,
        behaviorTurn: 4,
        lastBehaviorSkill: 'Enemy_Heal_Ally',
      }),
      { selected: 'Enemy_MAG_Single', branch: 'repeat_prevented_heal' },
    );

    assert.deepEqual(
      pick(enemySkillChoiceFromJs, {
        enemyName: 'Chimerilass',
        hp: 20,
        maxHP: 100,
        damagedAlliesCount: 0,
        criticalAlliesCount: 0,
        behaviorTurn: 5,
        lastBehaviorSkill: 'Enemy_Heal_Self',
      }),
      { selected: 'Enemy_Heal_Self', branch: 'rule_heal_self_critical' },
    );
  });
}

function pick(enemySkillChoiceFromJs, payload) {
  const decision = enemySkillChoiceFromJs({
    hp: 20,
    maxHP: 20,
    damagedAlliesCount: 0,
    criticalAlliesCount: 0,
    boardReady: 1,
    behaviorTurn: 0,
    lastBehaviorSkill: '',
    roll: 0,
    healRoll: 0,
    ...payload,
  });
  return {
    selected: decision.selected,
    branch: decision.branch,
  };
}
