import { state } from '../Scripts/state.js';
import { createContext, callFunctionWithContext } from '../Scripts/functionRegistry.js';

const out = document.getElementById('output');
const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');

function getHeroUIDByIndex(idx) {
  const hero = state.entities.find(e => e.kind === 'hero' && e.heroIndex === idx);
  return hero ? hero.uid : 0;
}

// simple inline game state (could import from gameLogic.js if module support added)
  const gameState = {
  selectedHero: 0,
  selectedEnemy: 0,
  playerTurn: true,
  partyHP: [100, 80, 90, 75],
  partyMaxHP: [100, 100, 100, 100],
  enemyHP: [50, 60, 55],
  enemyMaxHP: [50, 60, 55],
  // Overlay state - NavMenu opens overlay window
  overlayVisible: false,
  // Gem board state
  gems: [], // array of gem objects {cellC, cellR, color, x, y}
  selectedGems: [], // indices of selected gems
  boardCreated: false,
  gridBounds: null, // bounds of grid_placeholder area for centering
  grid: [], // 2D grid of gem uid or 0
  nextGemUID: 1,
  selectionLocked: false,
  enemyTurnKicked: false,
  buffRollTimer: 0,
};

function setGemArray(arr) {
  state.globals.Gems = arr;
  gameState.gems = arr;
}

const fnContext = createContext({
  getGems: () => (state.globals.Gems || gameState.gems),
  setGems: (gems) => { setGemArray(gems); },
  getSelectedGemIndices: () => gameState.selectedGems,
  setSelectedGemIndices: (arr) => {
    gameState.selectedGems = arr;
    if (!arr || arr.length === 0) gameState.selectionLocked = false;
  },
});

function syncPartyTotals() {
  state.globals.PartyHPByIndex = [...gameState.partyHP];
  state.globals.PartyMaxHPByIndex = [...gameState.partyMaxHP];
  state.globals.PartyHP = gameState.partyHP.reduce((a, b) => a + b, 0);
  state.globals.PartyMaxHP = gameState.partyMaxHP.reduce((a, b) => a + b, 0);
}

function syncFromGlobals() {
  if (state.globals.PartyHPByIndex && state.globals.PartyHPByIndex.length) {
    gameState.partyHP = [...state.globals.PartyHPByIndex];
  }
  if (state.globals.PartyMaxHPByIndex && state.globals.PartyMaxHPByIndex.length) {
    gameState.partyMaxHP = [...state.globals.PartyMaxHPByIndex];
  }
  if (state.globals.EnemyHPByIndex && state.globals.EnemyHPByIndex.length) {
    gameState.enemyHP = [...state.globals.EnemyHPByIndex];
  }
  if (state.globals.EnemyMaxHPByIndex && state.globals.EnemyMaxHPByIndex.length) {
    gameState.enemyMaxHP = [...state.globals.EnemyMaxHPByIndex];
  }
  if (state.globals.Gems && Array.isArray(state.globals.Gems)) {
    gameState.gems = state.globals.Gems;
  }
}

// Board geometry (matches legacy Initializer.js defaults)
const boardGeometry = {
  cols: 6,
  rows: 4,
  cellSize: 45,
  gap: 2,
  gx: 32,      // top-left x
  gy: 365,     // top-left y
};

function e(u){return encodeURI(u)}
async function fetchJson(url){
  try{ const r = await fetch(e(url)); if(!r.ok) return null; return await r.json(); }
  catch(e){ return null }
}

function summaryText(layout, types, enemies){
  const parts = [];
  parts.push(layout ? `layout: ${layout.name||'unnamed'}` : 'layout: missing');
  parts.push(types ? `objectTypes: ${Object.keys(types).length}` : 'objectTypes: missing');
  parts.push(enemies ? `enemies: ${Array.isArray(enemies)?enemies.length: Object.keys(enemies||{}).length}` : 'enemies: missing');
  return parts.join('\n');
}

function parseC2ArrayTable(c2) {
  if (!c2 || !c2.c2array || !Array.isArray(c2.data)) return [];
  const cols = c2.data;
  if (cols.length === 0) return [];
  const rows = cols[0].length;
  if (!rows) return [];
  const headers = cols.map(col => (col[0] ? String(col[0][0]) : ''));
  const items = [];
  for (let y = 1; y < rows; y++) {
    const item = {};
    for (let x = 0; x < cols.length; x++) {
      const key = headers[x];
      const cell = cols[x][y] ? cols[x][y][0] : '';
      item[key] = cell;
    }
    if (item.name) items.push(item);
  }
  return items;
}

function initEntities(enemyRows, layoutInstances) {
  state.entities = [];
  state.globals.EnemyData = enemyRows || [];

  const heroIcons = (layoutInstances || []).filter(i => ['icon_hero1','icon_hero2','icon_hero3','icon_hero4'].includes(i.type));
  const heroByIndex = new Map();
  const typeToIndex = { icon_hero1: 0, icon_hero2: 1, icon_hero3: 2, icon_hero4: 3 };
  for (const icon of heroIcons) {
    const v = icon.variables || {};
    const idx = typeToIndex[icon.type];
    heroByIndex.set(idx, v);
  }

  const partyHP = [];
  const partyMaxHP = [];
  for (let i = 0; i < 4; i++) {
    const v = heroByIndex.get(i) || {};
    const hp = Number(v.HP ?? gameState.partyHP[i] ?? 0);
    let maxHP = Number(v.maxHP ?? (v.HP ?? gameState.partyMaxHP[i] ?? 0));
    if (!maxHP || maxHP < hp) maxHP = hp;
    partyHP[i] = hp;
    partyMaxHP[i] = maxHP;
    state.entities.push({
      uid: i + 1,
      kind: 'hero',
      name: v.name || `Hero ${i + 1}`,
      hp,
      maxHP: partyMaxHP[i],
      stats: {
        ATK: Number(v.ATK ?? 0),
        DEF: Number(v.DEF ?? 0),
        MAG: Number(v.MAG ?? 0),
        RES: Number(v.RES ?? 0),
        SPD: Number(v.SPD ?? 0),
      },
      heroIndex: i,
      attackType: v.attackType || 'melee',
      isAlive: true,
    });
  }

  gameState.partyHP = partyHP;
  gameState.partyMaxHP = partyMaxHP;
  // Ensure enemy UIDs don't collide with hero UIDs
  state.globals.NextUID = state.entities.reduce((max, e) => Math.max(max, e.uid || 0), 0) + 1;

  if (enemyRows && enemyRows.length) {
    state.globals.InitialSpawn = 1;
    const shuffled = enemyRows.slice().sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, 3);
    for (let i = 0; i < picks.length; i++) {
      callFunctionWithContext(fnContext, 'SpawnEnemy', {
        name: picks[i].name,
        HP: Number(picks[i].HP || 0),
        ATK: Number(picks[i].ATK || 0),
        DEF: Number(picks[i].DEF || 0),
        MAG: Number(picks[i].MAG || 0),
        RES: Number(picks[i].RES || 0),
        SPD: Number(picks[i].SPD || 0),
      }, i);
    }
    state.globals.InitialSpawn = 0;
  }

  if (state.globals.BattleStartMode == null) {
    state.globals.BattleStartMode = Math.random() < 0.5 ? 'ambush' : 'initiative';
  }

  callFunctionWithContext(fnContext, 'BuildTurnOrder');
  callFunctionWithContext(fnContext, 'StartRound');
  state.globals.CurrentTurnIndex = 0;
  if (!state.globals.BattleStartShown) {
    state.globals.BattleStartShown = 1;
    const msg = state.globals.BattleStartMode === 'ambush'
      ? 'Ambushed by enemy team!'
      : 'Heroes surprised the enemies!';
    state.globals.BattleStartText = msg;
    state.globals.BattleStartActive = 1;
    state.globals.BattleStartProcessStarted = 0;
    state.globals.BattleStartEndsAt = 2.0;
    state.globals.BattleStartFadeEndsAt = 2.4;
    state.globals.IsPlayerBusy = 1;
    state.globals.CanPickGems = 0;
  } else {
    callFunctionWithContext(fnContext, 'ProcessTurn');
  }
  callFunctionWithContext(fnContext, 'InitPartyHPFromHeroes');
  // Ensure party starts at full health
  if (state.globals.PartyMaxHP > 0) {
    state.globals.PartyHP = state.globals.PartyMaxHP;
    syncFromGlobals();
  }
  callFunctionWithContext(fnContext, 'UpdateEnemyHPUI');
  if (state.globals.EnemyHPByIndex) {
    gameState.enemyHP = [...state.globals.EnemyHPByIndex];
    gameState.enemyMaxHP = [...state.globals.EnemyMaxHPByIndex];
  }
}

// Create gem board with random colors (0-5: Hero1, Hero2, Heal, Buff, AOE, Energy)
function createGemBoard(gridBounds = null) {
  gameState.gems = [];
  gameState.grid = [];
  const g = boardGeometry;
  
  // Calculate board dimensions
  const boardWidth = g.cols * g.cellSize + (g.cols - 1) * g.gap;
  const boardHeight = g.rows * g.cellSize + (g.rows - 1) * g.gap;
  
  // If grid bounds provided, center the gem board within them
  let startX = g.gx;
  let startY = g.gy;
  
  if (gridBounds) {
    const gridWidth = gridBounds.maxX - gridBounds.minX;
    const gridHeight = gridBounds.maxY - gridBounds.minY;
    startX = gridBounds.minX + (gridWidth - boardWidth) / 2;
    startY = gridBounds.minY + (gridHeight - boardHeight) / 2;
    console.log(`[BOARD] Centered within grid bounds: (${startX.toFixed(1)}, ${startY.toFixed(1)})`);
  }
  
  for (let c = 0; c < g.cols; c++) {
    gameState.grid[c] = [];
    for (let r = 0; r < g.rows; r++) {
      gameState.grid[c][r] = 0;
    }
  }

  for (let c = 0; c < g.cols; c++) {
    for (let r = 0; r < g.rows; r++) {
      const x = Math.floor(startX + c * (g.cellSize + g.gap) + g.cellSize / 2) + 0.5;
      const y = Math.floor(startY + r * (g.cellSize + g.gap) + g.cellSize / 2) + 0.5;
      const color = randomGemFrame(); // gated frame selection per JSON
      
      gameState.gems.push({
        uid: gameState.nextGemUID++,
        cellC: c,
        cellR: r,
        color: color,
        elementIndex: color,
        x: x,
        y: y,
        worldX: x,  // for canvas coordinate conversion
        worldY: y,
        width: g.cellSize,
        height: g.cellSize,
        selected: false,
        Selected: 0,
        flashUntil: 0
      });
      gameState.grid[c][r] = gameState.gems[gameState.gems.length - 1].uid;
    }
  }
  
  gameState.selectedGems = [];
  gameState.selectionLocked = false;
  gameState.boardCreated = true;
  setGemArray(gameState.gems);
  state.globals.TapIndex = 0;
  console.log(`[BOARD] Created gem board: ${g.cols}x${g.rows} = ${gameState.gems.length} gems`);
}

function rebuildGridFromGems() {
  const g = boardGeometry;
  gameState.grid = [];
  for (let c = 0; c < g.cols; c++) {
    gameState.grid[c] = [];
    for (let r = 0; r < g.rows; r++) {
      gameState.grid[c][r] = 0;
    }
  }
  for (const gem of gameState.gems) {
    if (gem && gem.cellC != null && gem.cellR != null) {
      gameState.grid[gem.cellC][gem.cellR] = gem.uid;
    }
  }
}

