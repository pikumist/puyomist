use std::collections::HashSet;

use criterion::{black_box, criterion_group, criterion_main, Criterion};

use solver::exploration_target::{ExplorationCategory, ExplorationTarget, PreferenceKind};
use solver::puyo::Puyo;
use solver::puyo_attr::PuyoAttr;
use solver::puyo_coord::PuyoCoord;
use solver::puyo_type::*;
use solver::simulator::{SimulationEnvironment, Simulator};
use solver::solution_explorer::SolutionExplorer;
use solver::trace_mode::TraceMode;

fn setup_input() -> (
    SimulationEnvironment,
    [[Option<Puyo>; 8]; 6],
    [Option<Puyo>; 8],
    Vec<PuyoCoord>,
    ExplorationTarget,
) {
    // Arrange
    let r = PuyoType::Red;
    let b = PuyoType::Blue;
    let g = PuyoType::Green;
    let y = PuyoType::Yellow;
    let p = PuyoType::Purple;
    let h = PuyoType::Heart;

    let environment = SimulationEnvironment {
        boost_area_coord_set: HashSet::new(),
        is_chance_mode: false,
        minimum_puyo_num_for_popping: 3,
        max_trace_num: 5,
        trace_mode: TraceMode::Normal,
        popping_leverage: 1.0,
        chain_leverage: 7.0,
    };
    let mut id_counter = 0;
    let field = [
        [r, p, h, p, y, g, y, y],
        [r, y, p, h, y, g, p, g],
        [b, y, g, b, h, y, g, p],
        [b, r, b, r, p, b, r, p],
        [y, g, p, p, r, b, g, g],
        [b, g, b, r, b, y, r, r],
    ]
    .map(|row| {
        row.map(|puyo_type| {
            id_counter += 1;
            Some(Puyo {
                id: id_counter,
                puyo_type,
            })
        })
    });
    let next_puyos = [g, g, g, g, g, g, g, g].map(|puyo_type| {
        id_counter += 1;
        Some(Puyo {
            id: id_counter,
            puyo_type,
        })
    });
    let trace_coords: Vec<PuyoCoord> = vec![PuyoCoord { x: 5, y: 2 }, PuyoCoord { x: 6, y: 2 }];

    let exploration_target = ExplorationTarget {
        category: ExplorationCategory::Damage,
        preference_priorities: [
            PreferenceKind::BetterValue,
            PreferenceKind::ChancePop,
            PreferenceKind::PrismPop,
            PreferenceKind::AllClear,
            PreferenceKind::SmallerTraceNum,
        ],
        optimal_solution_count: 1,
        main_attr: Some(PuyoAttr::Green),
        sub_attr: None,
        main_sub_ratio: None,
        counting_bonus: None,
    };

    return (
        environment,
        field,
        next_puyos,
        trace_coords,
        exploration_target,
    );
}

fn do_chains(
    environment: &SimulationEnvironment,
    field: &mut [[Option<Puyo>; 8]; 6],
    next_puyos: &mut [Option<Puyo>; 8],
    trace_coords: &Vec<PuyoCoord>,
) {
    let simulator = Simulator { environment };
    simulator.do_chains(field, next_puyos, trace_coords);
}

fn solve_all_traces() {
    let (environment, field, next_puyos, _trace_coords, exploration_target) = setup_input();
    let explorer = SolutionExplorer::new(&exploration_target, &environment, &field, &next_puyos);
    explorer.solve_all_traces();
}

fn do_chains_benchmark(c: &mut Criterion) {
    let (environment, field, next_puyos, trace_coords, _exploration_target) = setup_input();
    let mut group = c.benchmark_group("simulator");

    group.bench_function("do_chains", |b| {
        b.iter(|| {
            do_chains(
                black_box(&environment),
                black_box(&mut field.clone()),
                black_box(&mut next_puyos.clone()),
                black_box(&trace_coords),
            )
        })
    });
}

fn solve_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("explorer");
    group.sample_size(30);
    group.bench_function("solve_all_traces", |b| b.iter(|| solve_all_traces()));
}

criterion_group!(benches, do_chains_benchmark, solve_benchmark);
criterion_main!(benches);
