//! 前段「ぷよ塗り」の候補を絞り込むための**代理評価**が、本番評価の順位をどれだけ
//! 再現するかを測る計測用バイナリ。
//!
//! ## なぜ要るか
//!
//! 有効な塗り集合は絞り込み後でも 10^3〜10^6 件あり、全件に本番評価
//! (なぞり6の全探索, 1件あたり数十 ms) を掛けるのは非現実的。そこで
//!
//!   全候補 → 安い代理評価で上位N件に絞る → その N 件だけ本番評価
//!
//! というパイプラインにしたい。このとき知りたいのは
//! **「代理の上位N件に、真の最良解がどれだけ残るか」**。それを実測する。
//!
//! ## 何を測るか
//!
//! 有効な塗り集合をすべて列挙し、各々について
//!   - 本番評価: `--trace` なぞりの全探索 (既定 6) → これを正解とする
//!   - 代理評価: なぞり数を落とした全探索 (`--surrogates`, 既定 3,4,5)
//!   - 代理評価: 静的スコア (塗り色の連結成分の形だけから決まる。探索なし)
//! を求め、次を出す。
//!   - Spearman 順位相関
//!   - screen@N: 代理の上位N件だけを本番評価したときに得られる最良値 / 真の最良値
//!
//! screen@N が 1.000 なら「その N 件まで絞っても真の最良解を取り逃さない」。
//!
//! ## 使い方
//!
//!   cargo run --release --bin paint_surrogate_eval -- --color green --filter adj2
//!   RUSTFLAGS="-C target-cpu=native" cargo run --release --bin paint_surrogate_eval -- \
//!       --color red --filter adj2 --max 10 --trace 6

use std::collections::HashSet;
use std::env;
use std::time::Instant;

use rayon::prelude::*;

use solver::exploration_target::{ExplorationCategory, ExplorationTarget, PreferenceKind};
use solver::solution::SolutionResult;
use solver::paint::{
    bit, build_neighbor_masks, Bits, PaintFilter, PaintSetup, CELL_NUM, WIDTH,
};
use solver::puyo::{Field, NextPuyos};
use solver::puyo_attr::PuyoAttr;
use solver::puyo_coord::PuyoCoord;
use solver::puyo_type::get_attr;
use solver::simulation_environment::SimulationEnvironment;
use solver::solution_explorer::{better_solution, SolutionExplorer};
use solver::trace_mode::TraceMode;

mod common;
use common::{
    flag, format_field, natsuama_field, natsuama_next_puyos, parse_color, random_board,
    RandomBoardSpec,
};

/// 盤面に対し、なぞり `max_trace_num` の全探索を掛けて最良解を返す。
fn best_solution(
    field: &Field,
    next_puyos: &NextPuyos,
    category: ExplorationCategory,
    main_attr: PuyoAttr,
    priorities: &[PreferenceKind],
    boost_area: &HashSet<PuyoCoord>,
    minimum_puyo_num_for_popping: u32,
    max_trace_num: u32,
) -> Option<SolutionResult> {
    let environment = SimulationEnvironment {
        is_chance_mode: false,
        minimum_puyo_num_for_popping,
        max_trace_num,
        trace_mode: TraceMode::Normal,
        popping_leverage: 7.5,
        chain_leverage: 10.5,
    };
    let exploration_target = ExplorationTarget {
        category,
        preference_priorities: priorities.to_vec(),
        optimal_solution_count: 1,
        // ぷよ使いカウントでは主属性は使われない。
        main_attr: match category {
            ExplorationCategory::PuyotsukaiCount => None,
            _ => Some(main_attr),
        },
        sub_attr: None,
        main_sub_ratio: None,
        counting_bonus: None,
    };
    let explorer = SolutionExplorer::new(
        &exploration_target,
        &environment,
        boost_area,
        field,
        next_puyos,
    );
    explorer.solve_all_traces().optimal_solutions.into_iter().next()
}

/// 好みの優先度に従って、解の並びから最良解を選ぶ。
fn pick_best<'a>(
    priorities: &Vec<PreferenceKind>,
    solutions: impl Iterator<Item = &'a Option<SolutionResult>>,
) -> Option<&'a SolutionResult> {
    solutions.flatten().fold(None, |acc, s| match acc {
        None => Some(s),
        Some(a) => Some(better_solution(priorities, a, s)),
    })
}

/// 表示用のスカラー。解が無いときは 0。
fn value_of(solution: &Option<SolutionResult>) -> f64 {
    solution.as_ref().map(|s| s.value).unwrap_or(0.0)
}