function randomGemFrame() {
  const x = Math.floor(Math.random() * 1000);
  if (x >= 998) return x === 998 ? 6 : 7;
  // Weighted distribution for 0-5 (reduce Gold, keep board balanced)
  // Colors: 0,1,2,3,4,5 with Gold on 3
  const weights = [2, 2, 2, 1, 2, 2];
  let total = 0;
  for (const w of weights) total += w;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 0;
}

function refillGemBoard(gridBounds = null) {
  const g = boardGeometry;
  rebuildGridFromGems();
  let hasEmpty = false;
  for (let c = 0; c < g.cols; c++) {
    for (let r = 0; r < g.rows; r++) {
      if (gameState.grid[c][r] === 0) { hasEmpty = true; break; }
    }
    if (hasEmpty) break;
  }
  if (!hasEmpty) {
    console.log('[BOARD] Refill skipped (board full)');
    return false;
  }
  const boardWidth = g.cols * g.cellSize + (g.cols - 1) * g.gap;
  const boardHeight = g.rows * g.cellSize + (g.rows - 1) * g.gap;
  let startX = g.gx;
  let startY = g.gy;
  if (gridBounds) {
    const gridWidth = gridBounds.maxX - gridBounds.minX;
    const gridHeight = gridBounds.maxY - gridBounds.minY;
    startX = gridBounds.minX + (gridWidth - boardWidth) / 2;
    startY = gridBounds.minY + (gridHeight - boardHeight) / 2;
  }
  for (let c = 0; c < g.cols; c++) {
    for (let r = 0; r < g.rows; r++) {
      if (gameState.grid[c][r] !== 0) continue;
      const x = Math.floor(startX + c * (g.cellSize + g.gap) + g.cellSize / 2) + 0.5;
      const y = Math.floor(startY + r * (g.cellSize + g.gap) + g.cellSize / 2) + 0.5;
      const color = randomGemFrame();
      gameState.gems.push({
        uid: gameState.nextGemUID++,
        cellC: c,
        cellR: r,
        color,
        elementIndex: color,
        x,
        y,
        worldX: x,
        worldY: y,
        width: g.cellSize,
        height: g.cellSize,
        selected: false,
        Selected: 0,
        flashUntil: 0
      });
      gameState.grid[c][r] = gameState.gems[gameState.gems.length - 1].uid;
    }
  }
  gameState.boardCreated = true;
  gameState.selectedGems = [];
  gameState.selectionLocked = false;
  setGemArray(gameState.gems);
  state.globals.TapIndex = 0;
  console.log('[BOARD] Refilled missing gems');
  return true;
}

function handleSpecialGem6(gem) {
  const g = state.globals;
  const actorUID = callFunctionWithContext(fnContext, 'GetCurrentTurn') || getHeroUIDByIndex(gameState.selectedHero) || gameState.selectedHero;
  const actor = state.entities.find(e => e.uid === actorUID);
  const actorName = actor ? (actor.name || 'Hero') : 'Hero';
  const rollReward = Math.random() < 0.5 ? 'gold' : 'energy';
  if (rollReward === 'gold') {
    const goldOptions = [10, 15, 20];
    const amt = goldOptions[Math.floor(Math.random() * goldOptions.length)];
    g.goldTotal = (g.goldTotal || 0) + amt;
    callFunctionWithContext(fnContext, 'LogCombat', `${actorName} found ${amt} gold!`);
    callFunctionWithContext(fnContext, 'SpawnDamageText', amt, gem.x, gem.y, 'damage');
  } else {
    const energyOptions = [6, 12, 15];
    const amt = energyOptions[Math.floor(Math.random() * energyOptions.length)];
    const maxE = Math.max(0, g.Player_maxEnergy || 0);
    const next = (g.Player_Energy || 0) + amt;
    g.Player_Energy = maxE > 0 ? Math.min(maxE, next) : next;
    callFunctionWithContext(fnContext, 'LogCombat', `${actorName} gained ${amt} energy!`);
    callFunctionWithContext(fnContext, 'SpawnDamageText', amt, gem.x, gem.y, 'heal');
  }
  // Remove gem and free slot
  gameState.gems = gameState.gems.filter(gm => gm !== gem);
  gameState.selectedGems = [];
  gameState.selectionLocked = false;
  for (const gm of gameState.gems) {
    gm.selected = false;
    gm.Selected = 0;
  }
  state.globals.TapIndex = 0;
  rebuildGridFromGems();
  setGemArray(gameState.gems);
  if (typeof drawFrame === 'function') drawFrame();
}

function handleGemMatch(color) {
  const g = state.globals;
  g.DebugMatchCount = (g.DebugMatchCount || 0) + 1;
  console.log(`[DEBUG] matches=${g.DebugMatchCount} turns=${g.DebugTurnCount || 0}`);
  g.MatchedColorValue = color;
  g.SuppressChainUI = 0;
  state.globals.Gems = gameState.gems;
  if (color == null) {
    const clearLocalSelection = () => {
      fnContext.setSelectedGemIndices([]);
      gameState.selectionLocked = false;
      if (gameState.gems) {
        for (const gm of gameState.gems) {
          gm.selected = false;
          gm.Selected = 0;
        }
      }
      state.globals.TapIndex = 0;
    };
    clearLocalSelection();
    return;
  }

  const actorUID = callFunctionWithContext(fnContext, 'GetCurrentTurn') || getHeroUIDByIndex(gameState.selectedHero) || gameState.selectedHero;

  const clearLocalSelection = () => {
    fnContext.setSelectedGemIndices([]);
    gameState.selectionLocked = false;
    if (gameState.gems) {
      for (const gm of gameState.gems) {
        gm.selected = false;
        gm.Selected = 0;
      }
    }
    state.globals.TapIndex = 0;
  };

  const syncGemsFromGlobals = () => {
    if (state.globals.Gems && Array.isArray(state.globals.Gems)) {
      gameState.gems = state.globals.Gems;
    }
  };

  if (color === 0 || color === 1) {
    g.TurnPhase = 1;
    callFunctionWithContext(fnContext, 'UpdateChain', color);
    g.IsAOEMatch = 0;
    callFunctionWithContext(fnContext, 'ResolveGemAction', color, actorUID);
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridFromGems();
    callFunctionWithContext(fnContext, 'Sub_Energy');
    g.ApplyChainToNextDamage = g.ChainNumber >= 2 ? 1 : 0;
  } else if (color === 2) {
    g.MatchedColorValue = 0;
    g.IsAOEMatch = 0;
    g.SuppressChainUI = 0;
    callFunctionWithContext(fnContext, 'UpdateChain', 2);
    callFunctionWithContext(fnContext, 'ResolveGemAction', 2, actorUID);
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridFromGems();
    callFunctionWithContext(fnContext, 'Sub_Energy');
    g.ApplyChainToNextDamage = 0;
  } else if (color === 3) {
    callFunctionWithContext(fnContext, 'ResolveGemAction', 3, actorUID);
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridFromGems();
  } else if (color === 4) {
    g.MatchedColorValue = 4;
    g.IsAOEMatch = 0;
    callFunctionWithContext(fnContext, 'UpdateChain', 4);
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridFromGems();
    callFunctionWithContext(fnContext, 'Sub_Energy');
    callFunctionWithContext(fnContext, 'ResolveGemAction', 4, actorUID);
  } else if (color === 5) {
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridFromGems();
    callFunctionWithContext(fnContext, 'ResolveGemAction', 5, actorUID);
  } else if (color === 6 || color === 7) {
    callFunctionWithContext(fnContext, 'DestroyGem');
    callFunctionWithContext(fnContext, 'ClearMatchState');
    syncGemsFromGlobals();
    clearLocalSelection();
    rebuildGridFromGems();
  }

  gameState.boardCreated = gameState.gems.length > 0;
  if (!gameState.boardCreated) {
    createGemBoard(gameState.gridBounds);
  }
  if (state.globals.TurnPhase === 2) {
    callFunctionWithContext(fnContext, 'EnemyTurn');
  }
  syncFromGlobals();
}

function tryGetInstances(layout){
  const instances = [];
  if(!layout || !layout.layers) return instances;
  
  // Skip reference/guide layers and debug layers
  const skipLayers = new Set(['UI_SAMPLE', 'UI layout  sizing']);
  
  for(let layerIdx = 0; layerIdx < layout.layers.length; layerIdx++){
    const layer = layout.layers[layerIdx];
    if(!layer.instances || skipLayers.has(layer.name)) continue;
    
    for(const ins of layer.instances){
      instances.push({ 
        type: ins.type, 
        world: ins.world || {x:0,y:0,width:32,height:32},
        uid: ins.uid,
        layerName: layer.name,
        layerIndex: layerIdx,
        variables: ins.instanceVariables || ins.variables,
        properties: ins.properties
      });
      if(instances.length>200) return instances;
    }
  }
  return instances;
}

function makeImagePath(typeName, animName){
  if(!typeName) return null;
  const t = typeName.toLowerCase();
  const a = (animName||'animation 1').toLowerCase();
  // common filenames: type-anim-000.png, allow spaces
  return `/project_C3_conversion/images/${t}-${a}-000.png`;
}

async function loadImage(url){
  return new Promise((res)=>{
    const img = new Image(); img.onload = ()=>res(img); img.onerror = ()=>res(null); img.src = url;
  });
}

