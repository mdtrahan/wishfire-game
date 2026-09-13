use simulation_core::combat_power_full;

fn cp(atk:f64,mag:f64,def:f64,res:f64,hp:f64,spd:f64,level:f64)->f64{
    combat_power_full(atk,mag,def,res,hp,spd,level,2.0+(0.48*atk.max(mag)),0.01,1.25,0.0,0.0,0.0,0.0,0.0,0.0,1.0)
}

#[test]
fn combat_power_rewards_offense_survivability_and_action_rate() {
    let base=cp(10.0,4.0,5.0,4.0,100.0,10.0,1.0);
    assert!(cp(14.0,4.0,5.0,4.0,100.0,10.0,1.0)>base);
    assert!(cp(10.0,4.0,12.0,4.0,100.0,10.0,1.0)>base);
    assert!(cp(10.0,4.0,5.0,4.0,140.0,10.0,1.0)>base);
    assert!(cp(10.0,4.0,5.0,4.0,100.0,18.0,1.0)>base);
}
