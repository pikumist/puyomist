//! 前段「ぷよ塗り」の有効な塗り集合の個数と列挙時間を測る計測用バイナリ。
//!
//! 制約と列挙アルゴリズムの説明は [`solver::paint`] を参照。ここでは
//! **候補マスの絞り込み ([`PaintFilter`]) が有効集合数をどれだけ削るか**を測る。
//!
//! ## 使い方
//!
//!   cargo run --release --bin count_paint_sets                          # 全5色 × 上限8,10 × 全filter
//!   cargo run --release --bin count_paint_sets -- --color purple --max 10
//!   cargo run --release --bin count_paint_sets -- --color purple --max 10 --filter adj2
//!   cargo run --release --bin count_paint_sets -- --min-pop 3

use std::env;
use std::time::Instant;

use solver::paint::{ColumnRuns, PaintFilter, PaintSetup, ALL_PAINT_FILTERS};
use solver::puyo::{Field, NextPuyos};
use solver::puyo_attr::PuyoAttr;

mod common;
use common::{
    flag, format_field, natsuama_field, natsuama_next_puyos, parse_color, random_board,
    RandomBoardSpec,
};

fn measure(
    field: &Field,
    next_puyos: &NextPuyos,
    target: PuyoAttr,
    max_paint_num: usize,
    minimum_puyo_num_for_popping: u32,
    filter: PaintFilter,
) {
    let setup = PaintSetup::new(
        field,
        next_puyos,
        target,
        max_paint_num,
        minimum_puyo_num_for_popping,
        filter,
    );

    // 列のランによる支配判定。絶対に消えない位置への塗りを含む集合は評価前に落とせる。
    let runs = ColumnRuns::new(field, next_puyos, target, minimum_puyo_num_for_popping);

    let mut counts = vec![0u64; max_paint_num + 1];
    let mut live_counts = vec![0u64; max_paint_num + 1];
    let start = Instant::now();
    setup.for_each_paint_set(&mut |paint_set| {
        counts[paint_set.len()] += 1;
        if runs.all_painted_cells_can_pop(paint_set) {
            live_counts[paint_set.len()] += 1;
        }
    });
    let elapsed = start.elapsed();

    let total: u64 = counts.iter().sum();
    let live_total: u64 = live_counts.iter().sum();

    println!(
        "color={:<7} max_paint={:<3} filter={:<6} raw={:<3} filtered={:<3} M={:<3} \
         total={:<12} after_column_runs={:<12} ({:>5.1}%) elapsed={:>8.2} ms",
        format!("{:?}", target),
        max_paint_num,
        filter.name(),
        setup.raw_candidates.len(),
        setup.filtered_candidates.len(),
        setup.candidates.len(),
        total,
        live_total,
        100.0 * live_total as f64 / total.max(1) as f64,
        elapsed.as_secs_f64() * 1000.0
    );
    let per_size: Vec<String> = (1..=max_paint_num)
        .map(|k| format!("{}:{}/{}", k, live_counts[k], counts[k]))
        .collect();
    println!("    by_size (ラン通過/全体)  {}", per_size.join("  "));
}

fn main() {
    let args: Vec<String> = env::args().collect();
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

    let min_pop: u32 = flag(&args, "--min-pop")
        .and_then(|s| s.parse().ok())
        .unwrap_or(4);

    eprintln!(
        "board={} (8x6)  neighborhood=4 (up/down/left/right)\n{}",
        board_name,
        format_field(&field)
    );

    let colors: Vec<PuyoAttr> = match flag(&args, "--color").and_then(parse_color) {
        Some(attr) => vec![attr],
        None => Vec::from([
            PuyoAttr::Red,
            PuyoAttr::Blue,
            PuyoAttr::Green,
            PuyoAttr::Yellow,
            PuyoAttr::Purple,
        ]),
    };
    let max_paints: Vec<usize> = match flag(&args, "--max").and_then(|s| s.parse().ok()) {
        Some(k) => vec![k],
        None => vec![8, 10],
    };
    let filters: Vec<PaintFilter> = match flag(&args, "--filter").and_then(PaintFilter::parse) {
        Some(f) => vec![f],
        None => ALL_PAINT_FILTERS.to_vec(),
    };

    for &attr in &colors {
        for &k in &max_paints {
            for &f in &filters {
                measure(&field, &next_puyos, attr, k, min_pop, f);
            }
        }
    }
}
