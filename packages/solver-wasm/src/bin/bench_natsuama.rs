//! 標準ベンチ盤面「なつアマ/1 (specialRule4/1)」での厳密探索の計測用バイナリ。
//!
//! シナリオ (puyomist Web と一致):
//!   - 盤面: なつアマ/1
//!   - ネクスト: 紫 ×8
//!   - なぞり: 紫ぷよに変える (TraceMode::ToPurple)
//!   - 最低消し数: 4
//!   - 連鎖倍率: 10.5 / 同時係数(popping_leverage): 7.5  ※同時係数は探索時間に影響しない(値スケールのみ)
//!   - ブーストエリア: なし
//!   - 探索対象: ダメージ量, 主属性=紫, 最優先=値が大きい
//!   - 最大なぞり数: 引数で指定 (既定 11)
//!
//! 使い方:
//!   cargo run --release --bin bench_natsuama -- [max_trace_num]
//!   RUSTFLAGS="-C target-cpu=native" cargo run --release --bin bench_natsuama -- 9   # ハードウェアPEXT(BMI2)
//!
//! 単スレッド(探索器そのもの)での計測。Web は 48 開始インデックスを Worker 並列するため、
//! 実機の体感時間 ≒ この単スレッド時間 / 実効並列度。

use std::collections::HashSet;
use std::env;
use std::time::Instant;

use solver::exploration_target::{ExplorationCategory, ExplorationTarget, PreferenceKind};
use solver::puyo::Puyo;
use solver::puyo_attr::PuyoAttr;
use solver::puyo_coord::PuyoCoord;
use solver::puyo_type::PuyoType;
use solver::simulation_environment::SimulationEnvironment;
use solver::solution_explorer::SolutionExplorer;
use solver::trace_mode::TraceMode;

fn main() {
    let args: Vec<String> = env::args().collect();
    let max_trace_num: u32 = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(11);

    // なつアマ/1 (specialRule4/1) の盤面。W=Prism, H=Heart。
    let r = PuyoType::Red;
    let b = PuyoType::Blue;
    let g = PuyoType::Green;
    let y = PuyoType::Yellow;
    let p = PuyoType::Purple;
    let h = PuyoType::Heart;
    let w = PuyoType::Prism;

    let mut id_counter = 0i32;
    let field = [
        [b, g, y, r, b, r, p, r],
        [g, r, g, h, w, b, y, r],
        [g, g, p, p, b, p, r, y],
        [b, b, b, r, g, b, r, y],
        [r, r, g, y, r, g, p, y],
        [g, r, g, y, y, g, g, p],
    ]
    .map(|row| {
        row.map(|puyo_type| {
            id_counter += 1;
            Some(Puyo { id: id_counter, puyo_type })
        })
    });
    // ネクスト: 紫 ×8
    let next_puyos = [p, p, p, p, p, p, p, p].map(|puyo_type| {
        id_counter += 1;
        Some(Puyo { id: id_counter, puyo_type })
    });

    let environment = SimulationEnvironment {
        is_chance_mode: false,
        minimum_puyo_num_for_popping: 4,
        max_trace_num,
        trace_mode: TraceMode::ToPurple,
        popping_leverage: 7.5,
        chain_leverage: 10.5,
    };

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
        main_attr: Some(PuyoAttr::Purple),
        sub_attr: None,
        main_sub_ratio: None,
        counting_bonus: None,
    };

    let boost_area_coord_set: HashSet<PuyoCoord> = HashSet::new();

    let explorer = SolutionExplorer::new(
        &exploration_target,
        &environment,
        &boost_area_coord_set,
        &field,
        &next_puyos,
    );

    let bmi2 = cfg!(target_feature = "bmi2");
    eprintln!(
        "board=natsuama/1 k={} popping={} chain={} bmi2(hw PEXT)={}",
        max_trace_num, environment.popping_leverage, environment.chain_leverage, bmi2
    );

    let start = Instant::now();
    let result = explorer.solve_all_traces();
    let elapsed = start.elapsed();

    let cands = result.candidates_num;
    let ms = elapsed.as_secs_f64() * 1000.0;
    let us_per = elapsed.as_secs_f64() * 1e6 / cands.max(1) as f64;

    println!(
        "k={:>2}  candidates={:>12}  elapsed={:>10.2} ms  {:>6.3} us/cand  bmi2={}",
        max_trace_num, cands, ms, us_per, bmi2
    );
    if let Some(best) = result.optimal_solutions.first() {
        println!(
            "       best_value={:.3}  trace_len={}  chains={}",
            best.value,
            best.trace_coords.len(),
            best.chains.len()
        );
    }
}
