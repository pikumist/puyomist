//! 不確定ぷよ (ネクストより先に降ってくるぷよ) を確率的に扱ったとき、
//! **塗り案の順位が決定論評価から変わるか**を測る計測用バイナリ。
//!
//! ## なぜ要るか
//!
//! シミュレータは既定では、ネクストが落ちたあとの空きマスを埋めない (連鎖はそこで止まる)。
//! 実際には色ぷよが降ってきて連鎖が伸び得るので、決定論評価は系統的な過小評価であり、
//! 実際の結果は確率的にブレる。上位の塗り案どうしの差は数%しかないので、この誤差の方が
//! 大きい可能性がある。もしそうなら「決定論の最適解を厳密に追う」こと自体が過剰適合になる。
//!
//! ## 充填方針 (`--unknown`)
//!
//! | 値 | 内容 |
//! |---|---|
//! | `inert` | 補充しない (従来。過小評価側) |
//! | `averse` | ランダムだが**補充ぷよ同士を隣り合って同色にしない**。補充だけでは発火できないので、既存の塊を伸ばす効果だけが残る |
//! | `random` | 一様ランダム。補充ぷよが固まって自力発火し得る (過大評価側) |
//!
//! ## 手順
//!
//! 1. ビームサーチで塗り案を集め、決定論評価 (なぞり `--trace` の全探索) で上位 `--top` 件を採る
//! 2. 各案を `--samples` 回サンプリングして平均値を求める
//! 3. 決定論の順位と平均値の順位を突き合わせる
//!
//! ## 使い方
//!
//!   cargo run --release --bin paint_uncertain -- --seed 1 --color red --category tsukai \
//!       --boost all --beam 100 --top 30 --samples 40 --unknown averse

use std::collections::HashSet;
use std::env;
use std::time::Instant;

use rayon::prelude::*;

use solver::paint::{bit, component_size_capped, Bits, PaintFilter, PaintSetup};
use solver::puyo::{Field, NextPuyos};
use solver::puyo_attr::PuyoAttr;
use solver::simulator_bb::UnknownFillPolicy;

mod common;
use common::{
    default_priorities, flag, make_unknown_fill, natsuama_field, natsuama_next_puyos,
    parse_boost_area, parse_category, parse_color, parse_preference, parse_unknown_policy,
    random_board, value_of, EvalConfig, RandomBoardSpec,
};

