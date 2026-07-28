//! 塗り案の**期待値評価**のコストを、旧方式と新方式で同じ土俵で比べる計測用バイナリ。
//!
//! - 旧: 決定論で1回 + サンプルごとに1回、`solve_all_traces` を回す (計 `samples + 1` 回の全列挙)
//! - 新: [`SolutionExplorer::solve_all_traces_ev`] 1回。なぞりの全列挙は1回で、
//!   各なぞりの「最初の不確定ぷよ補充より手前」の連鎖計算も1回だけ
//!
//! 値が一致すること (E_s[max_t] の意味で) も同時に確かめる。
//!
//! 使い方:
//!   cargo run --release --bin bench_paint_ev -- --color red --top 8 --samples 20 --trace 5
//!   RUSTFLAGS="-C target-cpu=native" cargo run --release --bin bench_paint_ev -- ...

use std::collections::HashSet;
use std::env;
use std::time::Instant;

use solver::exploration_target::ExplorationTarget;
use solver::paint::PaintFilter;
use solver::paint_search::{
    evaluate_paint_sets, expand_beam, make_unknown_fills, select_top, PaintBeamContext,
    PaintEvalContext, PaintSearchParams, UncertaintyParams,
};
use solver::puyo::{Field, NextPuyos};
use solver::puyo_attr::PuyoAttr;
use solver::puyo_coord::PuyoCoord;
use solver::simulation_environment::SimulationEnvironment;
use solver::solution_explorer::SolutionExplorer;
use solver::trace_mode::TraceMode;

mod common;
use common::{
    default_priorities, flag, natsuama_field, natsuama_next_puyos, parse_boost_area,
    parse_category, parse_color, parse_unknown_policy, random_board, RandomBoardSpec,
};

