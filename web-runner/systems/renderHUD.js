function formatWalletText(label, wallet) {
  const lines = [`${label}:`];
  if (!wallet || typeof wallet !== 'object') {
    lines.push('(empty)');
    return lines.join('\n');
  }
  const entries = Object.entries(wallet)
    .filter(([, v]) => v != null)
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  if (entries.length === 0) {
    lines.push('(empty)');
    return lines.join('\n');
  }
  const total = entries.reduce((sum, [, v]) => sum + (Number(v) || 0), 0);
  lines.push(`Total: ${total}`);
  for (const [key, val] of entries) {
    lines.push(`${key}: ${val}`);
  }
  return lines.join('\n');
}

function formatSkillDrawDebugText(stateGlobals) {
  const g = stateGlobals || {};
  const calls = g.SkillDrawCalls && typeof g.SkillDrawCalls === 'object' && !Array.isArray(g.SkillDrawCalls)
    ? g.SkillDrawCalls
    : {};
  const count = (id) => {
    const value = Number(calls[id] || 0);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  };
  const unexpectedCalls = Number(g.SkillDrawUnexpectedCalls || 0);
  const unexpectedIds = Array.isArray(g.SkillDrawUnexpectedSkillIds)
    ? g.SkillDrawUnexpectedSkillIds.map(id => String(id || '')).filter(Boolean)
    : [];
  return [
    '',
    'Skill Draw Debug',
    `SkillDrawCalls.party_crimson_ward: ${count('party_crimson_ward')}`,
    `SkillDrawCalls.party_magic_fruit: ${count('party_magic_fruit')}`,
    `SkillDrawCalls.party_destiny: ${count('party_destiny')}`,
    `SkillDrawUnexpectedCalls: ${Number.isFinite(unexpectedCalls) && unexpectedCalls >= 0 ? Math.floor(unexpectedCalls) : 0}`,
    `SkillDrawUnexpectedSkillIds: ${unexpectedIds.length ? unexpectedIds.join(',') : '(none)'}`,
  ];
}

export function withSkillDrawDebugText(text, stateGlobals) {
  return [String(text || '')].concat(formatSkillDrawDebugText(stateGlobals)).join('\n');
}

function drawWalletHUD({ walletOut, stateGlobals }) {
  if (!walletOut) return;
  const g = stateGlobals || {};
  const wallet =
    g.TokenWallet ||
    g.tokenWallet ||
    g.WalletTokens ||
    g.walletTokens ||
    null;
  walletOut.textContent = formatWalletText('Wallet', wallet);
}

export function drawAstralWalletHUD({ astralWalletOut, stateGlobals }) {
  if (!astralWalletOut) return;
  const g = stateGlobals || {};
  const total = Math.max(0, Number(g.AstralFlowWallet || 0));
  astralWalletOut.textContent = `Astral Flow Wallet:\nTotal: ${total}`;
}

function drawGemCounterHUD({
  gemCounterOut,
  stateGlobals,
  stateEntities,
  gameState,
  resolveCurrentHeroUID,
  callFunctionWithContext,
  fnContext,
  getHeroUIDByIndex,
}) {
  if (!gemCounterOut) return;
  const g = stateGlobals || {};
  const usage = g.HeroGemUsage || {};
  const byHero = usage.byHero && typeof usage.byHero === 'object' ? usage.byHero : {};
  const party = usage.party && typeof usage.party === 'object'
    ? usage.party
    : { RED: 0, GREEN: 0, BLUE: 0, HEAL: 0, YELLOW: 0 };
  const currentHeroUID = resolveCurrentHeroUID({
    directUID: callFunctionWithContext(fnContext, 'GetCurrentTurn'),
    turnOrder: g.TurnOrderArray,
    currentTurnIndex: g.CurrentTurnIndex,
  });
  const currentHero = stateEntities.find((entity) => entity && entity.kind === 'hero' && entity.uid === currentHeroUID)
    || stateEntities.find((entity) => entity && entity.kind === 'hero' && entity.uid === getHeroUIDByIndex(gameState.selectedHero))
    || stateEntities.find((entity) => entity && entity.kind === 'hero')
    || null;
  const heroName = currentHero ? String(currentHero.name || 'Hero') : 'Hero';
  const heroTotals = byHero[heroName] && typeof byHero[heroName] === 'object'
    ? byHero[heroName]
    : { RED: 0, GREEN: 0, BLUE: 0, HEAL: 0, YELLOW: 0 };
  const doubleAttackHolderName = String(g.DevDoubleAttackHolderName || '');
  const doubleAttackHolderUID = Number(g.DevDoubleAttackHolderUID || 0);
  const doubleAttackChance = Number(g.DevDoubleAttackChance || 0.05);
  const doubleAttackProcs = doubleAttackHolderUID
    ? Number(callFunctionWithContext(fnContext, 'GetActorExtraTurnProcCount', doubleAttackHolderUID) || 0)
    : 0;
  const destinyAttempts = Math.max(0, Math.floor(Number(g.PartyDestinyAttempts || 0)));
  const destinyProcs = Math.max(0, Math.floor(Number(g.PartyDestinyProcs || 0)));
  const destinyHeals = Math.max(0, Math.floor(Number(g.PartyDestinyHeals || 0)));
  const destinyMisses = Math.max(0, Math.floor(Number(g.PartyDestinyMisses || 0)));
  const destinyLast = String(g.PartyDestinyLastResult || 'none');
  const lines = [
    'Gem Counter Radiator',
    `Hero: ${heroName}`,
    `RED:${Number(heroTotals.RED || 0)}`,
    `GREEN:${Number(heroTotals.GREEN || 0)}`,
    `BLUE:${Number(heroTotals.BLUE || 0)}`,
    `HEAL:${Number(heroTotals.HEAL || 0)}`,
    `YELLOW:${Number(heroTotals.YELLOW || 0)}`,
    '-----',
    `Double Attack: ${doubleAttackHolderName || 'Off'}`,
    `Chance: ${Math.round(doubleAttackChance * 100)}%`,
    `Procs: ${doubleAttackProcs}`,
    '-----',
    'Destiny',
    `Checks:${destinyAttempts}`,
    `Procs:${destinyProcs}`,
    `Heals:${destinyHeals}`,
    `Misses:${destinyMisses}`,
    `Last:${destinyLast}`,
    '-----',
    'Party Totals',
    `RED:${Number(party.RED || 0)}`,
    `GREEN:${Number(party.GREEN || 0)}`,
    `BLUE:${Number(party.BLUE || 0)}`,
    `HEAL:${Number(party.HEAL || 0)}`,
    `YELLOW:${Number(party.YELLOW || 0)}`,
  ];
  gemCounterOut.textContent = lines.join('\n');
}

