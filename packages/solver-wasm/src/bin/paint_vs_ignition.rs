//! 「連鎖しやすい形を作る塗り」と「塗った瞬間に発火させる塗り」の**所要時間**を同条件で比べる。
//!
//! UI で2つを切り替えられるようにするにあたり、利用者から見て待ち時間がどれだけ違うかを
//! 知るためのもの。品質の比較ではない (そもそも目的が違うので比べられない)。
//!
//! ## 何が違って当然なのか
//!
//! - 既存 (`paint_search`): 塗り集合1件ごとに**なぞり探索を丸ごと1回**回す。重い
//! - 発火 (`paint_ignition_search`): 塗り集合1件ごとに**連鎖シミュレーション1回**。軽い
//!
//! どちらも1スレッド。実運用は分割するので、ここの数字はそのぶん割り引いて読むこと
//! (既存は塗り集合の評価を、発火は再始動をワーカーに分ける)。
//!
//! ## 使い方
//!
//!   cargo run --release --bin paint_vs_ignition -- --boards 20
//!
//! `--dump-fixtures` は wasm 側で同じ盤面を測るための入力を書き出す。
//! JSON の書き出しに serde_json が要るので `server` フィーチャーが必要:
//!
//!   cargo run --release --features server --bin paint_vs_ignition -- \
//!       --boards 20 --dump-fixtures /tmp/fixtures.json

use std::env;
use std::time::Instant;

use solver::exploration_target::{ExplorationCategory, ExplorationTarget};
use solver::paint::PaintFilter;
use solver::paint_ignition_search::{search_ignition, IgnitionPrecision, IgnitionSearchParams};
use solver::paint_search::{
    self, PaintEvalContext, PaintPrecision, PaintSearchParams,
};
use solver::puyo::{Field, NextPuyos};
use solver::puyo_attr::PuyoAttr;
use solver::puyo_coord::PuyoCoord;
use solver::simulation_environment::SimulationEnvironment;
use solver::trace_mode::TraceMode;
use std::collections::HashSet;

mod common;
use common::{default_priorities, flag, random_board, RandomBoardSpec};