/// 探索を一切せず、塗り色の連結成分の形だけから決まる静的スコア。
///
/// 狙いは「あと1個で発火する3連結の種」をどれだけ仕込めたかを測ること。
/// 制約により成分は最大3個なので、3連結を最も高く、次いで2連結を評価する。
fn static_score(field: &Field, target: PuyoAttr, masks: &[Bits; CELL_NUM]) -> f64 {
    let mut board: Bits = 0;
    for index in 0..CELL_NUM {
        if let Some(puyo) = field[index / WIDTH][index % WIDTH] {
            if get_attr(puyo.puyo_type) == target {
                board |= bit(index);
            }
        }
    }

    let mut score = 0.0;
    let mut remaining = board;
    while remaining != 0 {
        let seed = remaining.trailing_zeros() as usize;
        let mut component = bit(seed);
        loop {
            let mut grown = component;
            let mut c = component;
            while c != 0 {
                let i = c.trailing_zeros() as usize;
                c &= c - 1;
                grown |= masks[i] & board;
            }
            if grown == component {
                break;
            }
            component = grown;
        }
        score += match component.count_ones() {
            1 => 1.0,
            2 => 4.0,
            _ => 12.0, // 3連結 = あと1個で発火
        };
        remaining &= !component;
    }
    score
}

/// 同順位を平均順位で扱う Spearman 順位相関。
fn spearman(a: &[f64], b: &[f64]) -> f64 {
    let ra = average_ranks(a);
    let rb = average_ranks(b);
    let n = ra.len() as f64;
    let mean_a = ra.iter().sum::<f64>() / n;
    let mean_b = rb.iter().sum::<f64>() / n;

    let mut cov = 0.0;
    let mut var_a = 0.0;
    let mut var_b = 0.0;
    for i in 0..ra.len() {
        let da = ra[i] - mean_a;
        let db = rb[i] - mean_b;
        cov += da * db;
        var_a += da * da;
        var_b += db * db;
    }
    if var_a == 0.0 || var_b == 0.0 {
        return f64::NAN;
    }
    cov / (var_a.sqrt() * var_b.sqrt())
}

fn average_ranks(values: &[f64]) -> Vec<f64> {
    let mut order: Vec<usize> = (0..values.len()).collect();
    order.sort_by(|&i, &j| values[i].partial_cmp(&values[j]).unwrap());

    let mut ranks = vec![0.0; values.len()];
    let mut i = 0;
    while i < order.len() {
        let mut j = i;
        while j + 1 < order.len() && values[order[j + 1]] == values[order[i]] {
            j += 1;
        }
        let avg = ((i + j) as f64) / 2.0 + 1.0;
        for &k in &order[i..=j] {
            ranks[k] = avg;
        }
        i = j + 1;
    }
    ranks
}

/// 代理の上位N件だけを本番評価したときに得られる最良値 / 真の最良値。
///
/// 順位付けはどちらも好みの優先度リストに従う (値だけの比較ではない)。優先度の先頭が
/// `BiggerValue` 以外だと、比の分子が分母を上回ることが原理上ありうる点に注意。
fn screen_at(
    priorities: &Vec<PreferenceKind>,
    surrogate_order: &[usize],
    truth: &[Option<SolutionResult>],
    n: usize,
) -> f64 {
    let best_in_top_n = pick_best(
        priorities,
        surrogate_order.iter().take(n).map(|&i| &truth[i]),
    );
    let true_best = pick_best(priorities, truth.iter());
    match (best_in_top_n, true_best) {
        (Some(a), Some(b)) if b.value > 0.0 => a.value / b.value,
        _ => f64::NAN,
    }
}

/// 好みの優先度に従って候補を良い順に並べた添字列を返す。
fn rank_order(
    priorities: &Vec<PreferenceKind>,
    solutions: &[Option<SolutionResult>],
) -> Vec<usize> {
    let mut order: Vec<usize> = (0..solutions.len()).collect();
    order.sort_by(|&i, &j| match (&solutions[i], &solutions[j]) {
        (Some(a), Some(b)) => {
            if std::ptr::eq(better_solution(priorities, a, b), a) {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            }
        }
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => std::cmp::Ordering::Equal,
    });
    order
}