fn main() {
    let args: Vec<String> = env::args().collect();

    let seed: Option<u64> = flag(&args, "--seed").and_then(|s| s.parse().ok());
    let (field, next_puyos, board_name): (Field, NextPuyos, String) = match seed {
        Some(seed) => {
            let (f, n) = random_board(seed, &RandomBoardSpec::default());
            (f, n, format!("random/{}", seed))
        }
        None => (
            natsuama_field(),
            natsuama_next_puyos(),
            "natsuama/1".to_string(),
        ),
    };

    let color = flag(&args, "--color")
        .and_then(parse_color)
        .unwrap_or(PuyoAttr::Red);
    let max_paint_num: u32 = flag(&args, "--max")
        .and_then(|s| s.parse().ok())
        .unwrap_or(10);
    let min_pop: u32 = flag(&args, "--min-pop")
        .and_then(|s| s.parse().ok())
        .unwrap_or(4);
    let beam_width: usize = flag(&args, "--beam")
        .and_then(|s| s.parse().ok())
        .unwrap_or(50);
    let surrogate_trace: u32 = flag(&args, "--surrogate")
        .and_then(|s| s.parse().ok())
        .unwrap_or(4);
    let true_trace: u32 = flag(&args, "--trace")
        .and_then(|s| s.parse().ok())
        .unwrap_or(5);
    let top_num: usize = flag(&args, "--top")
        .and_then(|s| s.parse().ok())
        .unwrap_or(8);
    let samples: u32 = flag(&args, "--samples")
        .and_then(|s| s.parse().ok())
        .unwrap_or(20);
    let max_refills: u32 = flag(&args, "--refills")
        .and_then(|s| s.parse().ok())
        .unwrap_or(2);
    let policy = parse_unknown_policy(flag(&args, "--unknown").unwrap_or("averse"));

    let boost_area: HashSet<PuyoCoord> = parse_boost_area(flag(&args, "--boost").unwrap_or("none"));
    let category = parse_category(flag(&args, "--category").unwrap_or("damage"));
    let environment = SimulationEnvironment {
        is_chance_mode: false,
        minimum_puyo_num_for_popping: min_pop,
        max_trace_num: true_trace,
        trace_mode: TraceMode::Normal,
        popping_leverage: 7.5,
        chain_leverage: 10.5,
    };
    let exploration_target = ExplorationTarget {
        category,
        preference_priorities: default_priorities(),
        optimal_solution_count: 1,
        main_attr: Some(color),
        sub_attr: None,
        main_sub_ratio: None,
        counting_bonus: None,
    };

    let mut params = PaintSearchParams::new(color, max_paint_num);
    params.filter = PaintFilter::All;
    params.surrogate_trace_num = surrogate_trace;
    let context = PaintBeamContext::new(&field, &next_puyos, &params, min_pop);
    let eval = PaintEvalContext {
        exploration_target: &exploration_target,
        environment: &environment,
        boost_area: &boost_area,
        field: &field,
        next_puyos: &next_puyos,
    };

    // 代理評価のビームサーチで、実際に本番評価へ回るのと同じ性質の塗り案を集める。
    let mut all: Vec<Vec<usize>> = Vec::new();
    let mut beam: Vec<Vec<usize>> = vec![Vec::new()];
    for _ in 0..max_paint_num {
        let expanded = expand_beam(&context, &beam);
        if expanded.is_empty() {
            break;
        }
        let evaluations =
            evaluate_paint_sets(&eval, &context, &expanded, surrogate_trace, false, &[]);
        let scores: Vec<f64> = evaluations.iter().map(|e| e.value).collect();
        let top = select_top(&scores, beam_width);
        beam = top.iter().map(|&i| expanded[i].clone()).collect();
        all.extend(beam.iter().cloned());
    }
    let scores: Vec<f64> = evaluate_paint_sets(&eval, &context, &all, surrogate_trace, false, &[])
        .iter()
        .map(|e| e.value)
        .collect();
    let picked: Vec<Vec<usize>> = select_top(&scores, top_num)
        .iter()
        .map(|&i| all[i].clone())
        .collect();

    let fills = make_unknown_fills(&UncertaintyParams {
        policy,
        samples,
        max_refills,
    });

    eprintln!(
        "board={}  color={:?}  trace={}  paint_sets={}  samples={}  refills={}  bmi2(hw PEXT)={}",
        board_name,
        color,
        true_trace,
        picked.len(),
        samples,
        max_refills,
        cfg!(target_feature = "bmi2"),
    );

    // --- 旧方式: サンプルごとに全列挙をやり直す ---
    let start = Instant::now();
    let mut old_values: Vec<f64> = Vec::new();
    for cells in &picked {
        let painted = context.apply(&field, cells);
        let mut total = 0.0;
        for fill in &fills {
            let explorer = SolutionExplorer::new(
                &exploration_target,
                &environment,
                &boost_area,
                &painted,
                &next_puyos,
            )
            .with_unknown_fill(fill);
            total += explorer
                .solve_all_traces()
                .optimal_solutions
                .first()
                .map(|s| s.value)
                .unwrap_or(0.0);
        }
        // 決定論の解も別途1回。
        let explorer = SolutionExplorer::new(
            &exploration_target,
            &environment,
            &boost_area,
            &painted,
            &next_puyos,
        );
        let _ = explorer.solve_all_traces();
        old_values.push(total / fills.len() as f64);
    }
    let old_elapsed = start.elapsed();

    // --- 新方式: 全列挙1回 + 決定論プレフィックス共有 ---
    let start = Instant::now();
    let mut new_values: Vec<f64> = Vec::new();
    let mut plan_values: Vec<f64> = Vec::new();
    for cells in &picked {
        let painted = context.apply(&field, cells);
        let ev = SolutionExplorer::new(
            &exploration_target,
            &environment,
            &boost_area,
            &painted,
            &next_puyos,
        )
        .solve_all_traces_ev(&fills);
        new_values.push(ev.expected_of_best);
        plan_values.push(ev.best_of_expected);
    }
    let new_elapsed = start.elapsed();

    let old_ms = old_elapsed.as_secs_f64() * 1000.0;
    let new_ms = new_elapsed.as_secs_f64() * 1000.0;
    println!(
        "old={:>9.1} ms   new={:>9.1} ms   speedup={:.2}x",
        old_ms,
        new_ms,
        old_ms / new_ms
    );

    let mismatch = old_values
        .iter()
        .zip(new_values.iter())
        .filter(|(a, b)| a != b)
        .count();
    println!("値の不一致: {} / {} 件", mismatch, old_values.len());

    println!("  #   E_s[max_t] (既存)   max_t[E_s] (案の期待値)   比");
    for i in 0..new_values.len() {
        println!(
            "  {:>2}  {:>16.2}  {:>22.2}  {:>6.3}",
            i,
            new_values[i],
            plan_values[i],
            plan_values[i] / new_values[i].max(f64::MIN_POSITIVE)
        );
    }
}
