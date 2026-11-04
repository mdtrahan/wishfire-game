//! Owner-approved v8 meshes. All positions and clocks are presentation-only.
use super::vfx3d::{self, Blend, Frame, Kind};
use macroquad::prelude::*;
use crate::assets::DrawStats;

pub const RELEASE: f64 = 0.450;
pub const TRAVEL: f32 = 0.120;
pub const FADE_START: f32 = 0.390;
const TAU: f32 = std::f32::consts::TAU;
fn s(x: f32) -> f32 { let x=x.clamp(0.,1.);x*x*(3.-2.*x) }
#[derive(Debug, PartialEq)]
pub enum Phase { Travel, Full, Fade }
pub fn phase(age: f64) -> Option<Phase> {
    if !(0. ..RELEASE).contains(&age) {None}
    else if age < TRAVEL as f64 {Some(Phase::Travel)}
    else if age < FADE_START as f64 {Some(Phase::Full)} else {Some(Phase::Fade)}
}
/// Pure projection of the v8 torso offsets. Scale follows camera zoom, not boss sprite size.
pub fn sockets(torso: Vec2, facing_left: bool, scale: f32) -> (Vec2,Vec2) {
    let x=if facing_left {-1.}else{1.};
    (torso+vec2(7.*x,26.)*scale,torso+vec2(14.*x,29.)*scale)
}
#[derive(Clone, Copy)]
pub struct Lane {pub root:Vec2,pub end:Vec2,pub width:f32,pub scale:f32,pub twin:bool}
struct Meshes {energy:Frame,ink:Frame,axis:Vec2,side:Vec2,root:Vec2,scale:f32}
impl Meshes {
    fn new(lane:Lane,age:f32,seed:u32)->Self {
        let axis=(lane.end-lane.root).normalize_or_zero();
        let mut energy=Frame::default();energy.time=age;energy.seed=(seed%997) as f32/37.;
        let mut ink=Frame::default();ink.time=age;ink.seed=energy.seed;
        Self {energy,ink,
            axis,side:vec2(-axis.y,axis.x),root:lane.root,scale:lane.scale}
    }
    fn tri(&mut self,p:[Vec3;3],normals:[Vec3;3],uv:[Vec2;3],tint:Vec3,alpha:f32,kind:Kind,extra:f32) {
        if alpha<=0.0001 {return}
        // Front surfaces only; Alpha materials preserve the source's depth-write-off layering.
        if normals.iter().map(|n|n.z).sum::<f32>() < -0.001 {return}
        let pos=p.map(|p| {let xy=self.root+(self.axis*p.x+self.side*p.y)*self.scale;vec3(xy.x,xy.y,-p.z*0.00001)});
        let normals=normals.map(|n| vec4(self.axis.x*n.x+self.side.x*n.y,-self.axis.y*n.x-self.side.y*n.y,n.z,extra));
        let gain=tint.max_element().max(1.);
        let color=Color::new(tint.x/gain,tint.y/gain,tint.z/gain,alpha.clamp(0.,1.));
        let normals=if matches!(kind,Kind::DjinnBillow|Kind::DjinnArc|Kind::DjinnSpark|Kind::DjinnGlow) {normals.map(|mut n|{n.w=gain;n})} else {normals};
        let ink=matches!(kind,Kind::DjinnInk|Kind::DjinnVein);
        let blend=if matches!(kind,Kind::DjinnShell|Kind::DjinnArc|Kind::DjinnSpark|Kind::DjinnGlow) {Blend::Add}else{Blend::Alpha};
        let frame=if ink {&mut self.ink}else{&mut self.energy};
        frame.tri(pos,uv,[color;3],normals,kind,blend);
    }
    fn sphere(&mut self,centre:Vec3,size:Vec3,rotation:Quat,tint:Vec3,alpha:f32,kind:Kind) {
        for face in vfx3d::icosahedron(1) {
            let points=face.map(|p|rotation*p);
            let normal=(points[1]-points[0]).cross(points[2]-points[0]).normalize();
            let uv=points.map(|p|vec2(p.x.atan2(p.z)/TAU+0.5,p.y*0.5+0.5));
            self.tri(points.map(|p|centre+p*size),[normal;3],uv,tint,alpha,kind,1.);
        }
    }
    fn tube(&mut self,length:f32,radius:f32,twin:bool,fade:f32,kind:Kind,alpha:f32) {
        for j in 0..24 {for i in 0..10 {
            let point=|j:usize,i:usize| {
                let u=j as f32/24.;let a=i as f32/10.*TAU;
                let spindle=if kind==Kind::DjinnInk {(std::f32::consts::PI*u).sin().max(0.).powf(0.82)*(0.94+0.06*(u*31.+(self.energy.time+7./3.)*0.8).sin())}
                    else if twin {0.18+0.82*s(u*length/28.)}else{1.};
                let thin=if kind==Kind::DjinnInk {1.-fade*0.12}else{1.-fade*0.20};
                (vec3(u*length,a.cos()*radius*spindle*thin,a.sin()*radius*spindle*thin),vec3(0.,a.cos(),a.sin()),vec2(u*length,a/TAU))
            };
            let q=[point(j,i),point(j+1,i),point(j+1,i+1),point(j,i+1)];
            for ids in [[0,1,2],[0,2,3]] {self.tri(ids.map(|k|q[k].0),ids.map(|k|q[k].1),ids.map(|k|q[k].2),Vec3::ONE,alpha,kind,length);}
        }}
    }
    fn cone(&mut self,base:Vec3,direction:Vec3,r:f32,length:f32,sides:usize,tint:Vec3,alpha:f32) {
        let q=Quat::from_rotation_arc(Vec3::Y,direction.normalize());
        for i in 0..sides {
            let a=i as f32/sides as f32*TAU;let b=(i+1) as f32/sides as f32*TAU;
            let p=[vec3(a.cos()*r,0.,a.sin()*r),vec3(0.,length,0.),vec3(b.cos()*r,0.,b.sin()*r)].map(|p|base+q*p);
            let n=(p[1]-p[0]).cross(p[2]-p[0]).normalize();
            self.tri(p,[n;3],[Vec2::splat(0.5);3],tint,alpha,Kind::DjinnSpark,1.);
        }
    }
    fn cap(&mut self,x:f32,radius:f32,fade:f32,alpha:f32) {
        for j in 0..5 {for i in 0..10 {
            let point=|j:usize,i:usize| {
                let a=j as f32/5.*std::f32::consts::FRAC_PI_2;let b=i as f32/10.*TAU;
                let n=vec3(a.cos(),a.sin()*b.cos(),a.sin()*b.sin());
                (vec3(x,0.,0.)+n*vec3(radius*0.42,radius*(1.-fade*0.86),radius*(1.-fade*0.86)),n,vec2(a,b))
            };
            let q=[point(j,i),point(j+1,i),point(j+1,i+1),point(j,i+1)];
            for ids in [[0,1,2],[0,2,3]] {self.tri(ids.map(|k|q[k].0),ids.map(|k|q[k].1),ids.map(|k|q[k].2),Vec3::ONE,alpha,Kind::DjinnCap,1.);}
        }}
    }
    fn tetra(&mut self,p:Vec3,size:Vec3,rotation:Quat,tint:Vec3,alpha:f32) {
        let vs=[vec3(1.,1.,1.),vec3(-1.,-1.,1.),vec3(-1.,1.,-1.),vec3(1.,-1.,-1.)].map(|v|p+rotation*(v.normalize()*size));
        for ids in [[2,1,0],[0,3,2],[1,3,0],[2,3,1]] {
            let p=ids.map(|k|vs[k]);let n=(p[1]-p[0]).cross(p[2]-p[0]).normalize();
            self.tri(p,[n;3],[Vec2::splat(0.5);3],tint,alpha,Kind::DjinnSpark,1.);
        }
    }
    fn arc(&mut self,x:f32,r:f32,rotation:f32,alpha:f32) {
        for j in 0..22 {for k in 0..4 {
            let point=|j:usize,k:usize| {
                let a=j as f32/22.*std::f32::consts::PI*1.22+rotation;let b=k as f32/4.*TAU;
                let n=vec3(b.sin(),a.cos()*b.cos(),a.sin()*b.cos());
                (vec3(x,a.cos()*r,a.sin()*r)+n*3.5,n,vec2(a,b))
            };
            let q=[point(j,k),point(j+1,k),point(j+1,k+1),point(j,k+1)];
            for ids in [[0,1,2],[0,2,3]] {self.tri(ids.map(|k|q[k].0),ids.map(|k|q[k].1),ids.map(|k|q[k].2),vec3(1.15,0.14,3.3),alpha,Kind::DjinnArc,1.);}
        }}
    }
    fn vein(&mut self,points:[Vec3;5],alpha:f32) {
        for segment in points.windows(2) {
            let a=segment[0];let b=segment[1];let q=Quat::from_rotation_arc(Vec3::X,(b-a).normalize());
            for i in 0..4 {
                let a0=i as f32/4.*TAU;let a1=(i+1) as f32/4.*TAU;
                let n0=q*vec3(0.,a0.cos(),a0.sin());let n1=q*vec3(0.,a1.cos(),a1.sin());
                let ps=[a+n0*0.68,b+n0*0.68,b+n1*0.68,a+n1*0.68];
                for ids in [[0,1,2],[0,2,3]] {self.tri(ids.map(|k|ps[k]),ids.map(|k|if k<2 {n0}else{n1}),[Vec2::ZERO;3],Vec3::ONE,alpha,Kind::DjinnVein,1.);}
            }
        }
    }
    fn glow(&mut self,p:Vec2,size:Vec2,tint:Vec3,alpha:f32) {
        let ps=[vec2(-0.5,-0.5),vec2(0.5,-0.5),vec2(0.5,0.5),vec2(-0.5,0.5)];
        for ids in [[0,1,2],[0,2,3]] {self.tri(ids.map(|k| (p+ps[k]*size).extend(-20.)),[Vec3::Z;3],ids.map(|k|ps[k]+Vec2::splat(0.5)),tint,alpha,Kind::DjinnGlow,1.);}
    }
    fn draw(self,stats:&mut DrawStats) {self.energy.draw_bloom(stats);self.ink.draw(stats);}
}