export function drawHUD({
  out,
  gemCounterOut,
  walletOut,
  astralWalletOut,
  stateGlobals,
  stateEntities,
  gameState,
  uiState,
  getLatestCombatActionLine,
  resolveCurrentHeroUID,
  callFunctionWithContext,
  fnContext,
  getHeroUIDByIndex,
}) {
  if (!gameState.baseSummary || !out) return;
  const g = stateGlobals || {};
  const combatLogLines = [getLatestCombatActionLine()];
  const chainNum = Math.max(0, Number(g.ChainNumber || 0));
  const suppressChain = !!g.SuppressChainUI;
  const chainHideAt = Number(g.ChainUIHideAt || 0);
  const chainVisible = chainNum >= 2 && !suppressChain && (chainHideAt === 0 || Number(g.time || 0) <= chainHideAt);
  const actorIntent = typeof g.ActorIntent === 'string' && g.ActorIntent.trim() ? g.ActorIntent.trim() : 'Combat intent log';
  const order = Array.isArray(g.TurnOrderArray) ? g.TurnOrderArray : [];
  const count = order.length;
  const baseIndex = Number(g.CurrentTurnIndex || 0);
  const turnOrderLines = [];
  for (let offset = 0; offset < Math.min(6, count); offset++) {
    const idx = (baseIndex + offset) % count;
    const row = order[idx];
    if (!row) continue;
    const actor = stateEntities.find((e) => e.uid === row.uid);
    if (!actor) continue;
    const label = actor.name || '?';
    const baseSpd = Number(actor.stats?.SPD ?? actor.SPD ?? 0);
    const debuff = actor.kind === 'enemy' ? Number(g.EnemyDebuffs?.[actor.uid]?.SPD || 0) : 0;
    const curSpd = baseSpd - debuff;
    const extraTag = row.extra ? ' (x2)' : '';
    const cp = Number(actor.combatPower || actor.CombatPower || 0);
    const cpSuffix = actor.kind === 'enemy' ? ` CP: ${Math.round(cp)}` : '';
    turnOrderLines.push(`${label} SPD: ${Math.round(curSpd)}${cpSuffix}${extraTag}`);
  }
  const lines = [
    gameState.baseSummary,
    '',
    `TurnPhase: ${g.TurnPhase}`,
    `Board: ${gameState.boardCreated ? `${gameState.gems.length} gems` : 'waiting'}`,
    `Overlay: ${uiState.overlayVisible ? 'OPEN' : 'closed'}`,
    '',
    actorIntent,
    ...combatLogLines,
    ...(chainVisible ? [`Chain x${chainNum}`] : []),
    '',
    ...turnOrderLines,
  ];
  out.textContent = lines.concat(formatSkillDrawDebugText(g)).join('\n');

  drawGemCounterHUD({
    gemCounterOut,
    stateGlobals: g,
    stateEntities,
    gameState,
    resolveCurrentHeroUID,
    callFunctionWithContext,
    fnContext,
    getHeroUIDByIndex,
  });
  drawWalletHUD({ walletOut, stateGlobals: g });
  drawAstralWalletHUD({ astralWalletOut, stateGlobals: g });
}
