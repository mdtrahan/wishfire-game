// The slice presentation owns camera movement. UI reads its current focus.
export function resolveCombatCameraCenterX(globals = {}, fallbackX = 0) {
  return globals.RustCombatPresentation?.state.snapshot?.camera_focus?.x ?? fallbackX;
}