/// ビームサーチで塗り案の候補集合を作る (`paint_beam` と同じ手順)。
fn collect_candidates(
    setup: &PaintSetup,
    field: &Field,
    next_puyos: &NextPuyos,
    config: &EvalConfig,
    beam_width: usize,
    surrogate_trace: u32,
    max_paint_num: usize,
) -> Vec<Vec<usize>> {
    let masks = solver::paint::build_neighbor_masks();
    let mut all: Vec<Vec<usize>> = vec![Vec::new()];
    let mut beam: Vec<(Vec<usize>, Bits, Bits)> = vec![(Vec::new(), setup.base_board, 0)];

    for _ in 1..=max_paint_num {
        let mut expanded: Vec<(Vec<usize>, Bits, Bits)> = Vec::new();
        let mut keys: HashSet<Bits> = HashSet::new();
        for (cells, board, key) in &beam {
            for &index in &setup.candidates {
                if key & bit(index) != 0 {
                    continue;
                }
                let next_board = board | bit(index);
                if component_size_capped(next_board, index, &masks, setup.max_component)
                    > setup.max_component
                {
                    continue;
                }
                let next_key = key | bit(index);
                if !keys.insert(next_key) {
                    continue;
                }
                let mut next_cells = cells.clone();
                next_cells.push(index);
                expanded.push((next_cells, next_board, next_key));
            }
        }
        if expanded.is_empty() {
            break;
        }
        let scores: Vec<f64> = expanded
            .par_iter()
            .map(|(cells, _, _)| {
                let painted = setup.apply(field, cells);
                value_of(&config.best_solution(&painted, next_puyos, surrogate_trace))
            })
            .collect();
        let mut order: Vec<usize> = (0..expanded.len()).collect();
        order.sort_by(|&i, &j| scores[j].partial_cmp(&scores[i]).unwrap());
        order.truncate(beam_width);
        for &i in &order {
            all.push(expanded[i].0.clone());
        }
        beam = order.iter().map(|&i| expanded[i].clone()).collect();
    }
    all
}

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

    let target = flag(&args, "--color")
        .and_then(parse_color)
        .unwrap_or(PuyoAttr::Red);
    let max_paint_num: usize = flag(&args, "--max")
        .and_then(|s| s.parse().ok())
        .unwrap_or(10);
    let min_pop: u32 = flag(&args, "--min-pop")
        .and_then(|s| s.parse().ok())
        .unwrap_or(4);
    let filter = flag(&args, "--filter")
        .and_then(PaintFilter::parse)
        .unwrap_or(PaintFilter::Adj2);
    let beam_width: usize = flag(&args, "--beam")
        .and_then(|s| s.parse().ok())
        .unwrap_or(100);
    let surrogate_trace: u32 = flag(&args, "--surrogate")
        .and_then(|s| s.parse().ok())
        .unwrap_or(4);
    let true_trace: u32 = flag(&args, "--trace")
        .and_then(|s| s.parse().ok())
        .unwrap_or(6);
    let top_num: usize = flag(&args, "--top")
        .and_then(|s| s.parse().ok())
        .unwrap_or(30);
    let samples: u64 = flag(&args, "--samples")
        .and_then(|s| s.parse().ok())
        .unwrap_or(40);
    let max_refills: u32 = flag(&args, "--refills")
        .and_then(|s| s.parse().ok())
        .unwrap_or(2);
    let policies: Vec<UnknownFillPolicy> = match flag(&args, "--unknown") {
        Some(s) => vec![parse_unknown_policy(s)],
        None => vec![UnknownFillPolicy::ChainAverse, UnknownFillPolicy::Random],
    };

    let config = EvalConfig {
        category: parse_category(flag(&args, "--category").unwrap_or("tsukai")),
        main_attr: flag(&args, "--main-attr")
            .and_then(parse_color)
            .unwrap_or(target),
        priorities: flag(&args, "--priorities")
            .map(|s| s.split(',').map(|t| parse_preference(t.trim())).collect())
            .unwrap_or_else(default_priorities),
        boost_area: parse_boost_area(flag(&args, "--boost").unwrap_or("none")),
        minimum_puyo_num_for_popping: min_pop,
    };

    let setup = PaintSetup::new(&field, &next_puyos, target, max_paint_num, min_pop, filter);

    eprintln!(
        "board={}  paint_color={:?}  filter={}  M={}  beam={}  top={}  samples={}  refills={}",
        board_name,
        target,
        filter.name(),
        setup.candidates.len(),
        beam_width,
        top_num,
        samples,
        max_refills
    );

    // 1. ビームサーチで候補を集め、決定論評価で上位 top_num 件に絞る。
    let candidates = collect_candidates(
        &setup,
        &field,
        &next_puyos,
        &config,
        beam_width,
        surrogate_trace,
        max_paint_num,
    );
    let deterministic: Vec<f64> = candidates
        .par_iter()
        .map(|cells| {
            let painted = setup.apply(&field, cells);
            value_of(&config.best_solution(&painted, &next_puyos, true_trace))
        })
        .collect();

    let mut order: Vec<usize> = (0..candidates.len()).collect();
    order.sort_by(|&i, &j| deterministic[j].partial_cmp(&deterministic[i]).unwrap());
    order.truncate(top_num);

    println!(
        "決定論評価 (inert): 上位{}件  最良={:.1}  最下位={:.1}",
        order.len(),
        deterministic[order[0]],
        deterministic[*order.last().unwrap()]
    );

    // 2. 各方針で、上位候補をサンプリング評価する。
    for policy in policies {
        let start = Instant::now();
        let stats: Vec<(f64, f64)> = order
            .par_iter()
            .map(|&i| {
                let painted = setup.apply(&field, &candidates[i]);
                let values: Vec<f64> = (0..samples)
                    .map(|s| {
                        let fill = make_unknown_fill(s * 7919 + 13, policy, max_refills);
                        value_of(&config.best_solution_with(
                            &painted,
                            &next_puyos,
                            true_trace,
                            Some(&fill),
                        ))
                    })
                    .collect();
                let mean = values.iter().sum::<f64>() / values.len() as f64;
                let var = values.iter().map(|v| (v - mean).powi(2)).sum::<f64>()
                    / values.len() as f64;
                (mean, var.sqrt())
            })
            .collect();
        let ms = start.elapsed().as_secs_f64() * 1000.0;

        // 平均値で並べ直したときの1位が、決定論の1位と一致するか。
        let mut mc_order: Vec<usize> = (0..order.len()).collect();
        mc_order.sort_by(|&a, &b| stats[b].0.partial_cmp(&stats[a].0).unwrap());
        let mc_best_idx = mc_order[0];

        println!(
            "\n--- unknown={:?}  ({:.1} ms, {}件 × {}サンプル)",
            policy,
            ms,
            order.len(),
            samples
        );
        println!(
            "  決定論1位: 決定論={:.1}  期待値={:.1} (±{:.1})  期待値順位={}位",
            deterministic[order[0]],
            stats[0].0,
            stats[0].1,
            mc_order.iter().position(|&i| i == 0).unwrap() + 1
        );
        println!(
            "  期待値1位: 決定論={:.1} (決定論{}位)  期待値={:.1} (±{:.1})",
            deterministic[order[mc_best_idx]],
            mc_best_idx + 1,
            stats[mc_best_idx].0,
            stats[mc_best_idx].1
        );
        println!(
            "  決定論1位を選んだ場合の期待値の取りこぼし: {:.4}",
            stats[0].0 / stats[mc_best_idx].0
        );
        println!(
            "  補充による値の伸び: 決定論 {:.1} → 期待値 {:.1} ({:.2}倍)",
            deterministic[order[0]],
            stats[0].0,
            stats[0].0 / deterministic[order[0]].max(1.0)
        );

        // 上位候補の期待値のばらつきと、候補間の差を比べる。
        let mean_sd = stats.iter().map(|s| s.1).sum::<f64>() / stats.len() as f64;
        let spread = stats
            .iter()
            .map(|s| s.0)
            .fold(f64::NEG_INFINITY, f64::max)
            - stats.iter().map(|s| s.0).fold(f64::INFINITY, f64::min);
        println!(
            "  上位{}件の期待値の幅={:.1}  1案あたりの標準偏差の平均={:.1}  → {}",
            order.len(),
            spread,
            mean_sd,
            if mean_sd > spread {
                "候補間の差よりサンプル間のブレの方が大きい (厳密最適化は過剰適合)"
            } else {
                "候補間の差の方が大きい (順位に意味がある)"
            }
        );
    }
}
