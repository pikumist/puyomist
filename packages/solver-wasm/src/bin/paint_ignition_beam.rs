//! 塗り発火探索のビームサーチを、厳密列挙の真値と突き合わせる計測用バイナリ。
//!
//! 設計メモ `docs/research/paint-ignition-search.md` §8 の手順に対応する。
//!
//! ## 何を測るのか
//!
//! 1. **到達率** (§8-1): 厳密列挙の真値に対して、ビームがどれだけ届くか。
//!    上方閉なので通常サイズでは真値が取れない。候補マスと塗り上限を絞った
//!    小規模問題で測る
//! 2. **§7 の3つの対策案**: 重複排除のキー (`--dedup`)、発火後の打ち切り (`--stop`)、
//!    未発火のためのビーム枠 (`--reserve`) を振って比べる
//! 3. **候補フィルタ** (§8-4): `--filter` を振って比べる。既存の塗り探索とは
//!    結論が逆転する可能性が高い (`adj1` の「塗りマス同士が必ず繋がる」性質が
//!    今回は長所になる)
//!
//! ## 計測条件 (paint-search.md §9 を踏襲)
//!
//! - **通常盤面** (ランダム生成・初期消えなしの棄却サンプリング) で測る。
//!   組み込みの特殊盤面は連鎖が仕込まれているので誤った結論が出る
//! - 最低消し数は**生成器と評価器に同じ値**を渡す (`--min-pop` が両方に効く)
//! - 不確定ぷよは見ない (決定論評価のみ)。確率的評価を混ぜない
//! - 調整用の seed と最終評価用の seed を分けること (`--seed`)
//!
//! ## 使い方
//!
//!   # 真値との突き合わせ (候補14マス・上限4の小規模問題を20盤面)
//!   cargo run --release --bin paint_ignition_beam -- --boards 20 --truth-cells 14 --max 4
//!
//!   # §7 の対策案を振る
//!   cargo run --release --bin paint_ignition_beam -- --boards 20 --sweep dedup
//!
//!   # 候補フィルタを振る (§8-4)
//!   cargo run --release --bin paint_ignition_beam -- --boards 20 --sweep filter
//!
//!   # ビーム幅の収束 (§8-1)。--reserve は幅に対する割合(%)
//!   cargo run --release --bin paint_ignition_beam -- --boards 20 --sweep width --max 6 --reserve 50
//!
//!   # 未発火の集合の並べ方 (§9-1)
//!   cargo run --release --bin paint_ignition_beam -- --boards 2000 --sweep surrogate --beam 100

use std::env;
use std::time::Instant;

use rayon::prelude::*;

use solver::exploration_target::{ExplorationCategory, ExplorationTarget, PreferenceKind};
use solver::paint::PaintFilter;
use solver::paint_ignition::{better_ignition, IgnitionEvaluator, IgnitionSetup, IgnitionSolution};
use solver::solution_explorer::better_solution;
use solver::paint_ignition_search::{
    enumerate_exhaustive, paint_set_count, search_beam, search_ils, BeamParams, DedupMode,
    IlsParams, SurrogateMode,
};
use solver::puyo::{Field, NextPuyos};
use solver::puyo_attr::PuyoAttr;
use solver::puyo_coord::PuyoCoord;
use solver::simulation_environment::SimulationEnvironment;
use solver::trace_mode::TraceMode;
use std::collections::{HashMap, HashSet};

mod common;
use common::{
    default_priorities, flag, format_field, natsuama_field, natsuama_next_puyos, parse_boost_area,
    parse_category, parse_color, random_board, RandomBoardSpec,
};

/// 1つの探索設定。ビームと ILS を**同じ評価回数**で比べられるようにする (設計メモ §9-7)。
#[derive(Clone)]
enum Method {
    Beam(BeamParams),
    /// 予算は `None` なら「**ペアになっているビーム設定**が同じ盤面で使った評価回数」に合わせる。
    /// 既定のビーム設定で測ると、幅や重複排除を振ったときに予算が揃わない。
    Ils {
        params: IlsParams,
        paired_beam: Option<BeamParams>,
    },
}

/// 1盤面 × 1設定ぶんの計測結果。
struct Row {
    board: String,
    label: String,
    /// ビームが出した比較キー (評価値, 塗り数)。
    beam: Option<(f64, usize)>,
    /// 厳密列挙の真値。`--truth` を切ると `None`。
    truth: Option<(f64, usize)>,
    /// ビームが真値と同じ比較キーに届いたか。
    reached: Option<bool>,
    evaluated: u64,
    elapsed_ms: f64,
    /// 深さごとの「ビームに残した発火済みの本数 / うち異なる連鎖」。
    diversity: String,
    /// この設定が使った候補マス数 (フィルタで間引かれた後)。
    candidate_num: usize,
    /// 探索が出した解そのもの。**最良既知値**との突き合わせに使う (設計メモ §8-1)。
    solution: Option<IgnitionSolution>,
    /// この盤面の基準解 (`--reference-seeds` を指定したときだけ入る)。
    reference: Option<IgnitionSolution>,
}

