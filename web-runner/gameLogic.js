// Simple game state and logic for turn-based combat
export const gameState = {
  currentScreen: 'layout', // 'layout', 'combat', 'gem-match', etc.
  selectedHero: 0,
  selectedEnemy: 0,
  playerTurn: true,
  enemies: [],
  partyHP: { hero1: 42, hero2: 35, hero3: 30, hero4: 40 },
  partyMaxHP: { hero1: 42, hero2: 35, hero3: 30, hero4: 40 },
  enemyHP: [50, 60, 55],
  enemyMaxHP: [50, 60, 55],
};

export const input = {
  keys: {},
  mouse: { x: 0, y: 0, clicked: null }
};

export function updateInput(){
  // keyboard state is tracked in setupKeyboardListener
  // mouse state can be updated from canvas click events
}

export function setupKeyboardListener(window){
  window.addEventListener('keydown', (ev)=>{
    input.keys[ev.key] = true;
    handleKeyInput(ev.key);
  });
  window.addEventListener('keyup', (ev)=>{
    input.keys[ev.key] = false;
  });
}

function handleKeyInput(key){
  if(key === 'ArrowLeft') gameState.selectedHero = Math.max(0, gameState.selectedHero - 1);
  if(key === 'ArrowRight') gameState.selectedHero = Math.min(3, gameState.selectedHero + 1);
  if(key === 'ArrowUp') gameState.selectedEnemy = Math.max(0, gameState.selectedEnemy - 1);
  if(key === 'ArrowDown') gameState.selectedEnemy = Math.min(2, gameState.selectedEnemy + 1);
  if(key === ' ') gameState.playerTurn = !gameState.playerTurn;
}

export function tickGameLogic(){
  // apply game state changes per frame
  if(!gameState.playerTurn){
    // simple AI: random enemy attack after a delay
    gameState.playerTurn = true;
  }
}

export default { gameState, input, updateInput, setupKeyboardListener, tickGameLogic };
