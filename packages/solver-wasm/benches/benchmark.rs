use std::collections::HashSet;

use criterion::{black_box, criterion_group, criterion_main, Criterion};

use solver::puyo::Puyo;
use solver::puyo_coord::PuyoCoord;
use solver::puyo_type::*;
use solver::simulator::{SimulationEnvironment, Simulator};
use solver::trace_mode::TraceMode;

fn setup_input() -> (
    SimulationEnvironment,
    [[Option<Puyo>; 8]; 6],
    [Option<Puyo>; 8],
    Vec<PuyoCoord>,
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

    return (environment, field, next_puyos, trace_coords);
}

fn solve(
    environment: &SimulationEnvironment,
    field: &mut [[Option<Puyo>; 8]; 6],
    next_puyos: &mut [Option<Puyo>; 8],
    trace_coords: &Vec<PuyoCoord>,
) {
    let simulator = Simulator { environment };
    simulator.do_chains(field, next_puyos, trace_coords);
}

fn criterion_benchmark(c: &mut Criterion) {
    let (environment, mut field, mut next_puyos, trace_coords) = setup_input();

    c.bench_function("do_chains", |b| {
        b.iter(|| {
            solve(
                black_box(&environment),
                black_box(&mut field),
                black_box(&mut next_puyos),
                black_box(&trace_coords),
            )
        })
    });
}

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);