fn key_of(solution: &Option<IgnitionSolution>) -> Option<(f64, usize)> {
    solution.as_ref().map(|s| (s.result.value, s.paint_set.len()))
}

/// 運用優先順位 (チャンス → 評価値 → プリズム → 全消し → 塗り数) の上で同値か。
///
/// **`better_ignition` を使ってはいけない。** あれは同値のときマスクで決着させるので、
/// 「評価上は最適だが真値とは違う集合」を見つけたケースを取りこぼし扱いにしてしまう。
/// 塗り集合が違っても運用上は同じ価値なので、到達したと数えるべき。
fn ties(priorities: &Vec<PreferenceKind>, a: &IgnitionSolution, b: &IgnitionSolution) -> bool {
    std::ptr::eq(better_solution(priorities, &a.result, &b.result), &a.result)
        && std::ptr::eq(better_solution(priorities, &b.result, &a.result), &b.result)
}

fn main() {
    let args: Vec<String> = env::args().collect();

    let boards: usize = flag(&args, "--boards")
        .and_then(|s| s.parse().ok())
        .unwrap_or(10);
    let seed_start: u64 = flag(&args, "--seed")
        .and_then(|s| s.parse().ok())
        .unwrap_or(1);
    let use_natsuama = args.iter().any(|a| a == "--natsuama");
    let color = flag(&args, "--color")
        .and_then(parse_color)
        .unwrap_or(PuyoAttr::Red);
    let category = flag(&args, "--category")
        .map(parse_category)
        .unwrap_or(ExplorationCategory::Damage);
    let boost_area = flag(&args, "--boost")
        .map(parse_boost_area)
        .unwrap_or_default();
    let max_paint_num: usize = flag(&args, "--max")
        .and_then(|s| s.parse().ok())
        .unwrap_or(4);
    let min_pop: u32 = flag(&args, "--min-pop")
        .and_then(|s| s.parse().ok())
        .unwrap_or(4);
    let filter = flag(&args, "--filter")
        .and_then(PaintFilter::parse)
        .unwrap_or(PaintFilter::All);
    let beam_width: usize = flag(&args, "--beam")
        .and_then(|s| s.parse().ok())
        .unwrap_or(100);
    // 既定は **ライブラリの既定 (`BeamParams::new`) に揃える**。
    // ここだけ別の既定にしておくと、フラグを省いた計測が本番と違う設定で回る。
    let dedup = flag(&args, "--dedup")
        .and_then(DedupMode::parse)
        .unwrap_or(DedupMode::Mask);
    let surrogate = flag(&args, "--surrogate")
        .and_then(SurrogateMode::parse)
        .unwrap_or(SurrogateMode::CriticalSeeds);
    let stop_on_ignition = args.iter().any(|a| a == "--stop");
    // 未発火のための枠は**幅に対する割合(%)**で指定する。スロット数で受けると、
    // 幅を振ったときに意味が変わって取り違えるため (一度やった)。
    let reserve_pct: usize = flag(&args, "--reserve")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let reserve = beam_width * reserve_pct / 100;
    // 真値を出すために候補マスをこの数に絞る。0 なら絞らない。
    let truth_cells: usize = flag(&args, "--truth-cells")
        .and_then(|s| s.parse().ok())
        .unwrap_or(14);
    let truth_limit: u128 = flag(&args, "--truth-limit")
        .and_then(|s| s.parse().ok())
        .unwrap_or(20_000_000);
    let no_truth = args.iter().any(|a| a == "--no-truth");
    let method = flag(&args, "--method").unwrap_or("beam").to_string();
    // ILS の評価回数の予算。省略時は同じ盤面のビームが使った回数に合わせる。
    let budget: Option<u64> = flag(&args, "--budget").and_then(|s| s.parse().ok());
    let ils_seed: u64 = flag(&args, "--ils-seed")
        .and_then(|s| s.parse().ok())
        .unwrap_or(1);
    // 最良既知値の作り方 (設計メモ §9-0(c) / §9-9)。比べる設定の顔ぶれに依存しない
    // 固定の基準を作るため、ILS を seed 違いで何本か回した和集合を使う。
    // 0 なら従来どおり「その実行で比べた設定の最良」。
    let reference_seeds: u64 = flag(&args, "--reference-seeds")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let reference_budget: u64 = flag(&args, "--reference-budget")
        .and_then(|s| s.parse().ok())
        .unwrap_or(500_000);
    let sweep = flag(&args, "--sweep").unwrap_or("none").to_string();
    let verbose = args.iter().any(|a| a == "--verbose");


    let priorities = default_priorities();
    let exploration_target = ExplorationTarget {
        category,
        preference_priorities: priorities.clone(),
        optimal_solution_count: 1,
        main_attr: match category {
            ExplorationCategory::PuyotsukaiCount => None,
            _ => Some(color),
        },
        sub_attr: None,
        main_sub_ratio: None,
        counting_bonus: None,
    };
    let environment = SimulationEnvironment {
        is_chance_mode: false,
        minimum_puyo_num_for_popping: min_pop,
        max_trace_num: 0, // なぞらないので使わない
        trace_mode: TraceMode::Normal, // 評価器が塗り色の To* に差し替える
        popping_leverage: 7.5,
        chain_leverage: 10.5,
    };
    // **生成器にも同じ最低消し数を渡す** (設計メモ §8-3)。
    let spec = RandomBoardSpec {
        minimum_puyo_num_for_popping: min_pop,
        ..RandomBoardSpec::default()
    };

    // 不確定ぷよ (期待値) が発火探索の選抜を変えるかを測るモード。
    if args.iter().any(|a| a == "--ev-probe") {
        ev_probe(boards, seed_start, &spec, color, &environment, &exploration_target);
        return;
    }

    // 代理スコアの解像度だけを測るモード (設計メモ §9-1 の原因切り分け)。
    if args.iter().any(|a| a == "--surrogate-stats") {
        surrogate_stats(boards, seed_start, &spec, color, min_pop);
        return;
    }

    // 振る設定の一覧。
    let configs: Vec<(String, PaintFilter, BeamParams)> = match sweep.as_str() {
        "none" => vec![(
            format!("beam{}/{}", beam_width, dedup.name()),
            filter,
            BeamParams {
                max_paint_num,
                beam_width,
                dedup,
                surrogate,
                stop_on_ignition,
                unignited_reserve: reserve,
            },
        )],
        // §7 の3つの対策案。
        "dedup" => {
            let mut v = Vec::new();
            for d in [DedupMode::Mask, DedupMode::Signature] {
                for (stop, pct) in [(false, 0usize), (false, 25), (true, 0)] {
                    let res = beam_width * pct / 100;
                    v.push((
                        format!(
                            "{}{}{}",
                            d.name(),
                            if stop { "+stop" } else { "" },
                            if pct > 0 { format!("+res{}%", pct) } else { String::new() }
                        ),
                        filter,
                        BeamParams {
                            max_paint_num,
                            beam_width,
                            dedup: d,
                            surrogate,
                            stop_on_ignition: stop,
                            unignited_reserve: res,
                        },
                    ));
                }
            }
            v
        }
        // §8-4 の候補フィルタ。
        "filter" => [
            PaintFilter::All,
            PaintFilter::Adj1,
            PaintFilter::Adj1Special,
            PaintFilter::Adj2,
            PaintFilter::Adj2Special,
        ]
        .into_iter()
        .map(|f| {
            (
                f.name().to_string(),
                f,
                BeamParams {
                    max_paint_num,
                    beam_width,
                    dedup,
                    surrogate,
                    stop_on_ignition,
                    unignited_reserve: reserve,
                },
            )
        })
        .collect(),
        // §8-1 のビーム幅の収束。
        "width" => [1usize, 5, 20, 100, 400, 1600]
            .into_iter()
            .map(|w| {
                (
                    format!("w{}", w),
                    filter,
                    BeamParams {
                        max_paint_num,
                        beam_width: w,
                        dedup,
                        surrogate,
                        stop_on_ignition,
                        // 幅ごとに割合から計算し直す。
                        unignited_reserve: w * reserve_pct / 100,
                    },
                )
            })
            .collect(),
        // §7 案3 の「多様性の枠取り」をどこまで取るか。
        // 100% は「未発火を先に残す」= 発火済み優先をやめるのに等しい。
        "reserve" => [0usize, 5, 10, 20, 30, 50]
            .into_iter()
            .map(|pct| {
                (
                    format!("res{}%", pct),
                    filter,
                    BeamParams {
                        max_paint_num,
                        beam_width,
                        dedup,
                        surrogate,
                        stop_on_ignition,
                        unignited_reserve: beam_width * pct / 100,
                    },
                )
            })
            .collect(),
        // §9-1 の代理スコア (未発火の集合の並べ方)。
        "surrogate" => [
            SurrogateMode::LargestComponent,
            SurrogateMode::CriticalSeeds,
        ]
        .into_iter()
        .flat_map(|m| {
            [0usize, 50].into_iter().map(move |pct| {
                (
                    format!("{}+res{}%", m.name(), pct),
                    filter,
                    BeamParams {
                        max_paint_num,
                        beam_width,
                        dedup,
                        surrogate: m,
                        stop_on_ignition,
                        unignited_reserve: beam_width * pct / 100,
                    },
                )
            })
        })
        .collect(),
        // §9-9 の精度プリセット決め。評価回数 (≒時間) を振る。
        // `--method ils` と併せて使う (ビームには効かない)。
        "budget" => [8_000u64, 20_000, 56_000, 160_000, 500_000, 1_500_000]
            .into_iter()
            .map(|b| {
                (
                    format!("b{}", b),
                    filter,
                    BeamParams {
                        max_paint_num,
                        // 予算はラベルから読む (ILS 側で使う)。
                        beam_width: (b / 1000).max(1) as usize,
                        dedup,
                        surrogate,
                        stop_on_ignition,
                        unignited_reserve: reserve,
                    },
                )
            })
            .collect(),
        other => panic!(
            "未知の --sweep: {} (none|dedup|filter|width|reserve|surrogate|budget)",
            other
        ),
    };

    // 探索方式を選ぶ。`--method ils` のときは、同じ盤面のビームが使った評価回数を
    // 予算にして**同じ計算量で**比べる (`--budget` で明示指定も可)。
    let configs: Vec<(String, PaintFilter, Method)> = match method.as_str() {
        "beam" => configs
            .into_iter()
            .map(|(label, filter, params)| (label, filter, Method::Beam(params)))
            .collect(),
        "ils" => configs
            .into_iter()
            .map(|(label, filter, params)| {
                // `--sweep budget` のラベル (`b<評価回数>`) からは予算を直接読む。
                let from_label = label
                    .strip_prefix('b')
                    .and_then(|n| n.parse::<u64>().ok());
                let ils = IlsParams {
                    seed: ils_seed,
                    ..IlsParams::new(from_label.or(budget).unwrap_or(0))
                };
                let paired_beam = (from_label.is_none() && budget.is_none())
                    .then(|| params.clone());
                (
                    format!("ils/{}", label),
                    filter,
                    Method::Ils {
                        params: ils,
                        paired_beam,
                    },
                )
            })
            .collect(),
        "both" => configs
            .into_iter()
            .flat_map(|(label, filter, params)| {
                let ils = IlsParams {
                    seed: ils_seed,
                    ..IlsParams::new(budget.unwrap_or(0))
                };
                let paired_beam = budget.is_none().then(|| params.clone());
                [
                    (format!("beam/{}", label), filter, Method::Beam(params)),
                    (
                        format!("ils/{}", label),
                        filter,
                        Method::Ils {
                            params: ils,
                            paired_beam,
                        },
                    ),
                ]
            })
            .collect(),
        other => panic!("未知の --method: {} (beam|ils|both)", other),
    };

    println!(
        "# 塗り発火探索 / 盤面{}枚 seed={}.. 色={:?} カテゴリ={:?} 塗り上限={} 最低消し数={} 真値候補={}",
        boards, seed_start, color, category, max_paint_num, min_pop, truth_cells
    );

    let rows: Vec<Row> = (0..boards)
        .into_par_iter()
        .flat_map(|i| {
            let (field, next_puyos, board_name): (Field, NextPuyos, String) = if use_natsuama {
                (natsuama_field(), natsuama_next_puyos(), "natsuama/1".into())
            } else {
                let seed = seed_start + i as u64;
                let (f, n) = random_board(seed, &spec);
                (f, n, format!("random/{}", seed))
            };

            if verbose {
                println!("# {}\n{}", board_name, format_field(&field));
            }

            let Some(evaluator) = IgnitionEvaluator::new(
                &exploration_target,
                &environment,
                &boost_area,
                &field,
                &next_puyos,
                color,
            ) else {
                panic!("塗り色が色ぷよでない: {:?}", color);
            };

            // 問題の定義は**絞り込みなしの候補**で行う。候補フィルタを振るときに
            // フィルタごとの候補で真値を出すと、フィルタが落とした解が真値からも
            // 消えてしまい「取りこぼし」を測れない (設計メモ §8-4)。
            let base_setup = IgnitionSetup::new(
                &field,
                &next_puyos,
                &environment,
                color,
                max_paint_num,
                PaintFilter::All,
            );
            let problem_cells: Vec<usize> = if truth_cells == 0 {
                base_setup.candidates.clone()
            } else {
                base_setup
                    .candidates
                    .iter()
                    .copied()
                    .take(truth_cells)
                    .collect()
            };

            // 基準解: ILS を seed 違いで回した和集合の最良。盤面につき1回だけ出す。
            // **比べる設定の顔ぶれに依存しない**ので、実行をまたいで比較できる。
            let reference = if reference_seeds == 0 {
                None
            } else {
                let reference_setup = IgnitionSetup {
                    target: base_setup.target,
                    max_paint_num,
                    base_board: base_setup.base_board,
                    raw_candidates: base_setup.raw_candidates.clone(),
                    candidates: problem_cells.clone(),
                };
                let mut best: Option<IgnitionSolution> = None;
                for seed in 1..=reference_seeds {
                    let r = search_ils(
                        &reference_setup,
                        &evaluator,
                        &IlsParams {
                            seed,
                            ..IlsParams::new(reference_budget)
                        },
                    );
                    if let Some(s) = r.best {
                        let replace = match &best {
                            None => true,
                            Some(current) => std::ptr::eq(
                                better_ignition(&priorities, &s, current),
                                &s,
                            ),
                        };
                        if replace {
                            best = Some(s);
                        }
                    }
                }
                best
            };

            // 真値は盤面につき1回だけ出す (全設定で共有する)。
            let truth = if no_truth || paint_set_count(problem_cells.len(), max_paint_num) > truth_limit
            {
                None
            } else {
                Some(enumerate_exhaustive(
                    &problem_cells,
                    max_paint_num,
                    &evaluator,
                ))
            };

            configs
                .iter()
                .map(|(label, f, method)| {
                    let method_max = match method {
                        Method::Beam(p) => p.max_paint_num,
                        // ILS の塗り上限は IgnitionSetup から取る。
                        Method::Ils { paired_beam, .. } => paired_beam
                            .as_ref()
                            .map(|p| p.max_paint_num)
                            .unwrap_or(max_paint_num),
                    };
                    // フィルタは問題の候補をさらに間引く形で当てる (部分集合になる)。
                    let filtered = IgnitionSetup::new(
                        &field,
                        &next_puyos,
                        &environment,
                        color,
                        method_max,
                        *f,
                    );
                    let allowed: HashSet<usize> = filtered.candidates.iter().copied().collect();
                    let cells: Vec<usize> = problem_cells
                        .iter()
                        .copied()
                        .filter(|c| allowed.contains(c))
                        .collect();
                    let narrowed = IgnitionSetup {
                        target: base_setup.target,
                        max_paint_num: method_max,
                        base_board: base_setup.base_board,
                        raw_candidates: base_setup.raw_candidates.clone(),
                        candidates: cells,
                    };

                    // ILS で予算をビームに合わせる場合は、先にビームを回して回数を測る。
                    // **この計測ぶんは ILS の所要時間には含めない**。
                    let ils_budget = match method {
                        Method::Beam(_) => 0,
                        Method::Ils {
                            params,
                            paired_beam,
                        } => match paired_beam {
                            // **ペアのビーム設定そのもの**で回した回数を予算にする。
                            Some(beam_params) => {
                                search_beam(&narrowed, &evaluator, beam_params).evaluated
                            }
                            None => params.budget,
                        },
                    };

                    let started = Instant::now();
                    let (best, evaluated, depth_stats) = match method {
                        Method::Beam(params) => {
                            let r = search_beam(&narrowed, &evaluator, params);
                            (r.best, r.evaluated, r.depth_stats)
                        }
                        Method::Ils { params, .. } => {
                            let r = search_ils(
                                &narrowed,
                                &evaluator,
                                &IlsParams {
                                    budget: ils_budget,
                                    ..params.clone()
                                },
                            );
                            (r.best, r.evaluated, Vec::new())
                        }
                    };
                    let elapsed_ms = started.elapsed().as_secs_f64() * 1000.0;

                    let beam_key = key_of(&best);
                    let truth_key = truth.as_ref().and_then(|t| key_of(&t.best));
                    // 真値が無いときは判定しない (0% と欠測を混ぜない)。
                    let reached = match (truth.as_ref(), &best) {
                        (None, _) => None,
                        (Some(t), beam_best) => match (beam_best, t.best.as_ref()) {
                            (Some(b), Some(tb)) => Some(ties(&priorities, b, tb)),
                            (None, None) => Some(true),
                            _ => Some(false),
                        },
                    };

                    let diversity = depth_stats
                        .iter()
                        .map(|s| format!("{}:{}/{}", s.depth, s.distinct_chains, s.ignited_kept))
                        .collect::<Vec<_>>()
                        .join(" ");

                    Row {
                        board: board_name.clone(),
                        label: label.clone(),
                        candidate_num: narrowed.candidates.len(),
                        beam: beam_key,
                        truth: truth_key,
                        reached,
                        evaluated,
                        elapsed_ms,
                        diversity,
                        solution: best,
                        reference: reference.clone(),
                    }
                })
                .collect::<Vec<Row>>()
        })
        .collect();

    println!(
        "\n{:<14} {:<22} {:>12} {:>6} {:>12} {:>6} {:>6} {:>10} {:>9}  深さ:異なる連鎖/発火済み",
        "盤面", "設定", "探索の値", "塗り", "真値", "塗り", "到達", "評価件数", "ms"
    );
    for row in &rows {
        let fmt_key = |k: &Option<(f64, usize)>| match k {
            None => ("-".to_string(), "-".to_string()),
            Some((v, n)) => (format!("{:.1}", v), n.to_string()),
        };
        let (bv, bn) = fmt_key(&row.beam);
        let (tv, tn) = fmt_key(&row.truth);
        println!(
            "{:<14} {:<22} {:>12} {:>6} {:>12} {:>6} {:>6} {:>10} {:>9.1}  {}",
            row.board,
            row.label,
            bv,
            bn,
            tv,
            tn,
            match row.reached {
                None => "-",
                Some(true) => "○",
                Some(false) => "×",
            },
            row.evaluated,
            row.elapsed_ms,
            row.diversity
        );
    }

    // 最良既知値 (設計メモ §8-1): 真値が取れない規模では、全設定の結果のうち
    // 運用優先順位で最良のものを基準にする。**幅を広げれば必ず良くなる保証は無い**ので
    // (§4 のとおり評価値は単調でない)、最大幅の結果だけを基準にしてはいけない。
    let mut known_best: HashMap<String, IgnitionSolution> = HashMap::new();
    // 基準解があるならそれを土台にする (実行をまたいで比較できる)。
    for row in &rows {
        if let Some(r) = &row.reference {
            known_best.entry(row.board.clone()).or_insert_with(|| r.clone());
        }
    }
    for row in &rows {
        let Some(s) = &row.solution else { continue };
        match known_best.get(&row.board) {
            None => {
                known_best.insert(row.board.clone(), s.clone());
            }
            Some(current) => {
                if std::ptr::eq(better_ignition(&priorities, s, current), s) {
                    known_best.insert(row.board.clone(), s.clone());
                }
            }
        }
    }

    // 設定ごとの集計。
    println!(
        "\n{:<22} {:>8} {:>10} {:>11} {:>8} {:>10} {:>12} {:>10}",
        "設定", "到達率", "既知最良率", "値/既知最良", "候補数", "平均塗り", "平均評価件数", "平均ms"
    );
    for (label, _, _) in &configs {
        let mine: Vec<&Row> = rows.iter().filter(|r| &r.label == label).collect();
        if mine.is_empty() {
            continue;
        }
        let judged: Vec<&&Row> = mine.iter().filter(|r| r.reached.is_some()).collect();
        let reached = judged.iter().filter(|r| r.reached == Some(true)).count();
        let rate = if judged.is_empty() {
            f64::NAN
        } else {
            reached as f64 / judged.len() as f64 * 100.0
        };
        let paint_avg = average(mine.iter().filter_map(|r| r.beam.map(|(_, n)| n as f64)));
        let eval_avg = average(mine.iter().map(|r| r.evaluated as f64));
        let ms_avg = average(mine.iter().map(|r| r.elapsed_ms));
        let diversity_avg = average(mine.iter().filter_map(|r| diversity_ratio(&r.diversity)));
        let cand_avg = average(mine.iter().map(|r| r.candidate_num as f64));
        // 最良既知値に並んだ盤面の割合。
        let matched = mine
            .iter()
            .filter(|r| match (&r.solution, known_best.get(&r.board)) {
                (Some(s), Some(k)) => ties(&priorities, s, k),
                _ => false,
            })
            .count();
        let known_rate = matched as f64 / mine.len() as f64 * 100.0;
        // 値の比。一致率だけだと「惜しい」と「全然だめ」が区別できない。
        let value_ratio = average(mine.iter().filter_map(|r| {
            let s = r.solution.as_ref()?;
            let k = known_best.get(&r.board)?;
            if k.result.value == 0.0 {
                None
            } else {
                Some(s.result.value / k.result.value)
            }
        }));
        let _ = diversity_avg;
        println!(
            "{:<22} {:>7.1}% {:>9.1}% {:>11.4} {:>8.1} {:>10.2} {:>12.0} {:>10.1}",
            label, rate, known_rate, value_ratio, cand_avg, paint_avg, eval_avg, ms_avg
        );
    }
}