pub fn charge(globe:Vec2,progress:f32,scale:f32,seed:u32,stats:&mut DrawStats) {
    let mut m=Meshes::new(Lane{root:globe,end:globe+Vec2::X,width:45.,scale,twin:false},(progress-1.)*7./3.,seed);
    globe_mesh(&mut m,Vec3::ZERO,progress,1.);m.draw(stats);
}
fn globe_mesh(m:&mut Meshes,centre:Vec3,progress:f32,alpha:f32) {
    let t=m.energy.time+7./3.;let r=(8.+54.*s(progress))*0.5;
    let rotation=Quat::from_rotation_y(t*0.45);
    m.sphere(centre,Vec3::splat(r*0.38),rotation,Vec3::ONE,alpha,Kind::DjinnHot);
    m.sphere(centre,Vec3::splat(r),rotation,Vec3::ONE,alpha,Kind::DjinnGlobe);
    m.sphere(centre,Vec3::splat(r*1.045),rotation,Vec3::ONE,alpha,Kind::DjinnShell);
    for i in 0..8 {
        let i=i as f32;let a=i*TAU/8.+0.12*(i*4.1).sin();let dir=vec3(a.cos(),a.sin(),(i*1.7).sin()*0.25).normalize();
        let len=10.+14.*(0.5+0.5*(t*26.+i*2.7).sin());
        m.cone(centre+dir*r,dir,2.7,len,5,vec3(1.44,3.6,3.12),alpha*(0.7+0.25*(t*29.+i).sin()));
    }
}
pub fn release(lane:Lane,globe:Option<Vec2>,age:f64,seed:u32,stats:&mut DrawStats) {
    if phase(age).is_none() {return}
    let a=age as f32;let fade=s((a-FADE_START)/0.060);let travel=(a/TRAVEL).clamp(0.,1.);
    let mut m=Meshes::new(lane,a,seed);let t=a+7./3.;
    let length=lane.root.distance(lane.end)/lane.scale;let r=lane.width*0.5/lane.scale;
    let body=(length*travel-r*0.42).max(0.001);
    m.glow(vec2(length*travel*0.5,15.),vec2(length*travel+30.,r*4.6),vec3(0.12,2.4,1.9),0.45*(1.-fade*0.6));
    m.tube(body,r,lane.twin,fade,Kind::DjinnBody,1.-s(fade/0.48));
    m.tube(body,r*1.035,lane.twin,fade,Kind::DjinnShell,(1.-s((fade-0.1)/0.45))*0.85);
    m.cap(body,r,fade,1.-s(fade/0.55));
    for i in 0..40 {
        let j=i as f32;let u=(j*0.618+a*1.1+seed as f32*0.000013).fract();let theta=j*2.399+a*2.6+fade*(j*1.371+(j*4.3).sin());
        let size=4.5+(i%4) as f32*1.35;
        if u*length+size*1.3>=body {continue}
        let rr=r*(0.48+fade*0.32);let pink=s((u-0.34)/0.52);
        let tint=vec3(0.15+pink*2.50,1.40+pink*0.35,1.28+pink*0.85).lerp(vec3(2.+pink*1.1,2.8-pink*1.1,2.9-pink*0.1),s(fade/0.65));
        m.sphere(vec3(u*length,theta.cos()*rr,theta.sin()*rr),vec3(size*1.3,size,size)*(1.+0.25*fade),Quat::from_rotation_y(t+j),tint,(0.34+pink*0.38+fade*0.28)*(1.-s((fade-0.62)/0.38)),Kind::DjinnBillow);
    }
    for i in 0..2 {let x=length*if i==0 {0.22}else{0.68};if x<body-5. {m.arc(x,r*0.94,t*0.95+i as f32*2.,0.95*(1.-fade*0.65)*(1.-s((fade-0.4)/0.6)));}}
    if a<TRAVEL {for i in 0..6 {
        let j=i as f32;let theta=j*TAU/6.;let dir=vec3(1.1,theta.cos()*0.7,theta.sin()*0.7).normalize();
        m.cone(vec3(body,0.,0.)+dir*r*0.55,dir,1.5,5.+6.*(0.5+0.5*(t*38.+j).sin()),4,vec3(2.,5.,4.5),0.65*(1.-fade));
    }}
    for i in 0..10 {
        let j=i as f32;let u=(j*0.618+seed as f32*0.000037+a*2.4).fract();let theta=j*2.399+t*8.;
        if u>=travel||fade>=0.7 {continue}
        let rr=r*(0.2+0.6*((i*37%11) as f32/11.));let size=0.7+(i%3) as f32*0.4;
        m.tetra(vec3(u*length,theta.cos()*rr,theta.sin()*rr),Vec3::splat(size),Quat::from_euler(EulerRot::XYZ,t*8.+j,t*11.,0.),vec3(2.7,5.2,4.6),0.75*(1.-fade));
    }
    if fade>0.015 {for i in 0..28 {
        let j=i as f32;let u=(j*0.618+seed as f32*0.00013).fract();let theta=j*2.399+t*2.;let rr=r*(0.15+0.42*((i*17%13) as f32/13.)+fade*0.40);
        let size=(2.+(i%4) as f32*0.9)*(1.+0.25*fade);
        m.tetra(vec3(u*length+(j*5.).sin()*fade*7.,theta.cos()*rr,theta.sin()*rr),vec3(size*(1.1+(i%3) as f32*0.4),size,size*0.55),Quat::from_euler(EulerRot::XYZ,j+t*9.,j*2.+t*7.,j+t*5.),vec3(2.2+u*0.8,2.9-u*1.9,3.1),(0.45+0.55*s(fade/0.3))*(1.-s((fade-0.72)/0.28)));
    }}
    // Ink stays on top of all energy and bloom, as in the study's separate mask pass.
    m.tube(body,r*0.25,false,fade,Kind::DjinnInk,1.-s((fade-0.82)/0.18));
    for i in 0..6 {
        let j=i as f32;let theta=j*2.399;
        let points=std::array::from_fn(|k| {let k=k as f32;let rr=2.+k*2.2;let angle=theta+if k as usize%2==1 {0.22}else{-0.12};vec3(length*(0.27+j*0.085+k*0.014),angle.cos()*rr,angle.sin()*rr)});
        if points[4].x<body {m.vein(points,0.88*(1.-s((fade-0.82)/0.18)));}
    }
    if let Some(globe)=globe {
        let delta=(globe-lane.root)/lane.scale;
        let centre=vec3(delta.dot(m.axis),delta.dot(m.side),0.);
        globe_mesh(&mut m,centre,1.,1.-s((a-0.18)/0.25));
    }
    m.draw(stats);
}