async function main(){
  console.log('[INIT] Starting initialization...');
  syncPartyTotals();
  state.globals.Player_maxEnergy = 150;
  state.globals.Player_Energy = state.globals.Player_maxEnergy;
  state.globals.EnergyInitialized = 1;
  const layout = await fetchJson('/project_C3_conversion/layouts/Layout 1.json');
  if(!layout){ out.textContent = 'Failed to load layout'; return; }
  console.log('[INIT] Layout loaded');
  const assetsLayout = await fetchJson('/project_C3_conversion/layouts/Assets.json');

  // read project viewport to scale coordinates
  const project = await fetchJson('/project_C3_conversion/project.c3proj');
  const viewW = project && project.viewportWidth ? project.viewportWidth : 360;
  const viewH = project && project.viewportHeight ? project.viewportHeight : 640;
  console.log('[INIT] Project viewport:', viewW, 'x', viewH);

  const instances = tryGetInstances(layout);
  const typesNeeded = Array.from(new Set(instances.map(i=>i.type)));
  // Ensure required types are loaded even if not placed on layout
  ['Enemy_Sprite', 'Bar_Fill', 'Bar_Yellow', 'Bar_Back', 'PartyHP_Bar', 'Gem', 'AttackButton', 'Selector'].forEach(t => {
    if (!typesNeeded.includes(t)) typesNeeded.push(t);
  });
  const types = {};
  for(const t of typesNeeded){
    const url = `/project_C3_conversion/objectTypes/${encodeURIComponent(t)}.json`;
    const data = await fetchJson(url);
    if(data) types[t] = data;
  }
  console.log('[INIT] Loaded', Object.keys(types).length, 'object types');

  const enemies = await fetchJson('/project_C3_conversion/files/Enemies.json');
  const enemyRows = parseC2ArrayTable(enemies);
  initEntities(enemyRows, instances);
  const baseSummary = summaryText(layout, types, enemies);
  out.textContent = baseSummary + '\n\nLoading images...';

  // preload representative images per type
  const images = {};
  const enemySpriteImages = {};
  const gemFrameImages = [];
  const buffIconFrameImages = {};
  const debuffIconImages = {};
  let loadedCount = 0;
  const failedImages = [];
  try {
    for(const [t,data] of Object.entries(types)){
      try {
        const pluginId = data && data['plugin-id'];
        if (pluginId && pluginId !== 'Sprite') {
          continue;
        }
        let animName = null;
        try{ animName = data.animations && data.animations.items && data.animations.items[0] && data.animations.items[0].name; } catch(e){}
        const imgPath = makeImagePath(t, animName);
        if(imgPath){
          const img = await loadImage(imgPath);
          if(img) {
            images[t] = img;
            loadedCount++;
            if(['UI_NavCloseButton', 'UI_NavCloseX', 'UI_CloseWin'].includes(t)) {
              console.log(`[LOAD] SUCCESS: ${t} loaded from ${imgPath}`);
            }
          } else {
            failedImages.push({type: t, path: imgPath, anim: animName});
            if(['UI_NavCloseButton', 'UI_NavCloseX', 'UI_CloseWin'].includes(t)) {
              console.log(`[LOAD] FAILED: ${t} from ${imgPath}`);
            }
          }
        }
      } catch(e) {
        console.warn(`[LOAD] Failed to load image for type ${t}:`, e.message);
      }
    }
    // Load Enemy_Sprite animations by name for per-enemy rendering
    const enemyType = types['Enemy_Sprite'];
    if (enemyType && enemyType.animations && Array.isArray(enemyType.animations.items)) {
      for (const anim of enemyType.animations.items) {
        const animName = anim.name;
        const imgPath = makeImagePath('Enemy_Sprite', animName);
        if (!imgPath) continue;
        const img = await loadImage(imgPath);
        if (img) {
          enemySpriteImages[String(animName).toLowerCase()] = img;
        }
      }
      console.log('[LOAD] Enemy_Sprite animations loaded:', Object.keys(enemySpriteImages).length);
    }
    // Load Gem animation frames (0-7) for board rendering
    for (let i = 0; i < 8; i++) {
      const imgPath = `/project_C3_conversion/images/gem-animation 1-${String(i).padStart(3, '0')}.png`;
      const img = await loadImage(imgPath);
      if (img) gemFrameImages[i] = img;
    }
    // Load Buff icon frames (0-4) as separate files (not a sprite sheet)
    for (let i = 1; i <= 5; i++) {
      const key = `buffIcon${i}`;
      buffIconFrameImages[key] = [];
      for (let f = 0; f < 5; f++) {
        const imgPath = `/project_C3_conversion/images/bufficon${i}-animation 1-${String(f).padStart(3, '0')}.png`;
        const img = await loadImage(imgPath);
        if (img) buffIconFrameImages[key][f] = img;
      }
    }
    // Load Debuff icon assets
    debuffIconImages.ATK = await loadImage('/project_C3_conversion/images/ATK_down.png');
    debuffIconImages.DEF = await loadImage('/project_C3_conversion/images/DEF_down.png');
    debuffIconImages.MAG = await loadImage('/project_C3_conversion/images/MAG_down.png');
    debuffIconImages.RES = await loadImage('/project_C3_conversion/images/RES_down.png');
    debuffIconImages.SPD = await loadImage('/project_C3_conversion/images/SPD_down.png');
    console.log(`[LOAD] Completed image preloading: ${loadedCount}/${Object.keys(types).length} images loaded`);
    if(failedImages.length > 0) {
      console.log(`[LOAD] Failed images (first 5):`, failedImages.slice(0, 5).map(f => `${f.type}(${f.path})`).join(', '));
    }
  } catch(e) {
    console.error(`[LOAD] Error during image preload:`, e);
  }
  console.log('[INIT] Processing instances...');

  const layoutW = viewW;
  const layoutH = viewH;
  let layoutScale = 1;
  let layoutOffsetX = 0;
  let layoutOffsetY = 0;
  let dpr = Math.max(1, window.devicePixelRatio || 1);

  function resizeCanvas() {
    const pad = 16;
    const h = Math.max(320, window.innerHeight - pad);
    const w = Math.round(h * (layoutW / layoutH));
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.style.height = `${h}px`;
    canvas.style.width = `${w}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scaleX = (canvas.width / dpr) / layoutW;
    const scaleY = (canvas.height / dpr) / layoutH;
    layoutScale = Math.min(scaleX, scaleY);
    layoutOffsetX = ((canvas.width / dpr) - layoutW * layoutScale) / 2;
    layoutOffsetY = ((canvas.height / dpr) - layoutH * layoutScale) / 2;
  }
  resizeCanvas();
  window.addEventListener('resize', () => {
    resizeCanvas();
  });

  // Map Construct world coords to canvas coords (preserve layout aspect/position)
  function worldToCanvas(wx, wy) {
    const cx = layoutOffsetX + wx * layoutScale;
    const cy = layoutOffsetY + wy * layoutScale;
    return { x: cx, y: cy };
  }

  function getSpriteOrigin(typeName) {
    const t = types[typeName];
    const frame = t && t.animations && t.animations.items && t.animations.items[0] &&
      t.animations.items[0].frames && t.animations.items[0].frames[0];
    if (frame && typeof frame.originX === 'number' && typeof frame.originY === 'number') {
      return { ox: frame.originX, oy: frame.originY };
    }
    return { ox: 0.5, oy: 0.5 };
  }

  function findAssetInstance(typeName) {
    if (!assetsLayout || !assetsLayout.layers) return null;
    for (const layer of assetsLayout.layers) {
      if (!layer.instances) continue;
      for (const inst of layer.instances) {
        if (inst.type === typeName) return inst;
      }
    }
    return null;
  }

  const assetSizes = {
    AttackButton: (() => {
      const inst = findAssetInstance('AttackButton');
      return inst && inst.world ? {
        width: inst.world.width,
        height: inst.world.height,
        originX: inst.world.originX,
        originY: inst.world.originY
      } : null;
    })(),
    Selector: (() => {
      const inst = findAssetInstance('Selector');
      return inst && inst.world ? {
        width: inst.world.width,
        height: inst.world.height,
        originX: inst.world.originX,
        originY: inst.world.originY
      } : null;
    })()
  };

  // Helper to extract text content from instance data or type
  function getTextContent(inst, typeData){
    // First check instance properties for text (C3 Text objects store text in properties.text)
    if(inst.properties && inst.properties.text){
      return String(inst.properties.text);
    }
    // Try instance variables second (if text content stored there)
    if(inst.variables && inst.variables.length > 0){
      for(const v of inst.variables){
        if(v.name && (v.name.includes('text') || v.name.includes('content'))){
          return String(v.value || v.initialValue || '');
        }
      }
    }
    // Fallback: generate label from instance type name
    if(inst.type){
      // Convert "Text_Gold" -> "Gold", "Text_Energy" -> "Energy"
      let label = inst.type;
      if(label.startsWith('Text_')) label = label.substring(5);
      // Insert space before capital letters: "PlayerHP" -> "Player HP"
      label = label.replace(/([A-Z])/g, ' $1').trim();
      return label;
    }
    return 'Text';
  }

  function getHeroUIDByIndex(idx) {
    const hero = state.entities.find(e => e.kind === 'hero' && e.heroIndex === idx);
    return hero ? hero.uid : 0;
  }

  function getAttackButtonBounds() {
    const img = images['AttackButton'];
    const origin = getSpriteOrigin('AttackButton');
    const asset = assetSizes.AttackButton;
    const worldX = 180;
    const moveUp = (asset ? asset.height : (img ? img.height : 60)) / 2;
    const worldY = 235 - moveUp;
    const pos = worldToCanvas(worldX, worldY);
    const w = (asset ? asset.width : (img ? img.width : 120)) * layoutScale;
    const h = (asset ? asset.height : (img ? img.height : 60)) * layoutScale;
    const ox = asset ? asset.originX : origin.ox;
    const oy = asset ? asset.originY : origin.oy;
    const dx = pos.x - w * ox;
    const dy = pos.y - h * oy;
    return { dx, dy, w, h, img };
  }

  // state for animation/ticking
  const animState = {};
  const enemyBars = new Map();
  let lastFrameTime = performance.now();
  const buffIconFrames = { buffIcon1: 0, buffIcon2: 0, buffIcon3: 0, buffIcon4: 0, buffIcon5: 0 };
  const rendered = [];
  for(let i=0;i<Math.min(instances.length, 500); i++){
    const inst = instances[i];
    const world = inst.world || { x:0, y:0, width:32, height:32, originX:0.5, originY:0.5 };
    const img = images[inst.type];
    const typeData = types[inst.type];
    const ox = (world.originX !== undefined) ? world.originX : 0.5;
    const oy = (world.originY !== undefined) ? world.originY : 0.5;
    const isTextObject = typeData && typeData['plugin-id'] === 'Text';
    const isButton = typeData && typeData['plugin-id'] === 'Button';
    const isSprite = typeData && typeData['plugin-id'] === 'Sprite';
    const textContent = isTextObject ? getTextContent(inst, typeData) : 
                       (isButton && inst.properties && inst.properties.text) ? inst.properties.text : null;
    rendered.push({
      inst, typeData, world, ox, oy,
      uid: inst.uid,
      dx: 0, dy: 0, w: 0, h: 0,
      isText: isTextObject, isButton, isSprite, img, textContent,
      layerIndex: inst.layerIndex || 0,
      layerName: inst.layerName || 'Unknown'
    });
  }
  
  // Sort by layer index to ensure proper rendering order (background first)
  rendered.sort((a, b) => a.layerIndex - b.layerIndex);
  
  // Debug: Check if modal elements are present in layout
  const windowPopupItems = rendered.filter(r => r.layerName === 'Window Popup');
  const modalObjects = rendered.filter(r => ['UI_CloseWin', 'UI_NavCloseButton', 'UI_NavCloseX'].includes(r.inst.type));
  console.log(`[DEBUG] Window Popup layer items: ${windowPopupItems.length} found`);
  console.log(`[DEBUG] Modal objects: ${modalObjects.length} found:`, modalObjects.map(r => `${r.inst.type} at (${r.inst.world.x || 0}, ${r.inst.world.y || 0})`).join(', '));
  console.log(`[DEBUG] All rendered objects: ${rendered.length} total`);
  console.log(`[DEBUG] Modal objects:`, windowPopupItems.map(r => r.inst.type).join(', '));

  // Cache hero icon positions for damage text spawn
  const heroIconTypes = ['icon_hero1','icon_hero2','icon_hero3','icon_hero4'];
  state.globals.HeroIconPosByIndex = heroIconTypes.map(type => {
    const inst = rendered.find(r => r.inst.type === type);
    if (!inst || !inst.world) return null;
    return { x: inst.world.x || 0, y: inst.world.y || 0 };
  });
  
  // Calculate grid bounds from grid_placeholder objects for gem board centering
  const gridPlaceholders = rendered.filter(r => r.inst.type === 'grid_placeholder');
  let gridBounds = null;
  if (gridPlaceholders.length > 0) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const gp of gridPlaceholders) {
      const world = gp.inst.world;
      const w = world.width || 45;
      const h = world.height || 45;
      const ox = (world.originX !== undefined) ? world.originX : 0.5;
      const oy = (world.originY !== undefined) ? world.originY : 0.5;
      const left = (world.x || 0) - w * ox;
      const right = (world.x || 0) + w * (1 - ox);
      const top = (world.y || 0) - h * oy;
      const bottom = (world.y || 0) + h * (1 - oy);
      minX = Math.min(minX, left);
      maxX = Math.max(maxX, right);
      minY = Math.min(minY, top);
      maxY = Math.max(maxY, bottom);
    }
    gridBounds = { minX, maxX, minY, maxY };
    gameState.gridBounds = gridBounds; // Store for later use in refill
    console.log(`[BOARD] Grid bounds calculated: (${minX.toFixed(1)}, ${minY.toFixed(1)}) to (${maxX.toFixed(1)}, ${maxY.toFixed(1)})`);
  }

  // Calculate EnemyArea bounds for layout math (ComputeEnemyLayout parity)
  const enemyAreas = rendered.filter(r => r.inst.type === 'EnemyArea');
  if (enemyAreas.length > 0) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const ea of enemyAreas) {
      const world = ea.inst.world;
      const w = world.width || 45;
      const h = world.height || 45;
      const ox = (world.originX !== undefined) ? world.originX : 0.5;
      const oy = (world.originY !== undefined) ? world.originY : 0.5;
      const left = (world.x || 0) - w * ox;
      const right = (world.x || 0) + w * (1 - ox);
      const top = (world.y || 0) - h * oy;
      const bottom = (world.y || 0) + h * (1 - oy);
      minX = Math.min(minX, left);
      maxX = Math.max(maxX, right);
      minY = Math.min(minY, top);
      maxY = Math.max(maxY, bottom);
    }
    state.globals.EnemyAreaRect = { minX, maxX, minY, maxY };
    callFunctionWithContext(fnContext, 'ComputeEnemyLayout');
    callFunctionWithContext(fnContext, 'RefreshEnemyPositions');
  }
  
  // Create gem board centered within grid bounds
  createGemBoard(gridBounds);
  
  out.textContent = `🎮 Puzzle RPG\n\n✓ Game loaded\n${rendered.length} total objects loaded`;

  // Track last overlay state for logging only on change
  let lastOverlayState = null;
  
  // helper function to draw all instances
  function drawFrame(){
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
    lastFrameTime = now;
    if (!state.globals.time) state.globals.time = 0;
    state.globals.time += dt;
    // Enemy DoT ticks (Kojonn green gem effect)
    if (state.globals.EnemyDoTs) {
      const now = state.globals.time;
      for (const [uidStr, list] of Object.entries(state.globals.EnemyDoTs)) {
        const uid = Number(uidStr);
        if (!Array.isArray(list) || list.length === 0) continue;
        for (let i = list.length - 1; i >= 0; i--) {
          const dot = list[i];
          if (!dot || dot.remainingTicks <= 0) {
            list.splice(i, 1);
            continue;
          }
          if (now >= (dot.nextTickAt || 0)) {
            const dmg = Math.max(1, Math.round(dot.dmgPerTick || 1));
            const prev = state.globals.SpawnDamageText;
            state.globals.SpawnDamageText = 0;
            callFunctionWithContext(fnContext, 'ApplyDamageToTarget', uid, dmg);
            state.globals.SpawnDamageText = prev;
            dot.remainingTicks -= 1;
            dot.nextTickAt = now + 3;
            if (dot.remainingTicks <= 0) {
              list.splice(i, 1);
            }
          }
        }
        if (list.length === 0) delete state.globals.EnemyDoTs[uidStr];
      }
    }
    // Party Regen ticks (Kojonn light green effect)
    if (state.globals.PartyRegens) {
      const now = state.globals.time;
      const list = state.globals.PartyRegens;
      for (let i = list.length - 1; i >= 0; i--) {
        const regen = list[i];
        if (!regen || regen.remainingTicks <= 0) {
          list.splice(i, 1);
          continue;
        }
        if (now >= (regen.nextTickAt || 0)) {
          const heal = Math.max(1, Math.round(regen.healPerTick || 1));
          const prev = state.globals.SpawnDamageText;
          state.globals.SpawnDamageText = 0;
          callFunctionWithContext(fnContext, 'ApplyPartyHeal', heal);
          state.globals.SpawnDamageText = prev;
          regen.remainingTicks -= 1;
          regen.nextTickAt = now + 3;
          if (regen.remainingTicks <= 0) {
            list.splice(i, 1);
          }
        }
      }
      if (list.length === 0) delete state.globals.PartyRegens;
    }
    if (state.globals.BattleStartActive) {
      const t = state.globals.time;
      const fadeEnd = state.globals.BattleStartFadeEndsAt ?? 2.4;
      if (t >= fadeEnd) {
        state.globals.BattleStartActive = 0;
        if (!state.globals.BattleStartProcessStarted) {
          state.globals.BattleStartProcessStarted = 1;
          state.globals.IsPlayerBusy = 0;
          callFunctionWithContext(fnContext, 'ProcessTurn');
        }
      }
    }

    // DamageText animation update
    const dmgTexts = state.globals.DamageTexts || [];
    for (let i = dmgTexts.length - 1; i >= 0; i--) {
      const d = dmgTexts[i];
      d.age = (d.age || 0) + dt;
      if (d.phase === 0) {
        const rise = Math.max(0.001, d.riseInSec || 0.18);
        if (d.age >= rise) {
          d.phase = 1;
          d.age = 0;
        }
      } else if (d.phase === 1) {
        const hold = d.holdSec || 0.7;
        if (d.age >= hold) {
          d.phase = 2;
          d.age = 0;
        }
      } else if (d.phase === 2) {
        const fade = Math.max(0.001, d.fadeSec || 0.45);
        if (d.age >= fade) {
          dmgTexts.splice(i, 1);
        }
      }
    }
    const animEndAt = state.globals.TextAnimEndAt || 0;
    state.globals.TextAnimating = (dmgTexts.length > 0 || (state.globals.time || 0) < animEndAt) ? 1 : 0;

    // Enemy action state machine (advance -> act -> retreat -> done)
    const enemyAction = state.globals.EnemyAction;
    if (enemyAction && enemyAction.active) {
      const enemy = state.entities.find(e => e.kind === 'enemy' && e.uid === enemyAction.uid);
      if (!enemy || (enemy.hp ?? 0) <= 0) {
        enemyAction.active = false;
        state.globals.IsPlayerBusy = 0;
      } else {
        const anticipationDur = 0.14;
        const lungeDur = 0.32;
        const impactHold = 0.16;
        const retreatDur = 0.26;
        if (enemy.originX == null) enemy.originX = enemy.x ?? 0;
        if (enemy.originY == null) enemy.originY = enemy.y ?? 0;
        if (enemyAction.targetX == null) {
          const heroIcons = state.globals.HeroIconPosByIndex || [];
          const targetIdx = (enemyAction.targetUID ? (state.entities.find(e => e.uid === enemyAction.targetUID)?.heroIndex ?? 0) : 0);
          const targetPos = heroIcons[targetIdx];
          enemyAction.targetX = targetPos ? targetPos.x : (enemy.originX - 120);
        }
        if (enemyAction.forwardX == null) {
          const distToTarget = Math.abs((enemyAction.targetX ?? enemy.originX) - enemy.originX);
          const lungeDist = Math.max(40, Math.min(110, distToTarget * 0.45));
          enemyAction.forwardX = enemy.originX - lungeDist;
        }
        if (enemyAction.anticipationX == null) {
          const dir = Math.sign((enemyAction.forwardX ?? enemy.originX) - enemy.originX) || -1;
          enemyAction.anticipationX = enemy.originX - (dir * 6);
        }
        const moveToward = (cur, target, speed, dtSec) => {
          if (cur === target) return cur;
          const delta = target - cur;
          const step = Math.sign(delta) * speed * dtSec;
          if (Math.abs(step) >= Math.abs(delta)) return target;
          return cur + step;
        };
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
        const easeInCubic = (t) => t * t * t;
        const easeInOutCubic = (t) =>
          t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        if (enemyAction.state === 'ADVANCE') {
          // Anticipation (small reverse)
          enemyAction.timer += dt;
          const t = Math.min(1, enemyAction.timer / Math.max(0.001, anticipationDur));
          const e = easeInCubic(t);
          const from = enemy.originX;
          const to = enemyAction.anticipationX ?? enemy.originX;
          enemy.x = from + (to - from) * e;
          if (t >= 1) {
            enemyAction.state = 'LUNGE';
            enemyAction.timer = 0;
          }
        } else if (enemyAction.state === 'LUNGE') {
          enemyAction.timer += dt;
          const t = Math.min(1, enemyAction.timer / Math.max(0.001, lungeDur));
          const e = easeOutCubic(t);
          const from = enemyAction.anticipationX ?? enemy.originX;
          const to = enemyAction.forwardX ?? enemy.originX;
          enemy.x = from + (to - from) * e;
          if (!enemyAction.actionApplied && t >= 1) {
            enemyAction.actionApplied = true;
            callFunctionWithContext(fnContext, 'ApplyEnemySkill', enemyAction.uid, enemyAction.skillId, enemyAction.targetUID);
          }
          if (t >= 1) {
            enemyAction.state = 'HIT';
            enemyAction.timer = 0;
          }
        } else if (enemyAction.state === 'HIT') {
          enemyAction.timer += dt;
          enemy.x = enemyAction.forwardX ?? enemy.originX;
          if (enemyAction.timer >= impactHold) {
            enemyAction.state = 'RETREAT';
            enemyAction.timer = 0;
          }
        } else if (enemyAction.state === 'RETREAT') {
          enemyAction.timer += dt;
          const t = Math.min(1, enemyAction.timer / Math.max(0.001, retreatDur));
          const e = easeInOutCubic(t);
          const from = enemyAction.forwardX ?? enemy.originX;
          const to = enemy.originX;
          enemy.x = from + (to - from) * e;
          if (t >= 1) {
            enemy.x = enemy.originX;
            enemyAction.state = 'DONE';
          }
        }
        if (enemyAction.state === 'DONE') {
          enemyAction.active = false;
          enemy.x = enemy.originX ?? enemy.x;
          enemy.y = enemy.originY ?? enemy.y;
          state.globals.IsPlayerBusy = 0;
          state.globals.ActionLockUntil = (state.globals.time || 0) + 0.35;
          state.globals.DeferAdvance = 1;
          callFunctionWithContext(fnContext, 'TryGrantSpeedExtraTurn', enemyAction.uid);
        }
      }
    }

    gameState.buffRollTimer = 0;
    gameState._lastBuffRollActive = 0;

    // Buff progress bar expiry
    if (state.globals.BuffProgActive && state.globals.time >= (state.globals.BuffProgEndAt || 0)) {
      state.globals.BuffProgActive = 0;
      state.globals.BuffProgSlot = -1;
    }
    // Dynamically filter overlay elements based on current state
    const overlayElements = new Set(['UI_CloseWin', 'UI_NavCloseButton', 'UI_NavCloseX']);
    const debugElements = new Set(['newdebugger', 'newdebugger2', 'InputBlocker', 'EnemyKeyList', 'KillCounter', 'turnTracker', 'Chain_Tracker', 'txtPhaseInfo']);
    const buffIcons = new Set(['buffIcon1', 'buffIcon2', 'buffIcon3', 'buffIcon4', 'buffIcon5']);

    // Position heroSelect under the current hero turn (Heroes.X, Heroes.Y+35)
    const heroSelectInst = rendered.find(r => r.inst.type === 'heroSelect');
    if (heroSelectInst) {
      let heroIndex = gameState.selectedHero || 0;
      const currentHeroUID = state.globals.CurrentHeroUID || 0;
      if (currentHeroUID) {
        const hero = state.entities.find(e => e.kind === 'hero' && e.uid === currentHeroUID);
        if (hero && hero.heroIndex != null) heroIndex = hero.heroIndex;
      }
      const iconType = ['icon_hero1', 'icon_hero2', 'icon_hero3', 'icon_hero4'][heroIndex] || 'icon_hero1';
      const heroIcon = rendered.find(r => r.inst.type === iconType);
      if (heroIcon) {
        heroSelectInst.world.x = heroIcon.world.x;
        heroSelectInst.world.y = (heroIcon.world.y || 0) + 35;
      }
    }
    
    // Center the close button + X on the layout viewport
    const closeBtn = rendered.find(r => r.inst.type === 'UI_NavCloseButton');
    const closeX = rendered.find(r => r.inst.type === 'UI_NavCloseX');
    if (closeBtn) {
      closeBtn.world.x = layoutW / 2;
    }
    if (closeX) {
      closeX.world.x = layoutW / 2;
      if (closeBtn) closeX.world.y = closeBtn.world.y;
    }

    const filteredRendered = rendered.filter(r => {
      // Hide overlay elements when overlay is not visible
      if(!gameState.overlayVisible && overlayElements.has(r.inst.type)){
        return false;
      }
      if(buffIcons.has(r.inst.type)) {
        const slotIndex = { buffIcon1: 0, buffIcon2: 1, buffIcon3: 2, buffIcon4: 3, buffIcon5: 4 }[r.inst.type];
        const frames = state.globals.BuffFrames || [];
        const frame = frames[slotIndex];
        if (frame == null || frame < 0) return false;
        buffIconFrames[r.inst.type] = frame;
      }
      // Hide debug and nav text elements (we'll render clean nav labels instead)
      if(debugElements.has(r.inst.type)){
        return false;
      }
      // Compute scaled bounds for this frame
      const pos = worldToCanvas(r.world.x || 0, r.world.y || 0);
      const drawW = (r.world.width || 64) * layoutScale;
      const drawH = (r.world.height || 64) * layoutScale;
      r.w = drawW;
      r.h = drawH;
      if (r.inst.type === 'UI_NavCloseButton' || r.inst.type === 'UI_NavCloseX') {
        const center = worldToCanvas(layoutW / 2, r.world.y || 0);
        r.dx = center.x - drawW * 0.5;
        r.dy = center.y - drawH * 0.5;
      } else if (r.inst.type === 'AddMore') {
        r.dx = pos.x - drawW * r.ox;
        r.dy = pos.y - drawH * r.oy - (10 * layoutScale);
      } else {
        r.dx = pos.x - drawW * r.ox;
        r.dy = pos.y - drawH * r.oy;
      }
      return true;
    });
    
    // Debug: Log filter results
    if (gameState.overlayVisible !== lastOverlayState) {
      console.log(`[FILTER] overlayVisible=${gameState.overlayVisible}, filteredRendered=${filteredRendered.length} items`);
      lastOverlayState = gameState.overlayVisible;
    }
    
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#fafafa'; ctx.fillRect(0,0,canvas.width,canvas.height);
    
    // Map layer names to color coding
    const layerColors = {
      'Background': '#d4a574',    // tan/brown for ground
      'BoardBG': '#f4f9a6',       // light yellow for board
      'Hero_Pics': '#87ceeb',     // sky blue for heroes
      'Game': '#ffcccc',          // light red for game objects
      'UI': '#90ee90',            // light green for UI
      'Window Popup': '#dda0dd',  // plum for popups
      'Resource BKG': '#f0e68c',  // khaki for resources
      'GemBG': '#ffa500'          // orange for gems
    };
    
    // Separate modal and non-modal objects for proper z-ordering
    const isModalObject = (type) => ['UI_CloseWin', 'UI_NavCloseButton', 'UI_NavCloseX'].includes(type);
    const navTextTypes = new Set(['Nav_HeroText', 'Nav_MapText', 'Nav_MissionText', 'Nav_AstralFlowText', 'Nav_HomeText']);
    const navTopTypes = new Set([...navTextTypes, 'AddMore']);
    const extraTrackTypes = new Set(['track_nextplus1', 'track_nextplus2', 'track_nextplus3', 'track_nextplus4', 'track_nextplus5']);
    const presentTrackOffsets = new Set(
      rendered
        .filter(r => extraTrackTypes.has(r.inst.type))
        .map(r => ({
          track_nextplus1: 1,
          track_nextplus2: 2,
          track_nextplus3: 3,
          track_nextplus4: 4,
          track_nextplus5: 5
        }[r.inst.type]))
        .filter(v => typeof v === 'number')
    );
    const allExtraPresent = [1,2,3,4,5].every(n => presentTrackOffsets.has(n));
    const NAV_BACKER_UID = 10; // navBacker (keep JSON unchanged)
    const scaleFont = (size) => Math.max(8, Math.round(size * layoutScale));
    const navFontBoost = Math.max(2, Math.round(2 * layoutScale));

    const modalRendered = filteredRendered.filter(r => isModalObject(r.inst.type));
    const modalPlane = modalRendered.find(r => r.inst.type === 'UI_CloseWin');
    const closeBtnRender = modalRendered.find(r => r.inst.type === 'UI_NavCloseButton');
    const closeXRender = modalRendered.find(r => r.inst.type === 'UI_NavCloseX');
    const navBacker = filteredRendered.find(r => r.uid === NAV_BACKER_UID) || null;
    const navTopRendered = gameState.overlayVisible ? filteredRendered.filter(r => navTopTypes.has(r.inst.type)) : [];

    const nonModalRendered = filteredRendered.filter(r =>
      !isModalObject(r.inst.type) &&
      !(gameState.overlayVisible && (navTopTypes.has(r.inst.type) || (navBacker && r.uid === navBacker.uid)))
    );
    const closeBtnCenter = closeBtnRender ? { x: closeBtnRender.dx + closeBtnRender.w / 2, y: closeBtnRender.dy + closeBtnRender.h / 2 } : null;
    
    const drawBasicItem = (r) => {
      if (!r) return;
      ctx.save();
      const img = r.img;
      if(img){
        ctx.drawImage(img, r.dx, r.dy, r.w, r.h);
      } else if(r.isButton){
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(r.dx, r.dy, r.w, r.h);
        ctx.fillStyle = '#666';
        ctx.lineWidth = 2;
        ctx.strokeRect(r.dx, r.dy, r.w, r.h);
        ctx.fillStyle = '#111';
        ctx.font = `bold ${scaleFont(14)}px sans-serif`;
        ctx.textAlign = 'center';
        const label = r.textContent || r.inst.type || 'Button';
        ctx.fillText(label, r.dx + r.w / 2, r.dy + r.h / 2 + 5);
      } else if(r.isText){
        const baseSize = r.inst.properties && r.inst.properties.size ? r.inst.properties.size : 12;
        const fontSize = scaleFont(baseSize) + (navTextTypes.has(r.inst.type) ? navFontBoost : 0);
        const fontColor = r.inst.properties && r.inst.properties.color ?
          `rgb(${Math.round(r.inst.properties.color[0]*255)}, ${Math.round(r.inst.properties.color[1]*255)}, ${Math.round(r.inst.properties.color[2]*255)})` : '#111';
        ctx.fillStyle = fontColor;
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        const text = r.textContent || r.inst.type;
        ctx.fillText(text, r.dx + r.w/2, r.dy + r.h/2 + 5);
      } else {
        const layerColor = layerColors[r.layerName] || '#ddd';
        ctx.fillStyle = layerColor;
        ctx.fillRect(r.dx, r.dy, r.w, r.h);
        ctx.strokeStyle = layerColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(r.dx, r.dy, r.w, r.h);
      }
      ctx.restore();
    };

    // No roulette rendering; buff icons use pop-in emphasis only
    const popDuration = 0.22;
    const popScale = (t) => {
      const x = Math.max(0, Math.min(1, t));
      if (x < 0.5) return 1 + (1.35 - 1) * (x / 0.5);
      if (x < 0.8) return 1.35 + (0.90 - 1.35) * ((x - 0.5) / 0.3);
      return 0.90 + (1 - 0.90) * ((x - 0.8) / 0.2);
    };

    // Draw non-modal objects first
    for(const r of nonModalRendered){
      const img = r.img;
      if(img){
        const frameIdx = buffIcons.has(r.inst.type) ? (buffIconFrames[r.inst.type] || 0) : null;
        if (frameIdx != null && buffIconFrameImages[r.inst.type] && buffIconFrameImages[r.inst.type][frameIdx]) {
          let scale = 1;
          if (buffIcons.has(r.inst.type)) {
            const popType = state.globals.BuffIconPopType;
            const popAt = state.globals.BuffIconPopAt;
            if (popType != null && popAt != null && popType === frameIdx) {
              const t = (state.globals.time - popAt) / popDuration;
              if (t >= 0 && t <= 1) scale = popScale(t);
            }
          }
          if (scale !== 1) {
            const cx = r.dx + r.w / 2;
            const cy = r.dy + r.h / 2;
            const w = r.w * scale;
            const h = r.h * scale;
            ctx.drawImage(buffIconFrameImages[r.inst.type][frameIdx], cx - w/2, cy - h/2, w, h);
          } else {
            ctx.drawImage(buffIconFrameImages[r.inst.type][frameIdx], r.dx, r.dy, r.w, r.h);
          }
        } else {
          ctx.drawImage(img, r.dx, r.dy, r.w, r.h);
        }
      } else if(r.isButton){
        // Render buttons with a distinct button style
        ctx.fillStyle = '#e8e8e8';  // button gray
        ctx.fillRect(r.dx, r.dy, r.w, r.h);
        ctx.fillStyle = '#666';     // darker border
        ctx.lineWidth = 2;
        ctx.strokeRect(r.dx, r.dy, r.w, r.h);
      } else if(r.isText) {
        // Text objects render without placeholder background
      } else {
        // Use layer-specific color for placeholder boxes
        const layerColor = layerColors[r.layerName] || '#ddd';
        ctx.fillStyle = layerColor; 
        ctx.fillRect(r.dx, r.dy, r.w, r.h);
        // Draw border with layer color
        ctx.strokeStyle = layerColor; 
        ctx.lineWidth = 2;
        ctx.strokeRect(r.dx, r.dy, r.w, r.h);
      }
      
      // Draw text label
      ctx.fillStyle = '#111';
      if(r.isButton){
        ctx.font = `bold ${scaleFont(14)}px sans-serif`;
      } else {
        ctx.font = `${scaleFont(12)}px sans-serif`;
      }
      ctx.textAlign = 'center';
      
      if(r.inst.type === 'UI_NavCloseX') {
        // Render the X centered on the close button circle
        const size = closeBtnRender ? Math.min(closeBtnRender.w, closeBtnRender.h) * 0.6 : Math.min(r.w, r.h) * 0.6;
        ctx.fillStyle = '#111';
        ctx.font = `bold ${Math.max(12, Math.round(size))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const cx = closeBtnCenter ? closeBtnCenter.x : (r.dx + r.w/2);
        const cy = closeBtnCenter ? closeBtnCenter.y : (r.dy + r.h/2);
        ctx.fillText('X', cx, cy);
        ctx.textBaseline = 'alphabetic';
      } else if(r.isText){
        const baseSize = r.inst.properties && r.inst.properties.size ? r.inst.properties.size : 12;
        const fontSize = scaleFont(baseSize) + (navTextTypes.has(r.inst.type) ? navFontBoost : 0);
        ctx.font = `${fontSize}px sans-serif`;
        // Draw actual text content (extracted or generated label)
        let text = r.textContent || '[Text]';
        if (r.inst.type === 'BuffText') {
          text = state.globals.BuffText || '';
        } else if (r.inst.type === 'ActorIntent') {
          text = state.globals.ActorIntent || text;
          ctx.textAlign = 'left';
          ctx.fillText(text, r.dx + 4, r.dy + r.h/2 + 5);
          continue;
        } else if (['CombatAction', 'CombatAction1', 'CombatAction2', 'CombatAction3'].includes(r.inst.type)) {
          const lines = state.globals.CombatActionLines || ['', '', '', ''];
          const idx = { CombatAction: 0, CombatAction1: 1, CombatAction2: 2, CombatAction3: 3 }[r.inst.type];
          const fallback = 'What happened?';
          text = lines[idx] || fallback;
          ctx.textAlign = 'left';
          ctx.fillText(text, r.dx + 4, r.dy + r.h/2 + 5);
          continue;
        } else if (r.inst.type === 'PartyHP_text') {
          const cur = state.globals.PartyHP ?? 0;
          const max = state.globals.PartyMaxHP ?? 0;
          text = `${cur} / ${max}`;
          const offsetX = -15 * layoutScale;
          ctx.fillText(text, r.dx + r.w/2 + offsetX, r.dy + r.h/2 + 5);
          continue;
        } else if (r.inst.type === 'Text_Energy') {
          const energy = state.globals.Player_Energy ?? 0;
          const maxEnergy = state.globals.Player_maxEnergy ?? 0;
          text = `${energy}/${maxEnergy}`;
          const refillRender = filteredRendered.find(r2 => r2.inst.type === 'AddMore') || rendered.find(r2 => r2.inst.type === 'AddMore');
          const centerX = layoutOffsetX + (layoutW * layoutScale) / 2;
          const y = refillRender ? (refillRender.dy + refillRender.h + (20 * layoutScale)) : (r.dy + r.h/2);
          ctx.fillStyle = '#ffd200';
          ctx.textAlign = 'center';
          ctx.fillText(text, centerX, y + 5);
          continue;
        } else if (r.inst.type === 'Text_Gold') {
          const gold = state.globals.goldTotal ?? 0;
          text = `Gold: ${gold}`;
        } else if (['track_next', 'track_nextplus1', 'track_nextplus2', 'track_nextplus3', 'track_nextplus4', 'track_nextplus5'].includes(r.inst.type)) {
          const order = state.globals.TurnOrderArray || [];
          const count = order.length;
          const baseIndex = state.globals.CurrentTurnIndex || 0;
          const offset = {
            track_next: 0,
            track_nextplus1: 1,
            track_nextplus2: 2,
            track_nextplus3: 3,
            track_nextplus4: 4,
            track_nextplus5: 5
          }[r.inst.type] || 0;
          if (count > 0) {
            const idx = (baseIndex + offset) % count;
            const row = order[idx];
            if (row) {
              const actor = state.entities.find(e => e.uid === row.uid);
              const label = actor ? (actor.name || '?') : '?';
              const baseSpd = actor ? Number(actor.stats?.SPD ?? actor.SPD ?? 0) : 0;
              const buff = actor && actor.kind === 'hero' ? (state.globals.PartyBuff_SPD || 0) : 0;
              const debuff = actor && actor.kind === 'enemy'
                ? (state.globals.EnemyDebuffs?.[actor.uid]?.SPD || 0)
                : 0;
              const curSpd = baseSpd + buff - debuff;
              const extraTag = row.extra ? ' (x2)' : '';
              const delta = actor && actor.kind === 'enemy'
                ? `(-${Math.round(debuff)})`
                : `(+${Math.round(buff)})`;
              text = `${label} ${Math.round(curSpd)}/${Math.round(baseSpd)} ${delta}${extraTag}`;
            } else {
              text = '';
            }
          } else {
            text = '';
          }
          ctx.textAlign = 'left';
          ctx.fillText(text, r.dx + 4, r.dy + r.h/2 + 5);
          if (r.inst.type === 'track_next' && !allExtraPresent) {
            const lineH = r.h || 14 * layoutScale;
            for (let i = 1; i <= 5; i++) {
              if (presentTrackOffsets.has(i)) continue;
              if (!count) break;
              const idx = (baseIndex + i) % count;
              const row = order[idx];
              if (!row) continue;
              const actor = state.entities.find(e => e.uid === row.uid);
              const label = actor ? (actor.name || '?') : '?';
              const baseSpd = actor ? Number(actor.stats?.SPD ?? actor.SPD ?? 0) : 0;
              const buff = actor && actor.kind === 'hero' ? (state.globals.PartyBuff_SPD || 0) : 0;
              const debuff = actor && actor.kind === 'enemy'
                ? (state.globals.EnemyDebuffs?.[actor.uid]?.SPD || 0)
                : 0;
              const curSpd = baseSpd + buff - debuff;
              const extraTag = row.extra ? ' (x2)' : '';
              const delta = actor && actor.kind === 'enemy'
                ? `(-${Math.round(debuff)})`
                : `(+${Math.round(buff)})`;
              const line = `${label} ${Math.round(curSpd)}/${Math.round(baseSpd)} ${delta}${extraTag}`;
              const y = r.dy + r.h/2 + 5 + lineH * i;
              ctx.fillText(line, r.dx + 4, y);
            }
          }
          continue;
        }
        if (text === 'What happen?') {
          text = 'What happened?';
        }
        if (['h1name','h2Hname','h3name','h4name'].includes(r.inst.type)) {
          const idx = { h1name: 0, h2Hname: 1, h3name: 2, h4name: 3 }[r.inst.type];
          const hero = state.entities.find(e => e.kind === 'hero' && e.heroIndex === idx);
          if (hero && hero.name) text = hero.name;
          ctx.fillStyle = '#ffd200';
        }
        ctx.fillText(text, r.dx + r.w/2, r.dy + r.h/2 + 5);
      } else if(r.isButton){
        // Draw button text (centered, bold)
        const text = r.textContent || r.inst.type;
        ctx.fillText(text, r.dx + r.w/2, r.dy + r.h/2 + 5);
      } else {
        let label = r.inst.type;
        if (['h1name','h2Hname','h3name','h4name'].includes(r.inst.type)) {
          const idx = { h1name: 0, h2Hname: 1, h3name: 2, h4name: 3 }[r.inst.type];
          const hero = state.entities.find(e => e.kind === 'hero' && e.heroIndex === idx);
          if (hero && hero.name) label = hero.name;
        }
        if (!r.isSprite && !['icon_hero1', 'icon_hero2', 'icon_hero3', 'icon_hero4', 'PartyHP_Bar'].includes(r.inst.type)) {
          ctx.fillText(label, r.dx + r.w/2, r.dy + r.h + 12);
        }
      }
    }

    // Nav labels are rendered via their text objects; no duplicate draw pass
    
    // Render gems on the board
    if (gameState.boardCreated && gameState.gems) {
      for (let i = 0; i < gameState.gems.length; i++) {
        const gem = gameState.gems[i];
        const g = boardGeometry;
        const pos = worldToCanvas(gem.x, gem.y);
        const gemW = gem.width * layoutScale;
        const gemH = gem.height * layoutScale;
        const gemX = pos.x - gemW * 0.5;
        const gemY = pos.y - gemH * 0.5;
        const frameIndex = (gem.color ?? 0) % 8;
        const gemImg = gemFrameImages[frameIndex];
        if (gemImg) {
          ctx.drawImage(gemImg, gemX, gemY, gemW, gemH);
        } else {
          // fallback circle if assets missing
          ctx.fillStyle = '#888';
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, gemW * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Draw selection highlight if selected
        if (gem.selected || (gem.flashUntil && gem.flashUntil > now)) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = gem.flashUntil && gem.flashUntil > now ? 3 : 2;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, gemW * 0.48, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // Party HP progress bar (use PartyHP_Bar instance)
    const partyBar = rendered.find(r => r.inst.type === 'PartyHP_Bar');
    if (partyBar) {
      const maxHP = Math.max(1, state.globals.PartyMaxHP || 1);
      const ratio = Math.max(0, Math.min(1, (state.globals.PartyHP || 0) / maxHP));
      const barX = partyBar.dx;
      const barY = partyBar.dy;
      const barW = partyBar.w;
      const barH = partyBar.h;
      ctx.fillStyle = '#0b0b0b';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#1e7bd6';
      ctx.fillRect(barX, barY, barW * ratio, barH);
      ctx.strokeStyle = '#0f0f0f';
      ctx.strokeRect(barX, barY, barW, barH);
    }

    // Enemy debuff icons (max 3 per enemy, tinted red)
    const debuffMap = { DEF: 'DEF', ATK: 'ATK', MAG: 'MAG', SPD: 'SPD', RES: 'RES' };
    const debuffSlotsByUID = state.globals.EnemyDebuffSlots || {};
    for (const enemy of state.entities.filter(e => e.kind === 'enemy' && (e.hp ?? 0) > 0)) {
      const slots = debuffSlotsByUID[enemy.uid] || [];
      if (!slots.length) continue;
      const g = state.globals;
      const slotIndex = enemy.slotIndex ?? 0;
      const spacing = g.Spacing || ((g.EnemySize || 40) + (g.enemyGAP || 8));
      const x = enemy.originX != null ? enemy.originX : (enemy.x != null ? enemy.x : (g.X0 || 200));
      const y = enemy.originY != null ? enemy.originY : (enemy.y != null ? enemy.y : (g.EnemyAreaY0 || 140) + slotIndex * spacing);
      const enemyOrig = enemySpriteImages[String(enemy.name || '').toLowerCase()];
      const origW = enemyOrig ? enemyOrig.width : 1;
      const origH = enemyOrig ? enemyOrig.height : 1;
      const enemyH = (g.EnemySize || 40) * layoutScale;
      const enemyW = enemyH * (origW / origH);
      const pos = worldToCanvas(x, y);
      const iconSize = Math.max(10, Math.round(16 * 0.8 * layoutScale));
      const baseX = pos.x + enemyW / 2 + (4 * layoutScale);
      const topY = pos.y - enemyH / 2;
      const bottomY = pos.y + enemyH / 2 - iconSize;
      const count = Math.min(3, slots.length);
      const yPositions = [];
      if (count === 1) {
        yPositions.push(topY);
      } else if (count === 2) {
        yPositions.push(topY, (topY + bottomY) / 2);
      } else if (count === 3) {
        yPositions.push(topY, (topY + bottomY) / 2, bottomY);
      }
      for (let i = 0; i < count; i++) {
        const stat = slots[i];
        const key = debuffMap[stat];
        const img = key ? debuffIconImages[key] : null;
        if (!img) continue;
        const x = baseX;
        const y = yPositions[i] ?? topY;
        let scale = 1;
        const pop = state.globals.EnemyDebuffPop;
        if (pop && pop.uid === enemy.uid && pop.stat === stat && pop.at != null) {
          const t = (state.globals.time - pop.at) / popDuration;
          if (t >= 0 && t <= 1) scale = popScale(t);
        }
        ctx.save();
        if (scale !== 1) {
          const cx = x + iconSize / 2;
          const cy = y + iconSize / 2;
          const w = iconSize * scale;
          const h = iconSize * scale;
          ctx.drawImage(img, cx - w/2, cy - h/2, w, h);
        } else {
          ctx.drawImage(img, x, y, iconSize, iconSize);
        }
        ctx.restore();
      }
    }

    if (state.globals.BattleStartActive) {
      const showUntil = state.globals.BattleStartEndsAt ?? 2.0;
      const fadeEnd = state.globals.BattleStartFadeEndsAt ?? (showUntil + 0.4);
      const t = state.globals.time || 0;
      const alpha = t <= showUntil ? 1 : Math.max(0, 1 - ((t - showUntil) / Math.max(0.001, fadeEnd - showUntil)));
      const text = state.globals.BattleStartText || '';
      if (text) {
        const centerX = layoutOffsetX + (layoutW * layoutScale) / 2;
        const baseY = partyBar ? (partyBar.dy - (20 * layoutScale)) : (layoutOffsetY + (layoutH * layoutScale) * 0.45);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#111';
        ctx.font = `${Math.round(18 * layoutScale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(text, centerX, baseY);
        ctx.restore();
      }
    }

    // Energy bar centered beneath REFILL button
    const refillRender = filteredRendered.find(r => r.inst.type === 'AddMore') || rendered.find(r => r.inst.type === 'AddMore');
    if (refillRender) {
      const centerX = layoutOffsetX + (layoutW * layoutScale) / 2;
      const barW = Math.max(60, refillRender.w * 0.8);
      const barH = Math.max(4, 6 * layoutScale);
      const barX = centerX - barW / 2;
      const barY = refillRender.dy + refillRender.h + (6 * layoutScale);
      const maxE = Math.max(1, state.globals.Player_maxEnergy || 1);
      const curE = Math.max(0, state.globals.Player_Energy || 0);
      const ratio = Math.max(0, Math.min(1, curE / maxE));
      ctx.fillStyle = '#111';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#A659A8';
      ctx.fillRect(barX, barY, barW * ratio, barH);
      ctx.strokeStyle = '#1a1a1a';
      ctx.strokeRect(barX, barY, barW, barH);
    }

    // Render enemies (use Enemy_Sprite animations)
    const enemiesToDraw = state.entities.filter(e => e.kind === 'enemy' && (e.hp ?? 0) > 0);
    if (enemiesToDraw.length) {
      const g = state.globals;
      const barBackImg = images['Bar_Back'] || null;
      const barFillImg = images['Bar_Fill'] || null;
      const barYellowImg = images['Bar_Yellow'] || null;
      const barQueue = [];
      for (const enemy of enemiesToDraw) {
        const slotIndex = enemy.slotIndex ?? 0;
        const spacing = g.Spacing || ((g.EnemySize || 40) + (g.enemyGAP || 8));
        const x = enemy.x != null ? enemy.x : (g.X0 || 200);
        const y = enemy.y != null ? enemy.y : (g.EnemyAreaY0 || 140) + slotIndex * spacing;
        const enemyOrig = enemySpriteImages[String(enemy.name || '').toLowerCase()];
        const origW = enemyOrig ? enemyOrig.width : 1;
        const origH = enemyOrig ? enemyOrig.height : 1;
        const enemyH = (g.EnemySize || 40) * layoutScale;
        const enemyW = enemyH * (origW / origH);
        const pos = worldToCanvas(x, y);
        const sprite = enemySpriteImages[String(enemy.name || '').toLowerCase()];
        if (sprite) {
          ctx.drawImage(sprite, pos.x - enemyW / 2, pos.y - enemyH / 2, enemyW, enemyH);
        } else {
          ctx.fillStyle = '#7d2b2b';
          ctx.fillRect(pos.x - enemyW / 2, pos.y - enemyH / 2, enemyW, enemyH);
          ctx.strokeStyle = '#fff';
          ctx.strokeRect(pos.x - enemyW / 2, pos.y - enemyH / 2, enemyW, enemyH);
        }

        // Queue enemy HP bars to draw above all enemies
        barQueue.push({ enemy, pos, enemyH, origH, enemyW });
      }
      for (const entry of barQueue) {
        const { enemy, pos, enemyH, origH, enemyW } = entry;
        const barKey = enemy.uid;
        let barState = enemyBars.get(barKey);
        const baseW = Math.max(20, enemyW * 0.9);
        const baseH = Math.max(3, (barFillImg ? barFillImg.height : 8) * (enemyH / origH));
        if (!barState) {
          barState = {
            baseW,
            fillW: baseW,
            yellowW: baseW,
          };
          enemyBars.set(barKey, barState);
        }
        const hpRatio = enemy.maxHP ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHP)) : 0;
        const targetW = barState.baseW * hpRatio;
        barState.fillW = Math.max(targetW, barState.fillW - 180 * dt);
        barState.yellowW = Math.max(targetW, barState.yellowW - 90 * dt);

        const barX = pos.x - barState.baseW / 2;
        const barY = (pos.y - enemyH / 2) - (10 * layoutScale);
        if (barBackImg) {
          ctx.drawImage(barBackImg, barX, barY, barState.baseW, baseH);
        } else {
          ctx.fillStyle = '#222';
          ctx.fillRect(barX, barY, barState.baseW, baseH);
        }
        if (barYellowImg) {
          ctx.drawImage(barYellowImg, barX, barY, barState.yellowW, baseH);
        } else {
          ctx.fillStyle = '#caa64b';
          ctx.fillRect(barX, barY, barState.yellowW, baseH);
        }
        if (barFillImg) {
          ctx.drawImage(barFillImg, barX, barY, barState.fillW, baseH);
        } else {
          ctx.fillStyle = '#e04b4b';
          ctx.fillRect(barX, barY, barState.fillW, baseH);
        }
      }
    }

    // Render attack selectors when awaiting target selection
    if (state.globals.PendingSkillID) {
      const selectorImg = images['Selector'] || null;
      const selectorAsset = assetSizes.Selector;
      const g = state.globals;
      const spacing = g.Spacing || ((g.EnemySize || 40) + (g.enemyGAP || 8));
      const center = Math.floor((g.Slots || 0) / 2);
      const pending = state.globals.PendingSkillID;
      const selectedUid = state.globals.SelectedEnemyUID || 0;
      const aliveEnemies = state.entities.filter(e => e.kind === 'enemy' && (e.hp ?? 0) > 0);
      const targets = pending === 'HERO_AOE'
        ? aliveEnemies
        : (selectedUid ? aliveEnemies.filter(e => e.uid === selectedUid) : aliveEnemies.slice(0, 1));

      for (const enemy of targets) {
        const slotIndex = enemy.slotIndex ?? 0;
        const spacing = g.Spacing || ((g.EnemySize || 40) + (g.enemyGAP || 8));
        const x = enemy.x != null ? enemy.x : (g.X0 || 200);
        const y = enemy.y != null ? enemy.y : (g.EnemyAreaY0 || 140) + slotIndex * spacing;
        const enemyOrig = enemySpriteImages[String(enemy.name || '').toLowerCase()];
        const origW = enemyOrig ? enemyOrig.width : 1;
        const origH = enemyOrig ? enemyOrig.height : 1;
        const enemyH = (g.EnemySize || 40) * layoutScale;
        const enemyW = enemyH * (origW / origH);
        const pos = worldToCanvas(x, y);
        if (selectorImg) {
          const selW = (selectorAsset ? selectorAsset.width : selectorImg.width) * layoutScale;
          const selH = (selectorAsset ? selectorAsset.height : selectorImg.height) * layoutScale;
          const selOx = selectorAsset ? selectorAsset.originX : 0.5;
          const selOy = selectorAsset ? selectorAsset.originY : 0.5;
          const targetX = pos.x;
          const targetY = pos.y - enemyH / 2 - (10 * layoutScale);
          ctx.drawImage(selectorImg, targetX - selW * selOx, targetY - selH * selOy, selW, selH);
        } else {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.rect(pos.x - enemyW / 2, pos.y - enemyH / 2, enemyW, enemyH);
          ctx.stroke();
        }
      }
    }

    // Render attack confirmation button when pending skill is set
    if (state.globals.PendingSkillID) {
      const btn = getAttackButtonBounds();
      if (btn.img) {
        ctx.drawImage(btn.img, btn.dx, btn.dy, btn.w, btn.h);
      } else {
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(btn.dx, btn.dy, btn.w, btn.h);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.strokeRect(btn.dx, btn.dy, btn.w, btn.h);
        ctx.fillStyle = '#111';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ATTACK', btn.dx + btn.w / 2, btn.dy + btn.h / 2 + 5);
      }
    }
    
    // Draw semi-transparent overlay when modal is visible (behind modal, on top of gameplay)
    if (gameState.overlayVisible) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw modal/nav stack in strict order
    if (gameState.overlayVisible) {
      if (modalPlane) drawBasicItem(modalPlane);
      if (closeBtnRender) drawBasicItem(closeBtnRender);
      if (closeXRender) drawBasicItem(closeXRender);
      if (navBacker) drawBasicItem(navBacker);
      for (const r of navTopRendered) {
        drawBasicItem(r);
      }
    } else {
      for(const r of modalRendered){
        drawBasicItem(r);
      }
    }

    // Render damage text above gameplay
    if (dmgTexts.length) {
      ctx.save();
      ctx.textAlign = 'center';
      const lerp = (a, b, t) => a + (b - a) * t;
      const lerpColor = (c0, c1, t) => {
        const r = Math.round(lerp(c0[0], c1[0], t));
        const g = Math.round(lerp(c0[1], c1[1], t));
        const b = Math.round(lerp(c0[2], c1[2], t));
        return `rgb(${r}, ${g}, ${b})`;
      };
      const heatColor = (h, ramp) => {
        if (h <= 0.33) return lerpColor(ramp[0], ramp[1], h / 0.33);
        if (h <= 0.66) return lerpColor(ramp[1], ramp[2], (h - 0.33) / 0.33);
        return lerpColor(ramp[2], ramp[3], (h - 0.66) / 0.34);
      };
      for (const d of dmgTexts) {
        const amount = Math.max(0, Number(d.amount) || 0);
        const amountT = Math.min(1, amount / 100);
        const amountScale = 0.8 + 0.45 * amountT; // 80% -> 125%
        const rise = Math.max(0.001, d.riseInSec || 0.18);
        const fade = Math.max(0.001, d.fadeSec || 0.45);
        let phaseScale = 1;
        let yOffset = 0;
        let alpha = 1;
        const peakScale = d.peakScale || 1.04;
        const heat = Math.max(0, Math.min(1, d.heat || 0));
        if (d.phase === 0) {
          const t = Math.min(1, (d.age || 0) / rise);
          const e = 1 - Math.pow(1 - t, 2); // easeOutQuad
          yOffset = 6 * (1 - e);
          alpha = Math.min(1, t / 0.6);
          if (t <= 0.7) {
            const u = t / 0.7;
            const eu = 1 - Math.pow(1 - u, 2);
            phaseScale = 0.90 + (peakScale - 0.90) * eu;
          } else {
            const u = (t - 0.7) / 0.3;
            const eu = 1 - Math.pow(1 - Math.min(1, u), 2);
            phaseScale = peakScale + (1.00 - peakScale) * eu;
          }
        } else if (d.phase === 2) {
          const t = Math.min(1, (d.age || 0) / fade);
          alpha = Math.max(0, 1 - t);
          phaseScale = 1;
        }
        const scale = amountScale * phaseScale;
        const baseFont = Math.max(12, Math.round(16 * layoutScale));
        const fontSize = Math.max(8, Math.round(baseFont * scale));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = Math.max(3, 6 * scale);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.globalAlpha = alpha;
        const text = String(d.amount);
        if (d.kind === 'heal') {
          const ramp = [
            [255, 255, 255],
            [184, 242, 166],
            [120, 220, 120],
            [120, 220, 220]
          ];
          ctx.fillStyle = heatColor(heat, ramp);
        } else {
          const ramp = [
            [255, 255, 255],
            [255, 235, 120],
            [255, 170, 80],
            [255, 80, 80]
          ];
          ctx.fillStyle = heatColor(heat, ramp);
        }
        const pos = worldToCanvas((d.x || 0) + 10, (d.baseY != null ? d.baseY : (d.y || 0)) + yOffset);
        ctx.fillText(text, pos.x, pos.y);
      }
      ctx.restore();
    }

    // draw HUD overlay (game state)
    drawHUD();
  }

  function drawHUD(){
    const lines = [
      baseSummary,
      '',
      `TurnPhase: ${state.globals.TurnPhase}`,
      `Board: ${gameState.boardCreated ? gameState.gems.length + ' gems' : 'waiting'}`,
      `Overlay: ${gameState.overlayVisible ? 'OPEN' : 'closed'}`,
    ];
    out.textContent = lines.join('\n');
  }
  drawFrame(); // initial render


  function getEnemyHit(mx, my) {
    const enemies = state.entities.filter(e => e.kind === 'enemy' && (e.hp ?? 0) > 0);
    if (!enemies.length) return null;
    const g = state.globals;
    for (const enemy of enemies) {
      const slotIndex = enemy.slotIndex ?? 0;
      const spacing = g.Spacing || ((g.EnemySize || 40) + (g.enemyGAP || 8));
      const center = Math.floor((g.Slots || 0) / 2);
      const x = enemy.x != null ? enemy.x : (g.X0 || 200) + (slotIndex - center) * spacing;
      const y = enemy.y != null ? enemy.y : (g.EnemyAreaY0 || 140) + slotIndex * spacing;
      const enemyOrig = enemySpriteImages[String(enemy.name || '').toLowerCase()];
      const origW = enemyOrig ? enemyOrig.width : 1;
      const origH = enemyOrig ? enemyOrig.height : 1;
      const enemyH = (g.EnemySize || 40) * layoutScale;
      const enemyW = enemyH * (origW / origH);
      const pos = worldToCanvas(x, y);
      if (mx >= pos.x - enemyW / 2 && mx <= pos.x + enemyW / 2 &&
          my >= pos.y - enemyH / 2 && my <= pos.y + enemyH / 2) {
        return enemy;
      }
    }
    return null;
  }

  // pointer handler for nav menu and overlay (more responsive than click)
  canvas.addEventListener('pointerdown', (ev)=>{
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;

    // REFILL click: use actual AddMore object bounds at click time
    const refillObj = rendered.find(r => r.inst.type === 'AddMore');
    if (refillObj) {
      const pos = worldToCanvas(refillObj.world.x || 0, refillObj.world.y || 0);
      const w = (refillObj.world.width || 60) * layoutScale;
      const h = (refillObj.world.height || 24) * layoutScale;
      const dx = pos.x - w * refillObj.ox;
      const dy = pos.y - h * refillObj.oy - (10 * layoutScale);
      const pad = 6 * layoutScale;
      if (mx >= dx - pad && mx <= dx + w + pad && my >= dy - pad && my <= dy + h + pad) {
        if (gameState.selectedGems.length > 0 || gameState.selectionLocked || state.globals.PendingSkillID || gameState.overlayVisible) {
          return;
        }
        refillGemBoard(gameState.gridBounds);
        syncFromGlobals();
        drawFrame();
        return;
      }
    }

    // Check nav label clicks using actual Nav_* text objects
    if (!(gameState.selectedGems.length > 0 || gameState.selectionLocked || state.globals.CanPickGems === false)) {
      const navTypes = new Set(['Nav_HeroText', 'Nav_MapText', 'Nav_MissionText', 'Nav_AstralFlowText', 'Nav_HomeText']);
      const navLabelItems = rendered.filter(r => navTypes.has(r.inst.type));
      for (const r of navLabelItems) {
        const pos = worldToCanvas(r.world.x || 0, r.world.y || 0);
        const w = Math.max(40, (r.world.width || 60) * layoutScale);
        const h = Math.max(16, (r.world.height || 20) * layoutScale);
        const dx = pos.x - w * r.ox;
        const dy = pos.y - h * r.oy;
        if (mx >= dx && mx <= dx + w && my >= dy && my <= dy + h) {
          gameState.overlayVisible = true;
          drawFrame();
          return;
        }
      }
    }

    // Pending hero attack: click an enemy to execute
    if (!gameState.overlayVisible && state.globals.PendingSkillID) {
      const btn = getAttackButtonBounds();
      if (mx >= btn.dx && mx <= btn.dx + btn.w && my >= btn.dy && my <= btn.dy + btn.h) {
        const actorUID = state.globals.PendingActor || getHeroUIDByIndex(gameState.selectedHero);
        callFunctionWithContext(fnContext, 'ExecuteSkill', state.globals.PendingSkillID, actorUID);
        state.globals.PendingSkillID = '';
        state.globals.PendingActor = 0;
        state.globals.SelectedEnemyUID = 0;
        callFunctionWithContext(fnContext, 'HideAttackUI');
        drawFrame();
        return;
      }
      const hit = getEnemyHit(mx, my);
      if (hit) {
        state.globals.SelectedEnemyUID = hit.uid;
        drawFrame();
        return;
      }
    }
    
    // Check for gem clicks (only if board is created and overlay is not visible)
    if (gameState.boardCreated && gameState.gems && !gameState.overlayVisible) {
      if (state.globals.CanPickGems === false || callFunctionWithContext(fnContext, 'IsHeroTurn') === false) {
        return;
      }
      for (let i = 0; i < gameState.gems.length; i++) {
        const gem = gameState.gems[i];
        const pos = worldToCanvas(gem.x, gem.y);
        const gemRadius = (gem.width * layoutScale) * 0.48;
        
        // Check if click is within gem circle
        const dx = mx - pos.x;
        const dy = my - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < gemRadius) {
          if (gem.color == null && gem.elementIndex != null) {
            gem.color = gem.elementIndex;
          }
          if (gem.color === 6) {
            handleSpecialGem6(gem);
            return;
          }
          if (gameState.selectionLocked && gameState.selectedGems.length < 3) {
            gameState.selectionLocked = false;
          }
          if (gameState.selectionLocked || gameState.selectedGems.length >= 3) {
            return;
          }
          
          // Toggle selection
          if (gem.selected) {
            gem.selected = false;
            gameState.selectedGems = gameState.selectedGems.filter(idx => idx !== i);
            gem.Selected = 0;
          } else {
            if (gameState.selectedGems.length >= 3) {
              return;
            }
            gem.selected = true;
            gameState.selectedGems.push(i);
            gem.Selected = 1;
            
            // Check if we have 3 selected gems of same color
            if (gameState.selectedGems.length === 3) {
              gameState.selectionLocked = true;
              const selectedColors = gameState.selectedGems.map(idx => {
                const gm = gameState.gems[idx];
                return (gm && gm.color != null) ? gm.color : (gm ? gm.elementIndex : null);
              });
              console.log(`[MATCH] Selected colors: ${selectedColors.join(',')}`);
              if (selectedColors.some(c => c == null)) {
                console.log('[MATCH] Invalid color detected, clearing selection');
              }
              if (selectedColors[0] === selectedColors[1] && selectedColors[1] === selectedColors[2] && !selectedColors.some(c => c == null)) {
                console.log(`[MATCH] 3 gems matched! Color: ${selectedColors[0]}`);
                handleGemMatch(selectedColors[0]);
              } else {
                console.log(`[MATCH] No match - colors: ${selectedColors.join(',')}`);
                const now = performance.now();
                for (const idx of gameState.selectedGems) {
                  const gm = gameState.gems[idx];
                  if (gm) gm.flashUntil = now + 250;
                }
                setTimeout(() => {
                  callFunctionWithContext(fnContext, 'ClearMatchState');
                  if (state.globals.Gems && Array.isArray(state.globals.Gems)) {
                    gameState.gems = state.globals.Gems;
                  }
                  gameState.selectedGems = [];
                  gameState.selectionLocked = false;
                  if (gameState.gems) {
                    for (const gm of gameState.gems) {
                      gm.selected = false;
                      gm.Selected = 0;
                    }
                  }
                  state.globals.TapIndex = 0;
                  drawFrame();
                }, 250);
              }
            }
          }

          state.globals.TapIndex = Math.min(3, gameState.selectedGems.length);
          setGemArray(gameState.gems);
          
          drawFrame();
          return;
        }
      }
    }
    
    // Check for rendered element clicks (REFILL button, close button, etc)
    // First check modal objects if overlay is visible
    if (gameState.overlayVisible) {
      const isModalObject = (type) => ['UI_CloseWin', 'UI_NavCloseButton', 'UI_NavCloseX'].includes(type);
      const modalObjs = rendered.filter(r => isModalObject(r.inst.type));
      for(const r of modalObjs){
        if(mx >= r.dx && mx <= r.dx + r.w && my >= r.dy && my <= r.dy + r.h){
          // Close button or surrounding button clicked - hide overlay
          if(r.inst.type === 'UI_NavCloseX' || r.inst.type === 'UI_NavCloseButton'){
            gameState.overlayVisible = false;
            drawFrame();
            return;
          }
        }
      }
    }
    
    for(const r of rendered){
      if(mx >= r.dx && mx <= r.dx + r.w && my >= r.dy && my <= r.dy + r.h){
        // REFILL button clicked
        if(r.inst.type === 'AddMore'){
          // Handle refill gem action
          refillGemBoard(gameState.gridBounds);
          syncFromGlobals();
          drawFrame();
          return;
        }
        // Other interactive elements
        return;
      }
    }
  }, { passive: true });

  // keyboard input handling
  window.addEventListener('keydown', (ev)=>{
    if(ev.key === 'ArrowLeft') gameState.selectedHero = Math.max(0, gameState.selectedHero - 1);
    if(ev.key === 'ArrowRight') gameState.selectedHero = Math.min(3, gameState.selectedHero + 1);
    if(ev.key === 'ArrowUp') gameState.selectedEnemy = Math.max(0, gameState.selectedEnemy - 1);
    if(ev.key === 'ArrowDown') gameState.selectedEnemy = Math.min(2, gameState.selectedEnemy + 1);
    if(ev.key === ' ') { gameState.playerTurn = !gameState.playerTurn; ev.preventDefault(); }
  });

  // per-frame tick loop with animation cycling
  let frameCount = 0;
  function tick(){
    frameCount++;
    if (state.globals.DeferAdvance && (state.globals.time || 0) >= (state.globals.ActionLockUntil || 0)) {
      if (state.globals.TextAnimating) {
        state.globals.ActionLockUntil = (state.globals.time || 0) + 0.1;
      } else {
        // Never auto-advance out of an active hero input turn
        if (!(state.globals.TurnPhase === 0 && state.globals.CanPickGems)) {
          state.globals.DeferAdvance = 0;
          callFunctionWithContext(fnContext, 'AdvanceTurn');
          callFunctionWithContext(fnContext, 'ProcessTurn');
        }
      }
    }
    // Enemy turns are started by ProcessTurn; avoid double-triggering here.
    gameState.enemyTurnKicked = state.globals.TurnPhase === 2;
    drawFrame();
    requestAnimationFrame(tick);
  }
  tick();
}

main().catch(err => {
  console.error('[ERROR] Initialization failed:', err);
  out.textContent = `🎮 Puzzle RPG\n\n⚠️ Initialization Error\n${err.message}`;
});
