//! **決定論でビームサーチしたときに見落とす塗り案があるか**を確かめる計測用バイナリ。
//!
//! ## 何が未解決だったか
//!
//! `paint_uncertain` で「決定論の1位を選んでも期待値の96.3〜100%が取れる」と分かったが、
//! それは**決定論の上位30案の中だけ**で比べた数字だった。決定論の評価では上位に来ないが
//! 期待値では優秀、という塗り案が存在する可能性は否定できていない。
//!
//! ## やること
//!
//! 同じビームサーチを、採点関数だけ変えて2通り走らせて突き合わせる。
//!
//! | | ビーム中の採点 | 最終選抜 |
//! |---|---|---|
//! | 決定論 | なぞり `--surrogate` の全探索を1回 | 期待値 (`--final-samples` 回の平均) |
//! | 期待値 | なぞり `--surrogate` の全探索を `--beam-samples` 回して平均 | 同上 |
//!
//! どちらも最終選抜は期待値で行うので、**同じ土俵で比較**できる。
//!
//! ## 共通乱数法
//!
//! 補充パターンの種を「サンプル番号だけ」に依存させ、全候補に同じパターン列を当てる。
//! 1案あたりの標準偏差は ±15〜21 ある一方、隣接候補の期待値の差は 1〜3 しかないので、
//! 独立サンプリングでは順位が雑音に埋もれる。同じ補充を当てれば運の要素が差で打ち消し合う。
//!
//! ## 使い方
//!
//!   cargo run --release --bin paint_beam_ev -- --seed 1 --color red --category tsukai \
//!       --boost all --beam 100 --beam-samples 8 --final-samples 40 --verify 200

use std::collections::HashSet;
use std::env;
use std::time::Instant;

use rayon::prelude::*;

use solver::paint::{bit, component_size_capped, Bits, PaintFilter, PaintSetup};
use solver::puyo::{Field, NextPuyos};
use solver::puyo_attr::PuyoAttr;
use solver::simulator_bb::{UnknownFill, UnknownFillPolicy};

mod common;
use common::{
    default_priorities, flag, make_unknown_fill, natsuama_field, natsuama_next_puyos,
    parse_boost_area, parse_category, parse_color, parse_preference, parse_unknown_policy,
    random_board, value_of, EvalConfig, RandomBoardSpec,
};

/// 共通乱数法のためのサンプル列。全候補にこの同じ列を当てる。
fn make_samples(policy: UnknownFillPolicy, count: u64, max_refills: u32) -> Vec<UnknownFill> {
    (0..count)
        .map(|s| make_unknown_fill(s * 7919 + 13, policy, max_refills))
        .collect()
}

/// 塗り案を評価する。`samples` が空なら決定論 (補充なし) 評価、そうでなければサンプル平均。
fn score(
    config: &EvalConfig,
    field: &Field,
    next_puyos: &NextPuyos,
    setup: &PaintSetup,
    cells: &[usize],
    max_trace_num: u32,
    samples: &[UnknownFill],
) -> f64 {
    let painted = setup.apply(field, cells);
    if samples.is_empty() {
        return value_of(&config.best_solution(&painted, next_puyos, max_trace_num));
    }
    let total: f64 = samples
        .iter()
        .map(|fill| {
            value_of(&config.best_solution_with(&painted, next_puyos, max_trace_num, Some(fill)))
        })
        .sum();
    total / samples.len() as f64
}

