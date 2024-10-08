use criterion::{black_box, criterion_group, criterion_main, Criterion};
use solver::exploration_target::{ExplorationCategory, ExplorationTarget, PreferenceKind};
use solver::puyo::Puyo;
use solver::puyo_attr::PuyoAttr;
use solver::puyo_coord::PuyoCoord;
use solver::puyo_type::*;
use solver::simulation_environment::SimulationEnvironment;
use solver::simulator_bb::{BitBoards, SimulatorBB};
use solver::solution_explorer::SolutionExplorer;
use solver::trace_mode::TraceMode;
use std::collections::HashSet;

fn setup_input() -> (
    SimulationEnvironment,
    HashSet<PuyoCoord>,
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
        is_chance_mode: false,
        minimum_puyo_num_for_popping: 3,
        max_trace_num: 5,
        trace_mode: TraceMode::Normal,
        popping_leverage: 1.0,
        chain_leverage: 7.0,
    };
    let boost_area_coord_set: HashSet<PuyoCoord> = HashSet::new();
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
        preference_priorities: Vec::from([
            PreferenceKind::BiggerValue,
            PreferenceKind::ChancePop,
            PreferenceKind::PrismPop,
            PreferenceKind::AllClear,
            PreferenceKind::SmallerTraceNum,
        ]),
        optimal_solution_count: 1,
        main_attr: Some(PuyoAttr::Green),
        sub_attr: None,
        main_sub_ratio: None,
        counting_bonus: None,
    };

    return (
        environment,
        boost_area_coord_set,
        field,
        next_puyos,
        trace_coords,
        exploration_target,
    );
}

fn simulator_bb_do_chains(
    environment: &SimulationEnvironment,
    boost_area: u64,
    boards: &mut BitBoards,
    trace: u64,
) {
    let simulator = SimulatorBB {
        environment,
        boost_area,
    };
    simulator.do_chains(boards, trace);
}

fn solve_all_traces() {
    let (environment, boost_area_coord_set, field, next_puyos, _trace_coords, exploration_target) =
        setup_input();
    let explorer = SolutionExplorer::new(
        &exploration_target,
        &environment,
        &boost_area_coord_set,
        &field,
        &next_puyos,
    );
    explorer.solve_all_traces();
}

fn do_chains_benchmark(c: &mut Criterion) {
    let (environment, boost_area_coord_set, field, next_puyos, trace_coords, _exploration_target) =
        setup_input();
    let boost_area = SimulatorBB::coords_to_board(boost_area_coord_set.iter());
    let boards = SimulatorBB::create_bit_boards(
        &field.map(|row| {
            row.map(|c| match c {
                Some(p) => Some(p.puyo_type),
                None => None,
            })
        }),
        &next_puyos.map(|c| match c {
            Some(p) => Some(p.puyo_type),
            None => None,
        }),
    );
    let trace = SimulatorBB::coords_to_board(trace_coords.iter());

    let mut group = c.benchmark_group("simulator");

    group.bench_function("SimulatorBB::do_chains", |b| {
        b.iter(|| {
            simulator_bb_do_chains(
                black_box(&environment),
                black_box(boost_area),
                black_box(&mut boards.clone()),
                black_box(trace),
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
