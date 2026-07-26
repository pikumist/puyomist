//! ランダム通常盤面の生成条件を確認する計測用バイナリ。
//!
//! 実際のゲームの初期盤面は「いきなり消える同色連結が無い」ので、生成器は棄却サンプリングで
//! その条件を満たす盤面だけを返す。ここでは棄却率と、生成された盤面の内訳を確認する。
//!
//!   cargo run --release --bin random_board_stats -- [盤面数]

use std::env;

use solver::paint::dead_cells;
use solver::puyo_attr::PuyoAttr;
use solver::puyo_type::{get_attr, is_chance_type, is_plus_type};

mod common;
use common::{format_field, random_board_with_attempts, RandomBoardSpec};

fn main() {
    let args: Vec<String> = env::args().collect();
    let board_num: u64 = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(200);
    let spec = RandomBoardSpec::default();

    let mut total_attempts = 0u64;
    let mut max_attempts = 0u32;
    let mut plus_total = 0u64;
    let mut chance_total = 0u64;
    let mut heart_total = 0u64;
    let mut dead_total = 0u64;
    let mut dead_max = 0usize;
    let mut boards_with_dead = 0u64;

    for seed in 1..=board_num {
        let (field, _next, attempts) = random_board_with_attempts(seed, &spec);
        total_attempts += attempts as u64;
        max_attempts = max_attempts.max(attempts);

        for row in field.iter() {
            for cell in row.iter().flatten() {
                let t = cell.puyo_type;
                if get_attr(t) == PuyoAttr::Heart {
                    heart_total += 1;
                }
                if is_plus_type(t) {
                    plus_total += 1;
                }
                if is_chance_type(t) {
                    chance_total += 1;
                }
            }
        }

        let dead = dead_cells(&field, &_next, 4);
        dead_total += dead.len() as u64;
        dead_max = dead_max.max(dead.len());
        if !dead.is_empty() {
            boards_with_dead += 1;
        }

        if seed <= 2 {
            println!("--- seed={} (棄却サンプリング {} 回目で成立)", seed, attempts);
            println!("{}", format_field(&field));
        }
    }

    let n = board_num as f64;
    println!();
    println!(
        "boards={}  平均試行回数={:.1} (= 完全ランダムのうち約 {:.3}% だけが初期消えなし)  最大試行回数={}",
        board_num,
        total_attempts as f64 / n,
        100.0 * n / total_attempts as f64,
        max_attempts
    );
    println!(
        "1盤面あたり平均  プラス={:.1}個  チャンス={:.2}個  ハート={:.2}個",
        plus_total as f64 / n,
        chance_total as f64 / n,
        heart_total as f64 / n
    );
    println!(
        "そのままでは絶対消えないマス: 1盤面あたり平均 {:.2}個  最大 {}個  \
         1個以上ある盤面の割合 {:.1}%",
        dead_total as f64 / n,
        dead_max,
        100.0 * boards_with_dead as f64 / n
    );
}
