use std::collections::HashSet;

use criterion::{criterion_group, criterion_main, Criterion};

use solver::puyo::Puyo;
use solver::puyo_coord::PuyoCoord;
use solver::puyo_type::*;
use solver::simulator::{SimulationEnvironment, Simulator};
use solver::trace_mode::TraceMode;

fn solve() {
    // Arrange
    let R = PuyoType::Red;
    let B = PuyoType::Blue;
    let G = PuyoType::Green;
    let Y = PuyoType::Yellow;
    let P = PuyoType::Purple;
    let H = PuyoType::Heart;

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
    let mut field = [
        [R, P, H, P, Y, G, Y, Y],
        [R, Y, P, H, Y, G, P, G],
        [B, Y, G, B, H, Y, G, P],
        [B, R, B, R, P, B, R, P],
        [Y, G, P, P, R, B, G, G],
        [B, G, B, R, B, Y, R, R],
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
    let mut next_puyos = [G, G, G, G, G, G, G, G].map(|puyo_type| {
        id_counter += 1;
        Some(Puyo {
            id: id_counter,
            puyo_type,
        })
    });
    let trace_coords: Vec<PuyoCoord> = vec![PuyoCoord { x: 5, y: 2 }, PuyoCoord { x: 6, y: 2 }];
    let simulator = Simulator { environment };

    // Act
    let actual = simulator.do_chains(&mut field, &mut next_puyos, &trace_coords);
}

fn criterion_benchmark(c: &mut Criterion) {
    c.bench_function("do_chains", |b| b.iter(|| solve()));
}

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);