fn average(values: impl Iterator<Item = f64>) -> f64 {
    let mut sum = 0.0;
    let mut n = 0usize;
    for v in values {
        sum += v;
        n += 1;
    }
    if n == 0 {
        f64::NAN
    } else {
        sum / n as f64
    }
}

/// `"1:3/3 2:20/40"` から、最後の深さの「異なる連鎖 / 発火済み」の比を取り出す。
fn diversity_ratio(diversity: &str) -> Option<f64> {
    let last = diversity.split_whitespace().last()?;
    let (_, pair) = last.split_once(':')?;
    let (distinct, ignited) = pair.split_once('/')?;
    let distinct: f64 = distinct.parse().ok()?;
    let ignited: f64 = ignited.parse().ok()?;
    if ignited == 0.0 {
        None
    } else {
        Some(distinct / ignited)
    }
}


/// 未発火の塗り集合を並べる代理スコアが、どれだけ候補を区別できているかを測る。
///
/// 設計メモ §9-1「ビーム幅が収束しない」の原因切り分け。第1キー (塗り色の最大連結成分) が
/// 初期盤面の時点で飽和していれば、スコアは実質第2キーだけで動いていることになる。
fn surrogate_stats(
    boards: usize,
    seed_start: u64,
    spec: &RandomBoardSpec,
    color: PuyoAttr,
    min_pop: u32,
) {
    use solver::paint::{bit, build_neighbor_masks, component_size_capped, Bits, CELL_NUM};
    use solver::puyo_type::get_attr;

    let masks = build_neighbor_masks();
    let max_component = min_pop - 1;

    // 初期盤面の塗り色の最大連結成分の分布。
    let mut largest_hist = vec![0usize; (max_component + 2) as usize];
    // 深さ1の未発火候補のうち、代理スコアが何通りに分かれるか。
    let mut distinct_scores: Vec<f64> = Vec::new();
    let mut unignited_counts: Vec<f64> = Vec::new();
    let mut top_ties: Vec<f64> = Vec::new();

    for i in 0..boards {
        let seed = seed_start + i as u64;
        let (field, next_puyos) = random_board(seed, spec);

        let mut base_board: Bits = 0;
        for index in 0..CELL_NUM {
            if let Some(p) = field[index / 8][index % 8] {
                if get_attr(p.puyo_type) == color {
                    base_board |= bit(index);
                }
            }
        }

        // 初期盤面の最大連結成分 (max_component で頭打ちにする)。
        let mut largest = 0u32;
        let mut remaining = base_board;
        while remaining != 0 {
            let seed_index = remaining.trailing_zeros() as usize;
            let size = component_size_capped(base_board, seed_index, &masks, max_component);
            largest = largest.max(size.min(max_component));
            // 成分を取り除く。
            let mut component = bit(seed_index);
            loop {
                let mut grown = component;
                let mut c = component;
                while c != 0 {
                    let k = c.trailing_zeros() as usize;
                    c &= c - 1;
                    grown |= masks[k] & base_board;
                }
                if grown == component {
                    break;
                }
                component = grown;
            }
            remaining &= !component;
        }
        largest_hist[largest as usize] += 1;

        // 深さ1の未発火候補の代理スコア。
        let environment = SimulationEnvironment {
            is_chance_mode: false,
            minimum_puyo_num_for_popping: min_pop,
            max_trace_num: 0,
            trace_mode: TraceMode::Normal,
            popping_leverage: 7.5,
            chain_leverage: 10.5,
        };
        let target = ExplorationTarget {
            category: ExplorationCategory::Damage,
            preference_priorities: default_priorities(),
            optimal_solution_count: 1,
            main_attr: Some(color),
            sub_attr: None,
            main_sub_ratio: None,
            counting_bonus: None,
        };
        let boost = HashSet::new();
        let ev = IgnitionEvaluator::new(
            &target,
            &environment,
            &boost,
            &field,
            &next_puyos,
            color,
        )
        .expect("色ぷよであること");
        let setup = IgnitionSetup::new(
            &field,
            &next_puyos,
            &environment,
            color,
            10,
            PaintFilter::All,
        );

        let mut scores: Vec<u32> = Vec::new();
        for &index in &setup.candidates {
            if ev.evaluate(&[index]).is_some() {
                continue; // 発火済みは代理スコアを使わない
            }
            scores.push(solver::paint_ignition_search::surrogate_score(
                SurrogateMode::LargestComponent,
                base_board | bit(index),
                &masks,
                max_component,
            ));
        }
        if scores.is_empty() {
            continue;
        }
        unignited_counts.push(scores.len() as f64);
        let mut sorted = scores.clone();
        sorted.sort_unstable();
        sorted.dedup();
        distinct_scores.push(sorted.len() as f64);
        let top = *scores.iter().max().unwrap();
        top_ties.push(scores.iter().filter(|&&v| v == top).count() as f64);
    }

    println!("# 代理スコアの解像度 / {}盤面 seed={}.. 色={:?}", boards, seed_start, color);
    println!("\n初期盤面の塗り色の最大連結成分 (max_component={} で頭打ち):", max_component);
    let total: usize = largest_hist.iter().sum();
    for (size, count) in largest_hist.iter().enumerate() {
        if *count == 0 {
            continue;
        }
        println!(
            "  {}{}: {:>5} 盤面 ({:.1}%)",
            size,
            if size as u32 == max_component { " (飽和)" } else { "" },
            count,
            *count as f64 / total as f64 * 100.0
        );
    }
    println!("\n深さ1の未発火候補:");
    println!("  平均候補数      : {:.1}", average(unignited_counts.iter().copied()));
    println!("  相異なるスコア数: {:.1}", average(distinct_scores.iter().copied()));
    println!("  最上位で同点    : {:.1}", average(top_ties.iter().copied()));
}

