(function () {
  const MATCH_GOLD_PER_GEM = 5;
  const MIN_MATCH_GOLD = 15;
  const YELLOW_GEM_COLOR = 3;
  const SPRITE_SRC = './assets/images/gem-animation 1-003.png';
  const state = {
    lastProcessedKey: '',
    pendingYellowCount: 0,
    layer: null,
    boardFreeze: null,
  };

  function ensureLayer() {
    if (state.layer && state.layer.isConnected) {
      return state.layer;
    }
    const layer = document.createElement('div');
    layer.style.position = 'fixed';
    layer.style.left = '0';
    layer.style.top = '0';
    layer.style.width = '100vw';
    layer.style.height = '100vh';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '9999';
    document.body.appendChild(layer);
    state.layer = layer;
    return layer;
  }

  function getBoardBounds(canvas, game) {
    const rect = canvas.getBoundingClientRect();
    const gems = Array.isArray(game && game.gems) ? game.gems : [];
    if (!gems.length) {
      return {
        left: rect.left + Math.round(rect.width * 0.08),
        top: rect.top + Math.round(rect.height * 0.56),
        width: Math.round(rect.width * 0.84),
        height: Math.round(rect.height * 0.34),
      };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const gem of gems) {
      const x = Number(gem.x || 0);
      const y = Number(gem.y || 0);
      const w = Number(gem.width || 0);
      const h = Number(gem.height || 0);
      minX = Math.min(minX, x - (w * 0.5));
      minY = Math.min(minY, y - (h * 0.5));
      maxX = Math.max(maxX, x + (w * 0.5));
      maxY = Math.max(maxY, y + (h * 0.5));
    }
    const scaleX = canvas.width ? (rect.width / canvas.width) : 1;
    const scaleY = canvas.height ? (rect.height / canvas.height) : 1;
    return {
      left: rect.left + Math.round(minX * scaleX),
      top: rect.top + Math.round(minY * scaleY),
      width: Math.round((maxX - minX) * scaleX),
      height: Math.round((maxY - minY) * scaleY),
    };
  }

  function releaseBoardFreeze() {
    if (state.boardFreeze && state.boardFreeze.isConnected) {
      state.boardFreeze.remove();
    }
    state.boardFreeze = null;
  }

  function holdBoardUntilBurstCompletes(canvas, game, durationMs) {
    if (!canvas) return;
    releaseBoardFreeze();
    const layer = ensureLayer();
    const rect = canvas.getBoundingClientRect();
    const bounds = getBoardBounds(canvas, game);
    const wrap = document.createElement('div');
    wrap.style.position = 'fixed';
    wrap.style.left = `${bounds.left}px`;
    wrap.style.top = `${bounds.top}px`;
    wrap.style.width = `${Math.max(1, bounds.width)}px`;
    wrap.style.height = `${Math.max(1, bounds.height)}px`;
    wrap.style.overflow = 'hidden';
    wrap.style.pointerEvents = 'none';
    wrap.style.zIndex = '9998';
    const snap = document.createElement('img');
    snap.src = canvas.toDataURL('image/png');
    snap.style.position = 'fixed';
    snap.style.left = `${rect.left}px`;
    snap.style.top = `${rect.top}px`;
    snap.style.width = `${rect.width}px`;
    snap.style.height = `${rect.height}px`;
    snap.style.pointerEvents = 'none';
    wrap.appendChild(snap);
    layer.appendChild(wrap);
    state.boardFreeze = wrap;
    window.setTimeout(releaseBoardFreeze, Math.max(0, durationMs));
  }

  function launchBurst(canvas, count) {
    if (!canvas || count <= 0) return;
    const layer = ensureLayer();
    const rect = canvas.getBoundingClientRect();
    const targetX = rect.left + Math.round(rect.width * 0.34);
    const targetY = rect.top + Math.round(Math.max(26, rect.height * 0.045));
    const size = Math.max(12, Math.round((rect.width / 360) * 15));
    const staggerMs = 65;
    const durationMs = 760;
    const starts = [
      { x: rect.left + Math.round(rect.width * 0.19), y: rect.top + Math.round(rect.height * 0.55) },
      { x: rect.left + Math.round(rect.width * 0.32), y: rect.top + Math.round(rect.height * 0.64) },
      { x: rect.left + Math.round(rect.width * 0.46), y: rect.top + Math.round(rect.height * 0.73) },
      { x: rect.left + Math.round(rect.width * 0.26), y: rect.top + Math.round(rect.height * 0.78) },
      { x: rect.left + Math.round(rect.width * 0.52), y: rect.top + Math.round(rect.height * 0.84) },
    ];
    for (let i = 0; i < count; i++) {
      const start = starts[i] || starts[starts.length - 1];
      const node = document.createElement('img');
      node.src = SPRITE_SRC;
      node.style.position = 'fixed';
      node.style.left = '0';
      node.style.top = '0';
      node.style.width = `${size}px`;
      node.style.height = `${size}px`;
      node.style.marginLeft = `${Math.round(-size * 0.5)}px`;
      node.style.marginTop = `${Math.round(-size * 0.5)}px`;
      node.style.pointerEvents = 'none';
      node.style.willChange = 'transform, opacity';
      layer.appendChild(node);
      const drift = (i - ((count - 1) / 2)) * 18;
      const midX = start.x + ((targetX - start.x) * 0.2) + drift;
      const midY = start.y - 34;
      const frames = [
        { transform: `translate(${start.x}px, ${start.y}px) scale(0.82)`, opacity: 1 },
        { transform: `translate(${midX}px, ${midY}px) scale(1.04)`, opacity: 1, offset: 0.58 },
        { transform: `translate(${targetX}px, ${targetY - 10}px) scale(0.58)`, opacity: 0 },
      ];
      const anim = node.animate(frames, {
        duration: durationMs,
        delay: i * staggerMs,
        easing: 'cubic-bezier(0.32, 0.02, 0.18, 1)',
        fill: 'forwards',
      });
      anim.onfinish = () => node.remove();
    }
    return durationMs + ((Math.max(0, count - 1)) * staggerMs);
  }

  function getSelectedYellowCount(game) {
    try {
      return game.gems.filter((gem) => gem && gem.selected && gem.color === YELLOW_GEM_COLOR).length;
    } catch {
      return 0;
    }
  }

  function getLifecycleKey(game, storyLine) {
    const g = game.globals || {};
    return [
      Number(g.CombatSessionId || 0),
      Number(g.MatchCount || 0),
      Number(g.CurrentTurnUID || 0),
      storyLine,
    ].join('|');
  }

  function maybeApplyYellowReward() {
    const game = window.__codexGame;
    if (!game || !game.globals || typeof game.getStoryCardDebugLine !== 'function') {
      return;
    }
    const selectedYellowCount = getSelectedYellowCount(game);
    if (selectedYellowCount > 0) {
      state.pendingYellowCount = selectedYellowCount;
    }
    const storyLine = String(game.getStoryCardDebugLine().rendered || '');
    if (!storyLine.endsWith('used Wild Magic!')) {
      return;
    }
    const lifecycleKey = getLifecycleKey(game, storyLine);
    if (lifecycleKey === state.lastProcessedKey) {
      return;
    }
    const yellowCount = Math.max(3, state.pendingYellowCount || 0);
    const reward = Math.max(MIN_MATCH_GOLD, yellowCount * MATCH_GOLD_PER_GEM);
    game.globals.goldTotal = Number(game.globals.goldTotal || 0) + reward;
    const canvas = document.getElementById('view');
    const totalMs = launchBurst(canvas, yellowCount);
    holdBoardUntilBurstCompletes(canvas, game, totalMs + 80);
    state.pendingYellowCount = 0;
    state.lastProcessedKey = lifecycleKey;
  }

  function tick() {
    maybeApplyYellowReward();
    window.requestAnimationFrame(tick);
  }

  window.requestAnimationFrame(tick);
})();