/// ビームサーチ。全深さで残ったビームの内容をまとめて返す。
fn beam_search(
    setup: &PaintSetup,
    field: &Field,
    next_puyos: &NextPuyos,
    config: &EvalConfig,
    beam_width: usize,
    surrogate_trace: u32,
    max_paint_num: usize,
    samples: &[UnknownFill],
) -> (Vec<(Vec<usize>, f64)>, u64) {
    let masks = solver::paint::build_neighbor_masks();
    let mut all: Vec<(Vec<usize>, f64)> = vec![(Vec::new(), f64::NEG_INFINITY)];
    let mut beam: Vec<(Vec<usize>, Bits, Bits)> = vec![(Vec::new(), setup.base_board, 0)];
    let mut evals = 0u64;

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
                score(
                    config,
                    field,
                    next_puyos,
                    setup,
                    cells,
                    surrogate_trace,
                    samples,
                )
            })
            .collect();
        evals += expanded.len() as u64 * samples.len().max(1) as u64;

        let mut order: Vec<usize> = (0..expanded.len()).collect();
        order.sort_by(|&i, &j| scores[j].partial_cmp(&scores[i]).unwrap());
        order.truncate(beam_width);
        for &i in &order {
            all.push((expanded[i].0.clone(), scores[i]));
        }
        beam = order.iter().map(|&i| expanded[i].clone()).collect();
    }

    (all, evals)
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
    let verify_num: usize = flag(&args, "--verify")
        .and_then(|s| s.parse().ok())
        .unwrap_or(200);
    let beam_samples: u64 = flag(&args, "--beam-samples")
        .and_then(|s| s.parse().ok())
        .unwrap_or(8);
    let final_samples: u64 = flag(&args, "--final-samples")
        .and_then(|s| s.parse().ok())
        .unwrap_or(40);
    let max_refills: u32 = flag(&args, "--refills")
        .and_then(|s| s.parse().ok())
        .unwrap_or(2);
    let policy = flag(&args, "--unknown")
        .map(parse_unknown_policy)
        .unwrap_or(UnknownFillPolicy::ChainAverse);

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
    let beam_sample_set = make_samples(policy, beam_samples, max_refills);
    let final_sample_set = make_samples(policy, final_samples, max_refills);

    eprintln!(
        "board={}  color={:?}  filter={}  M={}  beam={}  unknown={:?}  refills={}  \
         beam_samples={}  final_samples={}  verify={}",
        board_name,
        target,
        filter.name(),
        setup.candidates.len(),
        beam_width,
        policy,
        max_refills,
        beam_samples,
        final_samples,
        verify_num
    );

    // 2通りのビームサーチを走らせる。
    let mut results: Vec<(&str, Vec<(Vec<usize>, f64)>, u64, f64)> = Vec::new();
    for (label, samples) in [
        ("決定論ビーム", &[][..]),
        ("期待値ビーム", &beam_sample_set[..]),
    ] {
        let start = Instant::now();
        let (all, evals) = beam_search(
            &setup,
            &field,
            &next_puyos,
            &config,
            beam_width,
            surrogate_trace,
            max_paint_num,
            samples,
        );
        let ms = start.elapsed().as_secs_f64() * 1000.0;
        eprintln!(
            "  {} : 候補 {} 件  代理評価 {} 回  {:.1} ms",
            label,
            all.len(),
            evals,
            ms
        );
        results.push((label, all, evals, ms));
    }

    // どちらも最終選抜は期待値で行う (同じ土俵にする)。
    let mut finals: Vec<(&str, Vec<usize>, f64, f64)> = Vec::new();
    for (label, all, _, _) in &results {
        let mut pool = all.clone();
        pool.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        pool.truncate(verify_num);

        let start = Instant::now();
        let means: Vec<f64> = pool
            .par_iter()
            .map(|(cells, _)| {
                score(
                    &config,
                    &field,
                    &next_puyos,
                    &setup,
                    cells,
                    true_trace,
                    &final_sample_set,
                )
            })
            .collect();
        let ms = start.elapsed().as_secs_f64() * 1000.0;

        let best_i = (0..means.len())
            .max_by(|&a, &b| means[a].partial_cmp(&means[b]).unwrap())
            .unwrap();
        let best_cells = pool[best_i].0.clone();
        let deterministic = score(
            &config,
            &field,
            &next_puyos,
            &setup,
            &best_cells,
            true_trace,
            &[],
        );
        println!(
            "{}: 期待値={:.1}  決定論値={:.1}  塗り数={}  最終選抜 {:.1} ms",
            label,
            means[best_i],
            deterministic,
            best_cells.len(),
            ms
        );
        finals.push((label, best_cells, means[best_i], deterministic));
    }

    // 期待値ビームの勝者が、決定論ビームの候補集合に含まれていたか。
    let det_pool: HashSet<Bits> = results[0]
        .1
        .iter()
        .map(|(cells, _)| cells.iter().fold(0u64, |m, &i| m | bit(i)))
        .collect();
    let ev_winner_key = finals[1].1.iter().fold(0u64, |m, &i| m | bit(i));

    println!();
    println!(
        "期待値ビームの勝者は決定論ビームの候補集合に {}",
        if det_pool.contains(&ev_winner_key) {
            "含まれていた (決定論探索でも到達可能だった)"
        } else {
            "含まれていなかった (決定論探索では到達できない案)"
        }
    );
    println!(
        "期待値での比較: 決定論ビーム {:.1} vs 期待値ビーム {:.1}  → 決定論ビームの取りこぼし {:.4}",
        finals[0].2,
        finals[1].2,
        finals[0].2 / finals[1].2
    );
}
