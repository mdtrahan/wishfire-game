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

export function drawHUD({
  out,
  walletOut,
  stateGlobals,
  gameState,
  uiState,
  getLatestCombatActionLine,
}) {
  if (!gameState.baseSummary || !out) return;
  const g = stateGlobals || {};
  const combatLogLines = [getLatestCombatActionLine()];
  const chainNum = Math.max(0, Number(g.ChainNumber || 0));
  const suppressChain = !!g.SuppressChainUI;
  const chainHideAt = Number(g.ChainUIHideAt || 0);
  const chainVisible = chainNum >= 2 && !suppressChain && (chainHideAt === 0 || Number(g.time || 0) <= chainHideAt);
  const lines = [
    gameState.baseSummary,
    `Overlay: ${uiState.overlayVisible ? 'OPEN' : 'closed'}`,
    '',
    ...combatLogLines,
    ...(chainVisible ? [`Chain x${chainNum}`] : []),
  ];
  out.textContent = lines.join('\n');

  drawWalletHUD({ walletOut, stateGlobals: g });
}
