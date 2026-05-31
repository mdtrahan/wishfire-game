use std::fs;
use std::path::Path;

use simulation_core::combat_power;

#[derive(Debug)]
struct CombatPowerCase {
    name: String,
    atk: f64,
    def: f64,
    hp: f64,
    expected: f64,
}

fn fixture_cases() -> Vec<CombatPowerCase> {
    let fixture_path =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/combat_power_cases.csv");
    let raw = fs::read_to_string(&fixture_path)
        .unwrap_or_else(|err| panic!("failed to read {}: {err}", fixture_path.display()));

    raw.lines()
        .skip(1)
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            let fields: Vec<&str> = line.split(',').collect();
            assert_eq!(fields.len(), 5, "invalid fixture row: {line}");
            CombatPowerCase {
                name: fields[0].to_string(),
                atk: fields[1].parse().expect("invalid atk"),
                def: fields[2].parse().expect("invalid def"),
                hp: fields[3].parse().expect("invalid hp"),
                expected: fields[4].parse().expect("invalid expected"),
            }
        })
        .collect()
}

#[test]
fn combat_power_matches_shared_fixtures() {
    for test_case in fixture_cases() {
        let actual = combat_power(test_case.atk, test_case.def, test_case.hp);
        assert!(
            (actual - test_case.expected).abs() < f64::EPSILON,
            "case {} expected {}, got {}",
            test_case.name,
            test_case.expected,
            actual
        );
    }
}
