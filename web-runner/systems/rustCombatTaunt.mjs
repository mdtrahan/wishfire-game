import { SLICE_ACTOR_HEIGHT } from './rustCombatArena.mjs';

export function drawTauntIcons(gpu, snapshot, camera) {
  const z = camera.zoom / .5;
  for (const actor of snapshot.actors) {
    if (actor.team !== 'enemy' || actor.hp <= 0 || actor.taunted_by == null) continue;
    const height = SLICE_ACTOR_HEIGHT * actor.scale * (actor.kind.startsWith('boss') ? 1 : .6) * camera.zoom;
    const grow = 1 + .35 * Math.sin(Math.PI * Math.min(actor.taunt_age / .2, 1));
    const bob = Math.sin(snapshot.time * 4) * 1.5 * z;
    gpu.bitmap('warn', 0, camera.x(actor.pos.x), camera.y(actor.pos.y) - height - 8 * z + bob,
      20 * z * grow, 20 * z * grow, 0, 1, 0xffdb80);
  }
}