fn report(
    label: &str,
    priorities: &Vec<PreferenceKind>,
    surrogate: &[Option<SolutionResult>],
    truth: &[Option<SolutionResult>],
    elapsed_ms: f64,
    ns: &[usize],
) {
    let surrogate_values: Vec<f64> = surrogate.iter().map(value_of).collect();
    let truth_values: Vec<f64> = truth.iter().map(value_of).collect();
    let rho = spearman(&surrogate_values, &truth_values);
    let order = rank_order(priorities, surrogate);
    let screens: Vec<String> = ns
        .iter()
        .filter(|&&n| n <= truth.len())
        .map(|&n| format!("@{}:{:.4}", n, screen_at(priorities, &order, truth, n)))
        .collect();
    println!(
        "  {:<12} spearman={:>7.4}  eval={:>9.1} ms  screen {}",
        label,
        rho,
        elapsed_ms,
        screens.join("  ")
    );
}

/// 好みの名前を [`PreferenceKind`] に変換する。
fn parse_preference(s: &str) -> PreferenceKind {
    match s {
        "chance" => PreferenceKind::ChancePop,
        "value" => PreferenceKind::BiggerValue,
        "prism" => PreferenceKind::PrismPop,
        "allclear" => PreferenceKind::AllClear,
        "tracenum" => PreferenceKind::SmallerTraceNum,
        "heart" => PreferenceKind::HeartPop,
        "ojama" => PreferenceKind::OjamaPop,
        other => panic!(
            "未知の --priorities 要素: {} (chance|value|prism|allclear|tracenum|heart|ojama)",
            other
        ),
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();

    // --seed を渡すとランダム通常盤面、渡さなければ なつアマ/1。
    let seed: Option<u64> = flag(&args, "--seed").and_then(|s| s.parse().ok());
    let (field, next_puyos, board_name) = match seed {
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
    // ブーストエリア: all は全面 (ぷよ使いカウントが一律3倍になるだけで順位は変わらない)。
    let boost_area: HashSet<PuyoCoord> = match flag(&args, "--boost").unwrap_or("none") {
        "none" => HashSet::new(),
        "all" => (0..48u8).filter_map(PuyoCoord::index_to_coord).collect(),
        other => panic!("未知の --boost: {} (none|all)", other),
    };
    let masks = build_neighbor_masks();

    let target = flag(&args, "--color")
        .and_then(parse_color)
        .unwrap_or(PuyoAttr::Green);
    let category = match flag(&args, "--category").unwrap_or("damage") {
        "damage" => ExplorationCategory::Damage,
        "skill" => ExplorationCategory::SkillPuyoCount,
        "tsukai" | "puyotsukai" => ExplorationCategory::PuyotsukaiCount,
        other => panic!("未知の --category: {} (damage|skill|tsukai)", other),
    };
    let main_attr = flag(&args, "--main-attr")
        .and_then(parse_color)
        .unwrap_or(target);
    let max_paint_num: usize = flag(&args, "--max")
        .and_then(|s| s.parse().ok())
        .unwrap_or(10);
    let min_pop: u32 = flag(&args, "--min-pop")
        .and_then(|s| s.parse().ok())
        .unwrap_or(4);
    let filter = flag(&args, "--filter")
        .and_then(PaintFilter::parse)
        .unwrap_or(PaintFilter::Adj2);
    let true_trace: u32 = flag(&args, "--trace")
        .and_then(|s| s.parse().ok())
        .unwrap_or(6);
    let surrogate_traces: Vec<u32> = flag(&args, "--surrogates")
        .map(|s| s.split(',').filter_map(|t| t.trim().parse().ok()).collect())
        .unwrap_or_else(|| vec![3, 4, 5]);
    // 実運用に近い既定: チャンス → 値が大きい → プリズム → 全消し → なぞり数が少ない。
    let priorities: Vec<PreferenceKind> = flag(&args, "--priorities")
        .map(|s| s.split(',').map(|t| parse_preference(t.trim())).collect())
        .unwrap_or_else(|| {
            vec![
                PreferenceKind::ChancePop,
                PreferenceKind::BiggerValue,
                PreferenceKind::PrismPop,
                PreferenceKind::AllClear,
                PreferenceKind::SmallerTraceNum,
            ]
        });

    let setup = PaintSetup::new(&field, &next_puyos, target, max_paint_num, min_pop, filter);

    // 「塗らない」も候補の1つなので空集合を先頭に入れる。
    let mut paint_sets: Vec<Vec<usize>> = vec![Vec::new()];
    setup.for_each_paint_set(&mut |s| paint_sets.push(s.to_vec()));

    eprintln!(
        "board={}  category={:?}  paint_color={:?}  main_attr={:?}  max_paint={}  filter={}  \
         M={}  paint_sets={} (空集合込み)  true_trace={}  boost={}\n{}",
        board_name,
        category,
        target,
        main_attr,
        max_paint_num,
        filter.name(),
        setup.candidates.len(),
        paint_sets.len(),
        true_trace,
        boost_area.len(),
        format_field(&field)
    );

    // 塗り適用後の盤面を先に作っておく (評価ごとに作り直さない)。
    let painted_fields: Vec<Field> = paint_sets
        .iter()
        .map(|s| setup.apply(&field, s))
        .collect();

    let evaluate = |max_trace_num: u32| -> (Vec<Option<SolutionResult>>, f64) {
        let start = Instant::now();
        let solutions: Vec<Option<SolutionResult>> = painted_fields
            .par_iter()
            .map(|f| {
                best_solution(
                    f,
                    &next_puyos,
                    category,
                    main_attr,
                    &priorities,
                    &boost_area,
                    min_pop,
                    max_trace_num,
                )
            })
            .collect();
        (solutions, start.elapsed().as_secs_f64() * 1000.0)
    };

    let (truth_solutions, truth_ms) = evaluate(true_trace);
    let truth: Vec<f64> = truth_solutions.iter().map(value_of).collect();
    let true_best = pick_best(&priorities, truth_solutions.iter())
        .map(|s| s.value)
        .unwrap_or(f64::NAN);
    let no_paint_value = truth[0];
    println!(
        "truth(trace={}): best={:.1}  no_paint={:.1}  gain={:.2}x  eval={:.1} ms",
        true_trace,
        true_best,
        no_paint_value,
        if no_paint_value > 0.0 {
            true_best / no_paint_value
        } else {
            f64::NAN
        },
        truth_ms
    );

    // 真値の分布。screen@N の解釈には「最良値が何件あるか」が要る
    // (最良値が大量にあるなら screen@N は簡単に 1.0 になり、代理の実力を過大評価する)。
    {
        let mut sorted = truth.clone();
        sorted.sort_by(|a, b| b.partial_cmp(a).unwrap());
        let best_count = sorted.iter().filter(|&&v| v == true_best).count();
        let pct = |p: f64| sorted[((sorted.len() - 1) as f64 * p) as usize];
        println!(
            "  distribution: best_count={} ({:.2}%)  p0={:.1} p1={:.1} p5={:.1} p25={:.1} \
             p50={:.1} p100={:.1}",
            best_count,
            100.0 * best_count as f64 / sorted.len() as f64,
            pct(0.0),
            pct(0.01),
            pct(0.05),
            pct(0.25),
            pct(0.50),
            pct(1.0)
        );
        // 塗り数ごとの最良値。「塗るほど良い」が成り立つかを見る。
        let mut best_by_size = vec![f64::NEG_INFINITY; max_paint_num + 1];
        for (i, s) in paint_sets.iter().enumerate() {
            if truth[i] > best_by_size[s.len()] {
                best_by_size[s.len()] = truth[i];
            }
        }
        let by_size: Vec<String> = best_by_size
            .iter()
            .enumerate()
            .filter(|(_, v)| v.is_finite())
            .map(|(k, v)| format!("{}:{:.1}", k, v))
            .collect();
        println!("  best_by_paint_size  {}", by_size.join("  "));
    }

    let ns = [1usize, 10, 50, 100, 500, 1000];

    // 静的スコアは SolutionResult を持たないので、値順の並びだけで screen を測る。
    {
        let start = Instant::now();
        let statics: Vec<f64> = painted_fields
            .par_iter()
            .map(|f| static_score(f, target, &masks))
            .collect();
        let static_ms = start.elapsed().as_secs_f64() * 1000.0;

        let mut order: Vec<usize> = (0..statics.len()).collect();
        order.sort_by(|&i, &j| statics[j].partial_cmp(&statics[i]).unwrap());
        let screens: Vec<String> = ns
            .iter()
            .filter(|&&n| n <= truth.len())
            .map(|&n| {
                format!(
                    "@{}:{:.4}",
                    n,
                    screen_at(&priorities, &order, &truth_solutions, n)
                )
            })
            .collect();
        println!(
            "  {:<12} spearman={:>7.4}  eval={:>9.1} ms  screen {}",
            "static",
            spearman(&statics, &truth),
            static_ms,
            screens.join("  ")
        );
    }

    for &t in &surrogate_traces {
        if t >= true_trace {
            continue;
        }
        let (solutions, ms) = evaluate(t);
        report(
            &format!("trace={}", t),
            &priorities,
            &solutions,
            &truth_solutions,
            ms,
            &ns,
        );
    }
}
