const finiteTime = value => Number.isFinite(Number(value)) ? Number(value) : 0;

// HP restoration owns this reset because a previously terminal cue must not
// outlive the actor it described. It is presentation-only state.
export function resetActorPresentationAfterRestore(actor, now = 0) {
  if (!actor || Number(actor.hp || 0) <= 0) return actor;
  delete actor.actionState;
  delete actor.actionFacing;
  delete actor.actionStateStartedAt;
  delete actor.actionImpactAt;
  delete actor.actionStateUntil;
  actor.locomotion = 'idle';
  actor.locomotionStartedAt = finiteTime(now);
  return actor;
}
