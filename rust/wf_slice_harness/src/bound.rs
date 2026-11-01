use crate::*;
use std::{
    collections::BTreeMap,
    fs::File,
    io::{BufWriter, Write},
};
pub use wf_combat::bound::*;
pub fn run(out: &str, seeds: &[u64], seconds: u32) {
    let mut summary = BufWriter::new(File::create(format!("{out}-catches.csv")).unwrap());
    writeln!(summary,"seed,tier,hazard,hero,kind,class,notice_step,reaction_delay,available,required,planned,planted,speed,actual_path,net_distance,steering_path,cohesion_path,boss_path,wall_path,other_dx,other_dy,cohesion_net,goal_changes,other_hazard_frames,outside_frames,shape,origin_x,origin_y,final_required,free_time,free_planted_time,notice_x,notice_y,notice_vx,notice_vy,notice_hx,notice_hy,body,impact_x,impact_y").unwrap();
    let mut trace = BufWriter::new(File::create(format!("{out}-steps.csv")).unwrap());
    writeln!(trace,"seed,tier,hazard,hero,step,time,x,y,goal_x,goal_y,intent,planted,remaining,inside,goal_other_hazard,goal_outside,caught,steer_dx,steer_dy,cohesion_dx,cohesion_dy,boss_dx,boss_dy,wall_dx,wall_dy,other_dx,other_dy,deflect_dx,deflect_dy").unwrap();
    RUN.with(|r| {
        *r.borrow_mut() = Some(Run {
            seed: 1,
            before: [Vec2::default(); 4],
            d: [[Vec2::default(); 4]; 4],
            deflection: [Vec2::default(); 4],
            tracks: BTreeMap::new(),
            summary,
            trace,
            counts: [0; 3],
            tiers: [0; 3],
            untracked: 0,
        })
    });
    for &seed in seeds {
        mutate(|r| {
            r.seed = seed;
            r.tracks.clear();
        });
        let mut s = Sim::new(SimConfig {
            seed,
            ..Default::default()
        });
        for _ in 0..seconds * SIM_HZ {
            s.step();
            s.drain_events();
        }
        println!("seed {seed} stage {} wipes {}", s.stage.wave, s.stage.wipes);
    }
    RUN.with(|r| {
        let mut r = r.borrow_mut().take().unwrap();
        r.summary.flush().unwrap();
        r.trace.flush().unwrap();
        println!("classes {:?}; tier catches {:?}", r.counts, r.tiers);
        println!("untracked contacts {}", r.untracked);
        assert_eq!(r.untracked, 0);
    });
}