/// 不確定ぷよ (ネクストより先に降ってくるぷよ) を考慮すると、選ぶ塗り案が変わるのか。
///
/// 既存のぷよ塗り探索では期待値の効果は最大 +3.8% だった (paint-search.md)。
/// 発火探索は**塗った瞬間に連鎖が走り切る**ので、補充されたぷよが連鎖を伸ばす余地が
/// あちらよりずっと大きい、という仮説の検証。
fn ev_probe(
    boards: usize,
    seed_start: u64,
    spec: &RandomBoardSpec,
    color: PuyoAttr,
    environment: &SimulationEnvironment,
    exploration_target: &ExplorationTarget,
) {
    use solver::paint_ignition_search::{ignition_cores, search_ils, IlsParams};
    use solver::simulator_bb::{UnknownFill, UnknownFillPolicy};

    const SAMPLES: usize = 20;
    let boost: HashSet<PuyoCoord> = HashSet::new();
    let fills: Vec<UnknownFill> = (0..SAMPLES)
        .map(|s| UnknownFill {
            policy: UnknownFillPolicy::ChainAverse,
            seed: (s as u64 + 1).wrapping_mul(0x9E37_79B9_7F4A_7C15),
            max_refills: 2,
        })
        .collect();

    let mut changed = 0usize;
    let mut judged = 0usize;
    let mut gains: Vec<f64> = Vec::new();
    let mut ratios: Vec<f64> = Vec::new();

    for i in 0..boards {
        let seed = seed_start + i as u64;
        let (field, next_puyos) = random_board(seed, spec);
        let Some(evaluator) = IgnitionEvaluator::new(
            exploration_target,
            environment,
            &boost,
            &field,
            &next_puyos,
            color,
        ) else {
            continue;
        };
        let setup =
            IgnitionSetup::new(&field, &next_puyos, environment, color, 10, PaintFilter::All);

        // 選抜の対象になりうる集合: 発火コア + ILS が見つけた塗り数ごとの最良。
        let mut candidates: Vec<Vec<usize>> =
            ignition_cores(&setup, environment.minimum_puyo_num_for_popping);
        let r = search_ils(&setup, &evaluator, &IlsParams::new(20_000));
        for s in r.best_by_paint_num.iter().flatten() {
            candidates.push(s.paint_set.clone());
        }
        if candidates.is_empty() {
            continue;
        }

        let mut best_det = (0usize, f64::MIN);
        let mut best_exp = (0usize, f64::MIN);
        let mut exps: Vec<f64> = Vec::with_capacity(candidates.len());
        for (k, set) in candidates.iter().enumerate() {
            let Some((solution, expected)) = evaluator.evaluate_expected(set, &fills) else {
                exps.push(f64::MIN);
                continue;
            };
            exps.push(expected);
            if solution.result.value > best_det.1 {
                best_det = (k, solution.result.value);
            }
            if expected > best_exp.1 {
                best_exp = (k, expected);
            }
        }

        judged += 1;
        if best_det.0 != best_exp.0 {
            changed += 1;
            let det_choice_ev = exps[best_det.0];
            if det_choice_ev > 0.0 {
                gains.push(best_exp.1 / det_choice_ev);
            }
        }
        if best_det.1 > 0.0 {
            ratios.push(exps[best_det.0] / best_det.1);
        }
    }

    let mean = |v: &[f64]| {
        if v.is_empty() {
            f64::NAN
        } else {
            v.iter().sum::<f64>() / v.len() as f64
        }
    };
    println!("# 期待値が選抜を変えるか / {}盤面 seed={}.. 色={:?} サンプル{}", judged, seed_start, color, SAMPLES);
    println!(
        "最良案が入れ替わる: {} / {} 盤面 ({:.0}%)",
        changed,
        judged,
        changed as f64 / judged.max(1) as f64 * 100.0
    );
    println!(
        "入れ替わったとき、期待値で選ぶと期待値が平均 {:.2}倍になる",
        mean(&gains)
    );
    println!(
        "決定論で選んだ案の「期待値 / 決定論値」は平均 {:.2}倍 (決定論評価が過小評価している度合い)",
        mean(&ratios)
    );
}