/// 中央値を返す (外れ値に引きずられないため)。
fn median(mut values: Vec<f64>) -> f64 {
    if values.is_empty() {
        return f64::NAN;
    }
    values.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let mid = values.len() / 2;
    if values.len() % 2 == 0 {
        (values[mid - 1] + values[mid]) / 2.0
    } else {
        values[mid]
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let boards: usize = flag(&args, "--boards")
        .and_then(|s| s.parse().ok())
        .unwrap_or(10);
    let seed0: u64 = flag(&args, "--seed")
        .and_then(|s| s.parse().ok())
        .unwrap_or(30001);
    let color = PuyoAttr::Red;
    let max_paint_num: u32 = flag(&args, "--max")
        .and_then(|s| s.parse().ok())
        .unwrap_or(10);
    let max_trace_num: u32 = flag(&args, "--trace")
        .and_then(|s| s.parse().ok())
        .unwrap_or(5);

    let environment = SimulationEnvironment {
        is_chance_mode: false,
        minimum_puyo_num_for_popping: 4,
        max_trace_num,
        trace_mode: TraceMode::Normal,
        popping_leverage: 7.5,
        chain_leverage: 10.5,
    };
    let exploration_target = ExplorationTarget {
        category: ExplorationCategory::Damage,
        preference_priorities: default_priorities(),
        optimal_solution_count: 1,
        main_attr: Some(color),
        sub_attr: None,
        main_sub_ratio: None,
        counting_bonus: None,
    };
    let boost_area: HashSet<PuyoCoord> = HashSet::new();
    let spec = RandomBoardSpec::default();

    println!(
        "# 連鎖しやすい形 vs 発火 / 盤面{}枚 seed={}.. 色={:?} 塗り上限={} 最大なぞり数={}",
        boards, seed0, color, max_paint_num, max_trace_num
    );
    println!("# ネイティブ・1スレッド。実運用は分割するのでそのぶん割り引くこと。");

    let mut fixtures: Vec<String> = Vec::new();

    // 盤面だけ書き出して終わるモード (wasm 計測の入力を作るため)。
    #[cfg(feature = "server")]
    if args.iter().any(|a| a == "--fixtures-only") {
        for i in 0..boards {
            let seed = seed0 + i as u64;
            let (field, next_puyos): (Field, NextPuyos) = random_board(seed, &spec);
            fixtures.push(format!(
                "{{\"seed\":{},\"field\":{},\"nextPuyos\":{}}}",
                seed,
                serde_json::to_string(&field).unwrap(),
                serde_json::to_string(&next_puyos).unwrap()
            ));
        }
        let path = flag(&args, "--dump-fixtures").expect("--dump-fixtures が要る");
        let json = format!(
            "{{\"environment\":{},\"explorationTarget\":{},\"maxPaintNum\":{},\"maxTraceNum\":{},\"boards\":[{}]}}",
            serde_json::to_string(&environment).unwrap(),
            serde_json::to_string(&exploration_target).unwrap(),
            max_paint_num,
            max_trace_num,
            fixtures.join(",")
        );
        std::fs::write(path, json).expect("書き出せること");
        println!("# 盤面{}枚を {} に書き出した", boards, path);
        return;
    }

    // 測る精度。既存の探索は単スレッドだと超高精度で1盤面あたり分単位かかるので、
    // 絞れるようにしてある。
    let precisions: Vec<&str> = flag(&args, "--precisions")
        .unwrap_or("standard,high,ultra")
        .split(',')
        .collect();

    for (paint_precision, ignition_precision, name) in [
        (PaintPrecision::Standard, IgnitionPrecision::Standard, "標準"),
        (PaintPrecision::High, IgnitionPrecision::High, "高精度"),
        (PaintPrecision::Ultra, IgnitionPrecision::Ultra, "超高精度"),
    ] {
        if !precisions.contains(&match paint_precision {
            PaintPrecision::Standard => "standard",
            PaintPrecision::High => "high",
            PaintPrecision::Ultra => "ultra",
        }) {
            continue;
        }
        let mut paint_ms: Vec<f64> = Vec::new();
        let mut ignition_ms: Vec<f64> = Vec::new();

        for i in 0..boards {
            let seed = seed0 + i as u64;
            let (field, next_puyos): (Field, NextPuyos) = random_board(seed, &spec);

            // 既存: 連鎖しやすい形を作る塗り。
            let paint_params = PaintSearchParams {
                precision: paint_precision,
                ..PaintSearchParams::new(color, max_paint_num)
            };
            let eval = PaintEvalContext {
                exploration_target: &exploration_target,
                environment: &environment,
                boost_area: &boost_area,
                field: &field,
                next_puyos: &next_puyos,
            };
            let started = Instant::now();
            let plans = paint_search::search_paint_plans(&eval, &paint_params);
            paint_ms.push(started.elapsed().as_secs_f64() * 1000.0);
            let paint_value = plans.first().map(|p| p.value).unwrap_or(0.0);

            // 新: 塗った瞬間に発火させる塗り。
            let ignition_params = IgnitionSearchParams {
                precision: ignition_precision,
                filter: PaintFilter::All,
                ..IgnitionSearchParams::new(color, max_paint_num)
            };
            let started = Instant::now();
            let result = search_ignition(
                &exploration_target,
                &environment,
                &boost_area,
                &field,
                &next_puyos,
                &ignition_params,
            );
            ignition_ms.push(started.elapsed().as_secs_f64() * 1000.0);
            let ignition_value = result
                .as_ref()
                .and_then(|r| r.best.as_ref())
                .map(|p| p.value)
                .unwrap_or(0.0);

            #[cfg(feature = "server")]
            if paint_precision == PaintPrecision::Standard {
                fixtures.push(format!(
                    "{{\"seed\":{},\"field\":{},\"nextPuyos\":{}}}",
                    seed,
                    serde_json::to_string(&field).unwrap(),
                    serde_json::to_string(&next_puyos).unwrap()
                ));
            }
            let _ = (paint_value, ignition_value, &mut fixtures);
        }

        let p = median(paint_ms.clone());
        let g = median(ignition_ms.clone());
        println!(
            "\n[{}] 連鎖しやすい形 中央値 {:>9.1} ms (平均 {:>9.1})",
            name,
            p,
            paint_ms.iter().sum::<f64>() / paint_ms.len() as f64
        );
        println!(
            "[{}] 発火           中央値 {:>9.1} ms (平均 {:>9.1})  → **{:.1}倍 速い**",
            name,
            g,
            ignition_ms.iter().sum::<f64>() / ignition_ms.len() as f64,
            p / g
        );
    }

    #[cfg(feature = "server")]
    if let Some(path) = flag(&args, "--dump-fixtures") {
        let json = format!(
            "{{\"environment\":{},\"explorationTarget\":{},\"maxPaintNum\":{},\"boards\":[{}]}}",
            serde_json::to_string(&environment).unwrap(),
            serde_json::to_string(&exploration_target).unwrap(),
            max_paint_num,
            fixtures.join(",")
        );
        std::fs::write(path, json).expect("書き出せること");
        println!("\n# wasm 計測用の入力を {} に書き出した", path);
    }
    #[cfg(not(feature = "server"))]
    if flag(&args, "--dump-fixtures").is_some() {
        println!("\n# --dump-fixtures には --features server が要る");
    }
}
