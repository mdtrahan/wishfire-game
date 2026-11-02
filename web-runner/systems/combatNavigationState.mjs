// Navigation suspends admission to the retained Rust world. Snapshots contain
// UI routing state only; no turn queue or combat RNG is serialized here.
export class CombatNavigationState {
  constructor({ combatState = {}, eventBus, layoutState } = {}) {
    this.combatState = combatState; this.eventBus = eventBus; this.layoutState = layoutState;
  }
  setLayoutState(value) { this.layoutState = value; }
  canAcceptEvents() { return this.combatState.acceptEvents !== false; }
  isInAtomicSection() { return false; }
  suspend() {
    this.combatState.inputEnabled = false; this.combatState.acceptEvents = false;
    const snapshot = { version: 1, paused: true };
    this.eventBus?.emit('combat:suspended', { snapshot });
    return snapshot;
  }
  resume(snapshot) {
    if (snapshot && snapshot.version !== 1) throw new Error('Invalid combat navigation snapshot');
    this.combatState.inputEnabled = true; this.combatState.acceptEvents = true;
    this.eventBus?.emit('combat:resumed', { restored: !!snapshot });
  }
  runCombatBootstrap(fn, ...args) { if (this.layoutState?.getActiveLayoutId() === 'combat') return fn?.(...args); }
  runCombatBoardInit(fn, ...args) { if (this.layoutState?.getActiveLayoutId() === 'combat') return fn?.(...args); }
}
