//! 前段「ぷよ塗り」の候補をビームサーチで探し、全数列挙の真値と突き合わせる計測用バイナリ。
//!
//! ## なぜ要るか
//!
//! 有効な塗り集合は最大で 9,600 万件あり、全件に代理評価 (なぞり4の全探索) を掛けると
//! 2.5 時間かかる。ビームサーチなら評価回数が **候補総数に依存せず**
//! 深さ × ビーム幅 × 分岐 で決まるので、盤面がどれだけ極端でも数秒で終わる。
//!
//! 根拠は、全数列挙の真値で `best_by_paint_size` が塗り数に対して単調増加していたこと。
//! 「良い k+1 マス塗りは、良い k マス塗りに1マス足したもの」という構造が期待できる。
//! ただしこれは示唆であって保証ではない (2マス同時に置いて初めて効く橋渡しを取りこぼす)
//! ため、真値と突き合わせて実測する。
//!
//! ## 手順
//!
//! 1. 空集合から始め、深さごとに「候補マスを1つ足した集合」をすべて作る
//! 2. ハード制約 (塗り後に1つも消えない) を満たすものだけ残す
//! 3. 代理評価 (`--surrogate` なぞり数) で並べ、上位 `--beam` 件だけ次の深さへ
//! 4. 全深さのビーム内容をまとめ、代理の上位 `--verify` 件を本番評価 (`--trace`) して最良を採る
//!
//! ## 使い方
//!
//!   cargo run --release --bin paint_beam -- --seed 1 --color red --category tsukai \
//!       --boost all --beam 100 --surrogate 4 --truth 234
//!   cargo run --release --bin paint_beam -- --seed 3 --color green --beam 200   # 9,600万件のケース

use std::collections::HashSet;
use std::env;
use std::time::Instant;

use rayon::prelude::*;

use solver::paint::{bit, component_size_capped, Bits, PaintFilter, PaintSetup};
use solver::puyo::{Field, NextPuyos};
use solver::puyo_attr::PuyoAttr;
use solver::solution::SolutionResult;

mod common;
use common::{
    default_priorities, flag, format_field, natsuama_field, natsuama_next_puyos, parse_boost_area,
    parse_category, parse_color, parse_preference, random_board, value_of, EvalConfig,
    RandomBoardSpec,
};

/// ビームの1要素。塗るマスの集合を、順序付きリストとビットマスクの両方で持つ。
#[derive(Clone)]
struct BeamNode {
    cells: Vec<usize>,
    /// 塗り色の現在のビットボード (初期盤面の塗り色 + 塗ったマス)。制約判定の増分計算に使う。
    board: Bits,
    /// 重複排除用の、塗ったマスだけのビットマスク。
    key: Bits,
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
        .unwrap_or(500);
    // 全数列挙で求めた真値 (分かっていれば採点に使う)。
    let truth: Option<f64> = flag(&args, "--truth").and_then(|s| s.parse().ok());

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
    let masks = solver::paint::build_neighbor_masks();

    eprintln!(
        "board={}  paint_color={:?}  max_paint={}  filter={}  M={}  beam={}  \
         surrogate=trace{}  verify={}  true_trace={}\n{}",
        board_name,
        target,
        max_paint_num,
        filter.name(),
        setup.candidates.len(),
        beam_width,
        surrogate_trace,
        verify_num,
        true_trace,
        format_field(&field)
    );

    let start = Instant::now();
    let mut surrogate_evals = 0u64;

    // 全深さで見た集合をまとめておき、最後に代理の上位だけ本番評価する。
    let mut seen_all: Vec<(Vec<usize>, f64)> = Vec::new();

    let mut beam: Vec<BeamNode> = vec![BeamNode {
        cells: Vec::new(),
        board: setup.base_board,
        key: 0,
    }];
    // 「塗らない」も候補の1つ。
    seen_all.push((Vec::new(), f64::NEG_INFINITY));

    for depth in 1..=max_paint_num {
        // 展開: 各ノードに候補マスを1つ足す。制約違反と重複はここで落とす。
        let mut expanded: Vec<BeamNode> = Vec::new();
        let mut keys: HashSet<Bits> = HashSet::new();

        for node in &beam {
            for &index in &setup.candidates {
                if node.key & bit(index) != 0 {
                    continue;
                }
                let board = node.board | bit(index);
                if component_size_capped(board, index, &masks, setup.max_component)
                    > setup.max_component
                {
                    continue;
                }
                let key = node.key | bit(index);
                if !keys.insert(key) {
                    continue;
                }
                let mut cells = node.cells.clone();
                cells.push(index);
                expanded.push(BeamNode { cells, board, key });
            }
        }

        if expanded.is_empty() {
            eprintln!("深さ {} で展開先が尽きた", depth);
            break;
        }

        // 代理評価して上位 beam_width 件だけ残す。
        let scores: Vec<f64> = expanded
            .par_iter()
            .map(|node| {
                let painted = setup.apply(&field, &node.cells);
                value_of(&config.best_solution(&painted, &next_puyos, surrogate_trace))
            })
            .collect();
        surrogate_evals += expanded.len() as u64;

        let mut order: Vec<usize> = (0..expanded.len()).collect();
        order.sort_by(|&i, &j| scores[j].partial_cmp(&scores[i]).unwrap());
        order.truncate(beam_width);

        for &i in &order {
            seen_all.push((expanded[i].cells.clone(), scores[i]));
        }
        beam = order.iter().map(|&i| expanded[i].clone()).collect();

        eprintln!(
            "  深さ {:>2}: 展開 {:>6} 件 → ビーム {:>4} 件  代理最良={:.1}",
            depth,
            expanded.len(),
            beam.len(),
            scores[order[0]]
        );
    }

    let beam_ms = start.elapsed().as_secs_f64() * 1000.0;

    // 代理スコアの上位 verify_num 件を本番評価する。
    seen_all.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    seen_all.truncate(verify_num);

    let verify_start = Instant::now();
    let solutions: Vec<Option<SolutionResult>> = seen_all
        .par_iter()
        .map(|(cells, _)| {
            let painted = setup.apply(&field, cells);
            config.best_solution(&painted, &next_puyos, true_trace)
        })
        .collect();
    let verify_ms = verify_start.elapsed().as_secs_f64() * 1000.0;

    let best = config.pick_best(solutions.iter());
    let best_value = best.map(|s| s.value).unwrap_or(0.0);
    let best_paint_num = solutions
        .iter()
        .position(|s| s.as_ref().map(|s| s.value) == Some(best_value))
        .map(|i| seen_all[i].0.len())
        .unwrap_or(0);

    println!(
        "beam={:<4} surrogate=trace{}  best={:.1}  塗り数={}  代理評価={}回 ({:.1} ms)  \
         本番評価={}回 ({:.1} ms)  合計={:.1} ms",
        beam_width,
        surrogate_trace,
        best_value,
        best_paint_num,
        surrogate_evals,
        beam_ms,
        solutions.len(),
        verify_ms,
        beam_ms + verify_ms
    );
    if let Some(truth) = truth {
        println!(
            "        真値={:.1}  到達率={:.4}",
            truth,
            best_value / truth
        );
    }
}
