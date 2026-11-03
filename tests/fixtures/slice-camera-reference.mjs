// Regenerate numeric expectations with the pinned Rust camera, using WFM's viewport.
// node tests/fixtures/slice-camera-reference.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const file = new URL('./slice-camera-stage7.json', import.meta.url);
const fixture = JSON.parse(fs.readFileSync(file));
const source = execFileSync('git', ['show', `${fixture.source}:experiments/rust-combat-mvp/crates/wf_client/src/camera.rs`], { encoding: 'utf8' });
// Rendering is outside this numeric oracle. Only viewport constants/DTOs change.
let camera = source.slice(0, source.indexOf('    /// Actor art')) + '}';
camera = camera.replace('use macroquad::prelude::*;', '').replace('use wf_sim::api::{ActorState, Event, Snapshot, Team};', 'use wf_sim::api::*;')
  .replace('HEIGHT: f32 = 640.', 'HEIGHT: f32 = 388.').replace('BAND_CENTRE: f32 = HEIGHT * 0.5', 'BAND_CENTRE: f32 = 236.')
  .replaceAll('576.', '430.').replaceAll('52.', '42.');
const prelude = `
use std::ops::{Add,Sub,Mul,Div};
#[derive(Clone,Copy,Debug,Default)] pub struct Vec2 { x:f32,y:f32 }
fn vec2(x:f32,y:f32)->Vec2 {Vec2{x,y}}
impl Vec2 {const ZERO:Self=Self{x:0.,y:0.};fn min(self,b:Self)->Self{vec2(self.x.min(b.x),self.y.min(b.y))} fn max(self,b:Self)->Self{vec2(self.x.max(b.x),self.y.max(b.y))} fn distance_squared(self,b:Self)->f32{(self.x-b.x).powi(2)+(self.y-b.y).powi(2)}}
impl Add for Vec2 {type Output=Self;fn add(self,b:Self)->Self{vec2(self.x+b.x,self.y+b.y)}}
impl Sub for Vec2 {type Output=Self;fn sub(self,b:Self)->Self{vec2(self.x-b.x,self.y-b.y)}}
impl Mul<f32> for Vec2 {type Output=Self;fn mul(self,b:f32)->Self{vec2(self.x*b,self.y*b)}}
impl Div<f32> for Vec2 {type Output=Self;fn div(self,b:f32)->Self{vec2(self.x/b,self.y/b)}}
mod macroquad {pub mod prelude {#[derive(Clone)] pub struct Rect;}}
mod render {pub mod actors {pub fn is_boss(b:bool)->bool{b}}}
mod wf_sim {pub mod api {use super::super::Vec2;
#[derive(Clone,Copy,PartialEq)] pub enum Team {Hero,Enemy}
#[derive(Clone,Copy,PartialEq)] pub enum ActorState {Spawn,Downed,Dead,Other}
#[derive(PartialEq)] pub enum HazardKind {SpawnMarker,Other}
pub struct Actor {pub id:u32,pub team:Team,pub hp:f32,pub state:ActorState,pub pos:Vec2,pub archetype:bool}
pub struct Hazard {pub kind:HazardKind,pub origin:Vec2}
pub struct Snapshot {pub camera_focus:Vec2,pub arena_min:Vec2,pub arena_max:Vec2,pub actors:Vec<Actor>,pub hazards:Vec<Hazard>}
pub enum Event {BossArrived{id:u32},WaveReset,SceneReset}
}}
`;
const num = n => `${Number(n).toFixed(9)}f32`;
const vec = p => `vec2(${num(p.x)},${num(p.y)})`;
let previous, body = 'fn main(){let mut c:Option<WorldCamera>=None;\n';
for (const { snapshot: s, dt } of fixture.frames) {
  const actors = s.actors.map(a => `Actor{id:${a.actor_id},team:Team::${a.team === 'hero' ? 'Hero' : 'Enemy'},hp:${num(a.hp)},state:ActorState::${({spawn:'Spawn',downed:'Downed',dead:'Dead'})[a.state] ?? 'Other'},pos:${vec(a.pos)},archetype:${a.kind.startsWith('boss')}}`).join(',');
  const hazards = s.hazards.map(h => `Hazard{kind:HazardKind::${h.kind === 'spawn_marker' ? 'SpawnMarker' : 'Other'},origin:${vec(h.origin)}}`).join(',');
  body += `{let s=Snapshot{camera_focus:${vec(s.camera_focus)},arena_min:${vec(s.geometry.floor.min)},arena_max:${vec(s.geometry.floor.max)},actors:vec![${actors}],hazards:vec![${hazards}]};`;
  if (previous !== s.encounter_id) body += 'c=Some(WorldCamera::new(&s));';
  previous = s.encounter_id;
  body += `let c=c.as_mut().unwrap();c.update(&s,${num(s.spotlight || s.hit_stop ? 0 : dt)});println!("{:.9} {:.9} {:.9}",c.centre.x,c.centre.y,c.zoom);}\n`;
}
body += '}';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slice-camera-'));
try {
  fs.writeFileSync(path.join(dir, 'reference.rs'), prelude + camera + body);
  execFileSync('rustc', ['--edition=2021', '-Awarnings', path.join(dir, 'reference.rs'), '-o', path.join(dir, 'reference')]);
  const output = execFileSync(path.join(dir, 'reference'), { encoding: 'utf8' }).trim().split('\n');
  fixture.frames.forEach((f, i) => { f.expected = output[i].split(' ').map(Number); });
  fixture.oracle = 'Unchanged camera.rs update/new; HEIGHT=388, BAND_CENTRE=236, useful Y=42..430; f32 output';
  const { frames, ...metadata } = fixture;
  fs.writeFileSync(file, JSON.stringify(metadata, null, 2).slice(0, -2) + ',\n  \"frames\": [\n' + frames.map(f => '    ' + JSON.stringify(f)).join(',\n') + '\n  ]\n}\n');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
